import { h } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { googleSheetSync } from '../lib/googleSheetSync.js';
import { PrintButtons } from './PrintButtons.js';
import { AssessmentMatrix } from './AssessmentMatrix.js';

const html = htm.bind(h);

export const Assessments = ({ data, setData, isAdmin, teacherSession, allowedSubjects = [], allowedGrades = [], allowedReligion = '' }) => {
    const allSettingsGrades = data?.settings?.grades || [];
    
    // FOR TEACHERS: Only show their assigned grades - filter with case-insensitive matching
    let availableGrades;
    if (isAdmin) {
        // Admin sees all grades
        availableGrades = allSettingsGrades;
    } else {
        // Teacher: ONLY show grades they're assigned to (case-insensitive)
        const allowedLower = allowedGrades.map(g => g.toLowerCase());
        availableGrades = allSettingsGrades.filter(g => 
            allowedLower.some(ag => g.toLowerCase().includes(ag) || ag.includes(g.toLowerCase()))
        );
    }
    
    const gradesToUse = availableGrades.length > 0 ? availableGrades : [];
    
    // Show message if teacher has no grades assigned
    const hasNoAccess = !isAdmin && gradesToUse.length === 0;
    
    // Show access denied message for teachers with no grades
    if (hasNoAccess) {
        return html`
            <div class="p-8 text-center">
                <div class="text-4xl mb-4">🔒</div>
                <h2 class="text-xl font-bold text-slate-700 mb-2">No Access Assigned</h2>
                <p class="text-slate-500 mb-4">You have not been assigned any grades or subjects to manage.</p>
                <p class="text-sm text-slate-400">Please contact the administrator to assign your teaching subjects and grades.</p>
            </div>
        `;
    }
    
    // Helper to check if user can access a specific grade
    const canAccessGrade = (grade) => {
        if (isAdmin) return true;
        return availableGrades.includes(grade);
    };
    
    // Helper to check if user can access a specific subject
    const canAccessSubject = (subject) => {
        if (isAdmin) return true;
        if (!subject || !allowedSubjects.length) return false;
        const subjectLower = subject.toLowerCase();
        return allowedSubjects.some(as => subjectLower.includes(as.toLowerCase()) || as.toLowerCase().includes(subjectLower));
    };
    
    // Helper function to find student for assessment
    const findStudentForAssessment = (assessment) => {
        if (!assessment) return null;
        return (data.students || []).find(s => 
            String(s.id) === String(assessment.studentId) ||
            String(s.admissionNo) === String(assessment.studentId) ||
            s.admissionNo === assessment.studentAdmissionNo
        );
    };
    
    const [selectedGrade, setSelectedGrade] = useState('');
    const [selectedStream, setSelectedStream] = useState('ALL');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedTerm, setSelectedTerm] = useState('T1');
    const [selectedExamType, setSelectedExamType] = useState('Opener');
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncStatus, setSyncStatus] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [historySearchTerm, setHistorySearchTerm] = useState('');
    const [examTotal, setExamTotal] = useState(100);
    
    // View toggle: 'table' or 'matrix'
    const [activeView, setActiveView] = useState('table');

    // Auto-select first available grade on mount or when grades change
    const [initialGradeSet, setInitialGradeSet] = useState(false);
    useEffect(() => {
        if (!initialGradeSet && gradesToUse.length > 0 && !selectedGrade) {
            console.log('Auto-selecting grade:', gradesToUse[0]);
            setSelectedGrade(gradesToUse[0]);
            setInitialGradeSet(true);
        }
    }, [gradesToUse, initialGradeSet, selectedGrade]);

    const streams = data?.settings?.streams || [];
    
    // Get subjects ONLY for the selected grade
    const allSubjects = useMemo(() => {
        if (!selectedGrade) return [];
        const defaults = Storage.getSubjectsForGrade(selectedGrade) || [];
        const rawCustom = data?.settings?.gradeSubjects?.[selectedGrade] || '';
        const custom = rawCustom.split(',').map(s => s.trim()).filter(Boolean);
        return [...new Set([...defaults, ...custom])];
    }, [selectedGrade, data?.settings?.gradeSubjects]);
    
    // FOR TEACHERS: Only show their assigned subjects for their grades
    let availableSubjects;
    if (isAdmin) {
        // Admin sees all subjects
        availableSubjects = allSubjects;
    } else if (selectedGrade) {
        // Teacher: Show subjects they're assigned to for this grade, plus all grade subjects as fallback
        const teacherLower = allowedSubjects.map(s => s.toLowerCase());
        const teacherSubjects = allSubjects.filter(s => 
            teacherLower.some(as => s.toLowerCase().includes(as) || as.includes(s.toLowerCase()))
        );
        // If teacher has assigned subjects, use those; otherwise use all grade subjects
        availableSubjects = teacherSubjects.length > 0 ? teacherSubjects : allSubjects;
    } else {
        availableSubjects = [];
    }
    
    // Filter by religion if needed
    availableSubjects = availableSubjects.filter(s => {
        if (!allowedReligion) return true;
        if (s.toUpperCase().includes('CRE')) return allowedReligion === 'christian';
        if (s.toUpperCase().includes('IRE')) return allowedReligion === 'islam';
        if (s.toUpperCase().includes('HRE')) return allowedReligion === 'hindu';
        return true;
    });
    
    const subjects = availableSubjects.length > 0 ? availableSubjects : [];
    
    // Auto-select first subject when grade changes, OR show message if no subjects
    useEffect(() => {
        if (selectedGrade && subjects.length > 0 && !selectedSubject) {
            setSelectedSubject(subjects[0]);
        } else if (selectedGrade && subjects.length === 0) {
            setSelectedSubject('');
        }
    }, [selectedGrade, subjects]);

    useEffect(() => {
        const academicYear = data.settings?.academicYear || '2025/2026';
        const matchingAssessments = (data.assessments || []).filter(a =>
            a.grade === selectedGrade &&
            a.subject === selectedSubject &&
            a.term === selectedTerm &&
            a.examType === selectedExamType &&
            a.academicYear === academicYear
        );

        const storedMaxScore = matchingAssessments.find(a => Number(a.maxScore) > 0)?.maxScore;
        if (storedMaxScore && Number(storedMaxScore) !== Number(examTotal)) {
            setExamTotal(Number(storedMaxScore));
        }
    }, [data.assessments, data.settings?.academicYear, examTotal, selectedExamType, selectedGrade, selectedSubject, selectedTerm]);
    
    const filteredStudents = (data?.students || []).filter(s => {
        // Case-insensitive grade matching
        const inGrade = selectedGrade && s.grade && (s.grade.toLowerCase() === selectedGrade.toLowerCase() || s.grade === selectedGrade);
        if (!inGrade) return false;
        
        const inStream = selectedStream === 'ALL' || s.stream === selectedStream;
        if (!inStream) return false;

        const matchesSearch = !searchTerm || 
            (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (s.admissionNo && s.admissionNo.toLowerCase().includes(searchTerm.toLowerCase()));
        if (!matchesSearch) return false;

        const matchesReligion = !allowedReligion || !s.religion || (s.religion && s.religion.toLowerCase() === allowedReligion.toLowerCase());
        if (!matchesReligion) return false;
        
        // For Senior School, filter students by their chosen electives
        const seniorGrades = ['GRADE 10', 'GRADE 11', 'GRADE 12'];
        if (seniorGrades.includes(selectedGrade)) {
            const core = ['English', 'Kiswahili', 'Mathematics', 'CSL'];
            if (core.includes(selectedSubject)) return true;
            return (s.seniorElectives || []).includes(selectedSubject);
        }
        return true;
    });

    const updateAssessment = (studentId, field, value, customSubject = null) => {
        const studentIdStr = String(studentId);
        const academicYear = data.settings?.academicYear || '2025/2026';
        
        const targetSubject = customSubject || selectedSubject;
        
        // Use LOOSE MATCHING to find existing record
        const termToMatch = String(selectedTerm || '').toLowerCase().trim();
        const examToMatch = String(selectedExamType || '').toLowerCase().trim();
        const subjToMatch = String(targetSubject || '').toLowerCase().trim();

        const existing = data.assessments.find(a => {
            const studentMatch = String(a.studentId) === studentIdStr || String(a.studentId) === String(studentId);
            if (!studentMatch) return false;

            const subjectMatch = String(a.subject || '').toLowerCase().trim() === subjToMatch;
            if (!subjectMatch) return false;

            const aTerm = String(a.term || '').toLowerCase().trim();
            const aExam = String(a.examType || '').toLowerCase().trim();
            
            const termMatch = aTerm === termToMatch || aTerm.includes(termToMatch) || termToMatch.includes(aTerm);
            const examMatch = aExam === examToMatch || aExam.includes(examToMatch) || examToMatch.includes(aExam);
            
            return termMatch && examMatch;
        });
        
        // Remove existing and keep other assessments
        const otherAssessments = data.assessments.filter(a => 
            !((String(a.studentId) === studentIdStr || String(a.studentId) === String(studentId)) && a.subject === targetSubject && a.term === selectedTerm && a.examType === selectedExamType && a.academicYear === academicYear)
        );
        
        // Get student's actual grade from data
        const student = (data.students || []).find(s => String(s.id) === studentIdStr || s.admissionNo === studentIdStr);
        const studentGrade = student?.grade || selectedGrade;
        
        // Calculate based on current examTotal
        const currentMaxScore = Number(examTotal) || 100;
        let maxScore = currentMaxScore;
        
        let level = 'ME2';
        let score = 0;
        let rawScore = 0;

        if (field === 'score') {
            // User enters percentage directly (0-100)
            score = Math.min(100, Math.max(0, Number(value)));
            rawScore = Math.round((score / 100) * currentMaxScore);
            level = Storage.getGradeInfo(score).level;
        } else if (field === 'rawScore') {
            // User enters raw marks - convert to percentage
            rawScore = Math.min(currentMaxScore, Math.max(0, Number(value)));
            score = Math.round((rawScore / currentMaxScore) * 100);
            level = Storage.getGradeInfo(score).level;
        } else if (field === 'level') {
            level = value;
            // Also calculate score from existing rawScore if available
            if (existing?.rawScore !== undefined) {
                rawScore = existing.rawScore;
                score = Math.round((rawScore / currentMaxScore) * 100);
            }
        }

        const newAssessment = {
            id: existing?.id || ('A-' + Date.now() + Math.random().toString().slice(2, 6)),
            studentId: studentIdStr,
            studentAdmissionNo: student?.admissionNo || '',
            studentName: student?.name || '',
            grade: studentGrade,
            subject: targetSubject,
            term: selectedTerm,
            examType: selectedExamType,
            level,
            score,
            rawScore,
            maxScore,
            academicYear: academicYear,
            date: new Date().toISOString().split('T')[0]
        };
        
        // Track activity
        const action = existing ? 'EDIT' : 'ADD';
        
        // 1. SAVE LOCALLY FIRST
        const updatedAssessments = [...otherAssessments, newAssessment];
        setData({ ...data, assessments: updatedAssessments });
        console.log('✓ Assessment saved:', newAssessment.id, '- Grade:', newAssessment.grade, '- Subject:', newAssessment.subject, '- Score:', newAssessment.score, '- Term:', newAssessment.term);
        
        // 2. SYNC TO GOOGLE SHEET (fire and forget, don't block)
        if (data.settings?.googleScriptUrl) {
            syncToGoogleSilent(newAssessment).catch(err => {
                console.warn('⚠ Auto-sync failed:', err.message, '- Will retry later');
            });
        }
    };
    
    // Silent async sync - doesn't block UI
    const syncToGoogleSilent = async (assessment) => {
        if (!data.settings?.googleScriptUrl) return;
        
        try {
            googleSheetSync.setSettings(data.settings);
            googleSheetSync.setStudents(data.students || []);
            
            const student = (data.students || []).find(s => 
                String(s.id) === String(assessment.studentId) || 
                String(s.admissionNo) === String(assessment.studentId)
            );
            const enriched = {
                ...assessment,
                studentId: String(student?.id || assessment.studentId || ''),
                studentAdmissionNo: student?.admissionNo || assessment.studentAdmissionNo || '',
                studentName: student?.name || 'Unknown',
                grade: student?.grade || assessment.grade || ''
            };
            
            const result = await googleSheetSync.pushAssessment(enriched);
            if (result.success) {
                console.log('Assessment synced to Google:', assessment.id);
            } else {
                console.warn('Assessment sync returned false:', result.error);
            }
        } catch (err) {
            console.warn('Assessment sync error:', err.message);
            throw err;
        }
    };
    
    const syncToGoogle = async (assessments) => {
        if (!data.settings?.googleScriptUrl) {
            setSyncStatus('Google Sheet not configured');
            return;
        }
        
        setIsSyncing(true);
        setSyncStatus('Syncing to Google Sheet...');
        googleSheetSync.setSettings(data.settings);
        // Set students list for enrichment in sync service
        googleSheetSync.setStudents(data.students || []);
        
        try {
            let successCount = 0;
            let failCount = 0;
            
            for (const assessment of assessments) {
                try {
                    // Enrich assessment with student data before syncing
                    const student = (data.students || []).find(s => 
                        String(s.id) === String(assessment.studentId) || 
                        String(s.admissionNo) === String(assessment.studentId)
                    );
                    const enriched = {
                        ...assessment,
                        // Ensure studentId is always a string
                        studentId: String(student?.id || assessment.studentId || ''),
                        studentAdmissionNo: student?.admissionNo || assessment.studentAdmissionNo || '',
                        studentName: student?.name || assessment.studentName || 'Unknown',
                        grade: student?.grade || assessment.grade || ''
                    };
                    
                    const result = await googleSheetSync.pushAssessment(enriched);
                    if (result.success) {
                        successCount++;
                    } else {
                        failCount++;
                    }
                } catch (singleErr) {
                    failCount++;
                    console.warn('Single assessment sync failed:', singleErr.message);
                }
            }
            
            setSyncStatus(`✓ Synced: ${successCount} success, ${failCount} failed`);
            setTimeout(() => setSyncStatus(''), 3000);
        } catch (error) {
            console.error('Sync error:', error);
            setSyncStatus('Sync failed - saved locally');
            setTimeout(() => setSyncStatus(''), 3000);
        }
        
        setIsSyncing(false);
    };
    
    const deleteAssessment = async (assessmentId) => {
        if (!confirm('Delete this assessment record?')) return;
        
        const assessmentToDelete = data.assessments.find(a => a.id === assessmentId);
        const updatedAssessments = data.assessments.filter(a => a.id !== assessmentId);
        
        setData({ ...data, assessments: updatedAssessments });
        
        // Delete from Google Sheet
        if (data.settings.googleScriptUrl) {
            setSyncStatus('Deleting from Sheet...');
            googleSheetSync.setSettings(data.settings);
            const resp = await googleSheetSync.deleteAssessment(assessmentId);
            setSyncStatus(resp.success ? '✓ Deleted from Sheet!' : '⚠ Local deleted, Sheet sync pending');
            setTimeout(() => setSyncStatus(''), 2500);
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
            const deletionInfo = await googleSheetSync.detectDeletions('Assessments', data.assessments || []);
            
            if (deletionInfo.deletionCount > 0) {
                const updatedAssessments = data.assessments.filter(a => !deletionInfo.deletedIds.includes(String(a.id)));
                setData({ ...data, assessments: updatedAssessments });
                setSyncStatus(`✓ Synced! Removed ${deletionInfo.deletionCount} deleted assessment(s)`);
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
    
    const fetchFromGoogle = async () => {
        if (!data.settings.googleScriptUrl) {
            alert('Google Sheet not configured. Go to Settings > Teacher Data Sync.');
            return;
        }
        
        if (!confirm('Fetch assessments from Google Sheet? This will merge with existing data.')) return;
        
        setSyncStatus('Fetching from Google Sheet...');
        setIsSyncing(true);
        googleSheetSync.setSettings(data.settings);
        
        try {
            const result = await googleSheetSync.fetchAll();
            
            if (result.success && result.assessments) {
                // Merge assessments from Google Sheet with local data
                const localAssessments = data.assessments || [];
                const remoteAssessments = result.assessments || [];
                const localStudents = data.students || [];
                
                // Merge, using robust ID matching
                const mergedAssessments = [...localAssessments];
                let addedCount = 0;
                
                remoteAssessments.forEach(remote => {
                    // Normalize the remote assessment
                    const normalizedRemote = {
                        ...remote,
                        score: Number(remote.score),
                        rawScore: remote.rawScore !== undefined && remote.rawScore !== '' ? Number(remote.rawScore) : undefined,
                        maxScore: remote.maxScore !== undefined && remote.maxScore !== '' ? Number(remote.maxScore) : 100,
                        studentId: String(remote.studentId || ''),
                        studentAdmissionNo: remote.studentAdmissionNo || '',
                        studentName: remote.studentName || ''
                    };

                    if (!Number.isFinite(normalizedRemote.score)) {
                        return;
                    }
                    if (!Number.isFinite(normalizedRemote.rawScore) && Number.isFinite(normalizedRemote.score)) {
                        normalizedRemote.rawScore = Math.round((normalizedRemote.score / 100) * normalizedRemote.maxScore);
                    }
                    
                    // Check if this assessment already exists locally
                    const existingIndex = mergedAssessments.findIndex(a => 
                        a.id === normalizedRemote.id ||
                        // Match by composite key with flexible ID matching
                        ((
                            String(a.studentId) === String(normalizedRemote.studentId) ||
                            (normalizedRemote.studentAdmissionNo && String(a.studentAdmissionNo || '').toLowerCase() === String(normalizedRemote.studentAdmissionNo || '').toLowerCase()) ||
                            (normalizedRemote.studentName && a.studentName && normalizedRemote.studentName.toLowerCase().trim() === a.studentName.toLowerCase().trim())
                        ) &&
                         a.subject === normalizedRemote.subject && 
                         a.term === normalizedRemote.term && 
                         a.examType === normalizedRemote.examType &&
                         a.academicYear === normalizedRemote.academicYear)
                    );
                    
                    // Try to match with local students using multiple strategies
                    let matchedStudent = null;
                    
                    // Strategy 1: Match by studentId
                    if (normalizedRemote.studentId) {
                        matchedStudent = localStudents.find(s => 
                            String(s.id) === normalizedRemote.studentId ||
                            String(s.id) === String(Number(normalizedRemote.studentId))
                        );
                    }
                    
                    // Strategy 2: Match by admission number
                    if (!matchedStudent && normalizedRemote.studentAdmissionNo) {
                        matchedStudent = localStudents.find(s => 
                            s.admissionNo && 
                            String(s.admissionNo).toLowerCase() === normalizedRemote.studentAdmissionNo.toLowerCase()
                        );
                    }
                    
                    // Strategy 3: Match by name
                    if (!matchedStudent && normalizedRemote.studentName) {
                        matchedStudent = localStudents.find(s => 
                            s.name && 
                            s.name.toLowerCase().trim() === normalizedRemote.studentName.toLowerCase().trim()
                        );
                    }
                    
                    // Strategy 4: Match by grade + subject + term + exam (if studentId is empty but other data matches)
                    if (!matchedStudent && !normalizedRemote.studentId && !normalizedRemote.studentAdmissionNo) {
                        const existingByMatch = mergedAssessments.find(a =>
                            a.subject === normalizedRemote.subject &&
                            a.term === normalizedRemote.term &&
                            a.examType === normalizedRemote.examType &&
                            a.academicYear === normalizedRemote.academicYear
                        );
                        if (existingByMatch) {
                            normalizedRemote.studentId = existingByMatch.studentId;
                            normalizedRemote.studentAdmissionNo = existingByMatch.studentAdmissionNo || '';
                        }
                    }

                    const mergedAssessment = {
                        ...(existingIndex >= 0 ? mergedAssessments[existingIndex] : {}),
                        ...normalizedRemote,
                        studentId: matchedStudent?.id || normalizedRemote.studentId || '',
                        studentAdmissionNo: matchedStudent?.admissionNo || normalizedRemote.studentAdmissionNo || '',
                        studentName: matchedStudent?.name || normalizedRemote.studentName || 'Unknown'
                    };

                    if (existingIndex >= 0) {
                        mergedAssessments[existingIndex] = mergedAssessment;
                    } else {
                        mergedAssessments.push(mergedAssessment);
                        addedCount++;
                    }
                });
                
                setData({ ...data, assessments: mergedAssessments });
                setSyncStatus(`✓ Fetched ${addedCount} new assessment(s) from Google`);
            } else {
                setSyncStatus('⚠ Failed to fetch from Google Sheet');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            setSyncStatus('⚠ Fetch failed');
        }
        
        setTimeout(() => { setSyncStatus(''); setIsSyncing(false); }, 3000);
    };
    
    const syncAllToGoogle = async () => {
        if (!data.settings.googleScriptUrl) {
            alert('Google Sheet not configured. Go to Settings > Teacher Data Sync.');
            return;
        }
        
        if (!confirm('Sync all current assessments to Google Sheet?')) return;
        
        const currentAssessments = data.assessments.filter(a => 
            a.grade === selectedGrade && 
            a.term === selectedTerm && 
            a.examType === selectedExamType
        );
        
        await syncToGoogle(currentAssessments);
    };

    const levels = [
        { id: 'EE1', label: 'EE1', title: 'Exceptional (90-100)' },
        { id: 'EE2', label: 'EE2', title: 'Very Good (75-89)' },
        { id: 'ME1', label: 'ME1', title: 'Good (58-74)' },
        { id: 'ME2', label: 'ME2', title: 'Fair (41-57)' },
        { id: 'AE1', label: 'AE1', title: 'Needs Impr. (31-40)' },
        { id: 'AE2', label: 'AE2', title: 'Below Avg. (21-30)' },
        { id: 'BE1', label: 'BE1', title: 'Well Below (11-20)' },
        { id: 'BE2', label: 'BE2', title: 'Minimal (1-10)' }
    ];

    return html`
        <div class="space-y-6">
            <div class="flex justify-between items-start no-print">
                <div>
                    <h2 class="text-2xl font-bold">CBC Competency Tracker</h2>
                    <p class="text-slate-500">Assess students based on curriculum sub-strands</p>
                </div>
                ${data.settings.googleScriptUrl && html`
                    <div class="flex items-center gap-2">
                        ${syncStatus && html`
                            <span class="text-xs font-bold ${syncStatus.includes('✓') ? 'text-green-600' : 'text-blue-600'}">${syncStatus}</span>
                        `}
                        <button 
                            onClick=${syncAllToGoogle}
                            disabled=${isSyncing}
                            class="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                        >
                            <span>${isSyncing ? '⏳' : '📤'}</span>
                            ${isSyncing ? 'Syncing...' : 'Sync to Sheet'}
                        </button>
                        <button 
                            onClick=${fetchFromGoogle}
                            class="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                            title="Fetch assessments from Google Sheet"
                        >
                            <span>↓</span> Pull from Sheet
                        </button>
                        <${PrintButtons} />
                    </div>
                `}
            </div>

            
            <div class="flex gap-2 no-print border-b border-slate-200">
                <button
                    onClick=${() => setActiveView('table')}
                    class="px-4 py-2 font-semibold text-sm transition-all ${activeView === 'table' 
                        ? 'text-blue-600 border-b-2 border-blue-600' 
                        : 'text-slate-500 hover:text-slate-700'}"
                >
                    📊 Table View
                </button>
                <button
                    onClick=${() => setActiveView('matrix')}
                    class="px-4 py-2 font-semibold text-sm transition-all ${activeView === 'matrix' 
                        ? 'text-blue-600 border-b-2 border-blue-600' 
                        : 'text-slate-500 hover:text-slate-700'}"
                >
                    🔳 Matrix View
                </button>
            </div>

            
            ${activeView === 'matrix' && html`
                <${AssessmentMatrix} 
                    data=${data} 
                    setData=${setData} 
                    isAdmin=${isAdmin} 
                    teacherSession=${teacherSession}
                    allowedSubjects=${allowedSubjects}
                    allowedGrades=${allowedGrades}
                    allowedReligion=${allowedReligion}
                    updateAssessment=${updateAssessment}
                />
            `}

            
            ${activeView === 'table' && html`
                <div class="flex flex-col md:flex-row flex-wrap gap-4 no-print">
                    <div class="flex flex-col gap-1">
                        <label class="text-[10px] font-black text-slate-400 uppercase ml-1">Grade</label>
                        <select 
                            class="p-3 bg-white border border-slate-200 rounded-xl outline-none min-w-[120px]"
                            value=${selectedGrade}
                            onChange=${(e) => { setSelectedGrade(e.target.value); setSelectedStream('ALL'); }}
                        >
                            ${gradesToUse.map(g => html`<option value=${g}>${g}</option>`)}
                        </select>
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-[10px] font-black text-slate-400 uppercase ml-1">Stream</label>
                        <select 
                            class="p-3 bg-white border border-slate-200 rounded-xl outline-none min-w-[100px]"
                            value=${selectedStream}
                            onChange=${(e) => setSelectedStream(e.target.value)}
                        >
                            <option value="ALL">All</option>
                            ${streams.map(s => html`<option value=${s}>${s}</option>`)}
                        </select>
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-[10px] font-black text-slate-400 uppercase ml-1">Term</label>
                        <select 
                            class="p-3 bg-white border border-slate-200 rounded-xl outline-none min-w-[100px]"
                            value=${selectedTerm}
                            onChange=${(e) => setSelectedTerm(e.target.value)}
                        >
                            <option value="T1">Term 1</option>
                            <option value="T2">Term 2</option>
                            <option value="T3">Term 3</option>
                        </select>
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-[10px] font-black text-slate-400 uppercase ml-1">Exam Cycle</label>
                        <select 
                            class="p-3 bg-white border border-slate-200 rounded-xl outline-none min-w-[140px]"
                            value=${selectedExamType}
                            onChange=${(e) => setSelectedExamType(e.target.value)}
                        >
                            <option value="Opener">Opener (CAT 1)</option>
                            <option value="Mid-Term">Mid-Term (CAT 2)</option>
                            <option value="End-Term">End-Term Exam</option>
                        </select>
                    </div>
                    <div class="flex flex-col gap-1 flex-1">
                        <label class="text-[10px] font-black text-slate-400 uppercase ml-1">Subject</label>
                        <select 
                            class="p-3 bg-white border border-slate-200 rounded-xl outline-none w-full"
                            value=${selectedSubject}
                            onChange=${(e) => setSelectedSubject(e.target.value)}
                        >
                            ${subjects.map(s => html`<option value=${s}>${s}</option>`)}
                        </select>
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-[10px] font-black text-slate-400 uppercase ml-1">Total Marks/Questions</label>
                        <input 
                            type="number"
                            class="p-3 bg-blue-50 border-2 border-blue-200 rounded-xl outline-none w-24 font-bold text-blue-700"
                            value=${examTotal}
                            onInput=${(e) => setExamTotal(e.target.value)}
                            placeholder="E.g. 100"
                        />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-1">Quick Search</label>
                    <div class="relative">
                        <input 
                            type="text"
                            placeholder="Student name..."
                            class="p-3 pl-8 bg-white border border-slate-200 rounded-xl outline-none w-full md:w-48 text-sm"
                            value=${searchTerm}
                            onInput=${(e) => setSearchTerm(e.target.value)}
                        />
                        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm">
                ${filteredStudents.length === 0 ? html`
                    <div class="p-12 text-center text-slate-400">No students found matching your filters/search.</div>
                ` : html`
                    <div class="divide-y divide-slate-50">
                        ${filteredStudents.map(student => {
                            const academicYearStr = data.settings?.academicYear || '2025/2026';
                            const studentIdStr = String(student.id || '');
                            const studentAdmLower = String(student.admissionNo || '').toLowerCase();
                            const selectedSubjectLower = (selectedSubject || '').toLowerCase();

                            const assessment = data.assessments.find(a => {
                                const studentMatch =
                                    String(a.studentId) === studentIdStr ||
                                    String(a.studentId).toLowerCase() === studentAdmLower ||
                                    (a.studentAdmissionNo && String(a.studentAdmissionNo).toLowerCase() === studentAdmLower);
                                if (!studentMatch) return false;

                                const subjectMatch = String(a.subject || '').toLowerCase().trim() === selectedSubjectLower.trim();
                                if (!subjectMatch) return false;

                                // LOOSE MATCHING for Term/Exam
                                const termToMatch = String(selectedTerm || '').toLowerCase().trim();
                                const aTerm = String(a.term || '').toLowerCase().trim();
                                const termMatch = aTerm === termToMatch || aTerm.includes(termToMatch) || termToMatch.includes(aTerm);
                                if (!termMatch) return false;

                                const examToMatch = String(selectedExamType || '').toLowerCase().trim();
                                const aExam = String(a.examType || '').toLowerCase().trim();
                                const examMatch = aExam === examToMatch || aExam.includes(examToMatch) || examToMatch.includes(aExam);
                                if (!examMatch) return false;

                                const yearMatch = !a.academicYear || a.academicYear === academicYearStr;
                                return yearMatch;
                            });
                            return html`
                                <div key=${student.id} class="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <p class="font-bold">${student.name}</p>
                                        <p class="text-xs text-slate-400">Adm: ${student.admissionNo}</p>
                                    </div>
                                    <div class="flex flex-col md:flex-row items-center gap-4">
                                        <div class="flex items-center gap-2">
                                            <label class="text-[10px] font-bold text-slate-400 uppercase">Score / ${examTotal}</label>
                                            <div class="relative flex items-center">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    max=${examTotal}
                                                    value=${assessment?.rawScore !== undefined ? assessment.rawScore : (assessment?.score !== undefined ? Math.round((assessment.score / 100) * examTotal) : '')}
                                                    onBlur=${(e) => updateAssessment(student.id, 'rawScore', e.target.value)}
                                                    class="w-16 p-2 bg-slate-50 border border-slate-100 rounded text-center font-bold text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder={"0/" + examTotal}
                                                />
                                                ${assessment?.score !== undefined && html`
                                                    <div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-1.5 py-0.5 rounded shadow whitespace-nowrap z-10">
                                                        ${assessment.score}%
                                                    </div>
                                                `}
                                            </div>
                                            ${assessment && html`
                                                <button 
                                                    onClick=${() => deleteAssessment(assessment.id)}
                                                    title="Delete"
                                                    class="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center text-xs font-bold"
                                                >
                                                    ✕
                                                </button>
                                            `}
                                        </div>
                                        <div class="flex gap-1">
                                            ${levels.map(l => html`
                                                <button
                                                    onClick=${() => updateAssessment(student.id, 'level', l.id)}
                                                    title=${l.title}
                                                    class=${`w-10 h-10 rounded-lg text-[10px] font-bold transition-all border ${
                                                        assessment?.level === l.id 
                                                        ? 'bg-blue-600 text-white border-blue-600 scale-105' 
                                                        : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'
                                                    }`}
                                                >
                                                    ${l.label}
                                                </button>
                                            `)}
                                        </div>
                                    </div>
                                </div>
                            `;
                        })}
                    </div>
                `}
            </div>

            <div class="space-y-3 mt-8">
                <div class="flex justify-between items-end">
                    <div>
                        <h3 class="text-lg font-bold">Assessment Records (All Entries)</h3>
                        <p class="text-xs text-slate-500">View, edit, and delete all assessment entries</p>
                    </div>
                    <div class="relative no-print">
                        <input 
                            type="text"
                            placeholder="Search records..."
                            class="p-2 pl-8 bg-slate-50 border border-slate-100 rounded-lg outline-none w-64 text-xs font-bold"
                            value=${historySearchTerm}
                            onInput=${(e) => setHistorySearchTerm(e.target.value)}
                        />
                        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                    </div>
                </div>
                
                <div class="print-only mb-6 flex flex-col items-center text-center">
                    <img src="${data.settings.schoolLogo || ''}" class="w-16 h-16 mb-2 object-contain" alt="Logo" />
                    <h1 class="text-2xl font-black uppercase">${data.settings.schoolName || 'School'}</h1>
                    <h2 class="text-sm font-bold uppercase text-slate-500 mt-1">Assessment Records</h2>
                    <p class="text-[10px] font-bold text-slate-400 uppercase mt-1">${data.settings.academicYear || ''}</p>
                </div>

                <div class="assessments-container bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                    <table class="w-full text-left min-w-[920px] assessment-records-table">
                        <thead class="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Student Name</th>
                                <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Subject</th>
                                <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Term</th>
                                <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Exam Type</th>
                                <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase text-center">Score</th>
                                <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase text-center">Level</th>
                                <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase text-center no-print">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                            ${data.assessments
                                .filter(a => {
                                    if (!historySearchTerm) return true;
                                    const s = findStudentForAssessment(a);
                                    const searchLower = historySearchTerm.toLowerCase();
                                    return (s && s.name && s.name.toLowerCase().includes(searchLower)) ||
                                           (a.studentName && a.studentName.toLowerCase().includes(searchLower)) ||
                                           (a.subject && a.subject.toLowerCase().includes(searchLower)) ||
                                           (a.term && a.term.toLowerCase().includes(searchLower));
                                })
                                .length === 0 ? html`
                                    <tr>
                                        <td colspan="7" class="px-4 py-6 text-center text-slate-400">No matching assessment records found</td>
                                    </tr>
                                ` : data.assessments
                                    .filter(a => {
                                        if (!historySearchTerm) return true;
                                        const s = findStudentForAssessment(a);
                                        const searchLower = historySearchTerm.toLowerCase();
                                        return (s && s.name && s.name.toLowerCase().includes(searchLower)) ||
                                               (a.studentName && a.studentName.toLowerCase().includes(searchLower)) ||
                                               (a.subject && a.subject.toLowerCase().includes(searchLower)) ||
                                               (a.term && a.term.toLowerCase().includes(searchLower));
                                    })
                                    .slice().reverse().map(assessment => {
                                        const student = findStudentForAssessment(assessment);
                                        return html`
                                            <tr key=${assessment.id} class="hover:bg-slate-100 transition-colors even:bg-slate-50">
                                                <td class="px-6 py-4">
                                                    <div class="font-bold text-sm text-slate-800">${student?.name || assessment.studentName || 'Unknown'}</div>
                                                    <div class="text-[10px] text-slate-400 uppercase">${student?.admissionNo || assessment.studentAdmissionNo || '-'}</div>
                                                </td>
                                                <td class="px-6 py-4 text-slate-600 text-sm font-medium">${assessment.subject}</td>
                                                <td class="px-6 py-4 text-slate-500 text-xs font-bold uppercase">${assessment.term}</td>
                                                <td class="px-6 py-4 text-slate-500 text-xs font-bold uppercase">${assessment.examType}</td>
                                                <td class="px-6 py-4 text-center font-bold">
                                                    <div class="flex flex-col items-center gap-1">
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            value=${assessment.rawScore !== undefined ? assessment.rawScore : assessment.score}
                                                            onChange=${(e) => {
                                                                const raw = Number(e.target.value);
                                                                const max = assessment.maxScore || 100;
                                                                const pct = Math.round((raw / max) * 100);
                                                                
                                                                // 1. SAVE LOCALLY FIRST
                                                                const updated = {
                                                                    ...assessment,
                                                                    rawScore: raw,
                                                                    score: pct,
                                                                    level: Storage.getGradeInfo(pct).level
                                                                };
                                                                const updatedAssessments = data.assessments.map(a => a.id === assessment.id ? updated : a);
                                                                setData({ ...data, assessments: updatedAssessments });
                                                                
                                                                // 2. SYNC TO GOOGLE (silent)
                                                                if (data.settings?.googleScriptUrl) {
                                                                    syncToGoogleSilent(updated).catch(() => {});
                                                                }
                                                            }}
                                                            class="w-14 p-1.5 text-center bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 no-print font-bold text-sm"
                                                        />
                                                        <span class="hidden print:block text-[11px] font-black text-slate-700">
                                                            ${assessment.rawScore !== undefined ? assessment.rawScore : assessment.score}${assessment.maxScore ? ` / ${assessment.maxScore}` : ''}${assessment.score !== undefined ? ` (${assessment.score}%)` : ''}
                                                        </span>
                                                        ${assessment.maxScore && assessment.maxScore != 100 && html`
                                                            <span class="text-[9px] text-slate-400 no-print">/ ${assessment.maxScore} (${assessment.score}%)</span>
                                                        `}
                                                    </div>
                                                </td>
                                                <td class="px-6 py-4 text-center">
                                                    <span class="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase">${assessment.level}</span>
                                                </td>
                                                <td class="px-6 py-4 text-center no-print">
                                                    <button 
                                                        onClick=${() => deleteAssessment(assessment.id)}
                                                        title="Delete assessment"
                                                        class="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-[10px] font-bold uppercase"
                                                    >
                                                        Delete
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    })}
                        </tbody>
                    </table>
                </div>
                <p class="text-xs text-slate-400 mt-2">${data.assessments.length} total records</p>
            </div>
            `}
        </div>
    `;
};
