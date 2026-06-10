import { h, render } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import htm from 'htm';
import { Dashboard } from './components/Dashboard.js';
import { Students } from './components/Students.js';
import { Teachers } from './components/Teachers.js';
import { Staff } from './components/Staff.js';
import { Marklist } from './components/Marklist.js';
import { Assessments } from './components/Assessments.js';
import { ResultAnalysis } from './components/ResultAnalysis.js';
import { Timetable } from './components/Timetable.js';
import { Fees } from './components/Fees.js';
import { FeesRegister } from './components/FeesRegister.js';
import { FeeReminder } from './components/FeeReminder.js';
import { Transport } from './components/Transport.js';
import { Library } from './components/Library.js';
import { Payroll } from './components/Payroll.js';
import { SeniorSchool } from './components/SeniorSchool.js';
import { Archives } from './components/Archives.js';
import { Settings } from './components/Settings.js';
import { Attendance } from './components/Attendance.js';
import { Sidebar } from './components/Sidebar.js';
import { TeacherAuth } from './components/TeacherAuth.js';
import { ParentAuth } from './components/ParentAuth.js';
import { ParentsDashboard } from './components/ParentsDashboard.js';
import { SchoolCalendar } from './components/SchoolCalendar.js';
import { StudentDetail } from './components/StudentDetail.js';
import { PrintButtons } from './components/PrintButtons.js';
import { SchoolAnalysis } from './components/SchoolAnalysis.js';
import { StrategicReports } from './components/StrategicReports.js';
import { Presentation } from './components/Presentation.js';
import { Storage } from './lib/storage.js';
import { googleSheetSync } from './lib/googleSheetSync.js';

const html = htm.bind(h);

const App = () => {
    const [view, setView] = useState('dashboard');
    const [data, setData] = useState(() => {
        const loaded = Storage.load();
        console.log('Initial load - Students:', loaded.students?.length || 0, 'Payments:', loaded.payments?.length || 0);
        return loaded;
    });

    // Ensure data is loaded from localStorage on mount
    useEffect(() => {
        const currentData = Storage.load();
        console.log('[App] Loading data from localStorage - Students:', currentData.students?.length || 0, 'Assessments:', currentData.assessments?.length || 0);
        // Always load data, even if students array is empty
        setData(currentData);
        
        // Expose sync to window for components
        window.googleSync = googleSheetSync;

        // Auto-sync teachers on refresh if Google Sheet is configured
        if (currentData.settings?.googleScriptUrl) {
            console.log('🔄 Session Sync: Auto-refreshing teacher records from Google Sheet...');
            googleSheetSync.setSettings(currentData.settings);
            googleSheetSync.fetchAll().then(result => {
                if (result.success && result.teachers) {
                    console.log('✅ Teacher records synced successfully from Google Sheet:', result.teachers.length);
                    // Use Storage helper to merge Google teachers into current local state
                    const updatedData = Storage.replaceWithGoogleData(currentData, { teachers: result.teachers });
                    Storage.save(updatedData);
                    setData(updatedData);
                }
            }).catch(err => console.error('❌ Teacher session sync failed:', err));
        }
    }, []);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [selectedStudentId, setSelectedStudentId] = useState(null);
    const [isAdmin, setIsAdmin] = useState(localStorage.getItem('et_is_admin') === 'true');
    
    // Teacher authentication state
    const [teacherSession, setTeacherSession] = useState(() => {
        const saved = localStorage.getItem('et_teacher_session');
        return saved ? JSON.parse(saved) : null;
    });
    const [showTeacherAuth, setShowTeacherAuth] = useState(false);
    const [parentSession, setParentSession] = useState(() => {
        const saved = localStorage.getItem('et_parent_session');
        return saved ? JSON.parse(saved) : null;
    });
    const [showParentAuth, setShowParentAuth] = useState(false);

    useEffect(() => {
        const handler = () => setShowParentAuth(true);
        window.addEventListener('edutrack:open-parent-login', handler);
        return () => window.removeEventListener('edutrack:open-parent-login', handler);
    }, []);
    
    // Derived authentication state
    const isAuthenticated = isAdmin || teacherSession || parentSession;
    
    // Enrich teacher session with details from teacher records if available
    const activeTeacher = teacherSession ? (data.teachers || []).find(t => 
        (teacherSession.name && t.name && t.name.toLowerCase() === teacherSession.name.toLowerCase()) || 
        (teacherSession.username && (
            (t.username && t.username.toLowerCase() === teacherSession.username.toLowerCase()) ||
            (t.name && t.name.toLowerCase() === teacherSession.username.toLowerCase())
        ))
    ) : null;
    
    const teacherSubjectsStr = [teacherSession?.subjects, activeTeacher?.subjects].filter(Boolean).join(',');
    const teacherGradesStr = [teacherSession?.grades, activeTeacher?.grades, teacherSession?.classTeacherGrade, activeTeacher?.classTeacherGrade].filter(Boolean).join(',');

    const allowedTeacherSubjects = teacherSubjectsStr.split(',').map(s => s.trim().toLowerCase()).filter(s => s);
    const allowedTeacherGrades = teacherGradesStr.split(',').map(g => g.trim().toLowerCase()).filter(g => g);
    const allowedTeacherReligion = (teacherSession?.religion || activeTeacher?.religion || '').toLowerCase();

    // Derive selectedStudent from data.students to ensure it's always fresh
    const selectedStudent = selectedStudentId 
        ? (data.students || []).find(s => String(s.id) === String(selectedStudentId)) || null
        : null;
    
    // Check for existing teacher session on load
    useEffect(() => {
        const saved = localStorage.getItem('et_teacher_session');
        if (saved) {
            try {
                const session = JSON.parse(saved);
                if (session.username && session.isTeacher) {
                    setTeacherSession(session);
                }
            } catch (e) {
                localStorage.removeItem('et_teacher_session');
            }
        }
    }, []);

    // Auto-sync with Google Sheet on first load if configured
    // Only auto-sync if there's no local data (first time setup)
    useEffect(() => {
        // Check if this is first load with no local students
        const hasLocalStudents = data?.students?.length > 0;
        const hasGoogleUrl = data?.settings?.googleScriptUrl;
        
        // Only auto-sync if:
        // 1. Has Google URL configured
        // 2. NO local students (first time setup)
        // This prevents overwriting imported data with empty/incomplete Google data
        if (hasGoogleUrl && !hasLocalStudents) {
            console.log('🔄 Auto-syncing with Google Sheet (first time setup)...');
            
            const doAutoSync = async () => {
                setGoogleSyncStatus('Loading from Google Sheet...');
                
                googleSheetSync.setSettings(data.settings);
                
                try {
                    // Fetch settings first
                    const settingsResult = await googleSheetSync.fetchSettings();
                    let mergedSettings = data.settings;
                    
                    if (settingsResult.success && settingsResult.settings) {
                        console.log('Settings loaded from Google:', settingsResult.settings.schoolName);
                        mergedSettings = {
                            ...data.settings,
                            ...settingsResult.settings,
                            googleScriptUrl: data.settings?.googleScriptUrl // Keep the URL
                        };
                    }
                    
                    // Then fetch all other data
                    const result = await googleSheetSync.fetchAll();
                    
                    if (result.success) {
                        console.log('Google data loaded:', result.students?.length, 'students');
                        
                        // Replace local data with Google data, including merged settings
                        const merged = Storage.replaceWithGoogleData(data, {
                            students: result.students || [],
                            assessments: result.assessments || [],
                            attendance: result.attendance || [],
                            payments: result.payments || [],
                            teachers: result.teachers || [],
                            staff: result.staff || [],
                            settings: mergedSettings
                        });
                        
                        setData(merged);
                        setGoogleSyncStatus('Loaded ' + (merged.students?.length || 0) + ' students from Google');
                        setTimeout(() => setGoogleSyncStatus(''), 3000);
                    }
                } catch (err) {
                    console.error('Auto-sync failed:', err);
                    setGoogleSyncStatus('');
                }
            };
            
            // Small delay to let UI render first
            setTimeout(doAutoSync, 1500);
        } else if (hasLocalStudents) {
            console.log('⏭ Auto-sync SKIPPED - Local data exists:', data.students.length, 'students');
        }
    }, []);

    // Sync selectedStudentId when data.students changes (e.g., after Google sync)
    useEffect(() => {
        if (selectedStudentId && !selectedStudent) {
            console.log('Selected student no longer found in data, clearing selection');
            setSelectedStudentId(null);
        }
    }, [data.students, selectedStudentId, selectedStudent]);
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [isGoogleSyncing, setIsGoogleSyncing] = useState(false);
    const [googleSyncStatus, setGoogleSyncStatus] = useState('');
    const [showForcePushModal, setShowForcePushModal] = useState(false);
    const [forcePushSelection, setForcePushSelection] = useState({
        students: false,
        assessments: false,
        payments: false,
        teachers: false,
        staff: false,
        attendance: false,
        settings: false
    });
    const [deviceId, setDeviceId] = useState('');

    // Generate a stable device ID from committed login state
    useEffect(() => {
        // Get username from admin login OR teacher session
        let storedUsername = localStorage.getItem('et_login_username');
        let username = (storedUsername || '').trim().toLowerCase();
        
        // If teacher is logged in, use teacher name
        if (teacherSession && !isAdmin) {
            username = (teacherSession.username || teacherSession.name || '').trim().toLowerCase();
            console.log('📱 Teacher session detected, username:', username);
        }

        if (!username) {
            setDeviceId('');
            return;
        }
        
        const userRole = isAdmin ? 'admin' : 'teacher';
        
        // Check for existing stable session ID or create one
        let stableSessionId = localStorage.getItem('et_session_id');
        if (!stableSessionId) {
            stableSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            localStorage.setItem('et_session_id', stableSessionId);
        }
        
        // Use stable session ID combined with user role for consistent tracking
        const newDeviceId = `${userRole}@${username}#${stableSessionId}`;
        
        console.log('📱 Setting deviceId:', newDeviceId, 'role:', userRole);
        setDeviceId(newDeviceId);
    }, [isAdmin, teacherSession]);

    // Clear session ID on logout to prevent reuse
    useEffect(() => {
        const handleLogoutEvent = () => {
            // Don't clear immediately - wait for new login
        };
        window.addEventListener('edutrack:logout', handleLogoutEvent);
        return () => window.removeEventListener('edutrack:logout', handleLogoutEvent);
    }, []);

    // Initialize login state from localStorage on app load
    useEffect(() => {
        const storedUsername = localStorage.getItem('et_login_username');
        if (storedUsername) {
            setLoginUsername(storedUsername);
        }
    }, []);

    useEffect(() => {
        // Ensure payments are always saved
        if (data.payments && data.payments.length > 0) {
            Storage.save(data);
        }
    }, [data.payments]);
    
    // Save all data changes - but NOT on initial mount
    const isInitialMount = useRef(true);
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        // SAFETY CHECK: Don't save if students array is empty but payments exist
        // This indicates data corruption - keep previous data instead
        if ((!data.students || data.students.length === 0) && 
            (data.payments && data.payments.length > 0)) {
            console.error('🚨 SAFETY BLOCK: Attempted to save data with 0 students but', data.payments.length, 'payments. Data corruption detected!');
            alert('⚠️ Data corruption detected! Students data is missing but payments exist.\n\nPlease:\n1. Click "➕ Add Sample Students" in the yellow panel, OR\n2. Sync from Google Sheet, OR\n3. Clear all and reset\n\nThe app has prevented saving this corrupted state.');
            return; // Don't save corrupted data
        }
        // Only save after initial mount when data actually changes
        Storage.save(data);
    }, [data]);

    // Track data changes for debugging
    useEffect(() => {
        console.log('App data updated - Students:', data.students?.length || 0, 'Payments:', data.payments?.length || 0, 'Assessments:', data.assessments?.length || 0);
        console.log('Sample student:', data.students?.[0]);
    }, [data.students, data.payments, data.assessments]);

    useEffect(() => {
        const ws = window.websim;
        if (!ws) return;

        const initCloudSync = async () => {
            try {
                const project = await ws.getCurrentProject();
                const remoteData = await Storage.pullFromCloud(project.id);
                // Only merge if remote data has actual content
                if (remoteData && remoteData.students && remoteData.students.length > 0) {
                    console.log('Cloud data received - Students:', remoteData.students?.length || 0, 'Payments:', remoteData.payments?.length || 0);
                    setData(prev => {
                        const merged = Storage.mergeData(prev, remoteData, 'all');
                        console.log('After merge - Students:', merged.students?.length || 0, 'Payments:', merged.payments?.length || 0);
                        return merged;
                    });
                } else {
                    console.log('Cloud sync: No remote data or empty, keeping local data');
                }
            } catch (err) {
                console.warn("Initial cloud sync skipped:", err);
            }
        };

        const handleRemoteUpdate = async (event) => {
            const { comment } = event;
            if (comment && comment.raw_content && comment.raw_content.includes('[DATA_SYNC]')) {
                const match = comment.raw_content.match(/\[DATA_SYNC\]\s+(https?:\/\/[^\s\)]+)/);
                if (match && match[1]) {
                    setIsSyncing(true);
                    try {
                        const response = await fetch(match[1]);
                        const remoteData = await response.json();
                        setData(prev => Storage.mergeData(prev, remoteData, 'all'));
                    } catch (e) {
                        console.error("Failed to fetch remote update");
                    } finally {
                        setTimeout(() => setIsSyncing(false), 2000);
                    }
                }
            }
        };

        initCloudSync();
        ws.addEventListener('comment:created', handleRemoteUpdate);
        return () => ws.removeEventListener('comment:created', handleRemoteUpdate);
    }, []);

    // Listen for a restore event dispatched by Archives (or anywhere)
    useEffect(() => {
        const handler = (e) => {
            if (e?.detail?.restored) {
                setData(e.detail.restored);
                alert('Archived year restored into active data.');
            }
        };
        window.addEventListener('edutrack:restore', handler);
        return () => window.removeEventListener('edutrack:restore', handler);
    }, []);

    // Track user activity with proper rate limiting and deduplication
    useEffect(() => {
        return;
        if (deviceId.includes('guest')) return;

        let lastTrackTime = 0;
        const MIN_TRACK_INTERVAL = 60000; // Only track once per minute

        const trackUserActivity = async () => {
            const now = Date.now();
            if (now - lastTrackTime < MIN_TRACK_INTERVAL) return; // Rate limit
            lastTrackTime = now;
            
            try {
                googleSheetSync.setSettings(data.settings);
                const result = await googleSheetSync.setActiveUser(deviceId);
                console.log('📡 Activity tracked:', deviceId, 'Result:', result);
            } catch (error) {
                console.warn('Activity tracking error:', error);
            }
        };

        // Track IMMEDIATELY on mount (force first call)
        setTimeout(() => trackUserActivity(), 1000);

        // Track every 2 minutes
        const interval = setInterval(trackUserActivity, 2 * 60 * 1000);

        // Track on user interaction
        let interactionTimeout;
        const handleInteraction = () => {
            clearTimeout(interactionTimeout);
            interactionTimeout = setTimeout(trackUserActivity, 3000);
        };
        window.addEventListener('click', handleInteraction, { passive: true });
        window.addEventListener('keydown', handleInteraction, { passive: true });

        return () => {
            clearInterval(interval);
            clearTimeout(interactionTimeout);
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, [data?.settings?.googleScriptUrl, deviceId, isAdmin, teacherSession]);


    // Sync lock to prevent concurrent syncs causing data multiplication
    const [syncLock, setSyncLock] = useState(false);
    const lastSyncRef = useRef(0);
    const SYNC_COOLDOWN = 30000; // 30 seconds minimum between syncs

    // Force push selected local data to Google based on user selection
    const forcePushToGoogle = useCallback(async (selection) => {
        console.log('[ForcePush] Starting - URL:', data?.settings?.googleScriptUrl);

        if (!data?.settings?.googleScriptUrl) {
            alert("Google Sheet not configured");
            console.error('[ForcePush] No URL found in settings:', data?.settings);
            return;
        }

        // Store URL to verify it doesn't get lost
        const originalUrl = data.settings.googleScriptUrl;
        console.log('[ForcePush] Original URL stored:', originalUrl);

        // Use the selection passed from the modal button
        const sel = selection || forcePushSelection;
        console.log('[ForcePush] Selection state:', JSON.stringify(sel));
        console.log('[ForcePush] sel.settings:', sel.settings);

        // Close modal
        setShowForcePushModal(false);

        const studentCount = sel.students ? (data.students?.length || 0) : 0;
        const assessmentCount = sel.assessments ? (data.assessments?.length || 0) : 0;
        const paymentCount = sel.payments ? (data.payments?.length || 0) : 0;
        const teacherCount = sel.teachers ? (data.teachers?.length || 0) : 0;
        const staffCount = sel.staff ? (data.staff?.length || 0) : 0;
        const settingsCount = sel.settings ? 'All' : 0;

        let selectedItems = [];
        if (sel.students) selectedItems.push(`${studentCount} Students`);
        if (sel.assessments) selectedItems.push(`${assessmentCount} Assessments`);
        if (sel.payments) selectedItems.push(`${paymentCount} Payments`);
        if (sel.teachers) selectedItems.push(`${teacherCount} Teachers`);
        if (sel.staff) selectedItems.push(`${staffCount} Staff`);
        if (sel.settings) selectedItems.push(`Settings (fee structures, etc.)`);

        console.log('[ForcePush] Selected items:', selectedItems);

        if (selectedItems.length === 0) {
            alert("Please select at least one data type to push.");
            return;
        }
        
        if (!confirm(`🚀 FORCE PUSH\n\nPushing to Google Sheet:\n• ${selectedItems.join('\n• ')}\n\nDuplicates will be UPDATED. Continue?`)) {
            return;
        }
        
        setGoogleSyncStatus('🔄 Force pushing to Google...');
        
        googleSheetSync.setSettings(data.settings);
        
        try {
            let totalAdded = 0;
            let totalFailed = 0;
            
            // ========== FORCE PUSH STUDENTS ==========
            if (sel.students) {
                setGoogleSyncStatus(`📤 Pushing ${studentCount} students...`);
                console.log('=== FORCE PUSHING STUDENTS ===');
                
                for (const student of (data.students || [])) {
                    console.log('➕ Student:', student.name, student.id, student.admissionNo);
                    const result = await googleSheetSync.pushStudent(student);
                    console.log('Result:', result);
                    if (result.success) {
                        totalAdded++;
                    } else {
                        totalFailed++;
                        console.warn('❌ Failed student:', student.name, result.error);
                    }
                }
            }
            
            // ========== FORCE PUSH ASSESSMENTS ==========
            if (sel.assessments) {
                setGoogleSyncStatus(`📤 Pushing ${assessmentCount} assessments...`);
                console.log('=== FORCE PUSHING ASSESSMENTS ===');
                
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
                    console.log('➕ Assessment:', enriched.studentName, enriched.subject);
                    const result = await googleSheetSync.pushAssessment(enriched);
                    if (result.success) {
                        totalAdded++;
                    } else {
                        totalFailed++;
                    }
                }
            }
            
            // ========== FORCE PUSH PAYMENTS ==========
            if (sel.payments) {
                setGoogleSyncStatus(`📤 Pushing ${paymentCount} payments...`);
                console.log('=== FORCE PUSHING PAYMENTS ===');
                
                for (const payment of (data.payments || [])) {
                    console.log('➕ Payment:', payment.id, payment.amount);
                    const result = await googleSheetSync.pushPayment(payment);
                    if (result.success) {
                        totalAdded++;
                    } else {
                        totalFailed++;
                    }
                }
            }
            
            // ========== FORCE PUSH TEACHERS ==========
            if (sel.teachers) {
                setGoogleSyncStatus(`📤 Pushing ${teacherCount} teachers...`);
                console.log('=== FORCE PUSHING TEACHERS ===');
                
                for (const teacher of (data.teachers || [])) {
                    console.log('➕ Teacher:', teacher.name, teacher.id);
                    const result = await googleSheetSync.pushTeacher(teacher);
                    if (result.success) {
                        totalAdded++;
                    } else {
                        totalFailed++;
                    }
                }
            }
            
            // ========== FORCE PUSH STAFF ==========
            if (sel.staff) {
                setGoogleSyncStatus(`📤 Pushing ${staffCount} staff...`);
                console.log('=== FORCE PUSHING STAFF ===');

                for (const staff of (data.staff || [])) {
                    console.log('➕ Staff:', staff.name, staff.id);
                    const result = await googleSheetSync.pushStaff(staff);
                    if (result.success) {
                        totalAdded++;
                    } else {
                        totalFailed++;
                    }
                }
            }

            // ========== FORCE PUSH SETTINGS ==========
            if (sel.settings) {
                setGoogleSyncStatus(`📤 Pushing settings (fee structures, etc.)...`);
                console.log('=== FORCE PUSHING SETTINGS ===');

                const result = await googleSheetSync.pushSettings(data.settings, 'admin');
                if (result.success) {
                    totalAdded++;
                    console.log('✅ Settings pushed successfully');
                } else {
                    totalFailed++;
                    console.warn('❌ Failed to push settings:', result.error);
                }
            }

            console.log('=== FORCE PUSH COMPLETE ===');
            console.log('Total Added:', totalAdded, 'Total Failed:', totalFailed);
            
            // DON'T fetch from Google - keep local data as is!
            // This prevents data loss if Google has fewer records
            // User can manually "Get from Google" if they want to pull
            setGoogleSyncStatus('✅ Force push complete! ' + totalAdded + ' records pushed to Google');
            setTimeout(() => setGoogleSyncStatus(''), 8000);
            
            // Save to localStorage
            Storage.save(data);
            console.log('📊 Local data preserved:', data.students?.length, 'students');
            
        } catch (err) {
            console.error('Force push error:', err);
            alert('Force push failed: ' + err.message);
            setGoogleSyncStatus('');
        }
    }, [data, googleSheetSync]);

    // simplified helper for pushing all local changes
    const pushLocalToGoogle = useCallback(async (sheetData) => {
        if (!data?.settings?.googleScriptUrl) return;
        if (syncLock) {
            console.log('⏳ Sync blocked - another sync in progress');
            return false;
        }
        
        const now = Date.now();
        if (now - lastSyncRef.current < SYNC_COOLDOWN) {
            console.log('⏳ Sync blocked - cooldown active');
            return false;
        }
        
        console.log('📤 Syncing all local data to Google Sheet...');
        console.log('📤 Local students to push:', data.students?.length || 0);
        setSyncLock(true);
        lastSyncRef.current = now;
        
        try {
            googleSheetSync.setSettings(data.settings);
            
            // First, get all existing IDs from Google to check for matches
            const existingData = await googleSheetSync.fetchAll();
            const existingStudentIds = new Set((existingData.students || []).map(s => String(s.id)));
            const existingAdmNos = new Set((existingData.students || []).map(s => String(s.admissionNo || '').trim()).filter(Boolean));
            
            console.log('📊 Existing Google student IDs:', existingStudentIds.size);
            console.log('📊 Existing Google admissionNos:', existingAdmNos.size);
            
            let successCount = 0;
            let skipCount = 0;
            
            // Sync students - check for duplicates
            for (const student of (data.students || [])) {
                const localId = String(student.id);
                const localAdmNo = String(student.admissionNo || '').trim();
                
                // Skip if ID or admissionNo already exists
                if (existingStudentIds.has(localId) || (localAdmNo && existingAdmNos.has(localAdmNo))) {
                    console.log('⏭ Skipping duplicate:', localId, localAdmNo);
                    skipCount++;
                    continue;
                }
                
                console.log('➕ Adding student:', student.name, student.id);
                const result = await googleSheetSync.pushStudent(student);
                if (result.success) {
                    successCount++;
                    // Add to existing sets to prevent duplicates within this sync
                    existingStudentIds.add(localId);
                    if (localAdmNo) existingAdmNos.add(localAdmNo);
                } else {
                    console.warn('❌ Failed to add student:', student.name, result.error);
                }
            }
            
            console.log('✅ Sync complete - Added:', successCount, 'Skipped:', skipCount);
            return true;
        } catch (err) {
            console.error('❌ Sync error:', err);
            return false;
        } finally {
            setSyncLock(false);
        }
    }, [data, googleSheetSync, syncLock]);

    const handleGoogleSync = useCallback(async () => {
        if (!data.settings.googleScriptUrl) {
            alert("Google Sheet not configured. Go to Settings > Google Sheet Sync to configure.");
            return;
        }
        
        // Prevent concurrent syncs
        if (isGoogleSyncing) {
            console.log('⏳ Google sync already in progress, skipping...');
            return;
        }
        
        // Check cooldown
        const now = Date.now();
        if (now - lastSyncRef.current < SYNC_COOLDOWN) {
            alert('Please wait a moment before syncing again.');
            return;
        }
        
        setIsGoogleSyncing(true);
        setGoogleSyncStatus('Syncing with Google Sheet...');
        lastSyncRef.current = now;
        
        googleSheetSync.setSettings(data.settings);
        
        try {
            // Fetch ALL data from Google Sheet
            let result = await googleSheetSync.fetchAll();
            
            if (result.success) {
                console.log('Google data raw - students:', result.students?.length, 'assessments:', result.assessments?.length);

                // send any local entries that don't exist yet on sheet
                try {
                    console.log('📤 Pushing local data to Google...');
                    await pushLocalToGoogle(result);
                    console.log('✅ Push to Google completed');
                } catch (pushError) {
                    console.error('❌ Error pushing to Google:', pushError);
                    // Don't stop sync, continue with pull
                }

                // after pushing, re-fetch to get updated sheet state
                result = await googleSheetSync.fetchAll();

                // MERGE local data with Google data (preserve local data, add Google data)
                console.log('🔄 Before merge - local vs Google:', {
                    localStudents: data.students?.length,
                    googleStudents: result.students?.length,
                    localPayments: data.payments?.length,
                    googlePayments: result.payments?.length,
                    localAssessments: data.assessments?.length,
                    googleAssessments: result.assessments?.length
                });
                
                try {
                    // Use mergeData instead of replaceWithGoogleData to preserve local data
                    let merged = { ...data };
                    
                    // Merge students (prefer Google data for duplicates)
                    if (result.students?.length > 0) {
                        merged = Storage.mergeData(merged, { students: result.students }, 'students');
                    }
                    
                    // Merge assessments (prefer Google data for duplicates)
                    if (result.assessments?.length > 0) {
                        merged = Storage.mergeData(merged, { assessments: result.assessments }, 'assessments');
                    }
                    
                    // Merge payments (preserve local payments, add Google ones)
                    if (result.payments?.length > 0) {
                        merged = Storage.mergeData(merged, { payments: result.payments }, 'payments');
                    }
                    
                    // Merge teachers
                    if (result.teachers?.length > 0) {
                        merged = Storage.mergeData(merged, { teachers: result.teachers }, 'teachers');
                    }
                    
                    // Merge staff
                    if (result.staff?.length > 0) {
                        merged = Storage.mergeData(merged, { staff: result.staff }, 'staff');
                    }

                    // Merge settings (Google settings OVERRIDE local settings for fee structures, etc.)
                    if (result.settings && Object.keys(result.settings).length > 0) {
                        console.log('🔄 Overriding local settings with Google settings:', Object.keys(result.settings));
                        // Google settings override local settings
                        merged.settings = {
                            ...result.settings,
                            // Preserve googleScriptUrl from local if Google doesn't have it
                            googleScriptUrl: result.settings.googleScriptUrl || merged.settings.googleScriptUrl
                        };
                    }

                    console.log('✅ After merge - preserved local data:', {
                        students: merged?.students?.length,
                        payments: merged?.payments?.length,
                        assessments: merged?.assessments?.length,
                        settings: Object.keys(merged?.settings || {}).length
                    });

                    setData(merged);
                    Storage.save(merged);
                    setGoogleSyncStatus(`✓ Synced! ${merged.students?.length || 0} students, ${merged.payments?.length || 0} payments (local + Google)`);
                    setTimeout(() => setGoogleSyncStatus(''), 5000);
                } catch (mergeError) {
                    console.error('❌ Error merging data:', mergeError);
                    alert("Data merge failed: " + mergeError.message);
                    setGoogleSyncStatus('');
                }
            } else {
                alert("Sync failed: " + result.error);
                setGoogleSyncStatus('');
            }
        } catch (error) {
            alert("Sync error: " + error.message);
            setGoogleSyncStatus('');
        }
        
        setIsGoogleSyncing(false);
    }, [data, setData, googleSheetSync, pushLocalToGoogle]);

    const handlePullFromGoogle = useCallback(async () => {
        if (!data.settings.googleScriptUrl) {
            alert("Google Sheet not configured. Go to Settings > Google Sheet Sync to configure.");
            return;
        }

        if (isGoogleSyncing) {
            console.log('Google pull already in progress, skipping...');
            return;
        }

        const now = Date.now();
        if (now - lastSyncRef.current < SYNC_COOLDOWN) {
            alert('Please wait a moment before syncing again.');
            return;
        }

        setIsGoogleSyncing(true);
        setGoogleSyncStatus('Loading from Google Sheet...');
        lastSyncRef.current = now;

        googleSheetSync.setSettings(data.settings);

        try {
            const result = await googleSheetSync.fetchAll();

            if (!result.success) {
                alert("Sync failed: " + result.error);
                setGoogleSyncStatus('');
                setIsGoogleSyncing(false);
                return;
            }

            const pulledData = Storage.ensureDataIntegrity(
                Storage.replaceWithGoogleData(
                    {
                        ...data,
                        students: [],
                        assessments: [],
                        attendance: [],
                        payments: [],
                        teachers: [],
                        staff: []
                    },
                    result
                )
            );

            // Override local settings with Google settings (for fee structures, etc.)
            if (result.settings && Object.keys(result.settings).length > 0) {
                console.log('🔄 Overriding local settings with Google settings on pull:', Object.keys(result.settings));
                pulledData.settings = {
                    ...result.settings,
                    // Preserve googleScriptUrl from local if Google doesn't have it
                    googleScriptUrl: result.settings.googleScriptUrl || data.settings.googleScriptUrl
                };
            } else {
                // Fallback to preserving local settings if Google has none
                pulledData.settings = {
                    ...pulledData.settings,
                    googleScriptUrl: data.settings.googleScriptUrl
                };
            }

            console.log('Google pull complete:', {
                students: pulledData.students?.length,
                assessments: pulledData.assessments?.length,
                attendance: pulledData.attendance?.length,
                payments: pulledData.payments?.length,
                teachers: pulledData.teachers?.length,
                staff: pulledData.staff?.length
            });

            setData(pulledData);
            Storage.save(pulledData);
            setGoogleSyncStatus(`✓ Loaded ${pulledData.students?.length || 0} students from Google`);
            setTimeout(() => setGoogleSyncStatus(''), 5000);
        } catch (error) {
            alert("Sync error: " + error.message);
            setGoogleSyncStatus('');
        }

        setIsGoogleSyncing(false);
    }, [data, isGoogleSyncing, setData, googleSheetSync]);

    // when the browser regains connectivity, automatically sync with Google
    // NOTE: Disabled - user must use Force Push to sync data
    useEffect(() => {
        // Auto-sync disabled - imported data stays local
        return () => {};
    }, []);

    // periodic sync every 3 minutes with proper lock check
    // NOTE: Disabled - user controls when to sync via Force Push
    useEffect(() => {
        // Periodic sync disabled - user must use Force Push to sync
        return () => {};
    }, []);

    // FAST SYNC: Push all local data to Google within 30 seconds
    // NOTE: Disabled - user must use Force Push button to sync
    const performFastInitialSync = useCallback(async () => {
        console.log('⚡ Fast sync disabled - use Force Push to sync manually');
        return false;
    }, []);

    // Trigger fast sync within 30 seconds of connection
    // NOTE: Disabled
    useEffect(() => {
        // Fast sync disabled - user controls sync via Force Push
        return () => {};
    }, []);

    useEffect(() => {
        if (!data.settings.googleScriptUrl) return;
        
        const loadCalendar = async () => {
            try {
                console.log('📅 Background loading calendar from Google...');
                googleSheetSync.setSettings(data.settings);
                const result = await googleSheetSync.fetchAll();
                if (result.success && result.calendar) {
                    setData(prev => Storage.replaceWithGoogleData(prev, {
                        calendar: result.calendar
                    }));
                    console.log('📅 Calendar loaded from Google:', result.calendar.length, 'events');
                }
            } catch (error) {
                console.warn('Failed to background load calendar:', error);
            }
        };
        
        loadCalendar();
    }, [data.settings.googleScriptUrl]);

    useEffect(() => {
        console.log('🔄 Auto-load from Google disabled for core data - data stays local');
    }, []);

    useEffect(() => {
        if (!data || !data.settings) return;
        // Apply dynamic theme colors
        const root = document.documentElement;
        root.style.setProperty('--primary-color', data.settings.primaryColor || '#2563eb');
        root.style.setProperty('--secondary-color', data.settings.secondaryColor || '#64748b');

        if (data.settings.theme === 'dark') {
            document.body.classList.add('bg-slate-950', 'text-slate-100');
            document.body.classList.remove('bg-gray-50', 'text-slate-900');
        } else {
            document.body.classList.remove('bg-slate-950', 'text-slate-100');
            document.body.classList.add('bg-gray-50', 'text-slate-900');
        }
    }, [data.settings?.primaryColor, data.settings?.secondaryColor, data.settings?.theme]);

    // Report user activity to Google Sheet for "Active Users" visibility
    useEffect(() => {
        if (!data.settings.googleScriptUrl || !deviceId) return;
        
        console.log('📡 App activity useEffect triggered for:', deviceId);
        googleSheetSync.setSettings(data.settings);
        
        // Report activity immediately and frequently
        const reportActivity = () => {
            console.log('📡 Sending activity update:', deviceId);
            googleSheetSync.setActiveUser(deviceId).then(result => {
                console.log('📡 Activity result:', result);
            });
        };
        
        // Initial report - immediate
        setTimeout(reportActivity, 1000);
        
        // Keep session alive every 30 seconds
        const interval = setInterval(reportActivity, 30000);
        
        // Also report on any user interaction
        const handleInteraction = () => {
            setTimeout(reportActivity, 500);
        };
        window.addEventListener('click', handleInteraction, { passive: true });
        window.addEventListener('keydown', handleInteraction, { passive: true });
        
        return () => {
            clearInterval(interval);
            window.removeEventListener('click', handleInteraction);
            window.removeEventListener('keydown', handleInteraction);
        };
    }, [deviceId, data.settings.googleScriptUrl, isAdmin, teacherSession]);

    const handleLogin = (e) => {
        e.preventDefault();
        const normalizedUsername = loginUsername.trim().toLowerCase();

        if (normalizedUsername === 'admin' && loginPassword === 'admin002') {
            setIsAdmin(true);
            localStorage.setItem('et_is_admin', 'true');
            localStorage.setItem('et_login_username', normalizedUsername);
            setLoginUsername(normalizedUsername);
            setShowLoginModal(false);
            setLoginPassword('');
        } else {
            alert('Invalid Admin Credentials');
        }
    };

    const handleTeacherLogin = (teacherData) => {
        setTeacherSession(teacherData);
        setShowTeacherAuth(false);
        console.log('Teacher logged in:', teacherData.username);
    };

    const handleParentLogin = (parentData) => {
        setParentSession(parentData);
        localStorage.setItem('et_parent_session', JSON.stringify(parentData));
        setShowParentAuth(false);
        setView('parents-dashboard');
        console.log('Parent logged in for:', parentData.admissionNo);
    };

    const handleLogout = () => {
        // Create new session ID for next login
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        localStorage.setItem('et_session_id', newSessionId);
        
        setIsAdmin(false);
        setDeviceId('');
        setLoginUsername('');
        localStorage.removeItem('et_is_admin');
        localStorage.removeItem('et_login_username');
        googleSheetSync.setCurrentUser(null);
        
        // Also logout teacher if logged in
        if (teacherSession) {
            setTeacherSession(null);
            localStorage.removeItem('et_teacher_session');
        }

        if (parentSession) {
            setParentSession(null);
            localStorage.removeItem('et_parent_session');
        }
        
        // Dispatch logout event
        window.dispatchEvent(new Event('edutrack:logout'));
        
        setView('dashboard');
    };

    const openTeacherAuth = () => {
        setShowTeacherAuth(true);
    };

    const navigate = (v, params = null) => {
        if (params?.studentId) {
            setSelectedStudentId(params.studentId);
        }
        setView(v);
        setIsMobileMenuOpen(false);
    };

    const handleAcademicPrintSelect = (id, isBatch = false) => {
        setSelectedStudentId(id);
        if (isBatch) {
            setView('batch-reports');
        } else {
            setView('student-detail');
        }
    };

    const handleGranularExport = (type) => {
        let exportObj = {};
        if (type === 'students') exportObj = { students: data.students };
        if (type === 'assessments') exportObj = { assessments: data.assessments, remarks: data.remarks };
        if (type === 'senior-school') {
            const seniorGrades = ['GRADE 10', 'GRADE 11', 'GRADE 12'];
            exportObj = { students: data.students.filter(s => seniorGrades.includes(s.grade)) };
        }
        if (type === 'academic-full') exportObj = { students: data.students, assessments: data.assessments, remarks: data.remarks };

        const dataStr = JSON.stringify(exportObj, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `edutrack_${type}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleGranularImport = (type) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const incoming = JSON.parse(event.target.result);
                    const merged = Storage.mergeData(data, incoming, type);
                    setData(merged);
                    // Explicitly save to localStorage to ensure data persists
                    Storage.save(merged);
                    console.log(`[Import] ${type} data saved:`, merged.students?.length, 'students');
                    alert(`Successfully integrated ${type} data!`);
                } catch (err) {
                    alert('Error parsing data file.');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    const AcademicTransferUI = ({ type }) => html`
        <div class="flex gap-2 no-print ml-auto">
            <button 
                onClick=${() => handleGranularExport(type)}
                class="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 hover:bg-slate-200"
                title="Export this section's data"
            >
                📤 Export
            </button>
            <button 
                onClick=${() => handleGranularImport(type)}
                class="bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 hover:bg-slate-200"
                title="Import and merge data"
            >
                📥 Import
            </button>
        </div>
    `;

    const renderView = () => {
        switch (view) {
            case 'dashboard': return html`<${Dashboard} data=${data} setData=${setData} googleSyncStatus=${googleSyncStatus} isAdmin=${isAdmin} teacherSession=${teacherSession} />`;
            case 'strategic-reports': return html`<${StrategicReports} data=${data} setData=${setData} isAdmin=${isAdmin} />`;
            case 'batch-reports': {
                const [batchTerm, setBatchTerm] = useState('T1');
                const [batchGrade, setBatchGrade] = useState(selectedStudent?.grade || 'GRADE 1');
                const [batchStream, setBatchStream] = useState(selectedStudent?.stream || 'ALL');
                const streams = data.settings.streams || [];
                
                const gradeStudents = (data.students || []).filter(s => {
                    if (s.grade !== batchGrade) return false;
                    if (batchStream === 'ALL') return true;
                    return s.stream === batchStream;
                });
                
                const gradeLabel = batchGrade + (batchStream !== 'ALL' ? batchStream : '');
                return html`
                    <div class="space-y-8">
                        <div class="flex justify-between items-center no-print bg-white p-4 rounded-xl border mb-6">
                            <button onClick=${() => setView('result-analysis')} class="text-blue-600 font-bold flex items-center gap-1">
                                <span>←</span> Back to Analysis
                            </button>
                            <div class="flex items-center gap-4">
                                <div class="flex flex-col items-center">
                                    <h2 class="font-black">Batch Printing: ${gradeLabel}</h2>
                                    <p class="text-[10px] text-slate-500 uppercase font-bold">${gradeStudents.length} Reports Ready</p>
                                </div>
                            </div>
                            <div class="flex gap-2">
                                <select 
                                    value=${batchGrade}
                                    onChange=${(e) => { setBatchGrade(e.target.value); setBatchStream('ALL'); }}
                                    class="px-3 py-2 border rounded-lg text-sm font-medium"
                                >
                                    ${data.settings.grades.map(g => html`<option value=${g}>${g}</option>`)}
                                </select>
                                <select 
                                    value=${batchStream}
                                    onChange=${(e) => setBatchStream(e.target.value)}
                                    class="px-3 py-2 border rounded-lg text-sm font-medium"
                                >
                                    <option value="ALL">All Streams</option>
                                    ${streams.map(s => html`<option value=${s}>${s}</option>`)}
                                </select>
                                <select 
                                    value=${batchTerm}
                                    onChange=${(e) => setBatchTerm(e.target.value)}
                                    class="px-3 py-2 border rounded-lg text-sm font-medium"
                                >
                                    <option value="T1">Term 1</option>
                                    <option value="T2">Term 2</option>
                                    <option value="T3">Term 3</option>
                                    <option value="FULL">Full Year</option>
                                </select>
                                <${PrintButtons} />
                            </div>
                        </div>
                        <div class="space-y-12">
                            ${gradeStudents.map((s, idx) => html`
                                <div class=${idx > 0 ? 'page-break pt-8' : ''}>
                                    <${StudentDetail} student=${s} data=${data} setData=${setData} isBatch=${true} initialTerm=${batchTerm} isAdmin=${isAdmin} teacherSession=${teacherSession} />
                                </div>
                            `)}
                        </div>
                    </div>
                `;
            }
            case 'students': return html`
                <div class="space-y-4">
                    <div class="flex justify-end"><${AcademicTransferUI} type="students" /></div>
                    <${Students} data=${data} setData=${setData} onSelectStudent=${(id) => navigate('student-detail', { studentId: id })} isAdmin=${isAdmin} teacherSession=${teacherSession} allowedReligion=${allowedTeacherReligion} />
                </div>
            `;
            case 'teachers': return html`<${Teachers} data=${data} setData=${setData} />`;
            case 'staff': return html`<${Staff} data=${data} setData=${setData} />`;
            case 'marklist': return html`
                <div class="space-y-4">
                    <div class="flex justify-end"><${AcademicTransferUI} type="assessments" /></div>
                <${Marklist} data=${data} setData=${setData} isAdmin=${isAdmin} teacherSession=${teacherSession} allowedSubjects=${allowedTeacherSubjects} allowedGrades=${allowedTeacherGrades} allowedReligion=${allowedTeacherReligion} />
                </div>
            `;
            case 'assessments': return html`
                <${Assessments} data=${data} setData=${setData} isAdmin=${isAdmin} teacherSession=${teacherSession} allowedSubjects=${allowedTeacherSubjects} allowedGrades=${allowedTeacherGrades} allowedReligion=${allowedTeacherReligion} />
            `;
            case 'attendance': return html`
                <${Attendance} data=${data} setData=${setData} isAdmin=${isAdmin} teacherSession=${teacherSession} allowedGrades=${allowedTeacherGrades} />
            `;
            case 'senior-school': return html`
                <div class="space-y-4">
                    <div class="flex justify-end"><${AcademicTransferUI} type="senior-school" /></div>
                    <${SeniorSchool} data=${data} setData=${setData} />
                </div>
            `;
            case 'timetable': return html`<${Timetable} data=${data} setData=${setData} isAdmin=${isAdmin} teacherSession=${teacherSession} />`;
            case 'result-analysis': return html`
                <div class="space-y-4">
                    <div class="flex justify-end"><${AcademicTransferUI} type="academic-full" /></div>
                    <${ResultAnalysis} data=${data} onSelectStudent=${handleAcademicPrintSelect} isAdmin=${isAdmin} teacherSession=${teacherSession} allowedSubjects=${allowedTeacherSubjects} allowedGrades=${allowedTeacherGrades} allowedReligion=${allowedTeacherReligion} />
                </div>
            `;
            case 'fees': return html`<${Fees} data=${data} setData=${setData} isAdmin=${isAdmin} teacherSession=${teacherSession} />`;
            case 'fees-register': return html`<${FeesRegister} data=${data} />`;
            case 'fee-reminder': return html`<${FeeReminder} data=${data} />`;
            case 'transport': return html`<${Transport} data=${data} setData=${setData} />`;
            case 'library': return html`<${Library} data=${data} setData=${setData} />`;
            case 'payroll': return html`<${Payroll} data=${data} setData=${setData} />`;
            case 'archives': return html`<${Archives} data=${data} />`;
            case 'settings': return html`<${Settings} data=${data} setData=${setData} />`;
            case 'student-detail': return html`<${StudentDetail} student=${selectedStudent} data=${data} setData=${setData} onBack=${() => setView('students')} isAdmin=${isAdmin} teacherSession=${teacherSession} />`;
            case 'parents-dashboard': return html`<${ParentsDashboard} data=${data} parentSession=${parentSession} setData=${setData} />`;
            case 'school-calendar': return html`<${SchoolCalendar} data=${data} isAdmin=${isAdmin} />`;
            case 'school-analysis': return html`<${SchoolAnalysis} data=${data} setData=${setData} isAdmin=${isAdmin} />`;
            case 'strategic-presentation': return html`<${Presentation} data=${data} />`;
            default: return html`<${Dashboard} data=${data} setData=${setData} googleSyncStatus=${googleSyncStatus} isAdmin=${isAdmin} teacherSession=${teacherSession} parentSession=${parentSession} />`;
        }
    };

    return html`
        <div class=${`flex flex-col h-screen w-full overflow-hidden ${data.settings.theme === 'dark' ? 'dark text-white' : ''}`}>
            
            <style>
                :root {
                    --primary: ${data.settings.primaryColor || '#2563eb'};
                    --secondary: ${data.settings.secondaryColor || '#64748b'};
                }
                .bg-primary { background-color: var(--primary) !important; }
                .text-primary { color: var(--primary) !important; }
                .border-primary { border-color: var(--primary) !important; }
                .focus\:ring-primary:focus { --tw-ring-color: var(--primary) !important; }
                .focus\:border-primary:focus { border-color: var(--primary) !important; }
                
                .bg-secondary { background-color: var(--secondary) !important; }
                .text-secondary { color: var(--secondary) !important; }
                .border-secondary { border-color: var(--secondary) !important; }
                
                /* Override hardcoded blue-600 occurrences for global theme consistency */
                .bg-blue-600 { background-color: var(--primary) !important; }
                .text-blue-600 { color: var(--primary) !important; }
                .border-blue-600 { border-color: var(--primary) !important; }
                .shadow-blue-200 { --tw-shadow-color: var(--primary); shadow: 0 10px 15px -3px var(--primary); }
                
                ${data.settings.theme === 'dark' ? `
                    .bg-white { background-color: #0f172a !important; color: #f1f5f9; }
                    .bg-slate-50 { background-color: #1e293b !important; }
                    .bg-slate-100 { background-color: #334155 !important; }
                    .border-slate-100, .border-slate-50, .border-blue-100 { border-color: #334155 !important; }
                    .text-slate-900 { color: #f8fafc !important; }
                    .text-slate-500, .text-slate-400 { color: #94a3b8 !important; }
                ` : ''}

                /* GLOBAL PRINT STYLES */
                @media print {
                    @page {
                        margin: 10mm;
                    }

                    html, body {
                        width: auto !important;
                        height: auto !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                    }

                    /* Hide header, sidebar, and nav */
                    header,
                    .no-print,
                    [class*="sidebar"],
                    nav,
                    [class*="mobile"] {
                        display: none !important;
                    }

                    /* Main layout for printing */
                    .flex.flex-1.overflow-hidden {
                        display: block !important;
                        flex: none !important;
                        overflow: visible !important;
                    }

                    main {
                        display: block !important;
                        flex: none !important;
                        width: 100% !important;
                        overflow: visible !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    .max-w-6xl {
                        max-width: 100% !important;
                    }

                    /* Preserve colors */
                    [class*="bg-"] {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    [class*="text-"] {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    img {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .rounded-2xl, .rounded-xl, .rounded-lg {
                        border-radius: 0.5rem !important; /* Keep some rounding but subtle */
                    }
                }
            </style>

            
            <header class="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 md:px-8 z-40 no-print">
                <div class="flex items-center gap-3">
                    <button 
                        onClick=${() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        class="md:hidden p-2 hover:bg-slate-100 rounded-lg text-slate-600"
                    >
                        <span class="text-xl">☰</span>
                    </button>
                    <img src="${data.settings.schoolLogo}" class="w-8 h-8 object-contain" />
                    <span class="font-black tracking-tight text-lg hidden sm:block">${data.settings.schoolName}</span>
                </div>
                
                <div class="flex items-center gap-3">
                    <button 
                        onClick=${() => {
                            if (!data.settings.googleScriptUrl) {
                                alert("Google Sheet not configured. Go to Settings > Teacher Data Sync.");
                                return;
                            }
                            handlePullFromGoogle();
                        }}
                        disabled=${isGoogleSyncing}
                        class=${`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all border ${isGoogleSyncing
            ? 'bg-green-50 border-green-200 text-green-600 animate-pulse'
            : googleSyncStatus?.includes('✓')
                ? 'bg-green-100 border-green-300 text-green-700'
                : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-green-500 hover:text-green-600'
        }`}
                    >
                        <span class=${isGoogleSyncing ? 'animate-spin' : ''}>${isGoogleSyncing ? '⏳' : '📥'}</span>
                        <span class="hidden sm:inline">${googleSyncStatus || 'Get from Google'}</span>
                    </button>
                    
                    <button 
                        onClick=${() => {
                            if (!data.settings.googleScriptUrl) {
                                alert("Google Sheet not configured.");
                                return;
                            }
                            // Force immediate sync without cooldown
                            lastSyncRef.current = 0;
                            handleGoogleSync();
                        }}
                        class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all border bg-orange-50 border-orange-200 text-orange-600 hover:bg-orange-100"
                        title="Instant sync - pushes all local data to Google immediately"
                    >
                        <span>⚡</span>
                        <span class="hidden sm:inline">Push to Google</span>
                    </button>

                    <button 
                        onClick=${() => {
                            if (!data.settings.googleScriptUrl) {
                                alert("Google Sheet not configured.");
                                return;
                            }
                            setShowForcePushModal(true);
                        }}
                        disabled=${isGoogleSyncing}
                        class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all border bg-red-50 border-red-200 text-red-600 hover:bg-red-100 disabled:opacity-50"
                        title="Force push selected local data to Google"
                    >
                        <span>🔥</span>
                        <span class="hidden sm:inline">Force Push</span>
                    </button>

                    <div class="h-8 w-px bg-slate-100 mx-1 hidden sm:block"></div>

                    ${isAdmin ? html`
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold uppercase">Admin Mode</span>
                            <button onClick=${handleLogout} class="text-xs font-bold text-red-500 hover:underline uppercase">Logout</button>
                        </div>
                    ` : teacherSession ? html`
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-bold uppercase flex items-center gap-1">
                                <span>👩‍🏫</span>
                                ${teacherSession.name || teacherSession.username}
                            </span>
                            <button onClick=${handleLogout} class="text-xs font-bold text-red-500 hover:underline uppercase">Logout</button>
                        </div>
                    ` : html`
                        <div class="flex items-center gap-2">
                            <button onClick=${openTeacherAuth} class="bg-blue-600 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-sm flex items-center gap-1">
                                <span>👩‍🏫</span>
                                <span class="hidden sm:inline">Teacher Login</span>
                            </button>
                            <button onClick=${() => setShowLoginModal(true)} class="bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm shadow-blue-200">
                                Admin
                            </button>
                        </div>
                    `}
                </div>
            </header>

            <div class="flex flex-1 overflow-hidden">
                <${Sidebar} 
                    currentView=${view} 
                    setView=${setView} 
                    isCollapsed=${sidebarCollapsed} 
                    setCollapsed=${setSidebarCollapsed}
                    isMobileOpen=${isMobileMenuOpen}
                    setIsMobileOpen=${setIsMobileMenuOpen}
                    isAdmin=${isAdmin}
                    teacherSession=${teacherSession}
                    parentSession=${parentSession}
                    onOpenAuth=${openTeacherAuth}
                    onOpenParentAuth=${() => setShowParentAuth(true)}
                />
                <main class="flex-1 overflow-y-auto no-scrollbar pb-20 md:pb-0">
                    <div class="w-full mx-auto p-4 md:p-8">
                        ${!isAuthenticated ? html`
                            <div class="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
                                <div class="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-5xl">
                                    🔒
                                </div>
                                <h2 class="text-2xl font-bold text-slate-700">Welcome to EduTrack</h2>
                                <p class="text-slate-500 max-w-md">Please log in to access the school management system. Use Teacher Login or Admin Login to continue.</p>
                                <div class="flex gap-3 mt-4">
                                    <button 
                                        onClick=${openTeacherAuth} 
                                        class="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"
                                    >
                                        <span>👩‍🏫</span> Teacher Login
                                    </button>
                                    <button 
                                        onClick=${() => setShowParentAuth(true)} 
                                        class="bg-orange-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2"
                                    >
                                        <span>👪</span> Parent Login
                                    </button>
                                    <button 
                                        onClick=${() => setShowLoginModal(true)} 
                                        class="bg-green-600 text-white px-6 py-3 rounded-xl font-bold"
                                    >
                                        🔐 Admin Login
                                    </button>
                                </div>
                                <button 
                                    onClick=${() => setView('dashboard')} 
                                    class="mt-4 text-slate-400 hover:text-slate-600 text-sm"
                                >
                                    Continue to Dashboard →
                                </button>
                            </div>
                        ` : renderView()}
                    </div>
                </main>
            </div>

            
            ${showLoginModal && html`
                <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div class="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 class="text-2xl font-black mb-2">Administrator Login</h3>
                        <p class="text-slate-400 text-sm mb-6">Enter your security credentials to manage sensitive school data.</p>
                        <form onSubmit=${handleLogin} class="space-y-4">
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Username</label>
                                <input 
                                    type="text"
                                    placeholder="Admin username"
                                    class="w-full p-4 bg-slate-50 rounded-2xl border-0 focus:ring-2 focus:ring-primary outline-none"
                                    value=${loginUsername}
                                    onInput=${e => setLoginUsername(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Password</label>
                                <input 
                                    type="password"
                                    placeholder="Admin password"
                                    class="w-full p-4 bg-slate-50 rounded-2xl border-0 focus:ring-2 focus:ring-primary outline-none"
                                    value=${loginPassword}
                                    onInput=${e => setLoginPassword(e.target.value)}
                                />
                            </div>
                            <button type="submit" class="w-full bg-primary text-white py-4 rounded-2xl font-black text-sm shadow-lg">
                                Sign In
                            </button>
                            <button type="button" onClick=${() => setShowLoginModal(false)} class="w-full text-slate-400 py-2 text-sm">
                                Cancel
                            </button>
                        </form>
                    </div>
                </div>
            `}

            
            ${showTeacherAuth && html`
                <${TeacherAuth} 
                    settings=${data.settings}
                    data=${data}
                    setData=${setData}
                    onLogin=${handleTeacherLogin}
                    onClose=${() => setShowTeacherAuth(false)}
                />
            `}

            
            ${showParentAuth && html`
                <${ParentAuth} 
                    onLogin=${handleParentLogin}
                    onClose=${() => setShowParentAuth(false)}
                />
            `}

            
            ${showForcePushModal && html`
                <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div class="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-xl font-black text-red-600">🔥 Force Push to Google</h3>
                            <button onClick=${() => setShowForcePushModal(false)} class="text-2xl text-slate-300 hover:text-slate-500">&times;</button>
                        </div>
                        
                        <p class="text-sm text-slate-500 mb-4">Select data types to push to Google Sheet:</p>
                        
                        <div class="space-y-3 mb-6">
                            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-red-50 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked=${forcePushSelection.students}
                                    onChange=${e => setForcePushSelection({...forcePushSelection, students: e.target.checked})}
                                    class="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                                />
                                <div class="flex-1">
                                    <span class="font-bold text-slate-700">👥 Students</span>
                                    <span class="text-xs text-slate-400 ml-2">(${data.students?.length || 0} records)</span>
                                </div>
                            </label>
                            
                            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-red-50 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked=${forcePushSelection.assessments}
                                    onChange=${e => setForcePushSelection({...forcePushSelection, assessments: e.target.checked})}
                                    class="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                                />
                                <div class="flex-1">
                                    <span class="font-bold text-slate-700">📝 Assessments</span>
                                    <span class="text-xs text-slate-400 ml-2">(${data.assessments?.length || 0} records)</span>
                                </div>
                            </label>
                            
                            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-red-50 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked=${forcePushSelection.payments}
                                    onChange=${e => setForcePushSelection({...forcePushSelection, payments: e.target.checked})}
                                    class="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                                />
                                <div class="flex-1">
                                    <span class="font-bold text-slate-700">💰 Payments</span>
                                    <span class="text-xs text-slate-400 ml-2">(${data.payments?.length || 0} records)</span>
                                </div>
                            </label>
                            
                            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-red-50 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked=${forcePushSelection.teachers}
                                    onChange=${e => setForcePushSelection({...forcePushSelection, teachers: e.target.checked})}
                                    class="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                                />
                                <div class="flex-1">
                                    <span class="font-bold text-slate-700">👨‍🏫 Teachers</span>
                                    <span class="text-xs text-slate-400 ml-2">(${data.teachers?.length || 0} records)</span>
                                </div>
                            </label>
                            
                            <label class="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer hover:bg-red-50 transition-colors">
                                <input
                                    type="checkbox"
                                    checked=${forcePushSelection.staff}
                                    onChange=${e => setForcePushSelection({...forcePushSelection, staff: e.target.checked})}
                                    class="w-5 h-5 text-red-600 rounded focus:ring-red-500"
                                />
                                <div class="flex-1">
                                    <span class="font-bold text-slate-700">👷 Staff</span>
                                    <span class="text-xs text-slate-400 ml-2">(${data.staff?.length || 0} records)</span>
                                </div>
                            </label>

                            <label class="flex items-center gap-3 p-3 bg-orange-50 rounded-xl cursor-pointer hover:bg-orange-100 transition-colors border border-orange-200">
                                <input
                                    type="checkbox"
                                    checked=${forcePushSelection.settings}
                                    onChange=${e => {
                                        console.log('[ForcePush Modal] Settings checkbox changed:', e.target.checked);
                                        setForcePushSelection({...forcePushSelection, settings: e.target.checked});
                                    }}
                                    class="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                                />
                                <div class="flex-1">
                                    <span class="font-bold text-slate-700">⚙️ Settings</span>
                                    <span class="text-xs text-slate-400 ml-2">(fee structures, school info, etc.)</span>
                                </div>
                            </label>
                        </div>
                        
                        <div class="flex gap-3">
                            <button 
                                onClick=${() => setShowForcePushModal(false)}
                                class="flex-1 py-3 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick=${() => forcePushToGoogle(forcePushSelection)}
                                class="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
                            >
                                🚀 Push Now
                            </button>
                        </div>
                    </div>
                </div>
            `}
        </div>
    `;
};

try {
    render(html`<${App} />`, document.getElementById('app'));
} catch (error) {
    console.error('App render failed:', error);
    const root = document.getElementById('app');
    if (root) {
        root.innerHTML = `
            <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#f8fafc;font-family:Inter,sans-serif;">
                <div style="max-width:760px;width:100%;background:#fff;border:1px solid #fecaca;border-radius:16px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,0.08);">
                    <h1 style="margin:0 0 12px;font-size:20px;font-weight:800;color:#991b1b;">Application Failed To Render</h1>
                    <pre style="margin:0;white-space:pre-wrap;word-break:break-word;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px;color:#9a3412;font-size:12px;overflow:auto;">${error?.stack || error?.message || String(error)}</pre>
                </div>
            </div>
        `;
    }
}
