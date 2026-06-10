import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import { Pagination } from '../lib/pagination.js';
import { PaginationControls } from './Pagination.js';
import { googleSheetSync } from '../lib/googleSheetSync.js';
import { PrintButtons } from './PrintButtons.js';

const html = htm.bind(h);

function safeArray(arr) {
    return Array.isArray(arr) ? arr : [];
}

export const Teachers = ({ data = {}, setData = () => {} }) => {
    const settings = (data && data.settings) || {};
    const grades = safeArray(settings.grades);
    const streams = safeArray(settings.streams);
    const teachersList = safeArray(data.teachers);
    
    const [showAdd, setShowAdd] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [syncStatus, setSyncStatus] = useState('');
    
    // Filtered teachers list based on search term
    const filteredTeachers = teachersList.filter(t => {
        const searchLower = searchTerm.toLowerCase();
        return !searchTerm || 
            (t.name && t.name.toLowerCase().includes(searchLower)) ||
            (t.employeeNo && t.employeeNo.toLowerCase().includes(searchLower)) ||
            (t.contact && t.contact.toLowerCase().includes(searchLower)) ||
            (t.subjects && t.subjects.toLowerCase().includes(searchLower)) ||
            (t.grades && t.grades.toLowerCase().includes(searchLower));
    });

    const [newTeacher, setNewTeacher] = useState({ 
        name: '', 
        contact: '', 
        subjects: '', 
        grades: '',
        employeeNo: '',
        nssfNo: '',
        shifNo: '',
        taxNo: '',
        isClassTeacher: false,
        classTeacherGrade: ''
    });

    const gradeStreamOptions = grades.flatMap(grade => {
        if (streams.length > 0) {
            return streams.map(stream => ({
                value: `${grade} ${stream}`,
                label: `${grade} ${stream}`
            }));
        }
        return [{ value: grade, label: grade }];
    });

    const handleAdd = async (e) => {
        e.preventDefault();
        
        let teacherToSave;
        if (editingId) {
            teacherToSave = { ...newTeacher, id: editingId };
            const updated = teachersList.map(t => t.id === editingId ? teacherToSave : t);
            setData({ ...data, teachers: updated });
            setEditingId(null);
            
            // Sync to Google
            if (data.settings.googleScriptUrl) {
                setSyncStatus('Updating Google Sheet...');
                googleSheetSync.setSettings(data.settings);
                const resp = await googleSheetSync.updateRecord('Teachers', teacherToSave);
                setSyncStatus(resp.success ? '✓ Updated in Sheet!' : '⚠ Local updated, Error in Sheet');
                setTimeout(() => setSyncStatus(''), 3000);
            }
        } else {
            const id = 'T-' + Date.now();
            teacherToSave = { ...newTeacher, id };
            setData({ ...data, teachers: [...teachersList, teacherToSave] });

            // Sync to Google
            if (data.settings.googleScriptUrl) {
                setSyncStatus('Syncing to Google...');
                googleSheetSync.setSettings(data.settings);
                // Use pushRecord for new entries (mimics Student saving logic)
                const resp = await googleSheetSync.pushRecord('Teachers', teacherToSave); 
                setSyncStatus(resp.success ? '✓ Synced!' : '⚠ Local saved, Error in Sheet');
                setTimeout(() => setSyncStatus(''), 3000);
            }
        }
        setShowAdd(false);
        resetForm();
    };

    const resetForm = () => {
        setNewTeacher({ 
            name: '', 
            contact: '', 
            subjects: '', 
            grades: '',
            employeeNo: '',
            nssfNo: '',
            shifNo: '',
            taxNo: '',
            isClassTeacher: false,
            classTeacherGrade: ''
        });
        setEditingId(null);
    };

    const handleEdit = (teacher) => {
        setNewTeacher(teacher);
        setEditingId(teacher.id);
        setShowAdd(true);
    };

    const handleDelete = async (id) => {
        if (confirm('Remove teacher from registry? This will also remove them from the Google Sheet if connected.')) {
            setData({ ...data, teachers: teachersList.filter(t => t.id !== id) });

            // Sync to Google
            if (data.settings.googleScriptUrl) {
                setSyncStatus('Deleting from Sheet...');
                googleSheetSync.setSettings(data.settings);
                const resp = await googleSheetSync.deleteTeacher(id);
                setSyncStatus(resp.success ? '✓ Deleted from Sheet!' : '⚠ Local deleted, Error in Sheet');
                setTimeout(() => setSyncStatus(''), 3000);
            }
        }
    };

    // Detect and sync deletions made in Google Sheet
    const handleSyncDeletions = async () => {
        if (!data.settings.googleScriptUrl) {
            setSyncStatus('⚠ Google Sheet not connected');
            setTimeout(() => setSyncStatus(''), 2000);
            return;
        }

        setSyncStatus('Syncing from Google Sheet...');
        googleSheetSync.setSettings(data.settings);
        
        try {
            // Fetch all data from Google Sheet
            const fetchResult = await googleSheetSync.fetchAll();
            
            if (fetchResult.success && fetchResult.teachers) {
                const googleTeachers = fetchResult.teachers;
                const localTeachers = data.teachers || [];
                
                // Create a map of local teachers by ID for easy lookup
                const localTeacherMap = new Map(localTeachers.map(t => [String(t.id), t]));
                
                // Merge: Keep local teachers, add new ones from Google, update existing ones
                const mergedTeachers = [...localTeachers];
                let addedCount = 0;
                let updatedCount = 0;
                
                googleTeachers.forEach(googleTeacher => {
                    const googleId = String(googleTeacher.id);
                    if (localTeacherMap.has(googleId)) {
                        // Update existing teacher if Google has newer data
                        const localTeacher = localTeacherMap.get(googleId);
                        const index = mergedTeachers.findIndex(t => String(t.id) === googleId);
                        if (index !== -1) {
                            mergedTeachers[index] = { ...localTeacher, ...googleTeacher };
                            updatedCount++;
                        }
                    } else {
                        // Add new teacher from Google
                        mergedTeachers.push(googleTeacher);
                        addedCount++;
                    }
                });
                
                // Check for deletions
                const deletionInfo = await googleSheetSync.detectDeletions('Teachers', mergedTeachers);
                if (deletionInfo.deletionCount > 0) {
                    const finalTeachers = mergedTeachers.filter(t => !deletionInfo.deletedIds.includes(String(t.id)));
                    setData({ ...data, teachers: finalTeachers });
                    setSyncStatus(`✓ Synced! Added ${addedCount}, Updated ${updatedCount}, Removed ${deletionInfo.deletionCount}`);
                } else {
                    setData({ ...data, teachers: mergedTeachers });
                    setSyncStatus(`✓ Synced! Added ${addedCount}, Updated ${updatedCount}`);
                }
            } else {
                // Fallback to just checking deletions if fetch fails
                const deletionInfo = await googleSheetSync.detectDeletions('Teachers', data.teachers || []);
                
                if (deletionInfo.deletionCount > 0) {
                    const updatedTeachers = data.teachers.filter(t => !deletionInfo.deletedIds.includes(String(t.id)));
                    setData({ ...data, teachers: updatedTeachers });
                    setSyncStatus(`✓ Synced! Removed ${deletionInfo.deletionCount} deleted teacher(s)`);
                } else {
                    setSyncStatus('✓ No remote changes detected');
                }
            }
            
            setTimeout(() => setSyncStatus(''), 3000);
        } catch (error) {
            console.error('Sync error:', error);
            setSyncStatus('⚠ Sync failed - please try again');
            setTimeout(() => setSyncStatus(''), 3000);
        }
    };

    const teachers = teachersList;

    // Pagination
    const handlePageChange = (newPage, newItemsPerPage) => {
        if (newItemsPerPage) {
            setItemsPerPage(newItemsPerPage);
            setCurrentPage(1);
        } else {
            setCurrentPage(newPage);
        }
    };

    const paginatedTeachers = Pagination.getPageItems(teachers, currentPage, itemsPerPage);

    return html`
        <div class="space-y-6">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                <div>
                    <h2 class="text-2xl font-bold">Teachers Registry</h2>
                    <p class="text-slate-500 text-sm">Academic staff management and assignments</p>
                    ${syncStatus && html`<p class="text-[10px] font-black uppercase text-blue-600 animate-pulse mt-1">${syncStatus}</p>`}
                </div>
                <div class="flex flex-wrap gap-2 w-full md:w-auto">
                    <div class="relative no-print">
                        <input 
                            type="text"
                            placeholder="Search name, emp no, subjects..."
                            class="bg-white border border-slate-200 text-slate-600 px-4 py-2 pl-10 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-64"
                            value=${searchTerm}
                            onInput=${(e) => setSearchTerm(e.target.value)}
                        />
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                    </div>
                    <${PrintButtons} />
                    ${data.settings.googleScriptUrl && html`
                        <button 
                            onClick=${handleSyncDeletions}
                            class="flex-1 md:flex-none bg-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm hover:bg-purple-700 no-print"
                            title="Check for teachers deleted in Google Sheet"
                        >
                            ↻ Sync from Sheet
                        </button>
                    `}
                    <button 
                        onClick=${() => { if(showAdd) resetForm(); setShowAdd(!showAdd); }}
                        class="flex-1 md:flex-none bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm hover:bg-blue-700"
                    >
                        ${showAdd ? 'Cancel' : 'Add Teacher'}
                    </button>
                </div>
            </div>

            ${showAdd && html`
                <form onSubmit=${handleAdd} class="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm space-y-4 no-print animate-in slide-in-from-top-2">
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Full Name</label>
                            <input placeholder="e.g. Jane Doe" required class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newTeacher.name} onInput=${(e) => setNewTeacher({...newTeacher, name: e.target.value})} />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Contact Number</label>
                            <input placeholder="e.g. +254 7..." required class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newTeacher.contact} onInput=${(e) => setNewTeacher({...newTeacher, contact: e.target.value})} />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Subjects (Comma separated)</label>
                            <input placeholder="e.g. Maths, Science" required class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newTeacher.subjects} onInput=${(e) => setNewTeacher({...newTeacher, subjects: e.target.value})} />
                        </div>
                        <div class="space-y-1 md:col-span-2">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Assigned Classes</label>
                            <div class="flex flex-wrap gap-1 p-2 bg-slate-50 rounded-lg min-h-[44px]">
                                ${gradeStreamOptions.map(gs => html`
                                    <label class=${`flex items-center px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                        (newTeacher.grades || '').split(',').map(s => s.trim()).includes(gs.value)
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-slate-400 border border-slate-100'
                                    }`}>
                                        <input 
                                            type="checkbox" 
                                            class="hidden"
                                            checked=${(newTeacher.grades || '').split(',').map(s => s.trim()).includes(gs.value)}
                                            onChange=${(e) => {
                                                const current = (newTeacher.grades || '').split(',').map(s => s.trim()).filter(s => s);
                                                const updated = e.target.checked 
                                                    ? [...current, gs.value]
                                                    : current.filter(c => c !== gs.value);
                                                setNewTeacher({...newTeacher, grades: updated.join(', ')});
                                            }}
                                        />
                                        ${gs.label}
                                    </label>
                                `)}
                            </div>
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Employee No.</label>
                            <input placeholder="e.g. T-001" required class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newTeacher.employeeNo} onInput=${(e) => setNewTeacher({...newTeacher, employeeNo: e.target.value})} />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">NSSF No.</label>
                            <input placeholder="e.g. 100..." class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newTeacher.nssfNo} onInput=${(e) => setNewTeacher({...newTeacher, nssfNo: e.target.value})} />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">SHIF No.</label>
                            <input placeholder="e.g. S-..." class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newTeacher.shifNo} onInput=${(e) => setNewTeacher({...newTeacher, shifNo: e.target.value})} />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Tax (PIN) No.</label>
                            <input placeholder="e.g. A00..." class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newTeacher.taxNo} onInput=${(e) => setNewTeacher({...newTeacher, taxNo: e.target.value})} />
                        </div>
                        <div class="space-y-1 md:col-span-2 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center gap-6">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    class="w-5 h-5 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                                    checked=${newTeacher.isClassTeacher}
                                    onChange=${(e) => setNewTeacher({...newTeacher, isClassTeacher: e.target.checked})}
                                />
                                <span class="text-xs font-black text-blue-800 uppercase">Is Class Teacher?</span>
                            </label>
                            
                            ${newTeacher.isClassTeacher && html`
                                <div class="flex-1 flex items-center gap-2 animate-in slide-in-from-left-2">
                                    <span class="text-[10px] font-bold text-blue-600 uppercase">For Class:</span>
                                    <select 
                                        class="flex-1 p-2 bg-white border border-blue-200 rounded-lg text-xs font-bold outline-none"
                                        value=${newTeacher.classTeacherGrade}
                                        onChange=${(e) => setNewTeacher({...newTeacher, classTeacherGrade: e.target.value})}
                                        required
                                    >
                                        <option value="">Select Class...</option>
                                        ${gradeStreamOptions.map(gs => html`<option value=${gs.value}>${gs.label}</option>`)}
                                    </select>
                                </div>
                            `}
                        </div>
                    </div>
                    <button class="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition-colors">
                        ${editingId ? 'Update Teacher Profile' : 'Register Teacher'}
                    </button>
                </form>
            `}

            
            <div class="hidden print:flex flex-col items-center text-center border-b pb-2 mb-2">
                <img src="${data.settings.schoolLogo}" class="w-12 h-12 mb-1 object-contain" alt="Logo" />
                <h1 class="text-xl font-black uppercase text-slate-900">${data.settings.schoolName}</h1>
                <p class="text-[10px] text-slate-500 font-medium">${data.settings.schoolAddress}</p>
                <div class="mt-2 border-t border-slate-200 w-full pt-2">
                    <h2 class="text-sm font-extrabold uppercase tracking-widest text-blue-600">Teachers Registry</h2>
                </div>
            </div>

            <div class="grid grid-cols-1 gap-6">
                <div class="teachers-container bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                    <table class="w-full text-left min-w-[800px]">
                        <thead class="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Name</th>
                                <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Emp No</th>
                                <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Contact</th>
                                <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Subjects</th>
                                <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Classes</th>
                                <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase no-print">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50 teachers-screen-rows">
                            ${paginatedTeachers.map(t => html`
                                <tr key=${t.id} class="hover:bg-slate-100 transition-colors even:bg-slate-50">
                                    <td class="px-6 py-4">
                                        <div class="font-bold text-sm">${t.name}</div>
                                        ${t.isClassTeacher ? html`
                                            <div class="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full inline-block font-black uppercase mt-1">
                                                Class Teacher: ${t.classTeacherGrade}
                                            </div>
                                        ` : ''}
                                    </td>
                                    <td class="px-6 py-4">
                                        <div class="text-xs font-mono text-slate-600">${t.employeeNo || t.id}</div>
                                    </td>
                                    <td class="px-6 py-4 text-slate-600 text-sm font-medium">${t.contact || 'N/A'}</td>
                                    <td class="px-6 py-4">
                                        <div class="flex flex-wrap gap-1">
                                            ${(t.subjects || t.subject || '').split(',').filter(x=>x).map(s => html`
                                                <span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">${s.trim()}</span>
                                            `)}
                                        </div>
                                    </td>
                                    <td class="px-6 py-4">
                                        <div class="flex flex-wrap gap-1">
                                            ${(t.grades || t.grade || '').split(',').filter(x=>x).map(g => html`
                                                <span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">${g.trim()}</span>
                                            `)}
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 no-print">
                                        <div class="flex gap-2">
                                            <button onClick=${() => handleEdit(t)} class="text-blue-600 text-[10px] font-bold uppercase hover:underline">Edit</button>
                                            <button onClick=${() => handleDelete(t.id)} class="text-red-500 text-[10px] font-bold uppercase hover:underline">Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            `)}
                            ${teachers.length === 0 ? html`<tr><td colspan="6" class="p-12 text-center text-slate-300">No teachers registered yet.</td></tr>` : ''}
                        </tbody>
                        
                        <tbody class="divide-y divide-slate-50 teachers-print-rows" style="display:none">
                            ${teachers.map(t => html`
                                <tr key=${t.id} class="hover:bg-slate-100 transition-colors even:bg-slate-50">
                                    <td class="px-6 py-4">
                                        <div class="font-bold text-sm">${t.name}</div>
                                        ${t.isClassTeacher ? html`
                                            <div class="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full inline-block font-black uppercase mt-1">
                                                Class Teacher: ${t.classTeacherGrade}
                                            </div>
                                        ` : ''}
                                    </td>
                                    <td class="px-6 py-4">
                                        <div class="text-xs font-mono text-slate-600">${t.employeeNo || t.id}</div>
                                    </td>
                                    <td class="px-6 py-4 text-slate-600 text-sm font-medium">${t.contact || 'N/A'}</td>
                                    <td class="px-6 py-4">
                                        <div class="flex flex-wrap gap-1">
                                            ${(t.subjects || t.subject || '').split(',').filter(x=>x).map(s => html`
                                                <span class="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase">${s.trim()}</span>
                                            `)}
                                        </div>
                                    </td>
                                    <td class="px-6 py-4">
                                        <div class="flex flex-wrap gap-1">
                                            ${(t.grades || t.grade || '').split(',').filter(x=>x).map(g => html`
                                                <span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">${g.trim()}</span>
                                            `)}
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 no-print">
                                        <div class="flex gap-2">
                                            <button onClick=${() => handleEdit(t)} class="text-blue-600 text-[10px] font-bold uppercase hover:underline">Edit</button>
                                            <button onClick=${() => handleDelete(t.id)} class="text-red-500 text-[10px] font-bold uppercase hover:underline">Delete</button>
                                        </div>
                                    </td>
                                </tr>
                            `)}
                        </tbody>
                    </table>
                    ${filteredTeachers.length > 0 && html`
                        ${h(PaginationControls, {
                            currentPage,
                            onPageChange: handlePageChange,
                            totalItems: filteredTeachers.length,
                            itemsPerPage
                        })}
                    `}
                </div>

                <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm no-print">
                    <h3 class="font-bold mb-4 flex items-center gap-2">
                        <span class="w-2 h-2 bg-blue-500 rounded-full"></span>
                        Subject Load Distribution
                    </h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        ${[...new Set(teachers.flatMap(t => (t.subjects || t.subject || '').split(',').map(s => s.trim())))].filter(s => s).map(subject => {
                            const count = teachers.filter(t => (t.subjects || t.subject || '').includes(subject)).length;
                            const totalLoad = teachers.flatMap(t => (t.subjects || t.subject || '').split(',')).length;
                            const pct = totalLoad > 0 ? (count / teachers.length) * 100 : 0;
                            return html`
                                <div class="space-y-1">
                                    <div class="flex justify-between text-xs font-bold text-slate-600">
                                        <span>${subject}</span>
                                        <span>${count} Teachers</span>
                                    </div>
                                    <div class="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div class="h-full bg-blue-500 rounded-full" style=${{ width: `${pct}%` }}></div>
                                    </div>
                                </div>
                            `;
                        })}
                        ${teachers.length === 0 && html`<div class="text-center text-slate-300 py-10">No teacher data to visualize</div>`}
                    </div>
                </div>
            </div>

            
            <div class="mt-6 pt-3 border-t border-slate-200 print:border-black">
                <div class="flex justify-between items-center text-[8px] text-slate-400">
                    <span>${data.settings.schoolName} - ${data.settings.schoolAddress}</span>
                    <span>Academic Year: ${data.settings.academicYear}</span>
                    <span>Teachers Registry</span>
                </div>
            </div>
        </div>
    `;
};