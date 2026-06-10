import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';

const html = htm.bind(h);

export const Sidebar = ({ currentView, setView, isCollapsed, setCollapsed, isMobileOpen, setIsMobileOpen, isAdmin, teacherSession, parentSession, onOpenAuth, onOpenParentAuth }) => {
    const [expandedGroups, setExpandedGroups] = useState(['academics']);
    const [lockedItems, setLockedItems] = useState(new Set());

    const toggleGroup = (groupId) => {
        setExpandedGroups(prev => 
            prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]
        );
    };

  const adminOnlyItems = new Set(['settings', 'fees', 'fees-register', 'fee-reminder', 'payroll', 'teachers', 'staff', 'senior-school', 'library', 'archives', 'school-analysis', 'strategic-reports', 'strategic-presentation']);
    if (!isAdmin && teacherSession?.role !== 'class_teacher' && teacherSession?.role !== 'head_teacher' && teacherSession?.role !== 'admin') {
        adminOnlyItems.add('students');
    }
    const teacherAccessItems = new Set(['assessments', 'attendance', 'marklist', 'timetable', 'result-analysis', 'transport']);
    const parentAccessItems = new Set(['parents-dashboard', 'school-calendar']);

    const isAuthenticated = isAdmin || teacherSession || parentSession;

    const handleLinkClick = (id) => {
        // If parent is logged in, they can only access parent items
        if (parentSession && !isAdmin && !teacherSession) {
            if (parentAccessItems.has(id)) {
                setView(id);
            } else {
                alert('Parents can only access the Parent Dashboard and School Calendar.');
            }
            return;
        }

          if (!isAuthenticated) {
                  setLockedItems(prev => new Set([...prev, id]));
            setTimeout(() => {
                setLockedItems(prev => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            }, 500);
            
                  if (parentAccessItems.has(id)) {
                if (onOpenParentAuth) onOpenParentAuth();
            } else {
                if (onOpenAuth) onOpenAuth();
            }
            return;
        }

          if (adminOnlyItems.has(id) && !isAdmin) {
            alert('This feature requires Administrator access. Please login as Admin.');
            return;
        }

        setView(id);
    };

    const renderMenuItem = (item) => {
        const isLocked = !isAuthenticated || (adminOnlyItems.has(item.id) && !isAdmin);
        const wasJustLocked = lockedItems.has(item.id);
        
        return html`
            <button
                type="button"
                key=${item.id}
                onClick=${() => handleLinkClick(item.id)}
                class=${`w-full flex items-center px-4 py-2.5 rounded-xl transition-all duration-200 group relative ${
                    currentView === item.id ? 'bg-primary text-white shadow-md' : 
                    wasJustLocked ? 'bg-red-500/20 text-red-400' :
                    isLocked ? 'text-slate-600 cursor-not-allowed opacity-60' :
                    'text-slate-400 hover:bg-slate-800 hover:text-white'
                } ${isLocked && !isCollapsed ? 'pl-3' : ''}`}
                disabled=${isLocked}
            >
                ${isLocked && !isCollapsed && html`<span class="text-xs mr-2">🔒</span>`}
                ${isLocked && isCollapsed && html`<span class="absolute top-1 right-1 text-[8px]">🔒</span>`}
                <span class=${`text-lg ${isLocked && !isCollapsed ? 'grayscale opacity-50' : ''}`}>${item.icon}</span>
                ${!isLocked && !isCollapsed && html`<span class="truncate text-sm font-medium ml-3">${item.label}</span>`}
                ${isLocked && !isCollapsed && html`<span class="truncate text-sm font-medium ml-3">${item.label}</span>`}
                ${!isLocked && isCollapsed && html`
                    <div class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                        ${item.label}
                        ${adminOnlyItems.has(item.id) ? '🔒' : ''}
                    </div>
                `}
            </button>
        `;
    };

    const navigation = [
        { id: 'dashboard', label: 'Dashboard', icon: '📊' },
        { 
            id: 'academics', 
            label: 'Academic Wing', 
            icon: '🎓',
            items: [
                { id: 'students', label: 'Students', icon: '👥' },
                { id: 'senior-school', label: 'Senior School', icon: '🏅' },
                { id: 'assessments', label: 'Assessments', icon: '📝' },
                { id: 'attendance', label: 'Attendance', icon: '✅' },
                { id: 'marklist', label: 'Marklist', icon: '🏆' },
                { id: 'timetable', label: 'Timetable', icon: '📅' },
                { id: 'result-analysis', label: 'Result Analysis', icon: '📈' },
            ]
        },
        { 
            id: 'finance', 
            label: 'Finance Office', 
            icon: '💰',
            items: [
                { id: 'fees', label: 'Collect Fees', icon: '💳', adminOnly: true },
                { id: 'fees-register', label: 'Fee Register', icon: '📋', adminOnly: true },
                { id: 'fee-reminder', label: 'Fee Reminders', icon: '🔔', adminOnly: true },
                { id: 'payroll', label: 'Payroll', icon: '🏦', adminOnly: true },
            ]
        },
        { 
            id: 'administration', 
            label: 'Administration', 
            icon: '🏛️',
            items: [
                { id: 'teachers', label: 'Teachers', icon: '👨‍🏫', adminOnly: true },
                { id: 'staff', label: 'Support Staff', icon: '🛠️', adminOnly: true },
                { id: 'transport', label: 'Transport', icon: '🚌' },
                { id: 'library', label: 'Library', icon: '📚' },
                { id: 'school-analysis', label: 'School Analysis', icon: '📊', adminOnly: true },
                { id: 'strategic-reports', label: 'Strategic Reports', icon: '📜', adminOnly: true },
                { id: 'strategic-presentation', label: 'Slides Presentation', icon: '📽️', adminOnly: true },
                { id: 'archives', label: 'Archives', icon: '🗄️' },
            ]
        },
        { 
            id: 'parents', 
            label: 'Parents Portal', 
            icon: '👪',
            items: [
                { id: 'parents-dashboard', label: 'Parent Dashboard', icon: '🏠' },
                { id: 'school-calendar', label: 'School Calendar', icon: '📆' },
            ]
        },
        { id: 'settings', label: 'Settings', icon: '⚙️', adminOnly: true },
    ];

    const isMini = isCollapsed;

    return html`
        <aside class=${`flex flex-col bg-slate-950 text-white h-full overflow-hidden shrink-0 transition-all duration-300 no-print z-[50] shadow-2xl ${
            isMini ? 'w-16 md:w-20' : 'w-0 md:w-64'
        } ${isMobileOpen ? 'w-64' : ''}`}>
            
            <div class=${`p-4 border-b border-slate-900 flex items-center ${isMini ? 'justify-center' : 'justify-between'}`}>
                ${(!isMini || isMobileOpen) && html`
                    <span class="font-black text-sm uppercase tracking-tighter text-slate-500">Navigation</span>
                    ${!isAuthenticated && html`<span class="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">Locked</span>`}
                `}
                <button 
                    type="button"
                    onClick=${() => setCollapsed(!isCollapsed)}
                    class=${`p-2 hover:bg-slate-800 rounded-lg text-slate-500 transition-colors ${isMobileOpen ? 'hidden md:block' : ''}`}
                >
                    ${isMini ? '➡️' : '⬅️'}
                </button>
                ${isMobileOpen && html`
                    <button onClick=${() => setIsMobileOpen(false)} class="md:hidden p-2 text-slate-500">✕</button>
                `}
            </div>

            <nav class="flex-1 space-y-2 p-3 overflow-y-auto no-scrollbar">
                ${navigation.map(node => {
                    if (node.items) {
                        const isExpanded = expandedGroups.includes(node.id) && !isMini;
                        const allLocked = !isAuthenticated;
                        
                        return html`
                            <div class="space-y-1">
                                <button 
                                    type="button"
                                    onClick=${() => toggleGroup(node.id)}
                                    class=${`w-full flex items-center p-2 rounded-lg transition-colors ${isMini ? 'justify-center' : 'justify-between'} ${allLocked ? 'text-slate-600' : 'text-slate-500 hover:text-white'}`}
                                >
                                    <div class="flex items-center">
                                        <span class=${`text-lg ${allLocked ? 'grayscale opacity-50' : ''}`}>${node.icon}</span>
                                        ${!isMini && html`
                                            <span class="text-sm font-black uppercase tracking-widest ml-3">${node.label}</span>
                                            ${allLocked && html`<span class="ml-2 text-[8px]">🔒</span>`}
                                        `}
                                    </div>
                                    ${!isMini && html`<span class="text-[8px] transition-transform ${isExpanded ? 'rotate-180' : ''}">▼</span>`}
                                </button>
                                ${isExpanded && html`
                                    <div class="pl-2 space-y-1 animate-in slide-in-from-left-2 duration-200">
                                        ${node.items.map(item => {
                                            const isLocked = !isAuthenticated || (item.adminOnly && !isAdmin);
                                            return html`
                                                <button
                                                    type="button"
                                                    key=${item.id}
                                                    onClick=${() => handleLinkClick(item.id)}
                                                    class=${`w-full flex items-center px-3 py-2 rounded-lg transition-all duration-200 group relative ${
                                                        currentView === item.id ? 'bg-primary/20 text-primary' :
                                                        isLocked ? 'text-slate-600 cursor-not-allowed opacity-50' :
                                                        'text-slate-400 hover:bg-slate-800 hover:text-white'
                                                    }`}
                                                >
                                                    ${isLocked && html`<span class="text-xs mr-2">🔒</span>`}
                                                    <span class="text-lg">${item.icon}</span>
                                                    <span class="truncate text-base font-medium ml-2">${item.label}</span>
                                                    ${item.adminOnly && html`<span class="ml-auto text-xs bg-red-500/30 text-red-400 px-1 rounded">Admin</span>`}
                                                </button>
                                            `;
                                        })}
                                    </div>
                                `}
                                ${isMini && html`
                                    <div class="flex flex-col gap-1 items-center">
                                        ${node.items.slice(0, 3).map(item => html`
                                            <button 
                                                type="button"
                                                onClick=${() => handleLinkClick(item.id)}
                                                class=${`p-2 rounded-lg transition-all ${currentView === item.id ? 'bg-primary/20 text-primary' : 'text-slate-600'}`}
                                                title=${item.label}
                                            >
                                                <span class="text-xs">${item.icon}</span>
                                            </button>
                                        `)}
                                    </div>
                                `}
                            </div>
                        `;
                    }
                    return html`
                        <button
                            type="button"
                            onClick=${() => handleLinkClick(node.id)}
                            class=${`w-full flex items-center px-4 py-2.5 rounded-xl transition-all duration-200 group relative ${
                                currentView === node.id ? 'bg-primary text-white shadow-md' :
                                (node.adminOnly && !isAdmin && !isAuthenticated) ? 'text-slate-600 opacity-60 cursor-not-allowed' :
                                'text-slate-400 hover:bg-slate-800 hover:text-white'
                            } ${isMini ? 'justify-center' : ''}`}
                        >
                            ${(node.adminOnly && !isAdmin && !isAuthenticated) && html`<span class="absolute top-1 right-1 text-[8px]">🔒</span>`}
                            <span class="text-lg">${node.icon}</span>
                            ${!isMini && html`<span class="truncate text-sm font-medium ml-3">${node.label}</span>`}
                            ${!isMini && node.adminOnly && html`<span class="ml-auto text-[8px] bg-red-500/30 text-red-400 px-1 rounded">Admin</span>`}
                            ${isMini && html`
                                <div class="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                                    ${node.label}
                                </div>
                            `}
                        </button>
                    `;
                })}
            </nav>

            <div class="p-4 border-t border-slate-900 mt-auto">
                <div class=${`flex items-center ${isMini ? 'justify-center' : 'gap-3'}`}>
                    <div class="w-8 h-8 rounded-full ${isAuthenticated ? (isAdmin ? 'bg-indigo-600' : (teacherSession ? 'bg-green-600' : 'bg-orange-600')) : 'bg-slate-800'} flex items-center justify-center font-bold text-xs">
                        ${isAuthenticated ? (isAdmin ? 'AD' : (teacherSession ? (teacherSession?.name?.[0] || 'T') : (parentSession?.studentName?.[0] || 'P'))) : '?'}
                    </div>
                    ${(!isMini || isMobileOpen) && html`
                        <div class="overflow-hidden">
                            ${isAuthenticated ? html`
                                <p class="text-[10px] font-bold truncate">${isAdmin ? 'Administrator' : (teacherSession ? (teacherSession.name || teacherSession.username) : parentSession.parentName)}</p>
                                <p class="text-[8px] ${teacherSession ? 'text-green-400' : 'text-orange-400'}">✓ ${teacherSession ? 'Teacher' : 'Parent'} Logged In</p>
                            ` : html`
                                <p class="text-[10px] font-bold truncate text-slate-500">Guest</p>
                                <p class="text-[8px] text-slate-600">Not logged in</p>
                            `}
                        </div>
                    `}
                </div>
            </div>
        </aside>
    `;
};
