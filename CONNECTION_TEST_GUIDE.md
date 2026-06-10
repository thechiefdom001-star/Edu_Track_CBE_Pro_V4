# Connection Test & Deployment Guide

## Problem Fixed ✅

1. **CORS Headers** - Added to all API responses
2. **Sheet Headers** - Now auto-initialized on every request
3. **Localhost Limitation** - Provided alternative test method

---

## 📋 Step-by-Step Deployment

### Step 1: Deploy Updated Script

1. Go to **Google Apps Script Editor** (your GAS project)
2. Replace `google-apps-script.gs` with the updated version
3. Click **Deploy** → Select **New deployment** → **Type: Web app**
4. Set: "Execute as: YOUR_EMAIL" and "Who has access: Anyone"
5. Copy the **Deployment URL** (you'll need this)

### Step 2: Initialize Sheets

After deployment, the sheets will auto-initialize on first request. But you can manually ensure they have headers:

```javascript
// In Google Apps Script Console (Apps Script Editor → Execute)
// Run this function to manually initialize all sheets:
initializeSheets()
```

Result: All sheets will have proper headers (bold, blue background).

---

## 🧪 Testing the Connection

### Method 1: Direct Google Apps Script Console (BEST FOR LOCALHOST)

Since you're testing from `localhost:5500`, use the GAS console directly:

1. Open your **Google Apps Script Editor**
2. Go to **Extensions → Apps Script** (or Ctrl+K)
3. Create a test function:

```javascript
function testConnection() {
  const url = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=ping';
  const response = UrlFetchApp.fetch(url);
  const result = JSON.parse(response.getContentText());
  console.log('Connection Test:', result);
  return result;
}
```

Replace `YOUR_DEPLOYMENT_ID` with your actual deployment ID.

4. Click the play button ▶ to run
5. Check **Execution log** for results

---

### Method 2: Browser Console Test (After Production Deployment)

Once deployed to production, test from Chrome DevTools:

```javascript
// Open any page, press F12, go to Console, paste this:
fetch('YOUR_DEPLOYMENT_URL?action=ping')
  .then(r => r.json())
  .then(data => console.log('✓ Connection OK:', data))
  .catch(err => console.error('✗ Connection Failed:', err))
```

---

### Method 3: Check Sheet Health Status

Run this in GAS Console to verify all sheets are properly initialized:

```javascript
function checkSheets() {
  const health = getSheetHealthCheck();
  console.log('Sheet Status:', health);
  return health;
}
```

**Expected output** (all sheets should exist and have headers):
```json
{
  "Students": { "exists": true, "rows": 467, "columns": 8, "hasHeaders": true },
  "Assessments": { "exists": true, "rows": 150, "columns": 12, "hasHeaders": true },
  "Payments": { "exists": true, "rows": 0, "columns": 6, "hasHeaders": true },
  ...
}
```

---

## 🔍 Common Issues & Solutions

### Issue: "Failed to fetch" from localhost

**Reason:** Browser CORS policy blocks localhost → Google Apps Script

**Solution:** 
- ✅ Use GAS Console test (Method 1 above) - works from localhost
- ✅ Deploy HTML to a real server (not localhost) - CORS headers will work
- ❌ Don't try to fix with proxy/CORS extensions - use proper deployment

### Issue: Sheets exist but have no headers

**Solution:** Run this in GAS Console:
```javascript
initializeSheets()
```

This will add headers to all sheets that are missing them.

### Issue: Only 2 assessments showing, not 150

**Solution:** 
1. Check sheet name: Must be `Grade_Assessments_PP1_T1_Opener` (exact match)
2. Run debug in GAS Console:
```javascript
const debug = getAssessmentsWithClassFallback('PP1', 'T1', 'Opener', '2026');
console.log('Found assessments:', debug.length);
```

3. If still 0, manually check the sheet:
```javascript
const sheets = getAllClassAssessmentSheets();
console.log('Available Grade sheets:', sheets);
```

---

## ✅ Verification Checklist

After deployment, verify each step:

- [ ] 1. **Sheets Created** - All required sheets exist in spreadsheet
- [ ] 2. **Headers Added** - All sheets have proper header row (bold, blue)
- [ ] 3. **Script Deployed** - GAS deployed as Web App
- [ ] 4. **Connection Working** - Test via GAS Console (Method 1)
- [ ] 5. **Data Loading** - Frontend shows data (not just 0 records)
- [ ] 6. **Matrix Data Visible** - Select Grade=PP1, T1, Opener → See 150 marks

---

## 📱 Updated Settings URL

When you test from a **production server** (not localhost), use:

```
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?action=ping
```

Replace `YOUR_DEPLOYMENT_ID` with your actual ID from deployment.

**Note:** This won't work from `localhost:5500` due to browser CORS policy. Use Method 1 (GAS Console) for local testing instead.

---

## 🚀 Next Steps

1. Deploy the updated `google-apps-script.gs`
2. Run `initializeSheets()` in GAS Console to ensure headers exist
3. Test connection using Method 1 (GAS Console)
4. Deploy your HTML/CSS/JS to a real server (if needed)
5. Access frontend and verify data loads correctly

**Questions?** Check the console logs:
- GAS Console: App Script Editor → Execution log
- Browser Console: F12 → Console tab
