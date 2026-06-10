import { h } from 'preact';
import htm from 'htm';
import { PrintService } from '../lib/printService.js';

const html = htm.bind(h);

export const PrintButtons = () => {
    return html`
        <div class="flex items-center gap-2 no-print bg-slate-100/50 p-1 rounded-xl border border-slate-200">
            <button 
                onClick=${() => PrintService.print('portrait')}
                class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-slate-900 transition-colors"
                title="Print Portrait"
            >
                <span>Print</span> Port.
            </button>
            <button 
                onClick=${() => PrintService.print('landscape')}
                class="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-sm hover:bg-indigo-700 transition-colors"
                title="Print Landscape"
            >
                <span>Print</span> Land.
            </button>
        </div>
    `;
};
