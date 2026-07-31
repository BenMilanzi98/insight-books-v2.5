# List page pattern

Composition: `components/patterns/ListPage.jsx`

```
PageContainer
  PageHeader (title, description, primary actions)
  filters (optional FilterBar)
  content (DataTable / custom list)
```

## Adoption

1. Replace ad-hoc `<h1>` + action row with `PageHeader` or wrap in `ListPage`.
2. Prefer `DataTable` for new lists; keep existing tables until migrated.
3. Mobile: `DataTable` switches to `MobileDataCard` below `md`.

## Non-goals

No API, sorting semantics, or permission changes — only chrome.
