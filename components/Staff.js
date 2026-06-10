import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import { Pagination } from '../lib/pagination.js';
import { PaginationControls } from './Pagination.js';
import { googleSheetSync } from '../lib/googleSheetSync.js';
import { PrintButtons } from './PrintButtons.js';

const html = htm.bind(h);

export const Staff = ({ data, setData }) => {
    const [showAdd, setShowAdd] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [syncStatus, setSyncStatus] = useState('');
    const [newStaff, setNewStaff] = useState({ 
        name: '', 
        role: '', 
        contact: '',
        employeeNo: '',
        nssfNo: '',
        shifNo: '',
        taxNo: ''
    });

    const handleAdd = async (e) => {
        e.preventDefault();
        
        let staffToSave;
        if (editingId) {
            staffToSave = { ...newStaff, id: editingId };
            const updated = data.staff.map(s => s.id === editingId ? staffToSave : s);
            setData({ ...data, staff: updated });
            setEditingId(null);

            // Sync to Google
            if (data.settings.googleScriptUrl) {
                setSyncStatus('Updating Google Sheet...');
                googleSheetSync.setSettings(data.settings);
                const resp = await googleSheetSync.updateRecord('Staff', staffToSave);
                setSyncStatus(resp.success ? '✓ Updated in Sheet!' : '⚠ Local updated, Error in Sheet');
                setTimeout(() => setSyncStatus(''), 3000);
            }
        } else {
            const id = 'S-' + Date.now();
            staffToSave = { ...newStaff, id };
            setData({ ...data, staff: [...(data.staff || []), staffToSave] });

            // Sync to Google
            if (data.settings.googleScriptUrl) {
                setSyncStatus('Syncing to Google...');
                googleSheetSync.setSettings(data.settings);
                // Use pushRecord for new entries (mimics Student saving logic)
                const resp = await googleSheetSync.pushRecord('Staff', staffToSave);
                setSyncStatus(resp.success ? '✓ Synced!' : '⚠ Local saved, Error in Sheet');
                setTimeout(() => setSyncStatus(''), 3000);
            }
        }
        setShowAdd(false);
        resetForm();
    };

    const resetForm = () => {
        setNewStaff({ 
            name: '', 
            role: '', 
            contact: '',
            employeeNo: '',
            nssfNo: '',
            shifNo: '',
            taxNo: ''
        });
        setEditingId(null);
    };

    const handleEdit = (staffMember) => {
        setNewStaff(staffMember);
        setEditingId(staffMember.id);
        setShowAdd(true);
    };

    const handleDelete = async (id) => {
        if (confirm('Remove staff member from registry? This will also remove them from the Google Sheet if connected.')) {
            setData({ ...data, staff: (data.staff || []).filter(s => s.id !== id) });

            // Sync to Google
            if (data.settings.googleScriptUrl) {
                setSyncStatus('Deleting from Sheet...');
                googleSheetSync.setSettings(data.settings);
                const resp = await googleSheetSync.deleteStaff(id);
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

        setSyncStatus('Checking for remote deletions...');
        googleSheetSync.setSettings(data.settings);
        
        try {
            const deletionInfo = await googleSheetSync.detectDeletions('Staff', data.staff || []);
            
            if (deletionInfo.deletionCount > 0) {
                const updatedStaff = data.staff.filter(s => !deletionInfo.deletedIds.includes(String(s.id)));
                setData({ ...data, staff: updatedStaff });
                setSyncStatus(`✓ Synced! Removed ${deletionInfo.deletionCount} deleted staff member(s)`);
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

    const staffList = data.staff || [];
    
    // Filtered staff list
    const filteredStaff = staffList.filter(s => {
        const searchLower = searchTerm.toLowerCase();
        return !searchTerm || 
            (s.name && s.name.toLowerCase().includes(searchLower)) ||
            (s.role && s.role.toLowerCase().includes(searchLower)) ||
            (s.contact && s.contact.toLowerCase().includes(searchLower)) ||
            (s.employeeNo && s.employeeNo.toLowerCase().includes(searchLower));
    });

    // Pagination
    const handlePageChange = (newPage, newItemsPerPage) => {
        if (newItemsPerPage) {
            setItemsPerPage(newItemsPerPage);
            setCurrentPage(1);
        } else {
            setCurrentPage(newPage);
        }
    };

    const paginatedStaff = Pagination.getPageItems(filteredStaff, currentPage, itemsPerPage);

    return html`
        <div class="space-y-6">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                <div>
                    <h2 class="text-2xl font-bold">Support Staff Registry</h2>
                    <p class="text-slate-500 text-sm">Management of non-teaching personnel</p>
                    ${syncStatus && html`<p class="text-[10px] font-black uppercase text-blue-600 animate-pulse mt-1">${syncStatus}</p>`}
                </div>
                <div class="flex flex-wrap gap-2 w-full md:w-auto">
                    <div class="relative no-print">
                        <input 
                            type="text"
                            placeholder="Search name, role, contact..."
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
                            title="Check for staff deleted in Google Sheet"
                        >
                            ↻ Sync from Sheet
                        </button>
                    `}
                    <button 
                        onClick=${() => { if(showAdd) resetForm(); setShowAdd(!showAdd); }}
                        class="flex-1 md:flex-none bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm hover:bg-blue-700"
                    >
                        ${showAdd ? 'Cancel' : 'Add Staff'}
                    </button>
                </div>
            </div>

            ${showAdd && html`
                <form onSubmit=${handleAdd} class="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm space-y-4 no-print animate-in slide-in-from-top-2">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Full Name</label>
                            <input placeholder="e.g. Jane Doe" required class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newStaff.name} onInput=${(e) => setNewStaff({...newStaff, name: e.target.value})} />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Job Role</label>
                            <input placeholder="e.g. Bursar, Security, Cook" required class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newStaff.role} onInput=${(e) => setNewStaff({...newStaff, role: e.target.value})} />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Contact Number</label>
                            <input placeholder="e.g. 07..." required class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newStaff.contact} onInput=${(e) => setNewStaff({...newStaff, contact: e.target.value})} />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Employee No.</label>
                            <input placeholder="e.g. S-001" required class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newStaff.employeeNo} onInput=${(e) => setNewStaff({...newStaff, employeeNo: e.target.value})} />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">NSSF No.</label>
                            <input placeholder="e.g. 100..." class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newStaff.nssfNo} onInput=${(e) => setNewStaff({...newStaff, nssfNo: e.target.value})} />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">SHIF No.</label>
                            <input placeholder="e.g. S-..." class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newStaff.shifNo} onInput=${(e) => setNewStaff({...newStaff, shifNo: e.target.value})} />
                        </div>
                        <div class="space-y-1">
                            <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Tax (PIN) No.</label>
                            <input placeholder="e.g. A00..." class="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value=${newStaff.taxNo} onInput=${(e) => setNewStaff({...newStaff, taxNo: e.target.value})} />
                        </div>
                    </div>
                    <button class="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900 transition-colors">
                        ${editingId ? 'Update Staff Member' : 'Register Staff Member'}
                    </button>
                </form>
            `}

            
            <div class="hidden print:flex flex-col items-center text-center border-b pb-2 mb-2">
                <img src="${data.settings.schoolLogo}" class="w-12 h-12 mb-1 object-contain" alt="Logo" />
                <h1 class="text-xl font-black uppercase text-slate-900">${data.settings.schoolName}</h1>
                <p class="text-[10px] text-slate-500 font-medium">${data.settings.schoolAddress}</p>
                <div class="mt-2 border-t border-slate-200 w-full pt-2">
                    <h2 class="text-sm font-extrabold uppercase tracking-widest text-blue-600">Support Staff Registry</h2>
                </div>
            </div>

            <div class="staff-container bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                <table class="w-full text-left min-w-[600px]">
                    <thead class="bg-slate-50 border-b border-slate-100">
                        <tr>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Staff Name</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Role / Position</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Contact</th>
                            <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase no-print">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-50 staff-screen-rows">
                        ${paginatedStaff.map(s => html`
                            <tr key=${s.id} class="hover:bg-slate-100 transition-colors even:bg-slate-50">
                                <td class="px-6 py-4">
                                    <div class="font-bold text-sm">${s.name}</div>
                                    <div class="text-[10px] text-slate-400 uppercase font-medium">ID: ${s.employeeNo || s.id}</div>
                                </td>
                                <td class="px-6 py-4">
                                    <span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">${s.role}</span>
                                </td>
                                <td class="px-6 py-4 text-slate-600 text-sm font-medium">${s.contact || 'N/A'}</td>
                                <td class="px-6 py-4 no-print">
                                    <div class="flex gap-2">
                                        <button onClick=${() => handleEdit(s)} class="text-blue-600 text-[10px] font-bold uppercase hover:underline">Edit</button>
                                        <button onClick=${() => handleDelete(s.id)} class="text-red-500 text-[10px] font-bold uppercase hover:underline">Delete</button>
                                    </div>
                                </td>
                            </tr>
                        `)}
                        ${filteredStaff.length === 0 ? html`<tr><td colspan="4" class="p-12 text-center text-slate-300">No staff matching your search.</td></tr>` : ''}
                    </tbody>
                    
                    <tbody class="divide-y divide-slate-50 staff-print-rows" style="display:none">
                        ${staffList.map(s => html`
                            <tr key=${s.id} class="hover:bg-slate-100 transition-colors even:bg-slate-50">
                                <td class="px-6 py-4">
                                    <div class="font-bold text-sm">${s.name}</div>
                                    <div class="text-[10px] text-slate-400 uppercase font-medium">ID: ${s.employeeNo || s.id}</div>
                                </td>
                                <td class="px-6 py-4">
                                    <span class="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">${s.role}</span>
                                </td>
                                <td class="px-6 py-4 text-slate-600 text-sm font-medium">${s.contact || 'N/A'}</td>
                                <td class="px-6 py-4 no-print">
                                    <div class="flex gap-2">
                                        <button onClick=${() => handleEdit(s)} class="text-blue-600 text-[10px] font-bold uppercase hover:underline">Edit</button>
                                        <button onClick=${() => handleDelete(s.id)} class="text-red-500 text-[10px] font-bold uppercase hover:underline">Delete</button>
                                    </div>
                                </td>
                            </tr>
                        `)}
                    </tbody>
                </table>
                ${filteredStaff.length > 0 && html`
                    ${h(PaginationControls, {
                        currentPage,
                        onPageChange: handlePageChange,
                        totalItems: filteredStaff.length,
                        itemsPerPage
                    })}
                `}
            </div>

            
            <div class="mt-6 pt-3 border-t border-slate-200 print:border-black">
                <div class="flex justify-between items-center text-[8px] text-slate-400">
                    <span>${data.settings.schoolName} - ${data.settings.schoolAddress}</span>
                    <span>Academic Year: ${data.settings.academicYear}</span>
                    <span>Support Staff Registry</span>
                </div>
            </div>
        </div>
    `;
};