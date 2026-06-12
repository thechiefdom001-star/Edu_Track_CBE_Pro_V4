import { h } from 'preact';
import { useState, useEffect, useRef } from 'preact/hooks';
import htm from 'htm';
import { Storage } from '../lib/storage.js';
import { googleSheetSync } from '../lib/googleSheetSync.js';
import { ActivityLog } from './ActivityLog.js';

const html = htm.bind(h);

const parsePresenceDevice = (device) => {
    const rawDevice = String(device || '').trim();
    if (!rawDevice.includes('@') || !rawDevice.includes('#')) return null;

    const [rolePart, rest] = rawDevice.split('@');
    const hashIndex = rest.lastIndexOf('#');
    if (hashIndex === -1) return null;

    const username = rest.slice(0, hashIndex).trim();
    const sessionId = rest.slice(hashIndex + 1).trim();
    const role = rolePart.trim().toLowerCase();

    if (!role || !username || !sessionId) return null;

    return {
        role,
        username,
        sessionId,
        canonicalDevice: `${role}@${username}#${sessionId}`
    };
};

const getCurrentPresenceDevice = (isAdmin, teacherSession) => {
    const sessionId = (localStorage.getItem('et_session_id') || '').trim();
    if (!sessionId) return null;

    if (teacherSession && !isAdmin) {
        const teacherUsername = (teacherSession.username || teacherSession.name || '').trim().toLowerCase();
        return teacherUsername ? `teacher@${teacherUsername}#${sessionId}` : null;
    }

    if (isAdmin) {
        const adminUsername = (localStorage.getItem('et_login_username') || '').trim().toLowerCase();
        return adminUsername ? `admin@${adminUsername}#${sessionId}` : null;
    }

    return null;
};

const dedupeActiveUsers = (users = []) => {
    const bySession = new Map();

    users.forEach(user => {
        const parsed = parsePresenceDevice(user.device);
        if (!parsed) return;

        const key = `${parsed.role}#${parsed.sessionId}`;
        const candidateTime = Number(user.lastActivity || user.timestamp || 0);
        const existing = bySession.get(key);
        const existingParsed = existing ? parsePresenceDevice(existing.device) : null;
        const existingTime = Number(existing?.lastActivity || existing?.timestamp || 0);

        const shouldReplace = (
            !existing ||
            candidateTime > existingTime ||
            (candidateTime === existingTime && parsed.username.length > (existingParsed?.username?.length || 0))
        );

        if (shouldReplace) {
            bySession.set(key, {
                ...user,
                device: parsed.canonicalDevice
            });
        }
    });

    return Array.from(bySession.values()).sort(
        (a, b) => Number(b.lastActivity || b.timestamp || 0) - Number(a.lastActivity || a.timestamp || 0)
    );
};

export const Dashboard = ({ data, setData, googleSyncStatus, isAdmin, teacherSession }) => {
    const [activeUsers, setActiveUsers] = useState([]);
    const [lastActivity, setLastActivity] = useState(null);
    const [recentActivities, setRecentActivities] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const refreshRef = useRef(false); // Prevent concurrent refreshes
    
    const students = data?.students || [];
    const payments = data?.payments || [];
    const assessments = data?.assessments || [];
    const settings = data?.settings || { currency: 'KES.', grades: [], feeStructures: [] };

    const applyGoogleRefresh = (result) => {
        if (!result?.success || typeof setData !== 'function') return;

        setData(prev => Storage.replaceWithGoogleData(prev, {
            students: result.students ?? null,
            assessments: result.assessments ?? null,
            attendance: result.attendance ?? null,
            payments: result.payments ?? null,
            teachers: result.teachers ?? null,
            staff: result.staff ?? null,
            calendar: result.calendar ?? null
        }));
    };
    
    // Fetch fresh data from Google Sheet periodically
    const refreshFromGoogle = async () => {
        if (!settings.googleScriptUrl || refreshRef.current) return;
        
        refreshRef.current = true;
        setIsRefreshing(true);
        
        try {
            googleSheetSync.setSettings(settings);
            const result = await googleSheetSync.fetchAll();
            
            if (result.success) {
                applyGoogleRefresh(result);
                console.log('📊 Dashboard refreshed from Google:', result.students?.length, 'students');
            }
        } catch (error) {
            console.warn('Dashboard refresh error:', error);
        } finally {
            setIsRefreshing(false);
            setTimeout(() => { refreshRef.current = false; }, 1000);
        }
    };

    // Manual refresh for active users - ALWAYS fetch fresh from Google
    const refreshActiveUsers = async () => {
        if (!settings.googleScriptUrl) return;
        
        try {
            googleSheetSync.setSettings(settings);
            
            const currentDeviceId = getCurrentPresenceDevice(isAdmin, teacherSession);
            if (!currentDeviceId) return;
            
            console.log('👥 REFRESH: Registering:', currentDeviceId);
            
            // Register ourselves first
            await googleSheetSync.setActiveUser(currentDeviceId);
            
            // Wait a moment then fetch ALL users from Google
            await new Promise(r => setTimeout(r, 800));
            
            const result = await googleSheetSync.getActiveUsersDirect();
            console.log('👥 REFRESH: Got result:', JSON.stringify(result));
            
            if (result.success && result.activeUsers) {
                console.log('👥 REFRESH: Setting users:', result.activeUsers.map(u => u.device));
                setActiveUsers(dedupeActiveUsers(result.activeUsers));
            } else {
                console.log('👥 REFRESH: No users or error:', result);
            }
        } catch (error) {
            console.error('👥 REFRESH: Error:', error);
        }
    };
    
    // Check for active users - runs on mount and periodically
    useEffect(() => {
        if (!settings.googleScriptUrl) return;
        
        const checkActiveUsers = async () => {
            try {
                googleSheetSync.setSettings(settings);
                
                const currentDeviceId = getCurrentPresenceDevice(isAdmin, teacherSession);
                
                if (currentDeviceId) {
                    await googleSheetSync.setActiveUser(currentDeviceId);
                }
                
                // Get all active users DIRECTLY from Google (bypass any caching)
                const result = await googleSheetSync.getActiveUsersDirect();
                console.log('👥 Raw active users:', result);
                
                if (result.success) {
                    const users = dedupeActiveUsers(result.activeUsers || []);
                    console.log('👥 Setting users:', users.length, users.map(u => u.device));
                    setActiveUsers(users);
                    
                    if (users.length > 0) {
                        const mostRecent = users.reduce((prev, curr) => 
                            (parseInt(curr.timestamp || 0) > parseInt(prev.timestamp || 0)) ? curr : prev
                        );
                        setLastActivity(new Date(parseInt(mostRecent.timestamp || 0)));
                    }
                }
            } catch (error) {
                console.warn('Error checking active users:', error);
            }
        };
        
        // Run immediately and then every 5 seconds (very frequent)
        checkActiveUsers();
        const interval = setInterval(checkActiveUsers, 5000);
        
        return () => clearInterval(interval);
    }, [settings.googleScriptUrl, isAdmin, teacherSession]);
    
    // Auto-refresh data from Google every 30 seconds
    useEffect(() => {
        if (!settings.googleScriptUrl) return;
        
        const doRefresh = async () => {
            if (refreshRef.current) return;
            refreshRef.current = true;
            setIsRefreshing(true);
            
            try {
                googleSheetSync.setSettings(settings);
                const result = await googleSheetSync.fetchAll();
                
                // Get recent payments instead of activities
                if (result.success && result.payments) {
                    const recentPayments = result.payments
                        .filter(p => !p.voided && p.date)
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .slice(0, 10)
                        .map(payment => ({
                            id: payment.id,
                            userName: payment.studentName || 'Unknown',
                            action: 'ADD',
                            module: 'Payments',
                            recordId: payment.id,
                            recordName: `Payment - ${payment.receiptNo || 'N/A'}`,
                            details: `Amount: ${settings.currency} ${payment.amount}`,
                            timestamp: payment.date,
                            amount: payment.amount,
                            receiptNo: payment.receiptNo
                        }));
                    setRecentActivities(recentPayments);
                }
            } catch (error) {
                console.warn('Dashboard refresh error:', error);
            } finally {
                setIsRefreshing(false);
                setTimeout(() => { refreshRef.current = false; }, 1000);
            }
        };
        
        // Refresh immediately on mount
        doRefresh();
        
        // Then refresh every 30 seconds
        const refreshInterval = setInterval(doRefresh, 30000);
        
        return () => clearInterval(refreshInterval);
    }, [settings.googleScriptUrl]);

    // FIXED: Filter out inactive students (status = 'left') from dashboard counts
    const activeStudents = students.filter(s => (s.status || 'active') === 'active');
    const inactiveStudents = students.filter(s => s.status === 'left');
    
    const totalStudents = activeStudents.length;
    const totalTeachers = (data?.teachers || []).length;
    const totalStaff = (data?.staff || []).length;
    const totalFeesCollected = payments
        .filter(p => !p.voided)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const expectedFees = activeStudents.reduce((sum, s) => {
        const fin = Storage.getStudentFinancials(s, payments, settings);
        return sum + fin.totalDue;
    }, 0);
    const totalArrears = expectedFees - totalFeesCollected;
    const feePercentage = expectedFees > 0 ? (totalFeesCollected / expectedFees) * 100 : 0;

    const feesPerGrade = (settings.grades || []).map(grade => {
        const gradeStudentIds = activeStudents.filter(s => s.grade === grade).map(s => s.id);
        const total = payments
            .filter(p => gradeStudentIds.includes(p.studentId) && !p.voided)
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        return { grade, total };
    });
    const maxGradeFee = Math.max(...feesPerGrade.map(f => f.total), 1);

    const assessmentActivity = (settings.grades || []).map(grade => {
        const gradeStudents = activeStudents.filter(s => s.grade === grade);
        const totalEnrolled = gradeStudents.length;
        
        const gradeStudentIds = new Set(gradeStudents.map(s => String(s.id)));
        const assessedStudentIds = new Set(
            assessments.filter(a => gradeStudentIds.has(String(a.studentId))).map(a => String(a.studentId))
        );
        
        const studentsAssessed = assessedStudentIds.size;
        const percentage = totalEnrolled > 0 ? (studentsAssessed / totalEnrolled) * 100 : 0;
        
        return {
            grade,
            totalEnrolled,
            studentsAssessed,
            percentage
        };
    });

    return html`
        <div class="space-y-8 animate-in fade-in duration-500">
            
            ${googleSyncStatus && html`
                <div class="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-xl shadow-lg shadow-blue-200 flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <span class="animate-pulse">🔄</span>
                        <span class="font-bold text-sm">${googleSyncStatus}</span>
                    </div>
                </div>
            `}
            ${settings.googleScriptUrl && html`
                <div class="bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-3 rounded-xl shadow-lg shadow-green-200">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-3">
                            <span class="text-2xl">📊</span>
                            <div>
                                <p class="font-bold">Google Sheet Connected</p>
                                <p class="text-xs text-green-100">Real-time data sync enabled</p>
                            </div>
                        </div>
                        <button 
                            onClick=${refreshFromGoogle}
                            disabled=${isRefreshing}
                            class="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all"
                        >
                            <span class=${isRefreshing ? 'animate-spin' : ''}>${isRefreshing ? '⏳' : '🔄'}</span>
                            ${isRefreshing ? 'Syncing...' : 'Sync Now'}
                        </button>
                    </div>
                    
                    
                    <div class="flex items-center justify-between mt-4 pt-4 border-t border-white/20">
                        <p class="text-xs font-bold uppercase text-green-100">👥 Online Users (${activeUsers.length})</p>
                        <button 
                            onClick=${refreshActiveUsers}
                            class="bg-yellow-400 hover:bg-yellow-300 px-4 py-2 rounded-xl font-bold text-sm text-slate-800 flex items-center gap-2"
                            title="Click to refresh active users list"
                        >
                            <span>🔄</span>
                            Refresh Users
                        </button>
                    </div>
                    ${activeUsers.length > 0 ? html`
                        <div class="mt-2 pt-0 border-t border-white/20">
                            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                ${activeUsers.map(user => {
                                    if (!user || !user.device) return '';
                                    const lastTime = user.lastActivity ? new Date(user.lastActivity) : new Date();
                                    const role = user.device.includes('admin@') ? '👨‍💼 Admin' : (user.device.includes('teacher@') ? '👨‍🏫 Teacher' : '👤 User');
                                    // Handle new format: role@username#session_id
                                    const usernamePart = user.device.split('@')[1] || user.device;
                                    const username = usernamePart.split('#')[0] || 'Unknown';
                                    return html`
                                        <div class="bg-white/10 backdrop-blur rounded-lg p-3 flex items-center gap-3">
                                            <div class="flex-1 min-w-0">
                                                <p class="text-sm font-bold truncate">${role}</p>
                                                <p class="text-xs text-green-100 truncate">${username}</p>
                                                <p class="text-[10px] text-green-200 mt-1">Active: ${lastTime.toLocaleTimeString()}</p>
                                            </div>
                                            <div class="flex-shrink-0">
                                                <span class="inline-flex h-3 w-3 rounded-full bg-green-300 animate-pulse"></span>
                                            </div>
                                        </div>
                                    `;
                                })}
                            </div>
                        </div>
                    ` : html`
                        <div class="mt-4 pt-4 border-t border-white/20">
                            <div class="bg-white/10 rounded-lg p-3 flex items-center gap-3">
                                <div class="flex-1">
                                    <p class="text-sm font-bold">${isAdmin ? '👨‍💼 Admin' : (teacherSession ? '👨‍🏫 Teacher' : '👤 User')}</p>
                                    <p class="text-xs text-green-100">${isAdmin ? (localStorage.getItem('et_login_username') || 'Admin') : (teacherSession?.name || teacherSession?.username || 'You')}</p>
                                    <p class="text-[10px] text-green-200 mt-1">You are online - click around to stay active!</p>
                                </div>
                                <div class="flex-shrink-0">
                                    <span class="inline-flex h-3 w-3 rounded-full bg-green-300 animate-pulse"></span>
                                </div>
                            </div>
                            <p class="text-[10px] text-green-200 mt-2">Note: Other users will appear when they also use the system. Click "Refresh Users" to update the list.</p>
                        </div>
                    `}
                </div>
            `}

            <div class="no-print">
                <h1 class="text-4xl font-extrabold tracking-tight">System Overview</h1>
                <p class="text-slate-500 mt-1 text-lg">Welcome back to ${settings.schoolName || 'the portal'}.</p>
            </div>


            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
                <${StatCard} title="Students" value=${totalStudents} subtitle=${inactiveStudents.length > 0 ? `Enrollment (+${inactiveStudents.length} left)` : "Enrollment"} icon="👥" color="blue" trend="+12%" trendUp="up" />
                <${StatCard} title="Teachers" value=${totalTeachers} subtitle="Academic" icon="👨‍🏫" color="orange" trend="+5%" trendUp="up" />
                <${StatCard} title="Staff" value=${totalStaff} subtitle="Support" icon="🛠️" color="cyan" trend="0%" trendUp="neutral" />
                <${StatCard} title="Paid" value=${settings.currency + ' ' + totalFeesCollected.toLocaleString()} subtitle=${feePercentage.toFixed(1) + '% Target'} icon="💰" color="green" trend="+23%" trendUp="up" />
                <${StatCard} title="Arrears" value=${settings.currency + ' ' + totalArrears.toLocaleString()} subtitle="Outstanding" icon="⚠️" color="red" trend="-8%" trendUp="down" />
                <${StatCard} title="Assess" value=${assessments.length} subtitle="CBC Records" icon="📝" color="purple" trend="+15%" trendUp="up" />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 class="font-bold mb-4 text-base flex items-center gap-2">
                        <span class="w-2 h-2 bg-blue-500 rounded-full"></span>
                        Recent Fees Activity
                    </h3>
                    <div class="space-y-1">
                        ${(recentActivities || []).map((activity, idx) => {
                            if (!activity) return '';
                            return html`
                                <div class=${`flex items-center gap-3 p-3 rounded-xl border-b border-slate-50 last:border-0 ${idx % 2 === 0 ? 'bg-slate-50/50' : ''}`}>
                                    <div class=${`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm border ${
                                        activity.module === 'Payments' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                        activity.module === 'Calendar' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 
                                        activity.module === 'Students' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                                        'bg-slate-50 text-slate-600 border-slate-100'
                                    }`}>
                                        ${activity.module === 'Calendar' ? '📅' : 
                                          activity.module === 'Payments' ? '💳' : 
                                          activity.module === 'Students' ? '🎓' : '📝'}
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <p class="font-bold text-xs md:text-sm text-slate-800 truncate">
                                            ${activity.recordName || (activity.details ? activity.details.split(':').pop().trim() : 'Record')}
                                        </p>
                                        <p class="text-sm text-slate-500 capitalize">
                                            ${activity.userName} • ${activity.action === 'ADD' ? 'added' : activity.action === 'UPDATE' ? 'updated' : activity.action.toLowerCase()} • ${new Date(activity.timestamp).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div class="text-right">
                                        ${activity.module === 'Payments' && html`
                                            <div class="mb-1">
                                                <span class="text-green-600 font-black text-xs md:text-sm block leading-none">
                                                    +${settings.currency} ${(activity.amount || 0).toLocaleString()}
                                                </span>
                                                <span class="text-sm text-slate-300 font-mono uppercase tracking-tighter">
                                                    ${activity.receiptNo || 'N/A'}
                                                </span>
                                            </div>
                                        `}
                                        <span class="text-sm font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                                            ${activity.module}
                                        </span>
                                    </div>
                                </div>
                            `;
                        })}
                        ${recentActivities.length === 0 && html`<p class="text-center text-slate-300 py-4 text-sm font-medium italic">No recent fees activity found</p>`}
                    </div>
                </div>

                
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 class="font-bold mb-6 flex items-center gap-2">
                        <span class="w-2 h-2 bg-purple-500 rounded-full"></span>
                        Student Enrollment per Grade
                    </h3>
                    <div class="relative h-60 border-l border-b border-slate-200 ml-8 mb-8">
                        
                        <div class="absolute -left-8 h-full w-8 flex flex-col justify-between text-[8px] font-bold text-slate-400 py-1">
                            <span>MAX</span>
                            <span>75%</span>
                            <span>50%</span>
                            <span>25%</span>
                            <span>0</span>
                        </div>
                        
                        <div class="absolute inset-0 flex flex-col justify-between pointer-events-none">
                            <div class="border-t border-slate-100 w-full h-0"></div>
                            <div class="border-t border-slate-100 w-full h-0"></div>
                            <div class="border-t border-slate-100 w-full h-0"></div>
                            <div class="border-t border-slate-100 w-full h-0"></div>
                            <div class="h-0"></div>
                        </div>
                        
                        <div class="absolute inset-0 flex items-end justify-between gap-1 px-1">
                            ${(settings.grades || []).map((grade, index) => {
        const count = activeStudents.filter(s => s.grade === grade).length;
        const maxCount = Math.max(...settings.grades.map(g => activeStudents.filter(s => s.grade === g).length), 1);
        const heightPct = (count / maxCount) * 100;
        const colors = ['bg-blue-400', 'bg-green-400', 'bg-purple-400', 'bg-orange-400', 'bg-pink-400', 'bg-yellow-400', 'bg-cyan-400', 'bg-indigo-400'];
        const color = colors[index % colors.length];

        return html`
                                    <div class="flex-1 flex flex-col items-center group relative h-full justify-end">
                                        <div class=${`w-full ${color} rounded-t-sm opacity-80 hover:opacity-100 transition-all cursor-pointer relative z-10`} style=${{ height: `${heightPct}%` }}>
                                            ${count > 0 && html`<span class="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-black text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity z-20">${count}</span>`}
                                        </div>
                                        
                                        <span class="absolute -bottom-10 text-[8px] font-bold text-slate-400 uppercase rotate-45 origin-left whitespace-nowrap">${grade}</span>
                                    </div>
                                `;
    })}
                        </div>
                    </div>
                    ${totalStudents === 0 && html`<p class="text-center text-slate-300 py-12 text-sm">No enrollment data</p>`}
                </div>
            </div>

            
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 md:col-span-2 xl:col-span-3">
                    <h3 class="font-bold mb-6 flex items-center gap-2">
                        <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                        Fee Collection per Grade (${settings.currency})
                    </h3>
                    <div class="relative h-60 border-l border-b border-slate-200 ml-16 mb-8">
                        
                        <div class="absolute -left-16 h-full w-14 flex flex-col justify-between text-[8px] font-bold text-slate-400 py-1 text-right pr-2">
                            <span>${(maxGradeFee / 1000).toFixed(0)}K</span>
                            <span>${(maxGradeFee * 0.75 / 1000).toFixed(0)}K</span>
                            <span>${(maxGradeFee * 0.5 / 1000).toFixed(0)}K</span>
                            <span>${(maxGradeFee * 0.25 / 1000).toFixed(0)}K</span>
                            <span>0</span>
                        </div>
                        
                        <div class="absolute inset-0 flex flex-col justify-between pointer-events-none">
                            <div class="border-t border-slate-100 w-full h-0"></div>
                            <div class="border-t border-slate-100 w-full h-0"></div>
                            <div class="border-t border-slate-100 w-full h-0"></div>
                            <div class="border-t border-slate-100 w-full h-0"></div>
                            <div class="h-0"></div>
                        </div>
                        
                        <div class="absolute inset-0 flex items-end justify-between gap-1 px-1">
                            ${feesPerGrade.map((item, index) => {
        const heightPct = (item.total / maxGradeFee) * 100;
        const colors = ['bg-emerald-400', 'bg-teal-400', 'bg-cyan-400', 'bg-sky-400', 'bg-blue-400', 'bg-indigo-400', 'bg-violet-400', 'bg-purple-400'];
        const color = colors[index % colors.length];

        return html`
                                    <div class="flex-1 flex flex-col items-center group relative h-full justify-end">
                                        <div class=${`w-full ${color} rounded-t-sm opacity-80 hover:opacity-100 transition-all cursor-pointer relative z-10`} style=${{ height: `${heightPct}%` }}>
                                            <div class="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                                                ${settings.currency} ${item.total.toLocaleString()}
                                            </div>
                                        </div>
                                        
                                        <span class="absolute -bottom-10 text-[8px] font-bold text-slate-400 uppercase rotate-45 origin-left whitespace-nowrap">${item.grade}</span>
                                    </div>
                                `;
    })}
                        </div>
                    </div>
                    ${totalFeesCollected === 0 && html`<p class="text-center text-slate-300 py-12 text-sm">No fee collection data yet</p>`}
                </div>
                
                
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 md:col-span-2 xl:col-span-3">
                    <h3 class="font-bold mb-6 flex items-center gap-2">
                        <span class="w-2 h-2 bg-purple-500 rounded-full"></span>
                        Assessment Activity
                    </h3>
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                        ${assessmentActivity.map(item => {
                            if (!item) return '';
                            let colorTheme = { bg: 'bg-red-100', text: 'text-red-700', bar: 'bg-red-500' };
                            if (item.percentage === 100) colorTheme = { bg: 'bg-green-100', text: 'text-green-700', bar: 'bg-green-500' };
                            else if (item.percentage >= 75) colorTheme = { bg: 'bg-purple-100', text: 'text-purple-700', bar: 'bg-purple-500' };
                            else if (item.percentage >= 50) colorTheme = { bg: 'bg-blue-100', text: 'text-blue-700', bar: 'bg-blue-500' };
                            else if (item.percentage >= 25) colorTheme = { bg: 'bg-orange-100', text: 'text-orange-700', bar: 'bg-orange-500' };
                            else if (item.percentage > 0) colorTheme = { bg: 'bg-rose-100', text: 'text-rose-700', bar: 'bg-rose-500' };
                            else colorTheme = { bg: 'bg-slate-200', text: 'text-slate-600', bar: 'bg-slate-300' };
                            
                            return html`
                            <div class="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                <div class="flex justify-between items-center mb-2">
                                    <span class="font-bold text-slate-700 text-sm truncate pr-2">${item.grade}</span>
                                    <span class=${`flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${colorTheme.bg} ${colorTheme.text}`}>
                                        ${item.percentage.toFixed(0)}%
                                    </span>
                                </div>
                                <div class="w-full bg-slate-200 rounded-full h-2 mb-3 overflow-hidden">
                                    <div 
                                        class=${`h-2 rounded-full transition-all duration-1000 ${colorTheme.bar}`}
                                        style=${{ width: `${item.percentage}%` }}
                                    ></div>
                                </div>
                                <div class="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                                    <span>${item.studentsAssessed} Assessed</span>
                                    <span>${item.totalEnrolled} Total</span>
                                </div>
                            </div>
                        `;
                        })}
                    </div>
                </div>

                
                ${isAdmin && html`
                    <div class="md:col-span-2 xl:col-span-3">
                        <${ActivityLog} 
                            settings=${settings} 
                            isAdmin=${isAdmin}
                            teacherSession=${teacherSession}
                            limit=${25}
                        />
                    </div>
                `}
            </div>
        </div>
    `;
};

const StatCard = ({ title, value, subtitle, icon, color, trend, trendUp }) => {
    const themes = {
        blue: { stripe: 'border-l-blue-500', value: 'text-blue-600', iconBg: 'bg-blue-100', iconText: 'text-blue-600', trendUp: 'text-green-600', trendDown: 'text-red-600' },
        green: { stripe: 'border-l-emerald-500', value: 'text-emerald-600', iconBg: 'bg-emerald-100', iconText: 'text-emerald-600', trendUp: 'text-green-600', trendDown: 'text-red-600' },
        purple: { stripe: 'border-l-purple-500', value: 'text-purple-600', iconBg: 'bg-purple-100', iconText: 'text-purple-600', trendUp: 'text-green-600', trendDown: 'text-red-600' },
        orange: { stripe: 'border-l-orange-500', value: 'text-orange-600', iconBg: 'bg-orange-100', iconText: 'text-orange-600', trendUp: 'text-green-600', trendDown: 'text-red-600' },
        cyan: { stripe: 'border-l-cyan-500', value: 'text-cyan-600', iconBg: 'bg-cyan-100', iconText: 'text-cyan-600', trendUp: 'text-green-600', trendDown: 'text-red-600' },
        red: { stripe: 'border-l-rose-500', value: 'text-rose-600', iconBg: 'bg-rose-100', iconText: 'text-rose-600', trendUp: 'text-green-600', trendDown: 'text-red-600' }
    };

    const theme = themes[color] || themes.blue;

    const getTrendIcon = (direction) => {
        if (direction === 'up') return '↑';
        if (direction === 'down') return '↓';
        return '→';
    };

    const getTrendColor = (direction) => {
        if (direction === 'up') return theme.trendUp;
        if (direction === 'down') return theme.trendDown;
        return 'text-slate-400';
    };

    return html`
        <div class="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-200 border-l-4 ${theme.stripe} hover:shadow-md transition-all relative overflow-hidden group h-full">
            <div class="flex items-start justify-between mb-3">
                <div class="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-lg md:text-xl ${theme.iconBg} ${theme.iconText} shadow-sm">
                    ${icon}
                </div>
                ${trend && html`
                    <div class="flex items-center gap-1 text-xs font-bold ${getTrendColor(trendUp)}">
                        <span>${getTrendIcon(trendUp)}</span>
                        <span>${trend}</span>
                    </div>
                `}
            </div>
            <h4 class="text-[10px] md:text-xs font-black uppercase tracking-widest text-slate-500 mb-1">${title}</h4>
            <p class="text-xl md:text-2xl font-black mt-1 leading-tight ${theme.value}">${value}</p>
            <p class="text-[10px] md:text-xs font-bold mt-1 text-slate-400">${subtitle}</p>
        </div>
    `;
};
