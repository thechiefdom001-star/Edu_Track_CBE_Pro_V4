import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { PrintButtons } from './PrintButtons.js';

const html = htm.bind(h);

export const Timetable = ({ data, setData, isAdmin, teacherSession }) => {
    const teachers = data.teachers || [];
    const activeTeacher = teacherSession ? teachers.find(t => 
        (teacherSession.name && t.name && teacherSession.name.toLowerCase() === t.name.toLowerCase()) || 
        (teacherSession.username && t.username && teacherSession.username.toLowerCase() === t.username.toLowerCase())
    ) : null;

    const [viewType, setViewType] = useState(isAdmin ? 'class' : 'teacher'); // 'class', 'teacher', 'master'
    const [selectedGroup, setSelectedGroup] = useState('primary');
    const [selectedFilter, setSelectedFilter] = useState(isAdmin ? '' : (activeTeacher?.id || ''));
    const [showAddEntry, setShowAddEntry] = useState(false);
    const [newEntry, setNewEntry] = useState({
        day: 'Monday',
        period: '1',
        subject: '',
        grade: '',
        teacherId: ''
    });

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const groups = [
        { id: 'pp', label: 'PP1 - PP2', grades: ['PP1', 'PP2'] },
        { id: 'primary', label: 'Grade 1 - 6', grades: ['GRADE 1', 'GRADE 2', 'GRADE 3', 'GRADE 4', 'GRADE 5', 'GRADE 6'] },
        { id: 'junior', label: 'Grade 7 - 9', grades: ['GRADE 7', 'GRADE 8', 'GRADE 9'] },
        { id: 'senior', label: 'Grade 10 - 12', grades: ['GRADE 10', 'GRADE 11', 'GRADE 12'] }
    ];

    const defaultSlots = [
        { id: '1', label: '08:00 - 08:40', type: 'lesson' },
        { id: '2', label: '08:40 - 09:20', type: 'lesson' },
        { id: '3', label: '09:20 - 10:00', type: 'lesson' },
        { id: 'b1', label: '10:00 - 10:30', type: 'break' },
        { id: '4', label: '10:30 - 11:10', type: 'lesson' },
        { id: '5', label: '11:10 - 11:50', type: 'lesson' },
        { id: 'b2', label: '11:50 - 12:40', type: 'break' },
        { id: '6', label: '12:40 - 01:20', type: 'lesson' },
        { id: '7', label: '01:20 - 02:00', type: 'lesson' }
    ];

    const slots = data.settings.timetableSlots || defaultSlots;
    const [showSlotManager, setShowSlotManager] = useState(false);
    
    const timetables = data.timetables || [];
    const grades = data.settings.grades || [];

    const handleAddEntry = (e) => {
        e.preventDefault();
        const updated = [...timetables, { ...newEntry, id: Date.now().toString(), academicYear: data.settings.academicYear }];
        setData({ ...data, timetables: updated });
        setShowAddEntry(false);
        setNewEntry({ ...newEntry, subject: '' });
    };

    const deleteEntry = (id) => {
        if (confirm('Delete this lesson slot?')) {
            setData({ ...data, timetables: timetables.filter(t => t.id !== id) });
        }
    };

    const getEntry = (day, slotId, filterVal, gradeOverride = null) => {
        return timetables.find(t => {
            // Only consider entries for the active academic year
            if (t.academicYear && t.academicYear !== data.settings.academicYear) return false;

            const matchesDay = t.day === day && t.period === slotId;
            if (!matchesDay) return false;
            
            if (viewType === 'master' && gradeOverride) return t.grade === gradeOverride;
            if (viewType === 'class') return t.grade === filterVal;
            if (viewType === 'teacher') return t.teacherId === filterVal;
            return true;
        });
    };

    const updateSlots = (newSlots) => {
        setData({ ...data, settings: { ...data.settings, timetableSlots: newSlots } });
    };

    const renderCell = (day, slot, gradeOverride = null) => {
        if (slot.type === 'break') return html`<div class="bg-slate-50 flex items-center justify-center text-[8px] font-black text-slate-300 uppercase tracking-tighter border-b border-r italic px-1 text-center">Break: ${slot.label}</div>`;
        
        const entry = getEntry(day, slot.id, selectedFilter, gradeOverride);
        const teacher = teachers.find(t => t.id === entry?.teacherId);

        return html`
            <div class="p-2 border-b border-r min-h-[60px] relative group hover:bg-blue-50/50 transition-colors">
                ${entry ? html`
                    <div class="space-y-1">
                        <p class="text-[10px] font-black text-blue-600 truncate uppercase">${entry.subject}</p>
                        ${viewType === 'teacher' ? html`
                            <p class="text-[9px] font-black text-slate-900 bg-slate-100 px-1 rounded inline-block mt-1">${entry.grade}</p>
                        ` : (viewType === 'master' ? html`
                            <p class="text-[7px] font-bold text-slate-400 truncate">${teacher?.name || 'No Teacher'}</p>
                        ` : html`
                            <p class="text-[8px] font-bold text-slate-400">${teacher?.name || 'No Teacher'}</p>
                        `)}
                        <button 
                            onClick=${() => deleteEntry(entry.id)}
                            class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-[10px] no-print"
                        >✕</button>
                    </div>
                ` : html`
                    <button 
                        onClick=${() => {
                            setNewEntry({ 
                                ...newEntry, 
                                day, 
                                period: slot.id, 
                                grade: gradeOverride || (viewType === 'class' ? selectedFilter : ''), 
                                teacherId: viewType === 'teacher' ? selectedFilter : '' 
                            });
                            setShowAddEntry(true);
                        }}
                        class="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-slate-300 no-print"
                    >+</button>
                `}
            </div>
        `;
    };

    return html`
        <div class="space-y-6">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                <div>
                    <h2 class="text-2xl font-bold">Academic Timetable</h2>
                    <p class="text-slate-500 text-sm">Schedule management for classes and teachers</p>
                </div>
                <div class="flex flex-wrap gap-2 w-full md:w-auto">
                    ${isAdmin && html`<button onClick=${() => setShowSlotManager(!showSlotManager)} class=${`flex-1 md:flex-none px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${showSlotManager ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                        Manage Slots/Breaks
                    </button>`}
                    <${PrintButtons} />
                    ${isAdmin && html`<button 
                        onClick=${() => setShowAddEntry(!showAddEntry)}
                        class="flex-1 md:flex-none bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm"
                    >
                        ${showAddEntry ? 'Cancel' : 'Add Lesson'}
                    </button>`}
                </div>
            </div>

            ${showSlotManager && html`
                <div class="bg-orange-50 p-6 rounded-2xl border border-orange-100 space-y-4 no-print animate-in slide-in-from-top-4">
                    <div class="flex justify-between items-center">
                        <h3 class="font-black text-xs uppercase text-orange-800 tracking-widest">Timetable Slot Configuration</h3>
                        <p class="text-[10px] text-orange-600 font-bold">Total Columns: ${slots.length}</p>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        ${slots.map((slot, index) => html`
                            <div class="bg-white p-3 rounded-xl border border-orange-100 flex items-center gap-2">
                                <span class="text-[10px] font-black text-slate-300 w-4">${index + 1}</span>
                                <input 
                                    class="flex-1 bg-slate-50 p-1.5 rounded text-[10px] font-bold outline-none border border-transparent focus:border-orange-300"
                                    value=${slot.label}
                                    onInput=${e => {
                                        const newSlots = [...slots];
                                        newSlots[index].label = e.target.value;
                                        updateSlots(newSlots);
                                    }}
                                />
                                <select 
                                    class="bg-slate-50 p-1.5 rounded text-[10px] font-black uppercase text-orange-600 outline-none"
                                    value=${slot.type}
                                    onChange=${e => {
                                        const newSlots = [...slots];
                                        newSlots[index].type = e.target.value;
                                        updateSlots(newSlots);
                                    }}
                                >
                                    <option value="lesson">Lesson</option>
                                    <option value="break">Break</option>
                                </select>
                                <button 
                                    onClick=${() => updateSlots(slots.filter((_, i) => i !== index))}
                                    class="text-red-400 hover:text-red-600"
                                >✕</button>
                            </div>
                        `)}
                        <button 
                            onClick=${() => updateSlots([...slots, { id: Date.now().toString(), label: 'New Slot', type: 'lesson' }])}
                            class="p-3 border-2 border-dashed border-orange-200 rounded-xl text-orange-400 font-black text-[10px] uppercase hover:bg-white transition-colors"
                        >
                            + Add Time Slot / Break
                        </button>
                    </div>
                </div>
            `}

            <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap gap-4 no-print items-end">
                ${isAdmin && html`<div class="space-y-1">
                    <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">View Mode</label>
                    <select 
                        class="p-2.5 bg-slate-50 rounded-xl border-0 text-sm font-bold outline-none min-w-[150px]"
                        value=${viewType}
                        onChange=${e => { setViewType(e.target.value); setSelectedFilter(''); }}
                    >
                        <option value="class">Class Timetable</option>
                        <option value="teacher">Teacher Timetable</option>
                        <option value="master">Master View</option>
                    </select>
                </div>`}

                ${viewType !== 'master' ? html`
                    <div class="space-y-1">
                        <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">
                            ${viewType === 'class' ? 'Select Grade' : 'Select Teacher'}
                        </label>
                        ${isAdmin ? html`<select 
                            class="p-2.5 bg-slate-50 rounded-xl border-0 text-sm font-bold outline-none min-w-[200px]"
                            value=${selectedFilter}
                            onChange=${e => setSelectedFilter(e.target.value)}
                        >
                            <option value="">Choose ${viewType === 'class' ? 'Grade' : 'Teacher'}...</option>
                            ${viewType === 'class' 
                                ? grades.map(g => html`<option value=${g}>${g}</option>`)
                                : teachers.map(t => html`<option value=${t.id}>${t.name}</option>`)
                            }
                        </select>` : html`<div class="p-2.5 bg-slate-50 rounded-xl border-0 text-sm font-bold min-w-[200px] text-slate-700">${activeTeacher?.name || 'Unknown Teacher'}</div>`}
                    </div>
                ` : html`
                    <div class="space-y-1">
                        <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Group Filter</label>
                        <select 
                            class="p-2.5 bg-slate-50 rounded-xl border-0 text-sm font-bold outline-none min-w-[200px]"
                            value=${selectedGroup}
                            onChange=${e => setSelectedGroup(e.target.value)}
                        >
                            ${groups.map(g => html`<option value=${g.id}>${g.label}</option>`)}
                        </select>
                    </div>
                `}
            </div>

            ${showAddEntry && html`
                <form onSubmit=${handleAddEntry} class="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4 no-print">
                    <div class="space-y-1">
                        <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Day</label>
                        <select class="w-full p-3 bg-slate-50 rounded-xl outline-none" value=${newEntry.day} onChange=${e => setNewEntry({...newEntry, day: e.target.value})}>
                            ${days.map(d => html`<option value=${d}>${d}</option>`)}
                        </select>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Time Slot</label>
                        <select class="w-full p-3 bg-slate-50 rounded-xl outline-none" value=${newEntry.period} onChange=${e => setNewEntry({...newEntry, period: e.target.value})}>
                            <option value="">Select Slot</option>
                            ${slots.filter(s => s.type === 'lesson').map(s => html`<option value=${s.id}>${s.label}</option>`)}
                        </select>
                    </div>
                    <div class="space-y-1">
                        <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Subject</label>
                        ${/* Determine grade to list subjects for: class view uses selectedFilter, otherwise use newEntry.grade */''}
                        <select required class="w-full p-3 bg-slate-50 rounded-xl outline-none"
                            value=${newEntry.subject}
                            onChange=${e => setNewEntry({...newEntry, subject: e.target.value})}
                        >
                            <option value="">Select Subject...</option>
                            ${(() => {
                                const subjectGrade = viewType === 'class' ? selectedFilter : newEntry.grade;
                                const subjectList = subjectGrade ? Storage.getSubjectsForGrade(subjectGrade) : [];
                                return subjectList.map(s => html`<option value=${s}>${s}</option>`);
                            })()}
                        </select>
                    </div>
                    ${viewType !== 'class' && html`
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Grade</label>
                            <select required class="w-full p-3 bg-slate-50 rounded-xl outline-none" value=${newEntry.grade} onChange=${e => setNewEntry({...newEntry, grade: e.target.value})}>
                                <option value="">Select Grade</option>
                                ${grades.map(g => html`<option value=${g}>${g}</option>`)}
                            </select>
                        </div>
                    `}
                    ${viewType !== 'teacher' && html`
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Teacher</label>
                            <select required class="w-full p-3 bg-slate-50 rounded-xl outline-none" value=${newEntry.teacherId} onChange=${e => setNewEntry({...newEntry, teacherId: e.target.value})}>
                                <option value="">Select Teacher</option>
                                ${teachers.map(t => html`<option value=${t.id}>${t.name}</option>`)}
                            </select>
                        </div>
                    `}
                    <div class="flex items-end md:col-span-5">
                        <button class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Save Schedule Slot</button>
                    </div>
                </form>
            `}

            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden print:border-black print:rounded-none">
                
                <div class="p-6 border-b bg-slate-50 text-center space-y-1 print:bg-white print:border-black">
                    <h1 class="text-xl font-black uppercase text-slate-900">${data.settings.schoolName}</h1>
                    <div class="flex justify-center items-center gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <span>${viewType === 'master' ? groups.find(g => g.id === selectedGroup)?.label : (selectedFilter || 'Full School')}</span>
                        <span class="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        <span>${viewType === 'master' ? 'Master Timetable' : 'Academic Timetable'}</span>
                        <span class="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                        <span>Year: ${data.settings.academicYear}</span>
                    </div>
                </div>

                
                <div class="hidden print:flex flex-col items-center text-center border-b pb-2 mb-2">
                    <img src="${data.settings.schoolLogo}" class="w-12 h-12 mb-1 object-contain" alt="Logo" />
                    <h1 class="text-xl font-black uppercase text-slate-900">${data.settings.schoolName}</h1>
                    <p class="text-[10px] text-slate-500 font-medium">${data.settings.schoolAddress}</p>
                    <div class="mt-2 border-t border-slate-200 w-full pt-2">
                        <h2 class="text-sm font-extrabold uppercase tracking-widest text-blue-600">Academic Timetable</h2>
                    </div>
                </div>
                
                <div class="timetable-container overflow-x-auto no-scrollbar">
                    <div class=${`min-w-[${Math.max(800, slots.length * 100)}px] border-l border-t print:border-black`}>
                        
                        <div class="flex bg-slate-100 border-b print:bg-white print:border-black">
                            ${viewType === 'master' ? html`
                                <div class="w-24 p-3 border-r font-black text-[10px] text-slate-400 uppercase bg-slate-50 print:border-black">Day</div>
                                <div class="w-24 p-3 border-r font-black text-[10px] text-slate-400 uppercase bg-slate-50 print:border-black">Class</div>
                            ` : html`
                                <div class="w-32 p-3 border-r font-black text-[10px] text-slate-400 uppercase bg-slate-50 print:border-black">Day / Time</div>
                            `}
                            ${slots.map(slot => html`
                                <div class=${`flex-1 p-3 border-r font-black text-[10px] text-center uppercase print:border-black ${slot.type === 'break' ? 'text-orange-600 bg-orange-50/50' : 'text-slate-500'}`}>
                                    ${slot.label}
                                </div>
                            `)}
                        </div>

                        
                        ${viewType !== 'master' ? 
                            days.map(day => html`
                                <div class="flex">
                                    <div class="w-32 p-3 border-r border-b bg-slate-50 font-black text-[10px] text-slate-500 flex items-center justify-center uppercase print:border-black">
                                        ${day}
                                    </div>
                                    ${slots.map(slot => html`
                                        <div class="flex-1 border-r border-b min-h-[70px] print:border-black">
                                            ${renderCell(day, slot)}
                                        </div>
                                    `)}
                                </div>
                            `)
                            :
                            days.map(day => {
                                const groupGrades = groups.find(g => g.id === selectedGroup)?.grades || [];
                                return groupGrades.map((grade, gIdx) => html`
                                    <div class="flex">
                                        <div class=${`w-24 p-3 border-r border-b bg-slate-100 font-black text-[10px] text-slate-500 flex items-center justify-center uppercase print:border-black ${gIdx === 0 ? '' : 'text-transparent'}`}>
                                            ${day}
                                        </div>
                                        <div class=${`w-24 p-3 border-r border-b bg-slate-50 font-bold text-[9px] text-slate-600 flex items-center justify-center uppercase print:border-black`}>
                                            ${grade}
                                        </div>
                                        ${slots.map(slot => html`
                                            <div class="flex-1 border-r border-b min-h-[60px] print:border-black">
                                                ${renderCell(day, slot, grade)}
                                            </div>
                                        `)}
                                    </div>
                                `);
                            })
                        }
                    </div>
                </div>
            </div>

            <div class="bg-blue-50 p-6 rounded-2xl border border-blue-100 no-print">
                <h4 class="text-blue-900 font-bold mb-2">Instructions</h4>
                <p class="text-blue-700 text-xs leading-relaxed">
                    Select a view mode and filter (Grade or Teacher) to see specific schedules. 
                    Hover over a slot to add a new lesson or delete an existing one. 
                    Slots with a 'Break' label are synchronized across the entire school.
                </p>
            </div>

            
            <div class="mt-6 pt-3 border-t border-slate-200 print:border-black">
                <div class="flex justify-between items-center text-[8px] text-slate-400">
                    <span>${data.settings.schoolName} - ${data.settings.schoolAddress}</span>
                    <span>Academic Year: ${data.settings.academicYear}</span>
                    <span>Timetable - ${viewType === 'master' ? 'Master' : viewType === 'class' ? 'Class: ' + selectedFilter : 'Teacher: ' + selectedFilter}</span>
                </div>
            </div>
        </div>
    `;
};