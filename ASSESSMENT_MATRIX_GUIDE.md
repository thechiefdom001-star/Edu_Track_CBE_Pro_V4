# Assessment Matrix System - Implementation Guide

## Overview

The Assessment Matrix system reorganizes your assessment data into a grade-based matrix layout where:
- **Each grade/class has its own view**
- **Subjects are column headers**
- **Student ID and Name are the first two columns**
- **Marks are entered at the intersection of subject column and student row**

This provides an intuitive spreadsheet-like interface for data entry and management.

## Features

### 1. **Matrix View Interface**
- Clean grid layout with read-only or editable cells
- Fast data entry by clicking on cells
- Real-time validation (0-100 scores)
- Automatic saving to local storage and Google Sheets
- Export to CSV for analysis

### 2. **Grade/Class Organization**
- Separate matrix for each grade
- Filter by stream if available
- Select term and exam type
- Subjects specific to the grade are automatically displayed

### 3. **Google Sheets Integration**
Create separate Google Sheets with the same matrix layout:
- **Sheet Names Format**: `Grade_Assessments_Grade1_T1_Opener`
- **Automatic Formatting**: Headers, colors, frozen rows, borders
- **Data Validation**: Marks cells restricted to 0-100
- **Bidirectional Sync**: Changes sync between app and Google Sheets

### 4. **Export & Reporting**
- Export current matrix as CSV
- Includes grade, term, exam type, date
- Can be imported into Excel/Google Sheets

## Components

### Frontend Component: `AssessmentMatrix.js`

**Props:**
```javascript
{
  data,                    // App state with assessments, students, settings
  setData,                 // Update app state
  isAdmin,                 // Admin flag
  teacherSession,          // Teacher session info
  allowedSubjects,         // Subjects teacher can access
  allowedGrades,           // Grades teacher can access
  allowedReligion          // Religion filter
}
```

**Key Functions:**
- `updateScore(studentId, subject, score)` - Update a single mark
- `createGoogleMatrix()` - Create matrix sheet in Google Sheets
- `exportToCSV()` - Download current matrix as CSV
- `syncScoreToGoogle(assessment)` - Sync individual score

### Google Apps Script: `AssessmentMatrix.gs`

**Main Functions:**

#### `createAssessmentMatrixSheets(grade, term, examType)`
Creates or refreshes matrix sheet for a specific grade/term/exam combination.

**Parameters:**
- `grade` (String): Grade name (e.g., "Grade 1")
- `term` (String): Term code (e.g., "T1")
- `examType` (String): Exam type (e.g., "Opener", "Mid-term", "Final")

**Returns:**
```javascript
{
  success: true,
  message: string,
  sheetName: string,
  headers: number,      // Number of subjects
  students: number      // Number of students
}
```

**Example:**
```javascript
// Create matrix for Grade 1, Term 1, Opener
const result = createAssessmentMatrixSheets("Grade 1", "T1", "Opener");
```

#### `buildMatrixData(grade, term, examType)`
Constructs the matrix data structure from existing assessments.

**Returns:**
```javascript
{
  headers: ["Student ID", "Student Name", "English", "Maths", ...],
  rows: [
    [studentId1, studentName1, score1, score2, ...],
    [studentId2, studentName2, score1, score2, ...],
    ...
  ]
}
```

#### `syncMatrixToAssessments(sheetName)`
Reads modified data from matrix sheet and updates the main Assessments sheet.

**Parameters:**
- `sheetName` (String): Matrix sheet name

**Returns:**
```javascript
{
  success: true,
  message: "Synced X records from matrix to assessments"
}
```

#### `listAssessmentMatrixSheets()`
Lists all matrix sheets in the workbook.

**Returns:**
```javascript
[
  "Grade_Assessments_Grade_1_T1_Opener",
  "Grade_Assessments_Grade_2_T1_Opener",
  ...
]
```

#### `deleteMatrixSheet(sheetName)`
Removes a matrix sheet from the workbook.

#### `getSubjectsForGrade(grade)`
Retrieves all subjects assigned to a grade from Settings.

## Usage Instructions

### For Teachers/Admins

#### 1. **Accessing the Matrix View**
- Navigate to the Assessment section
- Click on "📊 Assessment Matrix" tab/button
- Select your grade/class from the dropdown

#### 2. **Entering Marks**
1. Select the grade, term, and exam type
2. Click on a cell to enter a mark
3. Type a number between 0-100
4. Press Enter to save or Escape to cancel
5. Marks auto-sync to Google Sheets (if configured)

#### 3. **Creating Google Sheets**
1. Click the "☁️ Sheet" button (admin only)
2. Confirm the matrix sheet details
3. Click "Create Matrix"
4. A new sheet is created with:
   - Subjects as columns
   - Students as rows
   - Proper formatting and data validation

#### 4. **Exporting Data**
1. Click "📥 Export"
2. CSV file downloads with:
   - Grade, term, exam type metadata
   - All student marks
   - Can be opened in Excel/Sheets

### For Admins

#### Setup Steps

**1. Ensure Settings are Configured**
```javascript
Settings must have:
- grades: ["Grade 1", "Grade 2", "Grade 3", ...]
- gradeSubjects: {
    "Grade 1": ["English", "Maths", "Science", ...],
    "Grade 2": [...],
    ...
  }
- streams: ["Stream A", "Stream B", ...] (optional)
```

**2. Configure Google Apps Script URL**
Add to settings:
```json
{
  "googleScriptUrl": "https://script.google.com/macros/d/YOUR_SCRIPT_ID/userweb"
}
```

**3. Deploy Google Apps Script**
- Copy `AssessmentMatrix.gs` code to your Apps Script project
- Deploy as web app with appropriate permissions
- Copy the deployment URL to settings

## Data Flow

### Local Entry → Local Storage → Google Sheets
```
User clicks cell
    ↓
Enters mark (0-100)
    ↓
updateScore() validates
    ↓
Updates local assessments state
    ↓
setData() writes to local storage
    ↓
syncScoreToGoogle() calls Google API
    ↓
Assessment added to Assessments sheet
```

### Google Sheets → Assessments
```
User modifies matrix sheet in Google Sheets
    ↓
Call syncMatrixToAssessments(sheetName)
    ↓
Reads modified matrix sheet
    ↓
Finds/creates matching assessments
    ↓
Updates Assessments sheet
    ↓
Frontend polls for changes
    ↓
Displays updated data
```

## Sheet Structure

### Google Sheets Matrix Format

**Header Row (Frozen):**
| Column | Content |
|--------|---------|
| A | Student ID |
| B | Student Name |
| C-Z | Subject 1, Subject 2, ... |

**Data Rows:**
- Each row represents a student
- Cells contain marks (0-100)
- Cells are data-validated to accept only 0-100
- Alternating row colors for readability

**Example:**
```
| Student ID | Student Name   | English | Mathematics | Science |
|------------|----------------|---------|-------------|---------|
| S001       | John Doe       | 85      | 92         | 78      |
| S002       | Jane Smith     | 90      | 88         | 95      |
| S003       | Bob Johnson    | 75      | 80         | 82      |
```

## Database Schema

### Assessments Sheet Columns
```
id, studentId, studentAdmissionNo, studentName, grade, 
subject, score, term, examType, academicYear, date, 
level, rawScore, maxScore
```

**Note:** Matrix system uses:
- `score` as percentage (0-100)
- `rawScore` same as score for matrix
- `maxScore` always 100

## Troubleshooting

### Problem: Matrix sheet not created
**Solution:**
1. Check GoogleScriptUrl is configured
2. Verify grade has subjects in Settings
3. Verify grade has students enrolled
4. Check browser console for errors

### Problem: Marks not saving
**Solution:**
1. Check local storage is enabled
2. Google Sheets sync may be offline - check syncStatus
3. Marks should be 0-100 range
4. Check network connection

### Problem: Google Sheets not showing data
**Solution:**
1. Verify script deployment URL is correct
2. Create matrix sheet first using "Create Matrix" button
3. Wait for sheet to fully load (may take a few seconds)
4. Refresh the sheet

### Problem: Different marks in app vs Google Sheets
**Solution:**
1. Use "Create Matrix" to sync all data
2. Or click export and reimport to rebuild
3. Check syncStatus for failed syncs

## Advanced Usage

### Bulk Create All Matrices
```javascript
// In Google Apps Script console, run:
function createAllMatrices() {
  const grades = ["Grade 1", "Grade 2", "Grade 3", "Grade 4"];
  const terms = ["T1", "T2", "T3"];
  const exams = ["Opener", "Mid-term", "Final"];
  
  grades.forEach(grade => {
    terms.forEach(term => {
      exams.forEach(exam => {
        createAssessmentMatrixSheets(grade, term, exam);
      });
    });
  });
}
```

### Cleanup Old Sheets
```javascript
// Delete matrices older than a specific term
const sheets = listAssessmentMatrixSheets();
sheets.forEach(sheet => {
  if (sheet.includes("T1")) {  // Delete all T1 matrices
    deleteMatrixSheet(sheet);
  }
});
```

### Export Matrix to PDF
```javascript
// After creating matrix in Google Sheets, use built-in Print feature
// File → Print → Save as PDF
```

## Performance Notes

- **Small classes** (<50 students): Fast, no delay
- **Large classes** (50-100+ students): May take 2-3 seconds to render
- **Many subjects** (15+): Horizontal scroll needed
- **Sync frequency**: Built-in 30-second cooldown prevents API throttling

## Security & Permissions

- **Teachers** can only access their assigned grades and subjects
- **Admins** can see all teachers' work and manage all data
- **Religion filtering** applies if configured
- **Read-only** for unauthorized users
- **Data validation** in Google Sheets prevents invalid marks

## Integration with Existing System

The Assessment Matrix system:
- ✅ Works with existing Assessments component
- ✅ Shares same data model
- ✅ Syncs with Google Sheets API
- ✅ Maintains assessment history
- ✅ Supports all exam types and terms
- ✅ Respects user permissions

Switch between Table View and Matrix View as needed - they work on the same data.

## API Endpoints

### POST to Google Apps Script
```javascript
{
  action: "CREATE_MATRIX",
  grade: "Grade 1",
  term: "T1",
  examType: "Opener"
}
```

```javascript
{
  action: "SYNC_MATRIX",
  sheetName: "Grade_Assessments_Grade_1_T1_Opener"
}
```

```javascript
{
  action: "DELETE_MATRIX",
  sheetName: "Grade_Assessments_Grade_1_T1_Opener"
}
```

### GET from Google Apps Script
```
/userweb?action=LIST_MATRICES
/userweb?action=CREATE_MATRIX&grade=Grade1&term=T1&examType=Opener
```

## FAQ

**Q: Can I edit directly in Google Sheets?**
A: Yes! Make changes in the matrix sheet, then click Sync Matrix button to update the app.

**Q: Do marks sync automatically?**
A: Marks entered in the app sync automatically to Google Sheets. Changes in Google Sheets don't auto-sync back - use Sync button.

**Q: Can I have multiple matrix sheets open?**
A: Yes! You can work on Grade 1 T1 and Grade 2 T2 simultaneously.

**Q: What if a student drops a subject?**
A: Leave that cell empty. Assessments are created only for entered scores.

**Q: Can I edit term/exam type after creating matrix?**
A: Create a new matrix for the different term/exam. Old matrix remains for reference.

**Q: Is there a maximum number of students per matrix?**
A: No hard limit, but performance may degrade above 500 students per matrix.

## Version History

- **v1.0** (Current): Initial release with matrix layout, Google Sheets sync, CSV export
