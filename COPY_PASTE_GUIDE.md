# Copy-Paste Guide: What Goes Where

## Simple Reference

### FOR GOOGLE APPS SCRIPT

**FILE:** `AssessmentMatrix.gs` (in your workspace)
**DESTINATION:** Google Apps Script project
**STEPS:**
1. Open entire file
2. Copy all (Ctrl+A, Ctrl+C)
3. Go to: https://script.google.com
4. New File → Script → Name: "AssessmentMatrix"
5. Paste (Ctrl+V)
6. Click Deploy → New Deployment → Web app
7. Copy the URL that appears

---

### FOR YOUR EDUTRACK APP

#### COPY #1: Component File
**FILE:** `AssessmentMatrix.js` (in workspace)
**DESTINATION:** `components/AssessmentMatrix.js` in your app
**ACTION:** Copy entire file to components folder
**Check:** File exists at `components/AssessmentMatrix.js`

#### COPY #2: app.js - Import Line
**FILE:** `app.js` (in your app, line ~26)
**FIND:** This section:
```javascript
import { Assessments } from './components/Assessments.js';
import { ResultAnalysis } from './components/ResultAnalysis.js';
```

**ADD AFTER:** Add this import line:
```javascript
import { AssessmentMatrix } from './components/AssessmentMatrix.js';
```

****CHECK:** No errors when saving (should show `✓` in VS Code)

#### COPY #3: app.js - Switch Case
**FILE:** `app.js` (in your app, line ~1100)
**FIND:** This section:
```javascript
case 'assessments': return html`
    <${Assessments} data=${data} setData=${setData} ...
`;
```

**ADD AFTER:** Add this case:
```javascript
case 'assessment-matrix': return html`
    <${AssessmentMatrix} data=${data} setData=${setData} isAdmin=${isAdmin} teacherSession=${teacherSession} allowedSubjects=${allowedTeacherSubjects} allowedGrades=${allowedTeacherGrades} allowedReligion=${allowedTeacherReligion} />
`;
```

**CHECK:** No errors when saving

#### COPY #4: Sidebar.js - Navigation Button
**FILE:** `Sidebar.js` (in your app)
**FIND:** Where other academic menu items are (usually near "Assessments")
**LOOK FOR:** Pattern like:
```javascript
<button onClick=${() => navigate('assessments')}...
```

**ADD AFTER:** Add this button:
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

**CHECK:** No errors when saving

---

### FOR SETTINGS

**WHERE:** EduTrack App → Settings
**SETTING:** Google Sheet Configuration / Google Script URL
**VALUE:** Paste the Google Apps Script deployment URL from Deploy step
**LOOKS LIKE:** `https://script.google.com/macros/d/ABC123XYZ.../userweb`
**SAVE:** Click Save

---

## In One Picture

```
┌─────────────────────────────────────────────────┐
│ GOOGLE APPS SCRIPT (ONE-TIME)                   │
├─────────────────────────────────────────────────┤
│ AssessmentMatrix.gs → Google Apps Script        │
│ (Just copy & paste, deploy, save URL)           │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ EDUTRACK APP (4 ADDITIONS)                      │
├─────────────────────────────────────────────────┤
│ 1. AssessmentMatrix.js → components/            │
│    (Copy whole file)                            │
│                                                 │
│ 2. app.js line ~26 → Add import statement       │
│    (1 line added)                               │
│                                                 │
│ 3. app.js line ~1100 → Add case statement       │
│    (5 lines added)                              │
│                                                 │
│ 4. Sidebar.js → Add navigation button           │
│    (12 lines added)                             │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ SETTINGS (ONE-TIME)                             │
├─────────────────────────────────────────────────┤
│ Settings → Google Script URL → Paste URL        │
│ (Save)                                          │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│ TEST & DEPLOY                                   │
├─────────────────────────────────────────────────┤
│ 1. npm run dev → Test locally                   │
│ 2. npm run build → Build for production         │
│ 3. Deploy normally → Live!                      │
└─────────────────────────────────────────────────┘
```

---

## Checklist

### Items to Copy
- [ ] Copy AssessmentMatrix.gs entire file
- [ ] Copy AssessmentMatrix.js entire file

### Items to Create/Paste
- [ ] Create/paste AssessmentMatrix.js in components/
- [ ] Paste Google Script URL in Settings

### Items to Add/Modify
- [ ] Add import in app.js (~1 line)
- [ ] Add case in app.js (~5 lines)
- [ ] Add button in Sidebar.js (~12 lines)

### Verification
- [ ] Google Script deployed successfully
- [ ] Got deployment URL
- [ ] URL pasted in Settings
- [ ] No errors in app code
- [ ] App starts without errors
- [ ] "Assessment Matrix" in sidebar
- [ ] Can click and load matrix
- [ ] Can enter marks
- [ ] Can create Google sheets

---

## File Sizes

| File | Size | Action |
|------|------|--------|
| AssessmentMatrix.gs | 17 KB | Copy entire to Google |
| AssessmentMatrix.js | 16 KB | Copy entire to components/ |
| Import statement | 1 line | Add to app.js |
| Switch case | 3 lines | Add to app.js |
| Nav button | 12 lines | Add to Sidebar.js |

---

## Total Additions to Your App

**app.js:**
- +1 import statement
- +3 lines for switch case
- Total: ~5 lines added

**Sidebar.js:**
- +1 navigation button
- Total: ~12 lines added

**components/ folder:**
- +1 new file (AssessmentMatrix.js)

**Total code addition:** ~19 lines + 1 component file

---

## Google Apps Script Deployment URL Format

When you deploy, you'll get something like:
```
https://script.google.com/macros/d/
  1h_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u/
  userweb
```

This is the URL you:
1. Copy after deployment
2. Paste into Settings → Google Script URL
3. Save in settings

**Don't modify it** - use exactly as provided by Google.

---

## If You Make Mistakes

### Can't find the import location in app.js?
Search for: `import { Assessments }`
Add after that line

### Can't find the switch case in app.js?
Search for: `case 'assessments':`
Add after that case

### Can't find where to add Sidebar button?
Search for: `assessments` in Sidebar.js
Add navigation button near there

### Google URL doesn't work?
1. Check you copied the ENTIRE URL including `/userweb`
2. Check for spaces at beginning/end (trim them)
3. Redeploy and get new URL

---

## Need Help?

**For deployment:** DEPLOYMENT_CHECKLIST.md
**For app integration:** APP_INTEGRATION_CHECKLIST.md
**For complete steps:** GET_STARTED.md
**For troubleshooting:** ASSESSMENT_MATRIX_GUIDE.md

---

## You're Ready!

Everything is prepared for copy-paste deployment.
Just follow the steps above and you're done in 20 minutes.

🚀 Let's go!
