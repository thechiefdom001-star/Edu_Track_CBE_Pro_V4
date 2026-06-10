import { h } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import htm from 'htm';

const html = htm.bind(h);

export const SchoolCalendar = ({ data, isAdmin }) => {
    const [viewDate, setViewDate] = useState(new Date());
    const [showAddModal, setShowAddModal] = useState(false);
    const [newEvent, setNewEvent] = useState({ title: '', start: '', end: '', type: 'event', details: '' });

    const calendarData = useMemo(() => data.calendar || [], [data.calendar]);

    const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

    const monthName = viewDate.toLocaleString('default', { month: 'long' });
    const year = viewDate.getFullYear();

    const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));

    const formatDateISO = (dateInput) => {
        if (!dateInput) return '';
        try {
            const date = new Date(dateInput);
            if (isNaN(date.getTime())) return '';
            return date.toISOString().split('T')[0];
        } catch (e) {
            return '';
        }
    };

    const eventsForDay = (day) => {
        const dateStr = `${year}-${String(viewDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return calendarData.filter(event => {
            const start = formatDateISO(event.start);
            const end = event.end ? formatDateISO(event.end) : start;
            if (!start) return false;
            return dateStr >= start && dateStr <= end;
        });
    };

    const handleAddEvent = async (e) => {
        e.preventDefault();
        if (!window.googleSync) return;
        
        const result = await window.googleSync.pushCalendar({
            ...newEvent,
            id: 'EVT-' + Date.now()
        });

        if (result.success) {
            alert('Event added successfully!');
            setShowAddModal(false);
            window.dispatchEvent(new CustomEvent('edutrack:data-refresh'));
        }
    };

    const calendarGrid = useMemo(() => {
        const days = [];
        const totalDays = daysInMonth(viewDate);
        const startOffset = firstDayOfMonth(viewDate);
        for (let i = 0; i < startOffset; i++) days.push(null);
        for (let i = 1; i <= totalDays; i++) days.push(i);
        return days;
    }, [viewDate]);

    const upcomingEvents = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return calendarData
            .filter(e => {
                const eventDate = new Date(e.start);
                return eventDate >= today;
            })
            .sort((a, b) => new Date(a.start) - new Date(b.start))
            .slice(0, 10);
    }, [calendarData]);

    return html`
        <div class="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header class="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 class="text-4xl font-black text-slate-900 dark:text-white tracking-tight">School <span class="text-indigo-600">Calendar</span></h1>
                    <p class="text-slate-500 font-medium">Academic events and important dates</p>
                </div>
                ${isAdmin && html`
                    <button onClick=${() => setShowAddModal(true)} class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs flex items-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">
                        <span>➕</span> Add Event
                    </button>
                `}
            </header>

            <div class="bg-white dark:bg-slate-900 rounded-[32px] p-6 shadow-2xl border border-slate-100 dark:border-slate-800">
                
                <div class="flex items-center justify-between mb-8">
                    <h2 class="text-2xl font-black text-slate-900 dark:text-white">${monthName} <span class="text-slate-400 font-medium">${year}</span></h2>
                    <div class="flex gap-2">
                        <button onClick=${prevMonth} class="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100 transition-colors">◀️</button>
                        <button onClick=${() => setViewDate(new Date())} class="px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors">Today</button>
                        <button onClick=${nextMonth} class="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-slate-100 transition-colors">▶️</button>
                    </div>
                </div>

                
                <div class="grid grid-cols-7 gap-px bg-slate-100 dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800">
                    ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => html`
                        <div class="bg-slate-50 dark:bg-slate-900/50 py-3 text-center text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest border-b border-inherit">${day}</div>
                    `)}
                    
                    ${calendarGrid.map((day, idx) => {
                        const dayEvents = day ? eventsForDay(day) : [];
                        const isToday = day && new Date().toDateString() === new Date(year, viewDate.getMonth(), day).toDateString();

                        return html`
                            <div class=${`min-h-[120px] bg-white dark:bg-slate-900 p-2 group transition-all duration-300 ${
                                day ? (
                                    dayEvents.length > 0 ? 
                                    (dayEvents.some(e => e.type === 'holiday') ? 'bg-red-50/30 dark:bg-red-900/10 ring-1 ring-inset ring-red-500/10' :
                                     dayEvents.some(e => e.type === 'exam') ? 'bg-orange-50/30 dark:bg-orange-900/10 ring-1 ring-inset ring-orange-500/10' :
                                     'bg-indigo-50/30 dark:bg-indigo-900/10 ring-1 ring-inset ring-indigo-500/10') : 
                                    'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                ) : 'bg-slate-50/50 dark:bg-slate-950/20'
                            }`}>
                                ${day && html`
                                    <div class="flex justify-between items-start mb-2">
                                        <span class=${`w-7 h-7 flex items-center justify-center rounded-full text-xs font-black transition-transform group-hover:scale-110 ${isToday ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400'}`}>
                                            ${day}
                                        </span>
                                        <div class="flex gap-0.5">
                                            ${dayEvents.slice(0, 3).map(e => html`
                                                <span class=${`w-1.5 h-1.5 rounded-full ring-1 ring-white dark:ring-slate-900 ${
                                                    e.type === 'holiday' ? 'bg-red-500' : 
                                                    e.type === 'exam' ? 'bg-orange-500' : 'bg-indigo-600'
                                                }`}></span>
                                            `)}
                                        </div>
                                    </div>
                                    <div class="space-y-1">
                                        ${dayEvents.map(event => html`
                                            <div class=${`px-2 py-1.5 rounded-lg text-[9px] font-black truncate shadow-sm border ${
                                                event.type === 'holiday' ? 'bg-red-500 text-white border-red-600' : 
                                                event.type === 'exam' ? 'bg-orange-500 text-white border-orange-600' : 
                                                'bg-indigo-600 text-white border-indigo-700'
                                            }`} title=${event.title + ': ' + (event.details || '')}>
                                                ${event.title}
                                            </div>
                                        `)}
                                    </div>
                                `}
                            </div>
                        `;
                    })}
                </div>
            </div>

            
            <section class="mt-12 mb-12">
                <h3 class="text-2xl font-black text-indigo-600 mb-6 flex items-center gap-3">
                    <span class="bg-indigo-600 w-3 h-3 rounded-full"></span> 
                    Upcoming School Events
                </h3>
                
                <div class="bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden border border-slate-100 dark:border-slate-800 shadow-xl">
                    <div class="overflow-x-auto no-scrollbar">
                        <table class="w-full border-collapse text-left">
                            <thead>
                                <tr class="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                    <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Date</th>
                                    <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Event Title</th>
                                    <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Type</th>
                                    <th class="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Details</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
                                ${upcomingEvents.length === 0 ? html`
                                    <tr>
                                        <td colspan="4" class="px-6 py-12 text-center text-slate-400 font-medium italic">
                                            No upcoming events scheduled at this time.
                                        </td>
                                    </tr>
                                ` : upcomingEvents.map(event => html`
                                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                        <td class="px-6 py-4">
                                            <div class="flex flex-col">
                                                <span class="text-sm font-black text-slate-900 dark:text-white">${new Date(event.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                                                <span class="text-[10px] text-slate-400 uppercase font-bold">${new Date(event.start).getFullYear()}</span>
                                            </div>
                                        </td>
                                        <td class="px-6 py-4">
                                            <span class="text-sm font-bold text-indigo-600 dark:text-indigo-400">${event.title}</span>
                                        </td>
                                        <td class="px-6 py-4">
                                            <span class=${`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                                                event.type === 'holiday' ? 'bg-red-500/10 text-red-500' : 
                                                event.type === 'exam' ? 'bg-orange-500/10 text-orange-500' : 
                                                'bg-indigo-500/10 text-indigo-500'
                                            }`}>${event.type}</span>
                                        </td>
                                        <td class="px-6 py-4 max-w-xs">
                                            <p class="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">${event.details || '-'}</p>
                                        </td>
                                    </tr>
                                `)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            
            ${showAddModal && html`
                <div class="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                    <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-white/10 animate-scale-up">
                        <div class="p-8">
                            <div class="flex justify-between items-center mb-8">
                                <h2 class="text-2xl font-black text-slate-900 dark:text-white">Add Calendar Event</h2>
                                <button onClick=${() => setShowAddModal(false)} class="text-slate-500 hover:text-slate-900 dark:hover:text-white">✕</button>
                            </div>
                            <form onSubmit=${handleAddEvent} class="space-y-4">
                                <div>
                                    <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 ml-1">Title</label>
                                    <input type="text" value=${newEvent.title} onInput=${e => setNewEvent({...newEvent, title: e.target.value})} class="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 outline-none" required />
                                </div>
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 ml-1">Start Date</label>
                                        <input type="date" value=${newEvent.start} onInput=${e => setNewEvent({...newEvent, start: e.target.value})} class="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 outline-none" required />
                                    </div>
                                    <div>
                                        <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 ml-1">End Date</label>
                                        <input type="date" value=${newEvent.end} onInput=${e => setNewEvent({...newEvent, end: e.target.value})} class="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 ml-1">Event Type</label>
                                    <select value=${newEvent.type} onChange=${e => setNewEvent({...newEvent, type: e.target.value})} class="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 outline-none">
                                        <option value="event">General Event</option>
                                        <option value="exam">Examination</option>
                                        <option value="holiday">School Holiday</option>
                                        <option value="meeting">Meeting</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 ml-1">Details</label>
                                    <textarea value=${newEvent.details} onInput=${e => setNewEvent({...newEvent, details: e.target.value})} class="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-xl py-3 px-4 focus:ring-2 focus:ring-indigo-500 outline-none h-24" />
                                </div>
                                <button type="submit" class="w-full bg-indigo-600 text-white font-black uppercase py-4 rounded-2xl shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">Save Event</button>
                            </form>
                        </div>
                    </div>
                </div>
            `}
        </div>
    `;
};
