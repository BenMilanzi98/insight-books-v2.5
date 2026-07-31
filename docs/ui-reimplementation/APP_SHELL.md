# App shell

## Tenant (`components/shell/AppShell.jsx`)

- Wired from `app/RootLayoutClient.js` (thin re-export).
- Preserves hide-layout paths (auth, marketing, `/insightbooks`, `/affiliate`, `/ref`).
- Mobile: drawer + backdrop, Escape closes, focus returns to menu button, body scroll lock.
- Desktop: content `margin-left` when sidebar open (`--sidebar-width`).
- Z-index via tokens: `--z-backdrop`, `--z-drawer`, AppBar sticky layer.

## Platform admin (`components/shell/AdminShell.jsx`)

- Same drawer/backdrop/Escape pattern.
- Auth remains in `app/insightbooks/layout.js`; shell only presents chrome.
- Uses shared tenant `AppBar` with `skipUserFetch` + `adminUser`.

## Page chrome

| Component | Role |
|-----------|------|
| `PageContainer` | Max-width wrapper (shell already pads) |
| `PageHeader` | Title, description, status, actions |
