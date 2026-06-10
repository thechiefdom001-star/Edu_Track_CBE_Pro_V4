import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { googleSheetSync } from '../lib/googleSheetSync.js';
import { Pagination } from '../lib/pagination.js';
import { PaginationControls } from './Pagination.js';
import { PrintButtons } from './PrintButtons.js';

const html = htm.bind(h);

function safeArray(arr) {
    return Array.isArray(arr) ? arr : [];
}

function getGradeStreamOptions(grades, streams) {
    if (!streams || streams.length === 0) {
        return grades.map(g => ({ value: g, label: g }));
    }
    return grades.flatMap(grade => {
        return streams.map(stream => ({
            value: `${grade} ${stream}`,
            label: `${grade} ${stream}`
        }));
    });
}

export const Marklist = ({ data = {}, setData = () => { }, isAdmin, teacherSession, allowedSubjects = [], allowedGrades = [], allowedReligion = '' }) => {
    const settings = data?.settings || {};
    const allGrades = safeArray(settings.grades);
    
    // Teachers: ONLY show grades they're assigned to (case-insensitive)
    const grades = isAdmin ? allGrades : allGrades.filter(g => {
        const allowedLower = allowedGrades.map(ag => ag.toLowerCase());
        return allowedLower.some(ag => g.toLowerCase().includes(ag) || ag.includes(g.toLowerCase()));
    });

    // Show no access message if teacher has no grades
    if (!isAdmin && grades.length === 0) {
        return html`
            <div class="p-8 text-center">
                <div class="text-4xl mb-4">🔒</div>
                <h2 class="text-xl font-bold text-slate-700 mb-2">No Access Assigned</h2>
                <p class="text-slate-500">You have not been assigned any grades to view.</p>
            </div>
        `;
    }

    const streams = safeArray(settings.streams);
    const studentsList = safeArray(data?.students);
    const assessmentsList = safeArray(data?.assessments);
    const remarksList = safeArray(data?.remarks);

    const gradeStreamOptions = getGradeStreamOptions(grades, streams);
    const defaultGradeStream = gradeStreamOptions.length > 0 ? gradeStreamOptions[0].value : 'GRADE 1';
    const [selectedGradeStream, setSelectedGradeStream] = useState(defaultGradeStream);
    const [selectedTerm, setSelectedTerm] = useState('T1');
    const [selectedExamType, setSelectedExamType] = useState('End-Term');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [selectedGrade, selectedStream] = useMemo(() => {
        const parts = selectedGradeStream.split(' ');
        const grade = parts[0] + (parts[1] && !streams.includes(parts[1]) ? ' ' + parts[1] : '');
        const stream = parts[1] && streams.includes(parts[1]) ? parts[1] : '';
        return [grade, stream];
    }, [selectedGradeStream, streams]);

    const subjects = useMemo(() => {
        const allSubjects = safeArray(Storage.getSubjectsForGrade(selectedGrade || 'GRADE 1'));
        if (isAdmin) return allSubjects;
        const availableSubjects = allSubjects.filter(s => {
            const matchesPermission = allowedSubjects.some(as => s.toLowerCase().includes(as) || as.includes(s.toLowerCase()));
            if (!allowedReligion) return matchesPermission;
            if (s.toUpperCase().includes('CRE')) return allowedReligion === 'christian' && matchesPermission;
            if (s.toUpperCase().includes('IRE')) return allowedReligion === 'islam' && matchesPermission;
            if (s.toUpperCase().includes('HRE')) return allowedReligion === 'hindu' && matchesPermission;
            return matchesPermission;
        });
        return availableSubjects.length > 0 ? availableSubjects : ['-- No Assigned Subjects --'];
    }, [selectedGrade, isAdmin, allowedSubjects, allowedReligion]);

    const classStudents = useMemo(() => {
        return studentsList.filter(s => {
            const matchesGrade = s.grade === selectedGrade;
            const matchesStream = !selectedStream || s.stream === selectedStream;
            const matchesReligion = !allowedReligion || (s.religion && s.religion.toLowerCase() === allowedReligion.toLowerCase());
            return matchesGrade && matchesStream && matchesReligion;
        });
    }, [studentsList, selectedGrade, selectedStream, allowedReligion]);

    const filteredStudents = useMemo(() => {
        return classStudents.filter(s => {
            const matchesSearch = !searchTerm || 
                (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (s.admissionNo && s.admissionNo.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesSearch;
        });
    }, [classStudents, searchTerm]);

    // Pagination
    const handlePageChange = (newPage, newItemsPerPage) => {
        if (newItemsPerPage) {
            setItemsPerPage(newItemsPerPage);
            setCurrentPage(1);
        } else {
            setCurrentPage(newPage);
        }
    };

    const paginatedStudents = Pagination.getPageItems(filteredStudents, currentPage, itemsPerPage);

    const handleTeacherRemarkChange = (studentId, value) => {
        const existing = remarksList.find(r => r.studentId === studentId) || { teacher: '', principal: '' };
        const otherRemarks = remarksList.filter(r => r.studentId !== studentId);
        const updated = { ...existing, studentId, teacher: value };
        setData({ ...data, remarks: [...otherRemarks, updated] });
    };

    const examTypes = ['Opener', 'Mid-Term', 'End-Term'];
    const academicYear = settings.academicYear || '2025/2026';

    return html`
        <div class="space-y-6">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                <h2 class="text-2xl font-bold">Class Marklist</h2>
                <div class="flex flex-wrap gap-2 w-full md:w-auto">
                    <select 
                        class="flex-1 md:flex-none p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                        value=${selectedGradeStream}
                        onChange=${(e) => setSelectedGradeStream(e.target.value)}
                    >
                        ${gradeStreamOptions.map(gs => html`<option key=${gs.value} value=${gs.value}>${gs.label}</option>`)}
                    </select>
                    <select 
                        class="flex-1 md:flex-none p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                        value=${selectedTerm}
                        onChange=${(e) => setSelectedTerm(e.target.value)}
                    >
                        <option value="T1">Term 1</option>
                        <option value="T2">Term 2</option>
                        <option value="T3">Term 3</option>
                    </select>
                    <select 
                        class="flex-1 md:flex-none p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold"
                        value=${selectedExamType}
                        onChange=${(e) => setSelectedExamType(e.target.value)}
                    >
                        ${examTypes.map(et => html`<option key=${et} value=${et}>${et}</option>`)}
                    </select>
                    <div class="relative no-print flex-1 md:flex-none">
                        <input 
                            type="text"
                            placeholder="Search student..."
                            class="w-full md:w-48 p-2 pl-8 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500"
                            value=${searchTerm}
                            onInput=${(e) => setSearchTerm(e.target.value)}
                        />
                        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                    </div>
                    <${PrintButtons} />
                </div>
            </div>

            <div class="print-only mb-6 flex flex-col items-center text-center">
                <img src="${settings.schoolLogo || ''}" class="w-16 h-16 mb-2 object-contain" alt="Logo" />
                <h1 class="text-2xl font-black uppercase">${settings.schoolName || 'School'}</h1>
                <h2 class="text-sm font-bold uppercase text-slate-500 mt-1">Official Class Marklist - ${selectedGradeStream}</h2>
                <p class="text-[10px] font-bold text-slate-400 uppercase mt-1">${selectedTerm} | ${selectedExamType} EXAM • Academic Year: ${academicYear}</p>
            </div>

            <div class="marklist-container bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                <table class="w-full text-left border-collapse min-w-[1200px]">
                    <thead class="bg-slate-50 border-b border-slate-200">
                        <tr class="text-center print:bg-slate-100">
                            <th class="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase border-r text-left">Details</th>
                            ${subjects.map(() => html`
                                <th class="px-1 py-1 text-[8px] font-bold text-slate-400 border-r" colspan="2">Score | Level</th>
                            `)}
                            <th class="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase">Comments</th>
                        </tr>
                        <tr>
                            <th class="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase border-r">Student Name</th>
                            ${subjects.map(s => html`
                                <th key=${s} class="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase text-center border-r" colspan="2">${s}</th>
                            `)}
                            <th class="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase text-center">Remarks</th>
                        </tr>
                    </thead>
                    
                    <tbody class="divide-y divide-slate-100 marklist-screen-rows">
                        ${paginatedStudents.map(student => {
        const remark = remarksList.find(r => r.studentId === student.id) || { teacher: '', principal: '' };
        return html`
                                <tr key=${student.id} class="hover:bg-slate-50">
                                    <td class="px-4 py-3 border-r">
                                        <div class="font-bold text-sm">${student.name}</div>
                                        <div class="text-[9px] text-slate-400 uppercase">${student.admissionNo || '-'}</div>
                                    </td>
                                    ${subjects.map(subject => {
            const assessment = assessmentsList.find(a =>
                a.studentId === student.id &&
                a.subject === subject &&
                a.term === selectedTerm &&
                a.examType === selectedExamType &&
                a.academicYear === academicYear
            );
            // Calculate score from rawScore and maxScore if available
            let score = null;
            if (assessment) {
                if (assessment.score !== undefined) {
                    score = Number(assessment.score);
                } else if (assessment.rawScore !== undefined && assessment.maxScore) {
                    score = Math.round((Number(assessment.rawScore) / Number(assessment.maxScore)) * 100);
                }
            }
            const gradeInfo = score !== null ? Storage.getGradeInfo(score) : null;

            return html`
                                            <td key=${subject} class="px-1 py-3 border-r text-center">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="100"
                                                    class="w-12 text-center text-xs font-bold border border-slate-200 rounded px-1 py-1 outline-none focus:ring-1 focus:ring-blue-500 no-print"
                                                    value=${score !== null ? score : ''}
                                                    placeholder="-"
                                                    onInput=${(e) => {
                    const newScore = e.target.value ? Number(e.target.value) : null;
                    const newData = { ...data };
                    const idx = newData.assessments ? newData.assessments.findIndex(a =>
                        a.studentId === student.id &&
                        a.subject === subject &&
                        a.term === selectedTerm &&
                        a.examType === selectedExamType &&
                        a.academicYear === academicYear
                    ) : -1;

                    if (!newData.assessments) newData.assessments = [];

                    const newAssessment = {
                        id: assessment?.id || Date.now() + Math.random(),
                        studentId: student.id,
                        subject,
                        term: selectedTerm,
                        examType: selectedExamType,
                        academicYear,
                        score: newScore,
                        level: gradeInfo?.level || '-'
                    };

                    if (idx >= 0) {
                        newData.assessments[idx] = newAssessment;
                    } else {
                        newData.assessments.push(newAssessment);
                    }

                    setData(newData);

                    // Sync to Google Sheet if configured
                    if (data.settings?.googleScriptUrl) {
                        googleSheetSync.setSettings(data.settings);
                        const student = (data.students || []).find(s => String(s.id) === String(newAssessment.studentId));
                        googleSheetSync.pushAssessment({
                            ...newAssessment,
                            studentName: student?.name || 'Unknown',
                            grade: student?.grade || ''
                        }).catch(err => console.warn('Marklist Google sync failed:', err));
                    }
                }}
                                                />
                                                <span class="hidden print:inline text-xs font-bold">${score !== null ? score : '-'}</span>
                                            </td>
                                            <td class="px-1 py-3 border-r text-center">
                                                <span class="text-[8px] font-bold px-1 py-0.5 rounded ${gradeInfo?.level?.startsWith('EE') ? 'bg-green-100 text-green-700' :
                    gradeInfo?.level?.startsWith('ME') ? 'bg-blue-100 text-blue-700' :
                        gradeInfo?.level?.startsWith('AE') ? 'bg-yellow-100 text-yellow-700' :
                            gradeInfo?.level?.startsWith('BE') ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}">
                                                    ${gradeInfo?.label || '-'}
                                                </span>
                                            </td>
                                        `;
        })}
                                    <td class="px-2 py-2">
                                        <input
                                            type="text"
                                            class="w-full text-[10px] border border-slate-200 rounded px-1 py-1 outline-none focus:ring-1 focus:ring-blue-500 no-print"
                                            value=${remark.teacher || ''}
                                            placeholder="Add remark..."
                                            onInput=${(e) => handleTeacherRemarkChange(student.id, e.target.value)}
                                        />
                                        <span class="hidden print:inline text-[8px] italic">${remark.teacher || '-'}</span>
                                    </td>
                                </tr>
                            `;
    })}
                    </tbody>
                    
                    <tbody class="marklist-print-rows" style="display:none">
                        ${classStudents.map(student => {
        const remark = remarksList.find(r => r.studentId === student.id) || { teacher: '', principal: '' };
        return html`
                                <tr key=${`print-${student.id}`} class="even:bg-slate-50">
                                    <td class="px-4 py-2 border-r">
                                        <div class="font-bold text-sm">${student.name}</div>
                                        <div class="text-[9px] text-slate-400 uppercase">${student.admissionNo || '-'}</div>
                                    </td>
                                    ${subjects.map(subject => {
            const assessment = assessmentsList.find(a =>
                a.studentId === student.id &&
                a.subject === subject &&
                a.term === selectedTerm &&
                a.examType === selectedExamType &&
                a.academicYear === academicYear
            );
            const score = assessment ? Number(assessment.score) : null;
            const gradeInfo = score !== null ? Storage.getGradeInfo(score) : null;
            return html`
                                            <td key=${subject} class="px-1 py-2 border-r text-center">
                                                <span class="text-xs font-bold">${score !== null ? score : '-'}</span>
                                            </td>
                                            <td class="px-1 py-2 border-r text-center">
                                                <span class="text-[8px] font-bold px-1 py-0.5 rounded ${gradeInfo?.level?.startsWith('EE') ? 'bg-green-100 text-green-700' :
                    gradeInfo?.level?.startsWith('ME') ? 'bg-blue-100 text-blue-700' :
                        gradeInfo?.level?.startsWith('AE') ? 'bg-yellow-100 text-yellow-700' :
                            gradeInfo?.level?.startsWith('BE') ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}">
                                                    ${gradeInfo?.label || '-'}
                                                </span>
                                            </td>
                                        `;
        })}
                                    <td class="px-2 py-2">
                                        <span class="text-[8px] italic">${remark.teacher || '-'}</span>
                                    </td>
                                </tr>
                            `;
    })}
                    </tbody>
                    <tfoot class="bg-slate-50 border-t-2 border-slate-200">
                        <tr class="font-bold text-slate-900">
                            <td class="px-4 py-3 text-[10px] uppercase border-r">Column Totals</td>
                            ${subjects.map(subject => {
        const total = classStudents.reduce((sum, s) => {
            const a = assessmentsList.find(as =>
                as.studentId === s.id &&
                as.subject === subject &&
                as.term === selectedTerm &&
                as.examType === selectedExamType &&
                as.academicYear === academicYear
            );
            return sum + (a ? Number(a.score) : 0);
        }, 0);
        return html`
                                    <td key=${subject} class="px-2 py-3 text-[10px] text-center border-l bg-blue-50/30" colspan="2">
                                        ${total || '-'}
                                    </td>
                                `;
    })}
                            <td class="bg-slate-100"></td>
                        </tr>
                        <tr class="font-black text-blue-600">
                            <td class="px-4 py-3 text-[10px] uppercase border-r">Mean Average</td>
                            ${subjects.map(subject => {
        const validScores = classStudents.map(s => {
            const a = assessmentsList.find(as =>
                as.studentId === s.id &&
                as.subject === subject &&
                as.term === selectedTerm &&
                as.examType === selectedExamType &&
                as.academicYear === academicYear
            );
            return a ? Number(a.score) : null;
        }).filter(s => s !== null);
        const avg = validScores.length > 0 ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : 0;
        return html`
                                    <td key=${subject} class="px-2 py-3 text-[10px] text-center border-l bg-blue-50/50" colspan="2">
                                        ${avg ? avg + '%' : '-'}
                                    </td>
                                `;
    })}
                            <td class="bg-slate-100"></td>
                        </tr>
                    </tfoot>
                </table>
                ${filteredStudents.length > 0 && html`
                    <div class="no-print">
                        ${h(PaginationControls, {
                            currentPage,
                            onPageChange: handlePageChange,
                            totalItems: filteredStudents.length,
                            itemsPerPage
                        })}
                    </div>
                `}
                ${filteredStudents.length === 0 && html`<div class="p-12 text-center text-slate-400">No students found matching your search.</div>`}
            </div>

            <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm mt-6 marklist-graph">
                <h3 class="font-bold mb-4 print:text-sm">Class Performance Analysis (Graphical)</h3>
                
                <div class="mb-6">
                    <h4 class="text-xs font-bold text-slate-500 uppercase mb-3">Subject Mean Scores</h4>
                    <div class="space-y-3">
                        ${subjects.map(subject => {
        const validScores = classStudents.map(s => {
            const a = assessmentsList.find(as =>
                as.studentId === s.id &&
                as.subject === subject &&
                as.term === selectedTerm &&
                as.examType === selectedExamType &&
                as.academicYear === academicYear
            );
            return a ? Number(a.score) : null;
        }).filter(s => s !== null);
        const avg = validScores.length > 0 ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : 0;
        const gradeInfo = Storage.getGradeInfo(avg);
        const barColor = gradeInfo?.level?.startsWith('EE') ? 'bg-green-500' :
            gradeInfo?.level?.startsWith('ME') ? 'bg-blue-500' :
                gradeInfo?.level?.startsWith('AE') ? 'bg-yellow-500' :
                    gradeInfo?.level?.startsWith('BE') ? 'bg-red-500' : 'bg-slate-400';
        return html`
                                <div key=${subject} class="flex items-center gap-3">
                                    <span class="text-[10px] font-bold text-slate-600 w-32 truncate">${subject}</span>
                                    <div class="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                                        <div class="${barColor} h-full rounded-full marklist-bar" style="width: ${avg}%"></div>
                                    </div>
                                    <span class="text-[10px] font-bold text-slate-700 w-12 text-right">${avg}%</span>
                                    <span class="text-[8px] font-bold px-2 py-0.5 rounded ${gradeInfo?.level?.startsWith('EE') ? 'bg-green-100 text-green-700' :
                gradeInfo?.level?.startsWith('ME') ? 'bg-blue-100 text-blue-700' :
                    gradeInfo?.level?.startsWith('AE') ? 'bg-yellow-100 text-yellow-700' :
                        gradeInfo?.level?.startsWith('BE') ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}">
                                        ${gradeInfo?.label || '-'}
                                    </span>
                                </div>
                            `;
    })}
                    </div>
                </div>

                <div class="mt-6 grid grid-cols-4 gap-4">
                    <div class="p-3 bg-green-50 rounded-xl border border-green-100 text-center marklist-graph">
                        <p class="text-lg font-black text-green-700">${classStudents.length > 0 ? Math.round(classStudents.reduce((sum, s) => {
        const valid = subjects.map(subj => {
            const a = assessmentsList.find(as =>
                as.studentId === s.id &&
                as.subject === subj &&
                as.term === selectedTerm &&
                as.examType === selectedExamType &&
                as.academicYear === academicYear
            );
            return a ? Number(a.score) : null;
        }).filter(x => x !== null);
        return sum + (valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0);
    }, 0) / classStudents.length) : 0}%</p>
                        <p class="text-[8px] font-bold text-green-600 uppercase">Class Mean</p>
                    </div>
                    <div class="p-3 bg-blue-50 rounded-xl border border-blue-100 text-center marklist-graph">
                        <p class="text-lg font-black text-blue-700">${subjects.length > 0 ? Math.round(subjects.reduce((sum, s) => {
        const valid = classStudents.map(st => {
            const a = assessmentsList.find(as =>
                as.studentId === st.id &&
                as.subject === s &&
                as.term === selectedTerm &&
                as.examType === selectedExamType &&
                as.academicYear === academicYear
            );
            return a ? Number(a.score) : null;
        }).filter(x => x !== null);
        return sum + (valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0);
    }, 0) / subjects.length) : 0}%</p>
                        <p class="text-[8px] font-bold text-blue-600 uppercase">Subject Mean</p>
                    </div>
                    <div class="p-3 bg-purple-50 rounded-xl border border-purple-100 text-center marklist-graph">
                        <p class="text-lg font-black text-purple-700">${classStudents.length}</p>
                        <p class="text-[8px] font-bold text-purple-600 uppercase">Total Students</p>
                    </div>
                    <div class="p-3 bg-orange-50 rounded-xl border border-orange-100 text-center marklist-graph">
                        <p class="text-lg font-black text-orange-700">${classStudents.length > 0 ? Math.round(classStudents.reduce((sum, s) => {
        const valid = subjects.map(subj => {
            const a = assessmentsList.find(as =>
                as.studentId === s.id &&
                as.subject === subj &&
                as.term === selectedTerm &&
                as.examType === selectedExamType &&
                as.academicYear === academicYear
            );
            return a ? Number(a.score) : null;
        }).filter(x => x !== null);
        return sum + (valid.length > 0 ? valid.reduce((a, b) => a + b, 0) / valid.length : 0);
    }, 0) / classStudents.length / 12.5) || '-' : '-'}</p>
                        <p class="text-[8px] font-bold text-orange-600 uppercase">Overall Points</p>
                    </div>
                </div>
            </div>

            
            <div class="mt-6 pt-3 border-t border-slate-200 print:border-black">
                <div class="flex justify-between items-center text-[8px] text-slate-400">
                    <span>${settings.schoolName} - ${settings.schoolAddress}</span>
                    <span>Academic Year: ${academicYear}</span>
                    <span>Class Marklist - ${selectedGradeStream}</span>
                </div>
            </div>
        </div>
    `;
};
