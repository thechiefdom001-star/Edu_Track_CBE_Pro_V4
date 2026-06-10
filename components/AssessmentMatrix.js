import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';

const html = htm.bind(h);

export const AssessmentMatrix = ({ data, setData, isAdmin, teacherSession, allowedSubjects = [], allowedGrades = [], allowedReligion = '', updateAssessment }) => {
    const [selectedGrade, setSelectedGrade] = useState(allowedGrades[0] || data.settings?.grades?.[0] || '');
    const [selectedTerm, setSelectedTerm] = useState('T1');
    const [selectedExamType, setSelectedExamType] = useState('Opener');
    const [searchTerm, setSearchTerm] = useState('');

    const subjects = useMemo(() => {
        if (!selectedGrade) return [];
        const all = Storage.getSubjectsForGrade(selectedGrade) || [];
        if (isAdmin) return all;
        return all.filter(s => allowedSubjects.some(as => s.toLowerCase().includes(as.toLowerCase()) || as.toLowerCase().includes(s.toLowerCase())));
    }, [selectedGrade, allowedSubjects, isAdmin]);

    const students = useMemo(() => {
        if (!selectedGrade) return [];
        return (data.students || []).filter(s => 
            s.grade === selectedGrade && 
            (!searchTerm || s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.admissionNo.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [data.students, selectedGrade, searchTerm]);

    const getScore = (studentId, subject) => {
        const assessment = (data.assessments || []).find(a => 
            String(a.studentId) === String(studentId) && 
            a.subject === subject && 
            a.term === selectedTerm && 
            a.examType === selectedExamType
        );
        return assessment ? assessment.score : '-';
    };

    return html`
        <div class="space-y-4">
            <div class="flex flex-wrap gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm no-print">
                <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-1">Grade</label>
                    <select class="p-2 bg-slate-50 border border-slate-100 rounded-lg outline-none text-sm" value=${selectedGrade} onChange=${e => setSelectedGrade(e.target.value)}>
                        ${(isAdmin ? (data.settings?.grades || []) : allowedGrades).map(g => html`<option value=${g}>${g}</option>`)}
                    </select>
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-1">Term</label>
                    <select class="p-2 bg-slate-50 border border-slate-100 rounded-lg outline-none text-sm" value=${selectedTerm} onChange=${e => setSelectedTerm(e.target.value)}>
                        <option value="T1">Term 1</option>
                        <option value="T2">Term 2</option>
                        <option value="T3">Term 3</option>
                    </select>
                </div>
                <div class="flex flex-col gap-1">
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-1">Exam</label>
                    <select class="p-2 bg-slate-50 border border-slate-100 rounded-lg outline-none text-sm" value=${selectedExamType} onChange=${e => setSelectedExamType(e.target.value)}>
                        <option value="Opener">Opener</option>
                        <option value="Mid-Term">Mid-Term</option>
                        <option value="End-Term">End-Term</option>
                    </select>
                </div>
                <div class="flex flex-col gap-1 flex-1">
                    <label class="text-[10px] font-black text-slate-400 uppercase ml-1">Search</label>
                    <input type="text" placeholder="Search student..." class="p-2 bg-slate-50 border border-slate-100 rounded-lg outline-none text-sm" value=${searchTerm} onInput=${e => setSearchTerm(e.target.value)} />
                </div>
            </div>

            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
                <table class="w-full text-left border-collapse min-w-[800px]">
                    <thead class="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th class="px-4 py-3 text-[10px] font-black text-slate-500 uppercase sticky left-0 bg-slate-50 z-10 border-r">Student</th>
                            ${subjects.map(s => html`<th class="px-2 py-3 text-[10px] font-black text-slate-500 uppercase text-center border-r">${s}</th>`)}
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-50">
                        ${students.map(student => html`
                            <tr class="hover:bg-slate-50 transition-colors">
                                <td class="px-4 py-3 font-bold text-xs sticky left-0 bg-white z-10 border-r">
                                    ${student.name}
                                    <p class="text-[8px] text-slate-400 font-mono">${student.admissionNo}</p>
                                </td>
                                ${subjects.map(subject => {
                                    const score = getScore(student.id, subject);
                                    return html`
                                        <td class="px-1 py-1 text-center border-r font-bold text-xs">
                                            <input 
                                                type="number" 
                                                class="w-full p-1 bg-white text-center outline-none focus:bg-blue-50 focus:ring-2 focus:ring-blue-400 rounded transition-colors border border-slate-200 hover:border-slate-300 cursor-text"
                                                value=${score === '-' ? '' : score}
                                                placeholder="-"
                                                min="0"
                                                max="100"
                                                step="1"
                                                onBlur=${(e) => {
                                                    const val = e.target.value.trim();
                                                    if (val !== '' && val !== String(score)) {
                                                        console.log('Updating:', {student: student.id, subject, val, term: selectedTerm, exam: selectedExamType});
                                                        updateAssessment(student.id, 'score', val, subject);
                                                    }
                                                }}
                                                onKeyPress=${(e) => {
                                                    if (e.key === 'Enter') {
                                                        const val = e.target.value.trim();
                                                        if (val !== '' && val !== String(score)) {
                                                            updateAssessment(student.id, 'score', val, subject);
                                                        }
                                                    }
                                                }}
                                            />
                                        </td>
                                    `;
                                })}
                            </tr>
                        `)}
                    </tbody>
                </table>
                ${students.length === 0 && html`<div class="p-12 text-center text-slate-400 italic">No students found for selection.</div>`}
            </div>
        </div>
    `;
};
