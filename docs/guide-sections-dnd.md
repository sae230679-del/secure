# Guide Sections DnD Reorder - Developer Notes

## Overview

SuperAdmin can reorder guide sections (9 fixed sections) using drag-and-drop in the Guide Management panel. Changes are saved atomically to the database.

## API Endpoints

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/guide/home` | Returns visible sections sorted by `sortOrder` ASC |
| GET | `/api/guide/search?q=` | Search sections/topics/articles (excludes invisible sections) |

### Admin Endpoints (requireSuperAdmin)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/guide/sections` | Returns all 9 sections with `topicsCount` and `articlesCount` |
| PATCH | `/api/admin/guide/sections/:id` | Update section (title, description, isVisible) |
| PUT | `/api/admin/guide/sections/reorder` | Reorder all 9 sections atomically |

### Reorder Request Schema

```json
{
  "items": [
    { "id": 1, "sortOrder": 10 },
    { "id": 2, "sortOrder": 20 },
    // ... exactly 9 items with unique IDs
  ]
}
```

**Validation:**
- `items.length === 9` (must include all sections)
- All `id` values must be unique
- `sortOrder` must be integers >= 0

**Response:** Returns all 9 sections sorted by `sortOrder` ASC.

## Invariants

1. **Fixed 9 Sections** - The system always has exactly 9 guide sections (seeded at startup).

2. **Sort Order Mapping** - Frontend maps array index to `sortOrder` using multiples of 10:
   ```ts
   items = localSections.map((section, index) => ({
     id: section.id,
     sortOrder: (index + 1) * 10, // 10, 20, 30, ..., 90
   }));
   ```

3. **Visibility Rules:**
   - `isVisible=true` - Section appears in public `/api/guide/home` and search
   - `isVisible=false` - Section hidden from public, but visible to SuperAdmin
   - Topics/articles from invisible sections are excluded from search

4. **Transaction Safety** - Reorder updates all 9 rows atomically in a single database transaction.

## Frontend State Management

The `SectionsTab` component uses:

- `localSections` - Single source of truth for rendering
- `serverVersion` - Tracks last sync timestamp (dataUpdatedAt)
- `hasChanges` - Indicates pending unsaved changes

**Sync Logic:**
```ts
useEffect(() => {
  if (sections && sections.length > 0 && dataUpdatedAt !== serverVersion) {
    setLocalSections(sorted);
    setServerVersion(dataUpdatedAt);
    setHasChanges(false);
  }
}, [sections, dataUpdatedAt, serverVersion]);
```

**DnD Flow:**
1. Drag section -> `localSections` reordered, `hasChanges=true`
2. Click Save -> Mutation fires, query invalidated
3. Query refetches -> `dataUpdatedAt` changes -> `localSections` synced, `hasChanges=false`

## Running Tests

```bash
# Run all guide API tests
npm test -- tests/guide-api.test.ts

# Run in watch mode
npm run test:watch -- tests/guide-api.test.ts
```

### Test Coverage (15 tests)

| Test | Description |
|------|-------------|
| Sorting | Sections returned sorted by `sortOrder` ASC |
| Visibility | Hidden sections excluded from public endpoints |
| Totals | `topics` and `articles` counts validated |
| Search Filter | Results from invisible sections excluded |
| Short Query | Empty results for queries < 2 characters |
| Auth 401 | Unauthorized requests rejected |
| Auth 403 | Non-superadmin users forbidden |
| Reorder Success | Order persists after save |
| Invalid Length | Rejects if items.length !== 9 |
| Duplicate IDs | Rejects duplicate section IDs |
| Invalid Type | Rejects non-integer sortOrder |
| Visibility Toggle | PATCH updates affect /api/guide/home |
| Admin Sections | Returns all 9 sections with counts |

## Files

- **Backend:** `server/routes.ts` (endpoints), `server/storage.ts` (reorderGuideSections)
- **Frontend:** `client/src/pages/superadmin/guide-management.tsx` (SectionsTab)
- **Tests:** `tests/guide-api.test.ts`
- **Schema:** `shared/schema.ts` (guideSections table)
