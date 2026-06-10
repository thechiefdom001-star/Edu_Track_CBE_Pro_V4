import { h } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import htm from 'htm';
import { PrintButtons } from './PrintButtons.js';

const html = htm.bind(h);

export const Presentation = ({ data }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [slides, setSlides] = useState([]);
    const [isRegenerating, setIsRegenerating] = useState(false);
    const settings = data.settings || {};

    const stats = useMemo(() => {
        const assessments = data.assessments || [];
        const students = data.students || [];
        const teachers = data.teachers || [];

        const subjects = [...new Set(assessments.map(a => a.subject))];
        const subjectAnalysis = subjects.map(subject => {
            const subjectAssessments = assessments.filter(a => a.subject === subject);
            const scores = subjectAssessments.map(a => {
                let score = Number(a.score);
                if (isNaN(score) && a.rawScore !== undefined && a.maxScore) {
                    score = Math.round((Number(a.rawScore) / Number(a.maxScore)) * 100);
                }
                return isNaN(score) ? 0 : score;
            });
            const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
            const count = subjectAssessments.length;
            return { subject, avg, count };
        }).sort((a, b) => b.avg - a.avg);

        const schoolAvg = subjectAnalysis.length > 0
            ? Math.round(subjectAnalysis.reduce((a, b) => a + b.avg, 0) / subjectAnalysis.length)
            : 0;

        // Calculate grade distribution
        const grades = [...new Set(students.map(s => s.grade))];
        const gradeDistribution = grades.map(grade => {
            const gradeStudents = students.filter(s => s.grade === grade);
            const gradeAssessments = assessments.filter(a => a.grade === grade);
            const scores = gradeAssessments.map(a => {
                let score = Number(a.score);
                if (isNaN(score) && a.rawScore !== undefined && a.maxScore) {
                    score = Math.round((Number(a.rawScore) / Number(a.maxScore)) * 100);
                }
                return isNaN(score) ? 0 : score;
            });
            const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
            return { grade, count: gradeStudents.length, avg };
        });

        // Calculate performance ranges
        const allScores = assessments.map(a => {
            let score = Number(a.score);
            if (isNaN(score) && a.rawScore !== undefined && a.maxScore) {
                score = Math.round((Number(a.rawScore) / Number(a.maxScore)) * 100);
            }
            return isNaN(score) ? 0 : score;
        });
        const excellent = allScores.filter(s => s >= 80).length;
        const good = allScores.filter(s => s >= 60 && s < 80).length;
        const satisfactory = allScores.filter(s => s >= 40 && s < 60).length;
        const needsImprovement = allScores.filter(s => s < 40).length;

        return {
            schoolAvg,
            topSubjects: subjectAnalysis.slice(0, 5),
            totalStudents: students.length,
            totalAssessments: assessments.length,
            totalTeachers: teachers.length,
            gradeDistribution,
            performanceRanges: { excellent, good, satisfactory, needsImprovement },
            totalScores: allScores.length
        };
    }, [data]);

    const generateSlides = () => {
        const newSlides = [
            {
                title: "Strategic Performance Review",
                subtitle: settings.schoolName || "School Academic Analysis",
                content: html`
                    <div class="flex flex-col items-center justify-center h-full text-center space-y-6 relative overflow-hidden">
                        <div class="absolute inset-0 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 opacity-50"></div>
                        <div class="relative z-10">
                            <div class="w-40 h-40 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl flex items-center justify-center text-7xl shadow-2xl mb-6 animate-pulse">🏫</div>
                            <h1 class="text-7xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tighter mb-4">${settings.schoolName || "SKYVIEW SCHOOL"}</h1>
                            <p class="text-3xl font-bold text-slate-600 uppercase tracking-widest mb-6">Academic Year ${settings.academicYear || "2025/2026"}</p>
                            <div class="flex gap-8 justify-center mt-8">
                                <div class="text-center">
                                    <p class="text-4xl font-black text-indigo-600">${stats.totalStudents}</p>
                                    <p class="text-sm font-bold text-slate-500 uppercase">Students</p>
                                </div>
                                <div class="text-center">
                                    <p class="text-4xl font-black text-purple-600">${stats.totalTeachers}</p>
                                    <p class="text-sm font-bold text-slate-500 uppercase">Teachers</p>
                                </div>
                                <div class="text-center">
                                    <p class="text-4xl font-black text-pink-600">${stats.schoolAvg}%</p>
                                    <p class="text-sm font-bold text-slate-500 uppercase">Avg Score</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `
            },
            {
                title: "Executive Summary",
                subtitle: "Key Performance Indicators",
                content: html`
                    <div class="grid grid-cols-2 gap-8 h-full">
                        <div class="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-12 text-white flex flex-col justify-center shadow-2xl relative overflow-hidden">
                            <div class="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                            <div class="relative z-10">
                                <p class="text-sm font-black uppercase tracking-widest opacity-80 mb-4">School Mean Score</p>
                                <div class="flex items-baseline gap-3">
                                    <span class="text-9xl font-black">${stats.schoolAvg}</span>
                                    <span class="text-4xl font-bold opacity-60">%</span>
                                </div>
                                <p class="mt-8 text-lg opacity-90 leading-relaxed">Aggregate performance across all academic departments and student cohorts.</p>
                                <div class="mt-6 pt-6 border-t border-white/20">
                                    <p class="text-sm opacity-75">Based on ${stats.totalAssessments} assessments from ${stats.totalStudents} students</p>
                                </div>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-6">
                            <div class="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-3xl p-8 shadow-lg flex flex-col items-center justify-center text-center">
                                <div class="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-4xl mb-4 shadow-lg">👥</div>
                                <p class="text-xs font-black text-blue-400 uppercase tracking-widest mb-2">Total Enrollment</p>
                                <p class="text-5xl font-black text-blue-700">${stats.totalStudents}</p>
                            </div>
                            <div class="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-3xl p-8 shadow-lg flex flex-col items-center justify-center text-center">
                                <div class="w-20 h-20 bg-purple-600 rounded-2xl flex items-center justify-center text-4xl mb-4 shadow-lg">👨‍🏫</div>
                                <p class="text-xs font-black text-purple-400 uppercase tracking-widest mb-2">Teaching Staff</p>
                                <p class="text-5xl font-black text-purple-700">${stats.totalTeachers}</p>
                            </div>
                            <div class="bg-gradient-to-br from-pink-50 to-pink-100 border-2 border-pink-200 rounded-3xl p-8 shadow-lg flex flex-col items-center justify-center text-center">
                                <div class="w-20 h-20 bg-pink-600 rounded-2xl flex items-center justify-center text-4xl mb-4 shadow-lg">📝</div>
                                <p class="text-xs font-black text-pink-400 uppercase tracking-widest mb-2">Assessments</p>
                                <p class="text-5xl font-black text-pink-700">${stats.totalAssessments}</p>
                            </div>
                            <div class="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-3xl p-8 shadow-lg flex flex-col items-center justify-center text-center">
                                <div class="w-20 h-20 bg-emerald-600 rounded-2xl flex items-center justify-center text-4xl mb-4 shadow-lg">📊</div>
                                <p class="text-xs font-black text-emerald-400 uppercase tracking-widest mb-2">Subjects</p>
                                <p class="text-5xl font-black text-emerald-700">${stats.topSubjects.length}</p>
                            </div>
                        </div>
                    </div>
                `
            },
            {
                title: "Subject Performance Analysis",
                subtitle: "Academic Excellence by Department",
                content: html`
                    <div class="space-y-6 h-full flex flex-col justify-center">
                        <div class="grid grid-cols-2 gap-6 mb-6">
                            ${stats.topSubjects.slice(0, 2).map((s, i) => html`
                                <div class="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 rounded-2xl p-6 shadow-lg">
                                    <div class="flex justify-between items-center mb-3">
                                        <span class="text-xl font-black text-slate-800">${s.subject}</span>
                                        <span class="text-3xl font-black text-indigo-600">${s.avg}%</span>
                                    </div>
                                    <div class="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
                                        <div class="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full transition-all duration-1000" style="width: ${s.avg}%"></div>
                                    </div>
                                    <p class="text-xs text-slate-500 mt-2">${s.count} assessments</p>
                                </div>
                            `)}
                        </div>
                        <div class="grid grid-cols-3 gap-4">
                            ${stats.topSubjects.slice(2, 5).map((s, i) => html`
                                <div class="bg-white border-2 border-slate-200 rounded-xl p-4 shadow-md">
                                    <p class="text-sm font-bold text-slate-800 mb-2">${s.subject}</p>
                                    <p class="text-2xl font-black text-indigo-600">${s.avg}%</p>
                                    <div class="h-2 w-full bg-slate-200 rounded-full overflow-hidden mt-2">
                                        <div class="h-full bg-indigo-600 rounded-full" style="width: ${s.avg}%"></div>
                                    </div>
                                </div>
                            `)}
                        </div>
                        <div class="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 rounded-2xl text-white shadow-xl">
                            <p class="text-sm font-bold opacity-90 mb-2">INSIGHT</p>
                            <p class="text-lg leading-relaxed">Top performing subjects demonstrate exceptional instructional consistency and student engagement, serving as benchmarks for institutional excellence.</p>
                        </div>
                    </div>
                `
            },
            {
                title: "Grade Level Performance",
                subtitle: "Distribution by Academic Level",
                content: html`
                    <div class="h-full flex flex-col justify-center">
                        <div class="grid grid-cols-3 gap-4 mb-6">
                            ${stats.gradeDistribution.slice(0, 6).map((g, i) => html`
                                <div class="bg-white border-2 ${g.avg >= 70 ? 'border-emerald-300' : g.avg >= 50 ? 'border-blue-300' : 'border-orange-300'} rounded-xl p-4 shadow-md">
                                    <p class="text-xs font-black text-slate-500 uppercase mb-1">${g.grade}</p>
                                    <p class="text-3xl font-black ${g.avg >= 70 ? 'text-emerald-600' : g.avg >= 50 ? 'text-blue-600' : 'text-orange-600'}">${g.avg}%</p>
                                    <p class="text-xs text-slate-400 mt-1">${g.count} students</p>
                                </div>
                            `)}
                        </div>
                        <div class="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-6 border-2 border-slate-200">
                            <h4 class="font-black text-slate-800 mb-4 text-sm uppercase tracking-wider">Performance Distribution</h4>
                            <div class="grid grid-cols-4 gap-4">
                                <div class="text-center">
                                    <div class="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-2xl font-black text-white mx-auto mb-2 shadow-lg">🌟</div>
                                    <p class="text-2xl font-black text-emerald-600">${stats.performanceRanges.excellent}</p>
                                    <p class="text-xs text-slate-500 uppercase">Excellent</p>
                                </div>
                                <div class="text-center">
                                    <div class="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-2xl font-black text-white mx-auto mb-2 shadow-lg">👍</div>
                                    <p class="text-2xl font-black text-blue-600">${stats.performanceRanges.good}</p>
                                    <p class="text-xs text-slate-500 uppercase">Good</p>
                                </div>
                                <div class="text-center">
                                    <div class="w-16 h-16 bg-yellow-500 rounded-full flex items-center justify-center text-2xl font-black text-white mx-auto mb-2 shadow-lg">📈</div>
                                    <p class="text-2xl font-black text-yellow-600">${stats.performanceRanges.satisfactory}</p>
                                    <p class="text-xs text-slate-500 uppercase">Satisfactory</p>
                                </div>
                                <div class="text-center">
                                    <div class="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center text-2xl font-black text-white mx-auto mb-2 shadow-lg">🎯</div>
                                    <p class="text-2xl font-black text-orange-600">${stats.performanceRanges.needsImprovement}</p>
                                    <p class="text-xs text-slate-500 uppercase">Needs Work</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `
            },
            {
                title: "Strategic Objectives",
                subtitle: "Path to Academic Advancement",
                content: html`
                    <div class="grid grid-cols-2 gap-6 h-full">
                        <div class="space-y-4">
                            <div class="bg-gradient-to-r from-indigo-50 to-indigo-100 border-l-4 border-indigo-600 rounded-r-2xl p-6 shadow-lg">
                                <h4 class="font-black text-indigo-900 mb-2 flex items-center gap-2">
                                    <span class="text-2xl">🎯</span> Differentiated Instruction
                                </h4>
                                <p class="text-sm text-indigo-700">Tailoring pedagogical approaches to individual student learning profiles for maximum impact.</p>
                            </div>
                            <div class="bg-gradient-to-r from-purple-50 to-purple-100 border-l-4 border-purple-600 rounded-r-2xl p-6 shadow-lg">
                                <h4 class="font-black text-purple-900 mb-2 flex items-center gap-2">
                                    <span class="text-2xl">📊</span> Data-Driven Intervention
                                </h4>
                                <p class="text-sm text-purple-700">Utilizing real-time analytics to identify and support at-risk learners before performance declines.</p>
                            </div>
                        </div>
                        <div class="space-y-4">
                            <div class="bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-600 rounded-r-2xl p-6 shadow-lg">
                                <h4 class="font-black text-blue-900 mb-2 flex items-center gap-2">
                                    <span class="text-2xl">🤝</span> Educator Collaboration
                                </h4>
                                <p class="text-sm text-blue-700">Fostering cross-departmental knowledge transfer and peer observation for continuous improvement.</p>
                            </div>
                            <div class="bg-gradient-to-r from-pink-50 to-pink-100 border-l-4 border-pink-600 rounded-r-2xl p-6 shadow-lg">
                                <h4 class="font-black text-pink-900 mb-2 flex items-center gap-2">
                                    <span class="text-2xl">👨‍👩‍👧</span> Parental Engagement
                                </h4>
                                <p class="text-sm text-pink-700">Strengthening the home-school partnership through transparent communication and collaborative goal-setting.</p>
                            </div>
                        </div>
                    </div>
                `
            }
        ];
        setSlides(newSlides);
        setCurrentSlide(0);
    };

    useEffect(() => {
        generateSlides();
    }, [data]);

    const regenerateSlides = () => {
        setIsRegenerating(true);
        setTimeout(() => {
            generateSlides();
            setIsRegenerating(false);
        }, 500);
    };

    const nextSlide = () => setCurrentSlide(prev => (prev + 1) % slides.length);
    const prevSlide = () => setCurrentSlide(prev => (prev - 1 + slides.length) % slides.length);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight' || e.key === ' ') nextSlide();
            if (e.key === 'ArrowLeft') prevSlide();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return html`
        <div class="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50 to-purple-50 p-4 md:p-8 flex flex-col">
            <div class="flex justify-between items-center mb-8 no-print">
                <div>
                    <h2 class="text-3xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent tracking-tight">AI-Generated Presentation</h2>
                    <p class="text-slate-500 font-medium">Dynamic Strategic Review • Auto-updates with new data</p>
                </div>
                <div class="flex gap-3">
                    <button
                        onClick=${regenerateSlides}
                        disabled=${isRegenerating}
                        class="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-2xl font-bold text-sm shadow-xl hover:shadow-2xl transition-all disabled:opacity-50"
                    >
                        <span>${isRegenerating ? '⌛' : '✨'}</span>
                        ${isRegenerating ? 'Regenerating...' : 'Regenerate Slides'}
                    </button>
                    <button
                        onClick=${() => window.print()}
                        class="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl hover:bg-slate-800 transition-all"
                    >
                        <span>🖨️</span> Print
                    </button>
                    <${PrintButtons} />
                </div>
            </div>

            <div class="flex-1 flex flex-col items-center justify-center max-w-7xl mx-auto w-full">
                ${slides.length === 0 ? html`
                    <div class="text-center">
                        <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto"></div>
                        <p class="mt-4 text-slate-600 font-medium">Generating presentation...</p>
                    </div>
                ` : html`
                    <!-- Slide Container -->
                    <div class="w-full aspect-[16/9] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col relative print:shadow-none print:border-none print:m-0 print:rounded-none">
                        <!-- Slide Header -->
                        <div class="p-10 pb-0 flex justify-between items-start bg-gradient-to-r from-slate-50 to-white">
                            <div>
                                <h3 class="text-xs font-black text-indigo-600 uppercase tracking-[0.3em] mb-2">${slides[currentSlide].subtitle}</h3>
                                <h2 class="text-4xl font-black bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent tracking-tight">${slides[currentSlide].title}</h2>
                            </div>
                            <div class="text-right no-print">
                                <span class="text-5xl font-black text-indigo-100">${currentSlide + 1}</span>
                                <span class="text-2xl font-black text-indigo-200">/${slides.length}</span>
                            </div>
                        </div>

                        <!-- Slide Content -->
                        <div class="flex-1 p-10 pt-6 bg-gradient-to-b from-white to-slate-50">
                            ${slides[currentSlide].content}
                        </div>

                        <!-- Slide Footer -->
                        <div class="p-6 pt-0 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg">S</div>
                                <span class="text-xs font-black text-slate-400 uppercase tracking-widest">${settings.schoolName || "SKYVIEW SCHOOL"}</span>
                            </div>
                            <div class="text-[10px] font-black text-slate-300 uppercase tracking-widest">AI-GENERATED • ${new Date().toLocaleDateString()}</div>
                        </div>

                        <!-- Navigation Controls (Floating) -->
                        <div class="absolute bottom-10 right-10 flex gap-2 no-print">
                            <button
                                onClick=${prevSlide}
                                class="w-14 h-14 bg-white/90 backdrop-blur shadow-xl border-2 border-slate-200 rounded-2xl flex items-center justify-center text-slate-600 hover:bg-white hover:border-indigo-300 transition-all text-xl font-bold"
                            >←</button>
                            <button
                                onClick=${nextSlide}
                                class="w-14 h-14 bg-gradient-to-r from-indigo-600 to-purple-600 shadow-xl shadow-indigo-200 rounded-2xl flex items-center justify-center text-white hover:shadow-2xl transition-all text-xl font-bold"
                            >→</button>
                        </div>
                    </div>

                    <!-- Slide Progress Indicator -->
                    <div class="mt-8 flex gap-2 no-print">
                        ${slides.map((_, i) => html`
                            <button
                                onClick=${() => setCurrentSlide(i)}
                                class=${`h-2 rounded-full transition-all ${currentSlide === i ? 'w-16 bg-gradient-to-r from-indigo-600 to-purple-600' : 'w-4 bg-slate-300 hover:bg-slate-400'}`}
                            ></button>
                        `)}
                    </div>
                `}
            </div>

            <!-- Print View Helper (Hidden on screen) -->
            <div class="hidden print:block space-y-0">
                ${slides.map((slide, i) => html`
                    <div class="w-full h-screen bg-white p-16 flex flex-col break-after-page">
                        <div class="flex justify-between items-start mb-12">
                            <div>
                                <h3 class="text-sm font-black text-indigo-600 uppercase tracking-[0.3em] mb-2">${slide.subtitle}</h3>
                                <h2 class="text-5xl font-black text-slate-900 tracking-tight">${slide.title}</h2>
                            </div>
                            <span class="text-5xl font-black text-slate-100">${i + 1}</span>
                        </div>
                        <div class="flex-1">
                            ${slide.content}
                        </div>
                        <div class="flex justify-between items-center mt-12 pt-8 border-t border-slate-100">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold">S</div>
                                <span class="text-sm font-black text-slate-400 uppercase tracking-widest">${settings.schoolName || "SKYVIEW SCHOOL"}</span>
                            </div>
                            <div class="text-xs font-black text-slate-300 uppercase tracking-widest">AI-GENERATED • ${new Date().toLocaleDateString()}</div>
                        </div>
                    </div>
                `)}
            </div>
        </div>
    `;
};
