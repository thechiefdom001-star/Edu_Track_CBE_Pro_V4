import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import { PrintButtons } from './PrintButtons.js';

const html = htm.bind(h);

export const SeniorSchool = ({ data, setData }) => {
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [filterGrade, setFilterGrade] = useState('GRADE 10');
    const [searchTerm, setSearchTerm] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    
    const seniorGrades = ['GRADE 10', 'GRADE 11', 'GRADE 12'];
    
    const pathways = [
        { 
            id: 'STEM', 
            name: 'STEM Pathway',
            categories: [
                { name: 'Pure Sciences', subjects: ['Biology', 'Chemistry', 'Physics', 'General Science'] },
                { name: 'Applied Sciences', subjects: ['Agriculture', 'Computer Studies', 'Home Science'] },
                { name: 'Technical & Engineering', subjects: ['Aviation', 'Building Construction', 'Electricity', 'Metalwork', 'Power Mechanics', 'Woodwork'] },
                { name: 'Career Technology', subjects: ['Media Technology', 'Marine and Fisheries Technology'] }
            ]
        },
        { 
            id: 'SocialSciences', 
            name: 'Social Sciences Pathway',
            categories: [
                { name: 'Humanities', subjects: ['History and Citizenship', 'Geography', 'CRE', 'IRE', 'HRE'] },
                { name: 'Business Studies', subjects: ['Accounting', 'Economics', 'Commerce', 'Marketing'] },
                { name: 'Languages & Literature', subjects: ['Literature in English', 'Fasihi ya Kiswahili', 'Sign Language', 'French', 'German', 'Arabic', 'Mandarin'] }
            ]
        },
        { 
            id: 'ArtsSports', 
            name: 'Arts and Sports Science Pathway',
            categories: [
                { name: 'Arts', subjects: ['Fine Arts', 'Music and Dance', 'Theatre and Film', 'Applied Art', 'Time-Based Media'] },
                { name: 'Sports Science', subjects: ['Sports and Recreation', 'Human Physiology', 'Anatomy', 'Nutrition'] }
            ]
        }
    ];

    const filteredStudents = (data.students || [])
        .filter(s => seniorGrades.includes(s.grade))
        .filter(s => filterGrade === 'ALL' || s.grade === filterGrade)
        .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const currentStudent = (data.students || []).find(s => String(s.id) === String(selectedStudentId));

    const toggleElective = (subject) => {
        if (!currentStudent) return;
        
        const electives = currentStudent.seniorElectives || [];
        let updated;
        
        if (electives.includes(subject)) {
            updated = electives.filter(s => s !== subject);
        } else {
            if (electives.length >= 3) {
                alert("Students typically take only 3 electives in addition to the 4 core subjects.");
                return;
            }
            updated = [...electives, subject];
        }

        const updatedStudents = data.students.map(s => 
            s.id === selectedStudentId ? { ...s, seniorElectives: updated } : s
        );
        setData({ ...data, students: updatedStudents });
    };

    const setPathway = (pathwayId) => {
        const updatedStudents = data.students.map(s => 
            s.id === selectedStudentId ? { ...s, seniorPathway: pathwayId, seniorElectives: [] } : s
        );
        setData({ ...data, students: updatedStudents });
    };

    const handleEdit = (studentId) => {
        setSelectedStudentId(studentId);
        setIsEditing(true);
    };

    if (isEditing && currentStudent) {
        return html`
            <div class="space-y-6 animate-in fade-in duration-300">
                <div class="flex items-center gap-4">
                    <button onClick=${() => setIsEditing(false)} class="p-2 bg-slate-100 rounded-full hover:bg-slate-200">
                        <span class="text-xl">←</span>
                    </button>
                    <div>
                        <h2 class="text-2xl font-black">${currentStudent.name}</h2>
                        <p class="text-slate-500 font-bold text-xs uppercase">${currentStudent.grade} Pathway Assignment</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="lg:col-span-1 space-y-6">
                        <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <h3 class="font-bold mb-4">Core Subjects (Compulsory)</h3>
                            <div class="space-y-2">
                                ${['English', 'Kiswahili', 'Mathematics', 'CSL'].map(s => html`
                                    <div class="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 font-bold text-sm">
                                        <span>✅</span> ${s}
                                    </div>
                                `)}
                            </div>
                            <div class="mt-6 p-4 bg-slate-50 rounded-xl">
                                <h4 class="text-[10px] font-black uppercase text-slate-400 mb-2">Notice</h4>
                                <p class="text-[10px] text-slate-500 font-medium leading-relaxed">
                                    Grade 11 and 12 selections are automatically inherited from Grade 10 to ensure curriculum continuity.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div class="lg:col-span-2 space-y-6">
                        <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <h3 class="font-bold mb-4">1. Choose Career Pathway</h3>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                ${pathways.map(p => html`
                                    <button 
                                        onClick=${() => setPathway(p.id)}
                                        class=${`p-4 rounded-xl border text-left transition-all ${
                                            currentStudent.seniorPathway === p.id 
                                            ? 'bg-primary text-white border-primary shadow-lg shadow-blue-100' 
                                            : 'bg-white border-slate-100 text-slate-600 hover:border-primary'
                                        }`}
                                    >
                                        <p class="text-[10px] font-black uppercase opacity-60">Pathway</p>
                                        <p class="font-bold text-sm leading-tight">${p.name}</p>
                                    </button>
                                `)}
                            </div>
                        </div>

                        ${currentStudent.seniorPathway && html`
                            <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                                <div class="flex justify-between items-center mb-6">
                                    <h3 class="font-bold">2. Select Electives (Max 3)</h3>
                                    <span class="text-xs font-black px-2 py-1 bg-slate-100 rounded text-slate-600">
                                        ${(currentStudent.seniorElectives || []).length} / 3 Selected
                                    </span>
                                </div>
                                
                                <div class="space-y-6">
                                    ${pathways.find(p => p.id === currentStudent.seniorPathway).categories.map(cat => html`
                                        <div class="space-y-3">
                                            <h4 class="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b pb-1">${cat.name}</h4>
                                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                ${cat.subjects.map(sub => html`
                                                    <button 
                                                        onClick=${() => toggleElective(sub)}
                                                        class=${`p-3 rounded-xl border text-left text-sm font-bold transition-all ${
                                                            (currentStudent.seniorElectives || []).includes(sub)
                                                            ? 'bg-green-50 text-green-700 border-green-200'
                                                            : 'bg-slate-50 border-transparent text-slate-600 hover:bg-white hover:border-slate-200'
                                                        }`}
                                                    >
                                                        ${sub}
                                                    </button>
                                                `)}
                                            </div>
                                        </div>
                                    `)}
                                </div>
                            </div>
                        `}
                        <button 
                            onClick=${() => setIsEditing(false)}
                            class="w-full bg-primary text-white py-4 rounded-2xl font-black shadow-lg shadow-blue-200"
                        >
                            Save All Changes
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    return html`
        <div class="space-y-6">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                <div>
                    <h2 class="text-2xl font-bold">Senior School</h2>
                    <p class="text-slate-500">Pathway Management for Grades 10, 11 and 12</p>
                </div>
                <${PrintButtons} />
            </div>

            
            <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
                <div class="space-y-1">
                    <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Grade Level</label>
                    <select 
                        class="w-full p-2.5 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-primary outline-none text-sm font-bold"
                        value=${filterGrade}
                        onChange=${e => setFilterGrade(e.target.value)}
                    >
                        <option value="ALL">All Senior Grades</option>
                        ${seniorGrades.map(g => html`<option value=${g}>${g}</option>`)}
                    </select>
                </div>
                <div class="space-y-1 md:col-span-2">
                    <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Search Student</label>
                    <input 
                        type="text"
                        placeholder="Search by name or admission number..."
                        class="w-full p-2.5 bg-slate-50 rounded-xl border-0 focus:ring-2 focus:ring-primary outline-none text-sm"
                        value=${searchTerm}
                        onInput=${e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div class="print-only mb-6 flex flex-col items-center text-center">
                <img src="${data.settings.schoolLogo}" class="w-16 h-16 mb-2 object-contain" />
                <h1 class="text-2xl font-black uppercase">${data.settings.schoolName}</h1>
                <h2 class="text-sm font-bold uppercase text-slate-500 mt-1">Senior School Pathway Allocation Report</h2>
                <p class="text-[10px] text-slate-400 mt-1">Grade: ${filterGrade} | Generated: ${new Date().toLocaleDateString()}</p>
            </div>

            <div class="seniorschool-container bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                <table class="w-full text-left min-w-[700px]">
                    <thead class="bg-slate-50 border-b text-[10px] font-bold text-slate-500 uppercase">
                        <tr>
                            <th class="px-6 py-4 sticky left-0 bg-slate-50 z-10">Student</th>
                            <th class="px-6 py-4">Grade</th>
                            <th class="px-6 py-4">Pathway</th>
                            <th class="px-6 py-4">Electives</th>
                            <th class="px-6 py-4 text-center no-print">Action</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-50">
                        ${filteredStudents.map(s => html`
                            <tr key=${s.id} class="hover:bg-slate-50 transition-colors">
                                <td class="px-6 py-4 sticky left-0 bg-white group-hover:bg-slate-50 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                                    <div class="font-bold text-sm">${s.name}</div>
                                    <div class="text-[9px] text-slate-400 uppercase font-mono">${s.admissionNo}</div>
                                </td>
                                <td class="px-6 py-4">
                                    <span class="text-xs font-bold text-slate-600">${s.grade}</span>
                                </td>
                                <td class="px-6 py-4">
                                    <span class=${`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                        s.seniorPathway ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'
                                    }`}>
                                        ${s.seniorPathway ? s.seniorPathway.replace(/([A-Z])/g, ' $1') : 'Unallocated'}
                                    </span>
                                </td>
                                <td class="px-6 py-4">
                                    <div class="flex flex-wrap gap-1">
                                        ${(s.seniorElectives || []).map(e => html`
                                            <span class="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[9px] font-bold whitespace-nowrap">${e}</span>
                                        `)}
                                        ${(!s.seniorElectives || s.seniorElectives.length === 0) && html`
                                            <span class="text-slate-300 italic text-[10px]">None</span>
                                        `}
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-center no-print">
                                    <button 
                                        onPointerDown=${(e) => { e.preventDefault(); handleEdit(s.id); }}
                                        class="bg-white border border-slate-200 text-slate-600 px-4 py-3 sm:px-3 sm:py-1.5 rounded-lg text-[10px] font-black uppercase hover:border-primary hover:text-primary active:scale-95 transition-all touch-manipulation relative z-10"
                                    >
                                        ${s.grade === 'GRADE 10' ? 'Allocate Subjects' : 'Modify Choice'}
                                    </button>
                                </td>
                            </tr>
                        `)}
                        ${filteredStudents.length === 0 && html`
                            <tr><td colspan="5" class="p-20 text-center text-slate-300">No senior students found matching criteria.</td></tr>
                        `}
                    </tbody>
                </table>
            </div>

            <div class="bg-blue-50 p-6 rounded-2xl border border-blue-100 no-print">
                <h4 class="text-blue-900 font-bold mb-2 flex items-center gap-2">
                    <span class="text-lg">ℹ️</span> Automatic Continuity Notice
                </h4>
                <p class="text-blue-700 text-xs leading-relaxed">
                    Senior school pathways are designed for a 3-year cycle. Allocations made in <b>Grade 10</b> are automatically carried over to <b>Grade 11</b> and <b>Grade 12</b>. 
                    Administrators can still manually adjust choices if a student changes their specialization stream mid-course.
                </p>
            </div>

            
            <div class="mt-6 pt-3 border-t border-slate-200 print:border-black">
                <div class="flex justify-between items-center text-[8px] text-slate-400">
                    <span>${data.settings.schoolName} - ${data.settings.schoolAddress}</span>
                    <span>Academic Year: ${data.settings.academicYear}</span>
                    <span>Senior School Pathways - ${filterGrade !== 'ALL' ? filterGrade : 'All Grades'}</span>
                </div>
            </div>
        </div>
    `;
};