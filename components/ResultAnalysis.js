import { h } from 'preact';
import { useState, useMemo, useEffect } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { PrintButtons } from './PrintButtons.js';

const html = htm.bind(h);

export const ResultAnalysis = ({ data, onSelectStudent, isAdmin, teacherSession, allowedSubjects = [], allowedGrades = [] }) => {
    const allGrades = data?.settings?.grades || [];
    
    // Teachers: ONLY show grades they're assigned to (case-insensitive)
    const availableGrades = isAdmin ? allGrades : allGrades.filter(g => {
        const allowedLower = allowedGrades.map(ag => ag.toLowerCase());
        return allowedLower.some(ag => g.toLowerCase().includes(ag) || ag.includes(g.toLowerCase()));
    });
    
    // Show no access if no grades assigned
    if (!isAdmin && availableGrades.length === 0) {
        return html`
            <div class="p-8 text-center">
                <div class="text-4xl mb-4">🔒</div>
                <h2 class="text-xl font-bold text-slate-700 mb-2">No Access Assigned</h2>
                <p class="text-slate-500">You have not been assigned any grades to view.</p>
            </div>
        `;
    }
    
    const gradesToUse = availableGrades.length > 0 ? availableGrades : [];

    const [filterTerm, setFilterTerm] = useState('T1');
    const [filterGrade, setFilterGrade] = useState(gradesToUse[0] || '');
    const [filterStream, setFilterStream] = useState('ALL');
    const [filterSubject, setFilterSubject] = useState('ALL');
    const [filterYear, setFilterYear] = useState(data.settings?.academicYear || '2025/2026');
    const [searchName, setSearchName] = useState('');

    const streams = data?.settings?.streams || [];
    const gradeStreamOptions = streams.length > 0 ? streams : [];

    // Keep filterYear in sync with the active school setting so changing Academic Year applies immediately
    useEffect(() => {
        if (data?.settings?.academicYear) {
            setFilterYear(data.settings.academicYear);
        }
    }, [data?.settings?.academicYear]);

    const students = (data.students || []).filter(s => {
        if (s.grade !== filterGrade) return false;
        if (filterStream === 'ALL') return true;
        return s.stream === filterStream;
    });
    const assessments = data.assessments || [];
    const allSubjects = filterGrade ? Storage.getSubjectsForGrade(filterGrade) : [];
    
    // Teachers: ONLY show their subjects for the selected grade
    const availableSubjects = isAdmin ? allSubjects : allSubjects.filter(s => 
        allowedSubjects.some(as => s.toLowerCase().includes(as.toLowerCase()) || as.toLowerCase().includes(s.toLowerCase()))
    );
    const subjects = availableSubjects.length > 0 ? availableSubjects : [];
    const examTypes = ['Opener', 'Mid-Term', 'End-Term'];

    const analysisData = useMemo(() => {
        const terms = filterTerm === 'FULL' ? ['T1', 'T2', 'T3'] : [filterTerm];

        return students.map(student => {
            // Robust student matching - try multiple ID formats
            const studentAssessments = assessments.filter(a => {
                const matchById = String(a.studentId) === String(student.id);
                const matchByAdmission = a.studentAdmissionNo && 
                    String(a.studentAdmissionNo).toLowerCase() === String(student.admissionNo || '').toLowerCase();
                const matchByName = a.studentName && 
                    a.studentName.toLowerCase().trim() === student.name.toLowerCase().trim();
                return (matchById || matchByAdmission || matchByName) &&
                    terms.includes(a.term) &&
                    a.academicYear === filterYear;
            });

            const subjectAnalysis = subjects.map(subject => {
                const scores = {};
                examTypes.forEach(type => {
                    const matches = studentAssessments.filter(a => a.subject === subject && a.examType === type);
                    const avgScore = matches.length > 0
                        ? Math.round(matches.reduce((sum, m) => {
                            // Use score if available, otherwise calculate from rawScore
                            let score = Number(m.score);
                            if (isNaN(score) && m.rawScore !== undefined && m.maxScore) {
                                score = Math.round((Number(m.rawScore) / Number(m.maxScore)) * 100);
                            }
                            return sum + (isNaN(score) ? 0 : score);
                        }, 0) / matches.length)
                        : null;
                    scores[type] = avgScore;
                });

                const validScores = Object.values(scores).filter(s => s !== null);
                const average = validScores.length > 0
                    ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length)
                    : null;

                return { subject, scores, average };
            });

            const allAverages = subjectAnalysis.map(sa => sa.average).filter(avg => avg !== null);
            const overallAverage = allAverages.length > 0
                ? Math.round(allAverages.reduce((a, b) => a + b, 0) / allAverages.length)
                : 0;

            const performance = Storage.getGradeInfo(overallAverage);
            
            // Calculate overall level from array of subject averages
            const overallLevelResult = Storage.getOverallLevel(subjectAnalysis.map(sa => sa.average).filter(avg => avg !== null));
            const overallLevel = `${overallLevelResult.level}`;

            return {
                ...student,
                subjectAnalysis,
                overallAverage,
                overallScore: overallLevelResult.al || 0,
                overallLevel,
                performance
            };
        }).filter(s => s.name.toLowerCase().includes(searchName.toLowerCase()));
    }, [students, assessments, filterTerm, filterGrade, searchName]);

    const classSubjectAnalysis = useMemo(() => {
        const showTermBreakdown = filterTerm !== 'FULL';
        return subjects.map(subject => {
            let openerSum = 0, midSum = 0, endSum = 0, avgSum = 0;
            let oCount = 0, mCount = 0, eCount = 0, aCount = 0;

            analysisData.forEach(student => {
                const sa = student.subjectAnalysis.find(s => s.subject === subject);
                if (sa) {
                    if (showTermBreakdown) {
                        if (sa.scores['Opener'] !== null) { openerSum += sa.scores['Opener']; oCount++; }
                        if (sa.scores['Mid-Term'] !== null) { midSum += sa.scores['Mid-Term']; mCount++; }
                        if (sa.scores['End-Term'] !== null) { endSum += sa.scores['End-Term']; eCount++; }
                    }
                    if (sa.average !== null) { avgSum += sa.average; aCount++; }
                }
            });

            return {
                opener: showTermBreakdown && oCount > 0 ? Math.round(openerSum / oCount) : '-',
                mid: showTermBreakdown && mCount > 0 ? Math.round(midSum / mCount) : '-',
                end: showTermBreakdown && eCount > 0 ? Math.round(endSum / eCount) : '-',
                avg: aCount > 0 ? Math.round(avgSum / aCount) : '-'
            };
        });
    }, [analysisData, subjects, filterTerm]);

    const topTen = useMemo(() => {
        const sorted = [...analysisData].sort((a, b) => {
            if (filterSubject === 'ALL') {
                return b.overallAverage - a.overallAverage;
            } else {
                const aSub = a.subjectAnalysis.find(s => s.subject === filterSubject)?.average || 0;
                const bSub = b.subjectAnalysis.find(s => s.subject === filterSubject)?.average || 0;
                return bSub - aSub;
            }
        });

        // Deduplicate by student ID to ensure each student appears only once
        const seen = new Set();
        return sorted.filter(s => {
            const isValid = filterSubject === 'ALL'
                ? s.overallAverage > 0
                : (s.subjectAnalysis.find(sub => sub.subject === filterSubject)?.average || 0) > 0;

            if (!isValid) return false;
            if (seen.has(s.id)) return false;

            seen.add(s.id);
            return true;
        }).slice(0, 10);
    }, [analysisData, filterSubject]);

    const activeGradeWithStream = filterGrade + (filterStream !== 'ALL' ? filterStream : '');
    const isThisClassTeacher = teacherSession && (
        (teacherSession.role === 'class_teacher' && teacherSession.classTeacherGrade === activeGradeWithStream) ||
        (teacherSession.role === 'head_teacher') ||
        (teacherSession.role === 'admin') ||
        (data.teachers && data.teachers.some(t => 
            t.isClassTeacher && t.classTeacherGrade === activeGradeWithStream && (
                (t.name && teacherSession.name && t.name.toLowerCase() === teacherSession.name.toLowerCase()) || 
                (t.username && teacherSession.username && t.username.toLowerCase() === teacherSession.username.toLowerCase())
            )
        ))
    );

    return html`
        <div class="space-y-6">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                <div>
                    <h2 class="text-2xl font-bold">Termly Result Analysis</h2>
                    <p class="text-slate-500 text-sm">Aggregated performance across triple-exam cycles</p>
                </div>
                <div class="flex gap-2 w-full md:w-auto">
                    ${(isAdmin || isThisClassTeacher) && html`<button 
                        onClick=${() => onSelectStudent(analysisData[0]?.id, true)} 
                        class="flex-1 md:flex-none bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-blue-100 hover:bg-blue-700 transition-colors"
                        disabled=${analysisData.length === 0}
                    >
                        Print All Report Forms
                    </button>`}
                    <${PrintButtons} />
                </div>
            </div>

	            <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 no-print">
                <div class="space-y-1">
                    <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Year</label>
                    <select 
                        class="w-full p-2 bg-slate-50 rounded-lg text-xs font-bold outline-none"
                        value=${filterYear}
                        onChange=${e => setFilterYear(e.target.value)}
                    >
                        ${(() => {
            const baseYear = Number((data.settings?.academicYear || '2025/2026').split('/')[0]);
            const startYear = isNaN(baseYear) ? 2025 : baseYear - 2;
            return Array.from({ length: 7 }, (_, i) => startYear + i).map(y => html`
                                <option value="${y}/${y + 1}">${y}/${y + 1}</option>
                            `);
        })()}
                    </select>
                </div>
                <div class="space-y-1">
                    <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Term</label>
                    <select 
                        class="w-full p-2 bg-slate-50 rounded-lg text-xs font-bold outline-none"
                        value=${filterTerm}
                        onChange=${e => setFilterTerm(e.target.value)}
                    >
                        <option value="T1">Term 1</option>
                        <option value="T2">Term 2</option>
                        <option value="T3">Term 3</option>
                        <option value="FULL">Full Year</option>
                    </select>
                </div>
                <div class="space-y-1">
                    <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Grade</label>
                    <select 
                        class="w-full p-2 bg-slate-50 rounded-lg text-xs font-bold outline-none"
                        value=${filterGrade}
                        onChange=${e => { setFilterGrade(e.target.value); setFilterSubject('ALL'); }}
                    >
                        ${gradesToUse.map(g => html`<option value=${g}>${g}</option>`)}
                    </select>
                </div>
                <div class="space-y-1">
                    <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Stream</label>
                    <select 
                        class="w-full p-2 bg-slate-50 rounded-lg text-xs font-bold outline-none"
                        value=${filterStream}
                        onChange=${e => setFilterStream(e.target.value)}
                    >
                        <option value="ALL">All Streams</option>
                        ${gradeStreamOptions.map(s => html`<option value=${s}>${s}</option>`)}
                    </select>
                </div>
                <div class="space-y-1">
                    <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Subject</label>
                    <select 
                        class="w-full p-2 bg-slate-50 rounded-lg text-xs font-bold outline-none"
                        value=${filterSubject}
                        onChange=${e => setFilterSubject(e.target.value)}
                    >
                        <option value="ALL">All Subjects</option>
                        ${subjects.map(s => html`<option value=${s}>${s}</option>`)}
                    </select>
                </div>
                <div class="space-y-1 col-span-2 md:col-span-1">
                    <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Search</label>
                    <input 
                        type="text"
                        placeholder="Search student..."
                        class="w-full p-2 bg-slate-50 rounded-lg text-xs outline-none"
                        value=${searchName}
                        onInput=${e => setSearchName(e.target.value)}
                    />
                </div>
            </div>

	            <div class="print-only mb-6 flex flex-col items-center text-center">
                <img src="${data.settings.schoolLogo}" class="w-16 h-16 mb-2 object-contain" />
                <h1 class="text-2xl font-black uppercase">${data.settings.schoolName}</h1>
                <h2 class="text-sm font-bold uppercase text-slate-500 mt-1">Academic Performance Analysis - ${filterTerm === 'FULL' ? 'Full Year' : filterTerm} (${filterGrade})</h2>
                <div class="mt-4 grid grid-cols-3 w-full border-y border-slate-200 py-2 text-[10px] font-bold uppercase">
                    <span>Date: ${new Date().toLocaleDateString()}</span>
                    <span>Students: ${analysisData.length}</span>
                    <span>Academic Year: ${filterYear}</span>
                </div>
            </div>

	            <div class="no-print bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-2xl text-white shadow-xl">
                <div class="flex items-center gap-3 mb-6">
                    <span class="text-3xl">🏆</span>
                    <div>
                        <h3 class="font-black text-lg uppercase leading-tight">Top Performers</h3>
                        <p class="text-[10px] text-blue-100 font-bold uppercase tracking-widest">
                            ${filterSubject === 'ALL' ? 'Overall Class Ranking' : `${filterSubject} Excellence`} • ${filterGrade}${filterTerm === 'FULL' ? ' (Full Year)' : ''}
                        </p>
                    </div>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    ${topTen.map((s, idx) => {
            const score = filterSubject === 'ALL'
                ? s.overallAverage
                : (s.subjectAnalysis.find(sub => sub.subject === filterSubject)?.average || 0);
            return html`
                            <div class="bg-white/10 backdrop-blur-sm p-3 rounded-xl border border-white/10 flex items-center gap-3 relative overflow-hidden group">
                                <span class="text-2xl font-black text-white/20 absolute -right-2 -bottom-2 group-hover:scale-110 transition-transform">${idx + 1}</span>
                                <div class="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-black text-xs shrink-0">${idx + 1}</div>
                                <div class="min-w-0">
                                    <p class="font-bold text-xs truncate">${s.name}</p>
                                    <p class="text-[10px] font-black text-blue-200">${score}% | Score: ${s.overallScore || 0}</p>
                                </div>
                            </div>
                        `;
        })}
                    ${topTen.length === 0 && html`<p class="col-span-full text-center py-4 text-sm text-blue-200 opacity-60 italic">No ranking data available for current selection.</p>`}
                </div>
            </div>

	            <div class="print-only mb-8 border-4 border-blue-700 p-6 bg-blue-50">
                <div class="text-center mb-6 pb-4 border-b-2 border-blue-700">
                    <h2 class="text-2xl font-black uppercase text-blue-900 mb-1">🏆 TOP PERFORMERS 🏆</h2>
                    <p class="text-sm font-bold text-blue-700 uppercase tracking-widest">
                        ${filterSubject === 'ALL' ? 'Overall Class Ranking' : `${filterSubject} Excellence`} - ${filterGrade}
                    </p>
                    <p class="text-xs text-blue-600 mt-1">Academic Term: ${filterTerm === 'FULL' ? 'Full Year' : filterTerm} (${filterYear})</p>
                </div>
                <div class="grid grid-cols-1 gap-3">
                    ${topTen.map((s, idx) => {
            const score = filterSubject === 'ALL'
                ? s.overallAverage
                : (s.subjectAnalysis.find(sub => sub.subject === filterSubject)?.average || 0);
            const medalEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '⭐';
            const bgColor = idx < 3 ? (idx === 0 ? 'bg-yellow-100 border-yellow-500' : idx === 1 ? 'bg-gray-100 border-gray-500' : 'bg-orange-100 border-orange-500') : 'bg-blue-100 border-blue-400';
            return html`
                            <div class="border-l-4 ${bgColor} p-4 flex items-center justify-between font-bold">
                                <div class="flex items-center gap-4">
                                    <span class="text-3xl">${medalEmoji}</span>
                                    <div>
                                        <p class="text-lg font-black text-blue-900">Position #${idx + 1}</p>
                                        <p class="text-sm text-blue-700">${s.name}</p>
                                        <p class="text-xs text-blue-600">Admission No: ${s.admissionNo || 'N/A'}</p>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <p class="text-2xl font-black text-blue-900">${score}%</p>
                                    <p class="text-xs text-green-600 font-bold">Score: ${s.overallScore || 0} | Grade: ${s.overallLevel || '-'}</p>
                                </div>
                            </div>
                        `;
        })}
                    ${topTen.length === 0 && html`<p class="text-center py-6 text-blue-600 italic font-bold">No ranking data available for current selection.</p>`}
                </div>
            </div>

	            <div class="print-only mb-4 text-center">
                <h2 class="text-sm font-bold uppercase text-slate-600">Detailed Student Score Table — ${filterGrade} | ${filterTerm === 'FULL' ? 'Full Year' : filterTerm} (${filterYear})</h2>
            </div>

            <div class="analysis-container bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                <table class="w-full text-left border-collapse min-w-[1000px] analysis-table">
                    <thead class="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th class="px-4 py-4 text-[10px] font-black text-slate-500 uppercase border-r sticky left-0 bg-slate-50 z-10">Student Name</th>
                            ${filterTerm !== 'FULL' ? subjects.filter(s => filterSubject === 'ALL' || s === filterSubject).map(s => html`
                                <th class="px-2 py-4 text-[9px] font-black text-slate-500 uppercase text-center border-r" colspan="1">
                                    <div class="truncate max-w-[150px] mx-auto">${s}</div>
                                    <div class="flex justify-between mt-1 px-1 font-normal text-[7px] text-slate-400">
                                        <span>Opn</span>
                                        <span>Mid</span>
                                        <span>End</span>
                                        <span class="font-bold text-primary">Avg</span>
                                    </div>
                                </th>
                            `) : subjects.filter(s => filterSubject === 'ALL' || s === filterSubject).map(s => html`
                                <th class="px-2 py-4 text-[9px] font-black text-slate-500 uppercase text-center border-r">
                                    <div class="truncate max-w-[150px] mx-auto">${s}</div>
                                    <div class="mt-1 px-1 font-bold text-[7px] text-primary">Year Avg</div>
                                </th>
                            `)}
                            <th class="px-4 py-4 text-[10px] font-black text-slate-900 uppercase text-right bg-slate-100">Overall Avg</th>
                            <th class="px-4 py-4 text-[10px] font-black text-slate-900 uppercase text-center bg-slate-100 no-print">
                                <div class="flex flex-col items-center gap-1">
                                    ${(isAdmin || isThisClassTeacher) && html`
                                        <button 
                                            onClick=${() => onSelectStudent(analysisData[0]?.id, true)} 
                                            class="bg-blue-600 text-white px-3 py-1 rounded text-[8px] font-black uppercase hover:bg-blue-700 transition-all shadow-sm"
                                            title="Print cards for everyone in this class"
                                        >
                                            Print All
                                        </button>
                                    `}
                                    <span>Action</span>
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${analysisData.map(student => html`
                            <tr key=${student.id} class="hover:bg-slate-50 transition-colors">
                                <td class="px-4 py-3 font-bold text-xs border-r sticky left-0 bg-white z-10">
                                    ${student.name}
                                    <p class="text-[8px] text-slate-400 font-mono">${student.admissionNo}</p>
                                </td>
                                ${filterTerm !== 'FULL' ? student.subjectAnalysis.filter(sa => filterSubject === 'ALL' || sa.subject === filterSubject).map(sa => html`
                                    <td class="px-1 py-3 border-r">
                                        <div class="flex justify-between items-center text-[9px] gap-1 px-1">
                                            <span class="text-slate-400 w-5 text-center">${sa.scores['Opener'] ?? '-'}</span>
                                            <span class="text-slate-400 w-5 text-center">${sa.scores['Mid-Term'] ?? '-'}</span>
                                            <span class="text-slate-400 w-5 text-center">${sa.scores['End-Term'] ?? '-'}</span>
                                            <span class="font-black text-primary w-6 text-center bg-blue-50 rounded">${sa.average ?? '-'}</span>
                                        </div>
                                    </td>
                                `) : student.subjectAnalysis.filter(sa => filterSubject === 'ALL' || sa.subject === filterSubject).map(sa => html`
                                    <td class="px-2 py-3 border-r text-center">
                                        <span class="font-black text-primary text-xs bg-blue-50 px-2 py-1 rounded">${sa.average ?? '-'}</span>
                                    </td>
                                `)}
                                <td class="px-4 py-3 text-right bg-slate-50/50">
                                    <div class="flex flex-col items-end">
                                        <span class="text-sm font-black text-slate-900">${student.overallAverage}%</span>
                                        <div class="flex items-center gap-1 mt-1">
                                            <span class="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                                Score: ${student.overallScore || 0}
                                            </span>
                                            <span class="text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${student.overallLevel.startsWith('EE') ? 'bg-green-500 text-white' :
                        student.overallLevel.startsWith('ME') ? 'bg-blue-500 text-white' :
                            student.overallLevel.startsWith('AE') ? 'bg-yellow-500 text-white' :
                                'bg-red-500 text-white'
            }">${student.overallLevel}</span>
                                        </div>
                                    </div>
                                </td>
                                <td class="px-4 py-3 text-center bg-slate-50/50 no-print">
                                    <button 
                                        onClick=${() => onSelectStudent(student.id, false)}
                                        class="bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:border-primary hover:text-primary transition-all"
                                    >
                                        Detailed Report
                                    </button>
                                </td>
                            </tr>
                        `)}
                    </tbody>
                    <tfoot class="bg-slate-50 border-t-2 border-slate-200">
                        <tr class="font-bold text-[9px] text-slate-500 bg-white">
                            <td class="px-4 py-2 border-r sticky left-0 bg-white z-10 uppercase">Subject Teacher</td>
                            ${subjects.filter(s => filterSubject === 'ALL' || s === filterSubject).map(subject => {
            const currentGradeWithStream = filterGrade + (filterStream !== 'ALL' ? filterStream : '');
            const teacherRecord = (data.teachers || []).find(t => {
                const tSubjects = (t.subjects || '').toLowerCase().split(',').map(s => s.trim());
                const tGrades = (t.grades || '').toLowerCase().split(',').map(g => g.trim());
                return tSubjects.some(ts => subject.toLowerCase().includes(ts) || ts.includes(subject.toLowerCase())) &&
                    tGrades.some(tg => currentGradeWithStream.toLowerCase().includes(tg) || tg.includes(currentGradeWithStream.toLowerCase()));
            });
            return html`
                                    <td class="px-2 py-2 border-r text-center italic">
                                        ${teacherRecord ? teacherRecord.name : 'Unassigned'}
                                    </td>
                                `;
        })}
                            <td class="bg-white"></td>
                            <td class="no-print bg-white"></td>
                        </tr>
                        <tr class="font-black text-[10px] text-slate-700">
                            <td class="px-4 py-3 border-r sticky left-0 bg-slate-50 z-10 uppercase">Class Mean (Subject Analysis)</td>
                            ${filterTerm !== 'FULL' ? classSubjectAnalysis.map(ca => html`
                                <td class="px-1 py-3 border-r">
                                    <div class="flex justify-between items-center text-[9px] gap-1 px-1">
                                        <span class="text-slate-400 w-5 text-center">${ca.opener}</span>
                                        <span class="text-slate-400 w-5 text-center">${ca.mid}</span>
                                        <span class="text-slate-400 w-5 text-center">${ca.end}</span>
                                        <span class="font-black text-primary w-6 text-center bg-blue-100 rounded">${ca.avg}</span>
                                    </div>
                                </td>
                            `) : classSubjectAnalysis.map(ca => html`
                                <td class="px-2 py-3 border-r text-center">
                                    <span class="font-black text-primary text-xs bg-blue-100 px-2 py-1 rounded">${ca.avg}</span>
                                </td>
                            `)}
                            <td class="px-4 py-3 text-right bg-blue-600 text-white">
                                ${analysisData.length > 0
            ? Math.round(analysisData.reduce((a, b) => a + b.overallAverage, 0) / analysisData.length)
            : 0}%
                            </td>
                            <td class="no-print bg-slate-50"></td>
                        </tr>
                    </tfoot>
                </table>
                ${analysisData.length === 0 && html`
                    <div class="p-20 text-center text-slate-300">
                        <p class="text-4xl mb-4">📉</p>
                        <p class="font-bold">No results found for ${filterGrade} in ${filterTerm === 'FULL' ? 'Full Year' : filterTerm}</p>
                        <p class="text-xs">Ensure you have entered marks in the Assessments module.</p>
                    </div>
                `}
            </div>

	            <div class="space-y-6">
	                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm print:border-slate-300">
                        <h3 class="font-black text-xs uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                            <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            Performance Distribution
                        </h3>
                        <div class="space-y-5">
                            ${['EE', 'ME', 'AE', 'BE'].map(level => {
                const count = analysisData.filter(s => s.overallLevel.startsWith(level)).length;
                const pct = analysisData.length > 0 ? (count / analysisData.length) * 100 : 0;
                const colors = {
                    EE: 'bg-green-500 border-green-600',
                    ME: 'bg-blue-500 border-blue-600',
                    AE: 'bg-yellow-500 border-yellow-600',
                    BE: 'bg-red-500 border-red-600'
                };
                const labels = { EE: 'Exceeding', ME: 'Meeting', AE: 'Approaching', BE: 'Below' };
                return html`
                                    <div class="space-y-1.5">
                                        <div class="flex justify-between text-[10px] font-black uppercase">
                                            <span class="text-slate-500">${labels[level]} Expectations</span>
                                            <span class="text-slate-900">${count} Students (${Math.round(pct)}%)</span>
                                        </div>
                                        <div class="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100 flex">
                                            <div class=${`h-full ${colors[level]} border-r transition-all duration-1000`} style=${{ width: `${pct}%` }}></div>
                                        </div>
                                    </div>
                                `;
            })}
                        </div>
                    </div>

                    <div class="bg-blue-600 p-8 rounded-2xl shadow-lg shadow-blue-100 text-white flex flex-col justify-center relative overflow-hidden print:bg-white print:text-slate-900 print:border-2 print:border-blue-600">
                        <div class="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-3xl print:hidden"></div>
                        <h3 class="text-blue-100 print:text-blue-600 font-black text-xs uppercase tracking-widest mb-1 relative z-10">Overall Class Mean</h3>
                        <div class="flex items-baseline gap-2 relative z-10">
                            <p class="text-6xl font-black">${analysisData.length > 0
            ? Math.round(analysisData.reduce((a, b) => a + b.overallAverage, 0) / analysisData.length)
            : 0
        }%</p>
                            <span class="text-blue-200 print:text-slate-400 font-bold uppercase text-xs">Competency Score</span>
                        </div>
                        <p class="text-blue-100 print:text-slate-500 text-[10px] leading-relaxed mt-4 max-w-xs relative z-10 italic">
                            Measured across all subjects and exam cycles for ${filterTerm}. This indicates a class-wide "Meeting Expectations" status.
                        </p>
                    </div>
                </div>

                
                <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm print:border-slate-300">
                    <h3 class="font-black text-xs uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2">
                        <span class="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                        Subject-wise Performance Profile
                    </h3>
                    <div class="space-y-4">
                        ${subjects.map((subject, idx) => {
            const data = classSubjectAnalysis[idx];
            const avgVal = data.avg === '-' ? 0 : Number(data.avg);
            const barColor = avgVal >= 75 ? 'bg-green-500' : avgVal >= 50 ? 'bg-blue-500' : avgVal >= 35 ? 'bg-yellow-500' : 'bg-red-500';

            return html`
                                <div class="grid grid-cols-12 items-center gap-4">
                                    <div class="col-span-3 text-[10px] font-black uppercase text-slate-600 truncate" title=${subject}>${subject}</div>
                                    <div class="col-span-8 flex items-center gap-3">
                                        <div class="flex-1 h-4 bg-slate-50 rounded border border-slate-100 overflow-hidden">
                                            <div class=${`h-full ${barColor} transition-all duration-1000 shadow-inner`} style=${{ width: `${avgVal}%` }}></div>
                                        </div>
                                        <span class="w-10 text-[11px] font-black text-slate-900 text-right">${avgVal}%</span>
                                    </div>
                                    <div class="col-span-1 flex justify-end">
                                        <span class=${`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${avgVal >= 75 ? 'bg-green-100 text-green-700' :
                    avgVal >= 50 ? 'bg-blue-100 text-blue-700' :
                        avgVal >= 35 ? 'bg-yellow-100 text-yellow-700' :
                            'bg-red-100 text-red-700'
                }`}>
                                            ${avgVal >= 75 ? 'EE' : avgVal >= 50 ? 'ME' : avgVal >= 35 ? 'AE' : 'BE'}
                                        </span>
                                    </div>
                                </div>
                            `;
        })}
                    </div>
                    <div class="mt-8 pt-4 border-t border-slate-100 flex justify-between text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                        <span>0%</span>
                        <span>25%</span>
                        <span>50% (ME)</span>
                        <span>75% (EE)</span>
                        <span>100%</span>
                    </div>
                </div>
            </div>

	            <div class="mt-6 pt-3 border-t border-slate-200 print:border-black">
                <div class="flex justify-between items-center text-[8px] text-slate-400">
                    <span>${data.settings.schoolName} - ${data.settings.schoolAddress}</span>
                    <span>Academic Year: ${filterYear}</span>
                    <span>Performance Analysis - ${filterTerm === 'FULL' ? 'Full Year' : filterTerm}</span>
                </div>
            </div>
        </div>
    `;
};
