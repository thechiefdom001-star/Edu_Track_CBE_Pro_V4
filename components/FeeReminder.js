import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import htm from 'htm';
import { PrintButtons } from './PrintButtons.js';

const html = htm.bind(h);

export const FeeReminder = ({ data }) => {
    const [filterGrade, setFilterGrade] = useState('ALL');
    const [selectedStudentId, setSelectedStudentId] = useState('ALL');
    const [selectedTerm, setSelectedTerm] = useState('ALL');

    const students = data.students || [];
    const payments = data.payments || [];
    const settings = data.settings || {};

    const feeColumns = [
        { key: 'admission', label: 'Admission' },
        { key: 'diary', label: 'Diary' },
        { key: 'development', label: 'Development' },
        { key: 't1', label: 'Term 1 Tuition' },
        { key: 't2', label: 'Term 2 Tuition' },
        { key: 't3', label: 'Term 3 Tuition' },
        { key: 'boarding', label: 'Boarding' },
        { key: 'breakfast', label: 'Breakfast' },
        { key: 'lunch', label: 'Lunch' },
        { key: 'trip', label: 'Educational Trip' },
        { key: 'bookFund', label: 'Book Fund' },
        { key: 'caution', label: 'Caution Money' },
        { key: 'uniform', label: 'School Uniform' },
        { key: 'studentCard', label: 'Student ID Card' },
        { key: 'remedial', label: 'Remedial Classes' },
        { key: 'assessmentFee', label: 'Assessment Fee' },
        { key: 'projectFee', label: 'Project Fee' },
        { key: 'activityFees', label: 'Activity Fees' },
        { key: 'tieAndBadge', label: 'Tie & Badge' },
        { key: 'academicSupport', label: 'Academic Support' },
        { key: 'pta', label: 'PTA Levy' }
    ];

    const calculateArrears = (student) => {
        const feeStructure = settings.feeStructures?.find(f => f.grade === student.grade);
        if (!feeStructure) return { items: [], totalDue: 0, totalPaid: 0, balance: 0, currentYearPaid: 0 };

        let selectedKeys = student.selectedFees;
        if (typeof selectedKeys === 'string') {
            selectedKeys = selectedKeys.split(',').map(f => f.trim()).filter(f => f);
        } else if (!Array.isArray(selectedKeys)) {
            selectedKeys = ['t1', 't2', 't3'];
        }
        
        const itemized = feeColumns
            .filter(col => selectedKeys.includes(col.key))
            .map(col => {
                const due = Number(feeStructure[col.key]) || 0;
                const paid = payments
                    .filter(p => String(p.studentId) === String(student.id) && !p.voided)
                    .reduce((sum, p) => sum + (Number(p.items?.[col.key]) || 0), 0);
                
                return { label: col.label, due, paid, balance: due - paid, key: col.key };
            })
            .filter(item => item.due > 0 || item.paid > 0);

        const currentYearPaid = payments
            .filter(p => String(p.studentId) === String(student.id) && !p.voided)
            .reduce((sum, p) => sum + Number(p.amount), 0);

        if (Number(student.previousArrears) > 0) {
            itemized.unshift({ 
                label: 'Balance Brought Forward', 
                due: Number(student.previousArrears), 
                paid: 0, 
                balance: Number(student.previousArrears),
                key: 'prev'
            });
        }

        const totalDue = itemized.reduce((sum, i) => sum + i.due, 0);
        const totalPaid = currentYearPaid;
        
        return {
            items: itemized,
            totalDue,
            totalPaid,
            balance: totalDue - totalPaid,
            currentYearPaid
        };
    };

    const filteredStudents = students.filter(s => {
        const matchGrade = filterGrade === 'ALL' || s.grade === filterGrade;
        const matchStudent = selectedStudentId === 'ALL' || s.id === selectedStudentId;
        const finance = calculateArrears(s);
        const hasArrears = finance.balance > 0;
        
        return matchGrade && matchStudent && hasArrears;
    });

    return html`
        <div class="space-y-6">
            
            <div class="bg-gradient-to-r from-[#7FFFD4] via-[#7FFFD4] to-[#7FFFD4] rounded-2xl p-6 text-slate-800 shadow-lg border border-[#5FD3B3]">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div class="flex items-center gap-4">
                        <div class="w-14 h-14 bg-white/40 rounded-xl flex items-center justify-center backdrop-blur">
                            <span class="text-2xl">📋</span>
                        </div>
                        <div>
                            <h2 class="text-2xl font-black tracking-tight text-slate-800">Fee Balance Notices</h2>
                            <p class="text-slate-600 text-sm">Generate professional reminder letters for parents</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-4">
                        <div class="bg-white/40 px-4 py-2 rounded-xl backdrop-blur">
                            <p class="text-[10px] uppercase font-black opacity-60">Students Found</p>
                            <p class="text-xl font-black text-slate-800">${filteredStudents.length}</p>
                        </div>
                        <${PrintButtons} />
                    </div>
                </div>
            </div>

            
            <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div class="space-y-2">
                        <label class="text-xs font-bold text-slate-500 uppercase tracking-wide">Academic Term</label>
                        <select 
                            class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            value=${selectedTerm}
                            onChange=${e => setSelectedTerm(e.target.value)}
                        >
                            <option value="ALL">Full Academic Year</option>
                            <option value="T1">Term 1 Only</option>
                            <option value="T2">Term 2 Only</option>
                            <option value="T3">Term 3 Only</option>
                        </select>
                    </div>
                    <div class="space-y-2">
                        <label class="text-xs font-bold text-slate-500 uppercase tracking-wide">Grade/Class</label>
                        <select 
                            class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            value=${filterGrade}
                            onChange=${e => { setFilterGrade(e.target.value); setSelectedStudentId('ALL'); }}
                        >
                            <option value="ALL">All Grades</option>
                            ${settings.grades?.map(g => html`<option value=${g}>${g}</option>`)}
                        </select>
                    </div>
                    <div class="space-y-2">
                        <label class="text-xs font-bold text-slate-500 uppercase tracking-wide">Student</label>
                        <select 
                            class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            value=${selectedStudentId}
                            onChange=${e => setSelectedStudentId(e.target.value)}
                        >
                            <option value="ALL">All Students with Arrears</option>
                            ${students.filter(s => filterGrade === 'ALL' || s.grade === filterGrade).map(s => html`
                                <option value=${s.id}>${s.name} — ${s.admissionNo}</option>
                            `)}
                        </select>
                    </div>
                </div>
            </div>

            
            ${filteredStudents.length === 0 && html`
                <div class="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-16 text-center">
                    <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="text-4xl">✓</span>
                    </div>
                    <h3 class="text-xl font-bold text-slate-700 mb-2">All Fees Clear!</h3>
                    <p class="text-slate-400">No students with outstanding balances in the selected filters.</p>
                </div>
            `}
            
            
            ${filteredStudents.map((student) => {
                const finance = calculateArrears(student);
                const dueItems = finance.items.filter(item => {
                    if (selectedTerm === 'ALL') return true;
                    const termKey = selectedTerm.toLowerCase();
                    return item.key === 'prev' || !['t1', 't2', 't3'].includes(item.key) || item.key === termKey;
                });
                
                return html`
                    <div class="reminder-document">
                        
                        <div class="doc-header">
                            <div class="school-info">
                                ${settings.schoolLogo && html`<img src="${settings.schoolLogo}" class="school-logo" />`}
                                <div>
                                    <h1 class="school-name">${settings.schoolName || 'SCHOOL NAME'}</h1>
                                    <p class="school-address">${settings.schoolAddress || ''}</p>
                                </div>
                            </div>
                            <div class="doc-meta">
                                <p class="meta-label">Notice Date</p>
                                <p class="meta-value">${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            </div>
                        </div>

                        
                        <div class="report-info">
                            <div class="info-item">
                                <span class="info-label">Class</span>
                                <span class="info-value">${student.grade} ${student.stream || ''}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Term</span>
                                <span class="info-value">${selectedTerm === 'ALL' ? 'Full Year' : selectedTerm}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Academic Year</span>
                                <span class="info-value">${settings.academicYear || '2025/2026'}</span>
                            </div>
                        </div>

                        
                        <div class="notice-title">
                            <h2>Official Fee Balance Notice</h2>
                        </div>

                        
                        <div class="student-balance-grid">
                            
                            <div class="student-box">
                                <div class="box-header">
                                    <span class="box-icon">👤</span>
                                    <p class="box-label">Student Details</p>
                                </div>
                                <p class="student-name">${student.name}</p>
                                <div class="student-details">
                                    <div>
                                        <p class="detail-label">Grade</p>
                                        <p class="detail-value">${student.grade} ${student.stream || ''}</p>
                                    </div>
                                    <div>
                                        <p class="detail-label">Admission No.</p>
                                        <p class="detail-value mono">${student.admissionNo}</p>
                                    </div>
                                </div>
                            </div>

                            
                            <div class="balance-box">
                                <div class="box-header">
                                    <span class="box-icon">💰</span>
                                    <p class="box-label">Outstanding Balance</p>
                                </div>
                                <p class="balance-amount">${settings.currency} ${finance.balance.toLocaleString()}</p>
                                <div class="balance-details">
                                    <div>
                                        <p class="detail-label">Total Due</p>
                                        <p class="detail-value">${settings.currency} ${finance.totalDue.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p class="detail-label">Amount Paid</p>
                                        <p class="detail-value text-green">${settings.currency} ${finance.totalPaid.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        
                        <table class="fee-table">
                            <thead>
                                <tr>
                                    <th class="text-left">Fee Item</th>
                                    <th class="text-right">Amount Due</th>
                                    <th class="text-right">Amount Paid</th>
                                    <th class="text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${dueItems.map(item => html`
                                    <tr class=${item.balance > 0 ? 'has-balance' : ''}>
                                        <td>${item.label}</td>
                                        <td class="text-right mono">${item.due.toLocaleString()}</td>
                                        <td class="text-right mono text-green">${item.paid.toLocaleString()}</td>
                                        <td class="text-right mono ${item.balance > 0 ? 'text-red' : 'text-gray'}">
                                            ${item.balance > 0 ? item.balance.toLocaleString() : '-'}
                                        </td>
                                    </tr>
                                `)}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td><strong>TOTAL</strong></td>
                                    <td class="text-right"><strong>${finance.totalDue.toLocaleString()}</strong></td>
                                    <td class="text-right text-green"><strong>${finance.totalPaid.toLocaleString()}</strong></td>
                                    <td class="text-right text-red"><strong>${finance.balance.toLocaleString()}</strong></td>
                                </tr>
                            </tfoot>
                        </table>

                        
                        <div class="notice-message">
                            <p><strong>Dear Parent/Guardian,</strong></p>
                            <p>This is a friendly reminder that there is an outstanding balance of <strong class="amount">${settings.currency} ${finance.balance.toLocaleString()}</strong> on your child's school fees account. Please arrange payment at your earliest convenience to avoid interruption of learning services.</p>
                        </div>

                        
                        ${(settings.bankName || settings.mpesaPaybill || settings.airtelPaybill) && html`
                            <div class="payment-section">
                                <p class="payment-title">Official Payment Channels</p>
                                <div class="methods-grid">
                                    ${settings.bankName && html`
                                        <div class="method-card">
                                            <p class="method-name">🏦 Bank Transfer</p>
                                            <p class="method-detail">${settings.bankName}</p>
                                            <p class="method-small">A/C: ${settings.bankAccount || 'N/A'}</p>
                                        </div>
                                    `}
                                    ${settings.mpesaPaybill && html`
                                        <div class="method-card">
                                            <p class="method-name">📱 M-Pesa</p>
                                            <p class="method-detail">Paybill: ${settings.mpesaPaybill}</p>
                                            <p class="method-small">A/C: ${settings.mpesaAccountName || 'School Fees'}</p>
                                        </div>
                                    `}
                                    ${settings.airtelPaybill && html`
                                        <div class="method-card">
                                            <p class="method-name">📱 Airtel</p>
                                            <p class="method-detail">Paybill: ${settings.airtelPaybill}</p>
                                            <p class="method-small">A/C: ${settings.airtelAccountName || 'School Fees'}</p>
                                        </div>
                                    `}
                                </div>
                            </div>
                        `}

                        
                        <div class="signatures">
                            <div class="sig-box">
                                <div class="sig-line">
                                    ${settings.clerkSignature && html`<img src="${settings.clerkSignature}" class="sig-img" />`}
                                </div>
                                <p class="sig-label">Authorized Signatory</p>
                                <p class="sig-sub">Accounts Department</p>
                            </div>
                            <div class="sig-box">
                                <div class="stamp-box">
                                    ${settings.schoolLogo && html`<img src="${settings.schoolLogo}" class="stamp-img" />`}
                                </div>
                                <p class="sig-label">School Stamp</p>
                            </div>
                        </div>
                    </div>
                `;
            })}

            
            <style>${`
                /* Document Styles - Print Ready */
                .reminder-document {
                    width: 210mm;
                    min-height: 297mm;
                    margin: 0 auto 30px;
                    background: white;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                    padding: 15mm;
                    box-sizing: border-box;
                    border-radius: 12px;
                    page-break-after: always;
                    font-family: system-ui, -apple-system, sans-serif;
                }
                
                /* Document Header */
                .doc-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    padding-bottom: 15px;
                    border-bottom: 3px solid #C0C0C0;
                    margin-bottom: 15px;
                    background: #C0C0C0;
                    margin: -15mm -15mm 15px -15mm;
                    padding: 15mm;
                    border-radius: 0;
                }
                
                .school-info {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                
                .school-logo {
                    width: 60px;
                    height: 60px;
                    object-fit: contain;
                    background: white;
                    padding: 4px;
                    border-radius: 8px;
                }
                
                .school-name {
                    font-size: 22px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: #1e293b;
                    margin: 0;
                }
                
                .school-address {
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    color: #475569;
                    margin: 4px 0 0 0;
                }
                
                .doc-meta {
                    text-align: right;
                    background: rgba(255,255,255,0.7);
                    padding: 10px 15px;
                    border-radius: 8px;
                    border: 1px solid #9ca3af;
                }
                
                .meta-label {
                    font-size: 10px;
                    text-transform: uppercase;
                    color: #6b7280;
                    margin: 0;
                }
                
                .meta-value {
                    font-size: 14px;
                    font-weight: bold;
                    color: #1e293b;
                    margin: 2px 0 0 0;
                }
                
                /* Report Info */
                .report-info {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                    margin-bottom: 15px;
                }
                
                .info-item {
                    background: #f8fafc;
                    padding: 12px;
                    border-radius: 10px;
                    text-align: center;
                    border: 1px solid #e2e8f0;
                }
                
                .info-label {
                    display: block;
                    font-size: 10px;
                    text-transform: uppercase;
                    color: #94a3b8;
                    margin-bottom: 4px;
                    font-weight: 600;
                }
                
                .info-value {
                    display: block;
                    font-size: 14px;
                    font-weight: 800;
                    color: #1e293b;
                }
                
                /* Notice Title */
                .notice-title {
                    text-align: center;
                    padding: 12px 0;
                    border-bottom: 2px solid #e2e8f0;
                    margin-bottom: 15px;
                }
                
                .notice-title h2 {
                    font-size: 14px;
                    font-weight: 900;
                    text-transform: uppercase;
                    letter-spacing: 3px;
                    color: #1e293b;
                    margin: 0;
                }
                
                /* Student & Balance Grid */
                .student-balance-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 15px;
                    margin-bottom: 15px;
                }
                
                .student-box, .balance-box {
                    padding: 15px;
                    border-radius: 12px;
                }
                
                .student-box {
                    background: #eff6ff;
                    border: 1px solid #bfdbfe;
                }
                
                .balance-box {
                    background: #fef2f2;
                    border: 1px solid #fecaca;
                }
                
                .box-header {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 10px;
                }
                
                .box-icon {
                    width: 28px;
                    height: 28px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                }
                
                .student-box .box-icon { background: #3b82f6; }
                .balance-box .box-icon { background: #ef4444; }
                
                .box-label {
                    font-size: 10px;
                    text-transform: uppercase;
                    font-weight: 700;
                }
                
                .student-box .box-label { color: #3b82f6; }
                .balance-box .box-label { color: #ef4444; }
                
                .student-name {
                    font-size: 18px;
                    font-weight: 900;
                    color: #1e293b;
                    margin: 0 0 10px 0;
                }
                
                .student-details {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }
                
                .detail-label {
                    font-size: 10px;
                    color: #94a3b8;
                    margin: 0;
                }
                
                .detail-value {
                    font-size: 13px;
                    font-weight: 700;
                    color: #334155;
                    margin: 2px 0 0 0;
                }
                
                .detail-value.mono { font-family: monospace; }
                .detail-value.text-green { color: #16a34a; }
                
                .balance-amount {
                    font-size: 28px;
                    font-weight: 900;
                    color: #dc2626;
                    margin: 0 0 10px 0;
                }
                
                .balance-details {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }
                
                /* Fee Table */
                .fee-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 15px;
                    font-size: 12px;
                    border: 1px solid #e2e8f0;
                    border-radius: 10px;
                    overflow: hidden;
                }
                
                .fee-table th {
                    background: #1e293b;
                    color: white;
                    padding: 12px 10px;
                    text-align: left;
                    font-size: 10px;
                    text-transform: uppercase;
                    font-weight: 700;
                }
                
                .fee-table td {
                    padding: 10px;
                    border-bottom: 1px solid #f1f5f9;
                }
                
                .fee-table tr.has-balance { background: #fef2f2; }
                .fee-table tbody tr:last-child td { border-bottom: none; }
                
                .fee-table tfoot td {
                    background: #f8fafc;
                    border-top: 2px solid #1e293b;
                    padding: 12px 10px;
                    font-size: 12px;
                }
                
                .text-left { text-align: left; }
                .text-right { text-align: right; }
                .mono { font-family: monospace; }
                .text-green { color: #16a34a; }
                .text-red { color: #dc2626; }
                .text-gray { color: #9ca3af; }
                
                /* Notice Message */
                .notice-message {
                    background: #fffbeb;
                    border: 1px solid #fcd34d;
                    padding: 15px;
                    border-radius: 10px;
                    margin-bottom: 15px;
                    font-size: 12px;
                    line-height: 1.6;
                }
                
                .notice-message p { margin: 0 0 8px 0; color: #78350f; }
                .notice-message p:last-child { margin-bottom: 0; }
                .notice-message .amount { font-size: 16px; color: #dc2626; font-weight: 900; }
                
                /* Payment Methods */
                .payment-section {
                    background: #f8fafc;
                    border-radius: 10px;
                    padding: 15px;
                    margin-bottom: 15px;
                    border: 1px solid #e2e8f0;
                }
                
                .payment-title {
                    font-size: 10px;
                    text-transform: uppercase;
                    font-weight: 700;
                    color: #64748b;
                    margin: 0 0 12px 0;
                }
                
                .methods-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                }
                
                .method-card {
                    background: white;
                    padding: 12px;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                }
                
                .method-name {
                    font-size: 12px;
                    font-weight: 700;
                    color: #1e293b;
                    margin: 0 0 4px 0;
                }
                
                .method-detail {
                    font-size: 11px;
                    font-weight: 600;
                    color: #475569;
                    margin: 0;
                }
                
                .method-small {
                    font-size: 9px;
                    color: #94a3b8;
                    margin: 4px 0 0 0;
                }
                
                /* Signatures */
                .signatures {
                    display: flex;
                    justify-content: space-between;
                    padding-top: 20px;
                    border-top: 1px solid #e2e8f0;
                    margin-top: auto;
                }
                
                .sig-box { text-align: center; }
                
                .sig-line {
                    height: 50px;
                    width: 150px;
                    border-bottom: 1px solid #1e293b;
                    margin-bottom: 6px;
                    display: flex;
                    align-items: flex-end;
                    justify-content: center;
                }
                
                .sig-img { max-height: 45px; object-fit: contain; }
                
                .sig-label {
                    font-size: 10px;
                    font-weight: 700;
                    text-transform: uppercase;
                    color: #1e293b;
                    margin: 0;
                }
                
                .sig-sub {
                    font-size: 9px;
                    color: #94a3b8;
                    margin: 2px 0 0 0;
                }
                
                .stamp-box {
                    width: 60px;
                    height: 60px;
                    border: 2px solid #1e293b;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 6px;
                    opacity: 0.3;
                }
                
                .stamp-img { width: 50px; height: 50px; object-fit: contain; }
                
                /* Print Styles */
                @media print {
                    @page {
                        size: A4;
                        margin: 0;
                    }
                    
                    html, body {
                        width: 210mm;
                        margin: 0;
                        padding: 0;
                        background: white;
                    }
                    
                    .space-y-6 > *:not(.reminder-document) {
                        display: none !important;
                    }
                    
                    .reminder-document {
                        width: 100%;
                        min-height: 100vh;
                        margin: 0;
                        padding: 10mm;
                        box-shadow: none;
                        border-radius: 0;
                        page-break-after: always;
                        page-break-inside: avoid;
                    }
                    
                    .reminder-document:last-child {
                        page-break-after: auto;
                    }
                    
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    
                    .doc-header {
                        background: #C0C0C0 !important;
                        margin: -10mm -10mm 15px -10mm;
                        padding: 10mm;
                    }
                    
                    .student-box { background: #eff6ff !important; }
                    .balance-box { background: #fef2f2 !important; }
                    .fee-table tr.has-balance { background: #fef2f2 !important; }
                    .notice-message { background: #fffbeb !important; }
                    .payment-section { background: #f8fafc !important; }
                    .method-card { background: white !important; }
                    .info-item { background: #f8fafc !important; }
                }
            `}</style>
        </div>
    `;
};
