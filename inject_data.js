// Run this in browser console to inject test data
localStorage.setItem('edutrack_cbc_data', JSON.stringify({
    archives: [],
    students: [
        { id: '1', name: 'John Doe', grade: 'GRADE 1', admissionNo: '2024/001', admissionDate: '2024-01-10', assessmentNo: 'ASN-001', upiNo: 'UPI-789X', stream: 'A', parentContact: '0711222333', selectedFees: ['t1', 't2', 't3'], status: 'active' },
        { id: '2', name: 'Jane Smith', grade: 'GRADE 2', admissionNo: '2024/002', admissionDate: '2024-02-15', assessmentNo: 'ASN-002', upiNo: 'UPI-456Y', stream: 'B', parentContact: '0722333444', selectedFees: ['t1', 't2', 't3'], status: 'active' },
        { id: '3', name: 'Peter Kamau', grade: 'GRADE 3', admissionNo: '2024/003', admissionDate: '2024-01-20', assessmentNo: 'ASN-003', upiNo: 'UPI-123Z', stream: 'C', parentContact: '0733444555', selectedFees: ['t1', 't2', 't3'], status: 'active' }
    ],
    assessments: [
        { id: 'a1', studentId: '1', subject: 'Mathematics', level: 'EE', score: 85, date: '2024-03-20', term: 'T1', examType: 'CAT' },
        { id: 'a2', studentId: '1', subject: 'English', level: 'ME', score: 72, date: '2024-03-20', term: 'T1', examType: 'CAT' }
    ],
    payments: [
        { id: 'p1', studentId: '1', amount: 20000, date: '2024-03-01', receiptNo: 'RCP-001', term: 'T1' }
    ],
    paymentPrompts: [],
    teachers: [],
    staff: [],
    remarks: [],
    attendance: [],
    settings: {
        schoolName: 'Evergreen Academy',
        schoolAddress: '123 Academic Drive, Nairobi',
        schoolLogo: 'school_logo.png',
        academicYear: '2025/2026',
        currency: 'KES.',
        grades: ['PP1', 'PP2', 'GRADE 1', 'GRADE 2', 'GRADE 3'],
        streams: ['A', 'B', 'C'],
        feeStructures: []
    }
}));

console.log('Test data injected! Refresh the page to see students.');
