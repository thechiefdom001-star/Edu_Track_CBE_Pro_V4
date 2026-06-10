import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import htm from 'htm';
import { StudentDetail } from './StudentDetail.js';

const html = htm.bind(h);

export const ParentsDashboard = ({ data, parentSession, setData }) => {
    const [activeTab, setActiveTab] = useState('overview');

    if (!parentSession) {
        return html`
            <div class="h-full flex items-center justify-center p-8">
                <div class="max-w-md w-full bg-orange-500/10 border border-orange-500/20 rounded-3xl p-8 text-center animate-in fade-in zoom-in duration-500">
                    <div class="w-20 h-20 bg-orange-600 rounded-2xl flex items-center justify-center text-4xl mb-6 mx-auto shadow-lg shadow-orange-600/20">🔒</div>
                    <h3 class="text-2xl font-black text-orange-900 dark:text-orange-200 uppercase tracking-tight mb-2">Access Restricted</h3>
                    <p class="text-orange-700/70 text-sm mb-8 leading-relaxed">Please authenticate as a parent using your child's admission number to access this dashboard.</p>
                    <button 
                        onClick=${() => window.dispatchEvent(new CustomEvent('edutrack:open-parent-login'))}
                        class="w-full bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-widest py-4 rounded-2xl shadow-lg shadow-orange-600/20 transition-all active:scale-95"
                    >
                        Authenticate Now
                    </button>
                </div>
            </div>
        `;
    }

    const student = useMemo(() => {
        return (data.students || []).find(s => 
            String(s.admissionNo) === String(parentSession.admissionNo) || 
            String(s.id) === String(parentSession.studentId)
        );
    }, [data.students, parentSession]);

    const assessments = useMemo(() => {
        if (!student) return [];
        return (data.assessments || []).filter(a => 
            String(a.studentId) === String(student.id) || 
            String(a.studentAdmissionNo) === String(student.admissionNo)
        );
    }, [data.assessments, student]);

    const payments = useMemo(() => {
        if (!student) return [];
        return (data.payments || []).filter(p => String(p.studentId) === String(student.id));
    }, [data.payments, student]);

    // Calculate fee balance
    const feeInfo = useMemo(() => {
        if (!student || !data.settings.feeStructures) return { totalPaid: 0, balance: 0 };
        const paymentsForStudent = payments.filter(p => !p.voided);
        const totalPaid = paymentsForStudent.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        
        const feeStructure = data.settings.feeStructures.find(f => f.grade === student.grade);
        const previousArrears = Number(student.previousArrears) || 0;
        
        let selectedKeys;
        if (typeof student.selectedFees === 'string') {
            selectedKeys = student.selectedFees.split(',').map(f => f.trim()).filter(f => f);
        } else if (Array.isArray(student.selectedFees)) {
            selectedKeys = student.selectedFees;
        } else {
            selectedKeys = ['t1', 't2', 't3'];
        }

        const currentFeesDue = feeStructure ? selectedKeys.reduce((sum, key) => sum + (feeStructure[key] || 0), 0) : 0;
        const totalDue = previousArrears + currentFeesDue;
        const balance = totalDue - totalPaid;

        return { totalPaid, balance };
    }, [payments, student, data.settings.feeStructures]);

    const renderOverview = () => html`
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <div class="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-6 text-white shadow-xl">
                <div class="flex items-center gap-4 mb-6">
                    <div class="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-3xl">👤</div>
                    <div>
                        <h3 class="text-xl font-black">${student?.name || parentSession.studentName}</h3>
                        <p class="text-indigo-200 text-sm italic">${student?.admissionNo || parentSession.admissionNo}</p>
                    </div>
                </div>
                <div class="space-y-3 pt-4 border-t border-white/10">
                    <div class="flex justify-between text-sm">
                        <span class="opacity-70">Grade/Class:</span>
                        <span class="font-bold">${student?.grade || 'N/A'} ${student?.stream || ''}</span>
                    </div>
                    <div class="flex justify-between text-sm">
                        <span class="opacity-70">UPI/Assessment No:</span>
                        <span class="font-bold">${student?.upiNo || 'N/A'}</span>
                    </div>
                </div>
            </div>

            
            <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-100 dark:border-slate-800">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <p class="text-xs font-black text-slate-500 uppercase tracking-widest">Fees Status</p>
                        <h3 class="text-2xl font-black text-slate-900 dark:text-white mt-1">${data.settings.currency || 'KES'} ${feeInfo.totalPaid.toLocaleString()}</h3>
                    </div>
                    <span class="bg-green-500/10 text-green-500 p-2 rounded-xl text-xl">💰</span>
                </div>
                <div class="flex justify-between items-center mb-4 text-sm">
                    <span class="text-slate-500">Balance:</span>
                    <span class=${`font-black ${feeInfo.balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        ${data.settings.currency || 'KES'} ${feeInfo.balance.toLocaleString()}
                    </span>
                </div>
                <button class="w-full py-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors uppercase tracking-wider">
                    View Statements
                </button>
            </div>

            
            <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-100 dark:border-slate-800">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <p class="text-xs font-black text-slate-500 uppercase tracking-widest">Latest Performance</p>
                        <h3 class="text-2xl font-black text-slate-900 dark:text-white mt-1">
                            ${assessments.length > 0 ? assessments.length + ' Tests' : 'No data'}
                        </h3>
                    </div>
                    <span class="bg-orange-500/10 text-orange-500 p-2 rounded-xl text-xl">📝</span>
                </div>
                <p class="text-sm text-slate-500 mb-6 font-medium">Performance summary for the current term.</p>
                <button onClick=${() => setActiveTab('report')} class="w-full py-3 bg-orange-600 text-white rounded-xl text-xs font-bold hover:bg-orange-700 transition-colors uppercase tracking-wider shadow-lg shadow-orange-600/20">
                    View Official Report
                </button>
            </div>
        </div>

        
        <section class="mt-10">
            <h4 class="text-lg font-black text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                <span class="bg-indigo-600 w-2 h-2 rounded-full"></span> Recent Fee Payments
            </h4>
            <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-xl">
                <table class="w-full">
                    <thead>
                        <tr class="bg-slate-50 dark:bg-slate-800/50">
                            <th class="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Receipt #</th>
                            <th class="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                            <th class="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount</th>
                            <th class="px-6 py-4 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Method</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                        ${payments.length === 0 ? html`
                            <tr><td colspan="4" class="px-6 py-12 text-center text-slate-500 italic">No payment records found.</td></tr>
                        ` : payments.slice(0, 5).map(p => html`
                            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                <td class="px-6 py-4 font-bold text-sm text-slate-900 dark:text-white">${p.receiptNo || 'N/A'}</td>
                                <td class="px-6 py-4 text-slate-500 text-sm">${p.date}</td>
                                <td class="px-6 py-4 font-black text-sm text-green-600">${data.settings.currency || 'KES'} ${Number(p.amount).toLocaleString()}</td>
                                <td class="px-6 py-4">
                                    <span class="bg-blue-500/10 text-blue-500 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">
                                        ${p.method || 'M-PESA'}
                                    </span>
                                </td>
                            </tr>
                        `)}
                    </tbody>
                </table>
            </div>
        </section>
    `;

    const renderResults = () => {
        // Group results by term and exam type
        const grouped = assessments.reduce((acc, a) => {
            const key = `${a.term} - ${a.examType}`;
            if (!acc[key]) acc[key] = [];
            acc[key].push(a);
            return acc;
        }, {});

        return html`
            <div class="space-y-8">
                ${Object.keys(grouped).length === 0 ? html`
                    <div class="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center shadow-xl border border-slate-100 dark:border-slate-800">
                        <div class="text-6xl mb-4">📭</div>
                        <h3 class="text-xl font-black text-slate-900 dark:text-white">No Assessment Results</h3>
                        <p class="text-slate-500">Academic results for this student have not been uploaded yet.</p>
                    </div>
                ` : Object.entries(grouped).map(([title, results]) => html`
                    <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-xl">
                        <div class="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <h4 class="font-black text-slate-900 dark:text-white uppercase tracking-tight">${title}</h4>
                            <span class="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">${results.length} subjects</span>
                        </div>
                        <div class="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            ${results.map(r => html`
                                <div class="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-orange-500 transition-colors">
                                    <div class="flex justify-between items-start mb-2">
                                        <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">${r.subject}</p>
                                        <span class=${`text-xs font-bold ${Number(r.score) >= 50 ? 'text-green-500' : 'text-red-500'}`}>
                                            ${Number(r.score) >= 50 ? 'PASS' : 'RETAKE'}
                                        </span>
                                    </div>
                                    <h5 class="text-2xl font-black text-slate-900 dark:text-white">${r.score}%</h5>
                                    <p class="text-[10px] text-slate-400 mt-1">${new Date(r.date).toLocaleDateString()}</p>
                                </div>
                            `)}
                        </div>
                    </div>
                `)}
            </div>
        `;
    };

    const renderReport = () => {
        if (!student) return html`<div>Student data not available.</div>`;
        return html`
            <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-xl border border-slate-100 dark:border-slate-800">
                <${StudentDetail} 
                    student=${student} 
                    data=${data} 
                    setData=${setData} 
                    onBack=${() => setActiveTab('overview')} 
                    isAdmin=${false} 
                    isBatch=${true}
                />
            </div>
        `;
    };

    return html`
        <div class="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 no-print">
                <div>
                    <h1 class="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Parent <span class="text-orange-600">Portal</span></h1>
                    <p class="text-slate-500 font-medium">Welcome back, ${parentSession.parentName}</p>
                </div>
                <div class="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl w-fit self-start md:self-center shadow-inner overflow-x-auto no-scrollbar">
                    <button 
                        onClick=${() => setActiveTab('overview')}
                        class=${`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'overview' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        Overview
                    </button>
                    <button 
                        onClick=${() => setActiveTab('results')}
                        class=${`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'results' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        Results Summary
                    </button>
                    <button 
                        onClick=${() => setActiveTab('report')}
                        class=${`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'report' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'}`}
                    >
                        Actual Report Form
                    </button>
                </div>
            </header>

            ${activeTab === 'overview' ? renderOverview() : (activeTab === 'results' ? renderResults() : renderReport())}
        </div>
    `;
};
