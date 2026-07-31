# Report layout pattern

Composition: `components/patterns/ReportLayout.jsx`

```
PageContainer (wide)
  PageHeader (title + period + export actions)
  filters strip
  scrollable report body
```

Adopted first on `app/reports-v2/page.js`. Export buttons and report calculations stay on existing APIs.
