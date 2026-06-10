import { h } from 'preact';
import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import htm from 'htm';
import Chart from 'chart.js';
import { PrintButtons } from './PrintButtons.js';

const html = htm.bind(h);

// Color palettes for diverse visualization
const VIBRANT_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
const GRADIENT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];
const PASTEL_COLORS = ['#FFB3BA', '#FFCCCB', '#FFFFBA', '#BAE1FF', '#BAC2F0', '#FFB3D9', '#C2F0C2', '#FFD9B3'];

export const SchoolAnalysis = ({ data, isAdmin, activeTab = 'overview' }) => {
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [selectedTerm, setSelectedTerm] = useState('T1');
    const [analysisType, setAnalysisType] = useState(activeTab);

    const chartRefs = {
        subjects: useRef(null),
        subjectsLine: useRef(null),
        teachers: useRef(null),
        teachersRadar: useRef(null),
        classes: useRef(null),
        performance: useRef(null),
        distribution: useRef(null)
    };
    const chartInstances = useRef({});

    const gradeGroups = {
        all: { label: 'All School', grades: data.settings?.grades || [] },
        junior: { label: 'Junior School (G1-G6)', grades: ['GRADE 1', 'GRADE 2', 'GRADE 3', 'GRADE 4', 'GRADE 5', 'GRADE 6'] },
        senior: { label: 'Senior School (G7-G12)', grades: ['GRADE 7', 'GRADE 8', 'GRADE 9', 'GRADE 10', 'GRADE 11', 'GRADE 12'] }
    };

    const filteredData = useMemo(() => {
        const groupGrades = gradeGroups[selectedGroup].grades;
        const students = (data.students || []).filter(s => groupGrades.includes(s.grade));
        const studentIds = new Set(students.map(s => String(s.id)));
        const studentAdmissions = new Set(students.map(s => String(s.admissionNo || '').toLowerCase()));
        const studentNames = new Set(students.map(s => s.name?.toLowerCase().trim()));
        
        // Enhanced filtering with multiple ID matching strategies
        const assessments = (data.assessments || []).filter(a => {
            const matchById = studentIds.has(String(a.studentId));
            const matchByAdmission = a.studentAdmissionNo && studentAdmissions.has(String(a.studentAdmissionNo).toLowerCase());
            const matchByName = a.studentName && studentNames.has(a.studentName.toLowerCase().trim());
            
            return (matchById || matchByAdmission || matchByName) && a.term === selectedTerm;
        });
        
        return { students, assessments };
    }, [data, selectedGroup, selectedTerm]);

    const stats = useMemo(() => {
        const subjectAnalysis = [];
        const teacherAnalysis = [];
        const classAnalysis = [];
        const performanceDistribution = [];

        // Subject Analysis
        const subjects = [...new Set(filteredData.assessments.map(a => a.subject))];
        subjects.forEach(subject => {
            const subjectAssessments = filteredData.assessments.filter(a => a.subject === subject);
            const scores = subjectAssessments.map(a => {
                let score = Number(a.score);
                if (isNaN(score) && a.rawScore !== undefined && a.maxScore) {
                    score = Math.round((Number(a.rawScore) / Number(a.maxScore)) * 100);
                }
                return isNaN(score) ? 0 : score;
            });
            
            if (scores.length === 0) return;
            
            const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
            const min = Math.min(...scores);
            const max = Math.max(...scores);
            const sorted = [...scores].sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)];
            subjectAnalysis.push({ subject, avg, count: subjectAssessments.length, min, max, median });
        });
        subjectAnalysis.sort((a, b) => b.avg - a.avg);

        // Teacher Analysis - Enhanced with better matching
        (data.teachers || []).forEach(teacher => {
            const teacherSubjects = (teacher.subjects || '').split(',').map(s => s.trim().toLowerCase()).filter(s => s);
            const teacherGrades = (teacher.grades || '').split(',').map(g => g.trim()).filter(g => g);
            
            const teacherAssessments = filteredData.assessments.filter(a => {
                const subjectMatch = teacherSubjects.length === 0 || teacherSubjects.some(ts => 
                    ts && (a.subject?.toLowerCase().includes(ts) || ts.includes(a.subject?.toLowerCase()))
                );
                const gradeMatch = teacherGrades.length === 0 || teacherGrades.some(tg => 
                    tg && (a.grade?.toLowerCase().includes(tg.toLowerCase()) || tg.toLowerCase().includes(a.grade?.toLowerCase()))
                );
                return subjectMatch && gradeMatch;
            });
            
            if (teacherAssessments.length > 0) {
                const scores = teacherAssessments.map(a => {
                    let score = Number(a.score);
                    if (isNaN(score) && a.rawScore !== undefined && a.maxScore) {
                        score = Math.round((Number(a.rawScore) / Number(a.maxScore)) * 100);
                    }
                    return isNaN(score) ? 0 : score;
                });
                const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                const variance = scores.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / scores.length;
                const consistency = Math.round(100 - Math.sqrt(variance));
                teacherAnalysis.push({ 
                    teacher: teacher.name, 
                    avg, 
                    count: teacherAssessments.length, 
                    subjects: teacherSubjects.filter(s => s),
                    consistency: Math.max(0, consistency)
                });
            }
        });
        teacherAnalysis.sort((a, b) => b.avg - a.avg);

        // Class Analysis
        gradeGroups[selectedGroup].grades.forEach(className => {
            const classAssessments = filteredData.assessments.filter(a => a.grade === className);
            if (classAssessments.length > 0) {
                const scores = classAssessments.map(a => {
                    let score = Number(a.score);
                    if (isNaN(score) && a.rawScore !== undefined && a.maxScore) {
                        score = Math.round((Number(a.rawScore) / Number(a.maxScore)) * 100);
                    }
                    return isNaN(score) ? 0 : score;
                });
                const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
                classAnalysis.push({ className, avg, count: classAssessments.length });
            }
        });

        // Performance Distribution (0-20, 20-40, 40-60, 60-80, 80-100)
        const ranges = [
            { label: '0-20%', min: 0, max: 20, count: 0 },
            { label: '20-40%', min: 20, max: 40, count: 0 },
            { label: '40-60%', min: 40, max: 60, count: 0 },
            { label: '60-80%', min: 60, max: 80, count: 0 },
            { label: '80-100%', min: 80, max: 100, count: 0 }
        ];
        filteredData.assessments.forEach(a => {
            let score = Number(a.score);
            if (isNaN(score) && a.rawScore !== undefined && a.maxScore) {
                score = Math.round((Number(a.rawScore) / Number(a.maxScore)) * 100);
            }
            score = isNaN(score) ? 0 : score;
            ranges.forEach(r => {
                if (score >= r.min && score <= r.max) r.count++;
            });
        });

        return { subjectAnalysis, teacherAnalysis, classAnalysis, performanceDistribution: ranges };
    }, [filteredData, data.teachers, selectedGroup]);

    // Calculate school average
    const schoolAvg = useMemo(() => {
        if (stats.subjectAnalysis.length === 0) return 0;
        const sum = stats.subjectAnalysis.reduce((a, b) => a + b.avg, 0);
        return Math.round(sum / stats.subjectAnalysis.length);
    }, [stats.subjectAnalysis]);

    useEffect(() => {
        // Destroy existing charts
        Object.values(chartInstances.current).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        chartInstances.current = {};
        
        const renderChart = (id, config) => {
            const ctx = chartRefs[id].current?.getContext('2d');
            if (ctx) {
                chartInstances.current[id] = new Chart(ctx, config);
            }
        };

        if (analysisType === 'overview' || analysisType === 'subjects') {
            const chartData = stats.subjectAnalysis.slice(0, 10);
            
            if (chartData.length > 0) {
                // Bar Chart - Subjects
                renderChart('subjects', {
                    type: 'bar',
                    data: {
                        labels: chartData.map(d => d.subject),
                        datasets: [{
                            label: 'Average Score %',
                            data: chartData.map(d => d.avg),
                            backgroundColor: VIBRANT_COLORS.slice(0, chartData.length),
                            borderColor: VIBRANT_COLORS.slice(0, chartData.length),
                            borderWidth: 2,
                            borderRadius: 8
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { y: { beginAtZero: true, max: 100 } },
                        plugins: { legend: { display: true } }
                    }
                });

                // Line Chart - Subjects Trend
                renderChart('subjectsLine', {
                    type: 'line',
                    data: {
                        labels: chartData.map(d => d.subject),
                        datasets: [{
                            label: 'Average Score',
                            data: chartData.map(d => d.avg),
                            borderColor: '#3b82f6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            tension: 0.4,
                            fill: true,
                            pointBackgroundColor: VIBRANT_COLORS.slice(0, chartData.length),
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { y: { beginAtZero: true, max: 100 } }
                    }
                });
            }
        }

        if (analysisType === 'teachers') {
            const chartData = stats.teacherAnalysis.slice(0, 8);
            
            if (chartData.length > 0) {
                // Radar Chart - Teachers
                renderChart('teachersRadar', {
                    type: 'radar',
                    data: {
                        labels: chartData.map(d => d.teacher),
                        datasets: [{
                            label: 'Performance Score',
                            data: chartData.map(d => d.avg),
                            borderColor: '#10b981',
                            backgroundColor: 'rgba(16, 185, 129, 0.2)',
                            pointBackgroundColor: '#10b981',
                            pointBorderColor: '#fff',
                            pointBorderWidth: 2,
                            pointRadius: 5
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { r: { beginAtZero: true, max: 100 } }
                    }
                });

                // Bar Chart - Teachers
                renderChart('teachers', {
                    type: 'bar',
                    data: {
                        labels: chartData.map(d => d.teacher),
                        datasets: [{
                            label: 'Average Score',
                            data: chartData.map(d => d.avg),
                            backgroundColor: GRADIENT_COLORS.slice(0, chartData.length),
                            borderColor: GRADIENT_COLORS.slice(0, chartData.length),
                            borderWidth: 2,
                            borderRadius: 8
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { y: { beginAtZero: true, max: 100 } }
                    }
                });
            }
        }

        if (analysisType === 'classes') {
            const chartData = stats.classAnalysis;
            
            if (chartData.length > 0) {
                // Doughnut Chart - Classes
                renderChart('classes', {
                    type: 'doughnut',
                    data: {
                        labels: chartData.map(d => d.className),
                        datasets: [{
                            data: chartData.map(d => d.avg),
                            backgroundColor: PASTEL_COLORS.slice(0, chartData.length),
                            borderColor: '#fff',
                            borderWidth: 3
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom' } }
                    }
                });
            }
        }

        // Performance Distribution - Pie/Doughnut
        if (analysisType === 'overview' || analysisType === 'classes') {
            const distData = stats.performanceDistribution;
            if (distData.some(d => d.count > 0)) {
                renderChart('distribution', {
                    type: 'pie',
                    data: {
                        labels: distData.map(d => d.label),
                        datasets: [{
                            data: distData.map(d => d.count),
                            backgroundColor: ['#EF4444', '#F97316', '#FBBF24', '#60A5FA', '#10B981'],
                            borderColor: '#fff',
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'right' } }
                    }
                });
            }
        }
    }, [analysisType, stats]);

    // Standard dashboard view
    return html`
        <div class="space-y-6 animate-in fade-in duration-500">
            <!-- Enhanced Banner for UI and Printout -->
            <div class="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden mb-8">
                <div class="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div class="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>
                
                <div class="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div class="text-center md:text-left">
                        <div class="inline-block px-4 py-1 bg-indigo-500/20 rounded-full text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Institutional Analytics</div>
                        <h1 class="text-4xl md:text-5xl font-black tracking-tighter mb-2">School Analysis Dashboard</h1>
                        <p class="text-slate-400 font-medium max-w-md">Interactive charts and performance metrics for ${data.settings?.schoolName || 'Skyview School'}.</p>
                    </div>

                    <div class="flex flex-col items-center md:items-end gap-2">
                        <div class="text-6xl font-black text-white/20 select-none no-print">📊</div>
                        <div class="flex gap-2 no-print mt-4">
                            <${PrintButtons} />
                        </div>
                    </div>
                </div>
            </div>



            <div class="bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-slate-100 shadow-sm sticky top-0 z-10 no-print">
                <div class="flex flex-wrap items-center gap-2">
                    <div class="flex bg-slate-100 p-1 rounded-xl">
                        ${['overview', 'subjects', 'teachers', 'classes'].map(type => html`
                            <button 
                                onClick=${() => setAnalysisType(type)}
                                class=${`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${analysisType === type ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >${type}</button>
                        `)}
                    </div>
                    <div class="h-8 w-px bg-slate-200 mx-2"></div>
                    <select 
                        value=${selectedGroup}
                        onChange=${(e) => setSelectedGroup(e.target.value)}
                        class="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer"
                    >
                        ${Object.entries(gradeGroups).map(([key, value]) => html`<option value=${key}>${value.label}</option>`)}
                    </select>
                    <select 
                        value=${selectedTerm}
                        onChange=${(e) => setSelectedTerm(e.target.value)}
                        class="bg-transparent border-none text-sm font-bold text-slate-700 focus:ring-0 cursor-pointer"
                    >
                        <option value="T1">Term 1</option>
                        <option value="T2">Term 2</option>
                        <option value="T3">Term 3</option>
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div class="lg:col-span-2 space-y-6">
                    ${(analysisType === 'overview' || analysisType === 'subjects') && html`
                        <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-[400px]">
                            <h3 class="font-black text-slate-900 uppercase tracking-wider text-xs mb-4">Subject Performance (Bar Chart)</h3>
                            <div class="h-[320px]">
                                <canvas ref=${chartRefs.subjects}></canvas>
                            </div>
                        </div>

                        <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-[400px]">
                            <h3 class="font-black text-slate-900 uppercase tracking-wider text-xs mb-4">Subject Trends (Line Chart)</h3>
                            <div class="h-[320px]">
                                <canvas ref=${chartRefs.subjectsLine}></canvas>
                            </div>
                        </div>

                        <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-[400px]">
                            <h3 class="font-black text-slate-900 uppercase tracking-wider text-xs mb-4">Performance Distribution (Pie Chart)</h3>
                            <div class="h-[320px]">
                                <canvas ref=${chartRefs.distribution}></canvas>
                            </div>
                        </div>
                    `}

                    ${analysisType === 'teachers' && html`
                        <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-[400px]">
                            <h3 class="font-black text-slate-900 uppercase tracking-wider text-xs mb-4">Educator Performance (Radar Chart)</h3>
                            <div class="h-[320px]">
                                <canvas ref=${chartRefs.teachersRadar}></canvas>
                            </div>
                        </div>

                        <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-[400px]">
                            <h3 class="font-black text-slate-900 uppercase tracking-wider text-xs mb-4">Educator Rankings (Bar Chart)</h3>
                            <div class="h-[320px]">
                                <canvas ref=${chartRefs.teachers}></canvas>
                            </div>
                        </div>
                    `}

                    ${analysisType === 'classes' && html`
                        <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-[400px]">
                            <h3 class="font-black text-slate-900 uppercase tracking-wider text-xs mb-4">Class Performance (Doughnut Chart)</h3>
                            <div class="h-[320px]">
                                <canvas ref=${chartRefs.classes}></canvas>
                            </div>
                        </div>

                        <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-[400px]">
                            <h3 class="font-black text-slate-900 uppercase tracking-wider text-xs mb-4">Performance Distribution (Pie Chart)</h3>
                            <div class="h-[320px]">
                                <canvas ref=${chartRefs.distribution}></canvas>
                            </div>
                        </div>
                    `}

                    <div class="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                        <div class="p-6 border-b border-slate-50">
                            <h3 class="font-black text-slate-900 uppercase tracking-wider text-xs">Detailed Metrics</h3>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse">
                                <thead>
                                    <tr class="bg-slate-50/50">
                                        <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Entity</th>
                                        <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Avg Score</th>
                                        <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Volume</th>
                                        <th class="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-50">
                                    ${(analysisType === 'overview' || analysisType === 'subjects' ? stats.subjectAnalysis : 
                                       analysisType === 'teachers' ? stats.teacherAnalysis : stats.classAnalysis).map((item, i) => html`
                                        <tr class="hover:bg-slate-50/50 transition-colors">
                                            <td class="px-6 py-4">
                                                <div class="font-bold text-slate-900">${item.subject || item.teacher || item.className}</div>
                                            </td>
                                            <td class="px-6 py-4 text-center">
                                                <div class="text-lg font-black text-slate-700">${item.avg}%</div>
                                            </td>
                                            <td class="px-6 py-4 text-center">
                                                <div class="text-xs font-bold text-slate-500">${item.count || 0}</div>
                                            </td>
                                            <td class="px-6 py-4">
                                                <span class=${`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                                                    item.avg >= 75 ? 'bg-green-100 text-green-700' :
                                                    item.avg >= 50 ? 'bg-blue-100 text-blue-700' :
                                                    'bg-amber-100 text-amber-700'
                                                }`}>
                                                    ${item.avg >= 75 ? 'Exceeding' : item.avg >= 50 ? 'Meeting' : 'Developing'}
                                                </span>
                                            </td>
                                        </tr>
                                    `)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="space-y-6">
                    <div class="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-3xl text-white shadow-xl relative overflow-hidden">
                        <div class="absolute -bottom-4 -right-4 text-white/10 text-9xl font-black">Σ</div>
                        <h3 class="text-xs font-black uppercase tracking-widest opacity-60 mb-6">School Mean</h3>
                        <div class="flex items-baseline gap-2 mb-2">
                            <span class="text-6xl font-black">${schoolAvg}</span>
                            <span class="text-2xl font-bold opacity-60">%</span>
                        </div>
                        <p class="text-sm font-medium opacity-80">Aggregate across all subjects</p>
                    </div>

                    <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                        <h3 class="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">Key Metrics</h3>
                        <div class="space-y-3">
                            <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                                <span class="text-xs font-bold text-slate-600">Total Students</span>
                                <span class="text-lg font-black text-slate-900">${filteredData.students.length}</span>
                            </div>
                            <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                                <span class="text-xs font-bold text-slate-600">Assessments</span>
                                <span class="text-lg font-black text-slate-900">${filteredData.assessments.length}</span>
                            </div>
                            <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                                <span class="text-xs font-bold text-slate-600">Subjects</span>
                                <span class="text-lg font-black text-slate-900">${stats.subjectAnalysis.length}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-xs font-bold text-slate-600">Educators</span>
                                <span class="text-lg font-black text-slate-900">${stats.teacherAnalysis.length}</span>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                        <h3 class="text-xs font-black text-slate-600 uppercase tracking-widest mb-4">Top Subjects</h3>
                        <div class="space-y-2">
                            ${stats.subjectAnalysis.slice(0, 3).map((s, i) => html`
                                <div class="flex items-center justify-between pb-2 ${i < 2 ? 'border-b border-slate-100' : ''}">
                                    <span class="text-sm font-bold text-slate-700">${i+1}. ${s.subject}</span>
                                    <span class="text-sm font-black text-indigo-600">${s.avg}%</span>
                                </div>
                            `)}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
};
