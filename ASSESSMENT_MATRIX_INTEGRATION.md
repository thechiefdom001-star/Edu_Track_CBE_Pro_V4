# Assessment Matrix - Integration Guide

This guide explains how to integrate the Assessment Matrix feature into your existing EduTrack application.

## Files Created

1. **AssessmentMatrix.gs** - Google Apps Script for matrix sheet management
2. **AssessmentMatrix.js** - Preact component for the UI
3. **ASSESSMENT_MATRIX_GUIDE.md** - User documentation

## Step 1: Add Google Apps Script

### 1.1 Standalone Deployment (Recommended - Simplest)

This is the recommended approach for easiest deployment:

1. Open your Google Apps Script project (associated with your Google Sheet)
2. Create a new file: **Click `+ New file` → Script**
3. Name it: `AssessmentMatrix`
4. Copy and paste the **entire code from `AssessmentMatrix.gs`**
5. **Do NOT modify anything** - the code is ready to deploy as-is

### 1.2 Integration with Existing doPost (Advanced)

If you already have custom POST handlers in your Apps Script, you have two options:

**Option A: Keep separate (RECOMMENDED)**
- Deploy AssessmentMatrix as a separate web app
- Use separate URL for matrix operations
- Simpler, no conflicts

**Option B: Integrate into existing doPost**
- Edit your existing `doPost()` function
- Add this check at the beginning:

```javascript
function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    
    // MATRIX REQUESTS - Use AssessmentMatrix handlers
    if (request.action && request.action.includes('MATRIX')) {
      return ContentService.createTextOutput(JSON.stringify(handleMatrixRequest(request)))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // YOUR EXISTING CODE - Continue with your original handlers
    // ... rest of your doPost function ...
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

Then ensure `handleMatrixRequest()` is defined (it is at the end of AssessmentMatrix.gs).

### 1.3 Redeploy Your Google Apps Script

1. Click **Deploy** button (top right)
2. Select **New Deployment** (or **Manage Deployments** if this is an update)
3. Choose type: **Web app**
4. Execute as: **Your Account**
5. Who has access: **Anyone**
6. Click **Deploy** (or **Update**)
7. Copy the deployment URL
8. Add to your app settings: `Settings → googleScriptUrl = [YOUR_URL]`

**Important:** 
- Each new deployment creates a NEW URL
- Update your `googleScriptUrl` setting with the new deployment URL
- Keep the old deployment URL handy if you need to rollback

## Step 2: Update app.js

### 2.1 Import the Component

Add this import at the top of `app.js` with the other component imports:

```javascript
import { AssessmentMatrix } from './components/AssessmentMatrix.js';
```

### 2.2 Add Component Switch Case

Find the section with other component renders (around line 1071) and add this case for assessment matrix:

```javascript
case 'assessments': return html`
    <${Assessments} data=${data} setData=${setData} isAdmin=${isAdmin} teacherSession=${teacherSession} allowedSubjects=${allowedTeacherSubjects} allowedGrades=${allowedTeacherGrades} allowedReligion=${allowedTeacherReligion} />
`;
case 'assessment-matrix': return html`
    <${AssessmentMatrix} data=${data} setData=${setData} isAdmin=${isAdmin} teacherSession=${teacherSession} allowedSubjects=${allowedTeacherSubjects} allowedGrades=${allowedTeacherGrades} allowedReligion=${allowedTeacherReligion} />
`;
```

## Step 3: Update Sidebar Navigation

### 3.1 Find Sidebar.js

Open `components/Sidebar.js` and find the section with navigation items for "Assessments" or "Marklist".

### 3.2 Add Assessment Matrix Navigation Item

Add this navigation item (adjust styling to match your existing items):

```javascript
// In the menu items section
{
  id: 'assessment-matrix',
  label: '📊 Assessment Matrix',
  icon: '📊',
  category: 'Academic',
  requiresAdmin: false,   // Teachers can also access
  requiredView: 'assessment-matrix'
}
```

### 3.3 Add to Navigation JSX

Add this button in the navigation section:

```javascript
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
```

## Step 4: Test Integration

### 4.1 Local Testing

1. Start your application: `npm run dev` or equivalent
2. Navigate to dashboard
3. Look for "Assessment Matrix" in the sidebar/menu
4. Click to open
5. Select a grade and verify students load
6. Try entering a mark in a cell

### 4.2 Google Sheets Testing (Admin Only)

1. Select a grade, term, and exam type
2. Click "☁️ Sheet" button
3. Confirm creation
4. Wait for success message
5. Go to your Google Sheet and verify new sheet was created
6. Sheet name should be: `Grade_Assessments_Grade1_T1_Opener` (example)
7. Verify:
   - Headers have subjects
   - Students are in rows
   - Formatting is correct (blue header, alternating row colors)

### 4.3 Data Sync Testing

1. Enter a mark in Assessment Matrix
2. Go to your Google Sheet and check if it appears
3. Go to Assessments view in your app
4. Verify the assessment appears there too
5. Change a mark in the matrix
6. Verify it updates everywhere

## Step 5: Configure Settings

### 5.1 Update Google Script URL

1. In Settings section of EduTrack
2. Find "Google Sheet Configuration"
3. Paste your new Google Apps Script deployment URL
4. Click Save

### 5.2 Ensure Grade Subjects are Configured

Go to Settings → Grades Configuration and verify:

```
Grade 1:
  - English
  - Mathematics
  - Science
  - Social Studies

Grade 2:
  - English
  - Mathematics
  - Science
  - Social Studies
  ... (etc)
```

## Step 6: Optional Enhancements

### 6.1 Add Assessment Matrix Dashboard Widget

Update `Dashboard.js` to show matrix status:

```javascript
// Add to dashboard
<div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
  <h3 class="font-bold text-blue-900">📊 Assessment Matrices</h3>
  <p class="text-sm text-blue-700 mt-2">
    Use the Assessment Matrix for faster data entry by subject and student.
  </p>
  <button 
    onClick=${() => navigate('assessment-matrix')}
    class="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
  >
    Open Matrix →
  </button>
</div>
```

### 6.2 Add Matrix Export to Print Menu

Update `PrintButtons.js`:

```javascript
// Add to print options
{
  label: 'Assessment Matrix (CSV)',
  action: 'export-matrix',
  icon: '📊',
  description: 'Export current assessment matrix as CSV'
}
```

### 6.3 Add Bulk Matrix Creation

Add to Settings or Admin panel:

```javascript
<button
  onClick=${bulkCreateMatrices}
  class="px-4 py-2 bg-green-600 text-white rounded"
>
  Create All Matrices
</button>

function bulkCreateMatrices() {
  // Calls Google Apps Script to create matrices for all grades/terms/exams
  fetch(settings.googleScriptUrl, {
    method: 'POST',
    body: JSON.stringify({
      action: 'BULK_CREATE_MATRICES'
    })
  });
}
```

## Step 7: Troubleshooting Integration

### Issue: "AssessmentMatrix component not found"
**Solution:** Verify you imported it correctly at the top of app.js
```javascript
import { AssessmentMatrix } from './components/AssessmentMatrix.js';
```

### Issue: "view === 'assessment-matrix' is not rendering"
**Solution:** Ensure the case statement has `assessment-matrix` (with hyphen)
```javascript
case 'assessment-matrix': return html`...`
```

### Issue: "Matrix button doesn't appear in sidebar"
**Solution:** Check Sidebar.js has the navigation item added

### Issue: "Google Sheets not created"
**Solution:** 
1. Verify googleScriptUrl is in Settings
2. Check Google Apps Script code was copied correctly
3. Verify script was deployed and URL was updated
4. Check browser console for error messages

### Issue: "Marks not syncing to Google Sheets"
**Solution:**
1. Check googleScriptUrl is correct in Settings
2. Wait 30+ seconds (cooldown between syncs)
3. Try creating a new matrix
4. Check Google Sheets has edit permissions

## Data Migration Path

If you have existing assessments in the flat table format:

### Automatic Migration
The Assessment Matrix automatically reads from the existing Assessments sheet. No migration needed - the system works with both views simultaneously.

### Manual Verification
To verify existing data:
1. Go to Assessment Matrix view
2. Select a grade that has existing assessments
3. Subject marks should appear in the matrix
4. If not appearing, check:
   - Grade spelling matches (case-insensitive)
   - Subject names match exactly
   - Assessments have scores (0-100)

## Performance Optimization

### For Large Installations

If you have 1000+ students or 20+ grades:

1. **Lazy Load Matrices**: Create matrices on-demand only
2. **Cache Matrix Sheets**: Keep recent matrices, archive old ones
3. **Batch Sync**: Sync in smaller batches (implemented by default)

### Monitor Performance

Add to your testing:
```javascript
console.time('matrix-render');
// ... render assessment matrix
console.timeEnd('matrix-render');
```

Expected times:
- Small class (50 students, 10 subjects): < 1s
- Medium class (100 students, 15 subjects): 1-2s
- Large class (200+ students, 20+ subjects): 2-5s

## Rollback Plan

If you need to revert:

### 1. Remove from app.js
- Delete the import statement
- Delete the case statement for 'assessment-matrix'

### 2. Remove from Sidebar.js
- Delete the navigation item

### 3. Clean up Google Sheets
- Delete matrix sheets (optional - they can remain unused)

### 4. Keep Google Apps Script
- Leave AssessmentMatrix functions in place (they won't interfere)

## Next Steps

1. ✅ Complete all integration steps above
2. ✅ Test locally before deploying
3. ✅ Create backup of Google Sheet before first matrix
4. ✅ Train teachers on using Assessment Matrix
5. ✅ Monitor sync performance in production
6. ✅ Gather feedback for improvements

## Support & Questions

If integration issues arise:

1. **Check this guide** - Most issues have solutions listed
2. **Check browser console** - F12 → Console tab shows errors
3. **Check Google Apps Script** - Apps Script → Execution logs shows GAS errors
4. **Verify Settings** - Ensure googleScriptUrl is correct

## Success Indicators

Your integration is successful when:
- ✅ Assessment Matrix appears in sidebar
- ✅ Can select grade and see students
- ✅ Can enter marks and they save locally
- ✅ Can create Google Sheets matrices
- ✅ Data syncs between app and Google Sheets
- ✅ CSV export works
- ✅ Teachers can only see their assigned grades/subjects
