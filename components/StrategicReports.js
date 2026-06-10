import { h } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import htm from 'htm';
import { PrintButtons } from './PrintButtons.js';

const html = htm.bind(h);

export const StrategicReports = ({ data, isAdmin }) => {
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [selectedTerm, setSelectedTerm] = useState('T1');
    const [isGenerating, setIsGenerating] = useState(false);
    const [report, setReport] = useState(null);
    const [reportHistory, setReportHistory] = useState([]);

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

    const schoolAvg = useMemo(() => {
        if (stats.subjectAnalysis.length === 0) return 0;
        const sum = stats.subjectAnalysis.reduce((a, b) => a + b.avg, 0);
        return Math.round(sum / stats.subjectAnalysis.length);
    }, [stats.subjectAnalysis]);

    const generateReport = async () => {
        setIsGenerating(true);
        try {
            const topSubject = stats.subjectAnalysis[0]?.subject || 'N/A';
            const lowSubject = stats.subjectAnalysis[stats.subjectAnalysis.length - 1]?.subject || 'N/A';
            const topTeacher = stats.teacherAnalysis[0]?.teacher || 'N/A';
            const totalAssessments = filteredData.assessments.length;
            const totalStudents = filteredData.students.length;

            const allScores = filteredData.assessments.map(a => {
                let score = Number(a.score);
                if (isNaN(score) && a.rawScore !== undefined && a.maxScore) {
                    score = Math.round((Number(a.rawScore) / Number(a.maxScore)) * 100);
                }
                return isNaN(score) ? 0 : score;
            });
            const sorted = [...allScores].sort((a, b) => a - b);
            const median = sorted[Math.floor(sorted.length / 2)];
            const stdDev = Math.sqrt(allScores.reduce((a, b) => a + Math.pow(b - schoolAvg, 2), 0) / allScores.length);
            const excellentCount = allScores.filter(s => s >= 80).length;
            const developingCount = allScores.filter(s => s < 50).length;

            const newReport = {
                id: Date.now(),
                header: `Strategic Academic Report - ${selectedTerm}`,
                schoolName: data.settings?.schoolName || 'School',
                academicYear: data.settings?.academicYear || '2025/2026',
                generatedDate: new Date().toLocaleDateString(),
                gradeGroup: gradeGroups[selectedGroup].label,

                executiveSummary: {
                    schoolAverage: schoolAvg,
                    totalAssessments,
                    totalStudents,
                    medianScore: median,
                    standardDeviation: stdDev.toFixed(2),
                    excellentPerformers: excellentCount,
                    developingLearners: developingCount
                },

                introduction: `This strategic academic report examines the performance of ${data.settings?.schoolName || 'the school'} for ${selectedTerm} (${data.settings?.academicYear || '2025/2026'}) across ${gradeGroups[selectedGroup].label}. The analysis synthesizes ${totalAssessments} assessments from ${totalStudents} students, providing data-driven insights for institutional improvement and strategic planning.`,

                body: {
                    overallPerformance: `The institution achieved an aggregate average score of ${schoolAvg}%, indicating ${schoolAvg >= 80 ? 'exceptional' : schoolAvg >= 70 ? 'strong' : schoolAvg >= 50 ? 'satisfactory' : 'developing'} overall academic performance. The median score of ${median}% and standard deviation of ${stdDev.toFixed(2)} suggest ${stdDev < 15 ? 'consistent' : 'variable'} performance across the student population.`,

                    subjectAnalysis: `Subject-level analysis reveals significant variation in performance. ${topSubject} leads with an average of ${stats.subjectAnalysis[0]?.avg || 0}%, while ${lowSubject} requires targeted intervention with ${stats.subjectAnalysis[stats.subjectAnalysis.length - 1]?.avg || 0}%. This ${Math.abs((stats.subjectAnalysis[0]?.avg || 0) - (stats.subjectAnalysis[stats.subjectAnalysis.length - 1]?.avg || 0))}% spread indicates subject-specific challenges that warrant differentiated support strategies.`,

                    teacherPerformance: `Educator analysis shows ${topTeacher} as the top performer with an average of ${stats.teacherAnalysis[0]?.avg || 0}%. Across all educators, consistency scores range from ${Math.min(...stats.teacherAnalysis.map(t => t.consistency))}% to ${Math.max(...stats.teacherAnalysis.map(t => t.consistency))}%, suggesting varying levels of assessment standardization and student engagement.`,

                    classAnalysis: `Class-level performance indicates ${stats.classAnalysis.length} distinct groups with averages ranging from ${Math.min(...stats.classAnalysis.map(c => c.avg))}% to ${Math.max(...stats.classAnalysis.map(c => c.avg))}%. This variation suggests the need for targeted class-specific interventions and peer learning opportunities.`,

                    performanceDistribution: `Performance distribution analysis reveals ${excellentCount} students (${Math.round(excellentCount / totalStudents * 100)}%) performing at excellence level (80%+), while ${developingCount} students (${Math.round(developingCount / totalStudents * 100)}%) require additional support. The concentration in the ${stats.performanceDistribution.reduce((max, d) => d.count > max.count ? d : max).label} range suggests a need for differentiated instruction.`
                },

                recommendations: [
                    `Focus targeted interventions on ${lowSubject} through specialized tutoring and curriculum review.`,
                    `Implement peer learning programs pairing high-performing students with those in the ${stats.performanceDistribution.reduce((max, d) => d.count > max.count ? d : max).label} range.`,
                    `Conduct professional development for educators to standardize assessment practices and improve consistency.`,
                    `Establish early warning systems to identify at-risk students before performance deteriorates further.`,
                    `Celebrate and replicate success factors from top-performing classes and subjects across the institution.`,
                    `Implement regular progress monitoring with quarterly reviews to track intervention effectiveness.`,
                    `Engage parents in student learning through transparent performance communication and collaborative goal-setting.`
                ],

                conclusion: `${data.settings?.schoolName || 'The school'} demonstrates ${schoolAvg >= 75 ? 'strong' : 'developing'} academic performance with clear opportunities for targeted improvement. By implementing data-driven interventions and leveraging educator expertise, the institution can elevate overall performance while ensuring equitable support for all learners.`
            };

            setReport(newReport);
            setReportHistory(prev => [newReport, ...prev].slice(0, 10));
        } catch (err) {
            console.error('Report generation error:', err);
            alert('Error generating report: ' + err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    if (report) {
        return html`
            <div class="space-y-6 animate-in fade-in duration-500">
                <div class="flex justify-between items-center mb-6 no-print">
                    <button
                        onClick=${() => setReport(null)}
                        class="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-800 rounded-xl font-bold text-sm hover:bg-slate-300 transition-all"
                    >
                        ← Back to Reports
                    </button>
                    <${PrintButtons} />
                </div>

                <div class="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-8 rounded-3xl text-white shadow-2xl">
                    <h1 class="text-4xl font-black mb-2">${report.header}</h1>
                    <p class="text-lg opacity-90">${report.schoolName} • ${report.academicYear}</p>
                    <p class="text-sm opacity-75 mt-2">Generated: ${report.generatedDate} • ${report.gradeGroup}</p>
                </div>

                <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="bg-white p-4 rounded-lg border border-slate-200">
                            <p class="text-xs font-black text-slate-500 uppercase mb-1">School Average</p>
                            <p class="text-2xl font-black text-emerald-600">${report.executiveSummary.schoolAverage}%</p>
                        </div>
                        <div class="bg-white p-4 rounded-lg border border-slate-200">
                            <p class="text-xs font-black text-slate-500 uppercase mb-1">Total Students</p>
                            <p class="text-2xl font-black text-teal-600">${report.executiveSummary.totalStudents}</p>
                        </div>
                        <div class="bg-white p-4 rounded-lg border border-slate-200">
                            <p class="text-xs font-black text-slate-500 uppercase mb-1">Assessments</p>
                            <p class="text-2xl font-black text-cyan-600">${report.executiveSummary.totalAssessments}</p>
                        </div>
                        <div class="bg-white p-4 rounded-lg border border-slate-200">
                            <p class="text-xs font-black text-slate-500 uppercase mb-1">Std Dev</p>
                            <p class="text-2xl font-black text-slate-600">${report.executiveSummary.standardDeviation}</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div class="bg-white p-4 rounded-lg border border-slate-200">
                            <p class="text-xs font-black text-slate-500 uppercase mb-1">Median</p>
                            <p class="text-2xl font-black text-slate-600">${report.executiveSummary.medianScore}%</p>
                        </div>
                        <div class="bg-white p-4 rounded-lg border border-slate-200">
                            <p class="text-xs font-black text-slate-500 uppercase mb-1">Excellent</p>
                            <p class="text-2xl font-black text-blue-600">${report.executiveSummary.excellentPerformers}</p>
                        </div>
                        <div class="bg-white p-4 rounded-lg border border-slate-200">
                            <p class="text-xs font-black text-slate-500 uppercase mb-1">Developing</p>
                            <p class="text-2xl font-black text-orange-600">${report.executiveSummary.developingLearners}</p>
                        </div>
                    </div>

                    <div class="space-y-4">
                        <div>
                            <h3 class="text-sm font-black text-slate-600 uppercase tracking-widest mb-2">Introduction</h3>
                            <p class="text-slate-700 leading-relaxed text-sm">${report.introduction}</p>
                        </div>

                        <div class="space-y-3 border-l-4 border-emerald-500 pl-4">
                            <div>
                                <h4 class="font-black text-slate-800 mb-1 text-sm">Overall Performance</h4>
                                <p class="text-slate-700 text-sm">${report.body.overallPerformance}</p>
                            </div>
                            <div>
                                <h4 class="font-black text-slate-800 mb-1 text-sm">Subject Analysis</h4>
                                <p class="text-slate-700 text-sm">${report.body.subjectAnalysis}</p>
                            </div>
                            <div>
                                <h4 class="font-black text-slate-800 mb-1 text-sm">Educator Performance</h4>
                                <p class="text-slate-700 text-sm">${report.body.teacherPerformance}</p>
                            </div>
                            <div>
                                <h4 class="font-black text-slate-800 mb-1 text-sm">Class Analysis</h4>
                                <p class="text-slate-700 text-sm">${report.body.classAnalysis}</p>
                            </div>
                            <div>
                                <h4 class="font-black text-slate-800 mb-1 text-sm">Performance Distribution</h4>
                                <p class="text-slate-700 text-sm">${report.body.performanceDistribution}</p>
                            </div>
                        </div>

                        <div class="bg-white p-4 rounded-lg border border-slate-200">
                            <h3 class="text-sm font-black text-slate-600 uppercase tracking-widest mb-3">Strategic Recommendations</h3>
                            <ul class="space-y-2">
                                ${report.recommendations.map((rec, i) => html`
                                    <li class="flex gap-3 text-sm">
                                        <span class="font-black text-emerald-600 flex-shrink-0">${i+1}.</span>
                                        <span class="text-slate-700">${rec}</span>
                                    </li>
                                `)}
                            </ul>
                        </div>

                        <div class="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
                            <h3 class="text-sm font-black text-slate-600 uppercase tracking-widest mb-2">Conclusion</h3>
                            <p class="text-slate-700 leading-relaxed text-sm">${report.conclusion}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    return html`
        <div class="space-y-6 animate-in fade-in duration-500">
            <div class="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden mb-8">
                <div class="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                <div class="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 rounded-full -ml-32 -mb-32 blur-3xl"></div>

                <div class="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div class="text-center md:text-left">
                        <div class="inline-block px-4 py-1 bg-emerald-500/20 rounded-full text-emerald-300 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Strategic Intelligence</div>
                        <h1 class="text-4xl md:text-5xl font-black tracking-tighter mb-2">Strategic Reports</h1>
                        <p class="text-emerald-100 font-medium max-w-md">AI-powered academic analysis and strategic planning for ${data.settings?.schoolName || 'Skyview School'}.</p>
                    </div>

                    <div class="flex flex-col items-center md:items-end gap-2">
                        <div class="text-6xl font-black text-white/20 select-none no-print">📜</div>
                        <div class="flex gap-2 no-print mt-4">
                            <button
                                onClick=${generateReport}
                                disabled=${isGenerating}
                                class="flex items-center gap-2 px-6 py-3 bg-white text-emerald-900 rounded-2xl font-black text-sm shadow-xl hover:bg-emerald-50 transition-all disabled:opacity-50"
                            >
                                <span>${isGenerating ? '⌛' : '✨'}</span>
                                ${isGenerating ? 'Generating...' : 'Generate Report'}
                            </button>
                            <${PrintButtons} />
                        </div>
                    </div>
                </div>
            </div>

            <div class="bg-white/80 backdrop-blur-md p-2 rounded-2xl border border-slate-100 shadow-sm sticky top-0 z-10 no-print">
                <div class="flex flex-wrap items-center gap-2">
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

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <h3 class="font-black text-slate-900 uppercase tracking-wider text-xs mb-4">Quick Stats</h3>
                    <div class="space-y-4">
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-slate-600">School Average</span>
                            <span class="text-2xl font-black text-emerald-600">${schoolAvg}%</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-slate-600">Total Students</span>
                            <span class="text-2xl font-black text-teal-600">${filteredData.students.length}</span>
                        </div>
                        <div class="flex justify-between items-center">
                            <span class="text-sm text-slate-600">Assessments</span>
                            <span class="text-2xl font-black text-cyan-600">${filteredData.assessments.length}</span>
                        </div>
                    </div>
                </div>

                <div class="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm md:col-span-2">
                    <h3 class="font-black text-slate-900 uppercase tracking-wider text-xs mb-4">Report History</h3>
                    ${reportHistory.length === 0 ? html`
                        <div class="text-center py-8 text-slate-400">
                            <p class="text-lg">No reports generated yet</p>
                            <p class="text-sm mt-2">Click "Generate Report" to create your first strategic analysis</p>
                        </div>
                    ` : html`
                        <div class="space-y-2 max-h-48 overflow-auto">
                            ${reportHistory.map((r, i) => html`
                                <div
                                    onClick=${() => setReport(r)}
                                    class="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 cursor-pointer transition-all"
                                >
                                    <div>
                                        <p class="font-bold text-sm text-slate-800">${r.header}</p>
                                        <p class="text-xs text-slate-500">${r.generatedDate} • ${r.gradeGroup}</p>
                                    </div>
                                    <span class="text-emerald-600">→</span>
                                </div>
                            `)}
                        </div>
                    `}
                </div>
            </div>

            <div class="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <h3 class="font-black text-slate-900 uppercase tracking-wider text-xs mb-4">How It Works</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="text-center">
                        <div class="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3">🎯</div>
                        <h4 class="font-bold text-slate-800 mb-2">Select Parameters</h4>
                        <p class="text-sm text-slate-600">Choose grade group and term for targeted analysis</p>
                    </div>
                    <div class="text-center">
                        <div class="w-16 h-16 bg-teal-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3">🤖</div>
                        <h4 class="font-bold text-slate-800 mb-2">AI Analysis</h4>
                        <p class="text-sm text-slate-600">System analyzes performance data and generates insights</p>
                    </div>
                    <div class="text-center">
                        <div class="w-16 h-16 bg-cyan-100 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3">📊</div>
                        <h4 class="font-bold text-slate-800 mb-2">Strategic Report</h4>
                        <p class="text-sm text-slate-600">View detailed report with recommendations</p>
                    </div>
                </div>
            </div>
        </div>
    `;
};

export default StrategicReports;
