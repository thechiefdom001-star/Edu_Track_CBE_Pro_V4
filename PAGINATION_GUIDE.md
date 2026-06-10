# Data Table Pagination Implementation Guide

## Overview

Pagination has been implemented across all major data tables in the PELELEZA SCHOOL management system. This feature improves performance and user experience by displaying data in manageable chunks instead of overwhelming lists.

## Components Added

### 1. **lib/pagination.js** - Pagination Utility Module
Core utility functions for pagination logic:
- `getPaginationMetadata()` - Calculates pagination metadata (total pages, current page, etc.)
- `getPageItems()` - Returns items for a specific page
- `getPageRange()` - Calculates which page number buttons to display

### 2. **components/Pagination.js** - Reusable Pagination UI Component
Visual pagination controls with:
- Previous/Next buttons
- Page number buttons (customizable range)
- Items per page selector
- Status display (X of Y items, Page N/M)

## Updated Components

The following components now support pagination:

### Student Management
- **Students.js** - Student directory with filter support
  - Default: 10 items per page
  - Maintains filters while paginating
  - Shows search/filter results count

### Staff Management  
- **Teachers.js** - Teacher registry
  - Default: 10 items per page
  - Preserves class assignments
  
- **Staff.js** - Support staff registry
  - Default: 10 items per page

### Academic Records
- **Marklist.js** - Class marklist/grade entry
  - Default: 10 items per page
  - Maintains separate tables per grade/stream/term
  
- **FeesRegister.js** - Financial overview table
  - Default: 10 items per page
  - Preserves grade/term/arrears filters
  - Shows financial totals for visible page

## How to Use

### For End Users

1. **Navigate the table**: Use Previous/Next buttons or click specific page numbers
2. **Change items per page**: Select from dropdown (10, 25, 50, 100 items)
3. **View status**: Read "Showing X to Y of Z items (Page N/M)" at bottom
4. **Filtering**: Apply filters (grade, stream, search) - pagination adapts automatically

### For Developers - Adding Pagination to a New Component

1. **Import pagination dependencies**:
```javascript
import { Pagination } from '../lib/pagination.js';
import { PaginationControls } from './Pagination.js';
```

2. **Add pagination state**:
```javascript
const [currentPage, setCurrentPage] = useState(1);
const [itemsPerPage, setItemsPerPage] = useState(10);
```

3. **Create page change handler**:
```javascript
const handlePageChange = (newPage, newItemsPerPage) => {
    if (newItemsPerPage) {
        setItemsPerPage(newItemsPerPage);
        setCurrentPage(1);  // Reset to first page
    } else {
        setCurrentPage(newPage);
    }
};
```

4. **Get paginated data**:
```javascript
const paginatedItems = Pagination.getPageItems(
    filteredItems,      // Your full filtered array
    currentPage,        // Current page
    itemsPerPage        // Items per page
);
```

5. **Render paginated data in table**:
```javascript
<tbody>
    ${paginatedItems.map(item => html`
        <tr><!-- row content --></tr>
    `)}
</tbody>
```

6. **Add pagination controls**:
```javascript
${items.length > 0 && html`
    ${PaginationControls({
        currentPage,
        onPageChange: handlePageChange,
        totalItems: items.length,
        itemsPerPage
    })}
`}
```

## Key Features

✅ **Responsive Design** - Works on mobile and desktop
✅ **Print-Friendly** - Pagination controls hidden in print view
✅ **Filter-Aware** - Works with existing filter/search systems
✅ **Flexible Items Per Page** - Users can choose 10, 25, 50, or 100 items
✅ **Smart Page Buttons** - Shows 5 page buttons max, centered on current page
✅ **No Visual Disruption** - Hides pagination when ≤1 page of data
✅ **Reset on Filter** - Page resets to 1 when filters change
✅ **Accessibility** - Disabled states, title attributes, keyboard friendly

## Customization

### Change Default Items Per Page
In any component, modify the initial state:
```javascript
const [itemsPerPage, setItemsPerPage] = useState(25);  // Instead of 10
```

### Change Max Page Buttons Displayed
In the `PaginationControls` component props:
```javascript
${PaginationControls({
    currentPage,
    onPageChange: handlePageChange,
    totalItems: items.length,
    itemsPerPage,
    maxButtons: 7  // Show up to 7 page buttons instead of 5
})}
```

### Styling Customization
The pagination controls use Tailwind CSS classes. Modify `components/Pagination.js` to change:
- Button colors
- Spacing/padding
- Font sizes
- Hover effects

## Performance Notes

- Pagination doesn't load all data at once - only current page is rendered
- Filter state is maintained separately from pagination
- Re-pagination on filter change is automatic
- No additional network requests - all data is client-side

## Troubleshooting

### Pagination doesn't appear:
- Check if component has > 1 page of data
- Verify `Pagination.getPageItems()` is being used
- Ensure `PaginationControls` component is rendered

### Page resets to 1 unexpectedly:
- This is intentional when filters change
- Add this to prevent: `useEffect(() => { setCurrentPage(1); }, [filteredItems])`

### Items not displaying:
- Verify you're using `paginatedItems` not the full `items` array in .map()
- Check that pagination handler is called correctly

## Future Enhancements

Potential improvements:
- [ ] URL parameters for page state persistence
- [ ] Jump-to-page input field
- [ ] Keyboard shortcuts (arrow keys for page navigation)
- [ ] Local storage for user's preferred items per page
- [ ] Server-side pagination for large datasets
- [ ] Virtual scrolling for extremely large tables

## Files Modified

```
lib/pagination.js (NEW)
components/Pagination.js (NEW)
components/Students.js (UPDATED)
components/Teachers.js (UPDATED)
components/Staff.js (UPDATED)
components/Marklist.js (UPDATED)
components/FeesRegister.js (UPDATED)
```

## Testing Checklist

- [ ] Tables display correct number of items per page
- [ ] Page navigation works (previous, next, direct page click)
- [ ] Items per page selector works
- [ ] Status text updates correctly
- [ ] Pagination hides when data < 1 page
- [ ] Filters work with pagination
- [ ] Print functionality works (no pagination controls in print)
- [ ] Mobile responsiveness works
- [ ] No JavaScript errors in console
