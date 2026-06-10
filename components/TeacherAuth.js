import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import htm from 'htm';
import { googleSheetSync } from '../lib/googleSheetSync.js';

const html = htm.bind(h);

const normalizeList = (value) => {
    if (!value) return '';

    const seen = new Set();
    return String(value)
        .split(',')
        .map(item => item.trim())
        .filter(item => {
            const normalized = item.toLowerCase();
            if (!normalized || seen.has(normalized)) return false;
            seen.add(normalized);
            return true;
        })
        .join(', ');
};

const buildTeacherSyncPayload = (teacher) => ({
    id: teacher.id,
    name: teacher.name || '',
    contact: teacher.contact || '',
    subjects: teacher.subjects || '',
    grades: teacher.grades || '',
    employeeNo: teacher.employeeNo || '',
    nssfNo: teacher.nssfNo || '',
    shifNo: teacher.shifNo || '',
    taxNo: teacher.taxNo || '',
    isClassTeacher: !!teacher.isClassTeacher,
    classTeacherGrade: teacher.classTeacherGrade || ''
});

export const TeacherAuth = ({ settings, data = {}, setData = () => {}, onLogin, onClose }) => {
    const [mode, setMode] = useState('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('teacher');
    const [subjects, setSubjects] = useState('');
    const [grades, setGrades] = useState('');
    const [classTeacherGrade, setClassTeacherGrade] = useState('');
    const [religion, setReligion] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    
    // Grade-based subjects mapping
    const gradeSubjects = {
        'BABY CLASS': ['Mathematics activities', 'Language activities', 'Literacy', 'Kiswahili', 'Environmental Activities', 'Creative Activities', 'Religious Education Activities'],
        'PP1': ['Mathematics activities', 'Language activities', 'Literacy', 'Kiswahili', 'Environmental Activities', 'Creative Activities', 'Religious Education Activities'],
        'PP2': ['Mathematics activities', 'Language activities', 'Literacy', 'Kiswahili', 'Environmental Activities', 'Creative Activities', 'Religious Education Activities'],
        'GRADE 1': ['INDIGENOUS LANGUAGE ACTIVITIES', 'KISWAHILI/KSL ACTIVITIES', 'ENGLISH LANGUAGE ACTIVITIES', 'MATHEMATIC ACTIVITIES', 'RELIGIOUS EDUCATION ACTIVITIES', 'ENVIRONMENTAL ACTIVITIES', 'CREATIVE ART ACTIVITIES'],
        'GRADE 2': ['INDIGENOUS LANGUAGE ACTIVITIES', 'KISWAHILI/KSL ACTIVITIES', 'ENGLISH LANGUAGE ACTIVITIES', 'MATHEMATIC ACTIVITIES', 'RELIGIOUS EDUCATION ACTIVITIES', 'ENVIRONMENTAL ACTIVITIES', 'CREATIVE ART ACTIVITIES'],
        'GRADE 3': ['INDIGENOUS LANGUAGE ACTIVITIES', 'KISWAHILI/KSL ACTIVITIES', 'ENGLISH LANGUAGE ACTIVITIES', 'MATHEMATIC ACTIVITIES', 'RELIGIOUS EDUCATION ACTIVITIES', 'ENVIRONMENTAL ACTIVITIES', 'CREATIVE ART ACTIVITIES'],
        'GRADE 4': ['ENGLISH', 'KISWAHILI/KSL', 'MATHEMATICS', 'AGRICULTURE', 'SOCIAL STUDIES', 'RELIGIOUS EDUCATION', 'CREATIVE ARTS', 'SCIENCE & TECHNOLOGY'],
        'GRADE 5': ['ENGLISH', 'KISWAHILI/KSL', 'MATHEMATICS', 'AGRICULTURE', 'SOCIAL STUDIES', 'RELIGIOUS EDUCATION', 'CREATIVE ARTS', 'SCIENCE & TECHNOLOGY'],
        'GRADE 6': ['ENGLISH', 'KISWAHILI/KSL', 'MATHEMATICS', 'AGRICULTURE', 'SOCIAL STUDIES', 'RELIGIOUS EDUCATION', 'CREATIVE ARTS', 'SCIENCE & TECHNOLOGY'],
        'GRADE 7': ['ENGLISH', 'MATHEMATICS', 'KISWAHILI/KSL', 'SOCIAL STUDIES', 'PRE-TECHNICAL STUDIES', 'CREATIVE ARTS & SPORTS', 'AGRICULTURE & NUTRITION', 'INTEGRATED SCIENCE', 'RELIGIOUS EDUCATION'],
        'GRADE 8': ['ENGLISH', 'MATHEMATICS', 'KISWAHILI/KSL', 'SOCIAL STUDIES', 'PRE-TECHNICAL STUDIES', 'CREATIVE ARTS & SPORTS', 'AGRICULTURE & NUTRITION', 'INTEGRATED SCIENCE', 'RELIGIOUS EDUCATION'],
        'GRADE 9': ['ENGLISH', 'MATHEMATICS', 'KISWAHILI/KSL', 'SOCIAL STUDIES', 'PRE-TECHNICAL STUDIES', 'CREATIVE ARTS & SPORTS', 'AGRICULTURE & NUTRITION', 'INTEGRATED SCIENCE', 'RELIGIOUS EDUCATION'],
        'GRADE 10': ['English', 'Kiswahili', 'Mathematics', 'CSL', 'Biology', 'Chemistry', 'Physics', 'Agriculture', 'Computer Studies', 'History and Citizenship', 'Geography', 'CRE', 'IRE', 'Accounting', 'Economics', 'Fine Arts', 'Music and Dance', 'Sports Science', 'Business Studies'],
        'GRADE 11': ['English', 'Kiswahili', 'Mathematics', 'CSL', 'Biology', 'Chemistry', 'Physics', 'Agriculture', 'Computer Studies', 'History and Citizenship', 'Geography', 'CRE', 'IRE', 'Accounting', 'Economics', 'Fine Arts', 'Music and Dance', 'Sports Science', 'Business Studies'],
        'GRADE 12': ['English', 'Kiswahili', 'Mathematics', 'CSL', 'Biology', 'Chemistry', 'Physics', 'Agriculture', 'Computer Studies', 'History and Citizenship', 'Geography', 'CRE', 'IRE', 'Accounting', 'Economics', 'Fine Arts', 'Music and Dance', 'Sports Science', 'Business Studies']
    };
    
    const allGrades = ['BABY CLASS', 'PP1', 'PP2', 'GRADE 1', 'GRADE 2', 'GRADE 3', 'GRADE 4', 'GRADE 5', 'GRADE 6', 'GRADE 7', 'GRADE 8', 'GRADE 9', 'GRADE 10', 'GRADE 11', 'GRADE 12'];
    
    // Get available subjects based on selected grades
    const getAvailableSubjects = () => {
        const selectedGrades = grades.split(',').map(g => g.trim()).filter(g => g);
        const availableSubjects = new Set();
        
        selectedGrades.forEach(grade => {
            const normalizedGrade = allGrades.find(g => grade.toUpperCase() === g) || grade;
            if (gradeSubjects[normalizedGrade]) {
                gradeSubjects[normalizedGrade].forEach(s => availableSubjects.add(s));
            }
        });
        
        return Array.from(availableSubjects).sort();
    };
    
    const availableSubjectList = grades ? getAvailableSubjects() : [];

    useEffect(() => {
        if (settings?.googleScriptUrl) {
            googleSheetSync.setSettings(settings);
        }
    }, [settings]);

    const buildTeacherProfile = (teacherSeed = {}) => {
        const normalizedUsername = (teacherSeed.username || '').trim().toLowerCase();
        const normalizedName = (teacherSeed.name || teacherSeed.username || '').trim();
        const normalizedSubjects = normalizeList(teacherSeed.subjects);
        const normalizedGrades = normalizeList(teacherSeed.grades);
        const normalizedClassTeacherGrade = (teacherSeed.classTeacherGrade || '').trim();
        const normalizedReligion = (teacherSeed.religion || '').trim();
        const normalizedRole = (teacherSeed.role || 'teacher').trim();
        const currentTeachers = Array.isArray(data.teachers) ? data.teachers : [];

        const existingTeacher = currentTeachers.find(teacher => {
            const teacherUsername = (teacher.username || '').trim().toLowerCase();
            const teacherName = (teacher.name || '').trim().toLowerCase();

            return (
                (normalizedUsername && teacherUsername === normalizedUsername) ||
                (normalizedName && teacherName === normalizedName.toLowerCase())
            );
        });

        return {
            id: existingTeacher?.id || teacherSeed.teacherId || `T-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            username: normalizedUsername || existingTeacher?.username || '',
            name: normalizedName || existingTeacher?.name || '',
            contact: existingTeacher?.contact || '',
            subjects: normalizedSubjects || existingTeacher?.subjects || '',
            grades: normalizedGrades || existingTeacher?.grades || '',
            employeeNo: existingTeacher?.employeeNo || '',
            nssfNo: existingTeacher?.nssfNo || '',
            shifNo: existingTeacher?.shifNo || '',
            taxNo: existingTeacher?.taxNo || '',
            isClassTeacher: normalizedRole === 'class_teacher',
            classTeacherGrade: normalizedClassTeacherGrade || existingTeacher?.classTeacherGrade || '',
            role: normalizedRole || existingTeacher?.role || 'teacher',
            religion: normalizedReligion || existingTeacher?.religion || ''
        };
    };

    const upsertTeacherProfile = async (teacherSeed = {}, { syncToGoogle = false } = {}) => {
        const teacherProfile = buildTeacherProfile(teacherSeed);
        const currentTeachers = Array.isArray(data.teachers) ? data.teachers : [];
        const nextTeachers = (() => {
            const existingIndex = currentTeachers.findIndex(teacher => String(teacher.id) === String(teacherProfile.id));
            if (existingIndex >= 0) {
                return currentTeachers.map(teacher => String(teacher.id) === String(teacherProfile.id) ? teacherProfile : teacher);
            }
            return [...currentTeachers, teacherProfile];
        })();

        setData(prev => ({
            ...prev,
            teachers: nextTeachers
        }));

        let syncResult = null;
        if (syncToGoogle && settings?.googleScriptUrl) {
            googleSheetSync.setSettings(settings);
            syncResult = currentTeachers.some(teacher => String(teacher.id) === String(teacherProfile.id))
                ? await googleSheetSync.updateTeacher(buildTeacherSyncPayload(teacherProfile))
                : await googleSheetSync.pushTeacher(buildTeacherSyncPayload(teacherProfile));
        }

        return { teacherProfile, syncResult };
    };

    const saveTeacherCredentials = (teacherSeed = {}) => {
        const normalizedUsername = (teacherSeed.username || '').trim().toLowerCase();
        if (!normalizedUsername) return;

        const existingCreds = JSON.parse(localStorage.getItem('et_teacher_credentials') || '[]');
        const nextCreds = existingCreds.filter(cred => cred.username !== normalizedUsername);

        nextCreds.push({
            username: normalizedUsername,
            password: teacherSeed.password || '',
            name: (teacherSeed.name || teacherSeed.username || '').trim(),
            role: teacherSeed.role || 'teacher',
            subjects: normalizeList(teacherSeed.subjects),
            grades: normalizeList(teacherSeed.grades),
            classTeacherGrade: (teacherSeed.classTeacherGrade || '').trim(),
            religion: (teacherSeed.religion || '').trim()
        });

        localStorage.setItem('et_teacher_credentials', JSON.stringify(nextCreds));
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!username || !password) {
            setError('Please enter username and password');
            return;
        }

        setLoading(true);

        try {
            const result = await googleSheetSync.loginTeacher(username, password);

            if (result.success) {
                setSuccess('Login successful!');
                
                const teacherData = {
                    username: result.username,
                    name: result.name || result.username,
                    teacherId: result.teacherId,
                    role: result.role || 'teacher',
                    subjects: result.subjects || '',
                    grades: result.grades || '',
                    classTeacherGrade: result.classTeacherGrade || '',
                    religion: result.religion || '',
                    isTeacher: true
                };

                await upsertTeacherProfile(teacherData);

                localStorage.setItem('et_teacher_session', JSON.stringify(teacherData));
                
                setTimeout(() => {
                    onLogin(teacherData);
                }, 500);
            } else {
                setError(result.error || 'Invalid username or password');
            }
        } catch (err) {
            setError('Login failed. Please try again.');
            console.error('Login error:', err);
        }

        setLoading(false);
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!username || !password) {
            setError('Please enter username and password');
            return;
        }

        if (password.length < 4) {
            setError('Password must be at least 4 characters');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            const teacherSeed = {
                username,
                password,
                name: name || username,
                role,
                subjects,
                grades,
                classTeacherGrade,
                religion
            };

            let authResult = { success: false, error: 'Google Sheet not configured' };
            if (settings?.googleScriptUrl) {
                authResult = await googleSheetSync.registerTeacher(
                    username,
                    password,
                    '',
                    name || username,
                    role,
                    subjects,
                    grades,
                    classTeacherGrade,
                    religion
                );
            }

            saveTeacherCredentials(teacherSeed);
            const { syncResult } = await upsertTeacherProfile(teacherSeed, { syncToGoogle: !!settings?.googleScriptUrl });

            const registrySaved = !syncResult || syncResult.success;
            if (authResult.success && registrySaved) {
                setSuccess('Account created and teacher profile added to the Teachers table. You can now login.');
            } else if (registrySaved) {
                setSuccess('Account saved locally and teacher profile added to the Teachers table. You can now login.');
            } else {
                setSuccess('Account created locally. The teacher profile was saved here but Google sync needs retrying from the Teachers table.');
            }

            setMode('login');
            setPassword('');
            setConfirmPassword('');
        } catch (err) {
            const teacherSeed = {
                username,
                password,
                name: name || username,
                role,
                subjects,
                grades,
                classTeacherGrade,
                religion
            };

            saveTeacherCredentials(teacherSeed);
            await upsertTeacherProfile(teacherSeed);
            setSuccess('Account saved locally and teacher profile added to the Teachers table. You can now login.');
            setMode('login');
            setPassword('');
            setConfirmPassword('');
        }

        setLoading(false);
    };

    const switchMode = (newMode) => {
        setMode(newMode);
        setError('');
        setSuccess('');
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setName('');
        setSubjects('');
        setGrades('');
        setClassTeacherGrade('');
        setReligion('');
    };

    return html`
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-y-auto max-h-[90vh]">
                
                <div class="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white text-center">
                    <div class="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span class="text-3xl">👩‍🏫</span>
                    </div>
                    <h2 class="text-xl font-bold">Teacher Portal</h2>
                    <p class="text-blue-100 text-sm mt-1">
                        ${mode === 'login' ? 'Sign in to your account' : 'Create your account'}
                    </p>
                </div>

                
                <div class="p-6">
                    ${error && html`
                        <div class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                            <span class="font-bold">Error:</span> ${error}
                        </div>
                    `}

                    ${success && html`
                        <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
                            <span class="font-bold">Success:</span> ${success}
                        </div>
                    `}

                    ${mode === 'login' ? html`
                        <form onSubmit=${handleLogin} class="space-y-4">
                            <div>
                                <label class="block text-sm font-bold text-slate-600 mb-1">Username</label>
                                <input
                                    type="text"
                                    value=${username}
                                    onInput=${e => setUsername(e.target.value)}
                                    placeholder="Enter your username"
                                    class="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-bold text-slate-600 mb-1">Password</label>
                                <div class="relative">
                                    <input
                                        type=${showPassword ? 'text' : 'password'}
                                        value=${password}
                                        onInput=${e => setPassword(e.target.value)}
                                        placeholder="Enter your password"
                                        class="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick=${() => setShowPassword(!showPassword)}
                                        class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        ${showPassword ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled=${loading}
                                class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
                            >
                                ${loading ? 'Signing in...' : 'Sign In'}
                            </button>
                        </form>

                        <div class="mt-4 text-center">
                            <p class="text-sm text-slate-500">
                                Don't have an account?
                                <button
                                    onClick=${() => switchMode('register')}
                                    class="text-blue-600 hover:text-blue-700 font-bold"
                                >
                                    Register here
                                </button>
                            </p>
                        </div>
                    ` : html`
                        <form onSubmit=${handleRegister} class="space-y-4">
                            <div>
                                <label class="block text-sm font-bold text-slate-600 mb-1">Your Name</label>
                                <input
                                    type="text"
                                    value=${name}
                                    onInput=${e => setName(e.target.value)}
                                    placeholder="Enter your full name"
                                    class="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-bold text-slate-600 mb-1">Username (login name)</label>
                                <input
                                    type="text"
                                    value=${username}
                                    onInput=${e => setUsername(e.target.value.toLowerCase())}
                                    placeholder="Choose a username"
                                    class="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-bold text-slate-600 mb-1">Role</label>
                                <select
                                    value=${role}
                                    onChange=${e => setRole(e.target.value)}
                                    class="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="teacher">Teacher</option>
                                    <option value="class_teacher">Class Teacher</option>
                                    <option value="head_teacher">Head Teacher</option>
                                    <option value="admin">Administrator</option>
                                </select>
                            </div>

                            <div>
                                <label class="block text-sm font-bold text-slate-600 mb-1">Religion (For Religion Teachers)</label>
                                <select
                                    value=${religion}
                                    onChange=${e => setReligion(e.target.value)}
                                    class="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">None / All</option>
                                    <option value="Christian">Christian</option>
                                    <option value="Islam">Islam</option>
                                    <option value="Hindu">Hindu</option>
                                </select>
                            </div>

                            ${(role === 'teacher' || role === 'class_teacher') && html`
                                <div>
                                    <label class="block text-sm font-bold text-slate-600 mb-1">Grades/Classes Taught (Select all that apply)</label>
                                    <div class="border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto bg-slate-50">
                                        ${allGrades.map(grd => html`
                                            <label class="flex items-center gap-2 py-1 cursor-pointer hover:bg-slate-100 rounded px-2">
                                                <input
                                                    type="checkbox"
                                                    checked=${grades.split(',').map(g => g.trim()).includes(grd)}
                                                    onChange=${e => {
                                                        const current = grades.split(',').map(g => g.trim()).filter(g => g);
                                                        if (e.target.checked) {
                                                            current.push(grd);
                                                        } else {
                                                            const idx = current.indexOf(grd);
                                                            if (idx > -1) current.splice(idx, 1);
                                                        }
                                                        setGrades(current.join(', '));
                                                    }}
                                                    class="rounded text-blue-600"
                                                />
                                                <span class="text-sm">${grd}</span>
                                            </label>
                                        `)}
                                    </div>
                                </div>
                                
                                ${grades && html`
                                    <div>
                                        <label class="block text-sm font-bold text-slate-600 mb-1">
                                            Subjects for Selected Grades (${availableSubjectList.length} available)
                                        </label>
                                        ${availableSubjectList.length > 0 ? html`
                                            <div class="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto bg-slate-50">
                                                ${availableSubjectList.map(subj => html`
                                                    <label class="flex items-center gap-2 py-1 cursor-pointer hover:bg-slate-100 rounded px-2">
                                                        <input
                                                            type="checkbox"
                                                            checked=${subjects.split(',').map(s => s.trim()).includes(subj)}
                                                            onChange=${e => {
                                                                const current = subjects.split(',').map(s => s.trim()).filter(s => s);
                                                                if (e.target.checked) {
                                                                    current.push(subj);
                                                                } else {
                                                                    const idx = current.indexOf(subj);
                                                                    if (idx > -1) current.splice(idx, 1);
                                                                }
                                                                setSubjects(current.join(', '));
                                                            }}
                                                            class="rounded text-blue-600"
                                                        />
                                                        <span class="text-sm">${subj}</span>
                                                    </label>
                                                `)}
                                            </div>
                                        ` : html`
                                            <p class="text-sm text-orange-600 bg-orange-50 p-2 rounded">Select grades above to see relevant subjects</p>
                                        `}
                                        <p class="text-xs text-slate-400 mt-1">Or type additional custom subjects</p>
                                        <input
                                            type="text"
                                            value=${subjects}
                                            onInput=${e => setSubjects(e.target.value)}
                                            placeholder="Additional subjects (comma separated)"
                                            class="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                                        />
                                    </div>
                                `}
                            `}

                            ${role === 'class_teacher' && html`
                                <div>
                                    <label class="block text-sm font-bold text-slate-600 mb-1">Assigned Class (As Class Teacher)</label>
                                    <input
                                        type="text"
                                        value=${classTeacherGrade}
                                        onInput=${e => setClassTeacherGrade(e.target.value.toUpperCase())}
                                        placeholder="E.g., GRADE 1 (must match exact grade name)"
                                        class="w-full px-4 py-2.5 border-2 border-blue-200 bg-blue-50/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            `}

                            <div>
                                <label class="block text-sm font-bold text-slate-600 mb-1">Password</label>
                                <input
                                    type="password"
                                    value=${password}
                                    onInput=${e => setPassword(e.target.value)}
                                    placeholder="Create a password (min 4 chars)"
                                    class="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label class="block text-sm font-bold text-slate-600 mb-1">Confirm Password</label>
                                <input
                                    type="password"
                                    value=${confirmPassword}
                                    onInput=${e => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm your password"
                                    class="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled=${loading}
                                class="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50"
                            >
                                ${loading ? 'Creating Account...' : 'Create Account'}
                            </button>
                        </form>

                        <div class="mt-4 text-center">
                            <p class="text-sm text-slate-500">
                                Already have an account?
                                <button
                                    onClick=${() => switchMode('login')}
                                    class="text-blue-600 hover:text-blue-700 font-bold"
                                >
                                    Sign in here
                                </button>
                            </p>
                        </div>
                    `}

                    <div class="mt-6 pt-4 border-t border-slate-100 text-center">
                        <button
                            onClick=${onClose}
                            class="text-sm text-slate-500 hover:text-slate-700"
                        >
                            Continue without logging in (Guest mode)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
};

export default TeacherAuth;
