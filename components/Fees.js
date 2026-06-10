import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { paymentService } from '../lib/paymentService.js';
import { googleSheetSync } from '../lib/googleSheetSync.js';
import { PrintButtons } from './PrintButtons.js';
import { PrintService } from '../lib/printService.js';

const html = htm.bind(h);

export const Fees = ({ data, setData, isAdmin, teacherSession }) => {
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [selectedTerm, setSelectedTerm] = useState('T1');
    const [filterGrade, setFilterGrade] = useState('ALL');
    const [filterStream, setFilterStream] = useState('ALL');
    const [filterVoided, setFilterVoided] = useState('active');
    const [paymentItems, setPaymentItems] = useState({});
    const [receipt, setReceipt] = useState(null);
    const [showPromptModal, setShowPromptModal] = useState(false);
    const [promptStudent, setPromptStudent] = useState(null);
    const [promptAmount, setPromptAmount] = useState(0);
    const [promptPhone, setPromptPhone] = useState('');
    const [promptMethod, setPromptMethod] = useState('mpesa');
    const [promptStatus, setPromptStatus] = useState('');
    const [syncStatus, setSyncStatus] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const streams = (data && data.settings && data.settings.streams) || [];

    // Track activity helper - WITH DEDUPLICATION
    const trackActivity = async (action, payment, studentName = '') => {
        if (!data.settings?.googleScriptUrl) return;
        
        // Prevent duplicate tracking
        const now = Date.now();
        if (trackActivity.lastCall && now - trackActivity.lastCall < 3000) {
            return;
        }
        trackActivity.lastCall = now;
        
        try {
            googleSheetSync.setSettings(data.settings);
            await googleSheetSync.trackActivity(
                action,
                action === 'VOID' ? 'Fees' : 'Payments',
                payment.id,
                studentName || 'Unknown',
                `KES ${payment.amount.toLocaleString()} - ${payment.term} | Receipt: ${payment.receiptNo}`
            );
        } catch (err) {
            console.warn('Activity tracking failed:', err.message);
        }
    };

    const defaultFeeColumns = [
        { key: 'previousArrears', label: 'Arrears B/F' },
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

    const customFeeColumns = (data.settings.customFeeColumns || []).map(cf => ({ key: cf.key, label: cf.label }));
    const feeColumns = [...defaultFeeColumns, ...customFeeColumns];

    // Get all available fee structures - MUST always have data
    const allFeeStructures = data.settings?.feeStructures || [];

    const terms = ['T1', 'T2', 'T3'];

    // Find selected student - handle both string and number IDs (Google sync returns numbers)
    const student = (data.students || []).find(s => String(s.id) === String(selectedStudentId));

    // Get fee structure for student's grade, or first available structure as fallback
    let feeStructure = student ? allFeeStructures.find(f => f.grade === student.grade) : null;

    // If no specific structure, use first available - ENSURE we always have one
    if (!feeStructure) {
        feeStructure = allFeeStructures[0] || {
            t1: 0, t2: 0, t3: 0,
            admission: 0, diary: 0, development: 0,
            boarding: 0, breakfast: 0, lunch: 0,
            trip: 0, bookFund: 0, caution: 0,
            uniform: 0, studentCard: 0, remedial: 0,
            assessmentFee: 0, projectFee: 0,
            activityFees: 0, tieAndBadge: 0,
            academicSupport: 0, pta: 0
        };
    }

    // Normalize selectedFees for the current student
    const getStudentSelectedFees = (s) => {
        if (!s) return ['t1', 't2', 't3', 'admission', 'diary', 'development', 'pta'];
        let fees = s.selectedFees;
        
        if (typeof fees === 'string') {
            const trimmed = fees.trim();
            if (trimmed.includes(',')) {
                fees = trimmed.split(',').map(f => f.trim()).filter(f => f);
            } else if (trimmed) {
                fees = [trimmed];
            } else {
                fees = [];
            }
        } else if (Array.isArray(fees) && fees.length > 0) {
            fees = fees;
        } else {
            fees = ['t1', 't2', 't3', 'admission', 'diary', 'development', 'pta'];
        }

        return fees;
    };

    const studentSelectedFees = getStudentSelectedFees(student);

    // Calculate total due for student based on their selected fees
    const calculateTotalDue = () => {
        if (!student || !feeStructure) return 0;

        let total = studentSelectedFees.reduce((sum, key) => sum + (feeStructure[key] || 0), 0);

        // Add arrears
        total += Number(student.previousArrears) || 0;

        return total;
    };

    const totalDue = calculateTotalDue();

    // Calculate financials for display
    const financials = student ? Storage.getStudentFinancials(student, data.payments || [], data.settings || {}) : { totalDue: 0, totalPaid: 0, balance: 0 };

    useEffect(() => {
        setPaymentItems({});
    }, [selectedStudentId]);

    const handleItemInput = (key, val) => {
        setPaymentItems({ ...paymentItems, [key]: Number(val) });
    };

    const handlePayment = (e) => {
        e.preventDefault();
        if (!student || !feeStructure) return;

        const totalAmount = Object.values(paymentItems).reduce((sum, v) => sum + (v || 0), 0);
        if (totalAmount <= 0) {
            alert("Please enter payment amount for at least one item.");
            return;
        }

        const newPayment = {
            id: 'PAY-' + Date.now(),
            studentId: selectedStudentId,
            studentName: student.name,
            gradeAtPayment: student.grade,
            amount: totalAmount,
            items: { ...paymentItems },
            term: selectedTerm,
            academicYear: data.settings.academicYear,
            date: new Date().toISOString().split('T')[0],
            receiptNo: 'RCP-' + Math.floor(Math.random() * 10000).toString().padStart(4, '0')
        };

        const financials = Storage.getStudentFinancials(student, data.payments, data.settings);
        const balanceAfter = financials.balance - totalAmount;

        const studentPayments = (data.payments || []).filter(p => p.studentId === selectedStudentId);
        const allPaymentsForStudent = [...studentPayments, newPayment];

        // UPDATE LOCAL STATE AND SAVE IMMEDIATELY
        const updatedPayments = [...(data.payments || []), newPayment];
        const updatedData = { ...data, payments: updatedPayments };
        
        console.log('✓ Payment saved locally - ID:', newPayment.id, '- Amount:', totalAmount);
        
        setData(updatedData);

        // Sync to Google Sheet asynchronously
        if (data.settings.googleScriptUrl) {
            setSyncStatus('Syncing to Google...');
            googleSheetSync.setSettings(data.settings);
            
            googleSheetSync.pushPayment(newPayment).then(res => {
                if (res.success) {
                    trackActivity('ADD', newPayment, student.name);
                    setSyncStatus('✓ Payment saved & synced');
                    console.log('✓ Payment synced to Google:', newPayment.id);
                } else {
                    setSyncStatus('✓ Saved locally (Google sync pending)');
                    console.log('⚠ Payment sync warning:', res.error);
                }
                setTimeout(() => setSyncStatus(''), 3000);
            }).catch(err => {
                setSyncStatus('✓ Saved locally');
                console.log('⚠ Payment sync failed (saved locally):', err.message);
                setTimeout(() => setSyncStatus(''), 2000);
            });
        } else {
            setSyncStatus('✓ Payment saved locally');
            setTimeout(() => setSyncStatus(''), 2000);
        }

        setReceipt({
            ...newPayment,
            studentName: student.name,
            grade: student.grade,
            balance: balanceAfter,
            structure: feeStructure,
            history: allPaymentsForStudent,
            term: selectedTerm
        });
        setPaymentItems({});
    };

    const openPromptModal = (student) => {
        const financials = Storage.getStudentFinancials(student, data.payments, data.settings);
        setPromptStudent(student);
        setPromptAmount(financials.balance);
        setPromptPhone(student.parentContact || '');
        setPromptMethod('mpesa');
        setPromptStatus('');
        setShowPromptModal(true);
    };

    const sendPaymentPrompt = async () => {
        if (!promptPhone) {
            alert('Please enter parent phone number');
            return;
        }

        const phone = promptPhone.replace(/[^0-9]/g, '');
        if (phone.length < 10) {
            alert('Please enter a valid phone number');
            return;
        }

        setPromptStatus('sending');

        // Initialize payment service with current settings
        paymentService.setSettings(data.settings);

        try {
            const result = await paymentService.sendPaymentPrompt(
                phone,
                promptAmount,
                promptStudent.name,
                promptMethod,
                promptStudent.admissionNo
            );

            const promptData = {
                id: 'PROMPT-' + Date.now(),
                studentId: promptStudent.id,
                studentName: promptStudent.name,
                admissionNo: promptStudent.admissionNo,
                phone: phone,
                amount: promptAmount,
                method: promptMethod,
                academicYear: data.settings.academicYear,
                date: new Date().toLocaleDateString(),
                status: result.success ? 'sent' : 'failed',
                transactionId: result.checkoutRequestId || result.transactionId || null,
                responseMessage: result.message || result.error
            };

            const existingPrompts = data.paymentPrompts || [];
            setData({ ...data, paymentPrompts: [...existingPrompts, promptData] });

            if (result.success) {
                setPromptStatus('sent');
                setTimeout(() => {
                    setShowPromptModal(false);
                    setPromptStatus('');
                }, 2000);
            } else {
                setPromptStatus('error');
                alert(result.error || 'Payment request failed');
            }
        } catch (error) {
            console.error('Payment Error:', error);
            setPromptStatus('error');
            alert('Failed to send payment request: ' + error.message);
        }
    };

    const viewReceipt = (p) => {
        if (p.voided) {
            alert('This receipt has been VOIDED and cannot be viewed.');
            return;
        }

        const s = (data.students || []).find(st => String(st.id) === String(p.studentId));
        if (!s) return;

        const financials = Storage.getStudentFinancials(s, data.payments || [], data.settings || {});
        const fs = (data.settings?.feeStructures || []).find(f => f.grade === s.grade);

        const studentPayments = (data.payments || []).filter(pay => String(pay.studentId) === String(s.id));
        const paymentIndex = studentPayments.findIndex(pay => pay.id === p.id);
        const historyUpToNow = studentPayments.slice(0, paymentIndex + 1);

        // Use cumulative balance logic
        const paidUntilNow = historyUpToNow.reduce((sum, pay) => sum + pay.amount, 0);
        const currentBalance = financials.totalDue - paidUntilNow;

        setReceipt({
            ...p,
            studentName: s.name,
            grade: s.grade,
            balance: currentBalance,
            structure: fs,
            history: historyUpToNow
        });
    };

    const handleVoidPayment = (paymentId) => {
        const payment = (data.payments || []).find(p => p.id === paymentId);
        if (!payment) return;

        const student = (data.students || []).find(s => String(s.id) === String(payment.studentId));
        const confirmMsg = `VOID PAYMENT\n\nReceipt: ${payment.receiptNo}\nStudent: ${student && student.name || 'Unknown'}\nAmount: ${data.settings.currency} ${payment.amount.toLocaleString()}\nDate: ${payment.date}\n\nAre you sure you want to CANCEL this transaction?`;

        if (!confirm(confirmMsg)) return;

        // Mark payment as void instead of deleting
        const updatedPayments = data.payments.map(p => {
            if (p.id === paymentId) {
                return { ...p, voided: true, voidedAt: new Date().toISOString(), voidedBy: 'Admin' };
            }
            return p;
        });

        console.log('Voiding payment:', paymentId, 'Total payments now:', updatedPayments.length);

        // UPDATE LOCAL STATE IMMEDIATELY
        setData({ ...data, payments: updatedPayments });
        
        // SYNC TO GOOGLE INSTANTLY
        if (data.settings.googleScriptUrl) {
            setSyncStatus('Voiding payment...');
            googleSheetSync.setSettings(data.settings);
            const voidedPayment = updatedPayments.find(p => p.id === paymentId);
            
            googleSheetSync.pushPayment(voidedPayment).then(res => {
                if (res.success) {
                    trackActivity('VOID', voidedPayment, student?.name || 'Unknown');
                    setSyncStatus('✓ Payment voided & synced');
                }
                else setSyncStatus('⚠ Voided locally (sync pending)');
                setTimeout(() => setSyncStatus(''), 3000);
            }).catch(err => {
                setSyncStatus('⚠ Voided locally (sync pending)');
                setTimeout(() => setSyncStatus(''), 3000);
            });
        }

        setReceipt(null);
        alert('Payment has been VOIDED successfully!');
    };

    const handleRestorePayment = (paymentId) => {
        if (!confirm('Restore this voided payment?')) return;

        const updatedPayments = data.payments.map(p => {
            if (p.id === paymentId) {
                return { ...p, voided: false, voidedAt: null, voidedBy: null };
            }
            return p;
        });

        // UPDATE LOCAL STATE IMMEDIATELY
        setData({ ...data, payments: updatedPayments });

        // SYNC TO GOOGLE INSTANTLY
        if (data.settings.googleScriptUrl) {
            setSyncStatus('Restoring payment...');
            googleSheetSync.setSettings(data.settings);
            const restoredPayment = updatedPayments.find(p => p.id === paymentId);
            
            googleSheetSync.pushPayment(restoredPayment).then(res => {
                if (res.success) setSyncStatus('✓ Payment restored & synced');
                else setSyncStatus('⚠ Restored locally (sync pending)');
                setTimeout(() => setSyncStatus(''), 3000);
            }).catch(err => {
                setSyncStatus('⚠ Restored locally (sync pending)');
                setTimeout(() => setSyncStatus(''), 3000);
            });
        }

        alert('Payment restored successfully!');
    };

    const handlePrintReceipt = (orientation = 'portrait') => {
        PrintService.print(orientation, ['print-receipt-only']);
    };

    const handlePrintTable = (orientation = 'portrait') => {
        PrintService.print(orientation, ['print-table-only']);
    };

    return html`
        <div class="space-y-6">
            
            ${showPromptModal && html`
                <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div class="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xl font-black">📱 Send Payment Prompt</h3>
                            <button onClick=${() => setShowPromptModal(false)} class="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                        </div>
                        
                        <div class="space-y-4">
                            <div class="bg-blue-50 p-4 rounded-xl">
                                <p class="text-sm font-bold text-blue-800">${promptStudent && promptStudent.name}</p>
                                <p class="text-xs text-blue-600">${promptStudent && promptStudent.grade} - Balance: ${data.settings.currency} ${(promptAmount || 0).toLocaleString()}</p>
                            </div>

                            <div class="space-y-2">
                                <label class="text-xs font-bold text-slate-500 uppercase">Payment Method</label>
                                <div class="flex gap-2">
                                    <button 
                                        type="button"
                                        onClick=${() => setPromptMethod('mpesa')}
                                        class=${`flex-1 py-3 rounded-xl font-bold text-sm border-2 ${promptMethod === 'mpesa' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-500'}`}
                                    >
                                        M-Pesa
                                    </button>
                                    <button 
                                        type="button"
                                        onClick=${() => setPromptMethod('airtel')}
                                        class=${`flex-1 py-3 rounded-xl font-bold text-sm border-2 ${promptMethod === 'airtel' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-500'}`}
                                    >
                                        Airtel
                                    </button>
                                </div>
                            </div>

                            <div class="space-y-2">
                                <label class="text-xs font-bold text-slate-500 uppercase">Parent Phone Number</label>
                                <input 
                                    type="tel"
                                    placeholder="e.g. 254712345678"
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-200 focus:border-green-500"
                                    value=${promptPhone}
                                    onInput=${(e) => setPromptPhone(e.target.value)}
                                />
                                <p class="text-[10px] text-slate-400">STK push will be sent to this number</p>
                            </div>

                            <div class="space-y-2">
                                <label class="text-xs font-bold text-slate-500 uppercase">Amount to Pay</label>
                                <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <span class="text-xl font-black text-green-600">${data.settings.currency} ${(promptAmount || 0).toLocaleString()}</span>
                                </div>
                            </div>

                            ${promptStatus === 'sending' && html`
                                <div class="bg-yellow-50 p-4 rounded-xl text-center">
                                    <p class="text-yellow-700 font-bold">${promptMethod === 'mpesa' ? '📡 Sending M-Pesa STK Push...' : '📡 Sending Airtel Request...'}</p>
                                </div>
                            `}

                            ${promptStatus === 'sent' && html`
                                <div class="bg-green-50 p-4 rounded-xl text-center">
                                    <p class="text-green-700 font-bold">✅ ${promptMethod === 'mpesa' ? 'M-Pesa' : 'Airtel'} request sent!</p>
                                    <p class="text-xs text-green-600">Parent will receive a payment prompt on their phone</p>
                                </div>
                            `}

                            ${promptStatus === 'error' && html`
                                <div class="bg-red-50 p-4 rounded-xl text-center">
                                    <p class="text-red-700 font-bold">❌ Payment request failed</p>
                                    <p class="text-xs text-red-600">Please check API settings in Configuration</p>
                                </div>
                            `}

                            <button 
                                type="button"
                                onClick=${sendPaymentPrompt}
                                disabled=${promptStatus === 'sending'}
                                class=${`w-full py-4 rounded-xl font-bold text-white shadow-lg ${promptStatus === 'sending' ? 'bg-slate-400' : promptMethod === 'mpesa' ? 'bg-green-600 shadow-green-200' : 'bg-red-600 shadow-red-200'}`}
                            >
                                ${promptStatus === 'sending' ? 'Sending...' : `Send ${promptMethod === 'mpesa' ? 'M-Pesa' : 'Airtel'} Prompt`}
                            </button>
                        </div>
                    </div>
                </div>
            `}

            <div class="flex justify-between items-center no-print">
                <h2 class="text-2xl font-bold">Fee Management</h2>
                ${syncStatus && html`<span class="text-[10px] font-bold px-3 py-1 bg-blue-50 text-blue-600 rounded-full animate-pulse">${syncStatus}</span>`}
            </div>

            <div class="flex justify-end no-print">
                <button 
                    onClick=${() => {
            const student = (data.students || []).find(s => String(s.id) === String(selectedStudentId));
            if (student) {
                openPromptModal(student);
            } else {
                alert('Please select a student first');
            }
        }}
                    class="bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg shadow-green-200 flex items-center gap-2"
                >
                    📱 Send Payment Prompt
                </button>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 no-print">
                    <h3 class="font-bold mb-4">Record New Payment</h3>
                    <form onSubmit=${handlePayment} class="space-y-6">
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Filter Grade</label>
                                <select 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-primary font-bold text-primary"
                                    value=${filterGrade}
                                    onChange=${(e) => { setFilterGrade(e.target.value); setFilterStream('ALL'); setSelectedStudentId(''); }}
                                >
                                    <option value="ALL">All Grades</option>
                                    ${(data.settings.grades || []).map(g => html`<option value=${g}>${g}</option>`)}
                                </select>
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Stream</label>
                                <select 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-primary font-bold text-primary"
                                    value=${filterStream}
                                    onChange=${(e) => { setFilterStream(e.target.value); setSelectedStudentId(''); }}
                                >
                                    <option value="ALL">All Streams</option>
                                    ${streams.map(s => html`<option value=${s}>${s}</option>`)}
                                </select>
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Select Student</label>
                                <select 
                                    required
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-primary"
                                    value=${selectedStudentId}
                                    onChange=${(e) => setSelectedStudentId(e.target.value)}
                                >
                                    <option value="">Select Student</option>
                                    ${(data.students || [])
            .filter(s => {
                if (filterGrade !== 'ALL' && s.grade !== filterGrade) return false;
                if (filterStream !== 'ALL' && s.stream !== filterStream) return false;
                return true;
            })
                                    .map(s => html`
                                            <option value=${String(s.id)}>${s.name} (${s.grade}${s.stream || ''})</option>
                                        `)}
                                </select>
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Academic Term</label>
                                <select 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-transparent focus:border-primary font-bold text-primary"
                                    value=${selectedTerm}
                                    onChange=${(e) => setSelectedTerm(e.target.value)}
                                >
                                    ${terms.map(t => html`<option value=${t}>${t}</option>`)}
                                </select>
                            </div>
                        </div>

                        ${student && feeStructure && html`
                            <div class="bg-gradient-to-r from-blue-600 to-blue-700 p-4 rounded-xl text-white">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <p class="text-xs text-blue-200 font-bold uppercase">Total Fee Due (${selectedTerm})</p>
                                        <p class="text-2xl font-black">${data.settings.currency} ${totalDue.toLocaleString()}</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-xs text-blue-200 font-bold uppercase">Current Balance</p>
                                        <p class="text-xl font-black ${financials.balance > 0 ? 'text-orange-300' : 'text-green-300'}">${data.settings.currency} ${financials.balance.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        `}

                        ${student && html`
                            <div class="space-y-3">
                                <label class="text-xs font-bold text-slate-500 uppercase block">Fee Breakdown (${data.settings.currency})</label>
                                <div class="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-2 no-scrollbar">
                                    ${feeColumns.map(col => {
                // Handle Arrears B/F specially
                if (col.key === 'previousArrears') {
                    const arrearsDue = Number(student.previousArrears) || 0;
                    // Calculate actual outstanding arrears (Arrears BF - what's already been paid towards it)
                    const paidArrears = (data.payments || [])
                        .filter(p => p.studentId === student.id && !p.voided)
                        .reduce((sum, p) => sum + (Number(p.items && p.items.previousArrears) || 0), 0);
                    const outstandingArrears = Math.max(0, arrearsDue - paidArrears);

                    if (outstandingArrears === 0 && arrearsDue === 0) return null;

                    return html`
                                                <div class="p-3 bg-orange-50 rounded-xl border-2 border-orange-200 col-span-2 animate-pulse-subtle">
                                                    <div class="flex justify-between items-center mb-1">
                                                        <p class="text-[10px] font-black text-orange-600 uppercase truncate">${col.label}</p>
                                                        <button 
                                                            type="button"
                                                            onClick=${() => handleItemInput(col.key, outstandingArrears)}
                                                            class="text-[9px] bg-orange-600 text-white px-2 py-0.5 rounded font-bold hover:bg-orange-700 transition-colors"
                                                        >
                                                            Pay Full
                                                        </button>
                                                    </div>
                                                    <p class="text-[10px] text-orange-500 mb-1 font-bold">Outstanding: ${data.settings.currency} ${outstandingArrears.toLocaleString()}</p>
                                                    <input 
                                                        type="number" 
                                                        placeholder="Enter amount..."
                                                        class="w-full bg-white border border-orange-300 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-orange-500 font-black text-orange-700"
                                                        value=${paymentItems[col.key] || ''}
                                                        onInput=${(e) => handleItemInput(col.key, e.target.value)}
                                                    />
                                                </div>
                                            `;
                }

                // Show ALL fee items from fee structure that have amounts - always show something
                const due = feeStructure[col.key] || 0;
                if (due === 0) return null;

                // Skip non-fee columns
                if (col.key === 'previousArrears') return null;

                // Calculate how much of this fee has already been paid
                const alreadyPaid = (data.payments || [])
                    .filter(p => p.studentId === student.id && !p.voided)
                    .reduce((sum, p) => sum + (Number(p.items && p.items[col.key]) || 0), 0);
                const outstanding = Math.max(0, due - alreadyPaid);
                const isFullyPaid = due > 0 && alreadyPaid >= due;

                return html`
                                            <div class=${`p-3 rounded-xl border ${isFullyPaid ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-100'}`}>
                                                <div class="flex justify-between items-center mb-1">
                                                    <p class=${`text-[10px] font-bold uppercase truncate ${isFullyPaid ? 'text-green-600' : 'text-slate-500'}`}>${col.label}</p>
                                                    ${isFullyPaid ? html`<span class="text-[8px] font-black text-green-600 bg-green-100 px-1 rounded">PAID</span>` : ''}
                                                </div>
                                                <p class="text-[10px] text-slate-400 mb-1">Due: ${due.toLocaleString()} | Bal: <span class=${`font-bold ${outstanding > 0 ? 'text-red-500' : 'text-green-600'}`}>${outstanding.toLocaleString()}</span></p>
                                                <input 
                                                    type="number" 
                                                    placeholder=${isFullyPaid ? 'Paid' : '0'}
                                                    class=${`w-full border rounded-lg p-1 text-sm outline-none focus:ring-1 focus:ring-blue-500 ${isFullyPaid ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-slate-200'}`}
                                                    value=${paymentItems[col.key] || ''}
                                                    onInput=${(e) => handleItemInput(col.key, e.target.value)}
                                                />
                                            </div>
                                        `;
            })}
                                </div>
                                <div class="pt-4 border-t flex justify-between items-center">
                                    <span class="font-bold text-slate-700">Total to Pay:</span>
                                    <span class="text-xl font-black text-blue-600">${data.settings.currency} ${Object.values(paymentItems).reduce((sum, v) => sum + (v || 0), 0).toLocaleString()}</span>
                                </div>
                            </div>
                        `}

                        <button class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-200 disabled:opacity-50" disabled=${!selectedStudentId}>
                            Generate Receipt
                        </button>
                    </form>
                </div>

                <div class="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 text-white p-4 sm:p-8 rounded-2xl sm:rounded-3xl shadow-2xl relative overflow-hidden print:bg-white print:text-black print:shadow-2xl print:border print:border-slate-200 min-h-[600px] receipt-container print-section-receipt">
                    
                    <div class="absolute -top-20 -right-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl print:hidden"></div>
                    <div class="absolute -bottom-20 -left-20 w-60 h-60 bg-green-500/10 rounded-full blur-3xl print:hidden"></div>
                    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-gradient-to-br from-blue-500/5 to-green-500/5 rounded-full blur-3xl print:hidden"></div>
                    
                    ${receipt ? html`
                        <div class="relative space-y-6 print:space-y-4 print:w-full">
                            
                            <div class="flex flex-col items-center text-center border-b-2 border-white/20 print:border-black pb-6">
                                <div class="w-20 h-20 mb-3 rounded-full bg-white/10 p-1 print:bg-slate-100">
                                    <img src="${data.settings.schoolLogo}" class="w-full h-full object-contain rounded-full" alt="Logo" />
                                </div>
                                <h3 class="text-xl sm:text-3xl font-black uppercase tracking-wider">${data.settings.schoolName}</h3>
                                <p class="text-[10px] sm:text-sm text-blue-300 print:text-slate-600 mt-1 font-medium">${data.settings.schoolAddress}</p>
                                <div class="mt-3 px-4 py-1 bg-blue-500/20 rounded-full print:bg-slate-100">
                                    <p class="text-[10px] font-bold text-blue-300 print:text-slate-700 uppercase tracking-widest">Official Payment Receipt</p>
                                </div>
                            </div>
                            
                            
                            <div class="flex flex-col sm:flex-row justify-between items-start gap-4 bg-white/5 print:bg-slate-50 p-4 rounded-xl print:border print:border-slate-200">
                                <div class="space-y-1">
                                    <p class="text-[9px] text-blue-300 print:text-slate-500 uppercase font-bold">Receipt Number</p>
                                    <p class="text-xl sm:text-2xl font-black text-white print:text-black">${receipt.receiptNo}</p>
                                </div>
                                <div class="text-left sm:text-right">
                                    <p class="text-[9px] text-blue-300 print:text-slate-500 uppercase font-bold">Date</p>
                                    <p class="text-lg font-bold text-white print:text-black">${receipt.date}</p>
                                </div>
                                <div class="text-left sm:text-right">
                                    <p class="text-[9px] text-blue-300 print:text-slate-500 uppercase font-bold">Term</p>
                                    <p class="text-lg font-bold text-white print:text-black">${receipt.term || 'N/A'}</p>
                                </div>
                            </div>

                            
                            <div class="bg-white/10 print:bg-slate-50 p-4 rounded-xl border border-white/10 print:border-slate-200">
                                <div class="flex justify-between items-center">
                                    <div>
                                        <p class="text-[9px] text-blue-300 print:text-slate-500 uppercase font-bold">Student Name</p>
                                        <p class="text-lg font-black text-white print:text-black">${receipt.studentName}</p>
                                    </div>
                                    <div class="text-right">
                                        <p class="text-[9px] text-blue-300 print:text-slate-500 uppercase font-bold">Class</p>
                                        <p class="text-lg font-bold text-white print:text-black">${receipt.grade}</p>
                                    </div>
                                </div>
                                <div class="mt-3 pt-3 border-t border-white/10 print:border-slate-200">
                                    <p class="text-[9px] text-blue-300 print:text-slate-500 uppercase font-bold">Academic Year</p>
                                    <p class="font-bold text-blue-200 print:text-slate-700">${data.settings.academicYear}</p>
                                </div>
                            </div>

                            
                            <div class="border-t border-white/20 pt-4 print:border-slate-200">
                                <p class="text-[9px] text-blue-300 print:text-slate-500 uppercase font-bold mb-3">Payment Details</p>
                                <div class="overflow-x-auto no-scrollbar">
                                    <div class="grid grid-cols-4 text-[9px] font-bold text-blue-300 print:text-slate-600 uppercase mb-2 border-b border-white/20 pb-2 print:border-slate-300 min-w-[300px]">
                                        <span>Item</span>
                                        <span class="text-right">Amount Due</span>
                                        <span class="text-right">Paid</span>
                                        <span class="text-right">Balance</span>
                                    </div>
                                    <div class="space-y-2 min-w-[300px]">
                                        ${feeColumns.map(col => {
                const paidNow = (receipt.items && receipt.items[col.key]) || 0;

                // Special logic for Arrears B/F
                if (col.key === 'previousArrears') {
                    const targetStudent = data.students.find(s => s.name === receipt.studentName);
                    const feeAmount = Number((targetStudent && targetStudent.previousArrears) || 0) || 0;
                    if (feeAmount === 0 && paidNow === 0) return null;

                    const totalPaidForItem = (receipt.history || []).reduce((sum, p) => sum + ((p.items && p.items[col.key]) || 0), 0);
                    const itemBalance = feeAmount - totalPaidForItem;

                    return html`
                                                    <div class="grid grid-cols-4 text-[10px] border-b border-slate-800/30 print:border-slate-100 py-1.5 items-center">
                                                        <span class="text-orange-400 print:text-orange-600 truncate pr-1 font-bold">${col.label}</span>
                                                        <span class="text-right text-slate-300 print:text-slate-400 font-medium">${feeAmount.toLocaleString()}</span>
                                                        <span class=${`text-right font-bold ${paidNow > 0 ? 'text-white print:text-black' : 'text-slate-600 print:text-slate-300'}`}>
                                                            ${paidNow > 0 ? paidNow.toLocaleString() : '-'}
                                                        </span>
                                                        <span class="text-right font-mono font-bold ${itemBalance > 0 ? 'text-orange-400 print:text-slate-700' : 'text-green-400 print:text-green-600'}">
                                                            ${itemBalance.toLocaleString()}
                                                        </span>
                                                    </div>
                                                `;
                }

                // Find the student by ID for accurate fee profile lookup
                const receiptStudent = (data.students || []).find(s => String(s.id) === String(receipt.studentId));
                const receiptSelectedFees = getStudentSelectedFees(receiptStudent);

                // Only show fees the student registered for (or anything that was paid)
                const isRegistered = receiptSelectedFees.includes(col.key);
                if (!isRegistered && paidNow === 0) return null;

                const feeAmount = isRegistered ? ((receipt.structure && receipt.structure[col.key]) || 0) : 0;

                // Skip if nothing due and nothing paid
                if (feeAmount === 0 && paidNow === 0) return null;

                // Calculate cumulative balance for this item up to this receipt
                const totalPaidForItem = (receipt.history || []).reduce((sum, p) => sum + ((p.items && p.items[col.key]) || 0), 0);
                const itemBalance = feeAmount - totalPaidForItem;

                return html`
                                                <div class="grid grid-cols-4 text-[10px] border-b border-slate-800/30 print:border-slate-100 py-1.5 items-center">
                                                    <span class="text-slate-400 print:text-slate-500 truncate pr-1">${col.label}</span>
                                                    <span class="text-right text-slate-300 print:text-slate-400 font-medium">${feeAmount.toLocaleString()}</span>
                                                    <span class=${`text-right font-bold ${paidNow > 0 ? 'text-white print:text-black' : 'text-slate-600 print:text-slate-300'}`}>
                                                        ${paidNow > 0 ? paidNow.toLocaleString() : '-'}
                                                    </span>
                                                    <span class="text-right font-mono font-bold ${itemBalance > 0 ? 'text-orange-400 print:text-slate-700' : 'text-green-400 print:text-green-600'}">
                                                        ${itemBalance.toLocaleString()}
                                                    </span>
                                                </div>
                                            `;
            })}
                                    </div>
                                </div>

                                <div class="flex justify-between items-center bg-slate-800 print:bg-slate-100 p-4 rounded-xl mt-6">
                                    <span class="text-slate-400 print:text-slate-600 font-bold uppercase text-xs">Total Amount Paid</span>
                                    <span class="text-2xl font-black text-green-400 print:text-green-700">${data.settings.currency} ${receipt.amount.toLocaleString()}</span>
                                </div>
                                
                                <div class="space-y-1 px-2 pt-2">
                                    <div class="flex justify-between border-t border-slate-800/50 print:border-slate-200 pt-1">
                                        <span class="text-slate-500 print:text-slate-400 text-[9px] font-black uppercase tracking-wider">Overall Account Balance</span>
                                        <span class="font-black text-[12px] text-orange-400 print:text-black">${data.settings.currency} ${receipt.balance.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>

                            
                            ${(data.settings.bankName || data.settings.mpesaPaybill || data.settings.airtelPaybill) && html`
                                <div class="mt-6 p-4 bg-slate-800/50 print:bg-slate-50 rounded-xl border border-slate-700 print:border-slate-200">
                                    <p class="text-[9px] font-black uppercase text-slate-500 print:text-slate-600 mb-2">Payment Options</p>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[9px]">
                                        ${data.settings.bankName && html`
                                            <div class="flex items-start gap-2">
                                                <span class="text-green-400">🏦</span>
                                                <div>
                                                    <p class="font-bold text-slate-300 print:text-slate-700">${data.settings.bankName}</p>
                                                    <p class="text-slate-500 print:text-slate-500">A/C No: ${data.settings.bankAccount || 'N/A'}</p>
                                                </div>
                                            </div>
                                        `}
                                        ${data.settings.mpesaPaybill && html`
                                            <div class="flex items-start gap-2">
                                                <span class="text-green-400">📱</span>
                                                <div>
                                                    <p class="font-bold text-slate-300 print:text-slate-700">M-Pesa Paybill: ${data.settings.mpesaPaybill}</p>
                                                    <p class="text-slate-500 print:text-slate-500">A/C: ${data.settings.mpesaAccountName || 'School Fees'}</p>
                                                </div>
                                            </div>
                                        `}
                                        ${data.settings.airtelPaybill && html`
                                            <div class="flex items-start gap-2">
                                                <span class="text-red-400">📱</span>
                                                <div>
                                                    <p class="font-bold text-slate-300 print:text-slate-700">Airtel Paybill: ${data.settings.airtelPaybill}</p>
                                                    <p class="text-slate-500 print:text-slate-500">A/C: ${data.settings.airtelAccountName || 'School Fees'}</p>
                                                </div>
                                            </div>
                                        `}
                                    </div>
                                </div>
                            `}

                            <div class="pt-8 text-center hidden print:block">
                                <div class="flex justify-around mb-8 items-end h-16">
                                    <div class="text-center w-32">
                                        <div class="h-10 flex items-center justify-center mb-1">
                                            ${data.settings.clerkSignature && html`<img src="${data.settings.clerkSignature}" class="h-full object-contain" />`}
                                        </div>
                                        <div class="border-t border-black pt-1 text-[8px] font-bold uppercase">Accounts Clerk</div>
                                    </div>
                                    <div class="text-center w-32">
                                        <div class="h-10 flex items-center justify-center mb-1">
                                            <img src="${data.settings.schoolLogo}" class="h-full object-contain opacity-20 grayscale" />
                                        </div>
                                        <div class="border-t border-black pt-1 text-[8px] font-bold uppercase">School Stamp</div>
                                    </div>
                                </div>
                                <p class="text-[10px] italic">Thank you for your payment.</p>
                            </div>
                            
                            <div class="flex gap-2">
                                <button onClick=${() => handlePrintReceipt('portrait')} class="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold no-print shadow-lg shadow-blue-500/30">
                                    📄 Portrait
                                </button>
                                <button onClick=${() => handlePrintReceipt('landscape')} class="flex-1 py-3 bg-blue-700 text-white rounded-xl font-bold no-print shadow-lg shadow-blue-500/30 border-l border-blue-600">
                                    🖼️ Landscape
                                </button>
                            </div>
                        </div>
                    ` : html`
                        <div class="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                            <span class="text-4xl">🧾</span>
                            <p>Select a student and enter item-wise payments to generate a detailed receipt</p>
                        </div>
                    `}
                </div>
            </div>

            
            <div class="hidden print:block mb-4 print-section-table">
                <div class="text-center border-b-2 border-black pb-2 mb-2">
                    <h1 class="text-xl font-black uppercase">${data.settings.schoolName}</h1>
                    <p class="text-xs">${data.settings.schoolAddress}</p>
                    <h2 class="text-lg font-bold mt-2">Payment Transaction Report</h2>
                    <p class="text-xs">Academic Year: ${data.settings.academicYear} | Generated: ${new Date().toLocaleDateString()}</p>
                </div>
            </div>

            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden mt-8 print-section-table">
                <div class="p-6 border-b border-slate-50 flex justify-between items-center no-print">
                    <h3 class="font-bold">Transaction History</h3>
                    <div class="flex items-center gap-4">
                        ${data.settings.googleScriptUrl && html`
                            <button 
                                onClick=${async () => {
                                    if (!confirm('Sync all payments to Google Sheet?')) return;
                                    setSyncStatus('Syncing payments...');
                                    googleSheetSync.setSettings(data.settings);
                                    let success = 0, failed = 0;
                                    for (const p of data.payments || []) {
                                        const result = await googleSheetSync.pushPayment(p);
                                        if (result.success) success++;
                                        else failed++;
                                    }
                                    setSyncStatus(`✓ Synced: ${success} success, ${failed} failed`);
                                    setTimeout(() => setSyncStatus(''), 3000);
                                }}
                                class="bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                            >
                                📤 Sync to Google
                            </button>
                            <button 
                                onClick=${async () => {
                                    if (!confirm('Fetch payments from Google Sheet?')) return;
                                    setSyncStatus('Fetching payments...');
                                    googleSheetSync.setSettings(data.settings);
                                    const result = await googleSheetSync.fetchAll();
                                    if (result.success && result.payments) {
                                        const merged = Storage.mergeData(data, { payments: result.payments }, 'payments');
                                        setData(merged);
                                        setSyncStatus(`✓ Fetched ${result.payments.length} payments`);
                                    } else {
                                        setSyncStatus('⚠ Fetch failed');
                                    }
                                    setTimeout(() => setSyncStatus(''), 3000);
                                }}
                                class="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1"
                            >
                                📥 Pull from Google
                            </button>
                        `}
                        ${syncStatus && html`<span class="text-xs font-bold ${syncStatus.includes('✓') ? 'text-green-600' : 'text-blue-600'}">${syncStatus}</span>`}
                        <${PrintButtons} />
                        <select 
                            class="bg-slate-50 border-0 rounded-lg text-[10px] font-bold uppercase p-2 outline-none focus:ring-1 focus:ring-primary"
                            value=${filterGrade}
                            onChange=${e => setFilterGrade(e.target.value)}
                        >
                            <option value="ALL">All Grades</option>
                            ${data.settings.grades.map(g => html`<option value=${g}>${g}</option>`)}
                        </select>
                        <select 
                            class="bg-slate-50 border-0 rounded-lg text-[10px] font-bold uppercase p-2 outline-none focus:ring-1 focus:ring-primary"
                            value=${filterVoided}
                            onChange=${e => setFilterVoided(e.target.value)}
                        >
                            <option value="active">Active Only</option>
                            <option value="voided">Voided Only</option>
                            <option value="all">Show All</option>
                        </select>
                        <div class="relative no-print">
                            <input 
                                type="text"
                                placeholder="Search receipt or student..."
                                class="bg-slate-50 border border-slate-200 text-slate-600 px-3 py-1.5 pl-8 rounded-lg text-[10px] font-bold outline-none focus:ring-1 focus:ring-primary w-48"
                                value=${searchTerm}
                                onInput=${(e) => setSearchTerm(e.target.value)}
                            />
                            <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                        </div>
                        <span class="text-xs text-slate-400">${(data.payments || []).length} Total</span>
                    </div>
                </div>
                <div class="fees-container overflow-x-auto no-scrollbar">
                    <table class="w-full text-left min-w-[500px]">
                        <thead class="bg-slate-50 text-[10px] font-bold uppercase text-slate-500">
                            <tr>
                                <th class="px-6 py-3">Receipt #</th>
                                <th class="px-6 py-3">Student</th>
                                <th class="px-6 py-3">Date</th>
                                <th class="px-6 py-3 text-right">Amount</th>
                                <th class="px-6 py-3 text-center">Status</th>
                                <th class="px-6 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                            ${(data.payments || [])
            .filter(p => {
                // Filter by grade
                if (filterGrade !== 'ALL') {
                const s = (data.students || []).find(st => String(st.id) === String(p.studentId));
                    if ((s && s.grade) !== filterGrade) return false;
                }
                // Filter by voided status
                if (filterVoided === 'active' && p.voided) return false;
                if (filterVoided === 'voided' && !p.voided) return false;
                
                // Search term filter
                if (searchTerm) {
                    const s = (data.students || []).find(st => String(st.id) === String(p.studentId));
                    const searchLower = searchTerm.toLowerCase();
                    const matchesReceipt = p.receiptNo && p.receiptNo.toLowerCase().includes(searchLower);
                    const matchesStudent = s && s.name && s.name.toLowerCase().includes(searchLower);
                    if (!matchesReceipt && !matchesStudent) return false;
                }
                return true;
            })
            .slice().reverse().map(p => {
                const s = (data.students || []).find(st => String(st.id) === String(p.studentId));
                return html`
                                    <tr key=${p.id} class=${p.voided ? 'bg-red-50' : 'hover:bg-slate-50'}>
                                        <td class="px-6 py-4 font-mono text-xs">${p.receiptNo}</td>
                                        <td class="px-6 py-4 font-medium text-sm">
                                            ${(s && s.name) || 'Unknown'}
                                            ${p.voided && html`<span class="ml-2 text-[8px] bg-red-100 text-red-600 px-1 rounded">VOIDED</span>`}
                                        </td>
                                        <td class="px-6 py-4 text-xs text-slate-500">${p.date}</td>
                                        <td class="px-6 py-4 text-right font-bold ${p.voided ? 'text-red-400 line-through' : 'text-slate-700'}">${data.settings.currency} ${p.amount.toLocaleString()}</td>
                                        <td class="px-6 py-4 text-center">
                                            ${p.voided ? html`
                                                <span class="text-[10px] font-bold text-red-500 bg-red-100 px-2 py-1 rounded">VOIDED</span>
                                            ` : html`
                                                <span class="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-1 rounded">PAID</span>
                                            `}
                                        </td>
                                        <td class="px-6 py-4 text-center">
                                            <div class="flex items-center justify-center gap-2">
                                                ${!p.voided && html`
                                                    <button 
                                                        onClick=${() => viewReceipt(p)}
                                                        class="text-blue-600 text-[10px] font-bold uppercase hover:underline"
                                                    >
                                                        View
                                                    </button>
                                                    <button 
                                                        onClick=${() => handleVoidPayment(p.id)}
                                                        class="text-red-500 text-[10px] font-bold uppercase hover:underline"
                                                    >
                                                        Void
                                                    </button>
                                                `}
                                                ${p.voided && html`
                                                    <button 
                                                        onClick=${() => handleRestorePayment(p.id)}
                                                        class="text-green-600 text-[10px] font-bold uppercase hover:underline"
                                                    >
                                                        Restore
                                                    </button>
                                                `}
                                            </div>
                                        </td>
                                    </tr>
                                `;
            })}
                        </tbody>
                        <tfoot class="bg-slate-50 border-t-2 border-slate-200">
                            <tr>
                                <td colspan="3" class="px-6 py-3 text-right font-bold text-xs text-slate-500 uppercase">Total Collected:</td>
                                <td class="px-6 py-3 text-right font-bold text-green-600">
                                    ${data.settings.currency} ${(data.payments || []).filter(p => !p.voided).reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                                </td>
                                <td colspan="2" class="no-print"></td>
                            </tr>
                            <tr class="no-print">
                                <td colspan="3" class="px-6 py-2 text-right font-bold text-xs text-red-500 uppercase">Total Voided:</td>
                                <td class="px-6 py-2 text-right font-bold text-red-400">
                                    ${data.settings.currency} ${(data.payments || []).filter(p => p.voided).reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                                </td>
                                <td colspan="2"></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                ${(!data.payments || data.payments.length === 0) && html`
                    <div class="p-12 text-center text-slate-300">No transactions recorded yet.</div>
                `}
            </div>
            <style>
                @media print {
                    .no-print { display: none !important; }
                    
                    /* Receipt styling */
                    .receipt-container { 
                        background: white !important;
                        color: black !important;
                        border: 2px solid #000 !important;
                        box-shadow: none !important;
                    }
                    
                    /* Transaction History Table */
                    .overflow-x-auto { overflow-x: visible !important; }
                    table { font-size: 10px !important; }
                    th, td { padding: 8px 6px !important; }
                    
                    /* Reset mobile constraints for printing */
                    body, html { height: auto !important; overflow: visible !important; }
                    #app { height: auto !important; overflow: visible !important; }
                    main { overflow: visible !important; position: static !important; }
                }
            </style>
        </div>
    `;
};
