import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { PrintButtons } from './PrintButtons.js';

const html = htm.bind(h);

export const StudentDetail = ({ student, data, setData, onBack, isBatch = false, initialTerm = 'T1', isAdmin, teacherSession }) => {
    if (!student) return html`<div>Student not found</div>`;

    const [selectedTerm, setSelectedTerm] = useState(initialTerm);

    const settings = data.settings;
    const examTypes = ['Opener', 'Mid-Term', 'End-Term'];
    const isFullYear = selectedTerm === 'FULL';

    const getAssessmentsForTerm = (term) => {
        const academicYear = data.settings.academicYear || settings.academicYear;
        const studentIdStr = String(student.id);
        if (term === 'FULL') {
            return data.assessments.filter(a => String(a.studentId) === studentIdStr && a.academicYear === academicYear);
        }
        return data.assessments.filter(a => String(a.studentId) === studentIdStr && a.term === term && a.academicYear === academicYear);
    };

    const assessments = getAssessmentsForTerm(selectedTerm);

    // Calculate totals for summary cards based on subject averages
    let subjects = Storage.getSubjectsForGrade(student.grade, student);
    const isSenior = ['GRADE 10', 'GRADE 11', 'GRADE 12'].includes(student.grade);
    
    if (isSenior) {
        const studentIdStr = String(student.id);
        const academicYear = data.settings.academicYear || settings.academicYear;
        const theirAssessments = data.assessments.filter(a => String(a.studentId) === studentIdStr && a.academicYear === academicYear);
        const takenSubjects = [...new Set(theirAssessments.map(a => a.subject))];
        let filtered = subjects.filter(s => takenSubjects.includes(s));
        if (filtered.length < 7) {
            filtered = [...new Set([...filtered, ...subjects])].slice(0, 7);
        }
        subjects = filtered.slice(0, 10);
    }

    const subjectAverages = subjects.map(subject => {
        const scores = examTypes.map(type => {
            const match = assessments.find(a => a.subject === subject && a.examType === type);
            if (!match) return null;
            const score = Number(match.score);
            return isNaN(score) ? null : score;
        }).filter(s => s !== null);
        return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    });

    const validAveragesForOverall = isSenior 
        ? subjectAverages.filter(a => a !== null).sort((a, b) => b - a).slice(0, 7)
        : subjectAverages.filter(a => a !== null);

    const totalMarks = validAveragesForOverall.reduce((sum, avg) => sum + avg, 0);
    const subjectCount = subjects.length;
    // Overall level = calculated from average of subject percentages
    const overallResult = Storage.getOverallLevel(validAveragesForOverall);
    const overallLevel = overallResult.level;
    const overallPercentage = overallResult.percentage;
    const overallAL = overallResult.al;
    const attendancePercentage = isFullYear
        ? Storage.getStudentAttendance(student.id, data.attendance || [])
        : Storage.getStudentAttendance(student.id, data.attendance || [], selectedTerm);

    const getYearSummary = () => {
        const academicYear = data.settings.academicYear || settings.academicYear;
        const studentIdStr = String(student.id);
        const terms = ['T1', 'T2', 'T3'];
        return terms.map(term => {
            const termAssessments = data.assessments.filter(a => String(a.studentId) === studentIdStr && a.term === term && a.academicYear === academicYear);
            
            const subjectPoints = {};
            let termPoints = 0;
            
            const termSubjects = subjects.map(subject => {
                const scores = examTypes.map(type => {
                    const match = termAssessments.find(a => a.subject === subject && a.examType === type);
                    return match ? Number(match.score) : null;
                }).filter(s => s !== null);
                
                return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
            });

            const validItems = termSubjects.map((avg, i) => ({ subject: subjects[i], avg })).filter(item => item.avg !== null);
            const consideredItems = isSenior && validItems.length > 7 ? [...validItems].sort((a, b) => b.avg - a.avg).slice(0, 7) : validItems;

            consideredItems.forEach(item => {
                const gradeInfo = Storage.getGradeInfo(item.avg);
                if (gradeInfo) {
                    subjectPoints[item.subject] = gradeInfo.points;
                    termPoints += gradeInfo.points;
                }
            });

            const validAveragesForOverall = consideredItems.map(item => item.avg);
            const termOverall = Storage.getOverallLevel(validAveragesForOverall);
            const termAttendance = Storage.getStudentAttendance(student.id, data.attendance || [], term);
            
            return { term, avgScore: termOverall.percentage, termLevel: termOverall.level, termPercentage: termOverall.percentage, termAL: termOverall.al, termAttendance, subjectPoints, termPoints };
        });
    };

    const yearSummary = isFullYear ? getYearSummary() : [];
    const gradeValues = { 'EE': 4, 'ME': 3, 'AE': 2, 'BE': 1 };

    const t1Data = yearSummary[0] || {};
    const t2Data = yearSummary[1] || {};
    const t3Data = yearSummary[2] || {};

    // Filter out voided payments from balance calculation
    // Important: Use String() conversion for IDs to avoid numeric mismatch
    const paymentsForStudent = (data.payments || []).filter(p => String(p.studentId) === String(student.id) && !p.voided);
    const totalPaid = paymentsForStudent.reduce((sum, p) => sum + Number(p.amount), 0);

    const feeStructure = data.settings.feeStructures.find(f => f.grade === student.grade);
    const feeKeys = ['t1', 't2', 't3', 'breakfast', 'lunch', 'trip', 'bookFund', 'caution', 'uniform', 'studentCard', 'remedial'];

    // Calculate total due: Previous Arrears + Student's selected payable items
    let selectedKeys;
    if (typeof student.selectedFees === 'string') {
        selectedKeys = student.selectedFees.split(',').map(f => f.trim()).filter(f => f);
    } else if (Array.isArray(student.selectedFees)) {
        selectedKeys = student.selectedFees;
    } else {
        selectedKeys = ['t1', 't2', 't3'];
    }
    const previousArrears = Number(student.previousArrears) || 0;
    const currentFeesDue = feeStructure ? selectedKeys.reduce((sum, key) => sum + (feeStructure[key] || 0), 0) : 0;
    const totalDue = previousArrears + currentFeesDue;
    const balance = totalDue - totalPaid;

    const remark = (data.remarks || []).find(r => r.studentId === student.id) || { teacher: '', principal: '' };
    const studentGradeWithStream = student.grade + (student.stream || '');
    const classTeacher = (data.teachers || []).find(t => t.isClassTeacher && t.classTeacherGrade === studentGradeWithStream);
    
    // Check if the current user is the class teacher for this student
    const isThisClassTeacher = teacherSession && (
        (teacherSession.role === 'class_teacher' && teacherSession.classTeacherGrade === studentGradeWithStream) ||
        (teacherSession.role === 'head_teacher') ||
        (teacherSession.role === 'admin') ||
        (classTeacher && (
            (teacherSession.name && classTeacher.name && teacherSession.name.toLowerCase() === classTeacher.name.toLowerCase()) || 
            (teacherSession.username && classTeacher.username && teacherSession.username.toLowerCase() === classTeacher.username.toLowerCase())
        ))
    );

    const handleRemarkChange = (field, val) => {
        const otherRemarks = (data.remarks || []).filter(r => r.studentId !== student.id);
        setData({
            ...data,
            remarks: [...otherRemarks, { ...remark, studentId: student.id, [field]: val }]
        });
    };

    return html`
        <div class="space-y-4 print:space-y-2 student-report-root">
            ${!isBatch && html`
                <button type="button" onClick=${onBack} class="text-blue-600 flex items-center gap-1 no-print">
                    <span class="text-xl">←</span> Back
                </button>
            `}
            
            <div class=${`bg-white p-6 rounded-2xl shadow-sm border border-slate-100 print:border-0 print:shadow-none print:p-0 student-report-sheet ${isBatch ? '' : ''}`}>
                
                <div class="flex flex-col md:flex-row items-center justify-between gap-4 border-b pb-4 print:border-b-2 print:border-black print:pb-3 print:flex-row">
                    
                    <div class="flex-shrink-0 print:w-24 print:h-24">
                        <img src="${settings.schoolLogo}" class="w-20 h-20 md:w-24 md:h-24 object-contain print:w-24 print:h-24" alt="School Logo" />
                    </div>
                    
                    
                    <div class="flex-1 text-center print:text-center print:flex-1">
                        <h1 class="text-xl md:text-2xl font-black uppercase text-slate-900 leading-tight print:text-xl">${settings.schoolName}</h1>
                        <p class="text-[10px] md:text-xs text-slate-500 font-medium mt-1 print:text-xs">${settings.schoolAddress}</p>
                        <div class="mt-2 border-t border-slate-200 w-full pt-2 print:border-black print:mt-2 print:pt-2">
                            <h2 class="text-sm font-extrabold uppercase tracking-widest text-blue-600 print:text-sm">${isFullYear ? 'Annual Comprehensive Report' : 'Progressive Student Report - ' + selectedTerm.replace('T', 'Term ')}</h2>
                        </div>
                    </div>
                    
                    
                    <div class="flex-shrink-0 print:w-24 print:h-24">
                        ${(student.portrait || student.portraitUrl) ? html`
                            <img src=${student.portrait || student.portraitUrl} class="w-20 h-20 md:w-24 md:h-24 rounded-lg object-cover border-2 border-slate-200 print:border-black print:w-24 print:h-24 print:rounded-lg print:object-cover" alt="Student Portrait" />
                        ` : html`
                            <div class="w-20 h-20 md:w-24 md:h-24 rounded-lg bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-slate-400 print:w-24 print:h-24 print:rounded-lg print:border-2 print:border-dashed print:border-slate-300">
                                <span class="text-3xl">👤</span>
                            </div>
                        `}
                    </div>
                </div>

                
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 border-b pb-2 print:border-b-2 print:border-black mt-4">
                    <div class="w-full">
                        <h2 class="text-xl font-black border-b border-slate-100 pb-1 mb-1">${student.name}</h2>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1 text-slate-500 text-[10px]">
                            <div>
                                <p class="text-[9px] font-bold text-slate-400 uppercase">Grade / Class</p>
                                <p class="font-bold text-slate-900">${student.grade}${student.stream ? student.stream : ''}</p>
                            </div>
                            <div>
                                <p class="text-[9px] font-bold text-slate-400 uppercase">Admission No.</p>
                                <p class="font-bold text-slate-900 font-mono">${student.admissionNo}</p>
                            </div>
                            <div>
                                <p class="text-[9px] font-bold text-slate-400 uppercase">Assess/UPI No.</p>
                                <p class="font-bold text-slate-900 font-mono">${student.assessmentNo || student.upiNo || '-'}</p>
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-2 no-print items-center">
                        <select 
                            value=${selectedTerm}
                            onChange=${(e) => setSelectedTerm(e.target.value)}
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

                <div class="grid grid-cols-2 md:grid-cols-5 print:grid-cols-5 gap-2 mt-4 print:mt-2 student-report-summary">
                    <div class="p-2 bg-blue-50 rounded-lg print:p-1.5 border border-blue-100">
                        <p class="text-[8px] text-blue-600 font-bold uppercase">Fee Balance</p>
                        <p class="text-sm font-bold print:text-[11px]">${data.settings.currency} ${balance.toLocaleString()}</p>
                    </div>
                    <div class="p-2 bg-slate-50 rounded-lg print:p-1.5 border border-slate-100">
                        <p class="text-[8px] text-slate-500 font-bold uppercase">${isFullYear ? 'Year Avg' : 'Total Marks'}</p>
                        <p class="text-sm font-bold print:text-[11px]">${isFullYear
            ? (() => {
                const allScores = [];
                yearSummary.forEach(ys => {
                    subjects.forEach(subject => {
                        const pts = ys.subjectPoints?.[subject] || 0;
                        if (pts > 0) allScores.push(pts);
                    });
                });
                if (allScores.length === 0) return '-';
                const avgPts = allScores.reduce((a, b) => a + b, 0) / allScores.length;
                return Math.round(avgPts * 12.5) + '%';
            })()
            : totalMarks}</p>
                    </div>
                    <div class="p-2 bg-green-50 rounded-lg print:p-1.5 border border-green-100">
                        <p class="text-[8px] text-green-600 font-bold uppercase">Overall %</p>
                        <p class="text-sm font-bold print:text-[11px]">${overallPercentage}%</p>
                    </div>
                    <div class="p-2 bg-blue-50 rounded-lg print:p-1.5 border border-blue-100">
                        <p class="text-[8px] text-blue-600 font-bold uppercase">AL</p>
                        <p class="text-sm font-bold print:text-[11px]">${overallAL}</p>
                    </div>
                    <div class="p-2 bg-orange-50 rounded-lg print:p-1.5 border border-orange-100">
                        <p class="text-[8px] text-orange-600 font-bold uppercase">Grade</p>
                        <p class="text-sm font-bold print:text-[11px]">${overallLevel}</p>
                    </div>
                    <div class="p-2 bg-purple-50 rounded-lg print:p-1.5 border border-purple-100">
                        <p class="text-[8px] text-purple-600 font-bold uppercase">${isFullYear ? 'Year Attend.' : 'Attendance'}</p>
                        <p class="text-sm font-bold print:text-[11px]">${attendancePercentage !== null ? attendancePercentage + '%' : '-'}</p>
                    </div>
                </div>

                ${isFullYear ? html`
                    
                    <div class="mt-4 print:mt-2">
                        <div class="border rounded-xl overflow-hidden print:border-black print:rounded-none overflow-x-auto no-scrollbar">
                            <table class="w-full text-left student-report-table">
                                <thead class="bg-slate-50 print:bg-white border-b print:border-b-2 print:border-black">
                                    <tr class="text-[9px] uppercase font-black text-slate-500">
                                        <th class="p-2 print:p-1.5" rowspan="2">Learning Area</th>
                                        <th class="p-2 print:p-1.5 text-center border-l bg-green-50" colspan="3">Term 1</th>
                                        <th class="p-2 print:p-1.5 text-center border-l bg-blue-50" colspan="3">Term 2</th>
                                        <th class="p-2 print:p-1.5 text-center border-l bg-purple-50" colspan="3">Term 3</th>
                                        <th class="p-2 print:p-1.5 text-center border-l bg-orange-50" rowspan="2">Year Avg</th>
                                        <th class="p-2 print:p-1.5 text-center border-l" rowspan="2">Level</th>
                                        <th class="p-2 print:p-1.5 text-center border-l font-black" rowspan="2">Pts</th>
                                    </tr>
                                    <tr class="text-[8px] uppercase font-black text-slate-500">
                                        <th class="p-1 print:p-0.5 text-center border-l bg-green-50">Op</th>
                                        <th class="p-1 print:p-0.5 text-center bg-green-50">Mid</th>
                                        <th class="p-1 print:p-0.5 text-center bg-green-50">End</th>
                                        <th class="p-1 print:p-0.5 text-center border-l bg-blue-50">Op</th>
                                        <th class="p-1 print:p-0.5 text-center bg-blue-50">Mid</th>
                                        <th class="p-1 print:p-0.5 text-center bg-blue-50">End</th>
                                        <th class="p-1 print:p-0.5 text-center border-l bg-purple-50">Op</th>
                                        <th class="p-1 print:p-0.5 text-center bg-purple-50">Mid</th>
                                        <th class="p-1 print:p-0.5 text-center bg-purple-50">End</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y print:divide-black">
                                    ${subjects.map(subject => {
                const academicYear = data.settings.academicYear || settings.academicYear;
                const studentIdStr = String(student.id);
                const t1Assessments = data.assessments.filter(a => String(a.studentId) === studentIdStr && a.term === 'T1' && a.subject === subject && a.academicYear === academicYear);
                const t2Assessments = data.assessments.filter(a => String(a.studentId) === studentIdStr && a.term === 'T2' && a.subject === subject && a.academicYear === academicYear);
                const t3Assessments = data.assessments.filter(a => String(a.studentId) === studentIdStr && a.term === 'T3' && a.subject === subject && a.academicYear === academicYear);

                const getScores = (termAssessments) => {
                    const scores = {};
                    examTypes.forEach(type => {
                        const match = termAssessments.find(a => a.examType === type);
                        if (match) {
                            const score = Number(match.score);
                            scores[type] = isNaN(score) ? null : score;
                        } else {
                            scores[type] = null;
                        }
                    });
                    const valid = Object.values(scores).filter(s => s !== null);
                    return {
                        scores,
                        avg: valid.length > 0 ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null
                    };
                };

                const t1 = getScores(t1Assessments);
                const t2 = getScores(t2Assessments);
                const t3 = getScores(t3Assessments);

                const yearAvgScores = [t1.avg, t2.avg, t3.avg].filter(a => a !== null);
                const yearAvg = yearAvgScores.length > 0 ? Math.round(yearAvgScores.reduce((a, b) => a + b, 0) / yearAvgScores.length) : null;
                const gradeInfo = yearAvg !== null ? Storage.getGradeInfo(yearAvg) : null;

                return html`
                                            <tr class="print:break-inside-avoid hover:bg-slate-50 border-b print:border-black">
                                                <td class="p-2 print:p-1.5 font-bold text-slate-800 print:text-[10px]">${subject}</td>
                                                <td class="p-1 print:p-0.5 text-center text-slate-500 border-l bg-green-50/30 print:text-[9px]">${t1.scores['Opener'] ?? '-'}</td>
                                                <td class="p-1 print:p-0.5 text-center text-slate-500 bg-green-50/30 print:text-[9px]">${t1.scores['Mid-Term'] ?? '-'}</td>
                                                <td class="p-1 print:p-0.5 text-center text-slate-500 bg-green-50/30 print:text-[9px]">${t1.scores['End-Term'] ?? '-'}</td>
                                                <td class="p-1 print:p-0.5 text-center text-slate-500 border-l bg-blue-50/30 print:text-[9px]">${t2.scores['Opener'] ?? '-'}</td>
                                                <td class="p-1 print:p-0.5 text-center text-slate-500 bg-blue-50/30 print:text-[9px]">${t2.scores['Mid-Term'] ?? '-'}</td>
                                                <td class="p-1 print:p-0.5 text-center text-slate-500 bg-blue-50/30 print:text-[9px]">${t2.scores['End-Term'] ?? '-'}</td>
                                                <td class="p-1 print:p-0.5 text-center text-slate-500 border-l bg-purple-50/30 print:text-[9px]">${t3.scores['Opener'] ?? '-'}</td>
                                                <td class="p-1 print:p-0.5 text-center text-slate-500 bg-purple-50/30 print:text-[9px]">${t3.scores['Mid-Term'] ?? '-'}</td>
                                                <td class="p-1 print:p-0.5 text-center text-slate-500 bg-purple-50/30 print:text-[9px]">${t3.scores['End-Term'] ?? '-'}</td>
                                                <td class="p-2 print:p-1.5 text-center font-black text-orange-600 border-l bg-orange-50/30 print:text-[10px]">${yearAvg !== null ? yearAvg + '%' : '-'}</td>
                                                <td class="p-2 print:p-1.5 text-center border-l">
                                                    <span class=${`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase ${gradeInfo && gradeInfo.level !== '-' ? (
                                                        gradeInfo.level.startsWith('EE') ? 'bg-green-100 text-green-700' :
                                                            gradeInfo.level.startsWith('ME') ? 'bg-blue-100 text-blue-700' :
                                                                gradeInfo.level.startsWith('AE') ? 'bg-yellow-100 text-yellow-700' :
                                                                    'bg-red-100 text-red-700'
                                                    ) : 'text-slate-300'
                                                    }`}>
                                                        ${gradeInfo ? gradeInfo.level : '-'}
                                                    </span>
                                                </td>
                                                <td class="p-2 print:p-1.5 text-center border-l font-black text-slate-700 print:text-[10px]">
                                                    ${gradeInfo ? gradeInfo.points : '-'}
                                                </td>
                                            </tr>
                                        `;
            })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ` : html`
                    
                    <div class="mt-4 print:mt-2">
                        <div class="border rounded-xl overflow-hidden print:border-black print:rounded-none overflow-x-auto no-scrollbar">
                            <table class="w-full text-left student-report-table">
                                <thead class="bg-slate-50 print:bg-white border-b print:border-b-2 print:border-black">
                                    <tr class="text-[9px] uppercase font-black text-slate-500">
                                        <th class="p-2 print:p-1.5">Learning Area</th>
                                        <th class="p-2 print:p-1.5 text-center border-l">Opener</th>
                                        <th class="p-2 print:p-1.5 text-center border-l">Mid</th>
                                        <th class="p-2 print:p-1.5 text-center border-l">End</th>
                                        <th class="p-2 print:p-1.5 text-center border-l bg-blue-50 text-blue-700">Average</th>
                                        <th class="p-2 print:p-1.5 text-center border-l">Level</th>
                                        <th class="p-2 print:p-1.5 text-center border-l">Teacher</th>
                                        <th class="p-2 print:p-1.5 text-center border-l min-w-[120px]">AI Comment</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y print:divide-black">
                                    ${subjects.map(subject => {
                const scores = {};
                examTypes.forEach(type => {
                    const match = assessments.find(a => a.subject === subject && a.examType === type);
                    scores[type] = match ? Number(match.score) : null;
                });

                const validScores = Object.values(scores).filter(s => s !== null);
                const average = validScores.length > 0
                    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
                    : null;

                const gradeInfo = average !== null ? Storage.getGradeInfo(average) : null;
                
                // Find registered teacher for this subject and class
                const currentGradeWithStream = student.grade + (student.stream || '');
                const teacherRecord = (data.teachers || []).find(t => {
                    const tSubjects = (t.subjects || '').toLowerCase().split(',').map(s => s.trim());
                    const tGrades = (t.grades || '').toLowerCase().split(',').map(g => g.trim());
                    return tSubjects.some(ts => subject.toLowerCase().includes(ts) || ts.includes(subject.toLowerCase())) &&
                           tGrades.some(tg => currentGradeWithStream.toLowerCase().includes(tg) || tg.includes(currentGradeWithStream.toLowerCase()));
                });

                // Generate AI Comment based on performance
                const getAiComment = (avg) => {
                    if (avg === null) return '-';
                    if (avg >= 80) return 'Exemplary performance. Consistent mastery demonstrated.';
                    if (avg >= 70) return 'Very good progress. Maintaining high standards.';
                    if (avg >= 60) return 'Good effort. Solid understanding of concepts.';
                    if (avg >= 50) return 'Steady progress. Scope for further improvement.';
                    if (avg >= 40) return 'Developing. Requires additional support and practice.';
                    return 'Needs intensive intervention and focused study.';
                };

                return html`
                                            <tr class="print:break-inside-avoid hover:bg-slate-50 border-b print:border-black last:border-0">
                                                <td class="p-2 print:p-1.5 font-bold text-slate-800 print:text-[10px]">
                                                    ${subject}
                                                </td>
                                                <td class="p-2 print:p-1.5 text-center text-slate-500 border-l font-medium print:text-[10px]">${scores['Opener'] ?? '-'}</td>
                                                <td class="p-2 print:p-1.5 text-center text-slate-500 border-l font-medium print:text-[10px]">${scores['Mid-Term'] ?? '-'}</td>
                                                <td class="p-2 print:p-1.5 text-center text-slate-500 border-l font-medium print:text-[10px]">${scores['End-Term'] ?? '-'}</td>
                                                <td class="p-2 print:p-1.5 text-center font-black text-blue-600 border-l bg-blue-50/30 print:text-[10px]">${average !== null ? average + '%' : '-'}</td>
                                                <td class="p-2 print:p-1.5 text-center border-l">
                                                    <span class=${`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${gradeInfo && gradeInfo.level !== '-' ? (
                        gradeInfo.level.startsWith('EE') ? 'bg-green-100 text-green-700' :
                            gradeInfo.level.startsWith('ME') ? 'bg-blue-100 text-blue-700' :
                                gradeInfo.level.startsWith('AE') ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'
                    ) : 'text-slate-300'
                    }`}>
                                                        ${gradeInfo ? gradeInfo.level : '-'}
                                                    </span>
                                                </td>
                                                <td class="p-2 print:p-1.5 text-center border-l text-[9px] font-medium text-slate-600">
                                                    ${teacherRecord ? teacherRecord.name : '-'}
                                                </td>
                                                <td class="p-2 print:p-1.5 text-left border-l text-[9px] italic text-slate-500 leading-tight">
                                                    ${getAiComment(average)}
                                                </td>
                                            </tr>
                                        `;
            })}
                                </tbody>
                                <tfoot class="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900">
                                    <tr class="print:border-black">
                                        <td class="p-2 print:p-1.5 uppercase text-[9px]">Totals</td>
                                        ${['Opener', 'Mid-Term', 'End-Term'].map(type => {
                const typeAssessments = assessments.filter(a => a.examType === type);
                let validScores = subjects.map(s => {
                    const m = typeAssessments.find(a => a.subject === s);
                    return m ? Number(m.score) : null;
                }).filter(s => s !== null);
                if (isSenior && validScores.length > 7) validScores = validScores.sort((a,b) => b-a).slice(0,7);
                const sum = validScores.reduce((a, b) => a + b, 0);
                return html`<td class="p-2 print:p-1.5 text-center border-l text-[9px] print:text-[10px]">${sum || '-'}</td>`;
            })}
                                        <td class="p-2 print:p-1.5 text-center border-l bg-blue-50/50 text-blue-700 text-[9px] print:text-[10px]">
                                            ${totalMarks || '-'}
                                        </td>
                                        <td class="p-2 print:p-1.5 text-center border-l font-black text-blue-700 print:text-[10px]">${overallLevel}</td>
                                        <td class="p-2 print:p-1.5 text-center border-l font-black text-slate-700 print:text-[10px]" colspan="2">
                                            OVERALL PERFORMANCE
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                `}

                
                <div class="mt-4 print:mt-2">
                    
                    <div class="p-3 bg-white border border-slate-100 rounded-xl print:border-black print:rounded-none">
                        <h4 class="text-[9px] font-black uppercase text-slate-500 mb-3 border-b pb-1">Performance Trend Analysis</h4>
                        
                        <div class="relative h-56 w-full print:h-48">
                            
                            <div class="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between text-[8px] text-slate-400 font-black">
                                <span>100%</span>
                                <span>75%</span>
                                <span>50%</span>
                                <span>25%</span>
                                <span>0%</span>
                            </div>
                            
                            <div class="absolute left-10 right-0 top-0 bottom-8 border-l border-b border-slate-200 print:border-black">
                                
                                <div class="absolute inset-0 flex flex-col justify-between pointer-events-none">
                                    <div class="border-t border-slate-100 print:border-black/20"></div>
                                    <div class="border-t border-slate-100 print:border-black/20"></div>
                                    <div class="border-t border-slate-100 print:border-black/20"></div>
                                    <div class="border-t border-slate-100 print:border-black/20"></div>
                                </div>
                                
                                <div class="absolute inset-0 pt-2 pb-8 px-4 print:pt-1 print:pb-6 print:px-2">
                                    ${(() => {
                                        const getExamScore = (subject, term, examType) => {
                                            const assessment = (data.assessments || []).find(a => 
                                                String(a.studentId) === String(student.id) && 
                                                a.term === term && 
                                                a.subject === subject &&
                                                a.examType === examType
                                            );
                                            return assessment ? Number(assessment.score) : 0;
                                        };
                                        
                                        // Detect which terms have data
                                        const hasT1 = subjects.some(subject => 
                                            ['T1', 'T2', 'T3'].some(term => 
                                                ['Opener', 'Mid-Term', 'End-Term'].some(examType => 
                                                    getExamScore(subject, term, examType) > 0
                                                )
                                            )
                                        );
                                        const hasT2 = subjects.some(subject => 
                                            ['T2', 'T3'].some(term => 
                                                ['Opener', 'Mid-Term', 'End-Term'].some(examType => 
                                                    getExamScore(subject, term, examType) > 0
                                                )
                                            )
                                        );
                                        const hasT3 = subjects.some(subject => 
                                            ['Opener', 'Mid-Term', 'End-Term'].some(examType => 
                                                getExamScore(subject, 'T3', examType) > 0
                                            )
                                        );
                                        
                                        // Determine available terms and their labels
                                        const availableTerms = [];
                                        if (hasT1) availableTerms.push({ term: 'T1', label: 'T1' });
                                        if (hasT2) availableTerms.push({ term: 'T2', label: 'T2' });
                                        if (hasT3) availableTerms.push({ term: 'T3', label: 'T3' });
                                        
                                        // If no data, default to selected term
                                        const termsToUse = availableTerms.length > 0 ? availableTerms : [{ term: selectedTerm, label: selectedTerm }];
                                        
                                        // Calculate x-positions based on number of terms
                                        const numTerms = termsToUse.length;
                                        const pointsPerTerm = 3;
                                        const totalPoints = numTerms * pointsPerTerm;
                                        
                                        // Calculate x-positions evenly distributed
                                        const xPositions = [];
                                        const step = 100 / (totalPoints + 1);
                                        for (let i = 1; i <= totalPoints; i++) {
                                            xPositions.push(step * i);
                                        }
                                        
                                        // Generate x-axis labels
                                        const xAxisLabels = [];
                                        termsToUse.forEach(({ term }) => {
                                            xAxisLabels.push(`${term}-Opener`);
                                            xAxisLabels.push(`${term}-Mid`);
                                            xAxisLabels.push(`${term}-End`);
                                        });
                                        
                                        const termData = subjects.slice(0, 5).map((subject, idx) => {
                                            let scores = [];
                                            
                                            termsToUse.forEach(({ term }) => {
                                                scores.push(getExamScore(subject, term, 'Opener'));
                                                scores.push(getExamScore(subject, term, 'Mid-Term'));
                                                scores.push(getExamScore(subject, term, 'End-Term'));
                                            });
                                            
                                            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                                            const color = colors[idx % colors.length];
                                            
                                            return { subject, scores, color };
                                        }).filter(d => d.scores.some(s => s > 0));
                                        
                                        return html`
                                            
                                            <div class="absolute -bottom-6 left-0 right-0 flex justify-around text-[7px] font-black uppercase text-slate-500 px-2">
                                                ${xAxisLabels.map(label => html`<span>${label}</span>`)}
                                            </div>
                                            
                                            <div class="absolute inset-0 pt-2 pb-8 pointer-events-none">
                                                ${xPositions.map(x => html`
                                                    <div class="absolute top-0 bottom-8 border-l border-slate-100 print:border-black/10" style=${{ left: `${x}%` }}></div>
                                                `)}
                                            </div>
                                            
                                            ${termData.map((item, idx) => {
                                                const yPositions = item.scores.map(s => 100 - s);
                                                const points = xPositions.map((x, i) => `${x},${yPositions[i]}`).join(' ');
                                                
                                                return html`
                                                    <svg class="absolute inset-0 w-full h-full pointer-events-none print:pointer-events-auto" viewBox="0 0 100 100" preserveAspectRatio="none" style=${{ zIndex: 10 - idx, overflow: 'visible' }}>
                                                        <polyline
                                                            points="${points}"
                                                            fill="none"
                                                            stroke=${item.color}
                                                            stroke-width="0.5"
                                                            vector-effect="non-scaling-stroke"
                                                        />
                                                        ${xPositions.map((x, i) => html`
                                                            <circle cx="${x}" cy="${yPositions[i]}" r="0.8" fill=${item.color} />
                                                        `)}
                                                    </svg>
                                                `;
                                            })}
                                        `;
                                    })()}
                                </div>
                            </div>
                            
                            <div class="absolute -bottom-14 left-10 right-0 flex flex-wrap gap-2 text-[8px]">
                                ${subjects.slice(0, 5).map((subject, idx) => {
                                    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                                    const color = colors[idx % colors.length];
                                    return html`
                                        <div class="flex items-center gap-1">
                                            <div class="w-2 h-2 rounded-full" style=${{ backgroundColor: color }}></div>
                                            <span class="font-bold text-slate-600">${subject}</span>
                                        </div>
                                    `;
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                
                ${!isFullYear && html`
                    <div class="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 print:border-black print:bg-white">
                        <p class="text-[10px] font-black uppercase text-slate-500 mb-2">Remarks</p>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <h4 class="text-[9px] font-bold text-slate-400 uppercase mb-1">Class Teacher</h4>
                                <p class="text-xs italic">${remark.teacher || 'No remarks provided.'}</p>
                                <div class="mt-2 pt-2 border-t border-slate-200 print:border-black">
                                    <p class="text-[8px] text-slate-400 uppercase font-bold">Signature:</p>
                                    <div class="h-8 mt-1 flex items-center">
                                        ${remark.teacherSignature ? html`
                                            <img src="${remark.teacherSignature}" class="h-6 max-w-32 object-contain" alt="Teacher Signature" />
                                        ` : html`
                                            <p class="text-[8px] text-slate-300 italic">_____________________</p>
                                        `}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h4 class="text-[9px] font-bold text-slate-400 uppercase mb-1">Principal</h4>
                                <p class="text-xs italic">${remark.principal || 'No remarks provided.'}</p>
                                <div class="mt-2 pt-2 border-t border-slate-200 print:border-black">
                                    <p class="text-[8px] text-slate-400 uppercase font-bold">Signature:</p>
                                    <div class="h-8 mt-1 flex items-center">
                                        ${remark.principalSignature ? html`
                                            <img src="${remark.principalSignature}" class="h-6 max-w-32 object-contain" alt="Principal Signature" />
                                        ` : html`
                                            <p class="text-[8px] text-slate-300 italic">_____________________</p>
                                        `}
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="mt-4 pt-4 border-t border-slate-200 print:border-black flex justify-end">
                            <div class="text-right">
                                <p class="text-[8px] text-slate-400 uppercase font-bold mb-1">School Stamp:</p>
                                <div class="inline-block">
                                    ${settings.schoolStamp ? html`
                                        <img src="${settings.schoolStamp}" class="h-12 w-12 object-contain opacity-80" alt="School Stamp" />
                                    ` : html`
                                        <div class="w-12 h-12 border-2 border-slate-300 rounded-full flex items-center justify-center">
                                            <span class="text-[6px] text-slate-300 uppercase">Stamp</span>
                                        </div>
                                    `}
                                </div>
                            </div>
                        </div>
                    </div>
                `}

                <div class="mt-8 pt-4 border-t border-slate-100 flex justify-between items-center text-[8px] text-slate-400 uppercase tracking-widest print:border-black">
                    <span>Generated: ${new Date().toLocaleString()}</span>
                    <span>${settings.schoolName} Official Report</span>
                </div>
            </div>
        </div>
    `;
};
