# Two-Way Sync Implementation Guide

## Overview
This document explains the two-way synchronization system between the EduTrack frontend application and Google Sheets for member (students, teachers, staff, assessments) management.

---

## Problem Statement
Previously, when users deleted a member (student, teacher, staff, assessment) in the frontend application, the deletion would NOT automatically sync to the Google Sheet. Additionally, if someone deleted a member directly in the Google Sheet, the frontend wouldn't reflect this change.

**Solution**: Implemented a bidirectional sync system using:
1. **Frontend → Sheet**: POST requests with proper JSON encoding
2. **Sheet → Frontend**: Detection mechanism that compares local data with sheet data to identify deletions

---

## Architecture

### Components Updated

#### 1. **Google Apps Script** (`google-apps-script.gs`)
- **Handler**: `case 'deleteRecord'` in `doPost()` function
- **Function**: `deleteRecord(sheetName, keyField, keyValue, headers)`
- **Improvement**: Added detailed logging for debugging

#### 2. **Frontend Sync Service** (`lib/googleSheetSync.js`)

**New Methods:**
- `deleteRecord(sheetName, recordId)` - Enhanced to use POST requests instead of GET
  - Uses proper JSON body encoding for reliability
  - Returns success/error with clear messages
  - Logs deletion attempts for debugging

- `detectDeletions(sheetName, localRecords)` - NEW
  - Fetches current data from Google Sheet
  - Compares local IDs with sheet IDs
  - Returns array of deleted IDs
  - Works universally for any sheet (Students, Teachers, Staff, Assessments, etc.)

#### 3. **Component Updates**

**Students.js**
```javascript
// NEW: handleSyncDeletions() function
// Button: "↻ Sync from Sheet" (purple button)
// Detects students deleted in sheet and removes them locally
// Also removes related assessments for deleted students
```

**Teachers.js**
```javascript
// NEW: handleSyncDeletions() function
// Button: "↻ Sync from Sheet" (purple button)
// Detects teachers deleted in sheet
```

**Staff.js**
```javascript
// NEW: handleSyncDeletions() function
// Button: "↻ Sync from Sheet" (purple button)
// Detects staff deleted in sheet
```

**Assessments.js**
```javascript
// NEW: handleSyncDeletions() function
// Button: "↻ Sync from Sheet" (purple button)
// Detects assessments deleted in sheet
```

---

## Workflow

### Deleting from Frontend (Existing)
1. User clicks "Delete" on a member record
2. Local data is updated immediately
3. DELETE request is sent to Google Apps Script
4. Google Sheet is updated
5. Status message: "✓ Deleted from Sheet!"

### Detecting Sheet Deletions (NEW)
1. User clicks "↻ Sync from Sheet" button (only visible if Google Sheet is configured)
2. Frontend fetches all current data from Google Sheet
3. Compares local member IDs with sheet member IDs
4. Identifies members that exist locally but NOT in the sheet (deleted remotely)
5. Removes deleted members from local data
6. For Students, also removes related assessments
7. Status message: "✓ Synced! Removed X deleted member(s)"

---

## Data Flow Diagram

```
Frontend Local Store
        ↓
Delete Click
        ↓
[Update locally immediately]
        ↓
Send POST to Google Apps Script
        ↓
Google Sheet Updated
        ↓
User sees: "✓ Deleted from Sheet!"

════════════════════════════════

Google Sheet
        ↓
User deletes row directly
        ↓
User clicks "Sync from Sheet"
        ↓
Fetch all data from Sheet
        ↓
Compare IDs (Local vs Sheet)
        ↓
Find deleted IDs
        ↓
Remove from Local Store
        ↓
User sees: "✓ Synced! Removed X"
```

---

## API Endpoints

### Google Apps Script POST Handler
**Endpoint**: Your Google Apps Script URL

**Delete Request**:
```javascript
POST {googleScriptUrl}
Content-Type: application/json

{
  "action": "deleteRecord",
  "sheetName": "Students" | "Teachers" | "Staff" | "Assessments",
  "recordId": "unique-id-value"
}
```

**Response**:
```javascript
{
  "success": true,
  "message": "Record deleted successfully"
}
```

**Fetch All Data** (reusable for detection):
```javascript
GET {googleScriptUrl}?action=getAll
```

---

## Technical Details

### Why POST for Deletes?
- **Reliability**: JSON body encoding prevents special character issues
- **Consistency**: Matches other operations (add, update)
- **Debugging**: Easier to log complete request data
- **Future-proof**: Can handle more complex delete scenarios

### Deletion Detection Logic
```javascript
// Algorithm in detectDeletions()
1. Get local records: [id1, id2, id3, ...]
2. Fetch sheet records: [id1, id3, ...]
3. Find deleted: localIds - sheetIds = [id2]
4. Filter local data to remove deleted IDs
```

### Cascade Deletions
When a student is deleted via sheet sync:
- Student record is removed from local data
- ALL related assessments for that student are also removed
- This maintains data integrity

---

## User Guide

### For End Users

**To sync deletions from Google Sheet:**
1. Open the Students, Teachers, Staff, or Assessments tab
2. Look for the purple "↻ Sync from Sheet" button
3. Click the button
4. Wait for the sync to complete
5. You'll see a status message:
   - ✓ Green success message if deletions were found
   - ✓ "No remote changes detected" if everything is in sync

**Example Scenarios:**

*Scenario 1: Delete from Frontend*
- Click "Delete" on a student
- Confirm the deletion dialog
- Status: "✓ Deleted from Sheet!"
- Student is gone from both app and Google Sheet

*Scenario 2: Delete from Google Sheet*
- Go to Google Sheet and manually delete a student row
- Return to app
- Click "↻ Sync from Sheet" button
- Status: "✓ Synced! Removed 1 deleted student(s)"
- Student is now gone from the app too

*Scenario 3: Multiple Deletions*
- Someone deletes 5 students in Google Sheet
- Click "↻ Sync from Sheet"
- Status: "✓ Synced! Removed 5 deleted student(s)"

---

## Configuration

### Requirements
- Google Apps Script must be deployed as Web App
- Google Sheet URL must be configured in Settings → Teacher Data Sync
- Proper sheet names must exist: Students, Teachers, Staff, Assessments

### Setup
1. Go to **Settings** tab
2. Scroll to **Teacher Data Sync** section
3. Enter your Google Apps Script URL
4. Save settings
5. The "↻ Sync from Sheet" buttons will now appear

---

## Troubleshooting

### Sync Button Not Appearing
- **Cause**: Google Sheet URL not configured
- **Fix**: Go to Settings and add the Google Apps Script URL

### "Checking for remote deletions..." Shows Forever
- **Cause**: Network issue or Google Sheet unreachable
- **Fix**: 
  - Check internet connection
  - Verify Google Apps Script URL is correct and deployed
  - Try again after a few seconds

### Deletions Not Syncing from Sheet
- **Cause**: Manual deletion wasn't done correctly
- **Fix**: 
  - Make sure you deleted the entire row in Google Sheet (not just cleared cells)
  - Make sure the ID column contains the exact value
  - Try manual sync again

### Error: "⚠ Sync check failed"
- **Cause**: Communication error with Google Apps Script
- **Fix**:
  - Verify Google Apps Script is deployed
  - Check if script needs redeployment
  - Try again after a moment

---

## Logs and Debugging

### Console Logs
Enable browser console (F12) to see:
- Successful deletions: `✓ Deleted {id} from {Sheet} in Google Sheet`
- Detection results: Deletion count and IDs
- Error details: Network or parsing errors

### Google Apps Script Logs
In Google Apps Script editor:
- Go to **Execution logs**
- Look for `POST action: deleteRecord` entries
- Watch for successful deletions or error messages

---

## Future Enhancements

1. **Automatic Periodic Sync**
   - Background service to detect changes every 5 minutes
   - Push notifications when changes detected

2. **Conflict Resolution**
   - Handle simultaneous edits in sheet and frontend
   - Merge unsaved changes instead of overwriting

3. **Batch Operations**
   - Bulk delete multiple records at once
   - Sync all changes in one operation

4. **Audit Trail**
   - Log all deletions with timestamp and user
   - Track who deleted what and when

---

## Support & Issues

**If sync isn't working:**
1. Check if Google Sheet is properly configured
2. Verify there's an internet connection
3. Check browser console for error messages
4. Try clicking "Sync from Sheet" again
5. If persisting, check Google Apps Script logs

**For technical support:**
- Review the code in `lib/googleSheetSync.js`
- Check `detectDeletions()` method implementation
- Review `google-apps-script.gs` `deleteRecord()` function

---

## Summary

The two-way sync system ensures that:
✅ Deletions from the frontend are always pushed to Google Sheet
✅ Deletions from Google Sheet can be pulled into the frontend
✅ Users have full visibility and control with clear status messages
✅ Data remains consistent across both systems
✅ Cascade deletions maintain data integrity
