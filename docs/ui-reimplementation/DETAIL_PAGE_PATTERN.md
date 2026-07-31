# Detail page pattern

Composition: `components/patterns/DetailPage.jsx`

```
PageContainer
  PageHeader (entity title, status badge, actions)
  optional sidebar (metadata / activity)
  main detail body
```

Use `StatusBadge` for lifecycle text (never colour-only). Destructive actions go through `ConfirmDialog`.
