import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { googleSheetSync } from '../lib/googleSheetSync.js';
import { Pagination } from '../lib/pagination.js';
import { PaginationControls } from './Pagination.js';
import { PrintButtons } from './PrintButtons.js';
import { PhotoGallery } from './PhotoGallery.js';
import { resizeImage, fileToDataUrl } from '../lib/imageUtils.js';

const html = htm.bind(h);

export const Students = ({ data, setData, onSelectStudent, isAdmin, teacherSession, allowedReligion }) => {
    // Ensure we always have valid data from props - force refresh when data changes
    const studentsData = data?.students || [];
    const paymentsData = data?.payments || [];
    const assessmentsData = data?.assessments || [];
    const settingsData = data?.settings || {};

    const [showAdd, setShowAdd] = useState(false);
    const [showPhotoGallery, setShowPhotoGallery] = useState(false);
    const [syncStatus, setSyncStatus] = useState('');
    const [filterGrade, setFilterGrade] = useState('ALL');
    const [filterStream, setFilterStream] = useState('ALL');
    const [filterFinance, setFilterFinance] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState('all'); // Show ALL by default
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [bypassFilters, setBypassFilters] = useState(false);
    
    const STUDENTS_PER_PAGE = 100; // Show 100 per page
    
    console.log('[Students] Rendering with data:', studentsData.length, 'students');
    console.log('[Students] Filter status:', filterStatus, 'Grade:', filterGrade, 'Stream:', filterStream, 'Religion:', allowedReligion);

    // Track activity helper - NOW HANDLED PROPERLY WITH DEDUPLICATION
    const trackActivity = async (action, student) => {
        if (!data.settings?.googleScriptUrl) return;
        
        // Prevent duplicate tracking - check if same action in last 3 seconds
        const now = Date.now();
        if (trackActivity.lastCall && now - trackActivity.lastCall < 3000) {
            return;
        }
        trackActivity.lastCall = now;
        
        try {
            googleSheetSync.setSettings(data.settings);
            const result = await googleSheetSync.trackActivity(
                action,
                'Students',
                student.id,
                student.name,
                `${student.grade} - ${student.stream || 'No Stream'} | ${student.admissionNo || 'No Adm No.'}`
            );
            console.log('[Activity] Tracked:', action, student.name, result);
        } catch (err) {
            console.warn('Activity tracking failed:', err.message, err.stack);
        }
    };

    // Reset to page 1 when data changes
    useEffect(() => {
        setCurrentPage(1);
    }, [data.students?.length]);

    // Auto-check for remote deletions on load (with delay to let initial data load)
    useEffect(() => {
        if (!data.settings?.googleScriptUrl || !data.students?.length) return;
        
        const checkRemoteDeletions = async () => {
            try {
                googleSheetSync.setSettings(data.settings);
                const deletionInfo = await googleSheetSync.detectDeletions('Students', data.students || []);
                
                if (deletionInfo.deletionCount > 0) {
                    // SAFETY CHECK: Don't delete ALL students - that's a bug, not a deletion
                    if (deletionInfo.deletionCount >= data.students.length) {
                        console.error('🚨 SAFETY BLOCK: Detected deletions would remove ALL students. Aborting.', {
                            localCount: data.students.length,
                            deletionCount: deletionInfo.deletionCount
                        });
                        alert('⚠️ Sync Warning: Google Sheet check would delete all students.\nThis is likely a fetch error, not actual deletions.\nStudents have been preserved.');
                        return;
                    }
                    
                    // Students were deleted in the sheet, remove them from local
                    const updatedStudents = data.students.filter(s => !deletionInfo.deletedIds.includes(String(s.id)));
                    const updatedAssessments = (data.assessments || []).filter(a => 
                        !deletionInfo.deletedIds.includes(String(a.studentId))
                    );
                    
                    setData(prev => ({ ...prev, students: updatedStudents, assessments: updatedAssessments }));
                    setSyncStatus(`✓ Synced! Removed ${deletionInfo.deletionCount} deleted student(s) from Sheet`);
                    setTimeout(() => setSyncStatus(''), 5000);
                }
            } catch (e) {
                console.warn('Auto deletion sync failed:', e);
            }
        };
        
        // Check after 5 seconds to let initial data load
        const timer = setTimeout(checkRemoteDeletions, 5000);
        return () => clearTimeout(timer);
    }, [data.settings?.googleScriptUrl, data.students?.length]);

    // Get hidden fee items from settings (per grade group)
    const hiddenFeeItems = data.settings?.hiddenFeeItems || {};
    const allHiddenFees = Object.values(hiddenFeeItems).flat();

    // Filter out hidden fee items
    const defaultFeeOptions = [
        { key: 'admission', label: 'Admission' }, { key: 'diary', label: 'Diary' }, { key: 'development', label: 'Development' },
        { key: 't1', label: 'T1 Tuition' }, { key: 't2', label: 'T2 Tuition' }, { key: 't3', label: 'T3 Tuition' },
        { key: 'boarding', label: 'Boarding' }, { key: 'breakfast', label: 'Breakfast' }, { key: 'lunch', label: 'Lunch' },
        { key: 'trip', label: 'Trip' }, { key: 'bookFund', label: 'Books' }, { key: 'caution', label: 'Caution' },
        { key: 'uniform', label: 'Uniform' }, { key: 'studentCard', label: 'School ID' }, { key: 'remedial', label: 'Remedials' },
        { key: 'assessmentFee', label: 'Assessment Fee' }, { key: 'projectFee', label: 'Project Fee' },
        { key: 'activityFees', label: 'Activity Fees' }, { key: 'tieAndBadge', label: 'Tie & Badge' }, { key: 'academicSupport', label: 'Academic Support' },
        { key: 'pta', label: 'PTA' }
    ].filter(opt => !allHiddenFees.includes(opt.key));

    const customFeeOptions = (data.settings.customFeeColumns || []).map(cf => ({ key: cf.key, label: cf.label }));
    const customFeeOptionsFiltered = customFeeOptions.filter(opt => !allHiddenFees.includes(opt.key));
    const feeOptions = [...defaultFeeOptions, ...customFeeOptionsFiltered];

    // Helper function to get default fees excluding hidden ones
    const getDefaultFees = () => {
        const defaultFeeKeys = ['t1', 't2', 't3', 'admission', 'diary', 'development', 'pta'];
        return defaultFeeKeys.filter(key => !allHiddenFees.includes(key));
    };

    // Helper function to filter out hidden fees from a fee array
    const filterHiddenFees = (fees) => {
        if (!Array.isArray(fees)) return getDefaultFees();
        return fees.filter(key => !allHiddenFees.includes(key));
    };

    const [editingId, setEditingId] = useState(null);
    const streams = data.settings.streams || ['A', 'B', 'C'];

    const [newStudent, setNewStudent] = useState({
        name: '',
        grade: data.settings.grades[0] || 'GRADE 1',
        stream: streams[0] || '',
        category: 'Normal',
        admissionNo: '',
        admissionDate: new Date().toISOString().slice(0, 10),
        assessmentNo: '',
        upiNo: '',
        parentContact: '',
        previousArrears: 0,
        selectedFees: getDefaultFees(),
        portrait: ''
    });

    const handleAdd = async (e) => {
        e.preventDefault();

        if (editingId) {
            const filteredStudent = { ...newStudent, id: editingId, selectedFees: filterHiddenFees(newStudent.selectedFees) };
            const oldStudent = data.students.find(s => s.id === editingId);
            const updated = data.students.map(s => s.id === editingId ? filteredStudent : s);

            setData({ ...data, students: updated });
            setEditingId(null);

            // Save photo to gallery if portrait exists
            savePhotoToGallery(filteredStudent);

            if (data.settings.googleScriptUrl) {
                setSyncStatus('Updating Google Sheet...');
                googleSheetSync.setSettings(data.settings);
                // Ensure we pass the student list for enrichment if needed
                googleSheetSync.setStudents(data.students);
                const syncResult = await googleSheetSync.pushStudent(filteredStudent);
                if (syncResult.success) {
                    trackActivity('EDIT', filteredStudent);
                    setSyncStatus('✓ Updated in Sheet!');
                } else {
                    console.error('Sync failed:', syncResult.error);
                    setSyncStatus('⚠ Sync failed: ' + (syncResult.error || 'Unknown error'));
                }
                setTimeout(() => setSyncStatus(''), 3000);
            }
        } else {
            const id = Date.now().toString();
            const newStudentWithId = { ...newStudent, id, selectedFees: filterHiddenFees(newStudent.selectedFees) };

            console.log('[Students] Adding new student:', newStudentWithId.name, 'ID:', id);
            console.log('[Students] Google Script URL configured:', !!data.settings.googleScriptUrl);

            setData({ ...data, students: [...(data.students || []), newStudentWithId] });

            // Save photo to gallery if portrait exists
            savePhotoToGallery(newStudentWithId);

            if (data.settings.googleScriptUrl) {
                setSyncStatus('Syncing to Google...');
                googleSheetSync.setSettings(data.settings);
                googleSheetSync.setStudents([...(data.students || []), newStudentWithId]);
                console.log('[Students] Attempting to sync student to sheet...');
                const syncResult = await googleSheetSync.pushStudent(newStudentWithId);
                console.log('[Students] Sync result:', syncResult);
                if (syncResult.success) {
                    trackActivity('ADD', newStudentWithId);
                    setSyncStatus('✓ Synced!');
                } else {
                    console.error('Sync failed:', syncResult.error);
                    setSyncStatus('⚠ Sync failed: ' + (syncResult.error || 'Unknown error'));
                    alert('Sync to Google Sheet failed: ' + (syncResult.error || 'Unknown error'));
                }
                setTimeout(() => setSyncStatus(''), 5000);
            } else {
                console.warn('[Students] Google Script URL not configured - student saved locally only');
                setSyncStatus('⚠ Saved locally (no Google Sheet configured)');
                setTimeout(() => setSyncStatus(''), 3000);
            }
        }
        setShowAdd(false);
        resetForm();
    };

    const resetForm = () => {
        setNewStudent({
            name: '',
            grade: data.settings.grades[0] || 'GRADE 1',
            category: 'Normal',
            admissionNo: '',
            assessmentNo: '',
            upiNo: '',
            parentContact: '',
            stream: streams[0] || '',
            previousArrears: 0,
            selectedFees: getDefaultFees(),
            religion: '',
            portrait: ''
        });
        setEditingId(null);
    };

    const handleEdit = (student) => {
        // Filter out hidden fees from student's selectedFees
        const filteredFees = filterHiddenFees(student.selectedFees);
        setNewStudent({ ...student, category: student.category || 'Normal', selectedFees: filteredFees });
        setEditingId(student.id);
        setShowAdd(true);
    };

    // Handle marking student as left/active
    const handleToggleStatus = async (student) => {
        const newStatus = student.status === 'left' ? 'active' : 'left';
        const confirmMsg = newStatus === 'left' 
            ? `Mark ${student.name} as "Left"? They will remain on the school register but won't appear in daily attendance.`
            : `Mark ${student.name} as "Active"? They will appear in daily attendance again.`;
            
        if (!confirm(confirmMsg)) return;

        const updatedStudents = data.students.map(s => 
            s.id === student.id ? { ...s, status: newStatus, leftDate: newStatus === 'left' ? new Date().toISOString().split('T')[0] : null } : s
        );
        
        setData({ ...data, students: updatedStudents });
        
        // Sync to Google Sheet if configured
        if (data.settings.googleScriptUrl) {
            setSyncStatus(`Updating status on Sheet...`);
            googleSheetSync.setSettings(data.settings);
            try {
                // Push the updated student record
                const updatedStudent = updatedStudents.find(s => s.id === student.id);
                await googleSheetSync.pushStudent(updatedStudent);
                setSyncStatus(`✓ Status updated!`);
            } catch (e) {
                console.error('Status update error:', e);
                setSyncStatus('⚠ Updated locally, sync failed');
            }
            setTimeout(() => setSyncStatus(''), 3000);
        }
    };

    const handlePromote = (student) => {
        const grades = data.settings.grades;
        const currentIndex = grades.indexOf(student.grade);

        if (currentIndex === -1 || currentIndex === grades.length - 1) {
            alert("No further grade to promote to.");
            return;
        }

        const nextGrade = grades[currentIndex + 1];
        if (!confirm(`Promote ${student.name} to ${nextGrade}? Current balance will be carried as arrears.`)) return;

        // Calculate current balance
        const financials = Storage.getStudentFinancials(student, data.payments, data.settings);

        const updatedStudents = data.students.map(s => {
            if (s.id === student.id) {
                return {
                    ...s,
                    grade: nextGrade,
                    previousArrears: financials.balance,
                    // We don't reset selectedFees, user might want to edit them
                };
            }
            return s;
        });

        setData({ ...data, students: updatedStudents });
        alert(`${student.name} promoted to ${nextGrade}. Arrears: ${data.settings.currency} ${financials.balance.toLocaleString()}`);
    };

    const handleDelete = async (id) => {
        const student = data.students.find(s => String(s.id) === String(id));
        if (!student) return;

        if (!confirm(`Delete ${student.name}? This will remove them from local data and Google Sheet.`)) return;

        // Delete assessments for this student locally first
        const updatedAssessments = (data.assessments || []).filter(a => String(a.studentId) !== String(id));
        
        // Remove locally (both student and their assessments)
        setData({ ...data, students: data.students.filter(s => String(s.id) !== String(id)), assessments: updatedAssessments });

        // Delete from Google Sheet
        if (data.settings.googleScriptUrl) {
            setSyncStatus('Deleting from Sheet...');
            googleSheetSync.setSettings(data.settings);
            try {
                const result = await googleSheetSync.deleteStudent(id);
                trackActivity('DELETE', student);
                
                const studentAssessments = (data.assessments || []).filter(a => String(a.studentId) === String(id));
                for (const assess of studentAssessments) {
                    await googleSheetSync.deleteAssessment(assess.id);
                }
                
                setSyncStatus(result.success ? '✓ Deleted from Sheet!' : '⚠ Deleted locally, Sheet error: ' + (result.error || ''));
            } catch (e) {
                console.error('Delete error:', e);
                setSyncStatus('⚠ Deleted locally, error: ' + e.message);
            }
            setTimeout(() => setSyncStatus(''), 5000);
        }
    };

    // Detect and sync deletions made in Google Sheet
    const handleSyncDeletions = async () => {
        if (!data.settings.googleScriptUrl) {
            setSyncStatus('⚠ Google Sheet not connected');
            setTimeout(() => setSyncStatus(''), 2000);
            return;
        }

        setSyncStatus('Checking for remote deletions...');
        googleSheetSync.setSettings(data.settings);
        
        try {
            const deletionInfo = await googleSheetSync.detectDeletions('Students', data.students || []);
            
            if (deletionInfo.deletionCount > 0) {
                // Students were deleted in the sheet, remove them from local data
                const updatedStudents = data.students.filter(s => !deletionInfo.deletedIds.includes(String(s.id)));
                
                // Also remove related assessments for deleted students
                const updatedAssessments = (data.assessments || []).filter(a => 
                    !deletionInfo.deletedIds.includes(String(a.studentId))
                );
                
                setSyncStatus(`✓ Synced! Removed ${deletionInfo.deletionCount} deleted student(s)`);
                setData(prev => ({ ...prev, students: updatedStudents, assessments: updatedAssessments }));
            } else {
                setSyncStatus('✓ No remote changes detected');
            }
            
            setTimeout(() => setSyncStatus(''), 3000);
        } catch (error) {
            console.error('Sync error:', error);
            setSyncStatus('⚠ Sync check failed - please try again');
            setTimeout(() => setSyncStatus(''), 3000);
        }
    };

    const toggleFee = (key) => {
        // Don't allow toggling hidden fees
        if (allHiddenFees.includes(key)) return;

        const current = newStudent.selectedFees || [];
        const updated = current.includes(key)
            ? current.filter(k => k !== key)
            : [...current, key];
        setNewStudent({ ...newStudent, selectedFees: updated });
    };

    const handlePortraitUpload = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                // Convert file to data URL
                const dataUrl = await fileToDataUrl(file);
                console.log('[Students] Original image size:', Math.round(dataUrl.length / 1024), 'KB');

                // Auto-resize to recommended size
                const resizedDataUrl = await resizeImage(dataUrl, {
                    width: 300,
                    height: 400,
                    maxWidth: 500,
                    maxHeight: 600,
                    quality: 0.8
                });
                console.log('[Students] Resized image size:', Math.round(resizedDataUrl.length / 1024), 'KB');

                setNewStudent({ ...newStudent, portrait: resizedDataUrl });
            } catch (error) {
                console.error('[Students] Portrait upload error:', error);
                alert('Failed to process portrait image. Please try a different image.');
            }
        }
    };

    // Helper function to save photo to gallery
    const savePhotoToGallery = (student) => {
        if (!student.portrait) return;

        try {
            const storedGallery = localStorage.getItem('et_photo_gallery');
            let photos = storedGallery ? JSON.parse(storedGallery) : [];

            // Check if photo already exists for this student
            const existingIndex = photos.findIndex(p => p.studentId === student.id);

            const photoEntry = {
                studentId: student.id,
                name: student.name,
                grade: student.grade,
                stream: student.stream,
                admissionNo: student.admissionNo,
                portrait: student.portrait,
                updatedAt: new Date().toISOString()
            };

            if (existingIndex >= 0) {
                photos[existingIndex] = photoEntry;
            } else {
                photos.push(photoEntry);
            }

            localStorage.setItem('et_photo_gallery', JSON.stringify(photos));
            console.log('[Students] Photo saved to gallery:', student.name);
        } catch (error) {
            console.error('[Students] Gallery save error:', error);
        }
    };

    // RESTORED: Original working filter logic with null safety
    const filteredStudents = bypassFilters 
        ? studentsData 
        : studentsData.filter(s => {
            const searchLower = searchTerm ? searchTerm.toLowerCase() : '';
            const matchesSearch = !searchTerm ||
                (s.name && s.name.toLowerCase().includes(searchLower)) ||
                (s.admissionNo && s.admissionNo.toLowerCase().includes(searchLower)) ||
                (s.grade && s.grade.toLowerCase().includes(searchLower)) ||
                (s.stream && s.stream.toLowerCase().includes(searchLower)) ||
                (s.parentContact && String(s.parentContact).includes(searchTerm));

            if (!matchesSearch) {
                if (searchTerm && studentsData.indexOf(s) < 3) console.log(`[Filter Debug] ${s.name} rejected by search: "${searchTerm}"`);
                return false;
            }

            const matchesGrade = filterGrade === 'ALL' || s.grade === filterGrade;
            if (!matchesGrade) {
                if (studentsData.indexOf(s) < 3) console.log(`[Filter Debug] ${s.name} rejected by grade: ${s.grade} != ${filterGrade}`);
                return false;
            }

            const matchesStream = filterStream === 'ALL' || s.stream === filterStream;
            if (!matchesStream) {
                if (studentsData.indexOf(s) < 3) console.log(`[Filter Debug] ${s.name} rejected by stream: ${s.stream} != ${filterStream}`);
                return false;
            }

            const matchesReligion = !allowedReligion || !s.religion || (s.religion && s.religion.toLowerCase() === allowedReligion.toLowerCase());
            if (!matchesReligion) {
                if (studentsData.indexOf(s) < 3) console.log(`[Filter Debug] ${s.name} rejected by religion: ${s.religion} != ${allowedReligion}`);
                return false;
            }
            
            // Status filter: active, left, or all
            const studentStatus = s.status || 'active';
            const matchesStatus = filterStatus === 'all' || studentStatus === filterStatus;
            if (!matchesStatus) {
                if (studentsData.indexOf(s) < 3) console.log(`[Filter Debug] ${s.name} rejected by status: ${studentStatus} != ${filterStatus}`);
                return false;
            }

            if (filterFinance === 'ALL') return true;

            const feeStructure = settingsData.feeStructures?.find(f => f.grade === s.grade);
            const selectedKeys = s.selectedFees || ['t1', 't2', 't3'];
            const totalDue = (Number(s.previousArrears) || 0) + (feeStructure ? selectedKeys.reduce((sum, key) => sum + (feeStructure[key] || 0), 0) : 0);
            const totalPaid = paymentsData.filter(p => String(p.studentId) === String(s.id) && !p.voided).reduce((sum, p) => sum + Number(p.amount), 0);
            const balance = totalDue - totalPaid;

            if (filterFinance === 'FULL') return balance <= 0 && totalDue > 0;
            if (filterFinance === 'HALF') return totalPaid >= (totalDue / 2) && balance > 0;
            if (filterFinance === 'ARREARS') return balance > 0;

            return true;
        });
    
    console.log(`[Students] Filtered: ${filteredStudents.length} of ${studentsData.length} students`);

    // Simple pagination - just slice the array
    const safeFilteredStudents = filteredStudents || [];
    
    // Show 100 students per page to show more data
    const startIndex = (currentPage - 1) * STUDENTS_PER_PAGE;
    const paginatedStudents = safeFilteredStudents.slice(startIndex, startIndex + STUDENTS_PER_PAGE);
    
    console.log(`[Students] Table render: ${safeFilteredStudents.length} total, showing ${startIndex + 1}-${Math.min(startIndex + STUDENTS_PER_PAGE, safeFilteredStudents.length)} on page ${currentPage}`);

    return html`
        <div class="space-y-6">
            
            <div style="background: #e0f2fe; border: 2px solid #0284c7; padding: 10px; border-radius: 8px; margin-bottom: 10px; font-size: 11px;">
                <strong>📊 Data Status:</strong> Total: ${studentsData.length} students<br/>
                <strong>Page:</strong> ${currentPage} | Showing: ${startIndex + 1}-${Math.min(startIndex + STUDENTS_PER_PAGE, safeFilteredStudents.length)} of ${safeFilteredStudents.length}<br/>
                <button onClick=${() => setCurrentPage(Math.max(1, currentPage - 1))} style="padding: 4px 8px; margin-right: 5px; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer;">◀ Prev</button>
                <button onClick=${() => setCurrentPage(currentPage + 1)} style="padding: 4px 8px; margin-right: 5px; background: #0284c7; color: white; border: none; border-radius: 4px; cursor: pointer;">Next ▶</button>
                <button onClick=${() => setCurrentPage(1)} style="padding: 4px 8px; background: #16a34a; color: white; border: none; border-radius: 4px; cursor: pointer;">First Page</button>
            </div>
            
            
            ${(data.students || []).length === 0 && html`
                <div style="background: #fef3c7; border: 2px solid #f59e0b; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <strong>⚠️ CRITICAL: No students in data!</strong><br/>
                    Total students: ${(data.students || []).length}<br/>
                    Your data may have been cleared or not loaded properly.<br/>
                    <div style="margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap;">
                        <button onClick=${() => {
                            // Inject sample students
                            const sampleStudents = [
                                { id: '1', name: 'John Doe', grade: 'GRADE 1', admissionNo: '2024/001', admissionDate: '2024-01-10', assessmentNo: 'ASN-001', upiNo: 'UPI-789X', stream: 'North', parentContact: '0711222333', selectedFees: ['t1', 't2', 't3', 'bookFund', 'caution', 'studentCard'], status: 'active' },
                                { id: '2', name: 'Jane Smith', grade: 'GRADE 2', admissionNo: '2024/002', admissionDate: '2024-02-15', assessmentNo: 'ASN-002', upiNo: 'UPI-456Y', stream: 'South', parentContact: '0722333444', selectedFees: ['t1', 't2', 't3', 'breakfast', 'lunch'], status: 'active' }
                            ];
                            const newData = { ...data, students: sampleStudents };
                            setData(newData);
                            Storage.save(newData);
                            alert('✅ Sample students added! Refresh the page if needed.');
                        }} style="padding: 8px 16px; background: #16a34a; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                            ➕ Add Sample Students
                        </button>
                        ${data.settings?.googleScriptUrl && html`
                            <button onClick=${() => {
                                // Trigger sync from Google
                                window.location.reload();
                            }} style="padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                                🔄 Sync from Google Sheet
                            </button>
                        `}
                        <button onClick=${() => { localStorage.clear(); location.reload(); }} style="padding: 8px 16px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            🗑️ Clear All & Reset
                        </button>
                    </div>
                </div>
            `}
            ${(data.students || []).length > 0 && safeFilteredStudents.length === 0 && html`
                <div style="background: #fee2e2; border: 2px solid #dc2626; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <strong>🚨 DEBUG: Students exist but filtered out!</strong><br/>
                    Total: ${(data.students || []).length} | Filtered: ${safeFilteredStudents.length}<br/>
                    Current filterStatus: ${filterStatus}<br/>
                    <div style="margin-top: 10px; display: flex; gap: 10px;">
                        <button onClick=${() => setBypassFilters(true)} style="padding: 8px 16px; background: #16a34a; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                            🚑 EMERGENCY: Show All Students
                        </button>
                        <button onClick=${() => { localStorage.clear(); location.reload(); }} style="padding: 8px 16px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Clear & Reset
                        </button>
                    </div>
                </div>
            `}
            ${bypassFilters && html`
                <div style="background: #fef3c7; border: 2px solid #f59e0b; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <strong>⚠️ BYPASS MODE ACTIVE</strong> - Showing all ${(data.students || []).length} students without filters<br/>
                    <button onClick=${() => setBypassFilters(false)} style="margin-top: 10px; padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Restore Filters
                    </button>
                </div>
            `}
            ${paginatedStudents.length > 0 && html`
                <div style="background: #dcfce7; border: 2px solid #16a34a; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <strong>✅ DEBUG: Data found!</strong><br/>
                    Showing ${paginatedStudents.length} of ${safeFilteredStudents.length} students (Page ${currentPage})
                </div>
            `}
            
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 class="text-2xl font-bold">Students Directory</h2>
                    <p class="text-slate-500 text-sm">
                        ${(data.students || []).length} total students
                        ${searchTerm ? ` | ${safeFilteredStudents.length} matches` : ''}
                    </p>
                </div>
                ${syncStatus && html`
                    <span class="text-xs font-bold ${syncStatus.includes('✓') ? 'text-green-600' : 'text-blue-600'}">${syncStatus}</span>
                `}
                <div class="flex flex-wrap gap-2 no-print w-full md:w-auto">
                    <div class="relative">
                        <input 
                            type="text"
                            placeholder="Search name, admission, contact..."
                            class="bg-white border border-slate-200 text-slate-600 px-4 py-2 pl-10 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
                            value=${searchTerm}
                            onInput=${(e) => setSearchTerm(e.target.value)}
                        />
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                    </div>
                    <select 
                        class="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                        value=${filterGrade}
                        onChange=${(e) => setFilterGrade(e.target.value)}
                    >
                        <option value="ALL">All Grades</option>
                        ${data.settings.grades.map(g => html`<option value=${g}>${g}</option>`)}
                    </select>
                    <select 
                        class="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                        value=${filterStream}
                        onChange=${(e) => setFilterStream(e.target.value)}
                    >
                        <option value="ALL">All Streams</option>
                        ${streams.map(s => html`<option value=${s}>Stream ${s}</option>`)}
                    </select>
                    <select 
                        class="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                        value=${filterFinance}
                        onChange=${(e) => setFilterFinance(e.target.value)}
                    >
                        <option value="ALL">All Payments</option>
                        <option value="FULL">Full Fees Paid</option>
                        <option value="HALF">Half Fees Paid+</option>
                        <option value="ARREARS">With Arrears</option>
                    </select>
                    <select 
                        class="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                        value=${filterStatus}
                        onChange=${(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="all">All Students</option>
                        <option value="active">Active Only</option>
                        <option value="left">Left Only</option>
                    </select>
                    <button 
                        onClick=${() => {
                            setFilterGrade('ALL');
                            setFilterStream('ALL');
                            setFilterFinance('ALL');
                            setFilterStatus('all');
                            setSearchTerm('');
                            setCurrentPage(1);
                            console.log('[Students] Filters reset to show all');
                        }}
                        class="bg-orange-100 text-orange-700 px-3 py-2 rounded-xl text-sm font-bold hover:bg-orange-200 border border-orange-200"
                        title="Reset all filters to show every student"
                    >
                        🔄 Reset
                    </button>
                    <button 
                        onClick=${() => setBypassFilters(!bypassFilters)}
                        class=${`px-3 py-2 rounded-xl text-sm font-bold border ${bypassFilters ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}`}
                        title=${bypassFilters ? 'Disable bypass mode - apply filters' : 'Bypass all filters - show all students'}
                    >
                        ${bypassFilters ? '✓ Filters Bypassed' : 'Bypass Filters'}
                    </button>
                    <${PrintButtons} />
                    <button
                        onClick=${() => setShowPhotoGallery(true)}
                        class="bg-pink-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm hover:bg-pink-700 no-print"
                        title="View and manage student photo gallery"
                    >
                        📸 Photo Gallery
                    </button>
                    ${data.settings.googleScriptUrl && html`
                        <button
                            onClick=${handleSyncDeletions}
                            class="bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm hover:bg-purple-700 no-print"
                            title="Check for students deleted in Google Sheet"
                        >
                            ↻ Sync from Sheet
                        </button>
                    `}
                    <button
                        onClick=${() => { if (showAdd) resetForm(); setShowAdd(!showAdd); }}
                        class="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm hover:bg-blue-700"
                    >
                        ${showAdd ? 'Cancel' : 'Add Student'}
                    </button>
                </div>
            </div>

            <div class="print-only mb-6 flex flex-col items-center text-center">
                <img src="${data.settings.schoolLogo}" class="w-16 h-16 mb-2 object-contain" alt="Logo" />
                <h1 class="text-2xl font-black uppercase">${data.settings.schoolName}</h1>
                <h2 class="text-sm font-bold uppercase text-slate-500 mt-1">Class Register: ${filterGrade === 'ALL' ? 'All Students' : filterGrade} (${data.settings.academicYear})</h2>
                <p class="text-[10px] text-slate-400 mt-1">Printed on ${new Date().toLocaleDateString()}</p>
            </div>

            ${showAdd && html`
                <form onSubmit=${handleAdd} class="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm space-y-4 animate-in slide-in-from-top-4 duration-300 no-print">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="space-y-1 md:col-span-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Student Portrait</label>
                            <div class="flex items-center gap-3">
                                ${newStudent.portrait ? html`
                                    <img src=${newStudent.portrait} class="w-16 h-16 rounded-lg object-cover border-2 border-blue-200" alt="Portrait" />
                                ` : html`
                                    <div class="w-16 h-16 rounded-lg bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                                        <span class="text-2xl">👤</span>
                                    </div>
                                `}
                                <div class="flex-1">
                                    <input 
                                        type="file"
                                        accept="image/*"
                                        onChange=${handlePortraitUpload}
                                        class="w-full text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-bold hover:file:bg-blue-100"
                                    />
                                    <p class="text-[9px] text-slate-400 mt-1">Upload student photo (optional)</p>
                                </div>
                            </div>
                        </div>
                        <div class="space-y-1 md:col-span-2">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Full Name</label>
                            <input 
                                placeholder="e.g. John Doe" 
                                required 
                                class="w-full p-3 bg-slate-50 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                                value=${newStudent.name}
                                onInput=${(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                            />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Admission Number</label>
                            <input 
                                placeholder="ADM/2024/001" 
                                required 
                                class="w-full p-3 bg-slate-50 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                                value=${newStudent.admissionNo}
                                onInput=${(e) => setNewStudent({ ...newStudent, admissionNo: e.target.value })}
                            />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Admission Date</label>
                            <input 
                                type="date"
                                class="w-full p-3 bg-slate-50 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                                value=${newStudent.admissionDate}
                                onChange=${(e) => setNewStudent({ ...newStudent, admissionDate: e.target.value })}
                            />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Grade / Class</label>
                            <select 
                                class="w-full p-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                                value=${newStudent.grade}
                                onChange=${(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
                            >
                                ${data.settings.grades.map(g => html`<option value=${g}>${g}</option>`)}
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Student Category</label>
                            <select 
                                class="w-full p-3 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                                value=${newStudent.category || 'Normal'}
                                onChange=${(e) => setNewStudent({ ...newStudent, category: e.target.value })}
                            >
                                <option value="Normal">Normal (Full Fees)</option>
                                <option value="Staff">Staff Child (50% Off)</option>
                                <option value="Sponsored">Sponsored (100% Off)</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Assessment Number</label>
                            <input 
                                placeholder="ASN-123456" 
                                class="w-full p-3 bg-slate-50 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                                value=${newStudent.assessmentNo}
                                onInput=${(e) => setNewStudent({ ...newStudent, assessmentNo: e.target.value })}
                            />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">UPI Number</label>
                            <input 
                                placeholder="UPI-XXXX" 
                                class="w-full p-3 bg-slate-50 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                                value=${newStudent.upiNo}
                                onInput=${(e) => setNewStudent({ ...newStudent, upiNo: e.target.value })}
                            />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Stream</label>
                            <select
                                class="w-full p-3 bg-slate-50 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                                value=${newStudent.stream}
                                onChange=${(e) => setNewStudent({ ...newStudent, stream: e.target.value })}
                            >
                                ${streams.map(s => html`<option value=${s}>Stream ${s}</option>`)}
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Parent Contact</label>
                            <input 
                                placeholder="e.g. 0712345678" 
                                class="w-full p-3 bg-slate-50 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                                value=${newStudent.parentContact}
                                onInput=${(e) => setNewStudent({ ...newStudent, parentContact: e.target.value })}
                            />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Religion</label>
                            <select
                                class="w-full p-3 bg-slate-50 rounded-lg border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                                value=${newStudent.religion}
                                onChange=${(e) => setNewStudent({ ...newStudent, religion: e.target.value })}
                            >
                                <option value="">Select Religion</option>
                                <option value="Christian">Christian</option>
                                <option value="Islam">Islam</option>
                                <option value="Hindu">Hindu</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-orange-600 uppercase ml-1">Prev. Arrears (Bal B/F)</label>
                            <input 
                                type="number"
                                placeholder="0.00" 
                                class="w-full p-3 bg-orange-50 rounded-lg border-0 focus:ring-2 focus:ring-orange-500 outline-none font-bold text-orange-700"
                                value=${newStudent.previousArrears}
                                onInput=${(e) => setNewStudent({ ...newStudent, previousArrears: Number(e.target.value) })}
                            />
                        </div>
                        <div class="space-y-1 md:col-span-2">
                            <label class="text-[10px] font-bold text-indigo-600 uppercase ml-1">Portrait URL</label>
                            <input 
                                placeholder="https://example.com/student-portrait.jpg" 
                                class="w-full p-3 bg-indigo-50 rounded-lg border-0 focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                                value=${newStudent.portrait}
                                onInput=${(e) => setNewStudent({ ...newStudent, portrait: e.target.value })}
                            />
                        </div>
                    </div>
                    <div class="space-y-2 pt-2 border-t border-slate-100">
                        <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Applicable Fee Items (Fee Profile)</label>
                        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            ${feeOptions.map(opt => html`
                                <label key=${opt.key} class=${`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${(newStudent.selectedFees || []).includes(opt.key)
            ? 'bg-blue-50 border-blue-200 text-blue-700'
            : 'bg-white border-slate-100 text-slate-400'
        }`}>
                                    <input 
                                        type="checkbox" 
                                        class="hidden"
                                        checked=${(newStudent.selectedFees || []).includes(opt.key)}
                                        onChange=${() => toggleFee(opt.key)}
                                    />
                                    <span class="text-[10px] font-bold uppercase truncate">${opt.label}</span>
                                </label>
                            `)}
                        </div>
                    </div>
                    <button class="w-full bg-slate-800 text-white py-3 rounded-xl font-bold">
                        ${editingId ? 'Update Student Information' : 'Register Student'}
                    </button>
                </form>
            `}

            
            <div class="hidden print:flex flex-col items-center text-center border-b pb-2 mb-2">
                <img src="${data.settings.schoolLogo}" class="w-12 h-12 mb-1 object-contain" alt="Logo" />
                <h1 class="text-xl font-black uppercase text-slate-900">${data.settings.schoolName}</h1>
                <p class="text-[10px] text-slate-500 font-medium">${data.settings.schoolAddress}</p>
                <div class="mt-2 border-t border-slate-200 w-full pt-2">
                    <h2 class="text-sm font-extrabold uppercase tracking-widest text-blue-600">Students Register</h2>
                </div>
            </div>

            <div class="students-container bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                <table class="w-full text-left min-w-[800px] students-print-table">
                    <thead class="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">#</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Portrait</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Name</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Adm No</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Adm Date</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">UPI No</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Assess No</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Religion</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Parent Contact</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Grade</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase no-print">Action</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-50">
                        ${(
                            /* On screen: show paginated slice. On print: all rows rendered,
                                CSS hides the screen-subset and shows the full-list tbody */
                            paginatedStudents
                        ).map((student, idx) => html`
                            <tr key=${student.id} class="hover:bg-slate-100 transition-colors even:bg-slate-50 students-screen-row ${student.status === 'left' ? 'opacity-60 bg-red-50' : ''}">
                                <td class="px-6 py-4 text-slate-400 text-xs font-mono">${(currentPage - 1) * STUDENTS_PER_PAGE + idx + 1}</td>
                                <td class="px-6 py-4">
                                    ${student.portrait ? html`
                                        <img src=${student.portrait} class="w-10 h-10 rounded-lg object-cover border border-slate-200" alt="Portrait" />
                                    ` : html`
                                        <div class="w-10 h-10 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                                            <span class="text-lg">👤</span>
                                        </div>
                                    `}
                                </td>
                                <td class="px-6 py-4">
                                    <div class="font-bold text-sm ${student.status === 'left' ? 'text-red-600 line-through' : ''}">${student.name}</div>
                                    <div class="text-[9px] text-slate-400 uppercase">${student.stream || 'No Stream'}</div>
                                    ${student.status === 'left' && html`
                                        <span class="text-[9px] font-black text-red-600 uppercase">LEFT ${student.leftDate ? `(${student.leftDate})` : ''}</span>
                                    `}
                                </td>
                                <td class="px-6 py-4 text-slate-500 text-sm font-mono">${student.admissionNo}</td>
                                <td class="px-6 py-4 text-slate-500 text-xs font-mono">${student.admissionDate || '-'}</td>
                                <td class="px-6 py-4 text-slate-500 text-xs font-mono">${student.upiNo || '-'}</td>
                                <td class="px-6 py-4 text-slate-500 text-xs font-mono">${student.assessmentNo || '-'}</td>
                                <td class="px-6 py-4">
                                    <span class=${`px-2 py-1 rounded-full text-[9px] font-black uppercase ${
                                        student.religion === 'Christian' ? 'bg-blue-100 text-blue-700' :
                                        student.religion === 'Islam' ? 'bg-green-100 text-green-700' :
                                        student.religion === 'Hindu' ? 'bg-orange-100 text-orange-700' :
                                        'bg-slate-100 text-slate-400'
                                    }`}>
                                        ${student.religion || 'NONE'}
                                    </span>
                                </td>
                                <td class="px-6 py-4 text-slate-700 text-xs font-bold">${student.parentContact || '-'}</td>
                                <td class="px-6 py-4">
                                    <div class="flex flex-col gap-1">
                                        <span class="bg-slate-200 px-2 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap">${student.grade}${student.stream || ''}</span>
                                        ${['GRADE 10', 'GRADE 11', 'GRADE 12'].includes(student.grade) && html`
                                            <span class="text-[8px] font-black text-blue-600 uppercase tracking-tighter">
                                                ${student.seniorPathway ? student.seniorPathway.replace(/([A-Z])/g, ' $1') : 'No Pathway'}
                                            </span>
                                        `}
                                    </div>
                                </td>
                                <td class="px-6 py-4 no-print">
                                    <div class="flex items-center gap-3">
                                        <button 
                                            type="button"
                                            onClick=${() => handleToggleStatus(student)}
                                            class=${`px-2 py-1 rounded font-black text-[9px] transition-all uppercase ${student.status === 'left' ? 'bg-green-50 text-green-600 hover:bg-green-600 hover:text-white' : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'}`}
                                            title=${student.status === 'left' ? 'Mark as Active' : 'Mark as Left'}
                                        >
                                            ${student.status === 'left' ? 'Activate' : 'Left'}
                                        </button>
                                        <button 
                                            type="button"
                                            onClick=${() => handlePromote(student)}
                                            class="bg-blue-50 text-blue-600 px-2 py-1 rounded font-black text-[9px] hover:bg-blue-600 hover:text-white transition-all uppercase"
                                            title="Promote to Next Grade"
                                        >
                                            Promote
                                        </button>
                                        <button 
                                            type="button"
                                            onClick=${() => onSelectStudent(student.id)}
                                            class="text-blue-600 font-bold text-[10px] hover:underline uppercase tracking-tight"
                                        >
                                            Report
                                        </button>
                                        <button 
                                            type="button"
                                            onClick=${() => handleEdit(student)}
                                            class="text-slate-600 font-bold text-[10px] hover:underline uppercase tracking-tight"
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            type="button"
                                            onClick=${() => handleDelete(student.id)}
                                            class="text-red-500 font-bold text-[10px] hover:underline uppercase tracking-tight"
                                        >
                                            Del
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `)}
                    </tbody>
                    
                    <tbody class="students-print-rows" style="display:none">
                        ${filteredStudents.map((student, idx) => html`
                            <tr key=${`print-${student.id}`} class="even:bg-slate-50">
                                <td class="px-4 py-2 text-slate-400 text-xs font-mono">${idx + 1}</td>
                                <td class="px-4 py-2">
                                    ${student.portrait ? html`
                                        <img src=${student.portrait} class="w-8 h-8 rounded-lg object-cover border border-slate-200" alt="Portrait" />
                                    ` : html`
                                        <div class="w-8 h-8 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                                            <span class="text-sm">👤</span>
                                        </div>
                                    `}
                                </td>
                                <td class="px-4 py-2">
                                    <div class="font-bold text-sm">${student.name}</div>
                                    <div class="text-[9px] text-slate-400 uppercase">${student.stream || 'No Stream'}</div>
                                </td>
                                <td class="px-4 py-2 text-slate-500 text-sm font-mono">${student.admissionNo}</td>
                                <td class="px-4 py-2 text-slate-500 text-xs font-mono">${student.admissionDate || '-'}</td>
                                <td class="px-4 py-2 text-slate-500 text-xs font-mono">${student.upiNo || '-'}</td>
                                <td class="px-4 py-2 text-slate-500 text-xs font-mono">${student.assessmentNo || '-'}</td>
                                <td class="px-4 py-2">
                                    <span class=${`px-2 py-1 rounded-full text-[9px] font-black uppercase ${
                                        student.religion === 'Christian' ? 'bg-blue-100 text-blue-700' :
                                        student.religion === 'Islam' ? 'bg-green-100 text-green-700' :
                                        student.religion === 'Hindu' ? 'bg-orange-100 text-orange-700' :
                                        'bg-slate-100 text-slate-400'
                                    }`}>
                                        ${student.religion || 'NONE'}
                                    </span>
                                </td>
                                <td class="px-4 py-2 text-slate-700 text-xs font-bold">${student.parentContact || '-'}</td>
                                <td class="px-4 py-2">
                                    <div class="flex flex-col gap-1">
                                        <span class="bg-slate-200 px-2 py-1 rounded text-[10px] font-bold uppercase whitespace-nowrap">${student.grade}${student.stream || ''}</span>
                                        ${['GRADE 10', 'GRADE 11', 'GRADE 12'].includes(student.grade) && html`
                                            <span class="text-[8px] font-black text-blue-600 uppercase tracking-tighter">
                                                ${student.seniorPathway ? student.seniorPathway.replace(/([A-Z])/g, ' $1') : 'No Pathway'}
                                            </span>
                                        `}
                                    </div>
                                </td>
                            </tr>
                        `)}
                    </tbody>
                </table>
                ${safeFilteredStudents.length === 0 && html`
                    <div class="p-12 text-center text-slate-300">No students found matching current filters.</div>
                `}
                ${safeFilteredStudents.length > 0 && html`
                    <${PaginationControls}
                        currentPage=${currentPage}
                        onPageChange=${(page) => {
                            const totalPages = Math.max(1, Math.ceil(safeFilteredStudents.length / STUDENTS_PER_PAGE));
                            const nextPage = Math.min(Math.max(1, Number(page) || 1), totalPages);
                            setCurrentPage(nextPage);
                        }}
                        totalItems=${safeFilteredStudents.length}
                        itemsPerPage=${STUDENTS_PER_PAGE}
                    />
                `}
            </div>

            
            <div class="mt-6 pt-3 border-t border-slate-200 print:border-black">
                <div class="flex justify-between items-center text-[8px] text-slate-400">
                    <span>${data.settings.schoolName} - ${data.settings.schoolAddress}</span>
                    <span>Academic Year: ${data.settings.academicYear}</span>
                    <span>Students Register</span>
                </div>
            </div>
        </div>

        ${showPhotoGallery && html`
            <${PhotoGallery}
                data=${data}
                setData=${setData}
                onClose=${() => setShowPhotoGallery(false)}
            />
        `}
    `;
};
