export const Storage = {
    key: 'edutrack_cbc_data',
    _version: '3.0-protected',

    // Helper to get storage (localStorage or sessionStorage as fallback)
    getStorage() {
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            return localStorage;
        } catch (e) {
            console.warn('localStorage not available, using sessionStorage');
            return sessionStorage;
        }
    },

    defaultData: {
        archives: [],
        students: [
            { id: '1', name: 'John Doe', grade: 'GRADE 1', admissionNo: '2024/001', admissionDate: '2024-01-10', assessmentNo: 'ASN-001', upiNo: 'UPI-789X', stream: 'North', parentContact: '0711222333', selectedFees: ['t1', 't2', 't3', 'bookFund', 'caution', 'studentCard'], status: 'active' },
            { id: '2', name: 'Jane Smith', grade: 'GRADE 2', admissionNo: '2024/002', admissionDate: '2024-02-15', assessmentNo: 'ASN-002', upiNo: 'UPI-456Y', stream: 'South', parentContact: '0722333444', selectedFees: ['t1', 't2', 't3', 'breakfast', 'lunch'], status: 'active' }
        ],
        assessments: [
            { id: 'a1', studentId: '1', subject: 'Mathematics', level: 'EE', score: 85, date: '2024-03-20' },
            { id: 'a2', studentId: '1', subject: 'English Language', level: 'ME', score: 72, date: '2024-03-20' }
        ],
        payments: [
            { id: 'p1', studentId: '1', studentName: 'John Doe', amount: 20000, date: '2024-03-01', receiptNo: 'RCP-001' }
        ],
        paymentPrompts: [],
        teachers: [
            { id: 't1', name: 'Peter Mwangi', contact: '0712345678', subjects: 'Mathematics, Science', grades: 'GRADE 1, GRADE 2', employeeNo: 'T-001', nssfNo: 'NSSF-123', shifNo: 'SHIF-456', taxNo: 'A001234567X' }
        ],
        staff: [
            { id: 's1', name: 'Alice Wambui', role: 'Bursar', contact: '0722000111', employeeNo: 'S-001', nssfNo: 'NSSF-789', shifNo: 'SHIF-012', taxNo: 'A009876543Z' },
            { id: 's2', name: 'John Kamau', role: 'Driver', contact: '0733000222', employeeNo: 'S-002', nssfNo: 'NSSF-345', shifNo: 'SHIF-678', taxNo: 'A005556667Y' }
        ],
        remarks: [],
        attendance: [],
        transport: {
            routes: [
                { id: 'r1', name: 'Route A - City Center', fee: 5000 },
                { id: 'r2', name: 'Route B - Westlands', fee: 6500 }
            ],
            assignments: []
        },
        library: {
            books: [
                { id: 'b1', title: 'The River and the Source', author: 'Margaret Ogola', isbn: '978-9966-882-05-9', status: 'Available', quantity: 10 },
                { id: 'b2', title: 'Kidagaa Kimemwozea', author: 'Ken Walibora', isbn: '978-9966-10-142-2', status: 'Available', quantity: 5 }
            ],
            transactions: []
        },
        payroll: [],
        settings: {
            schoolName: 'Evergreen Academy',
            schoolAddress: '123 Academic Drive, Nairobi, Kenya',
            schoolLogo: 'school_logo.png',
            principalSignature: '',
            clerkSignature: '',
            academicYear: '2025/2026',
            currency: 'KES.',
            theme: 'light',
            primaryColor: '#2563eb',
            secondaryColor: '#64748b',
            weeksPerTerm: 12,
            googleScriptUrl: 'https://script.google.com/macros/s/AKfycbyo4kKo9PrSVC4V7PMyqrKmEzZGzjxvjL76DSm9mczlTuXmmz8lThPK0_SYJPh-0zElEg/exec',
            termDates: {
                T1: { start: '2025-01-06', end: '2025-04-04' },
                T2: { start: '2025-04-22', end: '2025-08-08' },
                T3: { start: '2025-08-25', end: '2025-11-21' }
            },
            grades: ['BABY CLASS', 'PP1', 'PP2', 'GRADE 1', 'GRADE 2', 'GRADE 3', 'GRADE 4', 'GRADE 5', 'GRADE 6', 'GRADE 7', 'GRADE 8', 'GRADE 9', 'GRADE 10', 'GRADE 11', 'GRADE 12'],
            streams: ['A', 'B', 'C'],
            feeStructures: [
                { grade: 'BABY CLASS', t1: 15000, t2: 12000, t3: 12000, admission: 2000, diary: 500, development: 5000, boarding: 0, breakfast: 3000, lunch: 5000, trip: 2000, bookFund: 1000, caution: 2000, uniform: 4500, studentCard: 500, remedial: 0, assessmentFee: 1000, projectFee: 500, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'PP1', t1: 15000, t2: 12000, t3: 12000, admission: 2000, diary: 500, development: 5000, boarding: 0, breakfast: 3000, lunch: 5000, trip: 2000, bookFund: 1000, caution: 2000, uniform: 4500, studentCard: 500, remedial: 0, assessmentFee: 1000, projectFee: 500, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'PP2', t1: 15000, t2: 12000, t3: 12000, admission: 2000, diary: 500, development: 5000, boarding: 0, breakfast: 3000, lunch: 5000, trip: 2000, bookFund: 1000, caution: 2000, uniform: 4500, studentCard: 500, remedial: 0, assessmentFee: 1000, projectFee: 500, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 1', t1: 25000, t2: 20000, t3: 20000, admission: 3000, diary: 500, development: 5000, boarding: 15000, breakfast: 3500, lunch: 6000, trip: 2500, bookFund: 1500, caution: 2000, uniform: 5000, studentCard: 500, remedial: 2000, assessmentFee: 1500, projectFee: 1000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 2', t1: 25000, t2: 20000, t3: 20000, admission: 3000, diary: 500, development: 5000, boarding: 15000, breakfast: 3500, lunch: 6000, trip: 2500, bookFund: 1500, caution: 2000, uniform: 5000, studentCard: 500, remedial: 2000, assessmentFee: 1500, projectFee: 1000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 3', t1: 25000, t2: 20000, t3: 20000, admission: 3000, diary: 500, development: 5000, boarding: 15000, breakfast: 3500, lunch: 6000, trip: 2500, bookFund: 1500, caution: 2000, uniform: 5000, studentCard: 500, remedial: 2000, assessmentFee: 1500, projectFee: 1000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 4', t1: 30000, t2: 25000, t3: 25000, admission: 3000, diary: 500, development: 5000, boarding: 20000, breakfast: 4000, lunch: 7000, trip: 3000, bookFund: 2000, caution: 2000, uniform: 5500, studentCard: 500, remedial: 2500, assessmentFee: 2000, projectFee: 1500, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 5', t1: 30000, t2: 25000, t3: 25000, admission: 3000, diary: 500, development: 5000, boarding: 20000, breakfast: 4000, lunch: 7000, trip: 3000, bookFund: 2000, caution: 2000, uniform: 5500, studentCard: 500, remedial: 2500, assessmentFee: 2000, projectFee: 1500, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 6', t1: 30000, t2: 25000, t3: 25000, admission: 3000, diary: 500, development: 5000, boarding: 20000, breakfast: 4000, lunch: 7000, trip: 3000, bookFund: 2000, caution: 2000, uniform: 5500, studentCard: 500, remedial: 2500, assessmentFee: 2000, projectFee: 1500, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 7', t1: 35000, t2: 30000, t3: 30000, admission: 5000, diary: 500, development: 7500, boarding: 25000, breakfast: 4500, lunch: 8000, trip: 4000, bookFund: 2500, caution: 3000, uniform: 6000, studentCard: 1000, remedial: 3000, assessmentFee: 3000, projectFee: 2000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 8', t1: 35000, t2: 30000, t3: 30000, admission: 5000, diary: 500, development: 7500, boarding: 25000, breakfast: 4500, lunch: 8000, trip: 4000, bookFund: 2500, caution: 3000, uniform: 6000, studentCard: 1000, remedial: 3000, assessmentFee: 3000, projectFee: 2000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 9', t1: 35000, t2: 30000, t3: 30000, admission: 5000, diary: 500, development: 7500, boarding: 25000, breakfast: 4500, lunch: 8000, trip: 4000, bookFund: 2500, caution: 3000, uniform: 6000, studentCard: 1000, remedial: 3000, assessmentFee: 3000, projectFee: 2000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 10', t1: 45000, t2: 40000, t3: 40000, admission: 10000, diary: 1000, development: 10000, boarding: 30000, breakfast: 5000, lunch: 10000, trip: 5000, bookFund: 5000, caution: 5000, uniform: 8000, studentCard: 1000, remedial: 5000, assessmentFee: 5000, projectFee: 3000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 11', t1: 45000, t2: 40000, t3: 40000, admission: 10000, diary: 1000, development: 10000, boarding: 30000, breakfast: 5000, lunch: 10000, trip: 5000, bookFund: 5000, caution: 5000, uniform: 8000, studentCard: 1000, remedial: 5000, assessmentFee: 5000, projectFee: 3000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 12', t1: 45000, t2: 40000, t3: 40000, admission: 10000, diary: 1000, development: 10000, boarding: 30000, breakfast: 5000, lunch: 10000, trip: 5000, bookFund: 5000, caution: 5000, uniform: 8000, studentCard: 1000, remedial: 5000, assessmentFee: 5000, projectFee: 3000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 }
            ]
        }
    },

    load() {
        try {
            const storage = this.getStorage();
            const stored = storage.getItem(this.key);
            if (!stored) {
                console.log('[Storage] No stored data, using defaults');
                return this.getDefaultData();
            }
            
            let parsed;
            try {
                parsed = JSON.parse(stored);
            } catch (parseErr) {
                console.warn('[Storage] Corrupted data, clearing and using defaults');
                storage.removeItem(this.key);
                return this.getDefaultData();
            }
            
            if (!parsed || typeof parsed !== 'object') {
                console.log('[Storage] Invalid stored data, using defaults');
                return this.getDefaultData();
            }

            // Check for data corruption (arrays that are too large = likely corruption)
            if (parsed.students?.length > 50000 || parsed.assessments?.length > 100000) {
                console.warn('[Storage] Suspiciously large data detected, may be corrupted. Backing up and resetting.');
                try {
                    const backupKey = this.key + '_backup_' + Date.now();
                    storage.setItem(backupKey, stored);
                } catch (e) {}
                return this.getDefaultData();
            }

            console.log(`[Storage] Loaded: ${parsed.students?.length || 0} students, ${parsed.payments?.length || 0} payments, ${parsed.assessments?.length || 0} assessments`);
            
            // Apply deduplication during load to prevent multiplication
            const deduplicated = this.deduplicateData(parsed);
            
            // Use ensureDataIntegrity to validate and fill defaults
            return this.ensureDataIntegrity(deduplicated);
        } catch (e) {
            console.error('[Storage] Load error:', e.message);
            return this.getDefaultData();
        }
    },

    getDefaultData() {
        // Return a deep copy of defaultData
        return JSON.parse(JSON.stringify(this.defaultData));
    },

    /**
     * SECURE DATA DEDUPLICATION
     * Prevents data from multiplying or corrupting during sync
     */
    deduplicateData(data) {
        if (!data) return data;

        console.log('[Storage] Deduplicating data...');

        // Deduplicate assessments by unique composite key
        const assessments = data.assessments || [];
        const assessSeen = new Map();
        const uniqueAssessments = assessments.filter(a => {
            if (!a.id) return false;
            const key = `${a.studentId}-${a.subject}-${a.term}-${a.examType}-${a.academicYear}`;
            if (assessSeen.has(key)) return false;
            assessSeen.set(key, true);
            return true;
        });
        
        // Deduplicate students by admissionNo or id (case-insensitive)
        // Keep students even without admissionNo - use id as fallback
        const students = data.students || [];
        const studentSeen = new Map();
        const uniqueStudents = [];
        
        for (const s of students) {
            // Try admissionNo first, then id, then generate a key from name
            const key = String(s.admissionNo || s.id || '').toLowerCase().trim();
            if (!key) {
                // Keep students without admissionNo/id - they might be new entries
                uniqueStudents.push(s);
                continue;
            }
            if (studentSeen.has(key)) continue;
            studentSeen.set(key, true);
            uniqueStudents.push(s);
        }
        
        // Deduplicate attendance by studentId + date
        const attendance = data.attendance || [];
        const attSeen = new Map();
        const uniqueAttendance = attendance.filter(a => {
            if (!a.id && !a.studentId) return false;
            const key = `${a.studentId}-${a.date}`;
            if (attSeen.has(key)) return false;
            attSeen.set(key, true);
            return true;
        });

        // Deduplicate payments by ID only (receipts can be unique)
        const payments = data.payments || [];
        const paySeen = new Map();
        const uniquePayments = payments.filter(p => {
            const key = String(p.id || '').trim();
            if (!key) return false;
            if (paySeen.has(key)) return false;
            paySeen.set(key, true);
            return true;
        });

        // Deduplicate teachers and staff by ID
        const teachers = (data.teachers || []).filter(t => {
            const key = String(t.id || '').trim();
            return key && !data._teacherKeys?.has(key);
        });
        const staff = (data.staff || []).filter(s => {
            const key = String(s.id || '').trim();
            return key && !data._staffKeys?.has(key);
        });

        console.log(`[Storage] Dedup: ${students.length}→${uniqueStudents.length} students, ${assessments.length}→${uniqueAssessments.length} assessments, ${payments.length}→${uniquePayments.length} payments`);

        return {
            ...data,
            students: uniqueStudents,
            assessments: uniqueAssessments,
            attendance: uniqueAttendance,
            payments: uniquePayments,
            teachers,
            staff
        };
    },

    /**
     * SECURE DATA MERGE
     * Merges remote data with local data without duplication
     */
    mergeData(existingData, incomingData, type) {
        if (!incomingData) return existingData;
        if (!existingData) return incomingData;

        console.log(`[Storage] Merging data (type: ${type})...`);

        switch (type) {
            case 'students': {
                const existing = [...(existingData.students || [])];
                const existingIds = new Set(existing.map(s => String(s.admissionNo || s.id || '').toLowerCase().trim()).filter(Boolean));
                
                const incoming = this.normalizeStudents(incomingData.students || []);
                incoming.forEach(newS => {
                    const key = String(newS.admissionNo || newS.id || '').toLowerCase().trim();
                    // If student has no key (no admissionNo or id), just add them
                    if (!key) {
                        existing.push(newS);
                        return;
                    }
                    const idx = existing.findIndex(s => 
                        String(s.admissionNo || '').toLowerCase().trim() === key || 
                        String(s.id || '').toLowerCase().trim() === key
                    );
                    if (idx > -1) existing[idx] = { ...existing[idx], ...newS };
                    else existing.push(newS);
                });
                
                const merged = [...existing];
                console.log(`[Storage] Students merged: ${existing.length} local + ${incoming.length} incoming = ${merged.length}`);
                return { ...existingData, students: merged };
            }
            
            case 'assessments': {
                const existing = [...(existingData.assessments || [])];
                const existingKeys = new Set(existing.map(a => 
                    `${a.studentId}-${a.subject}-${a.term}-${a.examType}-${a.academicYear}`
                ));
                
                const incoming = (incomingData.assessments || []).filter(a => {
                    const key = `${a.studentId}-${a.subject}-${a.term}-${a.examType}-${a.academicYear}`;
                    return !existingKeys.has(key);
                });
                
                const merged = [...existing, ...incoming];
                console.log(`[Storage] Assessments merged: ${existing.length} local + ${incoming.length} new = ${merged.length}`);
                return { ...existingData, assessments: merged };
            }
            
            case 'payments': {
                const existing = [...(existingData.payments || [])];
                const existingIds = new Set(existing.map(p => String(p.id)));
                
                const incoming = (incomingData.payments || []).filter(p => {
                    const key = String(p.id || '').trim();
                    return key && !existingIds.has(key);
                });
                
                const merged = [...existing, ...incoming];
                console.log(`[Storage] Payments merged: ${existing.length} local + ${incoming.length} new = ${merged.length}`);
                return { ...existingData, payments: merged };
            }
            
            case 'all': {
                return this._mergeAllData(existingData, incomingData);
            }
            
            default:
                return { ...existingData, ...incomingData };
        }
    },

    _mergeAllData(existingData, incomingData) {
        // Students
        const existingStudents = existingData.students || [];
        const incomingStudents = (incomingData.students || []).filter(s => s.admissionNo || s.id);
        const studentMap = new Map(existingStudents.map(s => [String(s.admissionNo || s.id).toLowerCase().trim(), s]));
        incomingStudents.forEach(s => {
            const key = String(s.admissionNo || s.id || '').toLowerCase().trim();
            if (key) studentMap.set(key, { ...s, ...(studentMap.get(key) || {}) }); // Prefer newer data
        });
        const mergedStudents = Array.from(studentMap.values());

        // Assessments
        const existingAssess = existingData.assessments || [];
        const incomingAssess = incomingData.assessments || [];
        const assessMap = new Map(existingAssess.map(a => [
            `${a.studentId}-${a.subject}-${a.term}-${a.examType}-${a.academicYear}`, a
        ]));
        incomingAssess.forEach(a => {
            const key = `${a.studentId}-${a.subject}-${a.term}-${a.examType}-${a.academicYear}`;
            assessMap.set(key, { ...a, ...(assessMap.get(key) || {}) });
        });
        const mergedAssess = Array.from(assessMap.values());

        // Payments
        const existingPays = existingData.payments || [];
        const incomingPays = incomingData.payments || [];
        const payMap = new Map(existingPays.map(p => [String(p.id), p]));
        incomingPays.forEach(p => {
            const key = String(p.id || '');
            if (key) payMap.set(key, { ...p, ...(payMap.get(key) || {}) });
        });
        const mergedPays = Array.from(payMap.values());

        // Teachers
        const teachMap = new Map((existingData.teachers || []).map(t => [String(t.id), t]));
        (incomingData.teachers || []).forEach(t => {
            if (t.id) teachMap.set(String(t.id), { ...t, ...(teachMap.get(t.id) || {}) });
        });

        // Staff
        const staffMap = new Map((existingData.staff || []).map(s => [String(s.id), s]));
        (incomingData.staff || []).forEach(s => {
            if (s.id) staffMap.set(String(s.id), { ...s, ...(staffMap.get(s.id) || {}) });
        });

        console.log(`[Storage] Full merge: ${mergedStudents.length} students, ${mergedAssess.length} assessments, ${mergedPays.length} payments`);

        return {
            ...existingData,
            ...incomingData,
            students: mergedStudents,
            assessments: mergedAssess,
            payments: mergedPays,
            teachers: Array.from(teachMap.values()),
            staff: Array.from(staffMap.values()),
            settings: { ...(existingData.settings || {}), ...(incomingData.settings || {}) }
        };
    },


    ensureDataIntegrity(rawData) {
        const defaults = this.getDefaultData();
        
        // DON'T deduplicate here - it might strip data
        // Only deduplicate during merge operations
        
        // Ensure settings exist
        const settings = rawData.settings || {};
        
        // Ensure fee structures exist - this is critical for fees to work
        let feeStructures = settings.feeStructures;
        if (!feeStructures || !Array.isArray(feeStructures) || feeStructures.length === 0) {
            console.log('[Storage] No fee structures found, using defaults');
            feeStructures = defaults.settings.feeStructures;
        }

        // Preserve ALL existing data
        const students = rawData.students || [];
        const payments = rawData.payments || [];
        const assessments = this.normalizeAssessments(
            rawData.assessments || [],
            settings.academicYear || defaults.settings.academicYear
        );
        const attendance = rawData.attendance || [];
        const teachers = rawData.teachers || [];
        const staff = rawData.staff || [];
        const remarks = rawData.remarks || [];
        const paymentPrompts = rawData.paymentPrompts || [];
        const archives = rawData.archives || [];
        const transport = rawData.transport || defaults.transport;
        const library = rawData.library || defaults.library;
        const payroll = rawData.payroll || [];

        console.log(`[Storage] Ensuring integrity: ${students.length} students, ${payments.length} payments, ${assessments.length} assessments`);

        // IMPORTANT: Spread data FIRST so it overrides defaults
        return {
            ...defaults,
            ...rawData,
            students,
            payments,
            assessments,
            attendance,
            teachers,
            staff,
            remarks,
            paymentPrompts,
            archives,
            transport,
            library,
            payroll,
            settings: {
                ...defaults.settings,
                ...settings,
                grades: settings.grades?.length > 0 ? settings.grades : defaults.settings.grades,
                streams: settings.streams?.length > 0 ? settings.streams : defaults.settings.streams,
                feeStructures: feeStructures,
                termDates: settings.termDates || defaults.settings.termDates,
                academicYear: settings.academicYear || defaults.settings.academicYear,
                currency: settings.currency || defaults.settings.currency
            }
        };
    },

    save(data) {
        try {
            if (!data) {
                console.warn('[Storage] Attempted to save null/undefined data');
                return;
            }
            
            // Ensure ALL data arrays exist and are valid
            const dataToSave = {
                _savedAt: Date.now(),
                _version: this._version,
                // Core academic data
                students: Array.isArray(data.students) ? data.students : [],
                assessments: Array.isArray(data.assessments) ? data.assessments : [],
                attendance: Array.isArray(data.attendance) ? data.attendance : [],
                remarks: Array.isArray(data.remarks) ? data.remarks : [],
                // Financial data
                payments: Array.isArray(data.payments) ? data.payments : [],
                paymentPrompts: Array.isArray(data.paymentPrompts) ? data.paymentPrompts : [],
                // Staff data
                teachers: Array.isArray(data.teachers) ? data.teachers : [],
                staff: Array.isArray(data.staff) ? data.staff : [],
                // Other data
                archives: Array.isArray(data.archives) ? data.archives : [],
                payroll: Array.isArray(data.payroll) ? data.payroll : [],
                // Complex objects
                transport: data.transport || { routes: [], assignments: [] },
                library: data.library || { books: [], transactions: [] },
                // Settings
                settings: data.settings || {}
            };
            
            const storage = this.getStorage();
            const jsonStr = JSON.stringify(dataToSave);
            
            try {
                storage.setItem(this.key, jsonStr);
                console.log(`[Storage] ✓ Saved: ${dataToSave.students.length} students, ${dataToSave.payments.length} payments, ${dataToSave.assessments.length} assessments`);
            } catch (storageErr) {
                console.warn('[Storage] Storage error:', storageErr.message);
                if (storageErr.name === 'QuotaExceededError') {
                    // Reduce large arrays and retry
                    const reducedData = {
                        ...dataToSave,
                        assessments: dataToSave.assessments.slice(0, 500),
                        attendance: dataToSave.attendance.slice(0, 500)
                    };
                    storage.setItem(this.key, JSON.stringify(reducedData));
                    console.warn('[Storage] Saved with reduced data (quota exceeded)');
                }
            }
        } catch (e) {
            console.error('[Storage] Save error:', e.message);
        }
    },

    async pushToCloud(data) {
        const ws = window.websim;
        if (!ws || !ws.upload || !ws.postComment) {
            return { error: "Websim Cloud API not available" };
        }
        try {
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const file = new File([blob], `edutrack_sync_${Date.now()}.json`, { type: 'application/json' });
            const url = await ws.upload(file);
            const result = await ws.postComment({
                content: `[DATA_SYNC] ${url}`
            });
            return result;
        } catch (e) {
            console.error("Cloud push failed:", e);
            return { error: e.message };
        }
    },

    async pullFromCloud(projectId) {
        const ws = window.websim;
        if (!ws) return null;
        try {
            const response = await fetch(`/api/v1/projects/${projectId}/comments?first=50&sort_by=newest`);
            const result = await response.json();
            // Find the most recent sync comment from the end (newest)
            const syncComment = (result.comments?.data || []).find(c => c.comment.raw_content.includes('[DATA_SYNC]'));
            if (syncComment) {
                const match = syncComment.comment.raw_content.match(/\[DATA_SYNC\]\s+(https?:\/\/[^\s\)]+)/);
                if (match && match[1]) {
                    const dataResponse = await fetch(match[1]);
                    return await dataResponse.json();
                }
            }
        } catch (e) {
            console.error("Cloud pull failed:", e);
        }
        return null;
    },

    getGradeInfo(score) {
        const s = Number(score);
        if (s >= 90) return { level: 'EE1', points: 8, al: 8, label: 'Exceeding Expectations', desc: 'Exceptional' };
        if (s >= 75) return { level: 'EE2', points: 7, al: 7, label: 'Exceeding Expectations', desc: 'Very Good' };
        if (s >= 58) return { level: 'ME1', points: 6, al: 7, label: 'Meeting Expectations', desc: 'Good' };
        if (s >= 41) return { level: 'ME2', points: 5, al: 6, label: 'Meeting Expectations', desc: 'Fair' };
        if (s >= 31) return { level: 'AE1', points: 4, al: 5, label: 'Approaching Expectations', desc: 'Needs Improvement' };
        if (s >= 21) return { level: 'AE2', points: 3, al: 4, label: 'Approaching Expectations', desc: 'Below Average' };
        if (s >= 11) return { level: 'BE1', points: 2, al: 3, label: 'Below Expectations', desc: 'Well Below Average' };
        if (s > 0) return { level: 'BE2', points: 1, al: 2, label: 'Below Expectations', desc: 'Minimal' };
        return { level: '-', points: 0, al: 1, label: 'Not Assessed', desc: 'No Data' };
    },

    /**
     * Calculate overall level from subject percentages
     * Overall % = average of all subject percentages
     * Overall Level = mapped from overall % using same scale as individual subjects
     */
    getOverallLevel(subjectPercentages) {
        if (!subjectPercentages || subjectPercentages.length === 0) {
            return { level: '-', percentage: 0, al: 1 };
        }
        
        // Calculate overall percentage (average of all subject percentages)
        const validPercentages = subjectPercentages.filter(p => p !== null && p !== undefined && p > 0);
        if (validPercentages.length === 0) {
            return { level: '-', percentage: 0, al: 1 };
        }
        
        const overallPercentage = validPercentages.reduce((sum, p) => sum + p, 0) / validPercentages.length;
        
        // Map percentage to level using same scale
        if (overallPercentage >= 90) return { level: 'EE1', percentage: Math.round(overallPercentage), al: 8 };
        if (overallPercentage >= 75) return { level: 'EE2', percentage: Math.round(overallPercentage), al: 7 };
        if (overallPercentage >= 58) return { level: 'ME1', percentage: Math.round(overallPercentage), al: 6 };
        if (overallPercentage >= 41) return { level: 'ME2', percentage: Math.round(overallPercentage), al: 5 };
        if (overallPercentage >= 31) return { level: 'AE1', percentage: Math.round(overallPercentage), al: 4 };
        if (overallPercentage >= 21) return { level: 'AE2', percentage: Math.round(overallPercentage), al: 3 };
        if (overallPercentage >= 11) return { level: 'BE1', percentage: Math.round(overallPercentage), al: 2 };
        if (overallPercentage > 0) return { level: 'BE2', percentage: Math.round(overallPercentage), al: 1 };
        return { level: '-', percentage: 0, al: 1 };
    },

    getStudentAttendance(studentId, attendanceData, term = null) {
        let records = attendanceData.filter(a => a.studentId === studentId);
        if (term) {
            records = records.filter(a => a.term === term);
        }
        if (records.length === 0) return null;
        const present = records.filter(a => a.status === 'Present' || a.status === 'Late').length;
        const total = records.length;
        return total > 0 ? Math.round((present / total) * 100) : null;
    },

    getTermDates(settings, term) {
        const academicYear = settings.academicYear || '2025/2026';
        const year = academicYear.split('/')[0];

        if (settings.termDates && settings.termDates[term]) {
            return settings.termDates[term];
        }

        if (term === 'T1') return { start: `${year}-01-06`, end: `${year}-04-04` };
        if (term === 'T2') return { start: `${year}-04-21`, end: `${year}-08-08` };
        return { start: `${year}-08-25`, end: `${year}-11-21` };
    },

    getWeeksInTerm(settings, term) {
        const dates = this.getTermDates(settings, term);
        const start = new Date(dates.start);
        const end = new Date(dates.end);
        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        return Math.ceil(days / 7);
    },

    getWeeksForTerm(settings, term) {
        const dates = this.getTermDates(settings, term);
        const start = new Date(dates.start);
        const weeks = [];
        while (start <= new Date(dates.end)) {
            const weekStart = new Date(start);
            const weekDates = [];
            for (let i = 0; i < 5; i++) {
                if (weekStart > new Date(dates.end)) break;
                weekDates.push(weekStart.toISOString().split('T')[0]);
                weekStart.setDate(weekStart.getDate() + 1);
            }
            weeks.push({ weekNum: weeks.length + 1, dates: weekDates });
            start.setDate(start.getDate() + 7 - start.getDay() + 1);
        }
        return weeks;
    },

    calculateKenyanPayroll(basicSalary, extraEarnings = {}, extraDeductions = {}) {
        const basic = Number(basicSalary) || 0;
        const earningsObj = extraEarnings || {};
        const deductionsObj = extraDeductions || {};

        const totalExtraEarnings = Object.values(earningsObj).reduce((a, b) => a + (Number(b) || 0), 0);

        // Gross for Tax Purpose (Basic + Allowances)
        const gross = basic + totalExtraEarnings;

        // 1. NSSF (New Rates 2024 Tier I & II - approx 6% capped at 2,160)
        const nssf = Math.min(gross * 0.06, 2160);

        // 2. Taxable Income
        const taxableIncome = gross - nssf;

        // 3. PAYE Calculation
        let tax = 0;
        if (gross > 24000) {
            let remaining = taxableIncome;

            // Band 1: 0 - 24,000 @ 10%
            const b1 = Math.min(remaining, 24000);
            tax += b1 * 0.10;
            remaining -= b1;

            // Band 2: Next 8,333 @ 25%
            if (remaining > 0) {
                const b2 = Math.min(remaining, 8333);
                tax += b2 * 0.25;
                remaining -= b2;
            }

            // Band 3: Next 467,667 @ 30%
            if (remaining > 0) {
                const b3 = Math.min(remaining, 467667);
                tax += b3 * 0.30;
                remaining -= b3;
            }

            // Band 4: Next 300,000 @ 32.5%
            if (remaining > 0) {
                const b4 = Math.min(remaining, 300000);
                tax += b4 * 0.325;
                remaining -= b4;
            }

            // Band 5: Over 800,000 @ 35%
            if (remaining > 0) {
                tax += remaining * 0.35;
            }

            // Apply Personal Relief
            tax = Math.max(0, tax - 2400);
        }

        // 4. SHIF (2.75% of Gross)
        const shif = gross * 0.0275;

        // 5. Housing Levy (AHL - 1.5% of Gross)
        const ahl = gross * 0.015;

        // 6. NITA (Employer pays, but often recorded - 50 KES)
        const nita = 50;

        const totalStatutory = nssf + tax + shif + ahl;
        const totalExtraDeductions = Object.values(deductionsObj).reduce((a, b) => a + (Number(b) || 0), 0);

        const netPay = gross - totalStatutory - totalExtraDeductions;

        return {
            basic,
            extraEarnings: earningsObj,
            extraDeductions: deductionsObj,
            gross,
            nssf,
            paye: tax,
            shif,
            ahl,
            nita,
            totalStatutory,
            totalExtraDeductions,
            totalDeductions: totalStatutory + totalExtraDeductions,
            netPay
        };
    },

    numberToWords(num) {
        const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
        const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

        const convert_thousands = (n) => {
            if (n >= 1000) return convert_hundreds(Math.floor(n / 1000)) + " Thousand " + convert_hundreds(n % 1000);
            else return convert_hundreds(n);
        };

        const convert_hundreds = (n) => {
            if (n > 99) return ones[Math.floor(n / 100)] + " Hundred " + convert_tens(n % 100);
            else return convert_tens(n);
        };

        const convert_tens = (n) => {
            if (n < 10) return ones[n];
            else if (n >= 10 && n < 20) return teens[n - 10];
            else return tens[Math.floor(n / 10)] + " " + ones[n % 10];
        };

        if (num === 0) return "Zero";

        let wholeNumber = Math.floor(num);
        let decimal = Math.round((num - wholeNumber) * 100);

        let result = "";
        if (wholeNumber >= 1000000) {
            result += convert_thousands(Math.floor(wholeNumber / 1000000)) + " Million " + convert_thousands(wholeNumber % 1000000);
        } else {
            result += convert_thousands(wholeNumber);
        }

        result = result.trim() + " Shillings";
        if (decimal > 0) {
            result += " and " + convert_tens(decimal) + " Cents";
        } else {
            result += " Only";
        }

        return result;
    },

    getStudentFinancials(student, payments, settings) {
        const currentYear = settings.academicYear;
        const structure = settings.feeStructures?.find(f => f.grade === student.grade);
        const selectedKeys = Array.isArray(student.selectedFees) ? student.selectedFees : ['t1', 't2', 't3'];

        let baseDue = structure ? selectedKeys.reduce((sum, key) => sum + (structure[key] || 0), 0) : 0;
        const previousArrears = Number(student.previousArrears) || 0;

        // Filter payments by current academic year
        const yearPayments = (payments || []).filter(p => p.academicYear === currentYear);

        // Apply category discounts
        if (student.category === 'Sponsored') {
            baseDue = 0;
        } else if (student.category === 'Staff') {
            baseDue = baseDue * 0.5;
        }

        // Total Due is cumulative: Arrears B/F + Current Term/Year Fees
        const totalDue = previousArrears + baseDue;

        // Sum all payments for this student - filter out voided payments
        const totalPaid = (payments || [])
            .filter(p => String(p.studentId) === String(student.id) && !p.voided)
            .reduce((sum, p) => sum + Number(p.amount), 0);

        return {
            totalDue, // Includes Balance Brought Forward
            totalPaid,
            balance: totalDue - totalPaid,
            baseDue,
            previousArrears
        };
    },

    parseSelectedFees(fees) {
        // Handle null, undefined, empty
        if (!fees || fees === '') {
            return ['t1', 't2', 't3'];
        }
        
        // Handle Java object strings from Google Sheets
        if (typeof fees === 'string') {
            // Skip Java object references like "[Ljava.lang.Object;@4e3c55b4"
            if (fees.includes('java.lang.Object') || fees.startsWith('[L')) {
                return ['t1', 't2', 't3'];
            }
            // Handle comma-separated like "t1,t2,t3"
            if (fees.includes(',')) {
                return fees.split(',').map(f => f.trim()).filter(f => f && !f.includes('java'));
            }
            // Handle single value like "t1"
            if (fees.trim()) {
                return [fees.trim()];
            }
            return ['t1', 't2', 't3'];
        }
        
        // Handle array
        if (Array.isArray(fees)) {
            // Filter out any Java objects
            return fees.filter(f => f && typeof f === 'string' && !f.includes('java.lang.Object'));
        }
        
        return ['t1', 't2', 't3'];
    },

    normalizeAssessments(assessments, fallbackAcademicYear = this.defaultData.settings.academicYear) {
        return (assessments || []).map(a => {
            const normalizedMaxScore = Number(a.maxScore);
            const maxScore = Number.isFinite(normalizedMaxScore) && normalizedMaxScore > 0 ? normalizedMaxScore : 100;

            const normalizedRawScore = Number(a.rawScore);
            const hasRawScore = Number.isFinite(normalizedRawScore);

            const normalizedScore = Number(a.score);
            const score = Number.isFinite(normalizedScore)
                ? normalizedScore
                : hasRawScore
                    ? Math.round((normalizedRawScore / maxScore) * 100)
                    : NaN;

            const rawScore = hasRawScore
                ? normalizedRawScore
                : Number.isFinite(score)
                    ? Math.round((score / 100) * maxScore)
                    : NaN;

            return {
                ...a,
                score,
                rawScore,
                maxScore,
                studentId: String(a.studentId || ''),
                studentAdmissionNo: a.studentAdmissionNo ? String(a.studentAdmissionNo) : '',
                studentName: a.studentName ? String(a.studentName) : '',
                academicYear: a.academicYear || fallbackAcademicYear || '2025/2026'
            };
        }).filter(a => Number.isFinite(a.score) && (a.studentId || a.studentAdmissionNo));
    },

    // Replace local data with Google Sheet data (for clean sync)
    replaceWithGoogleData(existingData, googleData) {
        // SAFETY: If googleData is null/undefined or all arrays are null, keep existing data
        if (!googleData) {
            console.log('[Storage] Google data is null, keeping existing data');
            return existingData;
        }
        
        // Check if all Google data arrays are null (indicates fetch error)
        const hasAnyData = googleData.students !== null || 
                          googleData.assessments !== null || 
                          googleData.payments !== null ||
                          googleData.teachers !== null ||
                          googleData.staff !== null;
        
        if (!hasAnyData) {
            console.log('[Storage] Google data fetch failed (all null), keeping existing data');
            return existingData;
        }
        
        // Get all students from Google (use empty array if null)
        const googleStudents = googleData.students || [];
        
        // Get settings grades for normalization
        const settingsGrades = (existingData.settings?.grades || []);
        
        // Helper to normalize grade
        const normalizeGrade = (grade) => {
            if (!grade) return 'GRADE 1';
            if (settingsGrades.includes(grade)) return grade;
            const gradeNum = grade.replace(/[^0-9]/g, '');
            if (gradeNum) {
                const matched = settingsGrades.find(g => g.includes(gradeNum));
                if (matched) return matched;
            }
            return grade;
        };
        
        // Normalize the data first
        const normalizedStudents = googleStudents.map((student, index) => {
            const admNo = student.admissionNo ? String(student.admissionNo).trim() : '';
            const normalizedGrade = normalizeGrade(student.grade);
            
            return {
                ...student,
                id: student.id || `student_${index}`, // Ensure ID exists
                grade: normalizedGrade,
                stream: student.stream || '',
                selectedFees: this.parseSelectedFees(student.selectedFees),
                previousArrears: Number(student.previousArrears) || 0,
                // Ensure admission number exists
                admissionNo: admNo || `ADM-${index + 1}`
            };
        });

        // Deduplicate students by admissionNo (case-insensitive, keep FIRST occurrence)
        const uniqueStudents = [];
        const seenAdmNos = new Set();
        for (const s of normalizedStudents) {
            const admLower = String(s.admissionNo || '').toLowerCase();
            if (!admLower) continue; // Skip empty admission numbers
            if (!seenAdmNos.has(admLower)) {
                seenAdmNos.add(admLower);
                uniqueStudents.push(s);
            }
            // If duplicate, skip it
        }
        
        // Also deduplicate local students that might have been added locally
        const localStudents = existingData.students || [];
        const localUnique = [];
        const localSeen = new Set();
        for (const s of localStudents) {
            const admLower = String(s.admissionNo || '').toLowerCase();
            if (!admLower) {
                localUnique.push(s);
                continue;
            }
            if (!localSeen.has(admLower)) {
                localSeen.add(admLower);
                localUnique.push(s);
            }
        }
        
        // Merge: prefer Google data, but keep local-only students that don't exist in Google
        const googleAdmNos = new Set(uniqueStudents.map(s => String(s.admissionNo || '').toLowerCase()));
        for (const s of localUnique) {
            const admLower = String(s.admissionNo || '').toLowerCase();
            // Keep students without admissionNo OR those not in Google
            if (!admLower || !googleAdmNos.has(admLower)) {
                uniqueStudents.push(s);
            }
        }
        
        // Deduplicate and MERGE assessments
        const googleAssessments = googleData.assessments || [];
        const localAssessments = Array.isArray(existingData.assessments) ? existingData.assessments : [];
        const uniqueAssessments = [];
        const seenAssessKeys = new Set();
        
        // Process Google data first - normalize IDs
        for (const assess of googleAssessments) {
            const normalizedAssess = {
                ...assess,
                studentId: String(assess.studentId || ''),
                studentAdmissionNo: assess.studentAdmissionNo ? String(assess.studentAdmissionNo) : ''
            };
            const key = `${normalizedAssess.studentId}-${assess.subject}-${assess.term}-${assess.examType}-${assess.academicYear}`;
            if (!seenAssessKeys.has(key)) {
                seenAssessKeys.add(key);
                uniqueAssessments.push(normalizedAssess);
            }
        }

        // Add local assessments that don't exist in Google yet
        for (const assess of localAssessments) {
            const normalizedAssess = {
                ...assess,
                studentId: String(assess.studentId || ''),
                studentAdmissionNo: assess.studentAdmissionNo ? String(assess.studentAdmissionNo) : ''
            };
            const key = `${normalizedAssess.studentId}-${assess.subject}-${assess.term}-${assess.examType}-${assess.academicYear}`;
            if (!seenAssessKeys.has(key)) {
                seenAssessKeys.add(key);
                uniqueAssessments.push(normalizedAssess);
            }
        }
        
        // Deduplicate and MERGE attendance
        const googleAttendance = googleData.attendance || [];
        const localAttendance = Array.isArray(existingData.attendance) ? existingData.attendance : [];
        const uniqueAttendance = [];
        const seenAttKeys = new Set();
        
        for (const att of googleAttendance) {
            const key = `${att.studentId}-${att.date}`;
            if (!seenAttKeys.has(key)) {
                seenAttKeys.add(key);
                uniqueAttendance.push(att);
            }
        }

        for (const att of localAttendance) {
            const key = `${att.studentId}-${att.date}`;
            if (!seenAttKeys.has(key)) {
                seenAttKeys.add(key);
                uniqueAttendance.push(att);
            }
        }
        
        // Deduplicate and normalize payments - MERGE LOCAL AND GOOGLE
        const googlePayments = googleData.payments || [];
        const localPayments = Array.isArray(existingData.payments) ? existingData.payments : [];
        const uniquePayments = [];
        const seenPaymentIds = new Set();
        
        // Add Google payments first (they are the truth)
        for (const payment of googlePayments) {
            if (!payment.id) continue;
            const pid = String(payment.id);
            if (!seenPaymentIds.has(pid)) {
                seenPaymentIds.add(pid);
                uniquePayments.push({
                    ...payment,
                    studentId: String(payment.studentId)
                });
            }
        }

        // Add local payments that aren't in Google yet
        for (const payment of localPayments) {
            if (!payment.id) continue;
            const pid = String(payment.id);
            if (!seenPaymentIds.has(pid)) {
                seenPaymentIds.add(pid);
                uniquePayments.push({
                    ...payment,
                    studentId: String(payment.studentId)
                });
            }
        }

        // Deduplicate teachers
        const googleTeachers = googleData.teachers || [];
        const uniqueTeachers = [];
        const seenTeacherIds = new Set();
        for (const teacher of googleTeachers) {
            if (!teacher.id) continue;
            if (!seenTeacherIds.has(teacher.id)) {
                seenTeacherIds.add(teacher.id);
                uniqueTeachers.push(teacher);
            }
        }

        // Deduplicate staff
        const googleStaff = googleData.staff || [];
        const uniqueStaff = [];
        const seenStaffIds = new Set();
        for (const staffMember of googleStaff) {
            if (!staffMember.id) continue;
            if (!seenStaffIds.has(staffMember.id)) {
                seenStaffIds.add(staffMember.id);
                uniqueStaff.push(staffMember);
            }
        }
        
        // Deduplicate and MERGE calendar
        const googleCalendar = googleData.calendar || [];
        const localCalendar = Array.isArray(existingData.calendar) ? existingData.calendar : [];
        const uniqueCalendar = [];
        const seenCalendarIds = new Set();
        
        for (const event of googleCalendar) {
            if (!event.id) continue;
            if (!seenCalendarIds.has(event.id)) {
                seenCalendarIds.add(event.id);
                uniqueCalendar.push(event);
            }
        }
        
        for (const event of localCalendar) {
            if (!event.id) continue;
            if (!seenCalendarIds.has(event.id)) {
                seenCalendarIds.add(event.id);
                uniqueCalendar.push(event);
            }
        }
        
        // Merge settings carefully: prefer Google settings but preserve critical defaults
        const mergedSettings = {
            ...(existingData.settings || {}),
            ...(googleData.settings || {})
        };

        // Ensure grades array exists and always includes 'BABY CLASS' at the front
        if (!Array.isArray(mergedSettings.grades)) {
            mergedSettings.grades = (existingData.settings && existingData.settings.grades) || ['BABY CLASS', 'PP1', 'PP2', 'GRADE 1', 'GRADE 2', 'GRADE 3', 'GRADE 4', 'GRADE 5', 'GRADE 6', 'GRADE 7', 'GRADE 8', 'GRADE 9', 'GRADE 10', 'GRADE 11', 'GRADE 12'];
        }
        if (!mergedSettings.grades.includes('BABY CLASS')) {
            mergedSettings.grades.unshift('BABY CLASS');
        }

        return {
            ...existingData,
            students: uniqueStudents,
            assessments: uniqueAssessments,
            attendance: uniqueAttendance,
            payments: uniquePayments,
            teachers: uniqueTeachers,
            staff: uniqueStaff,
            calendar: uniqueCalendar,
            settings: mergedSettings
        };
    },

    normalizeStudents(students) {
        return (students || []).map(s => ({
            ...s,
            stream: s.stream || '',
            selectedFees: this.parseSelectedFees(s.selectedFees),
            previousArrears: Number(s.previousArrears) || 0
        }));
    },

    mergeData(existingData, incomingData, type) {
        if (!incomingData) return existingData;

        switch (type) {
            case 'students': {
                const existing = [...(existingData.students || [])];
                const incoming = this.normalizeStudents(incomingData.students || []);
                incoming.forEach(newS => {
                    const idx = existing.findIndex(s => s.admissionNo === newS.admissionNo);
                    if (idx > -1) existing[idx] = { ...existing[idx], ...newS };
                    else existing.push(newS);
                });
                return { ...existingData, students: existing };
            }
            case 'assessments': {
                const existing = [...(existingData.assessments || [])];
                const incoming = this.normalizeAssessments(incomingData.assessments || []);
                incoming.forEach(newA => {
                    const idx = existing.findIndex(a =>
                        a.studentId === newA.studentId &&
                        a.subject === newA.subject &&
                        a.term === newA.term &&
                        a.examType === newA.examType &&
                        a.academicYear === newA.academicYear
                    );
                    if (idx > -1) existing[idx] = { ...existing[idx], ...newA };
                    else existing.push(newA);
                });
                return { ...existingData, assessments: existing };
            }
            case 'payments': {
                const existing = [...(existingData.payments || [])];
                const incoming = incomingData.payments || [];
                incoming.forEach(newP => {
                    const idx = existing.findIndex(p => p.id === newP.id || p.receiptNo === newP.receiptNo);
                    if (idx > -1) existing[idx] = { ...existing[idx], ...newP };
                    else existing.push(newP);
                });
                console.log('Merged payments:', existing.length);
                return { ...existingData, payments: existing };
            }
            case 'remarks': {
                const existing = [...(existingData.remarks || [])];
                const incoming = incomingData.remarks || [];
                incoming.forEach(newR => {
                    const idx = existing.findIndex(r => r.studentId === newR.studentId);
                    if (idx > -1) existing[idx] = { ...existing[idx], ...newR };
                    else existing.push(newR);
                });
                return { ...existingData, remarks: existing };
            }
            case 'senior-school': {
                const existing = [...(existingData.students || [])];
                const incoming = incomingData.students || [];
                incoming.forEach(newS => {
                    const idx = existing.findIndex(s => s.admissionNo === newS.admissionNo);
                    if (idx > -1) {
                        existing[idx] = {
                            ...existing[idx],
                            seniorPathway: newS.seniorPathway,
                            seniorElectives: newS.seniorElectives
                        };
                    }
                });
                return { ...existingData, students: existing };
            }
            case 'all': {
                // Combine existing and incoming students, updating duplicates and deduplicating
                const existingStudents = existingData.students || [];
                const incomingStudents = this.normalizeStudents(incomingData.students || []);

                // Deduplicate incoming by admissionNo
                const uniqueIncoming = incomingStudents.filter((s, index, arr) =>
                    arr.findIndex(x => x.admissionNo === s.admissionNo) === index
                );

                const mergedStudents = [...existingStudents];
                uniqueIncoming.forEach(s => {
                    const idx = mergedStudents.findIndex(x => x.admissionNo === s.admissionNo);
                    if (idx > -1) {
                        // merge updates from sheet
                        mergedStudents[idx] = { ...mergedStudents[idx], ...s };
                    } else {
                        mergedStudents.push(s);
                    }
                });
                // Deduplicate final merged students by admissionNo, keeping the last occurrence
                const dedupedStudents = mergedStudents.filter((s, index, arr) => 
                    arr.findLastIndex(x => x.admissionNo === s.admissionNo) === index
                );

                // do same for assessments
                const existingAssessments = existingData.assessments || [];
                const incomingAssessments = this.normalizeAssessments(incomingData.assessments || []);
                const uniqueIncomingAssess = incomingAssessments.filter((a, index, arr) =>
                    arr.findIndex(x =>
                        `${x.studentId}-${x.subject}-${x.term}-${x.examType}-${x.academicYear}` ===
                        `${a.studentId}-${a.subject}-${a.term}-${a.examType}-${a.academicYear}`
                    ) === index
                );
                const mergedAssessments = [...existingAssessments];
                uniqueIncomingAssess.forEach(a => {
                    const key = `${a.studentId}-${a.subject}-${a.term}-${a.examType}-${a.academicYear}`;
                    const exists = mergedAssessments.some(x =>
                        `${x.studentId}-${x.subject}-${x.term}-${x.examType}-${x.academicYear}` === key
                    );
                    if (!exists) {
                        mergedAssessments.push(a);
                    }
                });
                // Deduplicate final merged assessments
                const dedupedAssessments = mergedAssessments.filter((a, index, arr) => 
                    arr.findLastIndex(x => 
                        `${x.studentId}-${x.subject}-${x.term}-${x.examType}-${x.academicYear}` === 
                        `${a.studentId}-${a.subject}-${a.term}-${a.examType}-${a.academicYear}`
                    ) === index
                );

                // Merge payments - keep existing, add new ones from sheet
                const existingPayments = existingData.payments || [];
                const incomingPayments = incomingData.payments || [];
                const mergedPayments = [...existingPayments];
                incomingPayments.forEach(p => {
                    const exists = mergedPayments.some(x => x.id === p.id || x.receiptNo === p.receiptNo);
                    if (!exists) {
                        mergedPayments.push(p);
                    }
                });

                // attendance
                const existingAttendance = existingData.attendance || [];
                const incomingAttendance = incomingData.attendance || [];
                const mergedAttendance = [...existingAttendance];
                incomingAttendance.forEach(a => {
                    const exists = mergedAttendance.some(x => x.id === a.id);
                    if (!exists) mergedAttendance.push(a);
                });

                // staff
                const existingStaff = existingData.staff || [];
                const incomingStaff = incomingData.staff || [];
                const mergedStaff = [...existingStaff];
                incomingStaff.forEach(s => {
                    const idx = mergedStaff.findIndex(x => x.id === s.id);
                    if (idx > -1) mergedStaff[idx] = { ...mergedStaff[idx], ...s };
                    else mergedStaff.push(s);
                });

                // teachers
                const existingTeachers = existingData.teachers || [];
                const incomingTeachers = incomingData.teachers || [];
                const mergedTeachers = [...existingTeachers];
                incomingTeachers.forEach(t => {
                    const idx = mergedTeachers.findIndex(x => x.id === t.id);
                    if (idx > -1) mergedTeachers[idx] = { ...mergedTeachers[idx], ...t };
                    else mergedTeachers.push(t);
                });

                // calendar
                const existingCalendar = existingData.calendar || [];
                const incomingCalendar = incomingData.calendar || [];
                const mergedCalendar = [...existingCalendar];
                incomingCalendar.forEach(c => {
                    const idx = mergedCalendar.findIndex(x => x.id === c.id);
                    if (idx > -1) mergedCalendar[idx] = { ...mergedCalendar[idx], ...c };
                    else mergedCalendar.push(c);
                });

                console.log('Merge complete - Students:', dedupedStudents.length, 'Assessments:', dedupedAssessments.length, 'Payments:', mergedPayments.length);

                return {
                    ...existingData,
                    settings: { ...existingData.settings, ...(incomingData.settings || {}) },
                    students: dedupedStudents,
                    assessments: dedupedAssessments,
                    attendance: mergedAttendance,
                    payments: mergedPayments,
                    teachers: mergedTeachers,
                    staff: mergedStaff,
                    calendar: mergedCalendar,
                    remarks: existingData.remarks || [],
                    archives: existingData.archives || [],
                    paymentPrompts: existingData.paymentPrompts || [],
                    payroll: existingData.payroll || [],
                    transport: existingData.transport || { routes: [], assignments: [] },
                    library: existingData.library || { books: [], transactions: [] }
                };
            }
            default:
                return { ...existingData, ...incomingData };
        }
    },

    archiveYear(data, nextYearLabel) {
        const snapshot = {
            academicYear: data.settings.academicYear,
            archivedAt: new Date().toISOString(),
            students: JSON.parse(JSON.stringify(data.students)),
            assessments: JSON.parse(JSON.stringify(data.assessments)),
            payments: JSON.parse(JSON.stringify(data.payments)),
            remarks: JSON.parse(JSON.stringify(data.remarks)),
            payroll: JSON.parse(JSON.stringify(data.payroll)),
            transport: JSON.parse(JSON.stringify(data.transport || { routes: [], assignments: [] })),
            library: JSON.parse(JSON.stringify(data.library || { books: [], transactions: [] })),
            settings: JSON.parse(JSON.stringify(data.settings))
        };

        return {
            ...data,
            archives: [...(data.archives || []), snapshot],
            // Reset for new year
            assessments: [],
            payments: [],
            remarks: [],
            payroll: [],
            transport: { ...(data.transport || {}), assignments: [] },
            library: { ...(data.library || {}), transactions: [] },
            settings: {
                ...data.settings,
                academicYear: nextYearLabel
            }
        };
    },

    // Restore an archived academic year back into the active dataset (undo archive).
    // Pass the academicYear string (e.g. '2025/2026') to restore that snapshot.
    restoreArchive(data, academicYear) {
        if (!data.archives || data.archives.length === 0) return data;
        const idx = (data.archives || []).findIndex(a => a.academicYear === academicYear);
        if (idx === -1) return data;

        const snapshot = JSON.parse(JSON.stringify(data.archives[idx]));

        // Remove the snapshot from archives
        const updatedArchives = (data.archives || []).filter((_, i) => i !== idx);

        // Merge snapshot back into active area: restore assessments, payments, remarks, payroll, transport, library, and settings
        const restored = {
            ...data,
            students: snapshot.students || data.students,
            assessments: snapshot.assessments || [],
            payments: snapshot.payments || [],
            remarks: snapshot.remarks || [],
            payroll: snapshot.payroll || [],
            transport: snapshot.transport || { routes: [], assignments: [] },
            library: snapshot.library || { books: [], transactions: [] },
            settings: { ...data.settings, ...snapshot.settings },
            archives: updatedArchives
        };

        // Set academicYear to restored snapshot year for clarity
        restored.settings.academicYear = snapshot.academicYear || restored.settings.academicYear;

        return restored;
    },

    getSubjectsForGrade(grade, student = null) {
        const seniorGradeNames = ['GRADE 10', 'GRADE 11', 'GRADE 12'];
        const gUpper = String(grade || '').toUpperCase().trim();

        if (gUpper === 'BABY CLASS' || gUpper === 'PP1' || gUpper === 'PP2' || gUpper.includes('PRE-PRIMARY') || gUpper.includes('PREPRIMARY')) {
            return ['Mathematics activities', 'Language activities', 'Literacy', 'Kiswahili', 'Environmental Activities', 'Creative Activities', 'Religious Education Activities'];
        } else if (gUpper === 'GRADE 1' || gUpper === 'GRADE 2' || gUpper === 'GRADE 3' || gUpper === '1' || gUpper === '2' || gUpper === '3') {
            return ['INDIGENOUS LANGUAGE ACTIVITIES', 'KISWAHILI/KSL ACTIVITIES', 'ENGLISH LANGUAGE ACTIVITIES', 'MATHEMATIC ACTIVITIES', 'RELIGIOUS EDUCATION ACTIVITIES', 'ENVIRONMENTAL ACTIVITIES', 'CREATIVE ART ACTIVITIES'];
        } else if (gUpper === 'GRADE 4' || gUpper === 'GRADE 5' || gUpper === 'GRADE 6') {
            return ['ENGLISH', 'KISWAHILI/KSL', 'MATHEMATICS', 'AGRICULTURE', 'SOCIAL STUDIES', 'RELIGIOUS EDUCATION', 'CREATIVE ARTS', 'SCIENCE & TECHNOLOGY'];
        } else if (gUpper === 'GRADE 7' || gUpper === 'GRADE 8' || gUpper === 'GRADE 9') {
            return ['ENGLISH', 'MATHEMATICS', 'KISWAHILI/KSL', 'SOCIAL STUDIES', 'PRE-TECHNICAL STUDIES', 'CREATIVE ARTS & SPORTS', 'AGRICULTURE & NUTRITION', 'INTEGRATED SCIENCE', 'RELIGIOUS EDUCATION'];
        } else if (seniorGradeNames.includes(gUpper)) {
            // Core subjects
            const core = ['English', 'Kiswahili', 'Mathematics', 'CSL'];
            if (student && student.seniorElectives) {
                return [...core, ...student.seniorElectives];
            }

            // For general list (like Assessment dropdown), return core + common electives
            return [...core,
                'Biology', 'Chemistry', 'Physics', 'Agriculture', 'Computer Studies',
                'History and Citizenship', 'Geography', 'CRE', 'IRE', 'Accounting',
                'Economics', 'Fine Arts', 'Music and Dance', 'Sports Science', 'Business Studies',
                'Physical Education', 'ICT'
            ];
        }
        return ['Mathematics', 'English', 'Science'];
    },

    getStreams(settings) {
        return settings.streams || ['A', 'B', 'C'];
    },

    getGradeWithStream(grade, stream) {
        if (!stream || stream === '') return grade;
        return `${grade} ${stream}`;
    },

    getGradeFromCombined(combined) {
        if (!combined) return '';
        const streamMatch = combined.match(/^(.+?)\s+([A-Z])$/);
        if (streamMatch) {
            return { grade: streamMatch[1], stream: streamMatch[2] };
        }
        return { grade: combined, stream: '' };
    }
};
