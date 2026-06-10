/**
 * ASSESSMENT MATRIX MODULE - VERSION 1.0 WITH AUTO SHEET INITIALIZATION
 * 
 * Organizes assessments by grade/class with matrix layout:
 * - Each grade gets its own sheet (e.g., "Grade 1 Assessments - T1")
 * - Subjects become column headers
 * - First two columns: Student ID, Student Name
 * - Marks entered at intersection of subject and student
 * 
 * Includes bidirectional sync with flat assessment table
 * AUTO CREATES: All required sheets (Students, Assessments, Attendance, etc.)
 * 
 * NOTE: Works with google-apps-script.gs in the same project
 * Sheet definitions (SHEET_NAMES, headers) come from google-apps-script.gs
 */

// ==================== CONFIGURATION ====================
const MATRIX_SHEET_PREFIX = 'Grade_Assessments_';  // Creates "Grade_Assessments_Grade1_T1_Opener"
const MATRIX_HEADERS_STARTROW = 1;
const MATRIX_STUDENTID_COL = 1;  // Column A
const MATRIX_STUDENTNAME_COL = 2;  // Column B
const MATRIX_MARKS_START_COL = 3;   // Column C onwards (subjects)
// ==================== AUTO INITIALIZATION ====================
/**
 * Triggered on first sheet open - ensures all required base sheets exist
 * Note: Sheet creation is primarily handled by google-apps-script.gs
 * This function ensures sheets exist if this file runs independently
 */
function onOpen() {
  ensureSheetsExist();
}

/**
 * Ensures all required sheets exist (works with or without google-apps-script.gs)
 */
function ensureSheetsExist() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const requiredSheets = [
    'Students',
    'Assessments',
    'Attendance',
    'Teachers',
    'Staff',
    'Payments',
    'Activity',
    'TeacherCredentials',
    'ActivityLog',
    'Backup_Metadata',
    'SyncStatus'
  ];
  
  for (const sheetName of requiredSheets) {
    if (!spreadsheet.getSheetByName(sheetName)) {
      spreadsheet.insertSheet(sheetName);
    }
  }
}
// ==================== INITIALIZE MATRIX SHEETS ====================

/**
 * Creates or clears assessment matrix sheets for given grade/term/exam
 */
function createAssessmentMatrixSheets(grade, term = 'T1', examType = 'Opener', subjectsFromClient = null) {
  if (!grade) return { success: false, error: 'Grade required' };
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = generateMatrixSheetName(grade, term, examType);
  
  try {
    // Get or create sheet
    let sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      sheet.clear();
    } else {
      sheet = ss.insertSheet(sheetName);
    }
    
    // Get subjects - prefer client provided, then settings, then current assessments
    let subjects = subjectsFromClient;
    if (!subjects || subjects.length === 0) {
      subjects = getSubjectsForGrade(grade);
    }
    if (!subjects || subjects.length === 0) {
      subjects = getSubjectsFromAssessments(grade);
    }

    // Build headers and data
    const { headers, rows } = buildMatrixData(grade, term, examType, subjects);
    
    if (headers.length === 0) {
      return { success: true, message: 'No subjects found for this grade. Please ensure subjects are configured.', sheetName: sheetName };
    }
    
    // Write headers
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    
    // Format header row
    headerRange.setBackground('#4472C4');
    headerRange.setFontColor('#FFFFFF');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');
    headerRange.setVerticalAlignment('middle');
    
    // Write student data
    if (rows.length > 0) {
      const dataRange = sheet.getRange(2, 1, rows.length, headers.length);
      dataRange.setValues(rows);
      
      // Freeze header row
      sheet.setFrozenRows(1);
      
      // Set column widths
      sheet.setColumnWidth(1, 80);   // Student ID
      sheet.setColumnWidth(2, 150);  // Student Name
      for (let i = 3; i <= headers.length; i++) {
        sheet.setColumnWidth(i, 80);  // Subject columns
      }
      
      // Center align all cells
      sheet.getRange(2, 1, rows.length, headers.length).setHorizontalAlignment('center');
      
      // Add data validation for mark cells (0-100)
      const markRange = sheet.getRange(2, 3, rows.length, headers.length - 2);
      const rule = SpreadsheetApp.newDataValidation()
        .requireNumberBetween(0, 100)
        .setAllowInvalid(false)
        .setHelpText('Enter marks 0-100')
        .build();
      markRange.setDataValidation(rule);
      
      // Add borders and alternating row colors
      sheet.getRange(1, 1, rows.length + 1, headers.length).setBorder(
        true, true, true, true, true, true
      );
      
      // Alternate row colors
      for (let i = 0; i < rows.length; i++) {
        if (i % 2 === 0) {
          sheet.getRange(i + 2, 1, 1, headers.length).setBackground('#F2F2F2');
        }
      }
    }
    
    return {
      success: true,
      message: `Matrix sheet created: ${sheetName}`,
      sheetName: sheetName,
      headers: headers.length - 2,
      students: rows.length
    };
    
  } catch (error) {
    Logger.log('❌ Error creating matrix sheet:', error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Builds matrix data from assessments
 * Returns { headers: [...], rows: [[...], ...] }
 */
function buildMatrixData(grade, term, examType, providedSubjects = null) {
  try {
    // Get all unique subjects for this grade
    const subjects = providedSubjects || getSubjectsForGrade(grade);
    if (!subjects || subjects.length === 0) {
      return { headers: [], rows: [] };
    }
    
    // Get students in this grade
    const studentsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Students');
    if (!studentsSheet) return { headers: [], rows: [] };
    
    const studentData = studentsSheet.getDataRange().getValues();
    if (!studentData || studentData.length < 2) {
      return { headers: [], rows: [] };
    }
    
    const students = [];
    
    for (let i = 1; i < studentData.length; i++) {
      const row = studentData[i];
      if (!row || row.length < 3) continue;  // Skip malformed rows
      
      const studentId = row[0];
      const studentName = row[1];
      const studentGrade = row[2];
      
      if (studentGrade === grade && studentId && studentName) {
        students.push({ id: studentId, name: studentName });
      }
    }
    
    if (students.length === 0) {
      return { headers: [], rows: [] };
    }
    
    // Sort students by name
    students.sort((a, b) => String(a.name).localeCompare(b.name));
    
    // Get assessments for this grade/term/exam
    const assessmentsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Assessments');
    if (!assessmentsSheet) return { headers: [], rows: [] };
    
    const assessmentData = assessmentsSheet.getDataRange().getValues();
    if (!assessmentData || assessmentData.length < 1) {
      return { headers: [], rows: [] };
    }
    
    const assessments = [];
    
    // Map headers - Find column indices
    const assessmentHeaders = assessmentData[0];
    const idIdx = assessmentHeaders.indexOf('id');
    const studentIdIdx = assessmentHeaders.indexOf('studentId');
    const subjectIdx = assessmentHeaders.indexOf('subject');
    const scoreIdx = assessmentHeaders.indexOf('score');
    const termIdx = assessmentHeaders.indexOf('term');
    const examTypeIdx = assessmentHeaders.indexOf('examType');
    const gradeIdx = assessmentHeaders.indexOf('grade');
    
    // Validate header indices were found
    if (idIdx === -1 || studentIdIdx === -1 || subjectIdx === -1) {
      Logger.log('⚠️ Warning: Assessments sheet headers not complete');
      return { headers: [], rows: [] };
    }
    
    for (let i = 1; i < assessmentData.length; i++) {
      const row = assessmentData[i];
      if (!row || row.length === 0) continue;  // Skip empty rows
      
      if (row[gradeIdx] === grade && row[termIdx] === term && row[examTypeIdx] === examType) {
        assessments.push({
          id: row[idIdx],
          studentId: row[studentIdIdx],
          subject: row[subjectIdx],
          score: row[scoreIdx] || 0
        });
      }
    }
    
    // Build headers: Student ID, Student Name, Subject1, Subject2, ...
    const headers = ['Student ID', 'Student Name', ...subjects];
    
    // Build rows
    const rows = students.map(student => {
      const rowData = [student.id, student.name];
      
      // Add scores for each subject
      for (const subject of subjects) {
        const assessment = assessments.find(
          a => String(a.studentId) === String(student.id) && a.subject === subject
        );
        rowData.push(assessment?.score || '');
      }
      
      return rowData;
    });
    
    return { headers, rows };
    
  } catch (error) {
    Logger.log('❌ Error building matrix data:', error.toString());
    return { headers: [], rows: [] };
  }
}

/**
 * Get subjects for a specific grade from Settings
 */
function getSubjectsForGrade(grade) {
  try {
    // Check Settings sheet if exists
    const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Settings');
    if (settingsSheet) {
      const data = settingsSheet.getDataRange().getValues();
      for (let i = 0; i < data.length; i++) {
        if (data[i][0] === 'gradeSubjects' && data[i][1]) {
          const subjects = JSON.parse(data[i][1]);
          return subjects[grade] || [];
        }
      }
    }
    return [];
  } catch (error) {
    return [];
  }
}

/**
 * Fallback: Get subjects from existing assessments if Settings sheet is missing
 */
function getSubjectsFromAssessments(grade) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Assessments');
    if (!sheet) return [];
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];
    
    const headers = data[0];
    const gradeIdx = headers.indexOf('grade');
    const subjectIdx = headers.indexOf('subject');
    
    if (gradeIdx === -1 || subjectIdx === -1) return [];
    
    const subjects = new Set();
    for (let i = 1; i < data.length; i++) {
      if (data[i][gradeIdx] === grade) {
        subjects.add(data[i][subjectIdx]);
      }
    }
    return Array.from(subjects).sort();
  } catch (e) {
    return [];
  }
}

/**
 * Updates a single cell in the matrix sheets dynamically
 */
function updateMatrixCell(studentId, subject, score, grade, term, examType) {
  try {
    const sheetName = generateMatrixSheetName(grade, term, examType);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) return { success: false, error: 'Matrix sheet not found' };
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) return { success: false, error: 'Sheet is empty' };
    
    const headers = data[0];
    const subjectCol = headers.indexOf(subject) + 1; // 1-indexed
    
    if (subjectCol <= 0) return { success: false, error: 'Subject column not found' };
    
    // Find student row
    let studentRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(studentId).trim()) {
        studentRow = i + 1; // 1-indexed
        break;
      }
    }
    
    if (studentRow === -1) return { success: false, error: 'Student not found in matrix' };
    
    // Update cell
    sheet.getRange(studentRow, subjectCol).setValue(score);
    
    return { success: true, message: 'Matrix updated' };
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Sync assessment matrix updates back to flat table
 */
function syncMatrixToAssessments(sheetName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const matrixSheet = ss.getSheetByName(sheetName);
    if (!matrixSheet) {
      return { success: false, error: 'Matrix sheet not found' };
    }
    
    // Parse sheet name to get grade, term, exam
    const { grade, term, examType } = parseMatrixSheetName(sheetName);
    if (!grade) {
      return { success: false, error: 'Invalid matrix sheet name format' };
    }
    
    const matrixData = matrixSheet.getDataRange().getValues();
    if (!matrixData || matrixData.length < 2) {
      return { success: false, error: 'Matrix sheet is empty' };
    }
    
    const headers = matrixData[0];
    if (!headers || headers.length < 3) {
      return { success: false, error: 'Invalid matrix headers' };
    }
    
    // Get assessments sheet
    const assessmentsSheet = ss.getSheetByName('Assessments');
    if (!assessmentsSheet) {
      return { success: false, error: 'Assessments sheet not found' };
    }
    
    const assessmentData = assessmentsSheet.getDataRange().getValues();
    if (!assessmentData || assessmentData.length < 1) {
      return { success: false, error: 'Assessments sheet is empty' };
    }
    
    const assessmentHeaders = assessmentData[0];
    
    // Find column indices
    const idIdx = assessmentHeaders.indexOf('id');
    const studentIdIdx = assessmentHeaders.indexOf('studentId');
    const subjectIdx = assessmentHeaders.indexOf('subject');
    const scoreIdx = assessmentHeaders.indexOf('score');
    const gradeIdx = assessmentHeaders.indexOf('grade');
    const termIdx = assessmentHeaders.indexOf('term');
    const examTypeIdx = assessmentHeaders.indexOf('examType');
    const academicYearIdx = assessmentHeaders.indexOf('academicYear');
    
    if (studentIdIdx === -1 || subjectIdx === -1 || scoreIdx === -1) {
      return { success: false, error: 'Required columns missing in Assessments sheet' };
    }
    
    const currentYear = new Date().getFullYear();
    const academicYear = `${currentYear}/${currentYear + 1}`;
    
    let updateCount = 0;
    const updatedAssessments = assessmentData.map(row => [...row]);  // Deep copy to avoid mutations
    
    // Process each student row in matrix (skip header row 0)
    for (let i = 1; i < matrixData.length; i++) {
      const row = matrixData[i];
      if (!row || row.length < 3) continue;  // Skip malformed rows
      
      const studentId = row[0];
      const studentName = row[1];
      
      if (!studentId) continue;  // Skip rows without student ID
      
      // Process each subject (columns 2 onwards)
      for (let j = 2; j < headers.length; j++) {
        const subject = headers[j];
        const score = row[j];
        
        // Skip empty cells
        if (score === '' || score === null || score === undefined) continue;
        if (isNaN(Number(score))) continue;  // Skip non-numeric values
        
        const numScore = Number(score);
        
        // Find matching assessment or mark for creation
        let found = false;
        for (let k = 1; k < updatedAssessments.length; k++) {
          if (
            String(updatedAssessments[k][studentIdIdx]).trim() === String(studentId).trim() &&
            String(updatedAssessments[k][subjectIdx]).trim() === String(subject).trim() &&
            updatedAssessments[k][gradeIdx] === grade &&
            updatedAssessments[k][termIdx] === term &&
            updatedAssessments[k][examTypeIdx] === examType
          ) {
            updatedAssessments[k][scoreIdx] = numScore;
            found = true;
            updateCount++;
            break;
          }
        }
        
        // If not found, create new assessment row
        if (!found && numScore >= 0) {
          const newRow = new Array(assessmentHeaders.length);
          
          // Fill all columns
          for (let col = 0; col < assessmentHeaders.length; col++) {
            newRow[col] = '';  // Initialize all columns
          }
          
          // Fill in known columns
          newRow[idIdx] = 'A-' + Date.now() + Math.random().toString().slice(2, 6);
          newRow[studentIdIdx] = studentId;
          newRow[subjectIdx] = subject;
          newRow[scoreIdx] = numScore;
          newRow[gradeIdx] = grade;
          newRow[termIdx] = term;
          newRow[examTypeIdx] = examType;
          
          if (academicYearIdx !== -1) {
            newRow[academicYearIdx] = academicYear;
          }
          
          updatedAssessments.push(newRow);
          updateCount++;
        }
      }
    }
    
    // Write back to assessments sheet only if there are changes
    if (updateCount > 0) {
      assessmentsSheet.clearContents();
      if (updatedAssessments.length > 0) {
        const maxCols = Math.max(...updatedAssessments.map(row => row.length));
        assessmentsSheet.getRange(1, 1, updatedAssessments.length, maxCols)
          .setValues(updatedAssessments);
      }
    }
    
    return {
      success: true,
      message: `Synced ${updateCount} records from matrix to assessments`
    };
    
  } catch (error) {
    Logger.log('❌ Error syncing matrix:', error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * Parse matrix sheet name to extract grade, term, exam
 */
function parseMatrixSheetName(sheetName) {
  // Format: "Grade_Assessments_Grade1_T1_Opener"
  const parts = sheetName.split('_');
  if (parts.length < 5 || parts[0] !== 'Grade' || parts[1] !== 'Assessments') {
    return { grade: null, term: null, examType: null };
  }
  
  // Reconstruct grade name (may have underscores)
  let gradeEndIdx = 2;
  while (gradeEndIdx < parts.length && !parts[gradeEndIdx].match(/^T\d+$/)) {
    gradeEndIdx++;
  }
  
  const grade = parts.slice(2, gradeEndIdx).join(' ');
  const term = parts[gradeEndIdx];
  const examType = parts.slice(gradeEndIdx + 1).join(' ');
  
  return { grade, term, examType };
}

/**
 * Generate matrix sheet name
 */
function generateMatrixSheetName(grade, term, examType) {
  const safeName = grade.replace(/\s+/g, '_');
  return `${MATRIX_SHEET_PREFIX}${safeName}_${term}_${examType}`;
}

/**
 * Get all assessment matrix sheets
 */
function listAssessmentMatrixSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  const matrixSheets = [];
  
  for (const sheet of sheets) {
    if (sheet.getName().startsWith(MATRIX_SHEET_PREFIX)) {
      matrixSheets.push(sheet.getName());
    }
  }
  
  return matrixSheets;
}

/**
 * Delete matrix sheet for cleanup
 */
function deleteMatrixSheet(sheetName) {
  try {
    if (!sheetName.startsWith(MATRIX_SHEET_PREFIX)) {
      return { success: false, error: 'Invalid matrix sheet name' };
    }
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return { success: false, error: 'Sheet not found' };
    }
    
    ss.deleteSheet(sheet);
    return { success: true, message: `Deleted: ${sheetName}` };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}


// ==================== HELPER FUNCTIONS FOR MATRIX ====================

/**
 * Helper to process matrix requests
 * Called by google-apps-script.gs doPost handler
 */
function processMatrixRequest(action, grade, term, examType, sheetName) {
  try {
    switch (action) {
      case 'CREATE_MATRIX':
        return createAssessmentMatrixSheets(grade, term || 'T1', examType || 'Opener', arguments[5]); // Pass additional subjects if any
      case 'UPDATE_MATRIX_CELL':
        // Expecting data object in grade for this case if called from doPost
        return updateMatrixCell(arguments[1], arguments[2], arguments[3], arguments[4], arguments[5], arguments[6]);
      case 'SYNC_MATRIX':
        return syncMatrixToAssessments(sheetName);
      case 'LIST_MATRICES':
        return { success: true, sheets: listAssessmentMatrixSheets() };
      case 'DELETE_MATRIX':
        return deleteMatrixSheet(sheetName);
      default:
        return null; // Let main handler deal with it
    }
  } catch (error) {
    return { success: false, error: error.toString() };
  }
}
