# App Integration - Quick Checklist

After deploying the Google Apps Script, integrate into your app:

## FILE 1: app.js (Add Import)

**Location:** `app.js` line ~26 (with other component imports)

**Find this section:**
```javascript
import { Assessments } from './components/Assessments.js';
import { ResultAnalysis } from './components/ResultAnalysis.js';
```

**Add this line after Assessments import:**
```javascript
import { AssessmentMatrix } from './components/AssessmentMatrix.js';
```

---

## FILE 2: app.js (Add Switch Case)

**Location:** `app.js` line ~1100 (in the renderView function switch statement)

**Find this section:**
```javascript
case 'assessments': return html`
    <${Assessments} data=${data} setData=${setData} isAdmin=${isAdmin} teacherSession=${teacherSession} allowedSubjects=${allowedTeacherSubjects} allowedGrades=${allowedTeacherGrades} allowedReligion=${allowedTeacherReligion} />
`;
```

**Add this case right after 'assessments' case:**
```javascript
case 'assessment-matrix': return html`
    <${AssessmentMatrix} data=${data} setData=${setData} isAdmin=${isAdmin} teacherSession=${teacherSession} allowedSubjects=${allowedTeacherSubjects} allowedGrades=${allowedTeacherGrades} allowedReligion=${allowedTeacherReligion} />
`;
```

---

## FILE 3: Sidebar.js (Add Navigation)

**Location:** `components/Sidebar.js` (in the navigation items section)

**Find where other academic menu items are** (usually near "Assessments" or "Marklist")

**Add this navigation item:**
```javascript
html`
  <button
    onClick=${() => navigate('assessment-matrix')}
    class=${`w-full text-left px-4 py-3 flex items-center gap-3 rounded-lg transition whitespace-nowrap ${
      currentView === 'assessment-matrix' 
        ? 'bg-blue-600 text-white' 
        : 'hover:bg-slate-100 text-slate-700'
    }`}
  >
    <span class="text-lg">📊</span>
    <span class="font-medium">Assessment Matrix</span>
  </button>
`
```

---

## FILE 4: Copy Component File

**Source:** Create new file in your workspace
**Content:** Copy entire `AssessmentMatrix.js`
**Destination:** `components/AssessmentMatrix.js`

---

## Verification Checklist

After making all changes:

- [ ] Import statement added to app.js
- [ ] Switch case added to app.js (case 'assessment-matrix')
- [ ] Navigation button added to Sidebar.js
- [ ] AssessmentMatrix.js file exists in components/
- [ ] No syntax errors in modified files
- [ ] App starts without errors: `npm run dev`
- [ ] Can see "📊 Assessment Matrix" in sidebar
- [ ] Can click it and it loads the matrix view
- [ ] Can select a grade and see students

---

## Exact Line Numbers Reference

Use Ctrl+G in VS Code to go to exact lines:

| File | Line | Action |
|------|------|--------|
| app.js | ~26 | Add import statement |
| app.js | ~1100 | Add case 'assessment-matrix' |
| Sidebar.js | ? | Find "assessments" nav item |
| Sidebar.js | after | Add new button |

---

## Testing After Integration

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Check for errors:**
   - Open browser console (F12)
   - Look for red errors
   - Fix any imports not found

3. **Test navigation:**
   - Click "📊 Assessment Matrix" in sidebar
   - Should load the matrix component
   - Should show grade selector

4. **Test functionality:**
   - Select a grade
   - Click on a cell
   - Try entering a mark
   - Mark should save

5. **Test Google integration:**
   - Ensure Settings has Google Script URL
   - Click "☁️ Sheet" button
   - Should create a matrix in Google Sheets

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| "Cannot find module AssessmentMatrix" | Check import path is `./components/AssessmentMatrix.js` |
| Blue screen with no matrix | Check console for errors (F12) |
| No "Assessment Matrix" in sidebar | Check button code added to Sidebar.js |
| Marks not saving | Check Settings has Google Script URL |
| Cannot create Google sheet | Check Google Apps Script deployment |

---

## Summary of Changes

**Total lines to add:** ~30 lines across 2 files
**Files to modify:** 2 (app.js, Sidebar.js)
**Files to copy:** 1 (AssessmentMatrix.js)
**Time:** ~10 minutes

---

**Next Step:** After integration, deploy to production and test with real data.
