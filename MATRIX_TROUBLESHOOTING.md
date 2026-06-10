# Troubleshooting: Matrix Sheet Assessment Data Not Displaying

## ✅ What I Fixed

The backend now:
1. ✅ **Detects matrix sheets** with `Grade_Assessments_*` naming pattern
2. ✅ **Parses matrix format** (rows = students, columns = subjects)
3. ✅ **Converts to flat records** for frontend display
4. ✅ **Logs detailed debug info** to help troubleshoot

---

## 🧪 Step 1: Test Sheet Detection

**Run this to list all your Grade_Assessments sheets:**
```
GET ?action=debugGradeSheets
```

**Expected response:**
```json
{
  "success": true,
  "gradeSheets": [
    {
      "name": "Grade_Assessments_PP1_T1_Opener",
      "rows": 25,
      "cols": 8
    }
  ],
  "count": 1
}
```

If your `Grade_Assessments_PP1_T1_Opener` doesn't appear here, the sheet name might be different. Copy the exact name for next step.

---

## 🧪 Step 2: View Sheet Raw Data

**Get the first few rows of your matrix sheet:**
```
GET ?action=fetchMatrixSheet&sheetName=Grade_Assessments_PP1_T1_Opener
```

**Expected response:**
```json
{
  "success": true,
  "sheetName": "Grade_Assessments_PP1_T1_Opener",
  "totalRows": 26,
  "totalCols": 8,
  "headers": ["Student ID", "Student Name", "Math", "English", "Science", ...],
  "preview": [
    ["Student ID", "Student Name", "Math", "English", ...],
    ["S001", "John Doe", 85, 90, ...],
    ["S002", "Jane Smith", 92, 88, ...]
  ]
}
```

This shows the raw data structure. Verify:
- ✓ Headers are correct (ID, Name, then subject names)
- ✓ Student data starts from row 2
- ✓ Mark values are numbers

---

## 🧪 Step 3: Test Assessment Parsing

**Parse assessments from the exact sheet:**
```
GET ?action=getAssessmentsFromSheet&sheetName=Grade_Assessments_PP1_T1_Opener&grade=PP1&term=T1&examType=Opener
```

**Expected response:**
```json
{
  "success": true,
  "sheetName": "Grade_Assessments_PP1_T1_Opener",
  "grade": "PP1",
  "term": "T1",
  "examType": "Opener",
  "totalAssessments": 150,
  "assessments": [
    {
      "id": "A-xxx-1-3",
      "studentId": "S001",
      "studentAdmissionNo": "S001",
      "studentName": "John Doe",
      "grade": "PP1",
      "subject": "Math",
      "score": 85,
      "term": "T1",
      "examType": "Opener",
      "academicYear": "2025/2026",
      "date": "2026-04-17",
      "rawScore": 85,
      "maxScore": 100
    }
    ...
  ]
}
```

If `totalAssessments` is 0, the sheet is not being parsed correctly. Check:
- ✓ Headers exactly match pattern: `Student ID`, `Student Name`, `[Subjects...]`
- ✓ No empty rows between header and data
- ✓ Mark values are numbers, not text

---

## 🧪 Step 4: Test Full Assessment Fetch

**Fetch data like the frontend does:**
```
GET ?action=getAssessments&grade=PP1&term=T1&examType=Opener
```

**What happens:**
1. Looks for `Grade_Assessments_PP1_T1_Opener` → ✓ Found
2. Parses matrix sheets → Converts to flat records
3. Returns assessments

**Expected: Returns 150+ records**

Check the Google Apps Script console logs:
```
[Assessment] ========== FETCHING ==========
[Assessment] Parameters: grade="PP1", term="T1", examType="Opener", year="2025/2026"
[Assessment] Trying exact sheet: Grade_Assessments_PP1_T1_Opener
[Assessment] ✓ Using matrix sheet: Grade_Assessments_PP1_T1_Opener, found 150 records
```

---

## 🧪 Step 5: Test Full Data Sync

**Get all data (like app.js does on init):**
```
GET ?action=getAll
```

**Check the response includes assessments:**
```json
{
  "success": true,
  "timestamp": "...",
  "students": [...],
  "assessments": [150 records from matrix sheets],
  "attendance": [...],
  "teachers": [...],
  "staff": [...],
  "payments": [...]
}
```

If `assessments` array is empty, something's wrong. Check:
- ✓ Grade_Assessments sheets exist
- ✓ Matrix format is correct
- ✓ No formula errors in marks cells

---

## 🔍 Common Issues & Solutions

| Problem | Solution |
|---------|----------|
| 0 records returned | Check `debugGradeSheets` - is sheet found? |
| Sheet found but 0 records | Run `fetchMatrixSheet` - check format |
| Wrong number of marks | Check headers match exactly |
| Specific grade not found | Verify grade parameter matches sheet name |
| Frontend still shows empty | Clear browser cache, reload, resync |

---

## 📋 Matrix Sheet Format Checklist

- [ ] Sheet name: `Grade_Assessments_[Grade]_[Term]_[ExamType]`
- [ ] Row 1: Headers - `Student ID`, `Student Name`, `Subject1`, `Subject2`, ...
- [ ] Row 2+: Student data
- [ ] Student marks are **numbers** (not text like "85.0")
- [ ] No empty rows between header and data
- [ ] No blank cells in Student ID/Name columns

---

## 💡 Debug Screenshots  

When checking `fetchMatrixSheet`:

**✅ Good Format:**
```
Row 1: [Student ID] [Student Name] [Math] [English] [Science]
Row 2: [S001] [John Doe] [85] [90] [88]
Row 3: [S002] [Jane Smith] [92] [87] [91]
```

**❌ Bad Format:**
```
Row 1: [ID] [Name] [Math] [English]
Row 2: (empty)
Row 3: [S001] [John Doe] [85] [90]  ← Wrong - data should start at Row 2!
```

---

## 🚀 Once Tests Pass

1. ✅ All debug tests return correct data
2. ✅ `getAssessments` returns matrix sheet data
3. ✅ `getAll` includes parsed assessments
4. **Then reload your app** → Matrix view will populate automatically

---

## 📞 Need More Help?

1. Run all 5 test steps above
2. Copy the responses
3. Check them against examples
4. Share any error messages

The debug endpoints show exactly where the issue is!
