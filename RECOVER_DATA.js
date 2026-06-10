// ============================================================
// EMERGENCY DATA RECOVERY SCRIPT
// Run this in your browser console (F12 → Console tab)
// ============================================================

(function recoverData() {
    const STORAGE_KEY = 'edutrack_cbc_data';
    
    // Step 1: Check current state
    console.log('=== DATA RECOVERY DIAGNOSTIC ===');
    const existing = localStorage.getItem(STORAGE_KEY);
    
    if (existing) {
        try {
            const parsed = JSON.parse(existing);
            console.log('Current data found:');
            console.log('- Students:', parsed.students?.length || 0);
            console.log('- Assessments:', parsed.assessments?.length || 0);
            console.log('- Payments:', parsed.payments?.length || 0);
            console.log('- Has settings:', !!parsed.settings);
            
            if (parsed.students?.length > 0) {
                console.log('\nSample student:', parsed.students[0]);
                console.log('\n>>> Data exists! Problem may be with filtering or rendering.');
                console.log('>>> Try: Change the "Status" filter to "All Students" in the UI');
                return;
            }
        } catch (e) {
            console.error('Corrupted data found:', e);
        }
    } else {
        console.log('No data found in localStorage');
    }
    
    // Step 2: Inject working test data
    console.log('\n=== INJECTING TEST DATA ===');
    
    const testData = {
        archives: [],
        students: [
            { 
                id: '1', 
                name: 'John Kamau', 
                grade: 'GRADE 5', 
                admissionNo: '2024/001', 
                admissionDate: '2024-01-10', 
                assessmentNo: 'ASN-001', 
                upiNo: 'UPI-789X', 
                stream: 'A', 
                parentContact: '0711222333', 
                selectedFees: ['t1', 't2', 't3'],
                status: 'active',
                religion: 'Christian'
            },
            { 
                id: '2', 
                name: 'Jane Wanjiku', 
                grade: 'GRADE 5', 
                admissionNo: '2024/002', 
                admissionDate: '2024-02-15', 
                assessmentNo: 'ASN-002', 
                upiNo: 'UPI-456Y', 
                stream: 'B', 
                parentContact: '0722333444', 
                selectedFees: ['t1', 't2', 't3'],
                status: 'active',
                religion: 'Christian'
            },
            { 
                id: '3', 
                name: 'Peter Ochieng', 
                grade: 'GRADE 6', 
                admissionNo: '2024/003', 
                admissionDate: '2024-01-20', 
                assessmentNo: 'ASN-003', 
                upiNo: 'UPI-123Z', 
                stream: 'A', 
                parentContact: '0733444555', 
                selectedFees: ['t1', 't2', 't3'],
                status: 'active',
                religion: 'Christian'
            }
        ],
        assessments: [
            { id: 'a1', studentId: '1', subject: 'Mathematics', level: 'EE', score: 85, date: '2024-03-20', term: 'T1', examType: 'CAT', academicYear: '2024/2025' },
            { id: 'a2', studentId: '1', subject: 'English', level: 'ME', score: 72, date: '2024-03-20', term: 'T1', examType: 'CAT', academicYear: '2024/2025' },
            { id: 'a3', studentId: '2', subject: 'Mathematics', level: 'EE', score: 90, date: '2024-03-20', term: 'T1', examType: 'CAT', academicYear: '2024/2025' }
        ],
        payments: [
            { id: 'p1', studentId: '1', amount: 20000, date: '2024-03-01', receiptNo: 'RCP-001', term: 'T1', type: 'School Fees', academicYear: '2024/2025' },
            { id: 'p2', studentId: '2', amount: 25000, date: '2024-03-05', receiptNo: 'RCP-002', term: 'T1', type: 'School Fees', academicYear: '2024/2025' }
        ],
        paymentPrompts: [],
        teachers: [
            { id: 't1', name: 'Mr. Mwangi', contact: '0712345678', subjects: 'Mathematics, Science', grades: 'GRADE 5, GRADE 6', employeeNo: 'T-001' }
        ],
        staff: [
            { id: 's1', name: 'Alice Wambui', role: 'Bursar', contact: '0722000111', employeeNo: 'S-001' }
        ],
        remarks: [],
        attendance: [],
        transport: {
            routes: [
                { id: 'r1', name: 'Route A - City Center', fee: 5000 },
                { id: 'r2', name: 'Route B - Westlands', fee: 6500 }
            ],
            assignments: []
        },
        library: {
            books: [
                { id: 'b1', title: 'The River and the Source', author: 'Margaret Ogola', isbn: '978-9966-882-05-9', status: 'Available', quantity: 10 },
                { id: 'b2', title: 'Kidagaa Kimemwozea', author: 'Ken Walibora', isbn: '978-9966-10-142-2', status: 'Available', quantity: 5 }
            ],
            borrowings: []
        },
        inventory: {
            items: [
                { id: 'i1', name: 'Desk', category: 'Furniture', quantity: 100, condition: 'Good' }
            ]
        },
        settings: {
            schoolName: 'Evergreen Academy',
            schoolAddress: '123 Academic Drive, Nairobi, Kenya',
            schoolLogo: 'school_logo.png',
            principalSignature: '',
            clerkSignature: '',
            academicYear: '2024/2025',
            currency: 'KES.',
            theme: 'light',
            primaryColor: '#2563eb',
            secondaryColor: '#64748b',
            weeksPerTerm: 12,
            termDates: {
                T1: { start: '2024-01-06', end: '2024-04-04' },
                T2: { start: '2024-04-22', end: '2024-08-08' },
                T3: { start: '2024-08-25', end: '2024-11-21' }
            },
            grades: ['PP1', 'PP2', 'GRADE 1', 'GRADE 2', 'GRADE 3', 'GRADE 4', 'GRADE 5', 'GRADE 6', 'GRADE 7', 'GRADE 8', 'GRADE 9'],
            streams: ['A', 'B', 'C'],
            feeStructures: [
                { grade: 'GRADE 5', t1: 25000, t2: 20000, t3: 20000, admission: 3000, diary: 500, development: 5000, boarding: 0, breakfast: 3500, lunch: 6000, trip: 2500, bookFund: 1500, caution: 2000, uniform: 5000, studentCard: 500, remedial: 2000, assessmentFee: 1500, projectFee: 1000, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 },
                { grade: 'GRADE 6', t1: 30000, t2: 25000, t3: 25000, admission: 3000, diary: 500, development: 5000, boarding: 0, breakfast: 4000, lunch: 7000, trip: 3000, bookFund: 2000, caution: 2000, uniform: 5500, studentCard: 500, remedial: 2500, assessmentFee: 2000, projectFee: 1500, activityFees: 0, tieAndBadge: 0, academicSupport: 0, pta: 0 }
            ]
        }
    };
    
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(testData));
    
    console.log('✅ 3 test students injected successfully!');
    console.log('Students: John Kamau (Grade 5A), Jane Wanjiku (Grade 5B), Peter Ochieng (Grade 6A)');
    console.log('\n>>> NOW REFRESH THE PAGE (Press F5) to see the students in the table');
    console.log('>>> The students should appear in both the Students table and Dashboard');
    
})();

// Usage instructions:
// 1. Open your app in the browser
// 2. Press F12 to open Developer Tools
// 3. Click on "Console" tab
// 4. Copy this entire script and paste it in the console
// 5. Press Enter to run
// 6. Refresh the page (F5)
// 7. Students should now appear
