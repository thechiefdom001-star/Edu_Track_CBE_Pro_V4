# Class Assessment Sheets - Quick Reference

## ⚡ Quick Start (30 seconds)

### Step 1: Create a Class Sheet
Name it exactly like this: `Class_6_Assessment` (use your grade number)

### Step 2: Add Headers
Copy these column names to row 1:
```
id | studentId | studentAdmissionNo | studentName | grade | subject | score | term | examType | academicYear | date | level | rawScore | maxScore
```

### Step 3: Add Your Data
Start from row 2, add your class assessment records

### Done! ✅
- System automatically uses this sheet when you ask for grade 6 assessments
- Falls back to general sheet if class sheet doesn't exist
- No code changes needed!

---

## 📍 Sheet Naming Rules

**For single stream:**
```
Class_6_Assessment      (Grade 6)
Class_7_Assessment      (Grade 7)
Class_8_Assessment      (Grade 8)
```

**For multiple streams:**
```
Class_6_A_Assessment    (Grade 6, Stream A)
Class_6_B_Assessment    (Grade 6, Stream B)
Class_7_A_Assessment    (Grade 7, Stream A)
Class_7_B_Assessment    (Grade 7, Stream B)
```

---

## 🔍 How to Test

### Test 1: Check if System Sees Your Sheet
```
GET ?action=getClassSheets
```
Should show your class sheet name in the list

### Test 2: Verify Specific Class Sheet
```
GET ?action=classSheetExists&grade=6&stream=A
```
Should return: `{ exists: true }`

### Test 3: Fetch Assessments (Auto Uses Class Sheet)
```
GET ?action=getAssessments&grade=6&term=T1
```
Should return data from your class sheet (if it exists)

---

## 📊 Priority (What Gets Used)

```
1. Class_6_Assessment (if exists)  ← HIGHEST PRIORITY
2. General Assessments Sheet        ← FALLBACK
```

---

## 🎯 When Each Sheet Is Used

| Scenario | Which Sheet? |
|----------|--------------|
| Class sheet exists, grade=6 | **Class_6_Assessment** |
| Class sheet doesn't exist, grade=6 | General Assessments |
| getAll command | Both (merged, no duplicates) |
| No sheets exist | Empty response |

---

## ✅ What Works Automatically

- [x] AssessmentMatrix shows data from class sheets
- [x] Backend switches automatically (no UI change)
- [x] Fallback to general sheet is automatic
- [x] Data deduplication is automatic
- [x] All existing code still works

---

## ⚠️ Important Notes

1. **Exact naming required:** `Class_6_Assessment` (not `Grade6Assessment`)
2. **Headers must match:** Copy from existing Assessments sheet
3. **No duplicates:** Each assessment needs unique ID
4. **Data starts row 2:** Row 1 is headers only
5. **Both sheets optional:** Works with either or both

---

## 🐛 If Something's Wrong

| Problem | Solution |
|---------|----------|
| Data not from class sheet | Check sheet name format |
| Empty results | Add headers and data |
| Wrong data returned | Verify grade parameter matches |
| Slow performance | Class sheet may be too large |

---

## 📝 One-Liner Examples

```javascript
// This now checks class sheets first:
getAssessments?grade=6&term=T1

// This gets everything:
getAll

// This lists all class sheets:
getClassSheets

// This checks if a class sheet exists:
classSheetExists?grade=6&stream=A
```

---

## 💡 Pro Tips

1. **Backup first:** Copy general Assessments sheet before testing
2. **Start small:** Create one class sheet, test it
3. **Consistent naming:** Use same format for all sheets
4. **Monitor logs:** Check Google Apps Script console for debug info
5. **Use getAll:** Syncs everything, merges automatically

---

## 📚 Full Documentation

For complete details, see:
- [CLASS_ASSESSMENT_SETUP.md](./CLASS_ASSESSMENT_SETUP.md)
- [CLASS_ASSESSMENT_IMPLEMENTATION_SUMMARY.md](./CLASS_ASSESSMENT_IMPLEMENTATION_SUMMARY.md)

---

## 🎓 Key Concept

**"Class sheets override class general records"**

When a class-specific sheet exists (e.g., `Class_6_Assessment`), the system uses that instead of the general Assessments sheet. If class sheet doesn't exist, it falls back automatically.

---

## ✨ That's It!

You now have complete class assessment functionality. Create sheets, add data, system handles the rest!
