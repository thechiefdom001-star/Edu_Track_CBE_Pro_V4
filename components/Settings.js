import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { PrintButtons } from './PrintButtons.js';
import { googleSheetSync } from '../lib/googleSheetSync.js';

const html = htm.bind(h);

export const Settings = ({ data, setData }) => {
    if (!data || !data.settings) {
        return html`<div class="p-12 text-center text-slate-400 font-bold">Initializing Settings...</div>`;
    }

    const [updating, setUpdating] = useState(false);
    const [expandedGroups, setExpandedGroups] = useState([]);
    const [editingFeeGrade, setEditingFeeGrade] = useState(null);
    const [showImportModal, setShowImportModal] = useState(false);
    const [hiddenFeeItems, setHiddenFeeItems] = useState({});
    const [showAddNewFeeModal, setShowAddNewFeeModal] = useState(false);
    const [newFeeItem, setNewFeeItem] = useState({ key: '', label: '', amount: 0, grade: '' });
    const [pendingImportData, setPendingImportData] = useState(null);
    const [importSelections, setImportSelections] = useState({
        students: true,
        marks: true,
        attendance: true,
        staff: true,
        finance: true,
        settings: true,
        modules: true,
        archives: true
    });
    const [clearExisting, setClearExisting] = useState(false);
    const [fetchingSettings, setFetchingSettings] = useState(false);
    
    const [localSettings, setLocalSettings] = useState(data.settings);
    useEffect(() => {
        setLocalSettings(data.settings || {});
        // Initialize hiddenFeeItems from saved settings
        setHiddenFeeItems(data.settings?.hiddenFeeItems || {});
    }, [data.settings]);
    const settings = localSettings;

    // Save hiddenFeeItems to settings when it changes
    useEffect(() => {
        if (Object.keys(hiddenFeeItems).length > 0) {
            setData({
                ...data,
                settings: {
                    ...data.settings,
                    hiddenFeeItems
                }
            });
        }
    }, [hiddenFeeItems]);

    const updateFee = (grade, field, val) => {
        const newStructures = (settings.feeStructures || []).map(f => 
            f.grade === grade ? { ...f, [field]: Number(val) } : f
        );
        const newSettings = { ...settings, feeStructures: newStructures };
        setData({
            ...data,
            settings: newSettings
        });

        // Auto-sync to Google if configured
        if (data.settings?.googleScriptUrl) {
            googleSheetSync.setSettings(newSettings);
            googleSheetSync.pushSettings(newSettings, 'admin').catch(err => {
                console.error('[Settings] Auto-sync failed:', err);
            });
        }
    };

    const handleUpdateProfile = async () => {
        // Apply local settings to global data when saving
        setUpdating(true);
        const newSettings = { ...settings };
        setData({ ...data, settings: newSettings });

        // Auto-push to Google if URL is configured
        if (newSettings.googleScriptUrl) {
            try {
                googleSheetSync.setSettings(newSettings);
                await googleSheetSync.pushSettings(newSettings, 'admin');
                console.log('[Settings] Auto-pushed to Google after saving profile');
            } catch (err) {
                console.error('[Settings] Auto-push failed:', err);
            }
        }

        setTimeout(() => setUpdating(false), 1000);
    };

    const handlePushSettingsToGoogle = async () => {
        if (!data.settings?.googleScriptUrl) {
            alert('Google Sheet not configured. Please add the URL in Settings > Google Sheet Sync.');
            return;
        }

        console.log('[Settings Push] data.settings keys:', Object.keys(data.settings));
        console.log('[Settings Push] feeStructures count:', data.settings.feeStructures?.length || 0);
        console.log('[Settings Push] feeStructures grades:', data.settings.feeStructures?.map(f => f.grade) || []);

        const confirmed = confirm('Push settings to Google Sheet?\n\nThis will update fee structures and other settings for all admins.\nContinue?');
        if (!confirmed) return;

        setUpdating(true);
        try {
            googleSheetSync.setSettings(data.settings);
            const result = await googleSheetSync.pushSettings(data.settings, 'admin');

            console.log('[Settings Push] Result:', result);

            if (result.success) {
                alert('✅ Settings pushed to Google Sheet successfully!\n\nAll admins will see the updated fee structures on next sync.');
            } else {
                alert('❌ Failed to push settings: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('[Settings Push] Error:', error);
            alert('❌ Error pushing settings: ' + error.message);
        } finally {
            setUpdating(false);
        }
    };

    const handleFetchSettingsFromGoogle = async () => {
        if (!settings.googleScriptUrl) {
            alert('Please enter the Google Sheet URL first');
            return;
        }

        setFetchingSettings(true);
        try {
            googleSheetSync.setSettings(settings);
            const result = await googleSheetSync.fetchSettings();

            console.log('[Settings Fetch] Result:', result);

            if (result.success && result.settings) {
                // Merge fetched settings with current settings, preserving some local values
                const mergedSettings = {
                    ...data.settings,
                    ...result.settings,
                    googleScriptUrl: settings.googleScriptUrl, // Keep the URL
                    theme: data.settings?.theme, // Keep theme preference
                    primaryColor: data.settings?.primaryColor, // Keep color preference
                    secondaryColor: data.settings?.secondaryColor
                };

                setData({
                    ...data,
                    settings: mergedSettings
                });

                // Save to localStorage immediately
                Storage.save({ ...data, settings: mergedSettings });

                alert('✅ Settings fetched from Google Sheet successfully!\n\n' +
                    'School Name: ' + (result.settings.schoolName || 'Updated') + '\n' +
                    'Fee Structures: ' + (result.settings.feeStructures?.length || 0) + ' grades loaded');
            } else {
                alert('❌ Failed to fetch settings: ' + (result.error || 'No settings found'));
            }
        } catch (error) {
            console.error('[Settings Fetch] Error:', error);
            alert('❌ Error fetching settings: ' + error.message);
        } finally {
            setFetchingSettings(false);
        }
    };

    const handleImageUpload = async (e, field) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            setData({
                ...data, 
                settings: { ...settings, [field]: event.target.result }
            });
        };
        reader.readAsDataURL(file);
    };

    const feeColumns = [
        { key: 'admission', label: 'Adm' },
        { key: 'diary', label: 'Diary' },
        { key: 'development', label: 'Dev' },
        { key: 't1', label: 'T1 Tuition' },
        { key: 't2', label: 'T2 Tuition' },
        { key: 't3', label: 'T3 Tuition' },
        { key: 'boarding', label: 'Board' },
        { key: 'breakfast', label: 'Brkfast' },
        { key: 'lunch', label: 'Lunch' },
        { key: 'trip', label: 'Trip' },
        { key: 'bookFund', label: 'Books' },
        { key: 'caution', label: 'Caution' },
        { key: 'uniform', label: 'Uniform' },
        { key: 'studentCard', label: 'School ID' },
        { key: 'remedial', label: 'Remed' },
        { key: 'assessmentFee', label: 'Assessment Fee' },
        { key: 'projectFee', label: 'Project' },
        { key: 'activityFees', label: 'Activity Fees' },
        { key: 'tieAndBadge', label: 'Tie & Badge' },
        { key: 'academicSupport', label: 'Academic Support' },
        { key: 'pta', label: 'PTA' },
        ...(settings.customFeeColumns || [])
    ];

    const getGradeGroup = (grade) => {
        const baby = ['BABY CLASS'];
        const pp1pp2 = ['PP1', 'PP2'];
        const grade1to3 = ['GRADE 1', 'GRADE 2', 'GRADE 3'];
        const grade4to6 = ['GRADE 4', 'GRADE 5', 'GRADE 6'];
        const grade7to9 = ['GRADE 7', 'GRADE 8', 'GRADE 9'];
        const grade10to12 = ['GRADE 10', 'GRADE 11', 'GRADE 12'];
        
        if (baby.includes(grade)) return 'baby';
        if (pp1pp2.includes(grade)) return 'pp1-pp2';
        if (grade1to3.includes(grade)) return 'grade1-3';
        if (grade4to6.includes(grade)) return 'grade4-6';
        if (grade7to9.includes(grade)) return 'grade7-9';
        if (grade10to12.includes(grade)) return 'grade10-12';
        return null;
    };

    const handleExport = () => {
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `edutrack_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                setPendingImportData(importedData);
                setShowImportModal(true);
            } catch (err) {
                alert('Invalid backup file.');
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset input
    };

    const processImport = () => {
        if (!pendingImportData) return;

        let newData = { ...data };

        // Determine if we should clear existing data for unchecked categories
        const confirmClear = clearExisting;

        if (importSelections.students) {
            newData.students = pendingImportData.students || [];
        } else if (confirmClear) {
            newData.students = [];
        }

        if (importSelections.marks) {
            newData.assessments = pendingImportData.assessments || [];
            newData.remarks = pendingImportData.remarks || [];
        } else if (confirmClear) {
            newData.assessments = [];
            newData.remarks = [];
        }

        if (importSelections.staff) {
            newData.teachers = pendingImportData.teachers || [];
            newData.staff = pendingImportData.staff || [];
        } else if (confirmClear) {
            newData.teachers = [];
            newData.staff = [];
        }

        if (importSelections.attendance) {
            newData.attendance = pendingImportData.attendance || [];
        } else if (confirmClear) {
            newData.attendance = [];
        }

        if (importSelections.finance) {
            newData.payments = pendingImportData.payments || [];
            newData.payroll = pendingImportData.payroll || [];
            newData.paymentPrompts = pendingImportData.paymentPrompts || [];
        } else if (confirmClear) {
            newData.payments = [];
            newData.payroll = [];
            newData.paymentPrompts = [];
        }

        if (importSelections.settings) {
            newData.settings = { 
                ...newData.settings, // Keep current settings first
                ...pendingImportData.settings,
                // Preserve critical fields that shouldn't be lost
                schoolLogo: pendingImportData.settings?.schoolLogo || settings.schoolLogo,
                googleScriptUrl: newData.settings?.googleScriptUrl // KEEP EXISTING URL!
            };
            console.log('[Import] Settings merged, URL preserved:', newData.settings?.googleScriptUrl);
        }
        // Note: Settings are usually required, so we don't clear them if unchecked

        if (importSelections.modules) {
            newData.transport = pendingImportData.transport || { routes: [], assignments: [] };
            newData.library = pendingImportData.library || { books: [], transactions: [] };
        } else if (confirmClear) {
            newData.transport = { routes: [], assignments: [] };
            newData.library = { books: [], transactions: [] };
        }

        if (importSelections.archives) {
            newData.archives = pendingImportData.archives || [];
        } else if (confirmClear) {
            newData.archives = [];
        }

        setData(newData);
        
        // Explicitly save to localStorage immediately to ensure data persists
        Storage.save(newData);
        console.log('[Import] Saved to localStorage:', newData.students?.length, 'students');
        
        setShowImportModal(false);
        setPendingImportData(null);
        alert('Data integration complete! ' + (newData.students?.length || 0) + ' students saved locally.\n\nUse "Force Push" button to send to Google Sheet.');
    };

    return html`
        <div class="space-y-8 pb-20">
            <div class="no-print">
                <h2 class="text-2xl font-bold">School Settings</h2>
                <p class="text-slate-500">Configure school profile, themes, and complex fee structures</p>
            </div>

            <div class="grid grid-cols-1 gap-8">
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 class="font-bold mb-6 flex items-center gap-2">
                        <span class="w-4 h-4 bg-blue-500 rounded text-white flex items-center justify-center text-[10px]">🎨</span>
                        Appearance & Branding
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div class="space-y-1">
                            <label class="text-xs font-bold text-slate-500 uppercase">System Theme</label>
                            <select 
                                class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-blue-400"
                                value=${settings.theme || 'light'}
                                onChange=${(e) => setData({...data, settings: {...settings, theme: e.target.value}})}
                            >
                                <option value="light">☀️ Light Mode</option>
                                <option value="dark">🌙 Dark Mode</option>
                            </select>
                        </div>
                        <div class="space-y-1">
                            <label class="text-xs font-bold text-slate-500 uppercase">Primary Color</label>
                            <div class="flex gap-2">
                                <input 
                                    type="color"
                                    class="w-12 h-12 p-1 rounded-xl cursor-pointer bg-slate-50 border border-slate-100"
                                    value=${settings.primaryColor || '#2563eb'}
                                    onInput=${(e) => setData({...data, settings: {...settings, primaryColor: e.target.value}})}
                                />
                                <input 
                                    class="flex-1 p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 text-xs font-mono"
                                    value=${settings.primaryColor}
                                    onInput=${(e) => setData({...data, settings: {...settings, primaryColor: e.target.value}})}
                                />
                            </div>
                        </div>
                        <div class="space-y-1">
                            <label class="text-xs font-bold text-slate-500 uppercase">Secondary Color</label>
                            <div class="flex gap-2">
                                <input 
                                    type="color"
                                    class="w-12 h-12 p-1 rounded-xl cursor-pointer bg-slate-50 border border-slate-100"
                                    value=${settings.secondaryColor || '#64748b'}
                                    onInput=${(e) => setData({...data, settings: {...settings, secondaryColor: e.target.value}})}
                                />
                                <input 
                                    class="flex-1 p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 text-xs font-mono"
                                    value=${settings.secondaryColor}
                                    onInput=${(e) => setData({...data, settings: {...settings, secondaryColor: e.target.value}})}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 class="font-bold mb-4 flex items-center gap-2">
                        <span class="w-4 h-4 bg-blue-500 rounded text-white flex items-center justify-center text-[10px]">💾</span>
                        Data Management
                    </h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="p-4 border border-slate-100 rounded-xl bg-slate-50">
                            <h4 class="text-xs font-black uppercase text-slate-400 mb-2">Backup System</h4>
                            <p class="text-[10px] text-slate-500 mb-4">Export all your school data including students, marks, and financial records to a JSON file.</p>
                            <button 
                                onClick=${handleExport}
                                class="w-full py-2 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900 transition-colors"
                            >
                                Export Data (JSON)
                            </button>
                        </div>
                        <div class="p-4 border border-slate-100 rounded-xl bg-slate-50">
                            <h4 class="text-xs font-black uppercase text-slate-400 mb-2">Restore System</h4>
                            <p class="text-[10px] text-slate-500 mb-4">Upload a previously exported backup file to restore your school database.</p>
                            <label class="block">
                                <span class="sr-only">Choose backup file</span>
                                <input 
                                    type="file" 
                                    accept=".json" 
                                    onChange=${handleImportFile}
                                    class="block w-full text-[10px] text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                                />
                            </label>
                        </div>
                    </div>
                </div>

                <div class="bg-white p-6 rounded-2xl shadow-sm border border-orange-100 bg-gradient-to-br from-white to-orange-50/30">
                    <h3 class="font-bold mb-4 flex items-center gap-2 text-orange-800">
                        <span class="w-4 h-4 bg-orange-500 rounded text-white flex items-center justify-center text-[10px]">📅</span>
                        Academic Year Transition
                    </h3>
                    <div class="space-y-4">
                        <p class="text-xs text-slate-500 leading-relaxed">
                            Closing the current academic year will create a read-only <b>Archive Snapshot</b> of all marks, payments, and payroll records. This will clear active academic data to provide a clean slate for the next year.
                        </p>
                        <div class="flex flex-col sm:flex-row items-center gap-3">
                            <div class="flex-1 w-full">
                                <label class="text-[10px] font-black text-slate-400 uppercase mb-1 block">Target Next Year</label>
                                <select 
                                    id="nextYearSelect"
                                    class="w-full p-3 bg-white border border-orange-200 rounded-xl outline-none font-black text-orange-900"
                                >
                                    ${Array.from({ length: 10 }, (_, i) => {
                                        const year = 2025 + i;
                                        return html`<option value="${year}/${year + 1}">${year}/${year + 1}</option>`;
                                    })}
                                </select>
                            </div>
                            <button 
                                onClick=${() => {
                                    const nextYear = document.getElementById('nextYearSelect').value;
                                    if(confirm(`WARNING: This will ARCHIVE all current marks and payments for ${settings.academicYear} and RESET for ${nextYear}. Proceed?`)) {
                                        const newData = Storage.archiveYear(data, nextYear);
                                        setData(newData);
                                        alert('Academic year closed successfully! You can access the records in the Archives menu.');
                                    }
                                }}
                                class="w-full sm:w-auto px-6 py-4 bg-orange-600 text-white rounded-xl font-black text-sm shadow-lg shadow-orange-100 hover:bg-orange-700 transition-all shrink-0"
                            >
                                Close Year & Archive
                            </button>
                        </div>
                    </div>
                </div>

                <div class="bg-white p-6 rounded-2xl shadow-sm border border-teal-100 bg-gradient-to-br from-white to-teal-50/30">
                    <h3 class="font-bold mb-4 flex items-center gap-2 text-teal-800">
                        <span class="w-4 h-4 bg-teal-500 rounded text-white flex items-center justify-center text-[10px]">📅</span>
                        Term Dates Configuration
                    </h3>
                    <p class="text-xs text-slate-500 mb-4">
                        Set the start and end dates for each term. The attendance register will automatically calculate weeks based on these dates.
                    </p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        ${['T1', 'T2', 'T3'].map(term => {
                            const termNum = term === 'T1' ? '1' : term === 'T2' ? '2' : '3';
                            const termData = settings.termDates?.[term] || { start: '', end: '' };
                            return html`
                                <div class="p-4 border border-teal-200 rounded-xl bg-white">
                                    <h4 class="font-bold text-sm mb-3 text-teal-700">Term ${termNum}</h4>
                                    <div class="space-y-2">
                                        <div>
                                            <label class="text-[10px] font-bold text-slate-500 uppercase">Start Date</label>
                                            <input 
                                                type="date"
                                                value=${termData.start || ''}
                                                onChange=${(e) => {
                                                    setData({
                                                        ...data,
                                                        settings: {
                                                            ...settings,
                                                            termDates: {
                                                                ...(settings.termDates || {}),
                                                                [term]: { ...termData, start: e.target.value }
                                                            }
                                                        }
                                                    });
                                                }}
                                                class="w-full mt-1 px-3 py-2 border border-teal-200 rounded-lg text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label class="text-[10px] font-bold text-slate-500 uppercase">End Date</label>
                                            <input 
                                                type="date"
                                                value=${termData.end || ''}
                                                onChange=${(e) => {
                                                    setData({
                                                        ...data,
                                                        settings: {
                                                            ...settings,
                                                            termDates: {
                                                                ...(settings.termDates || {}),
                                                                [term]: { ...termData, end: e.target.value }
                                                            }
                                                        }
                                                    });
                                                }}
                                                class="w-full mt-1 px-3 py-2 border border-teal-200 rounded-lg text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            `;
                        })}
                    </div>
                </div>

                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 class="font-bold mb-4 flex items-center gap-2">
                        <span class="w-4 h-4 bg-purple-500 rounded text-white flex items-center justify-center text-[10px]">K</span>
                        KNEC KJSEA Grading System
                    </h3>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                        ${[
                            { l: 'EE1', p: '8 pts', r: '90-100%', c: 'bg-green-500', t: 'Exceptional' },
                            { l: 'EE2', p: '7 pts', r: '75-89%', c: 'bg-green-400', t: 'Very Good' },
                            { l: 'ME1', p: '6 pts', r: '58-74%', c: 'bg-blue-500', t: 'Good' },
                            { l: 'ME2', p: '5 pts', r: '41-57%', c: 'bg-blue-400', t: 'Fair' },
                            { l: 'AE1', p: '4 pts', r: '31-40%', c: 'bg-yellow-500', t: 'Needs Impr.' },
                            { l: 'AE2', p: '3 pts', r: '21-30%', c: 'bg-yellow-400', t: 'Below Avg.' },
                            { l: 'BE1', p: '2 pts', r: '11-20%', c: 'bg-red-400', t: 'Well Below' },
                            { l: 'BE2', p: '1 pt', r: '1-10%', c: 'bg-red-500', t: 'Minimal' }
                        ].map(g => html`
                            <div class="p-3 border border-slate-100 rounded-xl bg-slate-50 flex items-center gap-3">
                                <div class=${`w-8 h-8 rounded-lg ${g.c} text-white flex items-center justify-center font-black text-[10px]`}>${g.l}</div>
                                <div>
                                    <p class="text-[10px] font-bold text-slate-700">${g.r}</p>
                                    <p class="text-[8px] text-slate-400 uppercase font-bold">${g.t}</p>
                                </div>
                            </div>
                        `)}
                    </div>
                </div>

                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <div class="flex items-center justify-between mb-6">
                        <h3 class="font-bold">Fee Structure per Grade (${settings.currency})</h3>
                        <div class="flex items-center gap-2">
                             <${PrintButtons} />
                            <button 
                                onClick=${() => setShowAddNewFeeModal(true)}
                                class="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1"
                            >
                                + Add New Fee
                            </button>
                        </div>
                    </div>
                    
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        ${[
                            { id: 'baby', label: 'Baby Class', grades: ['BABY CLASS'], color: 'bg-yellow-50 border-yellow-200' },
                            { id: 'pp1-pp2', label: 'PP1 - PP2', grades: ['PP1', 'PP2'], color: 'bg-pink-50 border-pink-200' },
                            { id: 'grade1-3', label: 'Grade 1 - 3', grades: ['GRADE 1', 'GRADE 2', 'GRADE 3'], color: 'bg-blue-50 border-blue-200' },
                            { id: 'grade4-6', label: 'Grade 4 - 6', grades: ['GRADE 4', 'GRADE 5', 'GRADE 6'], color: 'bg-green-50 border-green-200' },
                            { id: 'grade7-9', label: 'Grade 7 - 9', grades: ['GRADE 7', 'GRADE 8', 'GRADE 9'], color: 'bg-orange-50 border-orange-200' },
                            { id: 'grade10-12', label: 'Grade 10 - 12', grades: ['GRADE 10', 'GRADE 11', 'GRADE 12'], color: 'bg-purple-50 border-purple-200' }
                        ].map(group => {
                            const groupStructures = (settings.feeStructures || []).filter(f => group.grades.includes(f.grade));
                            const isExpanded = expandedGroups.includes(group.id);
                            const compulsoryFees = settings.compulsoryFees?.[group.id] || {};
                            
                            return html`
                                <div class="border border-slate-200 rounded-xl overflow-hidden shadow-lg shadow-slate-200/50">
                                    <div class=${`p-4 flex items-center justify-between ${group.color}`}>
                                        <div class="flex items-center gap-2">
                                            <span class="font-bold text-sm">${group.label}</span>
                                            <span class="text-xs bg-white px-2 py-0.5 rounded-full">${groupStructures.length} grades</span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <button 
                                                onClick=${() => setExpandedGroups(isExpanded ? expandedGroups.filter(g => g !== group.id) : [...expandedGroups, group.id])}
                                                class="p-1.5 bg-white rounded-lg text-xs font-bold shadow-sm hover:bg-slate-50"
                                            >
                                                ${isExpanded ? '▲' : '▼'}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    ${isExpanded && html`
                                        <div class="p-4 bg-white space-y-3 max-h-96 overflow-y-auto">
                                            ${groupStructures.length === 0 ? html`
                                                <p class="text-xs text-slate-400 text-center py-4">No fee structures defined</p>
                                            ` : groupStructures.map(fee => html`
                                                <div class="border border-slate-100 rounded-lg p-3 space-y-2">
                                                    <div class="flex items-center justify-between">
                                                        <span class="font-bold text-sm">${fee.grade}</span>
                                                        <div class="flex gap-1">
                                                            <button 
                                                                onClick=${() => setEditingFeeGrade(fee.grade)}
                                                                class="text-blue-600 text-[10px] font-bold px-2 py-1 hover:bg-blue-50 rounded"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick=${() => {
                                                                    if (confirm('Delete this fee structure?')) {
                                                                        const newFeeStructures = settings.feeStructures.filter(f => f.grade !== fee.grade);
                                                                        const newSettings = { ...settings, feeStructures: newFeeStructures };
                                                                        const newData = { ...data, settings: newSettings };
                                                                        setData(newData);

                                                                        // Auto-sync to Google if configured
                                                                        if (data.settings?.googleScriptUrl) {
                                                                            googleSheetSync.setSettings(newSettings);
                                                                            googleSheetSync.pushSettings(newSettings, 'admin').catch(err => {
                                                                                console.error('[Settings] Auto-sync failed:', err);
                                                                            });
                                                                        }
                                                                    }
                                                                }}
                                                                class="text-red-500 text-[10px] font-bold px-2 py-1 hover:bg-red-50 rounded"
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div class="grid grid-cols-2 gap-2 text-[9px]">
                                                        <div class="flex justify-between bg-slate-50 p-1.5 rounded">
                                                            <span class="text-slate-500">T1 Tuition:</span>
                                                            <span class="font-bold">${(fee.t1 || 0).toLocaleString()}</span>
                                                        </div>
                                                        <div class="flex justify-between bg-slate-50 p-1.5 rounded">
                                                            <span class="text-slate-500">T2 Tuition:</span>
                                                            <span class="font-bold">${(fee.t2 || 0).toLocaleString()}</span>
                                                        </div>
                                                        <div class="flex justify-between bg-slate-50 p-1.5 rounded">
                                                            <span class="text-slate-500">T3 Tuition:</span>
                                                            <span class="font-bold">${(fee.t3 || 0).toLocaleString()}</span>
                                                        </div>
                                                        <div class="flex justify-between bg-slate-50 p-1.5 rounded">
                                                            <span class="text-slate-500">Admission:</span>
                                                            <span class="font-bold">${(fee.admission || 0).toLocaleString()}</span>
                                                        </div>
                                                        <div class="flex justify-between bg-slate-50 p-1.5 rounded">
                                                            <span class="text-slate-500">Boarding:</span>
                                                            <span class="font-bold">${(fee.boarding || 0).toLocaleString()}</span>
                                                        </div>
                                                        <div class="flex justify-between bg-slate-50 p-1.5 rounded">
                                                            <span class="text-slate-500">Development:</span>
                                                            <span class="font-bold">${(fee.development || 0).toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            `)}
                                            
                                            
                                            <div class="border-t border-slate-100 pt-3 mt-3">
                                                <p class="text-xs font-bold text-slate-500 mb-2">Fee Items - Compulsory/Optional</p>
                                                <div class="space-y-1.5">
                                                    ${feeColumns.filter(col => {
                                                        const customFee = (settings.customFeeColumns || []).find(cf => cf.key === col.key);
                                                        if (!customFee) return true; // Show default fees in all groups
                                                        return customFee.group === group.id; // Show custom fees only in their group
                                                    }).map(col => {
                                                        const isCompulsory = compulsoryFees[col.key] !== false;
                                                        const isHidden = (hiddenFeeItems[group.id] || []).includes(col.key);
                                                        const customFee = (settings.customFeeColumns || []).find(cf => cf.key === col.key);
                                                        return html`
                                                            <div key=${col.key} class=${`flex items-center justify-between bg-slate-50 rounded-lg p-2 ${isHidden ? 'opacity-40' : ''}`}>
                                                                <div class="flex items-center gap-2">
                                                                    <span class="text-[10px] font-medium">${col.label}</span>
                                                                    ${customFee && html`<span class="text-[8px] bg-blue-100 text-blue-600 px-1 rounded">${customFee.grade}</span>`}
                                                                    ${isHidden && html`<span class="text-[8px] text-red-500 font-bold">(Hidden)</span>`}
                                                                </div>
                                                                <div class="flex gap-1">
                                                                    <button 
                                                                        onClick=${() => {
                                                                            const currentCompulsory = settings.compulsoryFees || {};
                                                                            const groupCompulsory = { ...(currentCompulsory[group.id] || {}) };
                                                                            groupCompulsory[col.key] = !isCompulsory;
                                                                            setData({
                                                                                ...data,
                                                                                settings: {
                                                                                    ...settings,
                                                                                    compulsoryFees: {
                                                                                        ...currentCompulsory,
                                                                                        [group.id]: groupCompulsory
                                                                                    }
                                                                                }
                                                                            });
                                                                        }}
                                                                        class=${`text-[9px] font-bold px-2 py-1 rounded-full ${isCompulsory ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}
                                                                    >
                                                                        ${isCompulsory ? 'Compulsory' : 'Optional'}
                                                                    </button>
                                                                    <button 
                                                                        onClick=${() => {
                                                                            const currentHidden = hiddenFeeItems[group.id] || [];
                                                                            const newHidden = isHidden 
                                                                                ? currentHidden.filter(k => k !== col.key)
                                                                                : [...currentHidden, col.key];
                                                                            setHiddenFeeItems({
                                                                                ...hiddenFeeItems,
                                                                                [group.id]: newHidden
                                                                            });
                                                                        }}
                                                                        class=${`text-[9px] font-bold px-2 py-1 rounded-full ${isHidden ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                                                                    >
                                                                        ${isHidden ? 'Show' : 'Hide'}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        `;
                                                    })}
                                                </div>
                                            </div>
                                            
                                            
                                            <button 
                                                onClick=${() => {
                                                    const gradeName = prompt('Enter grade name (e.g., GRADE 1):');
                                                    if (!gradeName) return;
                                                    const newStructure = {
                                                        grade: gradeName.toUpperCase(),
                                                        t1: 0, t2: 0, t3: 0,
                                                        admission: 0, diary: 0, development: 0,
                                                        boarding: 0, breakfast: 0, lunch: 0,
                                                        trip: 0, bookFund: 0, caution: 0,
                                                        uniform: 0, studentCard: 0, remedial: 0,
                                                        assessmentFee: 0, projectFee: 0,
                                                        activityFees: 0, tieAndBadge: 0,
                                                        academicSupport: 0, pta: 0
                                                    };
                                                    const newSettings = {
                                                        ...settings,
                                                        feeStructures: [...settings.feeStructures, newStructure],
                                                        grades: settings.grades.includes(gradeName.toUpperCase()) ? settings.grades : [...settings.grades, gradeName.toUpperCase()]
                                                    };
                                                    setData({
                                                        ...data,
                                                        settings: newSettings
                                                    });

                                                    // Auto-sync to Google if configured
                                                    if (data.settings?.googleScriptUrl) {
                                                        googleSheetSync.setSettings(newSettings);
                                                        googleSheetSync.pushSettings(newSettings, 'admin').catch(err => {
                                                            console.error('[Settings] Auto-sync failed:', err);
                                                        });
                                                    }
                                                }}
                                                class="w-full py-2 mt-3 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                                            >
                                                + Add Grade to Group
                                            </button>
                                        </div>
                                    `}
                                </div>
                            `;
                        })}
                    </div>
                    
                    ${!expandedGroups.includes('pp1-pp2') && html`
                        <div class="mt-4 p-4 bg-blue-50 rounded-xl">
                            <p class="text-xs text-blue-600 font-bold">💡 Click the expand button (▼) on a grade group card to view fee details, toggle compulsory/optional fees, or add new grades.</p>
                        </div>
                    `}
                </div>

                
                ${editingFeeGrade && (() => {
                    const feeStructure = settings.feeStructures.find(f => f.grade === editingFeeGrade);
                    if (!feeStructure) return null;
                    
                    const gradeGroup = [
                        { id: 'baby', grades: ['BABY CLASS'] },
                        { id: 'pp1-pp2', grades: ['PP1', 'PP2'] },
                        { id: 'grade1-3', grades: ['GRADE 1', 'GRADE 2', 'GRADE 3'] },
                        { id: 'grade4-6', grades: ['GRADE 4', 'GRADE 5', 'GRADE 6'] },
                        { id: 'grade7-9', grades: ['GRADE 7', 'GRADE 8', 'GRADE 9'] },
                        { id: 'grade10-12', grades: ['GRADE 10', 'GRADE 11', 'GRADE 12'] }
                    ].find(g => g.grades.includes(editingFeeGrade));
                    const groupId = gradeGroup?.id || 'pp1-pp2';
                    const groupHiddenItems = hiddenFeeItems[groupId] || [];
                    const groupFeeColumns = feeColumns.filter(col => {
                        const customFee = (settings.customFeeColumns || []).find(cf => cf.key === col.key);
                        if (!customFee) return true;
                        return customFee.group === groupId;
                    });
                    
                    return html`
                        <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                            <div class="bg-white w-full max-w-2xl rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                                <div class="flex items-center justify-between mb-4">
                                    <h3 class="text-xl font-black">Edit Fees: ${editingFeeGrade}</h3>
                                    <button onClick=${() => setEditingFeeGrade(null)} class="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                                </div>
                                <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    ${groupFeeColumns.map(col => {
                                        const isHidden = groupHiddenItems.includes(col.key);
                                        const customFee = (settings.customFeeColumns || []).find(cf => cf.key === col.key);
                                        return html`
                                            <div class=${`space-y-1 ${isHidden ? 'opacity-50' : ''}`}>
                                                <div class="flex items-center justify-between">
                                                    <div class="flex items-center gap-1">
                                                        <label class="text-[10px] font-bold text-slate-500 uppercase">${col.label}</label>
                                                        ${customFee && html`<span class="text-[8px] bg-blue-100 text-blue-600 px-1 rounded">${customFee.grade}</span>`}
                                                    </div>
                                                    <button 
                                                        onClick=${() => {
                                                            const currentHidden = hiddenFeeItems[groupId] || [];
                                                            const newHidden = isHidden 
                                                                ? currentHidden.filter(k => k !== col.key)
                                                                : [...currentHidden, col.key];
                                                            setHiddenFeeItems({
                                                                ...hiddenFeeItems,
                                                                [groupId]: newHidden
                                                            });
                                                        }}
                                                        class=${`text-[8px] font-bold px-1.5 py-0.5 rounded ${isHidden ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                                                    >
                                                        ${isHidden ? 'Show' : 'Hide'}
                                                    </button>
                                                </div>
                                                <input
                                                    type="number"
                                                    class="w-full p-2 bg-slate-50 rounded-lg text-sm font-bold border border-slate-200 focus:border-blue-500 outline-none"
                                                    value=${feeStructure[col.key] || 0}
                                                    onInput=${(e) => {
                                                        const newStructures = settings.feeStructures.map(f =>
                                                            f.grade === editingFeeGrade ? { ...f, [col.key]: Number(e.target.value) } : f
                                                        );
                                                        const newSettings = { ...settings, feeStructures: newStructures };
                                                        setData({ ...data, settings: newSettings });

                                                        // Auto-sync to Google if configured
                                                        if (data.settings?.googleScriptUrl) {
                                                            googleSheetSync.setSettings(newSettings);
                                                            googleSheetSync.pushSettings(newSettings, 'admin').catch(err => {
                                                                console.error('[Settings] Auto-sync failed:', err);
                                                            });
                                                        }
                                                    }}
                                                />
                                            </div>
                                        `;
                                    })}
                                </div>
                                <div class="flex gap-3 mt-6">
                                    <button onClick=${() => setEditingFeeGrade(null)} class="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold">Done</button>
                                </div>
                            </div>
                        </div>
                    `;
                })()}

                
                ${showAddNewFeeModal && html`
                    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div class="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-xl font-black">Add New Fee Item</h3>
                                <button onClick=${() => setShowAddNewFeeModal(false)} class="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
                            </div>
                            <div class="space-y-4">
                                <div class="space-y-2">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Fee Name (display)</label>
                                    <input 
                                        type="text" 
                                        class="w-full p-3 bg-slate-50 rounded-lg text-sm font-bold border border-slate-200 focus:border-blue-500 outline-none"
                                        placeholder="e.g., Music Fee"
                                        value=${newFeeItem.label}
                                        onInput=${(e) => {
                                            const key = e.target.value.replace(/\s+/g, '').toLowerCase();
                                            setNewFeeItem({ ...newFeeItem, label: e.target.value, key });
                                        }}
                                    />
                                </div>
                                <div class="space-y-2">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Amount (${settings.currency})</label>
                                    <input 
                                        type="number" 
                                        class="w-full p-3 bg-slate-50 rounded-lg text-sm font-bold border border-slate-200 focus:border-blue-500 outline-none"
                                        placeholder="e.g., 5000"
                                        value=${newFeeItem.amount || ''}
                                        onInput=${(e) => setNewFeeItem({ ...newFeeItem, amount: Number(e.target.value) })}
                                    />
                                </div>
                                <div class="space-y-2">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Select Class/Grade</label>
                                    <select 
                                        class="w-full p-3 bg-slate-50 rounded-lg text-sm font-bold border border-slate-200 focus:border-blue-500 outline-none"
                                        value=${newFeeItem.grade}
                                        onChange=${(e) => setNewFeeItem({ ...newFeeItem, grade: e.target.value })}
                                    >
                                        <option value="">Select Grade</option>
                                        ${(settings.feeStructures || []).map(f => html`
                                            <option value=${f.grade}>${f.grade}</option>
                                        `)}
                                    </select>
                                </div>
                            </div>
                            <div class="flex gap-3 mt-6">
                                <button 
                                    onClick=${() => setShowAddNewFeeModal(false)} 
                                    class="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick=${() => {
                                        if (!newFeeItem.key || !newFeeItem.label) {
                                            alert('Please enter a fee name');
                                            return;
                                        }
                                        if (!newFeeItem.grade) {
                                            alert('Please select a class/grade');
                                            return;
                                        }
                                        if (feeColumns.some(col => col.key === newFeeItem.key)) {
                                            alert('This fee already exists');
                                            return;
                                        }
                                        
                                        const gradeGroup = getGradeGroup(newFeeItem.grade);
                                        
                                        // Add to customFeeColumns in settings
                                        const currentCustomFees = settings.customFeeColumns || [];
                                        const updatedCustomFees = [...currentCustomFees, { 
                                            key: newFeeItem.key, 
                                            label: newFeeItem.label,
                                            grade: newFeeItem.grade,
                                            group: gradeGroup
                                        }];
                                        
                                        // Add to the selected grade's fee structure
                                        const newStructures = (settings.feeStructures || []).map(f => {
                                            if (f.grade === newFeeItem.grade) {
                                                return { ...f, [newFeeItem.key]: newFeeItem.amount || 0 };
                                            }
                                            return f;
                                        });
                                        
                                        setData({ 
                                            ...data, 
                                            settings: { 
                                                ...settings, 
                                                feeStructures: newStructures,
                                                customFeeColumns: updatedCustomFees
                                            } 
                                        });
                                        setShowAddNewFeeModal(false);
                                        setNewFeeItem({ key: '', label: '', amount: 0, grade: '' });
                                        alert('New fee item added to ' + newFeeItem.grade + ' successfully!');
                                    }}
                                    class="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700"
                                >
                                    Add Fee
                                </button>
                            </div>
                        </div>
                    </div>
                `}

                
                ${showImportModal && html`
                    <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                        <div class="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh]">
                            <h3 class="text-2xl font-black mb-2">Selective Import</h3>
                            <p class="text-slate-400 text-sm mb-6">Choose which data categories to override from the backup file.</p>
                            
                            <div class="mb-4 flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                                <div>
                                    <p class="text-[10px] font-black text-red-700 uppercase">Clear existing data</p>
                                    <p class="text-[9px] text-red-600">Remove local records if unchecked</p>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked=${clearExisting} onChange=${() => setClearExisting(!clearExisting)} class="sr-only peer" />
                                    <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600"></div>
                                </label>
                            </div>
                            
                            <div class="grid grid-cols-1 gap-3 mb-8 max-h-[40vh] overflow-y-auto p-1 pr-2 no-scrollbar">
                                ${[
                                    { id: 'students', label: 'Students Directory', icon: '👥' },
                                    { id: 'marks', label: 'Marks & Assessments', icon: '📝' },
                                    { id: 'attendance', label: 'Attendance Records', icon: '📅' },
                                    { id: 'staff', label: 'Teachers & Staff', icon: '👨‍🏫' },
                                    { id: 'finance', label: 'Financial Records', icon: '💰' },
                                    { id: 'settings', label: 'System Settings & Fees', icon: '⚙️' },
                                    { id: 'modules', label: 'Transport & Library', icon: '🚌' },
                                    { id: 'archives', label: 'Archives (Old Years)', icon: '🗄️' }
                                ].map(cat => html`
                                    <label class=${`flex items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                                        importSelections[cat.id] ? 'border-primary bg-blue-50/50' : 'border-slate-100 hover:border-slate-200'
                                    }`}>
                                        <div class="flex items-center gap-3">
                                            <span class="text-xl">${cat.icon}</span>
                                            <span class="font-bold text-sm text-slate-700">${cat.label}</span>
                                        </div>
                                        <input 
                                            type="checkbox" 
                                            class="w-5 h-5 rounded border-slate-300 text-primary focus:ring-primary"
                                            checked=${importSelections[cat.id]}
                                            onChange=${() => setImportSelections({...importSelections, [cat.id]: !importSelections[cat.id]})}
                                        />
                                    </label>
                                `)}
                            </div>

                            <div class="flex gap-3">
                                <button onClick=${() => { setShowImportModal(false); setPendingImportData(null); }} class="flex-1 py-4 text-slate-500 font-bold">Cancel</button>
                                <button onClick=${processImport} class="flex-1 py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-blue-200">Import Selected</button>
                            </div>
                        </div>
                    </div>
                `}

                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 class="font-bold mb-6">School Profile</h3>
                    <div class="space-y-6">
                        <div class="flex flex-col md:flex-row gap-6 items-center border-b pb-6">
                            <label class="relative w-24 h-24 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer group">
                                <img src="${settings.schoolLogo}" class="w-full h-full object-contain" />
                                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span class="text-[10px] text-white font-bold text-center">Upload Logo</span>
                                </div>
                                <input type="file" accept="image/*" class="hidden" onChange=${(e) => handleImageUpload(e, 'schoolLogo')} />
                            </label>
                            <div class="flex-1 space-y-4 w-full">
                                <div class="space-y-1">
                                    <label class="text-xs font-bold text-slate-500 uppercase">Logo Source URL</label>
                                    <div class="flex gap-2">
                                        <input 
                                            class="flex-1 p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-blue-400 text-xs"
                                            value=${settings.schoolLogo}
                                            onInput=${(e) => setData({...data, settings: {...settings, schoolLogo: e.target.value}})}
                                            placeholder="Paste logo URL or upload"
                                        />
                                    </div>
                                    <p class="text-[10px] text-slate-400">Recommended: Transparent PNG, square aspect ratio.</p>
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 border-b pb-6">
                            <div class="space-y-3">
                                <label class="text-xs font-bold text-slate-500 uppercase block">Principal's Signature</label>
                                <div class="flex items-center gap-4">
                                    <label class="w-32 h-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer group shrink-0 relative">
                                        ${settings.principalSignature ? html`
                                            <img src="${settings.principalSignature}" class="w-full h-full object-contain" />
                                        ` : html`
                                            <span class="text-[10px] text-slate-400">Click to upload</span>
                                        `}
                                        <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span class="text-[10px] text-white font-bold">Upload</span>
                                        </div>
                                        <input type="file" accept="image/*" class="hidden" onChange=${(e) => handleImageUpload(e, 'principalSignature')} />
                                    </label>
                                    <div class="flex-1 flex gap-2">
                                        <input 
                                            class="flex-1 p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 text-[10px]"
                                            value=${settings.principalSignature}
                                            onInput=${(e) => setData({...data, settings: {...settings, principalSignature: e.target.value}})}
                                            placeholder="Paste image URL"
                                        />
                                        ${settings.principalSignature && html`
                                            <button 
                                                onClick=${() => setData({...data, settings: {...settings, principalSignature: ''}})}
                                                class="px-3 bg-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-200"
                                            >✕</button>
                                        `}
                                    </div>
                                </div>
                            </div>
                            <div class="space-y-3">
                                <label class="text-xs font-bold text-slate-500 uppercase block">Accounts Clerk's Signature</label>
                                <div class="flex items-center gap-4">
                                    <label class="w-32 h-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer group shrink-0 relative">
                                        ${settings.clerkSignature ? html`
                                            <img src="${settings.clerkSignature}" class="w-full h-full object-contain" />
                                        ` : html`
                                            <span class="text-[10px] text-slate-400">Click to upload</span>
                                        `}
                                        <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <span class="text-[10px] text-white font-bold">Upload</span>
                                        </div>
                                        <input type="file" accept="image/*" class="hidden" onChange=${(e) => handleImageUpload(e, 'clerkSignature')} />
                                    </label>
                                    <div class="flex-1 flex gap-2">
                                        <input 
                                            class="flex-1 p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 text-[10px]"
                                            value=${settings.clerkSignature}
                                            onInput=${(e) => setData({...data, settings: {...settings, clerkSignature: e.target.value}})}
                                            placeholder="Paste image URL"
                                        />
                                        ${settings.clerkSignature && html`
                                            <button 
                                                onClick=${() => setData({...data, settings: {...settings, clerkSignature: ''}})}
                                                class="px-3 bg-red-100 text-red-600 rounded-lg text-xs font-bold hover:bg-red-200"
                                            >✕</button>
                                        `}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="bg-white p-6 rounded-2xl shadow-sm border border-teal-100 mt-6">
                            <h3 class="font-bold mb-4 flex items-center gap-2 text-teal-800">
                                <span class="w-4 h-4 bg-teal-500 rounded text-white flex items-center justify-center text-[10px]">🎓</span>
                                Class Streams Configuration
                            </h3>
                            <p class="text-xs text-slate-500 mb-4">
                                Configure streams for each grade (e.g., A, B, C). Students will be assigned to these streams.
                            </p>
                            <div class="flex flex-wrap gap-2">
                                ${(settings.streams || ['A', 'B', 'C']).map((stream, idx) => html`
                                    <div key=${idx} class="flex items-center gap-1">
                                        <input 
                                            class="w-16 p-2 bg-slate-50 rounded-lg border border-slate-200 text-center font-bold uppercase"
                                            value=${stream}
                                            onInput=${(e) => {
                                                const newStreams = [...(settings.streams || ['A', 'B', 'C'])];
                                                newStreams[idx] = e.target.value.toUpperCase();
                                                setData({...data, settings: {...settings, streams: newStreams}});
                                            }}
                                        />
                                        <button 
                                            onClick=${() => {
                                                const newStreams = (settings.streams || ['A', 'B', 'C']).filter((_, i) => i !== idx);
                                                setData({...data, settings: {...settings, streams: newStreams}});
                                            }}
                                            class="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                        >✕</button>
                                    </div>
                                `)}
                                <button 
                                    onClick=${() => {
                                        const newStreams = [...(settings.streams || ['A', 'B', 'C']), String.fromCharCode(65 + (settings.streams || ['A', 'B', 'C']).length)];
                                        setData({...data, settings: {...settings, streams: newStreams}});
                                    }}
                                    class="px-4 py-2 bg-teal-100 text-teal-700 rounded-lg text-sm font-bold hover:bg-teal-200"
                                >
                                    + Add Stream
                                </button>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">School Name</label>
                                <input 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-blue-400"
                                    value=${settings.schoolName}
                                    onInput=${(e) => setData({...data, settings: {...settings, schoolName: e.target.value}})}
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">School Address</label>
                                <input 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-blue-400"
                                    value=${settings.schoolAddress}
                                    onInput=${(e) => setData({...data, settings: {...settings, schoolAddress: e.target.value}})}
                                />
                            </div>
                        </div>
                        <div class="space-y-1">
                            <label class="text-xs font-bold text-slate-500 uppercase">Academic Year</label>
                            <select 
                                class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-blue-400 font-bold"
                                value=${settings.academicYear || '2025/2026'}
                                onChange=${(e) => setData({...data, settings: {...settings, academicYear: e.target.value}})}
                            >
                                ${Array.from({ length: 27 }, (_, i) => 2025 + i).map(year => html`
                                    <option value="${year}/${year + 1}">${year}/${year + 1}</option>
                                `)}
                            </select>
                        </div>
                        <button 
                            onClick=${handleUpdateProfile}
                            class=${`w-full py-3 rounded-xl font-bold transition-all shadow-lg ${updating ? 'bg-green-500 text-white shadow-green-100' : 'bg-blue-600 text-white shadow-blue-100'}`}
                        >
                            ${updating ? '✓ Changes Saved Successfully' : 'Update School Profile'}
                        </button>
                    </div>
                </div>

                
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
                        <h3 class="text-white font-black text-lg">💳 Bank & Mobile Money Details</h3>
                        <p class="text-green-100 text-xs font-medium">Payment information for receipts and fee reminders</p>
                    </div>
                    <div class="p-6 space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Bank Name</label>
                                <input 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-blue-400"
                                    value=${settings.bankName || ''}
                                    onInput=${(e) => setData({...data, settings: {...settings, bankName: e.target.value}})}
                                    placeholder="e.g. Kenya Commercial Bank"
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Account Number</label>
                                <input 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-blue-400"
                                    value=${settings.bankAccount || ''}
                                    onInput=${(e) => setData({...data, settings: {...settings, bankAccount: e.target.value}})}
                                    placeholder="e.g. 1234567890"
                                />
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">M-Pesa Paybill No.</label>
                                <input 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-blue-400"
                                    value=${settings.mpesaPaybill || ''}
                                    onInput=${(e) => setData({...data, settings: {...settings, mpesaPaybill: e.target.value}})}
                                    placeholder="e.g. 123456"
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Airtel Money Paybill No.</label>
                                <input 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-blue-400"
                                    value=${settings.airtelPaybill || ''}
                                    onInput=${(e) => setData({...data, settings: {...settings, airtelPaybill: e.target.value}})}
                                    placeholder="e.g. 789012"
                                />
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">M-Pesa Account Name</label>
                                <input 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-blue-400"
                                    value=${settings.mpesaAccountName || ''}
                                    onInput=${(e) => setData({...data, settings: {...settings, mpesaAccountName: e.target.value}})}
                                    placeholder="e.g. School Fees Account"
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Airtel Account Name</label>
                                <input 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-blue-400"
                                    value=${settings.airtelAccountName || ''}
                                    onInput=${(e) => setData({...data, settings: {...settings, airtelAccountName: e.target.value}})}
                                    placeholder="e.g. School Fees Account"
                                />
                            </div>
                        </div>
                        <button 
                            onClick=${handleUpdateProfile}
                            class=${`w-full py-3 rounded-xl font-bold transition-all shadow-lg ${updating ? 'bg-green-500 text-white shadow-green-100' : 'bg-green-600 text-white shadow-green-100'}`}
                        >
                            ${updating ? '✓ Saved' : 'Save Payment Details'}
                        </button>
                    </div>
                </div>

                
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="bg-gradient-to-r from-green-600 to-green-800 px-6 py-4">
                        <h3 class="text-white font-black text-lg">🔐 M-Pesa API Configuration</h3>
                        <p class="text-green-100 text-xs font-medium">Safaricom Daraja API credentials for STK Push</p>
                    </div>
                    <div class="p-6 space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Consumer Key</label>
                                <input 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-green-400"
                                    value=${settings.mpesaConsumerKey || ''}
                                    onInput=${(e) => setData({...data, settings: {...settings, mpesaConsumerKey: e.target.value}})}
                                    placeholder="Enter M-Pesa Consumer Key"
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Consumer Secret</label>
                                <input 
                                    type="password"
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-green-400"
                                    value=${settings.mpesaConsumerSecret || ''}
                                    onInput=${(e) => setData({...data, settings: {...settings, mpesaConsumerSecret: e.target.value}})}
                                    placeholder="Enter M-Pesa Consumer Secret"
                                />
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Shortcode</label>
                                <input 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-green-400"
                                    value=${settings.mpesaShortcode || ''}
                                    onInput=${(e) => setData({...data, settings: {...settings, mpesaShortcode: e.target.value}})}
                                    placeholder="e.g. 123456"
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Paybill No.</label>
                                <input 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-green-400"
                                    value=${settings.mpesaPaybill || ''}
                                    onInput=${(e) => setData({...data, settings: {...settings, mpesaPaybill: e.target.value}})}
                                    placeholder="e.g. 123456"
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Callback URL</label>
                                <input 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-green-400"
                                    value=${settings.mpesaCallbackUrl || ''}
                                    onInput=${(e) => setData({...data, settings: {...settings, mpesaCallbackUrl: e.target.value}})}
                                    placeholder="https://your-domain.com/callback"
                                />
                            </div>
                        </div>
                        <button 
                            onClick=${handleUpdateProfile}
                            class=${`w-full py-3 rounded-xl font-bold transition-all shadow-lg ${updating ? 'bg-green-500 text-white' : 'bg-green-600 text-white'}`}
                        >
                            ${updating ? '✓ Saved' : 'Save M-Pesa API Settings'}
                        </button>
                    </div>
                </div>

                
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="bg-gradient-to-r from-red-600 to-red-800 px-6 py-4">
                        <h3 class="text-white font-black text-lg">🔐 Airtel Money API Configuration</h3>
                        <p class="text-red-100 text-xs font-medium">Airtel API credentials for payment prompts</p>
                    </div>
                    <div class="p-6 space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">API Key</label>
                                <input 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-red-400"
                                    value=${settings.airtelApiKey || ''}
                                    onInput=${(e) => setData({...data, settings: {...settings, airtelApiKey: e.target.value}})}
                                    placeholder="Enter Airtel API Key"
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">API Secret</label>
                                <input 
                                    type="password"
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-red-400"
                                    value=${settings.airtelApiSecret || ''}
                                    onInput=${(e) => setData({...data, settings: {...settings, airtelApiSecret: e.target.value}})}
                                    placeholder="Enter Airtel API Secret"
                                />
                            </div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Merchant ID</label>
                                <input 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-red-400"
                                    value=${settings.airtelMerchantId || ''}
                                    onInput=${(e) => setData({...data, settings: {...settings, airtelMerchantId: e.target.value}})}
                                    placeholder="Enter Merchant ID"
                                />
                            </div>
                            <div class="space-y-1">
                                <label class="text-xs font-bold text-slate-500 uppercase">Callback URL</label>
                                <input 
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-red-400"
                                    value=${settings.airtelCallbackUrl || ''}
                                    onInput=${(e) => setData({...data, settings: {...settings, airtelCallbackUrl: e.target.value}})}
                                    placeholder="https://your-domain.com/airtel-callback"
                                />
                            </div>
                        </div>
                        <button 
                            onClick=${handleUpdateProfile}
                            class=${`w-full py-3 rounded-xl font-bold transition-all shadow-lg ${updating ? 'bg-red-500 text-white' : 'bg-red-600 text-white'}`}
                        >
                            ${updating ? '✓ Saved' : 'Save Airtel API Settings'}
                        </button>
                    </div>
                </div>

                
                <div class="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div class="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
                        <h3 class="text-white font-black text-lg">📊 Teacher Data Sync</h3>
                        <p class="text-blue-100 text-xs font-medium">Test connection & sync status</p>
                    </div>
                    <div class="p-6 space-y-4">
                        <div class="space-y-1">
                            <label class="text-xs font-bold text-slate-500 uppercase">Deployed Script URL</label>
                            <input 
                                class="w-full p-3 bg-slate-50 rounded-xl outline-none border border-slate-100 focus:border-blue-400"
                                value=${settings.googleScriptUrl || ''}
                                onInput=${(e) => setData({...data, settings: {...settings, googleScriptUrl: e.target.value}})}
                                placeholder="https://script.google.com/macros/s/..."
                            />
                            <p class="text-[10px] text-slate-400">Current: ${settings.googleScriptUrl ? '✅ Configured' : '❌ Not set'}</p>
                        </div>
                        <button 
                            onClick=${async () => {
                                if (!settings.googleScriptUrl) {
                                    alert('Please enter the Script URL first');
                                    return;
                                }
                                try {
                                    const url = new URL(settings.googleScriptUrl);
                                    url.searchParams.set('action', 'ping');
                                    const response = await fetch(url.toString());
                                    const result = await response.json();
                                    if (result.success) {
                                        alert('✅ Connection Successful!\n\n' + result.message + '\n\nThe script is working. Check browser console (F12) for sync details.');
                                    } else {
                                        alert('❌ Connection Failed: ' + result.error);
                                    }
                                } catch (e) {
                                    alert('❌ Error: ' + e.message);
                                }
                            }}
                            class="w-full py-3 bg-blue-600 text-white rounded-xl font-bold"
                        >
                            🔗 Test Google Connection
                        </button>
                        <button 
                            onClick=${handleFetchSettingsFromGoogle}
                            disabled=${fetchingSettings || !settings.googleScriptUrl}
                            class=${`w-full py-3 rounded-xl font-bold transition-all shadow-lg ${fetchingSettings ? 'bg-green-500 text-white' : settings.googleScriptUrl ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-400 text-white cursor-not-allowed'}`}
                        >
                            ${fetchingSettings ? '⏳ Fetching Settings...' : '📥 Fetch Settings from Google'}
                        </button>
                        <div class="bg-green-50 p-4 rounded-xl border border-green-200">
                            <p class="text-xs font-bold text-green-800 mb-2">� Fetch Settings:</p>
                            <p class="text-[10px] text-green-700">After connecting your Google Sheet URL, click <b>Fetch Settings from Google</b> to immediately download your school name, fee structures, and settings to this system.</p>
                        </div>
                        <div class="bg-green-50 p-4 rounded-xl border border-green-200">
                            <p class="text-xs font-bold text-green-800 mb-2">�👨‍🏫 How Teachers Use This:</p>
                            <p class="text-[10px] text-green-700">1. Teachers open the Google Sheet on their phone</p>
                            <p class="text-[10px] text-green-700">2. They add/edit scores in the Assessments tab</p>
                            <p class="text-[10px] text-green-700">3. Admin clicks "Sync" button here to get all data</p>
                            <p class="text-[10px] text-green-700 mt-2">✅ Each teacher can work on different grades without interference</p>
                        </div>
                        <div class="bg-blue-50 p-4 rounded-xl border border-blue-100">
                            <p class="text-xs font-bold text-blue-800 mb-2">📋 Sheet Columns (Auto-created)</p>
                            <p class="text-[10px] text-blue-600"><b>Students:</b> id, name, grade, stream, admissionNo, parentContact</p>
                            <p class="text-[10px] text-blue-600"><b>Assessments:</b> id, studentId, subject, score, term, examType, academicYear, date, level</p>
                            <p class="text-[10px] text-blue-600"><b>Attendance:</b> id, studentId, date, status, term, academicYear</p>
                        </div>
                        <button 
                            onClick=${handleUpdateProfile}
                            class=${`w-full py-3 rounded-xl font-bold transition-all shadow-lg ${updating ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'}`}
                        >
                            ${updating ? '✓ Saved' : 'Save Google Sync Settings'}
                        </button>
                        <button 
                            onClick=${handlePushSettingsToGoogle}
                            disabled=${updating}
                            class="w-full py-3 bg-orange-500 text-white rounded-xl font-bold transition-all shadow-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            ${updating ? '⏳ Pushing...' : '📤 Push Settings to Google'}
                        </button>
                        <div class="bg-orange-50 p-4 rounded-xl border border-orange-200">
                            <p class="text-xs font-bold text-orange-800 mb-2">💡 Settings Sync:</p>
                            <p class="text-[10px] text-orange-700">Push fee structures and other settings to Google Sheet to share with all admins.</p>
                            <p class="text-[10px] text-orange-700">All admins will see updated settings on their next sync.</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="p-6 bg-red-50 rounded-2xl border border-red-100">
                <h4 class="text-red-700 font-bold mb-2">Danger Zone</h4>
                <p class="text-red-600 text-sm mb-4">Resetting all data will clear students, payments, and assessment records permanently.</p>
                <button 
                    onClick=${() => { if(confirm('Are you sure?')) { localStorage.clear(); location.reload(); } }}
                    class="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold shadow-sm"
                >
                    Reset System Data
                </button>
            </div>
        </div>
    `;
};