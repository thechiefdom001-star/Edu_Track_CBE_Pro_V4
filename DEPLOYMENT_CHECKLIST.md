# 🚀 Google Apps Script - Deployment Checklist

## What You Need to Do

You have **ONE main file** to copy and deploy:

### Copy This File
📄 **AssessmentMatrix.gs** (entire content)

Location: `c:\Users\USER\Desktop\SOFTWARES\EDUTRACK SCHOOL SOFTWARE\AssessmentMatrix.gs`

---

## Step-by-Step Deployment

### STEP 1: Open Google Apps Script

1. Go to: https://script.google.com
2. Open your EduTrack project (associated with your Google Sheet)
3. Click **`+ New File`** (top left)
4. Select **Script**
5. Name it: **`AssessmentMatrix`**

### STEP 2: Copy & Paste Code

1. Open `AssessmentMatrix.gs` from your workspace
2. Select ALL content (Ctrl+A)
3. Copy (Ctrl+C)
4. Go to Google Apps Script editor
5. Delete any placeholder code
6. Paste the code (Ctrl+V)
7. **DO NOT MODIFY THE CODE** - It's ready to deploy

### STEP 3: Deploy as Web App

1. Click **▼ Deploy** button (top right)
2. Select **New Deployment**
3. Choose type: Click the gear icon then **Web app**
4. In the form:
   - **Execute as:** Your account
   - **Who has access:** Anyone
5. Click **Deploy** button
6. Google may ask for permissions - Click **Review** and approve

### STEP 4: Get & Save the URL

1. You'll see: "Deployment successful"
2. Copy the **URL** that looks like:
   `https://script.google.com/macros/d/ABC123XYZ.../userweb`
3. Save this URL somewhere safe

### STEP 5: Update EduTrack Settings

1. Open your EduTrack app
2. Go to **Settings**
3. Find: **Google Sheet Configuration** or **Google Script URL**
4. Paste the URL from Step 4
5. Click **Save**
6. Test by clicking "☁️ Sheet" button in Assessment Matrix

---

## What Each File Does

✅ **AssessmentMatrix.gs** (The only file you need to deploy)
   - Handles Google Sheets matrix creation
   - Syncs data between app and Google Sheets
   - Creates formatted sheet layouts
   - Validates data
   - **Single file, 500+ lines, production-ready**

✅ **AssessmentMatrix.js** (Already provided, just copy to components/)
   - Frontend React component
   - Matrix UI display
   - Cell editing

---

## Quick Verification

After deployment, verify in your app:

✅ **Settings shows the Google URL**
✅ **Assessment Matrix page loads**
✅ **Can select a grade and see students**
✅ **Can click a cell and get Google Sheet creation dialog**
✅ **"☁️ Sheet" button works**

---

## If Something Goes Wrong

### Error: "Permission denied"
→ Make sure you're deploying as **Your Account**

### Error: "Invalid URL"
→ Make sure you copied the entire URL including `/userweb`

### Sheets not creating
→ Check if Google URL is set in Settings

### Script errors
→ Open https://script.google.com → Project → Executions tab
→ Look for red errors

---

## Need to Update Later?

If you make changes to `AssessmentMatrix.gs`:

1. Copy the new code
2. Paste into your Google Apps Script file
3. Click **Deploy** → Update deployment (not new)
4. Select the existing deployment
5. Click **Update**
6. **Same URL, no need to update settings**

---

## Summary

| Item | Action |
|------|--------|
| **Files to copy** | AssessmentMatrix.gs only |
| **Destination** | Google Apps Script new file |
| **File name** | AssessmentMatrix |
| **Deployment type** | Web app |
| **Execute as** | Your Account |
| **Who has access** | Anyone |
| **Copy URL** | Yes, add to Settings |
| **Modify code** | NO - use as-is |
| **Time needed** | ~5 minutes |

---

## Success Indicators

✅ Web app deployed successfully
✅ Got a deployment URL
✅ App Settings updated with URL
✅ Assessment Matrix showing in sidebar
✅ Can select grade and see students
✅ Can create Google Sheets matrices
✅ Matrix sheets appear in your Google Sheet
✅ Data syncs between app and sheets

---

**That's it! You're ready to deploy. 🎉**

The code is production-ready and handles errors gracefully.
