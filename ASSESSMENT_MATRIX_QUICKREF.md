# Assessment Matrix - Quick Reference

## 🚀 Quick Start (5 minutes)

### For Users
1. Open **Assessment Matrix** from sidebar
2. Select **Grade** → **Term** → **Exam Type**
3. **Click a cell** to enter a mark (0-100)
4. Press **Enter** to save
5. Mark auto-syncs to Google Sheets

### For Admins (Setup)
1. Ensure grades and subjects configured in Settings
2. Get Google Apps Script deployment URL
3. Paste URL in Settings → Google Sheet Configuration
4. Go to Assessment Matrix
5. Click "☁️ Sheet" to create matrix for a grade

## 📊 Matrix Layout

```
┌────────────┬──────────────┬─────────┬────────────┬─────────┐
│ Student ID │ Student Name │ English │ Mathematics │ Science │
├────────────┼──────────────┼─────────┼────────────┼─────────┤
│ S001       │ John Doe     │ 85      │ 92        │ 78      │
│ S002       │ Jane Smith   │ 90      │ 88        │ 95      │
│ S003       │ Bob Johnson  │ 75      │ 80        │ 82      │
└────────────┴──────────────┴─────────┴────────────┴─────────┘
```

## 🎯 Common Tasks

### Enter Marks
```
1. Select grade
2. Click cell
3. Type 0-100
4. Press Enter
5. Done! Auto-saved
```

### Fix a Wrong Mark
```
1. Click the cell with wrong mark
2. Type correct mark
3. Press Enter
4. Mark updates in all views
```

### Create Google Matrix
```
1. Select: Grade, Term, Exam Type
2. Click "☁️ Sheet"
3. Confirm details
4. Click "Create Matrix"
5. New sheet appears in Google Sheets
```

### Export to CSV
```
1. Select: Grade, Term, Exam Type
2. Click "📥 Export"
3. File downloads automatically
4. Open in Excel/Google Sheets
```

### Edit in Google Sheets
```
1. Open Google Sheet
2. Find matrix: Grade_Assessments_Grade1_T1_Opener
3. Click cell and enter mark
4. Mark syncs to app
```

### Filter by Stream
```
1. Select: Grade
2. Select: Stream (if available)
3. Students filtered automatically
4. Matrix updates
```

## 📈 Stats Shown

| Metric | Meaning |
|--------|---------|
| **Students** | Total students in grade/stream |
| **Subjects** | Number of subjects for grade |
| **Marks Entered** | Total number of marks filled in |
| **Coverage** | % of possible cells with marks |

## 🔒 Permissions

| Action | Admin | Teacher |
|--------|-------|---------|
| View matrix for assigned grades | ✅ | ✅ |
| Enter marks | ✅ | ✅ |
| Create Google matrices | ✅ | ❌ |
| Export to CSV | ✅ | ✅ |
| Edit other grades | ✅ | ❌ |
| Filter by stream | ✅ | ✅ |

## 📝 Input Rules

| Rule | Details |
|------|---------|
| **Valid range** | 0 to 100 |
| **Format** | Numbers only |
| **Empty cell** | No assessment created |
| **0 mark** | Valid (fails the subject) |
| **100 mark** | Valid (perfect score) |
| **Decimal** | Rounds to nearest integer |

## 🔄 Sync Behavior

### Auto-Sync ON (Recommended Settings)
- **Local entry** → Local storage (instant)
- **Local entry** → Google Sheets (30-60 seconds)
- **Google Sheets entry** → App Assessments (manual - click sync)

### Sync Status Indicators
- ✓ Mark saved locally
- ⏳ Syncing to Google (.gs initializing)
- ✗ Sync failed (retry in 30s)
- ⚠ Network error (will retry)

## 🐛 Troubleshooting

### Marks not appearing
```
Check:
□ Grade name spelled correctly
□ Subject exists for grade
□ Student enrolled in grade
□ Refreshed browser (F5)
```

### Matrix not creating
```
Check:
□ Grade has students
□ Grade has subjects configured
□ Google URL in Settings is correct
□ Admin user is logged in
```

### Marks not syncing to Google
```
Check:
□ Matrix sheet created first
□ Google URL is correct
□ 30+ seconds since last sync
□ Internet connection working
```

### Can't edit matrix in Google Sheets
```
Check:
□ Have edit permission on sheet
□ Matrix cells are not blank
□ Already created matrix (not just table)
```

## 🎓 Grade & Subject Setup

### Minimum Configuration Needed
```javascript
Settings → Grades:
  Grade 1, Grade 2, Grade 3, ...

Settings → Subjects:
  Grade 1: English, Mathematics, Science
  Grade 2: English, Mathematics, Science, Social Studies
  ...
```

### Senior School Configuration (Optional)
```javascript
For Grade 10, 11, 12:
  Core subjects: English, Kiswahili, Maths, CSL
  Electives: Students choose from available list
  Matrix only shows:
    - All core subjects
    - Electives student chose
```

## 📱 Mobile Usage

### Supported Features
- ✅ View matrix on mobile
- ✅ Enter marks on mobile
- ✅ Scroll left/right for subjects
- ✅ Filter by grade/stream

### Tips for Mobile
- Use landscape mode for better view
- Tap a cell, then tap field to edit
- Mobile keyboard auto-opens
- Auto-saves after each entry

## 🔐 Data Safety

### Backups
- ✅ Local storage backup (your browser)
- ✅ Google Sheets backup (your account)
- ✅ Assessment table backup (main table)

### Undo/Recovery
- Can't undo in matrix (by design - fast)
- Can revert in Assessments view (manual)
- Can restore from Google Sheets (copy/paste)

## 📊 Integration Points

### Data Flows
```
App entry → Local storage → Google Sheets
                    ↓
         Assessment table (flat)
                    ↓
         Result Analysis
                    ↓
         Reports & Analysis
```

### One-Way Sync
- App → Google Sheets: AUTOMATIC (30s delay)
- Google Sheets → App: MANUAL (click sync button)

## 🎨 Visual Guide

### Header Row
- **Color**: Blue (#4472C4)
- **Font**: White, Bold
- **Frozen**: Yes (always visible)

### Data Rows
- **Alternating**: White/Gray
- **Hover**: Blue highlight
- **Focus**: Blue border

### Input Cells
- **Range**: 0-100 only
- **Type**: Number input
- **Save**: Enter key or click away

## 🔗 Related Features

### Works Well With
- **Assessments view**: See all assessments data
- **Result Analysis**: Analyze marks by student
- **Marklist**: Print marks lists
- **Print Buttons**: Print matrices

### Does NOT Replace
- ❌ Assessments view (detailed editing)
- ❌ Attendance tracking
- ❌ Settings configuration
- ❌ Grade management

## ⚙️ Configuration Checklist

Before using Assessment Matrix:

- [ ] Google Apps Script deployed
- [ ] Google URL added to Settings
- [ ] Grades configured (Grade 1, 2, 3...)
- [ ] Subjects added to each grade
- [ ] Students enrolled in grades
- [ ] Teachers assigned to grades/subjects (if using)
- [ ] Terms configured (T1, T2, T3)
- [ ] Exam types created (Opener, Mid-term, Final)

## 📞 Quick Help

### "My marks disappeared"
No they didn't! They're in:
1. Local storage (browser saved)
2. Assessment table (they're there)
3. Google Sheets (matrix created)
→ Refresh and check assessments view

### "Why 30-second delay?"
Prevents API throttling from Google.
Safe wait: marks saved locally immediately.

### "Can I edit in both places?"
Yes! Edit in app OR Google Sheets.
Just wait 30+ seconds between edits.

### "How many students per matrix?"
No limit! But UI performance:
- 50 students: Instant
- 100 students: Fast
- 300+ students: Slight delay (2-3s)

## 🌟 Pro Tips

### Tip 1: Batch Entry
Have list of marks? Use Assessment Matrix - faster than one-by-one.

### Tip 2: Verification
Enter in app, verify in Google Sheets - catches errors early.

### Tip 3: Backup
Regularly export CSV - insurance copy of marks.

### Tip 4: Streams
Use stream filter if you have multiple sections of same grade.

### Tip 5: Night Backup
Export to CSV at end of day - safe backup.

## 🚀 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Click cell | Enter edit mode |
| Enter | Save and move down |
| Escape | Cancel edit |
| Tab | Move to next subject (future) |
| Ctrl+S / Cmd+S | Export CSV (future) |

---

**Last Updated**: 2025-01-15  
**Version**: 1.0  
**Status**: Production Ready
