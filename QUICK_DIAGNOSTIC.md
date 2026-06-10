# 🎯 Quick Diagnostic Checklist

**If data isn't showing in the matrix, use this checklist:**

## Browser Console (F12 → Console)

### Before Syncing - Check if data exists:
```javascript
// See how many assessments are currently loaded
console.log('Assessments:', window.__assessmentCount || JSON.parse(localStorage.getItem('edutrackData') || '{}').assessments?.length)
```

### After Clicking "Sync Marks from Sheet" - Watch the logs:
1. Open browser console (F12)
2. Click **"Sync Marks from Sheet"** button
3. Look for messages starting with `[Sync]` or `[MatrixData]`
4. You should see:
   - `[Sync] Starting sync for: Grade_Assessments_...`
   - `[Sync] Calling endpoint: ...`
   - `[Sync] Response status: 200 OK`
   - `[Sync] Backend response: {...}`
   - `[Sync] Got X records from SYNC response` OR `Got X records from getAll`
   - `[Sync] Merge complete: X new records added, Y updated`
   - `[Sync] ✓ SUCCESS: Final assessment count: Z`

### If You See Problems:
- **Missing [Sync] messages?** → Click the button again, watch console from the start
- **"No assessments returned"?** → Backend has no data. Check the matrix sheet exists and has correct format
- **"Backend error"?** → Note the exact error and run debug endpoints below
- **"0 records merged"?** → Data retrieved but not merged. Check student ID/subject matching

---

## Google Apps Script Debug Endpoints

Replace `YOUR_URL` with your Google Script URL from Settings.

### Test 1: Check What Matrix Sheets Exist
```
https://YOUR_URL?action=debugGradeSheets
```
**Expected:** See `Grade_Assessments_GRADE_7_T1_Opener` listed

**If empty:** No matrix sheets exist. Go to the app and click "Create Matrix Tab" first.

### Test 2: Check What's in Assessments Sheet
```
https://YOUR_URL?action=debugAssessments
```
**Expected:** Shows:
- `"totalRows": 150` (or similar - NOT 0)
- `"dataRows": [...]` with actual marks

**If totalRows = 0:** The sync didn't write any data. Check the matrix format below.

### Test 3: Test the Matrix Parser
```
https://YOUR_URL?action=debugSyncTest&sheetName=Grade_Assessments_GRADE_7_T1_Opener
```
(Replace sheet name with your actual matrix sheet name)

**Expected:** Shows:
- `"parsed": 150` (or similar - NOT 0)
- Sample records with studentId, subject, score

**If parsed = 0:** Matrix sheet format is wrong. See "Fix Matrix Sheet Format" below.

### Test 4: Force Complete Reload
```
https://YOUR_URL?action=forceReloadAll
```
**Expected:** Returns full data.json with assessments array

**After running this:** Clear browser cache (Ctrl+Shift+Delete) then refresh app

---

## Fix: Matrix Sheet Format

If Test 3 shows `"parsed": 0`, your matrix sheet format is wrong.

**Correct Format:**
```
Column A: Student ID (or Admission Number)
Column B: Student Name
Column C+: Subject Names (exact match required)

Row 1: Headers (Student ID, Student Name, Math, English, Science, ...)
Row 2+: Student marks (001, John Doe, 85, 90, 75, ...)
```

**Example:**
```
Student ID | Name        | Math | English | Science
001        | John Doe    | 85   | 90      | 75
002        | Jane Smith  | 92   | 88      | 95
003        | Bob Jones   | 78   | 82      | 88
```

**Common Issues:**
- ❌ Headers in wrong row (should be Row 1)
- ❌ Student names missing or empty
- ❌ Marks are text (like "Pass") instead of numbers (85)
- ❌ Subject names don't exactly match (e.g., "Math" vs "MATHEMATICS")
- ❌ Subject columns are not consecutive (missing columns in between)

---

## App Diagnostic Panel

Inside the app, look for the **"Data Status"** section (expand it):

Shows:
- **Total Assessments:** Should be > 0 after sync
- **Total Students:** Should match your school
- **Students in Grade:** Should be > 0 for selected grade
- **Subjects:** Should list all subjects for that grade
- **Matrix Rows:** Should match "Students in Grade" count

**What it means:**
- If "Total Assessments: 0" → Sync failed or backend empty
- If "Students in Grade: 0" → Wrong grade selected or no students in that grade
- If "Subjects: 0" → Subjects not configured for this grade (fix in Settings)
- If "Matrix Rows: 0" → Everything loaded but students/subjects filters blocking display

---

## Real-Time Diagnostic Script

Run this in browser console to see everything at once:

```javascript
const stored = JSON.parse(localStorage.getItem('edutrackData') || '{}');
console.log('=== EduTrack Diagnostic ===');
console.log('Assessments:', stored.assessments?.length, 'total');
console.log('Students:', stored.students?.length, 'total');
console.log('Settings URL:', stored.settings?.googleScriptUrl?.substring(0, 50) + '...');
console.log('Academic Year:', stored.settings?.academicYear);
console.log('Grades:', stored.settings?.grades);
console.log('Streams:', stored.settings?.streams);
console.log('Grade Subjects:', stored.settings?.gradeSubjects);
console.log('Last Modified:', stored.lastModified);
```

---

## Emergency Recovery

If nothing works:

### Option 1: Clear Everything and Reload
1. Run: `https://YOUR_URL?action=forceReloadAll`
2. Copy the returned JSON
3. Save it to a file (in case you need it)
4. In browser console:
   ```javascript
   localStorage.removeItem('edutrackData');
   location.reload();
   ```
5. Go back to app and manually re-sync

### Option 2: Manually Check Google Sheet
1. Open your Google Sheet
2. Go to "Assessments" tab
3. Check:
   - Row 1 has headers
   - Can you see data rows?
   - Any error messages?

### Option 3: Check Backend Logs
In Google Apps Script (`script.google.com`):
1. Open your project
2. Click **Execution log** (or Ctrl+K)
3. Look for `[SYNC]` or `[Assessment]` messages
4. Check for red error lines

---

## Summary Troubleshooting Tree

```
Is data showing?
├─ No (stop here)
│  ├─ Did you click "Sync Marks from Sheet"?
│  │  └─ No → Click it now, watch [Sync] logs
│  │  └─ Yes → Go to next
│  ├─ Check [Sync] console logs
│  │  ├─ "No assessments returned" → Backend empty
│  │  │  └─ Run: ?action=debugAssessments
│  │  │     └─ If empty → Run: ?action=debugSyncTest
│  │  │        └─ If empty → Fix matrix sheet format
│  │  │  └─ Run: ?action=debugSyncTest&sheetName=...
│  │  ├─ "Merge complete: 0 new" → Data exists but not matching
│  │  │  └─ Check student IDs match between sheets
│  │  │  └─ Check subject names are exact match
│  │  └─ Error message → Note exact error and report
│  └─ Check app "Data Status" panel
│     ├─ Assessments = 0 → Sync failed
│     └─ Assessments > 0 but empty grid → Filter issue
└─ Yes (great!)
   └─ Continue using app normally
```

---

## Contact Support

If still stuck, gather:
1. Screenshot of matrix sheet with marks
2. Output from `?action=debugAssessments`
3. Output from `?action=debugSyncTest&sheetName=Grade_Assessments_GRADE_7_T1_Opener`
4. Console [Sync] log output (F12 copy all)
5. Error message (if any)

Then contact support with this information.

---

## Last Resort: Manual Test

If automated tools fail, manually verify the pipeline:

1. **Step 1:** Check Google Sheet has matrix tab
   - Go to Google Sheet → Check tab exists
   
2. **Step 2:** Check matrix has data
   - Go to that tab → See marks there?
   
3. **Step 3:** Check backend can read it
   - Run: `?action=debugSyncTest&sheetName=Grade_Assessments_GRADE_7_T1_Opener`
   
4. **Step 4:** Check backend can write it
   - Run: `?action=ping` → Should say "ok"
   
5. **Step 5:** Check frontend loads Assessments sheet
   - Run: `?action=getAll` → Should show data
   
6. **Step 6:** Check frontend displays it
   - Go to app → Select grade → Check "Data Status" → See numbers?

If all pass, file a bug report with the exact step that failed.
