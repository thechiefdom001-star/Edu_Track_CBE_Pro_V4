import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';

const html = htm.bind(h);

export const ParentAuth = ({ onLogin, onClose }) => {
    const [admissionNo, setAdmissionNo] = useState('');
    const [studentName, setStudentName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!admissionNo.trim() || !studentName.trim()) return;

        setLoading(true);
        setError('');

        try {
            // We'll use the sync service which we'll update to handle parent login
            // For now, let's assume window.googleSync is available and has loginParent
            if (!window.googleSync) {
                 setError('System is still initializing. Please wait...');
                 setLoading(false);
                 return;
            }

            const result = await window.googleSync.loginParent(admissionNo.trim(), studentName.trim());
            
            if (result.success) {
                onLogin(result);
            } else {
                setError(result.error || 'Invalid student details');
            }
        } catch (err) {
            setError('Login failed. Please check your connection.');
        } finally {
            setLoading(false);
        }
    };

    return html`
        <div class="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-white/10 animate-scale-up">
                <div class="p-8">
                    <div class="flex justify-between items-center mb-8">
                        <div>
                            <h2 class="text-3xl font-black text-slate-900 dark:text-white leading-none mb-2">Parent Portal</h2>
                            <p class="text-slate-500 text-sm font-medium">Verify your student's details to access</p>
                        </div>
                        <button onClick=${onClose} class="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">✕</button>
                    </div>

                    <form onSubmit=${handleSubmit} class="space-y-5">
                        ${error && html`
                            <div class="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-sm flex items-center gap-3 animate-shake">
                                <span class="bg-red-500 text-white w-6 h-6 rounded flex items-center justify-center text-[10px]">🔒</span> ${error}
                            </div>
                        `}

                        <div>
                            <label class="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Student Full Name</label>
                            <div class="relative">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-xl">👤</span>
                                <input 
                                    type="text" 
                                    value=${studentName}
                                    onInput=${e => setStudentName(e.target.value)}
                                    placeholder="Enter Student Name"
                                    class="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label class="block text-xs font-black uppercase tracking-widest text-slate-500 mb-2 ml-1">Student Admission No.</label>
                            <div class="relative">
                                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-xl">🆔</span>
                                <input 
                                    type="text" 
                                    value=${admissionNo}
                                    onInput=${e => setAdmissionNo(e.target.value)}
                                    placeholder="e.g. ADM-10"
                                    class="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 pr-4 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                                    required
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled=${loading}
                            class="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-400 text-white rounded-2xl py-4 font-black uppercase tracking-widest transition-all transform active:scale-[0.98] shadow-lg shadow-orange-600/20"
                        >
                            ${loading ? html`<span class="flex items-center justify-center gap-2">Connecting...</span>` : 'Access Dashboard'}
                        </button>
                    </form>

                    <div class="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                        <p class="text-center text-xs text-slate-500">
                            By logging in, you agree to access only your child's information.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    `;
};
