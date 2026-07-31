# Sidebar

## Tenant — `components/Sidebar/Sidebar.js`

- Navigation destinations and permission checks are unchanged.
- Visual polish: sit inside tokenized shell width; Lucide icons; consistent item affordances.
- Collapse controlled by AppShell `sidebarOpen` / `toggleSidebar`.

## Platform — `components/AdminSidebar/AdminSidebar.js`

- Canonical admin nav (folder path). Legacy root `components/AdminSidebar.js` removed after reference check (only AdminShell imports the folder module).

## Rules

- Do not remove nav items to “simplify”.
- Do not change permission keys or route hrefs during UI refresh.
