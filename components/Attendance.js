import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { PrintButtons } from './PrintButtons.js';
import { googleSheetSync } from '../lib/googleSheetSync.js';

const html = htm.bind(h);

const getMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return d.toISOString().split('T')[0];
};

export const Attendance = ({ data, setData, isAdmin, teacherSession, allowedGrades = [] }) => {
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
                <p class="text-slate-500">You have not been assigned any grades to manage.</p>
            </div>
        `;
    }
    
    const gradesToUse = availableGrades.length > 0 ? availableGrades : [];

    const [selectedGrade, setSelectedGrade] = useState('');
    const [selectedStream, setSelectedStream] = useState('ALL');
    const [selectedTerm, setSelectedTerm] = useState('T1');
    const [selectedWeek, setSelectedWeek] = useState(1);
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Auto-select first grade
    useEffect(() => {
        if (!selectedGrade && gradesToUse.length > 0) {
            setSelectedGrade(gradesToUse[0]);
        }
    }, [gradesToUse, selectedGrade]);

    const streams = data?.settings?.streams || [];

    const students = (data?.students || []).filter(s => {
        // Filter out students who have left the school
        if (s.status === 'left') return false;
        
        const inGrade = s.grade === selectedGrade;
        if (!inGrade) return false;
        
        const inStream = selectedStream === 'ALL' || s.stream === selectedStream;
        if (!inStream) return false;

        const matchesSearch = !searchTerm || 
            (s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (s.admissionNo && s.admissionNo.toLowerCase().includes(searchTerm.toLowerCase()));
        
        return matchesSearch;
    });
    const weeksInTerm = Storage.getWeeksForTerm(data.settings, selectedTerm);
    const currentWeek = weeksInTerm[selectedWeek - 1] || { dates: [] };

    useEffect(() => {
        if (selectedWeek > weeksInTerm.length) {
            setSelectedWeek(1);
        }
    }, [selectedTerm]);

    const getAttendanceForDate = (studentId, date) => {
        const record = data.attendance?.find(a => 
            a.studentId === studentId && 
            a.date === date &&
            a.term === selectedTerm &&
            a.academicYear === data.settings.academicYear
        );
        return record?.status || null;
    };

    const updateAttendanceForDate = (studentId, date, status) => {
        const existing = data.attendance?.find(a => 
            a.studentId === studentId && 
            a.date === date &&
            a.term === selectedTerm &&
            a.academicYear === data.settings.academicYear
        );

        const otherRecords = (data.attendance || []).filter(a => 
            !(a.studentId === studentId && a.date === date && a.term === selectedTerm && a.academicYear === data.settings.academicYear)
        );

        const newRecord = {
            id: existing?.id || (Date.now() + Math.random().toString()),
            studentId,
            date,
            term: selectedTerm,
            academicYear: data.settings.academicYear,
            status
        };

        setData({
            ...data,
            attendance: [...otherRecords, newRecord]
        });

        // attempt immediate push if sheet configured
        if (data.settings.googleScriptUrl) {
            googleSheetSync.setSettings(data.settings);
            googleSheetSync.pushAttendance(newRecord).catch(err => {
                console.warn('Attendance push failed:', err);
            });
        }
    };

    const markWeekAllPresent = () => {
        students.forEach(student => {
            currentWeek.dates.forEach(date => {
                if (date) updateAttendanceForDate(student.id, date, 'Present');
            });
        });
    };

    const markWeekAllAbsent = () => {
        students.forEach(student => {
            currentWeek.dates.forEach(date => {
                if (date) updateAttendanceForDate(student.id, date, 'Absent');
            });
        });
    };

    const getStudentTermAttendance = (studentId) => {
        return Storage.getStudentAttendance(studentId, data.attendance || [], selectedTerm);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
    };

    const getTermDatesForDisplay = () => {
        return Storage.getTermDates(data.settings, selectedTerm);
    };

    const getAllDatesInTerm = () => {
        return weeksInTerm.flatMap(w => w.dates);
    };

    return html`
        <div class="space-y-6">
            <div class="flex items-center justify-between">
                <div>
                    <h2 class="text-2xl font-black text-slate-800">Attendance Register</h2>
                    <p class="text-sm text-slate-500">
                        ${selectedGrade}${selectedStream !== 'ALL' ? selectedStream : ''} • ${selectedTerm} • Term Dates: ${getTermDatesForDisplay().start} to ${getTermDatesForDisplay().end}
                    </p>
                </div>
                <div class="flex gap-2">
                    <button 
                        onClick=${() => setShowPrintModal(true)}
                        class="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                    >
                        Print Register
                    </button>
                </div>
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label class="text-xs font-bold text-slate-500 uppercase">Grade</label>
                        <select 
                            value=${selectedGrade}
                            onChange=${(e) => setSelectedGrade(e.target.value)}
                            class="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                        >
                            ${gradesToUse.map(grade => html`<option value=${grade}>${grade}</option>`)}
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-500 uppercase">Stream</label>
                        <select 
                            value=${selectedStream}
                            onChange=${(e) => setSelectedStream(e.target.value)}
                            class="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                        >
                            <option value="ALL">All Streams</option>
                            ${streams.map(stream => html`<option value=${stream}>${stream}</option>`)}
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-500 uppercase">Term</label>
                        <select 
                            value=${selectedTerm}
                            onChange=${(e) => {
                                setSelectedTerm(e.target.value);
                                setSelectedWeek(1);
                            }}
                            class="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                        >
                            <option value="T1">Term 1</option>
                            <option value="T2">Term 2</option>
                            <option value="T3">Term 3</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-xs font-bold text-slate-500 uppercase">Week ${selectedWeek} of ${weeksInTerm.length}</label>
                        <div class="flex items-center gap-2 mt-1">
                            <button 
                                onClick=${() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
                                disabled=${selectedWeek === 1}
                                class="px-3 py-2 border rounded-lg hover:bg-slate-50 disabled:opacity-50"
                            >
                                ←
                            </button>
                            <select 
                                value=${selectedWeek}
                                onChange=${(e) => setSelectedWeek(parseInt(e.target.value))}
                                class="flex-1 px-3 py-2 border rounded-lg text-sm"
                            >
                                ${weeksInTerm.map((w, i) => html`<option value=${i + 1}>Week ${i + 1}</option>`)}
                            </select>
                            <button 
                                onClick=${() => setSelectedWeek(Math.min(weeksInTerm.length, selectedWeek + 1))}
                                disabled=${selectedWeek === weeksInTerm.length}
                                class="px-3 py-2 border rounded-lg hover:bg-slate-50 disabled:opacity-50"
                            >
                                →
                            </button>
                        </div>
                    </div>
                    <div class="flex items-end gap-2">
                        <button 
                            onClick=${markWeekAllPresent}
                            class="flex-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200"
                        >
                            All Present
                        </button>
                        <button 
                            onClick=${markWeekAllAbsent}
                            class="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200"
                        >
                            All Absent
                        </button>
                    </div>
                </div>
                <div class="mt-4 no-print relative">
                    <input 
                        type="text"
                        placeholder="Search student in this grade..."
                        class="w-full md:w-64 px-8 py-2 border rounded-lg text-sm bg-slate-50 outline-none focus:ring-2 focus:ring-blue-500"
                        value=${searchTerm}
                        onInput=${(e) => setSearchTerm(e.target.value)}
                    />
                    <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                </div>
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="p-3 bg-blue-50 border-b flex items-center justify-between">
                    <span class="text-sm font-bold text-blue-700">
                        Week ${selectedWeek} • ${formatDate(currentWeek.dates[0])} - ${formatDate(currentWeek.dates[4])}
                    </span>
                    <div class="flex gap-4 text-xs">
                        <span class="flex items-center gap-1"><span class="w-3 h-3 bg-green-100 rounded"></span> Present</span>
                        <span class="flex items-center gap-1"><span class="w-3 h-3 bg-red-100 rounded"></span> Absent</span>
                        <span class="flex items-center gap-1"><span class="w-3 h-3 bg-yellow-100 rounded"></span> Late</span>
                    </div>
                </div>
                <table class="w-full">
                    <thead class="bg-slate-50 border-b">
                        <tr>
                            <th class="p-2 text-left text-xs font-bold text-slate-500 uppercase w-48">Student</th>
                            ${currentWeek.dates.map(date => html`
                                <th class="p-2 text-center text-xs font-bold text-slate-500 uppercase">
                                    ${formatDate(date)}
                                </th>
                            `)}
                            <th class="p-2 text-center text-xs font-bold text-blue-600 uppercase bg-blue-50">Week %</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y">
                        ${students.map(student => {
                            const weekPresent = currentWeek.dates.filter(d => d && (
                                getAttendanceForDate(student.id, d) === 'Present' || 
                                getAttendanceForDate(student.id, d) === 'Late'
                            )).length;
                            const weekPercent = currentWeek.dates.filter(d => d).length > 0 
                                ? Math.round((weekPresent / currentWeek.dates.filter(d => d).length) * 100) 
                                : 0;
                            
                            return html`
                                <tr class="hover:bg-slate-50">
                                    <td class="p-2 font-medium text-sm text-slate-800">${student.name}</td>
                                    ${currentWeek.dates.map(date => {
                                        const status = date ? getAttendanceForDate(student.id, date) : null;
                                        return html`
                                            <td class="p-2 text-center">
                                                ${date ? html`
                                                    <button 
                                                        onClick=${() => {
                                                            const nextStatus = status === 'Present' ? 'Absent' : status === 'Absent' ? 'Late' : 'Present';
                                                            updateAttendanceForDate(student.id, date, nextStatus);
                                                        }}
                                                        class=${`w-8 h-8 rounded-full text-xs font-bold transition-colors ${
                                                            status === 'Present' ? 'bg-green-100 text-green-700' :
                                                            status === 'Absent' ? 'bg-red-100 text-red-700' :
                                                            status === 'Late' ? 'bg-yellow-100 text-yellow-700' :
                                                            'bg-slate-100 text-slate-400 hover:bg-blue-50'
                                                        }`}
                                                    >
                                                        ${status === 'Present' ? 'P' : status === 'Absent' ? 'A' : status === 'Late' ? 'L' : '-'}
                                                    </button>
                                                ` : ''}
                                            </td>
                                        `;
                                    })}
                                    <td class="p-2 text-center bg-blue-50/50">
                                        <span class=${`text-sm font-bold ${
                                            weekPercent >= 90 ? 'text-green-600' :
                                            weekPercent >= 75 ? 'text-blue-600' :
                                            'text-red-600'
                                        }`}>
                                            ${weekPercent}%
                                        </span>
                                    </td>
                                </tr>
                            `;
                        })}
                    </tbody>
                </table>
                ${students.length === 0 && html`
                    <div class="p-8 text-center text-slate-500">
                        No students found for ${selectedGrade}
                    </div>
                `}
            </div>

            <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                <h3 class="text-sm font-bold text-slate-700 mb-3">Term Attendance Summary - ${selectedGrade} ${selectedTerm}</h3>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    ${students.map(student => {
                        const pct = getStudentTermAttendance(student.id);
                        return html`
                            <div class="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                <span class="text-xs font-medium text-slate-700 truncate">${student.name}</span>
                                <span class=${`text-xs font-bold ${
                                    pct !== null ? (
                                        pct >= 90 ? 'text-green-600' :
                                        pct >= 75 ? 'text-blue-600' :
                                        'text-red-600'
                                    ) : 'text-slate-400'
                                }`}>
                                    ${pct !== null ? pct + '%' : '-'}
                                </span>
                            </div>
                        `;
                    })}
                </div>
            </div>

            ${showPrintModal && html`
                <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:p-0 print:bg-white">
                    <div class="bg-white rounded-2xl p-6 max-w-[95vw] w-full max-h-[90vh] overflow-auto print:max-h-none print:p-0">
                        <div class="flex justify-between items-center mb-4 no-print">
                            <h3 class="text-lg font-bold">Class Attendance Register</h3>
                            <button onClick=${() => setShowPrintModal(false)} class="text-slate-500 hover:text-slate-700">✕</button>
                        </div>
                        
                        <div class="print:block hidden">
                            <div class="text-center mb-4">
                                <h1 class="text-lg font-black uppercase">${data.settings.schoolName}</h1>
                                <p class="text-sm">Attendance Register - ${selectedGrade} ${selectedTerm}</p>
                                <p class="text-xs">Academic Year: ${data.settings.academicYear}</p>
                                <p class="text-xs">Term: ${getTermDatesForDisplay().start} to ${getTermDatesForDisplay().end}</p>
                            </div>
                        </div>

                        <div class="attendance-container overflow-x-auto">
                            <table class="w-full text-xs border-collapse">
                                <thead>
                                    <tr class="bg-slate-100">
                                        <th class="border p-2 text-left">Student</th>
                                        <th class="border p-2 text-center">Adm No.</th>
                                        ${getAllDatesInTerm().map(date => html`
                                            <th class="border p-1 text-center text-[8px]">${new Date(date).getDate()}</th>
                                        `)}
                                        <th class="border p-2 text-center bg-blue-100">Total %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${students.map(student => {
                                        const allDates = getAllDatesInTerm();
                                        const records = allDates.map(date => 
                                            data.attendance?.find(a => 
                                                a.studentId === student.id && 
                                                a.date === date &&
                                                a.term === selectedTerm &&
                                                a.academicYear === data.settings.academicYear
                                            )?.status
                                        );
                                        const present = records.filter(r => r === 'Present' || r === 'Late').length;
                                        const total = records.filter(r => r !== undefined).length;
                                        const pct = total > 0 ? Math.round((present / total) * 100) : 0;
                                        
                                        return html`
                                            <tr>
                                                <td class="border p-2 font-medium">${student.name}</td>
                                                <td class="border p-2 text-center">${student.admissionNo}</td>
                                                ${records.map(r => html`
                                                    <td class="border p-1 text-center ${
                                                        r === 'Present' ? 'bg-green-100' :
                                                        r === 'Absent' ? 'bg-red-100' :
                                                        r === 'Late' ? 'bg-yellow-100' :
                                                        ''
                                                    }">
                                                        ${r === 'Present' ? 'P' : r === 'Absent' ? 'A' : r === 'Late' ? 'L' : '-'}
                                                    </td>
                                                `)}
                                                <td class="border p-2 text-center bg-blue-50 font-bold">${pct}%</td>
                                            </tr>
                                        `;
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div class="mt-4 flex gap-2 no-print">
                            <${PrintButtons} className="flex-1" />
                            <button 
                                onClick=${() => setShowPrintModal(false)}
                                class="px-4 py-2 border rounded-lg"
                            >
                                Close
                            </button>
                        </div>

                        
                        <div class="print:block hidden mt-6 pt-3 border-t border-slate-200">
                            <div class="flex justify-between items-center text-[8px] text-slate-400">
                                <span>${data.settings.schoolName} - ${data.settings.schoolAddress}</span>
                                <span>Academic Year: ${data.settings.academicYear}</span>
                                <span>Attendance Register - ${selectedGrade}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `}
        </div>
    `;
};
