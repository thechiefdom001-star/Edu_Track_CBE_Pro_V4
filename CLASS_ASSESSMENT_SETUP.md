# Class Assessment Sheet Setup Guide

## Overview
The EduTrack system now supports **class-specific assessment sheets** that automatically take priority over the general assessment record. This allows you to maintain complete assessment data for individual classes while keeping a centralized general assessments sheet.

## How It Works

### Priority Logic
When fetching assessment data:
1. **Class Sheet (HIGHEST PRIORITY)** - If a class-specific sheet exists, data is fetched from there
2. **General Assessments Sheet (FALLBACK)** - If no class sheet found, falls back to the general Assessments sheet

This means **class sheet data supercedes general assessment records**.

---

## Setting Up Class Assessment Sheets

### Naming Convention
Class assessment sheets follow this naming pattern:
```
Class_[GRADE]_Assessment              (e.g., "Class_6_Assessment")
Class_[GRADE]_[STREAM]_Assessment    (e.g., "Class_7A_Assessment", "Class_8B_Assessment")
```

### Required Headers
The class assessment sheet must have these columns (at minimum):
```
id | studentId | studentAdmissionNo | studentName | grade | subject | score | term | examType | academicYear | date | level | rawScore | maxScore
```

This matches the standard ASSESSMENT_HEADERS structure.

### Step-by-Step Setup

#### Option 1: Create a New Class Sheet Manually
1. Open your Google Sheet
2. Create a new sheet tab named `Class_6_Assessment` (or your class designation)
3. Add the column headers in row 1 (copy from the main Assessments sheet)
4. Add your class assessment data starting from row 2
5. Save the sheet

#### Option 2: Copy from General Assessments
1. Go to your `Assessments` sheet
2. Filter for the specific grade/class
3. Copy the filtered data
4. Create a new sheet: `Class_[Grade]_Assessment`
5. Paste the data
6. Save

---

## Fetching Class Assessment Data

### API Endpoints

#### 1. Get Assessments by Grade (Uses Class Sheet if Available)
```
GET ?action=getAssessments&grade=6&term=T1&examType=Opener
```
**Response:** Returns data from `Class_6_Assessment` if it exists, otherwise from general Assessments sheet.

---

#### 2. Get All Assessments (Combines All Sources)
```
GET ?action=getAll
```
**Response:** Merges assessments from:
- All class-specific sheets
- General Assessments sheet
- Duplicates removed (by assessment ID)

---

#### 3. Check if Class Sheet Exists
```
GET ?action=classSheetExists&grade=6&stream=A
```
**Response:**
```json
{
  "success": true,
  "exists": true,
  "sheetName": "Class_6_A_Assessment"
}
```

---

#### 4. List All Class Assessment Sheets
```
GET ?action=getClassSheets
```
**Response:**
```json
{
  "success": true,
  "classSheets": ["Class_6_Assessment", "Class_7A_Assessment", "Class_8B_Assessment"]
}
```

---

## Frontend Integration

### AssessmentMatrix Component
The `AssessmentMatrix.js` component automatically:
1. Fetches assessment data via the sync service
2. The sync service calls `getAssessments` or `getAll` from Google Apps Script
3. Class sheets are automatically consulted first
4. Data displays correctly without changes to your frontend code

### No Code Changes Required
The class sheet logic is built into the backend. Your existing frontend code will work automatically!

---

## Example Workflow

### Scenario: Grade 6 Class Assessments
1. **Create sheet:** `Class_6_Assessment`
2. **Add data:** 25 students with their T1 Opener marks
3. **Fetch data:** Captain calls `getAssessments?grade=6&term=T1`
4. **System returns:** Data from `Class_6_Assessment` instead of general sheet
5. **Display:** Matrix shows complete class assessment data

### Scenario: Mixed Grades (No Class Sheets)
1. **No class sheets created**
2. **Fetch data:** Call `getAssessments?grade=7`
3. **System returns:** Data from general `Assessments` sheet (fallback)

---

## Troubleshooting

### Issue: Getting Empty Assessment Data
**Solution:**
1. Check the class sheet exists with correct naming: `Class_[Grade]_Assessment`
2. Verify headers match exactly
3. Confirm data rows start from row 2
4. Check console logs for class sheet lookup messages

### Issue: Class Sheet Not Being Used
**Cause:** Sheet name doesn't match the grade passed in the request
**Solution:**
- Sheet name: `Class_6_Assessment`
- Request must pass: `&grade=6`

### Issue: Duplicate Assessments in Results
**Solution:** The `getAllAssessmentsIncludingClassSheets()` function automatically deduplicates by assessment ID. If you're seeing duplicates:
1. Check for duplicate IDs in your data
2. Ensure each assessment has a unique ID

---

## Best Practices

1. **Naming:** Always use consistent grade/stream naming
   - ✅ `Class_6_A_Assessment`
   - ❌ `Grade_6_A_Assessment` or `Class_6A_Assessment` (different format)

2. **Data Maintenance:**
   - Update class sheets regularly
   - Archive old class sheets instead of deleting
   - Keep general Assessments sheet as a centralized backup

3. **Performance:**
   - Class sheets with 200+ students may be slower
   - Consider splitting very large classes

4. **Sync Strategy:**
   - Sync individual class data to class sheets
   - Use general sheet for reports and analytics
   - Class sheets for teaching staff, general sheet for admin

---

## Available Functions in Google Apps Script

### For Developers

#### `getClassSheetName(grade, stream)`
Generates correct sheet name from grade/stream
```javascript
getClassSheetName('6', 'A')  // Returns: "Class_6_A_Assessment"
getClassSheetName('7', null) // Returns: "Class_7_Assessment"
```

#### `classSheetExists(grade, stream)`
Checks if a class sheet exists
```javascript
classSheetExists('6', 'A')  // Returns: true/false
```

#### `getAllClassAssessmentSheets()`
Returns array of all class assessment sheet names
```javascript
getAllClassAssessmentSheets()  // Returns: ["Class_6_Assessment", "Class_7A_Assessment"]
```

#### `getAssessmentsWithClassFallback(grade, term, examType, academicYear)`
Fetches from class sheet with fallback to general sheet
```javascript
getAssessmentsWithClassFallback('6', 'T1', 'Opener', '2025/2026')
```

#### `getAllAssessmentsIncludingClassSheets()`
Returns all assessments from all class sheets + general sheet (deduplicated)
```javascript
getAllAssessmentsIncludingClassSheets()
```

---

## Summary

✅ **Class sheets automatically prioritized**
✅ **Fallback to general assessments**
✅ **No frontend changes needed**
✅ **Easy to set up - just name sheets correctly**
✅ **Supports multiple classes, streams, and grades**

Your assessment data now leads fetching to class sheets when available, with automatic fallback to general records!
