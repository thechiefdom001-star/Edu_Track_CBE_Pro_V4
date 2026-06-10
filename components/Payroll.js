import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { PrintButtons } from './PrintButtons.js';

const html = htm.bind(h);

// Human-readable labels for all deduction keys
const DEDUCTION_LABELS = {
    paye:         'PAYE (Tax)',
    nssf:         'NSSF',
    shif:         'SHIF',
    ahl:          'Housing Levy (AHL)',
    helb:         'HELB Repayment',
    courtOrder:   'Court Order / Agency',
    sacco:        'SACCO Contribution',
    unionDues:    'Union Dues',
    pension:      'Pension / Prov. Fund',
    bankLoan:     'Bank Loan Recovery',
    insurance:    'Insurance Premium',
    advance:      'Salary Advance',
    loan:         'Loan Recovery',
    welfare:      'Staff Welfare',
    otherDeduction: 'Misc. Deductions'
};

// Earnings label map
const EARNINGS_LABELS = {
    overtime:       'Overtime',
    houseAllowance: 'House Allowance',
    bonus:          'Bonus',
    otherAllowance: 'Other Allowance'
};

// All extra deduction keys in order
const EXTRA_DED_KEYS = ['helb','courtOrder','sacco','unionDues','pension','bankLoan','insurance','advance','loan','welfare','otherDeduction'];

export const Payroll = ({ data, setData }) => {
    const now = new Date();
    const [selectedMonth, setSelectedMonth] = useState(now.toISOString().slice(0, 7));
    const [filterYear,  setFilterYear]  = useState(String(now.getFullYear()));
    const [activePayslip, setActivePayslip] = useState(null);
    const [editingStaff,  setEditingStaff]  = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const allStaff = useMemo(() => [
        ...(data.teachers || []).map(t => ({ ...t, type: 'Teaching' })),
        ...(data.staff    || []).map(s => ({ ...s, type: 'Support' }))
    ], [data.teachers, data.staff]);

    const payroll = data.payroll || [];

    // Derive available years from payroll entries + current year
    const availableYears = useMemo(() => {
        const yrs = new Set(payroll.map(p => p.month?.slice(0, 4)).filter(Boolean));
        yrs.add(String(now.getFullYear()));
        return [...yrs].sort((a, b) => b - a);
    }, [payroll]);

    const months = [
        "January","February","March","April","May","June",
        "July","August","September","October","November","December"
    ];

    const handleSaveEntry = (staffId, values) => {
        const others = payroll.filter(p => !(p.staffId === staffId && p.month === selectedMonth));
        const calcs = Storage.calculateKenyanPayroll(
            values.basic,
            {
                overtime:       values.overtime,
                houseAllowance: values.houseAllowance,
                bonus:          values.bonus,
                otherAllowance: values.otherAllowance
            },
            {
                helb:         values.helb,
                courtOrder:   values.courtOrder,
                sacco:        values.sacco,
                unionDues:    values.unionDues,
                pension:      values.pension,
                bankLoan:     values.bankLoan,
                insurance:    values.insurance,
                advance:      values.advance,
                loan:         values.loan,
                welfare:      values.welfare,
                otherDeduction: values.otherDeduction
            }
        );
        const entry = {
            staffId,
            month: selectedMonth,
            academicYear: data.settings.academicYear,
            ...calcs,
            updatedAt: new Date().toISOString()
        };
        setData({ ...data, payroll: [...others, entry] });
        setEditingStaff(null);
    };

    // Build table rows for selected month
    const tableRows = allStaff
        .filter(staff => {
            if (!searchTerm) return true;
            const searchLower = searchTerm.toLowerCase();
            return (staff.name && staff.name.toLowerCase().includes(searchLower)) ||
                   (staff.role && staff.role.toLowerCase().includes(searchLower)) ||
                   (staff.type && staff.type.toLowerCase().includes(searchLower));
        })
        .map(staff => {
            const entry = payroll.find(p => p.staffId === staff.id && p.month === selectedMonth) || null;
            return { staff, entry };
        });

    // Column totals for selected month (only entries that exist)
    const totals = tableRows.reduce((acc, { entry: e }) => {
        if (!e) return acc;
        acc.gross += e.gross || 0;
        acc.paye  += e.paye  || 0;
        acc.nssf  += e.nssf  || 0;
        acc.shif  += Math.round(e.shif || 0);
        acc.ahl   += Math.round(e.ahl  || 0);
        EXTRA_DED_KEYS.forEach(k => {
            acc[k] = (acc[k] || 0) + (Number(e.extraDeductions?.[k]) || 0);
        });
        acc.totalDed += e.totalDeductions || 0;
        acc.netPay   += e.netPay || 0;
        return acc;
    }, { gross:0, paye:0, nssf:0, shif:0, ahl:0, totalDed:0, netPay:0 });

    // Summary cards for the selected month
    const entriesThisMonth = tableRows.filter(r => r.entry).length;
    const cur = data.settings.currency || 'KES';

    // ─── Helper: small cell ───────────────────────────────────────────────────
    const numCell = (val, cls = '') => {
        const n = Number(val) || 0;
        return n > 0 ? html`<td class="px-3 py-3 text-right text-xs ${cls}">${Math.round(n).toLocaleString()}</td>` 
                     : html`<td class="px-3 py-3 text-right text-xs text-slate-300">—</td>`;
    };

    return html`
        <div class="space-y-6">

            
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                <div>
                    <h2 class="text-2xl font-bold">Payroll Management</h2>
                    <p class="text-slate-500 text-sm">Kenyan Statutory Deductions — PAYE · NSSF · SHIF · AHL · NITA</p>
                </div>
                <div class="flex flex-wrap gap-2 items-center">
                    
                    <select
                        class="p-2 bg-white border border-slate-200 rounded-xl outline-none text-sm font-bold"
                        value=${filterYear}
                        onChange=${e => setFilterYear(e.target.value)}
                    >
                        ${availableYears.map(y => html`<option value=${y}>${y}</option>`)}
                    </select>
                    
                    <input
                        type="month"
                        class="p-2 bg-white border border-slate-200 rounded-xl outline-none text-sm font-bold"
                        value=${selectedMonth}
                        onChange=${e => setSelectedMonth(e.target.value)}
                    />
                    <div class="relative no-print">
                        <input 
                            type="text"
                            placeholder="Search staff..."
                            class="p-2 pl-8 bg-white border border-slate-200 rounded-xl outline-none w-48 text-sm font-bold"
                            value=${searchTerm}
                            onInput=${(e) => setSearchTerm(e.target.value)}
                        />
                        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                    </div>
                    <${PrintButtons} />
                </div>
            </div>

            
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
                ${[
                    { label: 'Total Gross', val: totals.gross,   color: 'blue'  },
                    { label: 'Total PAYE',  val: totals.paye,    color: 'red'   },
                    { label: 'Total Deductions', val: totals.totalDed, color: 'orange' },
                    { label: 'Total Net Pay',    val: totals.netPay,   color: 'green'  }
                ].map(c => html`
                    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                        <p class="text-[10px] font-black uppercase text-slate-400">${c.label}</p>
                        <p class="text-lg font-black text-${c.color}-600 mt-1">${cur} ${Math.round(c.val).toLocaleString()}</p>
                        <p class="text-[9px] text-slate-400">${months[new Date(selectedMonth).getMonth()]} ${selectedMonth.slice(0,4)} · ${entriesThisMonth} staff</p>
                    </div>
                `)}
            </div>

            
            <div class=${`bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar ${activePayslip ? 'no-print' : ''}`}>
                
                
                <div class="hidden print:flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6 w-full px-4">
                    <div class="flex items-center gap-4">
                        <img src="${data.settings.schoolLogo}" class="w-16 h-16 object-contain" />
                        <div>
                            <h2 class="text-xl font-black uppercase text-slate-900">${data.settings.schoolName}</h2>
                            <p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">${data.settings.schoolAddress}</p>
                            <p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">${data.settings.schoolPhone} | ${data.settings.schoolEmail}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <h1 class="text-2xl font-black uppercase text-slate-900 tracking-tighter">Payroll Register</h1>
                        <p class="text-sm font-black text-blue-700 uppercase tracking-widest">${months[new Date(selectedMonth).getMonth()]} ${selectedMonth.slice(0,4)}</p>
                        <p class="text-[9px] text-slate-400 font-bold uppercase mt-1">Generated: ${new Date().toLocaleString()}</p>
                    </div>
                </div>

                <table class="w-full text-left text-xs min-w-[1400px]" style="print-color-adjust:exact; -webkit-print-color-adjust:exact;">
                    <thead style="background:#1e293b; color:#fff; print-color-adjust:exact; -webkit-print-color-adjust:exact;">
                        <tr>
                            
                            <th class="px-3 py-3 text-left text-[9px] font-black uppercase" rowspan="2" style="color:#fff; vertical-align:bottom;">#</th>
                            <th class="px-3 py-3 text-left text-[9px] font-black uppercase" rowspan="2" style="color:#fff; vertical-align:bottom;">Employee</th>
                            <th class="px-3 py-3 text-right text-[9px] font-black uppercase" rowspan="2" style="color:#fff; vertical-align:bottom;">Basic</th>
                            <th class="px-3 py-2 text-center text-[9px] font-black uppercase border-l border-white/20" colspan="4" style="color:#93c5fd;">─── Allowances ───</th>
                            <th class="px-3 py-3 text-right text-[9px] font-black uppercase border-l border-white/20" rowspan="2" style="color:#86efac; vertical-align:bottom;">Gross</th>
                            
                            <th class="px-3 py-2 text-center text-[9px] font-black uppercase border-l border-white/20" colspan="4" style="color:#fca5a5;">─── Statutory ───</th>
                            
                            <th class="px-3 py-2 text-center text-[9px] font-black uppercase border-l border-white/20" colspan="7" style="color:#fdba74;">─── Other Deductions ───</th>
                            
                            <th class="px-3 py-3 text-right text-[9px] font-black uppercase border-l border-white/20" rowspan="2" style="color:#fca5a5; vertical-align:bottom;">Total Ded.</th>
                            <th class="px-3 py-3 text-right text-[9px] font-black uppercase" rowspan="2" style="color:#86efac; vertical-align:bottom;">Net Pay</th>
                            <th class="px-3 py-3 text-center text-[9px] font-black uppercase no-print" rowspan="2" style="color:#fff; vertical-align:bottom;">Action</th>
                        </tr>
                        <tr style="background:#0f172a; color:#fff;">
                            
                            <th class="px-3 py-2 text-right text-[8px] font-bold border-l border-white/10" style="color:#93c5fd;">OT</th>
                            <th class="px-3 py-2 text-right text-[8px] font-bold" style="color:#93c5fd;">H.Allow</th>
                            <th class="px-3 py-2 text-right text-[8px] font-bold" style="color:#93c5fd;">Bonus</th>
                            <th class="px-3 py-2 text-right text-[8px] font-bold" style="color:#93c5fd;">Other</th>
                            
                            <th class="px-3 py-2 text-right text-[8px] font-bold border-l border-white/10" style="color:#fca5a5;">PAYE</th>
                            <th class="px-3 py-2 text-right text-[8px] font-bold" style="color:#fca5a5;">NSSF</th>
                            <th class="px-3 py-2 text-right text-[8px] font-bold" style="color:#fca5a5;">SHIF</th>
                            <th class="px-3 py-2 text-right text-[8px] font-bold" style="color:#fca5a5;">AHL</th>
                            
                            <th class="px-3 py-2 text-right text-[8px] font-bold border-l border-white/10" style="color:#fdba74;">HELB</th>
                            <th class="px-3 py-2 text-right text-[8px] font-bold" style="color:#fdba74;">Court</th>
                            <th class="px-3 py-2 text-right text-[8px] font-bold" style="color:#fdba74;">SACCO</th>
                            <th class="px-3 py-2 text-right text-[8px] font-bold" style="color:#fdba74;">Union</th>
                            <th class="px-3 py-2 text-right text-[8px] font-bold" style="color:#fdba74;">Pension</th>
                            <th class="px-3 py-2 text-right text-[8px] font-bold" style="color:#fdba74;">Bank Loan</th>
                            <th class="px-3 py-2 text-right text-[8px] font-bold" style="color:#fdba74;">Insur.</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${tableRows.map(({ staff, entry }, i) => {
                            const d = entry?.extraDeductions || {};
                            return html`
                            <tr key=${staff.id} class="hover:bg-blue-50/30 transition-colors even:bg-slate-50/50">
                                <td class="px-3 py-3 text-slate-400 font-mono text-[10px]">${i + 1}</td>
                                <td class="px-3 py-3">
                                    <div class="font-bold text-slate-800 whitespace-nowrap">${staff.name}</div>
                                    <div class="text-[9px] text-slate-400 uppercase">${staff.role || (staff.subjects ? staff.subjects.split(',')[0] : 'Staff')}</div>
                                </td>
                                
                                ${numCell(entry?.basic, 'font-bold text-slate-700')}
                                
                                ${numCell(entry?.extraEarnings?.overtime, 'text-blue-600')}
                                ${numCell(entry?.extraEarnings?.houseAllowance, 'text-blue-600')}
                                ${numCell(entry?.extraEarnings?.bonus, 'text-blue-600')}
                                ${numCell(entry?.extraEarnings?.otherAllowance, 'text-blue-600')}
                                
                                ${numCell(entry?.gross, 'font-black text-green-700')}
                                
                                ${numCell(entry?.paye, 'font-bold text-red-600')}
                                ${numCell(entry?.nssf, 'text-red-500')}
                                ${numCell(entry?.shif, 'text-red-500')}
                                ${numCell(entry?.ahl,  'text-red-500')}
                                
                                ${numCell(d.helb,          'text-orange-600')}
                                ${numCell(d.courtOrder,    'text-orange-600')}
                                ${numCell(d.sacco,         'text-orange-600')}
                                ${numCell(d.unionDues,     'text-orange-600')}
                                ${numCell(d.pension,       'text-orange-600')}
                                ${numCell(d.bankLoan,      'text-orange-600')}
                                ${numCell(d.insurance,     'text-orange-600')}
                                
                                ${numCell(entry?.totalDeductions, 'font-bold text-red-700')}
                                ${numCell(entry?.netPay, 'font-black text-green-700')}
                                
                                <td class="px-3 py-3 text-center no-print">
                                    <div class="flex justify-center gap-1">
                                        <button
                                            onClick=${() => setEditingStaff({ staff, entry })}
                                            class="text-[9px] font-bold uppercase bg-slate-100 text-slate-600 px-2 py-1 rounded-lg hover:bg-slate-200 transition-colors"
                                        >Edit</button>
                                        <button
                                            disabled=${!entry}
                                            onClick=${() => setActivePayslip({ staff, entry })}
                                            class="text-[9px] font-bold uppercase bg-blue-50 text-blue-600 px-2 py-1 rounded-lg hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-30"
                                        >Slip</button>
                                    </div>
                                </td>
                            </tr>`;
                        })}
                    </tbody>
                    
                    <tfoot style="background:#f1f5f9; print-color-adjust:exact; -webkit-print-color-adjust:exact;">
                        <tr class="border-t-2 border-slate-300">
                            <td class="px-3 py-3 text-right font-black text-[9px] uppercase text-slate-600" colspan="2">
                                Column Totals (${months[new Date(selectedMonth).getMonth()]} ${selectedMonth.slice(0,4)})
                            </td>
                            <td class="px-3 py-3 text-right font-black text-slate-700">${Math.round(tableRows.reduce((s,r)=>s+(r.entry?.basic||0),0)).toLocaleString()}</td>
                            
                            <td class="px-3 py-3 text-right font-bold text-blue-700">${Math.round(tableRows.reduce((s,r)=>s+(Number(r.entry?.extraEarnings?.overtime)||0),0)).toLocaleString()}</td>
                            <td class="px-3 py-3 text-right font-bold text-blue-700">${Math.round(tableRows.reduce((s,r)=>s+(Number(r.entry?.extraEarnings?.houseAllowance)||0),0)).toLocaleString()}</td>
                            <td class="px-3 py-3 text-right font-bold text-blue-700">${Math.round(tableRows.reduce((s,r)=>s+(Number(r.entry?.extraEarnings?.bonus)||0),0)).toLocaleString()}</td>
                            <td class="px-3 py-3 text-right font-bold text-blue-700">${Math.round(tableRows.reduce((s,r)=>s+(Number(r.entry?.extraEarnings?.otherAllowance)||0),0)).toLocaleString()}</td>
                            
                            <td class="px-3 py-3 text-right font-black text-green-800">${Math.round(totals.gross).toLocaleString()}</td>
                            
                            <td class="px-3 py-3 text-right font-black text-red-700">${Math.round(totals.paye).toLocaleString()}</td>
                            <td class="px-3 py-3 text-right font-bold text-red-600">${Math.round(totals.nssf).toLocaleString()}</td>
                            <td class="px-3 py-3 text-right font-bold text-red-600">${Math.round(totals.shif).toLocaleString()}</td>
                            <td class="px-3 py-3 text-right font-bold text-red-600">${Math.round(totals.ahl).toLocaleString()}</td>
                            
                            ${['helb','courtOrder','sacco','unionDues','pension','bankLoan','insurance'].map(k => html`
                                <td class="px-3 py-3 text-right font-bold text-orange-700">${Math.round(tableRows.reduce((s,r)=>s+(Number(r.entry?.extraDeductions?.[k])||0),0)).toLocaleString()}</td>
                            `)}
                            
                            <td class="px-3 py-3 text-right font-black text-red-800">${Math.round(totals.totalDed).toLocaleString()}</td>
                            <td class="px-3 py-3 text-right font-black text-green-800">${Math.round(totals.netPay).toLocaleString()}</td>
                            <td class="no-print"></td>
                        </tr>
                    </tfoot>
                </table>

                
                <div class="hidden print:grid grid-cols-3 gap-8 pt-12 px-6 pb-6 w-full">
                    <div class="text-center">
                        <div class="border-t-2 border-slate-300 pt-2">
                            <p class="text-[9px] font-black uppercase text-slate-900">Prepared By</p>
                            <p class="text-[8px] text-slate-400 uppercase font-bold mt-1">(Accounts / Bursar)</p>
                        </div>
                    </div>
                    <div class="text-center">
                        <div class="border-t-2 border-slate-300 pt-2">
                            <p class="text-[9px] font-black uppercase text-slate-900">Verified By</p>
                            <p class="text-[8px] text-slate-400 uppercase font-bold mt-1">(Internal Auditor / Board Member)</p>
                        </div>
                    </div>
                    <div class="text-center relative">
                        <div class="h-12 flex items-center justify-center -mt-8 mb-2">
                            ${data.settings.principalSignature && html`<img src="${data.settings.principalSignature}" class="h-full object-contain" />`}
                        </div>
                        <div class="border-t-2 border-slate-300 pt-2">
                            <p class="text-[9px] font-black uppercase text-slate-900">Authorized By</p>
                            <p class="text-[8px] text-slate-400 uppercase font-bold mt-1">Director / Principal</p>
                        </div>
                    </div>
                </div>
            </div>

            
            ${editingStaff && html`
                <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-start justify-center p-4 no-print overflow-y-auto pt-10">
                    <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl animate-in zoom-in-95 mb-10">
                        <div class="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10 rounded-t-3xl">
                            <div>
                                <h3 class="font-black text-lg">Edit Payroll Entry</h3>
                                <p class="text-xs text-slate-400">${editingStaff.staff.name} · ${months[new Date(selectedMonth).getMonth()]} ${selectedMonth.slice(0,4)}</p>
                            </div>
                            <button onClick=${() => setEditingStaff(null)} class="text-slate-400 hover:text-slate-700 p-2 text-xl">✕</button>
                        </div>
                        <form class="p-6 space-y-5" onSubmit=${(e) => {
                            e.preventDefault();
                            const f = new FormData(e.target);
                            const g = k => f.get(k);
                            handleSaveEntry(editingStaff.staff.id, {
                                basic: g('basic'), overtime: g('overtime'), houseAllowance: g('houseAllowance'),
                                bonus: g('bonus'), otherAllowance: g('otherAllowance'),
                                helb: g('helb'), courtOrder: g('courtOrder'),
                                sacco: g('sacco'), unionDues: g('unionDues'), pension: g('pension'),
                                bankLoan: g('bankLoan'), insurance: g('insurance'),
                                advance: g('advance'), loan: g('loan'), welfare: g('welfare'),
                                otherDeduction: g('otherDeduction')
                            });
                        }}>
                            <div class="space-y-3">
                                <h4 class="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b pb-1">Primary Earnings</h4>
                                <div class="space-y-1">
                                    <label class="text-[10px] font-bold text-slate-400 uppercase">Basic Salary *</label>
                                    <input name="basic" type="number" step="0.01" class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-200 focus:ring-2 focus:ring-blue-400" defaultValue=${editingStaff.entry?.basic || ''} required placeholder="0.00" />
                                </div>

                                <h4 class="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b pb-1 pt-1">Additional Earnings</h4>
                                <div class="grid grid-cols-2 gap-3">
                                    ${[
                                        { name:'overtime',       label:'Overtime' },
                                        { name:'houseAllowance', label:'House Allowance' },
                                        { name:'bonus',          label:'Bonus' },
                                        { name:'otherAllowance', label:'Other Allowance' }
                                    ].map(f => html`
                                        <div class="space-y-1">
                                            <label class="text-[10px] font-bold text-slate-400 uppercase">${f.label}</label>
                                            <input name=${f.name} type="number" step="0.01" class="w-full p-3 bg-slate-50 rounded-xl outline-none" 
                                                defaultValue=${editingStaff.entry?.extraEarnings?.[f.name] || ''} placeholder="0" />
                                        </div>
                                    `)}
                                </div>

                                <h4 class="text-[10px] font-black text-red-600 uppercase tracking-widest border-b pb-1 pt-1">Conditional Statutory Deductions</h4>
                                <div class="grid grid-cols-2 gap-3">
                                    ${[
                                        { name:'helb',       label:'HELB Repayment' },
                                        { name:'courtOrder', label:'Court Order / Agency Notice' }
                                    ].map(f => html`
                                        <div class="space-y-1">
                                            <label class="text-[10px] font-bold text-slate-400 uppercase">${f.label}</label>
                                            <input name=${f.name} type="number" step="0.01" class="w-full p-3 bg-slate-50 rounded-xl outline-none"
                                                defaultValue=${editingStaff.entry?.extraDeductions?.[f.name] || ''} placeholder="0" />
                                        </div>
                                    `)}
                                </div>

                                <h4 class="text-[10px] font-black text-orange-600 uppercase tracking-widest border-b pb-1 pt-1">Voluntary Deductions</h4>
                                <div class="grid grid-cols-2 gap-3">
                                    ${[
                                        { name:'sacco',          label:'SACCO Contribution' },
                                        { name:'unionDues',      label:'Union Dues' },
                                        { name:'pension',        label:'Pension / Provident Fund' },
                                        { name:'bankLoan',       label:'Bank Loan Recovery' },
                                        { name:'insurance',      label:'Insurance Premium' },
                                        { name:'advance',        label:'Salary Advance' },
                                        { name:'loan',           label:'Loan Recovery (Internal)' },
                                        { name:'welfare',        label:'Staff Welfare / Other' },
                                    ].map(f => html`
                                        <div class="space-y-1">
                                            <label class="text-[10px] font-bold text-slate-400 uppercase">${f.label}</label>
                                            <input name=${f.name} type="number" step="0.01" class="w-full p-3 bg-slate-50 rounded-xl outline-none"
                                                defaultValue=${editingStaff.entry?.extraDeductions?.[f.name] || ''} placeholder="0" />
                                        </div>
                                    `)}
                                    <div class="space-y-1 col-span-2">
                                        <label class="text-[10px] font-bold text-slate-400 uppercase">Misc. Deductions</label>
                                        <input name="otherDeduction" type="number" step="0.01" class="w-full p-3 bg-slate-50 rounded-xl outline-none"
                                            defaultValue=${editingStaff.entry?.extraDeductions?.otherDeduction || ''} placeholder="0" />
                                    </div>
                                </div>
                                <p class="text-[9px] text-slate-400 italic">* NITA (KES 50) is an employer levy — it is NOT deducted from the employee.</p>
                            </div>
                            <button type="submit" class="w-full py-4 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-200 mt-4 hover:bg-blue-700 transition-colors">
                                Save Payroll Entry
                            </button>
                        </form>
                    </div>
                </div>
            `}

            
            ${activePayslip && html`
                <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-start justify-center p-4 no-print overflow-y-auto pt-4 md:pt-10">
                    <div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl animate-in zoom-in-95 mb-10 print:shadow-none print:m-0 print:w-full print:max-w-none">
                        <div class="p-8 space-y-6 print:p-6" id="printable-payslip">

                            
                            <div class="flex justify-between items-start border-b-2 border-slate-800 pb-5"
                                 style="print-color-adjust:exact; -webkit-print-color-adjust:exact;">
                                <div class="flex items-center gap-4">
                                    <img src="${data.settings.schoolLogo}" class="w-16 h-16 object-contain" />
                                    <div>
                                        <h2 class="text-xl font-black uppercase text-slate-900">${data.settings.schoolName}</h2>
                                        <p class="text-xs text-slate-400">${data.settings.schoolAddress}</p>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <div class="border-2 border-slate-800 text-slate-800 px-4 py-1 rounded text-[10px] font-black uppercase tracking-widest mb-2 inline-block"
                                         style="print-color-adjust:exact; -webkit-print-color-adjust:exact;">
                                        Official Payslip
                                    </div>
                                    <p class="text-sm font-bold text-slate-700">${months[new Date(activePayslip.entry.month).getMonth()]} ${new Date(activePayslip.entry.month).getFullYear()}</p>
                                    <p class="text-xs text-slate-500">Academic Year: ${data.settings.academicYear}</p>
                                </div>
                            </div>

                            
                            <div class="grid grid-cols-2 gap-4 text-sm bg-slate-50 rounded-xl p-4"
                                 style="print-color-adjust:exact; -webkit-print-color-adjust:exact;">
                                <div class="space-y-1">
                                    <p class="text-[9px] text-slate-400 font-black uppercase">Employee</p>
                                    <p class="font-black text-lg text-slate-900">${activePayslip.staff.name}</p>
                                    <span class="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold uppercase inline-block">${activePayslip.staff.role || (activePayslip.staff.type === 'Teaching' ? 'Teacher' : 'Support Staff')}</span>
                                    <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[8px] uppercase font-bold text-slate-400 mt-2">
                                        <div>Emp #: <span class="text-slate-800">${activePayslip.staff.employeeNo || '—'}</span></div>
                                        <div>KRA PIN: <span class="text-slate-800">${activePayslip.staff.taxNo || '—'}</span></div>
                                        <div>NSSF #: <span class="text-slate-800">${activePayslip.staff.nssfNo || '—'}</span></div>
                                        <div>SHIF #: <span class="text-slate-800">${activePayslip.staff.shifNo || '—'}</span></div>
                                    </div>
                                </div>
                                <div class="text-right space-y-1">
                                    <p class="text-[9px] text-slate-400 font-black uppercase">Pay Period</p>
                                    <p class="font-bold text-sm">${months[new Date(activePayslip.entry.month).getMonth()]} ${new Date(activePayslip.entry.month).getFullYear()}</p>
                                    <p class="text-[9px] text-slate-400 font-black uppercase mt-2">Date Issued</p>
                                    <p class="font-bold text-xs">${new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'})}</p>
                                    <p class="text-[9px] text-slate-400 font-black uppercase mt-2">Currency</p>
                                    <p class="font-bold text-xs">${data.settings.currency}</p>
                                </div>
                            </div>

                            
                            <div class="border rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-slate-200">

                                
                                <div class="flex flex-col">
                                    <div class="bg-blue-700 font-bold text-[10px] uppercase p-3 border-b flex justify-between"
                                         style="background:#1d4ed8; color:#fff; print-color-adjust:exact; -webkit-print-color-adjust:exact;">
                                        <span style="color:#fff;">Earnings</span>
                                        <span style="color:#bfdbfe;">(${data.settings.currency})</span>
                                    </div>
                                    <div class="p-3 space-y-1.5 text-xs flex-1">
                                        <div class="flex justify-between border-b border-dashed border-slate-100 pb-1">
                                            <span class="font-bold">Basic Salary</span>
                                            <span class="font-black">${activePayslip.entry.basic.toLocaleString()}</span>
                                        </div>
                                        ${Object.entries(activePayslip.entry.extraEarnings || {}).map(([key, val]) => Number(val) > 0 && html`
                                            <div class="flex justify-between border-b border-dashed border-slate-100 pb-1 text-slate-600">
                                                <span>${EARNINGS_LABELS[key] || key}</span>
                                                <span class="font-medium">${Number(val).toLocaleString()}</span>
                                            </div>
                                        `)}
                                    </div>
                                    <div class="p-3 bg-blue-50 border-t flex justify-between font-black text-blue-900 text-xs uppercase"
                                         style="print-color-adjust:exact; -webkit-print-color-adjust:exact;">
                                        <span>Gross Earnings</span>
                                        <span>${activePayslip.entry.gross.toLocaleString()}</span>
                                    </div>
                                </div>

                                
                                <div class="flex flex-col">
                                    <div class="bg-red-700 font-bold text-[10px] uppercase p-3 border-b flex justify-between"
                                         style="background:#b91c1c; color:#fff; print-color-adjust:exact; -webkit-print-color-adjust:exact;">
                                        <span style="color:#fff;">Deductions</span>
                                        <span style="color:#fecaca;">(${data.settings.currency})</span>
                                    </div>
                                    <div class="p-3 space-y-1 text-xs flex-1">
                                        
                                        <p class="text-[8px] font-black uppercase text-slate-400 pt-1">Statutory</p>
                                        ${[
                                            { key:'paye', val: activePayslip.entry.paye },
                                            { key:'nssf', val: activePayslip.entry.nssf },
                                            { key:'shif', val: activePayslip.entry.shif },
                                            { key:'ahl',  val: activePayslip.entry.ahl  }
                                        ].map(({ key, val }) => html`
                                            <div class="flex justify-between border-b border-dashed border-slate-100 pb-1">
                                                <span class="text-slate-600">${DEDUCTION_LABELS[key]}</span>
                                                <span class="font-bold text-red-600">-${Math.round(Number(val)).toLocaleString()}</span>
                                            </div>
                                        `)}

                                        
                                        ${(() => {
                                            const ded = activePayslip.entry.extraDeductions || {};
                                            const hasAny = EXTRA_DED_KEYS.some(k => Number(ded[k]) > 0);
                                            if (!hasAny) return null;
                                            return html`<p class="text-[8px] font-black uppercase text-slate-400 pt-2">Other Deductions</p>`;
                                        })()}
                                        ${EXTRA_DED_KEYS.map(key => {
                                            const val = Number(activePayslip.entry.extraDeductions?.[key]);
                                            if (!(val > 0)) return null;
                                            return html`
                                                <div class="flex justify-between border-b border-dashed border-slate-100 pb-1">
                                                    <span class="text-slate-600">${DEDUCTION_LABELS[key]}</span>
                                                    <span class="font-bold text-orange-600">-${val.toLocaleString()}</span>
                                                </div>
                                            `;
                                        })}
                                        
                                        <p class="text-[8px] text-slate-400 italic pt-1">* NITA Levy (KES 50) — Employer borne, not deducted.</p>
                                    </div>
                                    <div class="p-3 bg-red-50 border-t flex justify-between font-black text-red-900 text-xs uppercase"
                                         style="print-color-adjust:exact; -webkit-print-color-adjust:exact;">
                                        <span>Total Deductions</span>
                                        <span>-${Math.round(activePayslip.entry.totalDeductions).toLocaleString()}</span>
                                    </div>
                                </div>

                                
                                <div class="col-span-full p-4 flex flex-col border-t-2 border-slate-800"
                                     style="background:#7FFFD4; print-color-adjust:exact; -webkit-print-color-adjust:exact;">
                                    <div class="flex justify-between items-center">
                                        <span class="font-black uppercase text-[11px] tracking-widest text-[#1e293b]">Net Pay (Take Home)</span>
                                        <span class="text-2xl font-black text-[#1e293b]">${data.settings.currency} ${Math.round(activePayslip.entry.netPay).toLocaleString()}</span>
                                    </div>
                                    <div class="mt-2 border-t border-[#1e293b]/20 pt-2">
                                        <p class="text-[8px] font-bold uppercase text-[#475569]">Amount in Words:</p>
                                        <p class="text-[10px] font-medium italic text-[#1e293b]">${Storage.numberToWords(Math.round(activePayslip.entry.netPay))}</p>
                                    </div>
                                </div>
                            </div>

                            
                            <div class="flex justify-between items-end pt-6">
                                <div class="text-center w-44 border-t-2 border-slate-400 pt-2">
                                    <p class="text-[8px] font-bold uppercase text-slate-500">Employee Signature</p>
                                </div>
                                <div class="text-center w-44 pt-2">
                                    <div class="h-12 flex items-center justify-center mb-1">
                                        ${data.settings.principalSignature && html`<img src="${data.settings.principalSignature}" class="h-full object-contain" />`}
                                    </div>
                                    <div class="border-t-2 border-slate-400 w-full"></div>
                                    <p class="text-[8px] font-bold uppercase text-slate-500 mt-1">Director / Principal</p>
                                </div>
                            </div>
                        </div>

                        
                        <div class="bg-slate-900 rounded-b-3xl p-4 flex gap-3 no-print">
                            <button onClick=${() => setActivePayslip(null)} class="flex-1 py-3 text-white font-bold hover:bg-slate-700 rounded-xl transition-colors">Close</button>
                            <${PrintButtons} className="flex-1" />
                        </div>
                    </div>
                </div>
            `}

            
            <div class="mt-6 pt-3 border-t border-slate-200 print:border-black no-print">
                <div class="flex justify-between items-center text-[8px] text-slate-400">
                    <span>${data.settings.schoolName} - ${data.settings.schoolAddress}</span>
                    <span>Academic Year: ${data.settings.academicYear}</span>
                    <span>Payroll Register</span>
                </div>
            </div>

            <style>
                @media print {
                    .no-print { display: none !important; }
                    .print\:flex { display: flex !important; }
                    .print\:grid { display: grid !important; }
                    .print\:block { display: block !important; }
                    
                    #printable-payslip {
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 1cm !important;
                        display: block !important;
                    }
                    .fixed { position: static !important; display: block !important; }
                    .backdrop-blur-sm { backdrop-filter: none !important; background: none !important; }
                    .bg-black\\/60 { background: none !important; }
                    .overflow-y-auto { overflow: visible !important; }
                    main { overflow: visible !important; }

                    /* Optimize table for print */
                    table { page-break-inside: auto; }
                    tr { page-break-inside: avoid; page-break-after: auto; }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                }
            </style>
        </div>
    `;
};