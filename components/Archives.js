import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import { Dashboard } from './Dashboard.js';
import { Marklist } from './Marklist.js';
import { ResultAnalysis } from './ResultAnalysis.js';
import { Storage } from '../lib/storage.js';

const html = htm.bind(h);

export const Archives = ({ data = {} }) => {
    const [selectedArchive, setSelectedArchive] = useState(null);
    const [activeSubView, setActiveSubView] = useState('summary');
    const [searchTerm, setSearchTerm] = useState('');

    const archives = Array.isArray(data?.archives) ? data.archives : [];

    if (selectedArchive) {
        return html`
            <div class="space-y-6 animate-in fade-in">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                    <div class="flex items-center gap-4">
                        <button onClick=${() => setSelectedArchive(null)} class="p-2 bg-slate-100 rounded-full hover:bg-slate-200">
                            <span class="text-xl">←</span>
                        </button>
                        <div>
                            <h2 class="text-2xl font-black">Archive: ${selectedArchive.academicYear}</h2>
                            <p class="text-slate-500 text-xs font-bold uppercase">Viewing read-only snapshot</p>
                        </div>
                    </div>
                    <div class="flex gap-2 bg-white p-1 rounded-xl border border-slate-100">
                        <button 
                            onClick=${() => setActiveSubView('summary')}
                            class=${`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeSubView === 'summary' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                        >Summary</button>
                        <button 
                            onClick=${() => setActiveSubView('analysis')}
                            class=${`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeSubView === 'analysis' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                        >Result Analysis</button>
                        <button 
                            onClick=${() => setActiveSubView('marklist')}
                            class=${`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeSubView === 'marklist' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                        >Marklists</button>
                        <button
                            onClick=${() => {
                                if (confirm(`Restore archived year ${selectedArchive.academicYear} into active data? This will replace current active assessments/payments/remarks/payroll/transport/library with the archived snapshot.`)) {
                                    const restored = Storage.restoreArchive(data, selectedArchive.academicYear);
                                    // We can't call setData here since Archives doesn't have setData prop; emit a window event for the app to pick up
                                    window.dispatchEvent(new CustomEvent('edutrack:restore', { detail: { restored } }));
                                    alert('Archive restored. Returning to Archives view.');
                                    setSelectedArchive(null);
                                }
                            }}
                            class="ml-2 px-4 py-2 rounded-lg text-xs font-bold transition-all bg-green-50 text-green-700 hover:bg-green-100"
                        >
                            Restore Archive
                        </button>
                    </div>
                </div>

                <div class="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center gap-3 no-print">
                    <span class="text-xl">📜</span>
                    <p class="text-[10px] text-blue-700 font-bold uppercase">You are currently browsing historical records. Data modification is disabled in this view.</p>
                </div>

                ${activeSubView === 'summary' && selectedArchive && html`<${Dashboard} data=${selectedArchive} />`}
                ${activeSubView === 'analysis' && selectedArchive && html`<${ResultAnalysis} data=${selectedArchive} onSelectStudent=${() => alert('Please use current year view for interactive reports.')} />`}
                ${activeSubView === 'marklist' && selectedArchive && html`<${Marklist} data=${selectedArchive} setData=${() => {}} />`}
            </div>
        `;
    }

    return html`
        <div class="space-y-6 animate-in fade-in">
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 class="text-2xl font-bold">Academic Archives</h2>
                    <p class="text-slate-500">Access historical results, marklists and financials from previous years</p>
                </div>
                <div class="relative no-print">
                    <input
                        type="text"
                        placeholder="Search archives..."
                        class="p-2 pl-8 bg-white border border-slate-200 rounded-xl outline-none w-48 text-sm font-bold"
                        value=${searchTerm}
                        onInput=${(e) => setSearchTerm(e.target.value)}
                    />
                    <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                ${archives
                    .filter(a => {
                        if (!searchTerm) return true;
                        const searchLower = searchTerm.toLowerCase();
                        return a && a.academicYear && a.academicYear.toLowerCase().includes(searchLower);
                    })
                    .map(archive => {
                        if (!archive) return '';
                        return html`
                    <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                        <div class="flex justify-between items-start mb-4">
                            <div class="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl group-hover:bg-primary group-hover:text-white transition-colors">
                                📂
                            </div>
                            <span class="text-[9px] font-black bg-slate-100 px-2 py-1 rounded-full text-slate-400 uppercase">Snapshot</span>
                        </div>
                        <h3 class="text-xl font-black mb-1">${archive.academicYear || 'Unknown Year'}</h3>
                        <p class="text-[10px] text-slate-400 font-bold uppercase mb-6">Archived on: ${archive.archivedAt ? new Date(archive.archivedAt).toLocaleDateString() : 'Unknown'}</p>

                        <div class="grid grid-cols-2 gap-2 mb-6">
                            <div class="bg-slate-50 p-2 rounded-xl text-center">
                                <p class="text-[8px] font-black text-slate-400 uppercase">Students</p>
                                <p class="text-sm font-black text-slate-700">${Array.isArray(archive.students) ? archive.students.length : 0}</p>
                            </div>
                            <div class="bg-slate-50 p-2 rounded-xl text-center">
                                <p class="text-[8px] font-black text-slate-400 uppercase">Records</p>
                                <p class="text-sm font-black text-slate-700">${Array.isArray(archive.assessments) ? archive.assessments.length : 0}</p>
                            </div>
                        </div>

                        <button
                            onClick=${() => setSelectedArchive(archive)}
                            class="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-primary transition-colors shadow-lg shadow-slate-200"
                        >
                            View Records
                        </button>
                    </div>
                `;
                    })}

                ${archives.length === 0 && html`
                    <div class="col-span-full py-20 bg-white rounded-3xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                        <span class="text-5xl mb-4 opacity-20">🗄️</span>
                        <h3 class="text-lg font-bold text-slate-400">No Archives Found</h3>
                        <p class="text-xs text-slate-300 max-w-xs mt-2">End the current academic year in Settings to create your first archive snapshot.</p>
                    </div>
                `}
            </div>
        </div>
    `;
};