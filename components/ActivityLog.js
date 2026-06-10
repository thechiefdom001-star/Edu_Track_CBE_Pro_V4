import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import htm from 'htm';
import { googleSheetSync } from '../lib/googleSheetSync.js';

const html = htm.bind(h);

const ACTION_ICONS = {
    'ADD': '➕',
    'EDIT': '✏️',
    'DELETE': '🗑️',
    'SYNC': '🔄',
    'LOGIN': '🔑',
    'LOGOUT': '🚪',
    'VOID': '❌',
    'VIEW': '👁️',
    'UPDATE': '📝'
};

const ACTION_COLORS = {
    'ADD': 'bg-green-100 text-green-700 border-green-200',
    'EDIT': 'bg-blue-100 text-blue-700 border-blue-200',
    'DELETE': 'bg-red-100 text-red-700 border-red-200',
    'SYNC': 'bg-purple-100 text-purple-700 border-purple-200',
    'LOGIN': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'LOGOUT': 'bg-slate-100 text-slate-700 border-slate-200',
    'VOID': 'bg-orange-100 text-orange-700 border-orange-200',
    'VIEW': 'bg-gray-100 text-gray-700 border-gray-200',
    'UPDATE': 'bg-cyan-100 text-cyan-700 border-cyan-200'
};

const MODULE_LABELS = {
    'Students': '👥 Students',
    'Assessments': '📝 Assessments',
    'Attendance': '✅ Attendance',
    'Fees': '💰 Fees',
    'Payments': '💳 Payments',
    'Teachers': '👨‍🏫 Teachers',
    'Staff': '🛠️ Staff',
    'Auth': '🔐 Authentication',
    'Calendar': '📅 Calendar'
};

export const ActivityLog = ({ settings, isAdmin, teacherSession, limit = 20 }) => {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [stats, setStats] = useState(null);
    const hasLoaded = useRef(false);

    useEffect(() => {
        // Only load once when settings become available
        if (settings?.googleScriptUrl && !hasLoaded.current) {
            hasLoaded.current = true;
            loadActivities();
            loadStats();
        } else if (!settings?.googleScriptUrl) {
            setLoading(false);
        }
    }, [settings?.googleScriptUrl]);

    // Manual refresh only - no auto-refresh to prevent loops
    const loadActivities = async () => {
        // Prevent rapid repeated calls
        const now = Date.now();
        if (loadActivities.lastCall && now - loadActivities.lastCall < 3000) {
            console.log('[ActivityLog] Skipping refresh, too soon');
            return;
        }
        loadActivities.lastCall = now;
        
        setLoading(true);
        try {
            googleSheetSync.setSettings(settings);
            console.log('[ActivityLog] Loading activities, URL:', settings?.googleScriptUrl);
            const data = await googleSheetSync.getRecentActivities(limit);
            console.log('[ActivityLog] Received activities:', data?.length || 0, data);
            setActivities(data || []);
        } catch (error) {
            console.error('[ActivityLog] Failed to load activities:', error);
            setActivities([]);
        }
        setLoading(false);
    };

    const loadStats = async () => {
        // Prevent rapid repeated calls
        const now = Date.now();
        if (loadStats.lastCall && now - loadStats.lastCall < 3000) {
            return;
        }
        loadStats.lastCall = now;
        
        try {
            googleSheetSync.setSettings(settings);
            console.log('[ActivityLog] Loading stats...');
            const summary = await googleSheetSync.getActivitySummary(7);
            console.log('[ActivityLog] Received stats:', summary);
            setStats(summary);
        } catch (error) {
            console.error('[ActivityLog] Failed to load stats:', error);
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const getActionIcon = (action) => ACTION_ICONS[action] || '📌';
    const getActionColor = (action) => ACTION_COLORS[action] || 'bg-gray-100 text-gray-700 border-gray-200';
    const getModuleLabel = (module) => MODULE_LABELS[module] || module;

    const filteredActivities = filter === 'all' 
        ? activities 
        : activities.filter(a => a.module === filter);

    const formatDetails = (activity) => {
        let text = '';
        if (activity.recordName) {
            text = `${activity.recordName}`;
        }
        if (activity.details) {
            text += text ? ` - ${activity.details}` : activity.details;
        }
        return text || 'No details';
    };

    const handleClearLog = async () => {
        if (!confirm('Are you sure you want to CLEAR all activity logs? This cannot be undone.')) return;
        
        try {
            googleSheetSync.setSettings(settings);
            const result = await googleSheetSync.clearActivityLog();
            if (result.success) {
                setActivities([]);
                setStats({ total: 0, byAction: {}, byModule: {}, byUser: {} });
                alert('Activity log cleared successfully!');
            } else {
                alert('Failed to clear log: ' + (result.error || 'Unknown error'));
            }
        } catch (err) {
            console.error('Failed to clear activity log:', err);
            alert('Failed to clear activity log');
        }
    };

    if (!settings?.googleScriptUrl) {
        return html`
            <div class="bg-white rounded-xl border border-slate-100 p-6">
                <div class="text-center text-slate-400 py-8">
                    <span class="text-4xl mb-3 block">📋</span>
                    <p class="font-medium">Activity Log</p>
                    <p class="text-sm mt-1">Connect Google Sheet to track activities</p>
                </div>
            </div>
        `;
    }

    return html`
        <div class="bg-white rounded-xl border border-slate-100 overflow-hidden">
            
            <div class="bg-gradient-to-r from-slate-800 to-slate-700 text-white p-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <span class="text-2xl">📋</span>
                        <div>
                            <h3 class="font-bold text-lg">All Recent Activity</h3>
                            <p class="text-slate-300 text-xs">Track all system changes</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <button 
                            onClick=${loadActivities}
                            class="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors"
                        >
                            🔄 Refresh
                        </button>
                        ${isAdmin && html`
                            <button 
                                onClick=${handleClearLog}
                                class="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-xs font-medium transition-colors"
                            >
                                🗑️ Clear Log
                            </button>
                        `}
                    </div>
                </div>
            </div>

            
            ${stats && html`
                <div class="grid grid-cols-4 gap-2 p-3 bg-slate-50 border-b">
                    <div class="text-center">
                        <p class="text-lg font-black text-slate-800">${stats.total || 0}</p>
                        <p class="text-[10px] text-slate-500 uppercase">Total</p>
                    </div>
                    <div class="text-center">
                        <p class="text-lg font-black text-green-600">${stats.byAction?.ADD || 0}</p>
                        <p class="text-[10px] text-slate-500 uppercase">Added</p>
                    </div>
                    <div class="text-center">
                        <p class="text-lg font-black text-blue-600">${stats.byAction?.EDIT || 0}</p>
                        <p class="text-[10px] text-slate-500 uppercase">Edited</p>
                    </div>
                    <div class="text-center">
                        <p class="text-lg font-black text-purple-600">${stats.byUser ? Object.keys(stats.byUser).length : 0}</p>
                        <p class="text-[10px] text-slate-500 uppercase">Users</p>
                    </div>
                </div>
            `}

            
            <div class="flex gap-1 p-2 border-b overflow-x-auto">
                <button
                    onClick=${() => setFilter('all')}
                    class=${`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                        filter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                    All
                </button>
                ${Object.entries(MODULE_LABELS).map(([key, label]) => html`
                    <button
                        onClick=${() => setFilter(key)}
                        class=${`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                            filter === key ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                    >
                        ${label}
                    </button>
                `)}
            </div>

            
            <div class="max-h-[400px] overflow-y-auto">
                ${loading ? html`
                    <div class="flex items-center justify-center py-12">
                        <div class="animate-spin w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full"></div>
                    </div>
                ` : filteredActivities.length === 0 ? html`
                    <div class="text-center py-12 text-slate-400">
                        <span class="text-4xl mb-3 block">📭</span>
                        <p class="font-medium">No activities yet</p>
                        <p class="text-sm mt-1">Activities will appear here as users interact with the system</p>
                    </div>
                ` : filteredActivities.map((activity, index) => html`
                    <div class=${`flex items-start gap-3 p-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                        index === 0 ? 'bg-blue-50/50' : ''
                    }`}>
                        
                        <div class=${`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm ${getActionColor(activity.action)}`}>
                            ${getActionIcon(activity.action)}
                        </div>

                        
                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class=${`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getActionColor(activity.action)}`}>
                                    ${activity.action}
                                </span>
                                <span class="text-xs font-medium text-slate-700">${getModuleLabel(activity.module)}</span>
                            </div>
                            <p class="text-sm text-slate-600 mt-1 truncate">
                                ${formatDetails(activity)}
                            </p>
                            <div class="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                                <span class="flex items-center gap-1">
                                    <span class="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold">
                                        ${activity.userName?.[0]?.toUpperCase() || '?'}
                                    </span>
                                    ${activity.userName}
                                </span>
                                <span>•</span>
                                <span>${formatTime(activity.timestamp)}</span>
                                ${activity.recordId && html`
                                    <span>•</span>
                                    <span class="font-mono">ID: ${String(activity.recordId).substring(0, 8)}</span>
                                `}
                            </div>
                        </div>
                    </div>
                `)}
            </div>

            
            ${activities.length > 0 && html`
                <div class="p-2 bg-slate-50 text-center">
                    <p class="text-[10px] text-slate-400">
                        Showing ${filteredActivities.length} of ${activities.length} activities
                    </p>
                </div>
            `}
        </div>
    `;
};

export default ActivityLog;
