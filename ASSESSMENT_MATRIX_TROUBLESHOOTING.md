# 🔍 Assessment Matrix Troubleshooting Guide

## Problem: No Assessment Data Showing

If you see an empty matrix with "No data" or "0 records", follow these steps:

---

## Step 1: Check Backend Data (Google Sheet)

### 1a: Verify Assessments Sheet has data
1. Open your **Google Sheet**
2. Find the **"Assessments"** tab (the main flat table)
3. Should have rows like:
   - Row 1: Headers (id, studentId, subject, score, term, examType, ...)
   - Row 2+: Data rows with marks

**If empty:** The sync didn't write any data. Go to Step 2 below.

---

## Step 2: Debug Dashboard - Check What Data Exists

In your browser console, run these commands:

### Check 1: What matrix sheets exist?
```javascript
fetch('YOUR_GOOGLE_SCRIPT_URL?action=debugGradeSheets')
  .then(r => r.json())
  .then(d => console.log('Matrix sheets:', d.gradeSheets))
```

**Expected:** See your matrix sheet name, e.g., `Grade_Assessments_GRADE_7_T1_Opener`

### Check 2: What's in the Assessments sheet?
```javascript
fetch('YOUR_GOOGLE_SCRIPT_URL?action=debugAssessments')
  .then(r => r.json())
  .then(d => console.log('Assessments:', d.assessmentSheet))
```

**Expected:** Should see totalRows > 0 and dataRows showing your marks

### Check 3: Test the sync parser
```javascript
fetch('YOUR_GOOGLE_SCRIPT_URL?action=debugSyncTest&sheetName=Grade_Assessments_GRADE_7_T1_Opener')
  .then(r => r.json())
  .then(d => console.log('Sync test:', d))
```

**Expected:** Shows how many records were parsed

### Check 4: Force reload all data (clears cache)
```javascript
fetch('YOUR_GOOGLE_SCRIPT_URL?action=forceReloadAll')
  .then(r => r.json())
  .then(d => console.log('Reloaded:', d.assessments.length, 'assessments'))
```

---

## Step 3: Frontend Data Check

### Check if assessments are loaded in app
Open browser console and run:
```javascript
// This only works in the app context
console.log('Total assessments in app:', window.__ASSESSMENT_COUNT || 'unknown')
```

Or check localStorage directly:
```javascript
const stored = JSON.parse(localStorage.getItem('edutrackData') || '{}');
console.log('Assessments in storage:', stored.assessments?.length || 0);
console.log('Students in storage:', stored.students?.length || 0);
```

---

## Step 4: Manual Fix - Force Reload Complete Data

### Option 1: Clear Cache and Reload (Browser)
1. Press **Ctrl+Shift+Delete** (Windows) or **Cmd+Shift+Delete** (Mac)
2. Select "All time" and "Cookies and cached images"
3. Click **Clear data**
4. Go to the app URL
5. Hard refresh: **Ctrl+F5** or **Cmd+Shift+R**

### Option 2: Manual Fetch in Frontend
1. Go to Settings section
2. Scroll to **"Teacher Data Sync"**
3. Look for a **"Force Reload"** or **"Refresh Data"** button (if available)
4. OR run this in console to force full fetch:

```javascript
// This forces a complete re-fetch of all data from Google
fetch('https://YOUR_GOOGLE_SCRIPT_URL?action=getAll')
  .then(r => r.json())
  .then(d => {
    console.log('Fetched from Google:');
    console.log('- Students:', d.students?.length);
    console.log('- Assessments:', d.assessments?.length);
    console.log('- Full response:', d);
  })
```

---

## Step 5: Verify Matrix Sheet Format

Your matrix sheet MUST have this exact format:

```
Column A: Student ID/Admission Number
Column B: Student Name  
Column C: First Subject Name
Column D: Second Subject Name
... etc

Row 1: Headers
Row 2+: Student marks
```

**Example:**
```
Student ID | Student Name | Math | English | Science | History
001        | John Doe     | 85   | 90      | 75      | 80
002        | Jane Smith   | 92   | 88      | 95      | 91
```

**If format is wrong:** Edit the sheet and fix it, then try SYNC again.

---

## Step 6: Try the Sync Again

1. Go to **Assessment Matrix** in the app
2. Select **Grade**, **Term**, **Exam Type** that match your matrix sheet
3. Click **"SYNC MARKS FROM SHEET"**
4. Watch for success message
5. Check browser console (F12) for errors
6. If errors, report them to support with screenshot

---

## Step 7: Check Console Output During Sync

Open browser console (F12 → Console tab) and look for:

### Good signs (should see):
```
[SYNC] Parsing matrix: "Grade_Assessments_GRADE_7_T1_Opener"
[SYNC] Parsed X assessments from matrix
[SYNC] Updated: STUDENT_ID SUBJECT_NAME → SCORE
[SYNC] ✓ Synced X marks from matrix sheet
```

### Bad signs (error messages):
```
[SYNC] Sheet not found: "..."
[SYNC] Could not parse sheet name
[SYNC] No valid assessments parsed
```

If you see bad signs, **report the exact error message**.

---

## Step 8: Check Google Apps Script Logs

In Google Apps Script console:
1. Go to **script.google.com**
2. Open your project
3. Click **Ctrl+K** or **Extensions → Apps Script**
4. Click **Execution log** 
5. Look for `[SYNC]` and `[Assessment]` messages
6. Report any error messages

---

## Common Issues & Solutions

### Issue: "Sheet not found"
**Fix:** Go to Settings and enter the CORRECT Google Sheet URL from the deployment (not the spreadsheet URL)

### Issue: "No valid assessments parsed"
**Fix:** Check that:
1. Column A has student IDs (not empty)
2. Column B has student names  
3. Columns C+ have numeric marks (not text like "Pass/Fail")
4. Row headers match actual subject names exactly

### Issue: "0 records" after sync
**Fix:** 
1. Try the debug check above
2. Might be matching issue - check student IDs match between sheets
3. Clear browser cache completely (Ctrl+Shift+Delete)
4. Refresh page (Ctrl+F5)

### Issue: Only showing some students/marks
**Fix:** Check that:
1. All students are in the "Students" sheet
2. All subjects have the same exact names as configured in settings
3. No typos in student IDs or names

---

## Debug Command Reference

Replace `YOUR_GOOGLE_SCRIPT_URL` with your actual deployment URL from Settings.

| Command | Purpose |
|---------|---------|
| `?action=ping` | Test connection to Google Apps Script |
| `?action=debugGradeSheets` | List all matrix sheets |
| `?action=debugAssessments` | Show what's in Assessments sheet |
| `?action=debugSyncTest&sheetName=XXXX` | Test parsing a specific sheet |
| `?action=forceReloadAll` | Reload all data fresh (cache cleared) |
| `?action=getAll` | Fetch complete dataset |
| `?action=listMatrices` | Show all matrix sheets with preview |

---

## Still Not Working?

Gather this info and report:
1. **Screenshot** of the matrix sheet (with marks visible)
2. **Sheet name** exactly as it appears in the tab
3. **Console output** (F12 → Console) showing errors
4. **Google Apps Script logs** (Ctrl+K) if available
5. **Steps you've tried** from this guide

Then contact support with these details.

---

## Quick Checklist

- [ ] Matrix sheet has proper format (Student ID, Name, then subjects)
- [ ] All marks are numbers (not text)
- [ ] Sheet name matches exactly: `Grade_Assessments_GRADE_7_T1_Opener`
- [ ] You've clicked "SYNC MARKS FROM SHEET" button
- [ ] No red errors in browser console
- [ ] Cache cleared and page refreshed (Ctrl+F5)
- [ ] Google Apps Script deployed (not just saved)

If all checked, the data should be visible! 🎉
