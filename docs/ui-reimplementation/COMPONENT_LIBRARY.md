# Shared UI primitives

Location: `components/ui/` (barrel: `index.js`)

| Primitive | File | Notes |
|-----------|------|--------|
| Button / IconButton | Button.jsx | variants, sizes, loading, forwardRef |
| Card / SummaryCard | Card.jsx | KPI + content surface |
| Badge / StatusBadge | Badge.jsx | tone + text |
| Dialog | Dialog.jsx | Headless UI v2, Escape, focus, scroll lock |
| Drawer | Drawer.jsx | filters / mobile panels |
| ConfirmDialog | ConfirmDialog.jsx | destructive confirm chrome |
| EmptyState / ErrorState / Skeleton | *.jsx | async UX |
| FormField / Input / Textarea / Select | FormField.jsx | a11y associations |
| DataTable / MobileDataCard | DataTable.jsx | responsive list |
| FilterBar | FilterBar.jsx | desktop row / mobile drawer |
| Toast | Toast.jsx | adapter for local toast state |
| Tabs / QuickActions | existing | unchanged behaviour |

Shell: `components/shell/*`. Patterns: `components/patterns/*`.

**Rule:** Feature modals keep business content; only chrome moves onto `Dialog`.
