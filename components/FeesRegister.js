import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { PrintButtons } from './PrintButtons.js';
import { Pagination } from '../lib/pagination.js';
import { PaginationControls } from './Pagination.js';

const html = htm.bind(h);

export const FeesRegister = ({ data }) => {
    const [filterGrade, setFilterGrade] = useState('ALL');
    const [filterTerm, setFilterTerm] = useState('ALL');
    const [filterName, setFilterName] = useState('');
    const [showOnlyArrears, setShowOnlyArrears] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const students = data.students || [];
    const payments = data.payments || [];
    const settings = data.settings || {};

    const calculateStudentFees = (student) => {
        const feeStructure = settings.feeStructures?.find(f => f.grade === student.grade);
        if (!feeStructure) return { totalDue: 0, totalPaid: 0, balance: 0, termBalances: {} };

        // Normalize selectedFees in case it's a string from Google Sheets
        let selectedKeys = student.selectedFees;
        if (typeof selectedKeys === 'string') {
            selectedKeys = selectedKeys.split(',').map(f => f.trim()).filter(f => f);
        } else if (!Array.isArray(selectedKeys)) {
            selectedKeys = ['t1', 't2', 't3'];
        }
        
        // Cumulative totals - filter out voided payments
        const totalDue = (Number(student.previousArrears) || 0) + selectedKeys.reduce((sum, key) => sum + (feeStructure[key] || 0), 0);
        const totalPaid = payments
            .filter(p => String(p.studentId) === String(student.id) && !p.voided)
            .reduce((sum, p) => sum + Number(p.amount), 0);

        // Term specific totals (for the filter logic)
        const getTermDue = (term) => {
            const termKey = term.toLowerCase();
            // Term-specific items are 't1', 't2', 't3'. 
            // Others are often shared/annual, but let's assume 't1' is core for Term 1, etc.
            // For simplicity in the register, we look at the whole balance or term-tagged payments.
            const termSpecificDue = selectedKeys
                .filter(k => k === termKey)
                .reduce((sum, k) => sum + (feeStructure[k] || 0), 0);
            
            const termPaid = payments
                .filter(p => p.studentId === student.id && !p.voided && (p.term === term || !p.term))
                .reduce((sum, p) => sum + Number(p.amount), 0);
            
            return { due: termSpecificDue, paid: termPaid };
        };

        return {
            totalDue,
            totalPaid,
            balance: totalDue - totalPaid
        };
    };

    const feeColumns = [
        { key: 'admission', label: 'Admission' },
        { key: 'diary', label: 'Diary' },
        { key: 'development', label: 'Development' },
        { key: 't1', label: 'T1 Tuition' },
        { key: 't2', label: 'T2 Tuition' },
        { key: 't3', label: 'T3 Tuition' },
        { key: 'boarding', label: 'Boarding' },
        { key: 'breakfast', label: 'Breakfast' },
        { key: 'lunch', label: 'Lunch' },
        { key: 'trip', label: 'Trip' },
        { key: 'bookFund', label: 'Book Fund' },
        { key: 'caution', label: 'Caution' },
        { key: 'uniform', label: 'Uniform' },
        { key: 'studentCard', label: 'School ID' },
        { key: 'remedial', label: 'Remedials' },
        { key: 'assessmentFee', label: 'Assessment Fee' },
        { key: 'projectFee', label: 'Project Fee' },
        { key: 'activityFees', label: 'Activity Fees' },
        { key: 'tieAndBadge', label: 'Tie & Badge' },
        { key: 'academicSupport', label: 'Academic Support' },
        { key: 'pta', label: 'PTA' }
    ];

    const registerData = students.map(s => {
        const finance = Storage.getStudentFinancials(s, data.payments, data.settings);
        return { ...s, ...finance };
    });

    const filteredData = registerData.filter(s => {
        const matchGrade = filterGrade === 'ALL' || s.grade === filterGrade;
        const matchName = s.name.toLowerCase().includes(filterName.toLowerCase());
        const matchArrears = !showOnlyArrears || s.balance > 0;
        
        // Term filter logic: This is tricky because balance is often cumulative. 
        // We show the student if they belong to the grade/name filter and have arrears.
        return matchGrade && matchName && matchArrears;
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

    const paginatedData = Pagination.getPageItems(filteredData, currentPage, itemsPerPage);

    return html`
        <div class="space-y-6">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                <div>
                    <h2 class="text-2xl font-bold">Fees Register</h2>
                    <p class="text-slate-500">Comprehensive financial oversight of all students</p>
                </div>
                <${PrintButtons} />
            </div>

            <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
                <div class="space-y-1">
                    <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Search Name</label>
                    <input 
                        class="w-full p-2 bg-slate-50 rounded-lg text-sm border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="Search student..."
                        value=${filterName}
                        onInput=${e => setFilterName(e.target.value)}
                    />
                </div>
                <div class="space-y-1">
                    <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Grade</label>
                    <select 
                        class="w-full p-2 bg-slate-50 rounded-lg text-sm border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                        value=${filterGrade}
                        onChange=${e => setFilterGrade(e.target.value)}
                    >
                        <option value="ALL">All Grades</option>
                        ${settings.grades?.map(g => html`<option value=${g}>${g}</option>`)}
                    </select>
                </div>
                <div class="space-y-1">
                    <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Term View</label>
                    <select 
                        class="w-full p-2 bg-slate-50 rounded-lg text-sm border-0 focus:ring-2 focus:ring-blue-500 outline-none"
                        value=${filterTerm}
                        onChange=${e => setFilterTerm(e.target.value)}
                    >
                        <option value="ALL">Full Year</option>
                        <option value="T1">Term 1</option>
                        <option value="T2">Term 2</option>
                        <option value="T3">Term 3</option>
                    </select>
                </div>
                <div class="flex items-end pb-2">
                    <label class="flex items-center gap-2 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                            checked=${showOnlyArrears}
                            onChange=${e => setShowOnlyArrears(e.target.checked)}
                        />
                        <span class="text-xs font-bold text-slate-600 group-hover:text-blue-600">Arrears Only</span>
                    </label>
                </div>
            </div>

            <div class="print-only mb-6 flex flex-col items-center text-center">
                <img src="${settings.schoolLogo}" class="w-16 h-16 mb-2 object-contain" alt="Logo" />
                <h1 class="text-2xl font-black uppercase">${settings.schoolName}</h1>
                <h2 class="text-sm font-bold uppercase text-slate-500 mt-1">Official Fees Register - ${filterGrade} (${filterTerm})</h2>
                <p class="text-[10px] text-slate-400 mt-1">Status: ${showOnlyArrears ? 'Outstanding Balances Only' : 'All Students'}</p>
            </div>

            <div class="feesregister-container bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                <table class="w-full text-left min-w-[800px]">
                        <thead class="bg-slate-800 text-white text-[10px] font-bold uppercase" style="print-color-adjust:exact; -webkit-print-color-adjust:exact;">
                            <tr>
                                <th class="px-6 py-4">#</th>
                                <th class="px-6 py-4">Student Name</th>
                                <th class="px-6 py-4">Adm #</th>
                                <th class="px-6 py-4">Grade</th>
                                <th class="px-6 py-4 text-right">Total Payable</th>
                                <th class="px-6 py-4 text-right">Paid To Date</th>
                                <th class="px-6 py-4 text-right">Arrears</th>
                            </tr>
                        </thead>
                        
                        <tbody class="divide-y divide-slate-100 print:hidden">
                            ${paginatedData.map((s, i) => html`
                                <tr key=${s.id} class="hover:bg-slate-50 transition-colors">
                                    <td class="px-6 py-4 text-xs text-slate-400 font-mono">${(currentPage - 1) * itemsPerPage + i + 1}</td>
                                    <td class="px-6 py-4">
                                        <div class="font-bold text-sm">${s.name}</div>
                                        <div class="text-[10px] text-slate-400">${s.stream || 'No Stream'}</div>
                                    </td>
                                    <td class="px-6 py-4 text-xs font-mono text-slate-500">${s.admissionNo}</td>
                                    <td class="px-6 py-4">
                                        <span class="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase">${s.grade}</span>
                                    </td>
                                    <td class="px-6 py-4 text-right font-medium text-sm text-slate-600">${settings.currency} ${s.totalDue.toLocaleString()}</td>
                                    <td class="px-6 py-4 text-right font-bold text-sm text-green-600">${settings.currency} ${s.totalPaid.toLocaleString()}</td>
                                    <td class="px-6 py-4 text-right">
                                        <span class=${`font-black text-sm ${s.balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                            ${settings.currency} ${s.balance.toLocaleString()}
                                        </span>
                                    </td>
                                </tr>
                            `)}
                            ${paginatedData.length === 0 && html`
                                <tr><td colspan="7" class="p-12 text-center text-slate-300">No student records found matching filters.</td></tr>
                            `}
                        </tbody>
                        
                        <tbody class="divide-y divide-slate-100 hidden print:table-row-group">
                            ${filteredData.map((s, i) => html`
                                <tr key=${s.id} class="even:bg-slate-50">
                                    <td class="px-6 py-3 text-xs text-slate-400 font-mono">${i + 1}</td>
                                    <td class="px-6 py-3">
                                        <div class="font-bold text-sm">${s.name}</div>
                                        <div class="text-[10px] text-slate-400">${s.stream || 'No Stream'}</div>
                                    </td>
                                    <td class="px-6 py-3 text-xs font-mono text-slate-500">${s.admissionNo}</td>
                                    <td class="px-6 py-3">
                                        <span class="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase">${s.grade}</span>
                                    </td>
                                    <td class="px-6 py-3 text-right font-medium text-sm text-slate-600">${settings.currency} ${s.totalDue.toLocaleString()}</td>
                                    <td class="px-6 py-3 text-right font-bold text-sm text-green-600">${settings.currency} ${s.totalPaid.toLocaleString()}</td>
                                    <td class="px-6 py-3 text-right">
                                        <span class=${`font-black text-sm ${s.balance > 0 ? 'text-red-500' : 'text-green-600'}`}>
                                            ${settings.currency} ${s.balance.toLocaleString()}
                                        </span>
                                    </td>
                                </tr>
                            `)}
                            ${filteredData.length === 0 && html`
                                <tr><td colspan="7" class="p-12 text-center text-slate-300">No student records found matching filters.</td></tr>
                            `}
                        </tbody>
                        ${filteredData.length > 0 && html`
                            <tfoot class="bg-slate-100 font-black text-sm border-t-2 border-slate-300" style="print-color-adjust:exact; -webkit-print-color-adjust:exact;">
                                <tr>
                                    <td colspan="4" class="px-6 py-4 text-right uppercase text-xs text-slate-600">Grand Totals:</td>
                                    <td class="px-6 py-4 text-right text-slate-800">${settings.currency} ${filteredData.reduce((a, b) => a + b.totalDue, 0).toLocaleString()}</td>
                                    <td class="px-6 py-4 text-right text-green-700">${settings.currency} ${filteredData.reduce((a, b) => a + b.totalPaid, 0).toLocaleString()}</td>
                                    <td class="px-6 py-4 text-right text-red-700">${settings.currency} ${filteredData.reduce((a, b) => a + b.balance, 0).toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        `}
                    </table>
                    ${filteredData.length > 0 && html`
                        ${h(PaginationControls, {
                            currentPage,
                            onPageChange: handlePageChange,
                            totalItems: filteredData.length,
                            itemsPerPage
                        })}
                    `}
            </div>

            
            <div class="mt-6 pt-3 border-t border-slate-200 print:border-black">
                <div class="flex justify-between items-center text-[8px] text-slate-400">
                    <span>${settings.schoolName} - ${settings.schoolAddress}</span>
                    <span>Academic Year: ${settings.academicYear}</span>
                    <span>Fees Register ${filterGrade !== 'ALL' ? `- ${filterGrade}` : ''}</span>
                </div>
            </div>
        </div>
    `;
};