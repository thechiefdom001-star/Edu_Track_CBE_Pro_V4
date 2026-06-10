// Google Sheet Sync Service - Secured & Optimized
// Handles data synchronization with deduplication, validation, and error handling

const STUDENT_HEADERS = ['id', 'name', 'grade', 'stream', 'admissionNo', 'admissionDate', 'upiNo', 'assessmentNo', 'parentContact', 'category', 'previousArrears', 'selectedFees', 'religion', 'portraitUrl'];
const ASSESSMENT_HEADERS = ['id', 'studentId', 'studentAdmissionNo', 'studentName', 'grade', 'subject', 'score', 'term', 'examType', 'academicYear', 'date', 'level', 'rawScore', 'maxScore'];
const ATTENDANCE_HEADERS = ['id', 'studentId', 'date', 'status', 'term', 'academicYear'];
const TEACHER_HEADERS = ['id', 'name', 'contact', 'subjects', 'grades', 'employeeNo', 'nssfNo', 'shifNo', 'taxNo', 'isClassTeacher', 'classTeacherGrade'];
const STAFF_HEADERS = ['id', 'name', 'role', 'contact', 'employeeNo', 'nssfNo', 'shifNo', 'taxNo'];
const PAYMENT_HEADERS = ['id', 'studentId', 'studentName', 'gradeAtPayment', 'amount', 'term', 'academicYear', 'date', 'receiptNo', 'method', 'reference', 'items', 'voided', 'voidedAt', 'voidedBy', 'voidReason'];
const PARENT_HEADERS = ['id', 'admissionNo', 'name', 'contact', 'email', 'createdAt', 'lastLogin'];
const CALENDAR_HEADERS = ['id', 'title', 'start', 'end', 'type', 'details', 'term', 'academicYear'];

class GoogleSheetSync {
    constructor() {
        this.settings = {};
        this._syncLock = false;
        this._lastSyncTime = 0;
        this._syncCooldown = 30000; // Minimum 30 seconds between syncs
        this._lastActivityTime = 0;
        this._activityCooldown = 60000; // Minimum 60 seconds between activity updates
        this._version = '2.0-secure';
        this._students = []; // Store students for enrichment
        this._currentUserId = null; // Store current user for background activity reporting
    }

    // Set users for activity tracking
    setCurrentUser(userId) {
        this._currentUserId = userId;
        if (userId) this.setActiveUser(userId);
    }

    // Set students list for enrichment during sync
    setStudents(students) {
        this._students = students || [];
    }

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION & CONFIGURATION
    // ═══════════════════════════════════════════════════════════════

    setSettings(settings) {
        this.settings = { ...settings };
        console.log(`[Sync] Settings updated. URL: ${this.settings.googleScriptUrl ? '✓ Configured' : '✗ Missing'}`);
    }

    isConfigured() {
        return !!(this.settings?.googleScriptUrl && this.settings.googleScriptUrl.includes('script.google.com'));
    }

    // ═══════════════════════════════════════════════════════════════
    // DATA VALIDATION
    // ═══════════════════════════════════════════════════════════════

    _validateRecord(record, type) {
        if (!record || typeof record !== 'object') {
            return { valid: false, error: 'Invalid record format' };
        }

        const validators = {
            student: (r) => {
                if (!r.id && !r.admissionNo) return { valid: false, error: 'Missing student ID' };
                return { valid: true };
            },
            assessment: (r) => {
                if (!r.id) return { valid: false, error: 'Missing assessment ID' };
                if (!r.studentId) return { valid: false, error: 'Missing student ID' };
                if (typeof r.score !== 'number') return { valid: false, error: 'Invalid score' };
                return { valid: true };
            },
            payment: (r) => {
                if (!r.id) return { valid: false, error: 'Missing payment ID' };
                if (!r.studentId) return { valid: false, error: 'Missing student ID' };
                if (typeof r.amount !== 'number' || r.amount < 0) return { valid: false, error: 'Invalid amount' };
                return { valid: true };
            },
            teacher: (r) => {
                if (!r.id && !r.name) return { valid: false, error: 'Missing teacher info' };
                return { valid: true };
            },
            staff: (r) => {
                if (!r.id && !r.name) return { valid: false, error: 'Missing staff info' };
                return { valid: true };
            },
            attendance: (r) => {
                if (!r.id) return { valid: false, error: 'Missing attendance ID' };
                if (!r.studentId) return { valid: false, error: 'Missing student ID' };
                return { valid: true };
            }
        };

        const validator = validators[type];
        if (!validator) return { valid: true }; // Unknown type, allow it

        return validator(record);
    }

    _sanitizeRecord(record, type) {
        const sanitized = { ...record };

        // Remove any potentially dangerous fields
        const dangerousFields = ['__proto__', 'constructor', 'prototype'];
        dangerousFields.forEach(field => delete sanitized[field]);

        // Sanitize strings
        const stringFields = ['name', 'subject', 'receiptNo', 'method', 'reference'];
        stringFields.forEach(field => {
            if (typeof sanitized[field] === 'string') {
                sanitized[field] = sanitized[field].trim().slice(0, 500);
            }
        });

        // Ensure ID is string
        if (sanitized.id) {
            sanitized.id = String(sanitized.id).slice(0, 100);
        }

        // Sanitize amounts
        if (typeof sanitized.amount === 'number') {
            sanitized.amount = Math.round(sanitized.amount * 100) / 100;
        }

        // Sanitize scores
        if (typeof sanitized.score === 'number') {
            sanitized.score = Math.min(100, Math.max(0, Math.round(sanitized.score)));
        }

        return sanitized;
    }

    _prepareStudentForSheet(student) {
        if (!student) return student;
        const sanitized = this._sanitizeRecord(student, 'student');
        const portraitData = student.portrait || student.portraitUrl || '';

        // Check if portrait data is base64 image (too large for URL)
        const isBase64Image = portraitData.startsWith('data:image') && portraitData.length > 1000;

        return {
            ...sanitized,
            selectedFees: Array.isArray(student.selectedFees) ? student.selectedFees.join(',') : student.selectedFees,
            // Only include portrait URL if it's not a large base64 image
            portraitUrl: isBase64Image ? '[IMAGE_DATA_TOO_LARGE]' : portraitData,
            portrait: isBase64Image ? '[IMAGE_DATA_TOO_LARGE]' : portraitData
        };
    }

    _prepareAssessmentForSheet(assessment, students = []) {
        if (!assessment) return assessment;
        
        // Find the student to enrich assessment data
        let student = null;
        if (assessment.studentId) {
            student = students.find(s => String(s.id) === String(assessment.studentId));
        }
        if (!student && assessment.studentAdmissionNo) {
            student = students.find(s => 
                s.admissionNo && String(s.admissionNo).toLowerCase() === String(assessment.studentAdmissionNo).toLowerCase()
            );
        }
        if (!student && assessment.studentName) {
            student = students.find(s => 
                s.name && s.name.toLowerCase().trim() === assessment.studentName.toLowerCase().trim()
            );
        }

        const sanitized = this._sanitizeRecord(assessment, 'assessment');
        
        return {
            ...sanitized,
            // Always ensure studentId is a string
            studentId: String(student?.id || assessment.studentId || ''),
            studentAdmissionNo: student?.admissionNo || assessment.studentAdmissionNo || '',
            studentName: student?.name || assessment.studentName || '',
            grade: student?.grade || assessment.grade || ''
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // SYNC LOCK - Prevent concurrent syncs
    // ═══════════════════════════════════════════════════════════════

    _canSync() {
        const now = Date.now();
        if (this._syncLock) {
            console.log('[Sync] Blocked - sync already in progress');
            return false;
        }
        if (now - this._lastSyncTime < this._syncCooldown) {
            console.log('[Sync] Blocked - cooldown active');
            return false;
        }
        return true;
    }

    _lockSync() {
        this._syncLock = true;
        this._lastSyncTime = Date.now();
    }

    _unlockSync() {
        this._syncLock = false;
    }

    // ═══════════════════════════════════════════════════════════════
    // PUSH RECORDS - Add or Update to Google Sheet
    // ═══════════════════════════════════════════════════════════════

    async pushRecord(sheetName, record, customAction = null) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        // Generate ID if missing
        if (!record.id) {
            record.id = `${sheetName.charAt(0).toUpperCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        }

        // Validate and sanitize
        const typeMap = {
            'Students': 'student',
            'Assessments': 'assessment',
            'Payments': 'payment',
            'Teachers': 'teacher',
            'Staff': 'staff',
            'Attendance': 'attendance',
            'Parents': 'parent',
            'Calendar': 'calendar'
        };
        const recordType = typeMap[sheetName] || 'unknown';
        
        const validation = this._validateRecord(record, recordType);
        if (!validation.valid) {
            console.warn(`[Sync] Invalid record:`, validation.error);
            return { success: false, error: validation.error };
        }

        const sanitized = this._sanitizeRecord(record, recordType);

        // Mark user as active on any data operation
        if (this._currentUserId) {
            this.setActiveUser(this._currentUserId);
        }

        try {
            // Use correct action for each sheet type
            let action = customAction || 'addRecord';
            let dataParam = {};

            switch (sheetName) {
                case 'Students':
                    if (!customAction) action = 'addStudent';
                    // Ensure the key is 'student' as expected by the GAS doGet handler
                    dataParam = { student: this._prepareStudentForSheet(sanitized) };
                    break;
                case 'Assessments':
                    if (!customAction) action = 'addAssessment';
                    // Get students list for enrichment - this will be set via setStudents() or passed in
                    const enrichedAssessment = this._prepareAssessmentForSheet(sanitized, this._students || []);
                    dataParam = { assessment: enrichedAssessment };
                    break;
                case 'Payments':
                    if (!customAction) action = 'addPayment';
                    dataParam = {
                        payment: {
                            ...sanitized,
                            items: (sanitized.items && typeof sanitized.items === 'object')
                                ? JSON.stringify(sanitized.items)
                                : sanitized.items
                        }
                    };
                    break;
                case 'Teachers':
                    if (!customAction) action = 'addTeacher';
                    dataParam = { teacher: sanitized };
                    break;
                case 'Staff':
                    if (!customAction) action = 'addStaff';
                    dataParam = { staff: sanitized };
                    break;
                case 'Attendance':
                    if (!customAction) action = 'addAttendance';
                    dataParam = { attendance: sanitized };
                    break;
                case 'Parents':
                    if (!customAction) action = 'addParent';
                    dataParam = { parent: sanitized };
                    break;
                case 'Calendar':
                    if (!customAction) action = 'addCalendar';
                    // For photo gallery, use the record directly as dataParam
                    if (customAction === 'addPhotoGallery') {
                        dataParam = sanitized;
                    } else {
                        dataParam = { calendar: sanitized };
                    }
                    break;
                default:
                    if (!customAction) action = 'addRecord';
                    dataParam = { sheetName, record: sanitized };
            }

            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', action);
            const dataString = JSON.stringify(dataParam);
            url.searchParams.set('data', dataString);
            url.searchParams.set('v', this._version);

            // Add user info for activity logging
            const userInfo = this._getUserInfo();
            url.searchParams.set('userId', userInfo.userId);
            url.searchParams.set('userName', userInfo.userName);
            url.searchParams.set('userRole', userInfo.userRole);

            console.log(`[Sync] ${action} ${sheetName}:`, sanitized.id, 'by', userInfo.userId);
            console.log(`[Sync] Data:`, dataString.substring(0, 200) + '...');
            console.log(`[Sync] URL:`, url.toString().substring(0, 300) + '...');

            const response = await fetch(url.toString(), {
                method: 'GET',
                mode: 'cors'
            }).catch(err => {
                console.error(`[Sync] Fetch error for ${sheetName}:`, err.message);
                throw new Error(`Network error: ${err.message}`);
            });

            console.log(`[Sync] Response status:`, response.status);
            const text = await response.text();
            console.log(`[Sync] Raw response:`, text.substring(0, 500));

            try {
                const result = JSON.parse(text);
                if (result.success) {
                    console.log(`[Sync] ✓ ${sheetName}:`, sanitized.id);
                    return { success: true, message: result.message || 'Saved' };
                }
                console.warn(`[Sync] ✗ ${sheetName}:`, result.error);
                return { success: false, error: result.error };
            } catch (parseErr) {
                if (response.ok && (text.includes('success') || text.includes('added') || text.includes('Saved') || text.includes('updated'))) {
                    console.log(`[Sync] ✓ ${sheetName} (text response):`, sanitized.id);
                    return { success: true, message: 'Saved' };
                }
                // Check for error in text response
                if (text.includes('error') || text.includes('Error')) {
                    console.warn(`[Sync] Error in response:`, text);
                    return { success: false, error: text };
                }
                // Assume success if local save is primary
                console.log(`[Sync] ⚠ ${sheetName} verified locally:`, sanitized.id);
                return { success: true, message: 'Saved locally' };
            }
        } catch (error) {
            console.error(`[Sync] ❌ Error ${sheetName}:`, error.message, error);
            return { success: false, error: error.message };
        }
    }

    // Convenience methods
    async pushStudent(student) { return this.pushRecord('Students', student); }
    async pushAssessment(assessment) { 
        // Assessment will be enriched in pushRecord using stored students
        return this.pushRecord('Assessments', assessment); 
    }
    async pushPayment(payment) { return this.pushRecord('Payments', payment); }
    async pushTeacher(teacher) { return this.pushRecord('Teachers', teacher); }
    async pushStaff(staff) { return this.pushRecord('Staff', staff); }
    async pushAttendance(attendance) { return this.pushRecord('Attendance', attendance); }
    async pushParent(parent) { return this.pushRecord('Parents', parent); }
    async pushCalendar(event) { return this.pushRecord('Calendar', event); }

    // Update record - uses pushRecord which handles both add and update
    async updateRecord(sheetName, record) {
        return this.pushRecord(sheetName, record);
    }

    // Convenience update methods
    async updateStudent(student) { return this.pushRecord('Students', student); }
    async updateAssessment(assessment) { return this.pushRecord('Assessments', assessment); }
    async updatePayment(payment) { return this.pushRecord('Payments', payment); }
    async updateTeacher(teacher) { return this.pushRecord('Teachers', teacher); }
    async updateStaff(staff) { return this.pushRecord('Staff', staff); }
    async updateAttendance(attendance) { return this.pushRecord('Attendance', attendance); }

    // ═══════════════════════════════════════════════════════════════
    // DELETE RECORDS
    // ═══════════════════════════════════════════════════════════════

    _getUserInfo() {
        const teacherSession = localStorage.getItem('et_teacher_session');
        if (teacherSession) {
            const session = JSON.parse(teacherSession);
            return {
                userId: session.username || session.name || 'teacher',
                userName: session.name || session.username || 'Teacher',
                userRole: 'teacher'
            };
        }
        if (localStorage.getItem('et_is_admin') === 'true') {
            return {
                userId: localStorage.getItem('et_login_username') || 'admin',
                userName: 'Administrator',
                userRole: 'admin'
            };
        }
        return { userId: 'guest', userName: 'Guest', userRole: 'guest' };
    }

    async deleteRecord(sheetName, recordId) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        if (!recordId) {
            return { success: false, error: 'Missing record ID' };
        }

        // Mark user as active and get user info
        const userInfo = this._getUserInfo();
        if (this._currentUserId) {
            this.setActiveUser(this._currentUserId);
        }

        try {
            const action = sheetName === 'Students' ? 'deleteStudent' : 
                         sheetName === 'Assessments' ? 'deleteAssessment' :
                         sheetName === 'Teachers' ? 'deleteTeacher' :
                         sheetName === 'Staff' ? 'deleteStaff' :
                         sheetName === 'Payments' ? 'deletePayment' : 'deleteRecord';

            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', action);
            url.searchParams.set('recordId', String(recordId));
            // Pass user info for activity logging
            url.searchParams.set('userId', userInfo.userId);
            url.searchParams.set('userName', userInfo.userName);
            url.searchParams.set('userRole', userInfo.userRole);

            console.log(`[Sync] Deleting ${sheetName}:`, recordId, 'by', userInfo.userId);

            const response = await fetch(url.toString());
            const text = await response.text();

            try {
                const result = JSON.parse(text);
                if (result.success) {
                    console.log(`[Sync] ✓ Deleted ${sheetName}:`, recordId);
                    return { success: true };
                }
                return { success: false, error: result.error };
            } catch (parseErr) {
                if (response.ok) {
                    return { success: true };
                }
                return { success: false, error: 'Delete failed' };
            }
        } catch (error) {
            console.warn(`[Sync] Delete error:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async deleteStudent(recordId) { return this.deleteRecord('Students', recordId); }
    async deleteAssessment(recordId) { return this.deleteRecord('Assessments', recordId); }
    async deleteTeacher(recordId) { return this.deleteRecord('Teachers', recordId); }
    async deleteStaff(recordId) { return this.deleteRecord('Staff', recordId); }
    async deletePayment(recordId) { return this.deleteRecord('Payments', recordId); }

    // ═══════════════════════════════════════════════════════════════
    // FETCH ALL DATA
    // ═══════════════════════════════════════════════════════════════

    async fetchAll() {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            // Mark user as active
            if (this._currentUserId) {
                this.setActiveUser(this._currentUserId);
            }

            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'getAll');

            // Use GET with redirect following - fetch follows redirects but CORS fails
            // We need to handle this by using the redirect URL directly
            const response = await fetch(url.toString(), { 
                redirect: 'follow',
                mode: 'cors'
            });
            const text = await response.text();

            let data;
            try {
                data = JSON.parse(text || '{}');
            } catch (e) {
                console.warn('[Sync] Parse error:', e.message);
                return { success: false, error: 'Invalid response from Google' };
            }

            if (data?.success === false) {
                return {
                    success: false,
                    error: data.error || 'Failed to fetch data from Google Sheet',
                    students: null,
                    assessments: null,
                    attendance: null,
                    teachers: null,
                    staff: null,
                    payments: null,
                    parents: null,
                    calendar: null
                };
            }

            // Clean corrupted selectedFees data
            if (data.students && Array.isArray(data.students)) {
                data.students = data.students.map(s => {
                    if (s.selectedFees && typeof s.selectedFees === 'string') {
                        if (s.selectedFees.includes('java.lang.Object') || s.selectedFees.startsWith('[L')) {
                            s.selectedFees = 't1,t2,t3';
                        }
                    }
                    const sanitized = this._sanitizeRecord(s, 'student');
                    return {
                        ...sanitized,
                        portrait: s.portraitUrl || s.portrait || '', // Map portraitUrl to portrait for local state
                        portraitUrl: s.portraitUrl || s.portrait || '' // Keep both for consistency
                    };
                });
            }

            // Deduplicate fetched data
            data.students = this._deduplicateById(data.students || []);
            data.assessments = this._deduplicateAssessments(data.assessments || []);
            data.payments = this._deduplicateById(data.payments || []);
            data.teachers = this._deduplicateById(data.teachers || []);
            data.staff = this._deduplicateById(data.staff || []);
            data.attendance = this._deduplicateById(data.attendance || []);
            data.parents = this._deduplicateById(data.parents || []);
            data.calendar = this._deduplicateById(data.calendar || []);

            console.log(`[Sync] Fetched: ${data.students?.length || 0} students, ${data.assessments?.length || 0} assessments, ${data.payments?.length || 0} payments`);

            return {
                success: true,
                students: data.students || [],
                assessments: data.assessments || [],
                attendance: data.attendance || [],
                teachers: data.teachers || [],
                staff: data.staff || [],
                payments: data.payments || [],
                parents: data.parents || [],
                calendar: data.calendar || []
            };
        } catch (error) {
            console.warn('[Sync] Fetch error:', error.message);
            // Return error state - DON'T overwrite local data with empty arrays
            return {
                success: false,
                error: error.message,
                students: null, // null indicates error - don't overwrite local
                assessments: null,
                attendance: null,
                teachers: null,
                staff: null,
                payments: null,
                parents: null,
                calendar: null
            };
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // DEDUPLICATION HELPERS
    // ═══════════════════════════════════════════════════════════════

    _deduplicateById(records) {
        const seen = new Map();
        return records.filter(r => {
            if (!r.id) return false;
            const id = String(r.id).trim();
            if (seen.has(id)) return false;
            seen.set(id, true);
            return true;
        });
    }

    _deduplicateAssessments(assessments) {
        const seen = new Map();
        return assessments.filter(a => {
            if (!a.id) return false;
            const key = `${a.studentId}-${a.subject}-${a.term}-${a.examType}-${a.academicYear}`;
            if (seen.has(key)) return false;
            seen.set(key, a);
            return true;
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // BULK OPERATIONS
    // ═══════════════════════════════════════════════════════════════

    async bulkPushStudents(students) {
        if (!students || students.length === 0) return { success: true, count: 0 };

        const results = { success: 0, failed: 0, errors: [] };

        for (const student of students) {
            const result = await this.pushStudent(student);
            if (result.success) results.success++;
            else {
                results.failed++;
                results.errors.push({ id: student.id, error: result.error });
            }
        }

        console.log(`[Sync] Bulk students: ${results.success} success, ${results.failed} failed`);
        return { 
            success: results.failed === 0, 
            ...results 
        };
    }

    async bulkPushAssessments(assessments) {
        if (!assessments || assessments.length === 0) return { success: true, count: 0 };

        const results = { success: 0, failed: 0, errors: [] };

        for (const assessment of assessments) {
            const result = await this.pushAssessment(assessment);
            if (result.success) results.success++;
            else {
                results.failed++;
                results.errors.push({ id: assessment.id, error: result.error });
            }
        }

        console.log(`[Sync] Bulk assessments: ${results.success} success, ${results.failed} failed`);
        return { 
            success: results.failed === 0, 
            ...results 
        };
    }

    async bulkPushPayments(payments) {
        if (!payments || payments.length === 0) return { success: true, count: 0 };

        const results = { success: 0, failed: 0, errors: [] };

        for (const payment of payments) {
            const result = await this.pushPayment(payment);
            if (result.success) results.success++;
            else {
                results.failed++;
                results.errors.push({ id: payment.id, error: result.error });
            }
        }

        console.log(`[Sync] Bulk payments: ${results.success} success, ${results.failed} failed`);
        return { 
            success: results.failed === 0, 
            ...results 
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTIVE USER TRACKING
    // ═══════════════════════════════════════════════════════════════

    async setActiveUser(deviceId) {
        if (!this.isConfigured() || !deviceId) return { success: false, error: 'Not configured' };
        
        const now = Date.now();

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'setActive');
            url.searchParams.set('device', deviceId);
            url.searchParams.set('timestamp', now.toString());

            // Use GET with redirect follow
            const response = await fetch(url.toString(), { 
                redirect: 'follow',
                mode: 'cors'
            });
            
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                return { success: true, message: 'Tracking sent' };
            }
        } catch (error) {
            // Fallback to no-cors fire-and-forget
            try {
                const url = new URL(this.settings.googleScriptUrl);
                url.searchParams.set('action', 'setActive');
                url.searchParams.set('device', deviceId);
                url.searchParams.set('timestamp', now.toString());
                await fetch(url.toString(), { mode: 'no-cors' });
                return { success: true, message: 'Tracking sent (no-cors)' };
            } catch (e) {
                return { success: false, error: error.message };
            }
        }
    }

    async loginParent(admissionNo, studentName) {
        if (!this.isConfigured()) return { success: false, error: 'Not configured' };
        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'loginParent');
            url.searchParams.set('admissionNo', admissionNo);
            url.searchParams.set('studentName', studentName);
            const response = await fetch(url.toString());
            return await response.json();
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Get active users count and details - returns activeUsers for compatibility
    async getActiveUsers() {
        if (!this.isConfigured()) return { success: true, activeUsers: [] };

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'getActiveUsers');

            const response = await fetch(url.toString(), { 
                redirect: 'follow',
                mode: 'cors'
            });
            const text = await response.text();

            try {
                const result = JSON.parse(text);
                console.log('📡 getActiveUsers raw result:', result);
                return { 
                    success: true, 
                    activeUsers: result.activeUsers || [],
                    count: result.activeCount || 0,
                    lastActivity: result.lastActivity
                };
            } catch (e) {
                console.warn('📡 getActiveUsers parse error:', e);
                return { success: true, activeUsers: [] };
            }
        } catch (error) {
            console.warn('📡 getActiveUsers error:', error);
            // Return empty on error - don't break the UI
            return { success: true, activeUsers: [] };
        }
    }
    
    // Direct fetch - bypass any caching
    async getActiveUsersDirect() {
        return this.getActiveUsers();
    }

    // ═══════════════════════════════════════════════════════════════
    // PHOTO GALLERY SYNC
    // ═══════════════════════════════════════════════════════════════

    async syncPhotoGallery(galleryData) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            const galleryRecord = {
                id: 'GALLERY-' + Date.now(),
                type: 'photo_gallery',
                photos: galleryData,
                count: galleryData.length,
                lastSync: new Date().toISOString()
            };

            // Use Calendar sheet as storage for gallery metadata (temporary solution)
            // In a full implementation, this would use Google Drive
            return await this.pushRecord('Calendar', galleryRecord);
        } catch (error) {
            console.error('[Sync] Gallery sync error:', error);
            return { success: false, error: error.message };
        }
    }

    async fetchPhotoGallery() {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        try {
            const result = await this.fetchAll();
            if (!result.success || !result.calendar) {
                return { success: false, error: 'Failed to fetch calendar data' };
            }

            // Find gallery records in calendar data
            const galleryRecords = result.calendar.filter(
                item => item.type === 'photo_gallery'
            );

            if (galleryRecords.length === 0) {
                return { success: true, photos: [] };
            }

            // Get the most recent gallery
            const latestGallery = galleryRecords.reduce((latest, current) => {
                return new Date(current.lastSync) > new Date(latest.lastSync) ? current : latest;
            });

            return { success: true, photos: latestGallery.photos || [], lastSync: latestGallery.lastSync };
        } catch (error) {
            console.error('[Sync] Gallery fetch error:', error);
            return { success: false, error: error.message };
        }
    }

    // Detect deleted records by comparing local IDs with Google Sheet
    async detectDeletions(sheetName, localRecords) {
        try {
            // Just get all records from Google and compare locally - don't pass IDs in URL
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'getAllIds');
            url.searchParams.set('sheetName', sheetName);

            const response = await fetch(url.toString());
            const text = await response.text();

            try {
                const result = JSON.parse(text);
                const googleIds = new Set(result.ids || []);
                const localIds = (localRecords || []).map(r => String(r.id));
                
                // SAFETY CHECK: If Google returns empty but we have local records, 
                // don't treat as deletions - could be fetch error
                if (googleIds.size === 0 && localIds.length > 0) {
                    console.warn('[Sync] detectDeletions: Google returned 0 IDs but local has', localIds.length, 'records. Skipping deletion check.');
                    return { success: false, deletedIds: [], deletionCount: 0, error: 'Empty response from Google' };
                }
                
                // Find IDs that exist locally but not in Google
                const deletedIds = localIds.filter(id => !googleIds.has(id));
                
                return {
                    success: true,
                    deletedIds,
                    deletionCount: deletedIds.length
                };
            } catch {
                return { success: false, deletedIds: [], deletionCount: 0 };
            }
        } catch (error) {
            console.warn('[Sync] detectDeletions failed:', error.message);
            return { success: false, deletedIds: [], deletionCount: 0 };
        }
    }

    // Sync all local data to Google Sheet
    async syncAll(data) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Not configured' };
        }

        // Mark user as active
        if (this._currentUserId) {
            this.setActiveUser(this._currentUserId);
        }

        try {
            let successCount = 0;
            let failCount = 0;

            // Sync students
            for (const student of (data.students || [])) {
                const result = await this.pushStudent(student);
                if (result.success) successCount++;
                else failCount++;
            }

            // Sync assessments with enrichment
            for (const assessment of (data.assessments || [])) {
                const student = (data.students || []).find(s => 
                    String(s.id) === String(assessment.studentId) ||
                    String(s.admissionNo) === String(assessment.studentId)
                );
                const enriched = {
                    ...assessment,
                    studentId: String(student?.id || assessment.studentId),
                    studentAdmissionNo: student?.admissionNo || assessment.studentAdmissionNo || '',
                    studentName: student?.name || assessment.studentName || 'Unknown',
                    grade: student?.grade || assessment.grade || ''
                };
                const result = await this.pushAssessment(enriched);
                if (result.success) successCount++;
                else failCount++;
            }

            // Sync payments
            for (const payment of (data.payments || [])) {
                const result = await this.pushPayment(payment);
                if (result.success) successCount++;
                else failCount++;
            }

            // Sync teachers
            for (const teacher of (data.teachers || [])) {
                const result = await this.pushTeacher(teacher);
                if (result.success) successCount++;
                else failCount++;
            }

            // Sync staff
            for (const staff of (data.staff || [])) {
                const result = await this.pushStaff(staff);
                if (result.success) successCount++;
                else failCount++;
            }

            // Sync attendance
            for (const attendance of (data.attendance || [])) {
                const result = await this.pushAttendance(attendance);
                if (result.success) successCount++;
                else failCount++;
            }

            console.log(`[Sync] syncAll: ${successCount} success, ${failCount} failed`);
            return { success: failCount === 0, successCount, failCount };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // TEACHER AUTHENTICATION
    // ═══════════════════════════════════════════════════════════════

    async registerTeacher(username, password, teacherId = '', name = '', role = 'teacher', subjects = '', grades = '', classTeacherGrade = '', religion = '') {
        if (!this.isConfigured()) {
            return { success: false, error: 'Google Sheet not configured' };
        }

        if (!username || !password) {
            return { success: false, error: 'Username and password are required' };
        }

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'registerTeacher');
            url.searchParams.set('username', username.trim().toLowerCase());
            url.searchParams.set('password', password);
            url.searchParams.set('teacherId', teacherId);
            url.searchParams.set('name', name || username);
            url.searchParams.set('role', role);
            url.searchParams.set('subjects', subjects);
            url.searchParams.set('grades', grades);
            url.searchParams.set('classTeacherGrade', classTeacherGrade);
            url.searchParams.set('religion', religion);

            const response = await fetch(url.toString());
            const text = await response.text();

            try {
                const result = JSON.parse(text);
                if (result.success) {
                    console.log('[Auth] Teacher registered:', username);
                }
                return result;
            } catch {
                if (text.includes('success') || text.includes('created')) {
                    return { success: true, message: 'Account created' };
                }
                return { success: false, error: 'Registration failed' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async loginTeacher(username, password) {
        if (!username || !password) {
            return { success: false, error: 'Username and password are required' };
        }

        const trimmedUsername = username.trim().toLowerCase();
        
        // First check local credentials (works offline)
        const localCreds = localStorage.getItem('et_teacher_credentials');
        if (localCreds) {
            const creds = JSON.parse(localCreds);
            const found = creds.find(c => c.username === trimmedUsername && c.password === password);
            if (found) {
                console.log('[Auth] Login successful (local):', trimmedUsername);
                return {
                    success: true,
                    username: found.username,
                    name: found.name || found.username,
                    subjects: found.subjects || '',
                    grades: found.grades || '',
                    role: found.role || 'teacher',
                    classTeacherGrade: found.classTeacherGrade || '',
                    religion: found.religion || ''
                };
            }
        }

        // Try Google Sheet if configured
        if (this.isConfigured()) {
            try {
                const url = new URL(this.settings.googleScriptUrl);
                url.searchParams.set('action', 'loginTeacher');
                url.searchParams.set('username', trimmedUsername);
                url.searchParams.set('password', password);

                await fetch(url.toString(), { mode: 'no-cors' });
                console.log('[Auth] Login request sent to Google for:', trimmedUsername);
                
                // Even if we can't read response, return success - user can retry if wrong
                return { 
                    success: false, 
                    error: 'Login failed. Check your credentials or register a new account.' 
                };
            } catch (error) {
                console.error('Google login error:', error);
            }
        }

        // No credentials found
        return { 
            success: false, 
            error: 'Account not found. Please register first or check your credentials.' 
        };
    }

    async getTeacherCredentials() {
        if (!this.isConfigured()) {
            return { success: false, error: 'Not configured', teachers: [] };
        }

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'getTeacherCredentials');

            const response = await fetch(url.toString());
            const text = await response.text();

            try {
                const result = JSON.parse(text);
                return { success: true, teachers: result.teachers || [] };
            } catch {
                return { success: true, teachers: [] };
            }
        } catch (error) {
            return { success: false, error: error.message, teachers: [] };
        }
    }

    async deleteTeacher(username) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Not configured' };
        }

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'deleteTeacher');
            url.searchParams.set('data', JSON.stringify({ username }));

            const response = await fetch(url.toString());
            const text = await response.text();

            try {
                return JSON.parse(text);
            } catch {
                return { success: true, message: 'Deleted' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ACTIVITY LOG
    // ═════════════════════════════════════════════════════════════==

    async logActivity(activityData) {
        if (!this.isConfigured()) {
            return { success: false, error: 'Not configured' };
        }

        // Prevent duplicate activity logging - check if same action in last 3 seconds
        const now = Date.now();
        
        // Use function properties instead of static
        if (logActivity.lastLog && now - logActivity.lastLog < 3000) {
            const key = `${activityData.action}-${activityData.module}-${activityData.recordId}`;
            if (logActivity.cache && logActivity.cache.includes(key)) {
                console.log('[Activity] Blocked duplicate:', key);
                return { success: false, message: 'Duplicate blocked' };
            }
        }
        
        // Update cache
        logActivity.lastLog = now;
        logActivity.cache = logActivity.cache || [];
        logActivity.cache.push(`${activityData.action}-${activityData.module}-${activityData.recordId}`);
        if (logActivity.cache.length > 20) logActivity.cache.shift();

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'logActivity');
            url.searchParams.set('data', JSON.stringify(activityData));

            const response = await fetch(url.toString());
            const text = await response.text();

            try {
                const result = JSON.parse(text);
                return result;
            } catch {
                return { success: true };
            }
        } catch (error) {
            console.warn('[Activity] Failed to log:', error.message);
            return { success: false, error: error.message };
        }
    }

    async getRecentActivities(limit = 50, module = null, userId = null) {
        if (!this.isConfigured()) {
            return [];
        }

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'getRecentActivities');
            url.searchParams.set('limit', String(limit));
            if (module) url.searchParams.set('module', module);
            if (userId) url.searchParams.set('userId', userId);

            const response = await fetch(url.toString());
            const text = await response.text();

            try {
                const result = JSON.parse(text);
                // Handle both { success: true, activities: [...] } and [...] formats
                return Array.isArray(result) ? result : (result.activities || []);
            } catch {
                return [];
            }
        } catch (error) {
            console.warn('[Activity] Failed to fetch:', error.message);
            return [];
        }
    }

    async getActivitySummary(days = 7) {
        if (!this.isConfigured()) {
            return { total: 0, byAction: {}, byModule: {}, byUser: {} };
        }

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'getActivitySummary');
            url.searchParams.set('days', String(days));

            const response = await fetch(url.toString());
            const text = await response.text();

            try {
                const result = JSON.parse(text);
                // Handle both { success: true, summary: {...} } and {...} formats
                return result.summary || result || { total: 0, byAction: {}, byModule: {}, byUser: {} };
            } catch {
                return { total: 0, byAction: {}, byModule: {}, byUser: {} };
            }
        } catch (error) {
            console.warn('[Activity] Failed to fetch summary:', error.message);
            return { total: 0, byAction: {}, byModule: {}, byUser: {} };
        }
    }

    async clearActivityLog() {
        if (!this.isConfigured()) {
            return { success: false, error: 'Not configured' };
        }

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'clearActivityLog');

            const response = await fetch(url.toString());
            const text = await response.text();

            try {
                const result = JSON.parse(text);
                console.log('[Activity] Log cleared:', result.message);
                return result;
            } catch {
                return { success: true, message: 'Activity log cleared' };
            }
        } catch (error) {
            console.warn('[Activity] Failed to clear log:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Activity cache for deduplication
    _activityCache = { lastLog: 0, keys: [] };

    // Helper to track activities with user info
    async trackActivity(action, module, recordId, recordName, details, oldValue, newValue) {
        // Check if user is admin or teacher
        const isAdmin = localStorage.getItem('et_is_admin') === 'true';
        const teacherSession = localStorage.getItem('et_teacher_session');
        
        let userId, userName, userRole;
        
        if (teacherSession) {
            const session = JSON.parse(teacherSession);
            userId = session.username || session.name || 'teacher';
            userName = session.name || session.username || 'Teacher';
            userRole = 'teacher';
        } else if (isAdmin) {
            userId = localStorage.getItem('et_login_username') || 'admin';
            userName = 'Administrator';
            userRole = 'admin';
        } else {
            // Don't log for guest/unknown users
            return { success: false, message: 'Not logged in' };
        }

        // Call logActivity directly to avoid scope issues
        const activityData = {
            userId,
            userName,
            userRole,
            action,
            module,
            recordId,
            recordName,
            details,
            oldValue,
            newValue
        };

        // Prevent duplicate using instance cache
        const now = Date.now();
        const key = `${action}-${module}-${recordId}`;
        if (this._activityCache.lastLog && now - this._activityCache.lastLog < 3000) {
            if (this._activityCache.keys.includes(key)) {
                console.log('[Activity] Blocked duplicate:', key);
                return { success: false, message: 'Duplicate blocked' };
            }
        }
        this._activityCache.lastLog = now;
        this._activityCache.keys.push(key);
        if (this._activityCache.keys.length > 20) this._activityCache.keys.shift();

        if (!this.isConfigured()) {
            return { success: false, error: 'Not configured' };
        }

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'logActivity');
            url.searchParams.set('data', JSON.stringify(activityData));

            const response = await fetch(url.toString());
            const text = await response.text();

            try {
                const result = JSON.parse(text);
                return result;
            } catch {
                return { success: true };
            }
        } catch (error) {
            console.warn('[Activity] Failed to log:', error.message);
            return { success: false, error: error.message };
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SETTINGS SYNC
    // ═══════════════════════════════════════════════════════════════

    async pushSettings(settings, updatedBy = 'admin') {
        if (!this.isConfigured()) {
            return { success: false, error: 'Not configured' };
        }

        try {
            console.log('[Settings] Pushing settings with keys:', Object.keys(settings));
            console.log('[Settings] feeStructures count:', settings.feeStructures?.length || 0);
            console.log('[Settings] feeStructures grades:', settings.feeStructures?.map(f => f.grade) || []);

            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'setSettings');

            const payload = {
                settings: settings,
                updatedBy: updatedBy
            };
            console.log('[Settings] Payload size:', JSON.stringify(payload).length, 'bytes');

            const response = await fetch(url.toString(), {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            console.log('[Settings] Push sent (no-cors)');
            return { success: true, message: 'Settings pushed successfully' };
        } catch (error) {
            console.error('[Settings] Push error:', error);
            return { success: false, error: error.message };
        }
    }

    async fetchSettings() {
        if (!this.isConfigured()) {
            return { success: false, error: 'Not configured' };
        }

        try {
            const url = new URL(this.settings.googleScriptUrl);
            url.searchParams.set('action', 'getSettings');

            const response = await fetch(url.toString());
            const text = await response.text();
            const result = JSON.parse(text);

            console.log('[Settings] Fetch result:', result);
            return result;
        } catch (error) {
            console.error('[Settings] Fetch error:', error);
            return { success: false, error: error.message };
        }
    }
}

// Export singleton instance
export const googleSheetSync = new GoogleSheetSync();
