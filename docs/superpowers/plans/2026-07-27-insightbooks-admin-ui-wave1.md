# InsightBooks Admin UI Revamp — Wave 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the calm-ops admin shell chrome and shared UI primitives so every `/insightbooks` page sits in finished responsive framing before page-body migrations (Waves 2–4).

**Architecture:** Expand `--admin-*` tokens; replace tenant AppBar/Footer with `AdminHeader`; polish `AdminShell`/`AdminSidebar`; add `AdminDataTable`, `AdminFilterBar`, form field kit, `AdminModal`/`AdminDrawer`. APIs unchanged. Spec: `docs/superpowers/specs/2026-07-27-insightbooks-admin-ui-revamp-design.md`.

**Tech Stack:** Next.js App Router, React client components, Tailwind utility classes, Lucide icons, existing `components/admin/*` patterns, Vitest presence/contract tests.

## Global Constraints

- Visual: calm ops console — slate canvas, dark sidebar, Lucide only; no purple marketing gradients, no fake metrics
- Responsive: usable 320px–1920px; no page-wide horizontal overflow
- UI-only: do not change `/api/admin/*` contracts or permissions
- Motion: drawer, dialog, search — max ~3 intentional transitions
- A11y: Escape closes mobile drawer/modals; focus restore on menu button; touch targets ≥44px on mobile
- Redirect-only pages stay redirects

---

## File map

| File | Responsibility |
|------|----------------|
| `app/globals.css` | Expand `--admin-*` tokens |
| `components/admin/AdminHeader.jsx` | Slim top bar (new) |
| `components/shell/AdminShell.jsx` | Wire header; remove AppBar/Footer |
| `components/AdminSidebar/AdminSidebar.js` | Calm-ops polish |
| `components/admin/AdminDataTable.jsx` | Table + mobile cards |
| `components/admin/AdminFilterBar.jsx` | Filters + mobile sheet |
| `components/admin/AdminField.jsx` | Form field kit |
| `components/admin/AdminModal.jsx` | Modal overlay |
| `components/admin/AdminDrawer.jsx` | Side drawer |
| `components/admin/AdminGlobalSearch.jsx` | Restyle to header |
| `components/admin/index.js` | Re-exports |
| `test/systemAdmin.uiWave1.test.js` | Presence + no AppBar/Footer in shell |

---

### Task 1: Admin design tokens

**Files:**
- Modify: `app/globals.css` (admin token block ~lines 70–79)
- Test: `test/systemAdmin.uiWave1.test.js`

- [ ] **Step 1: Write failing token presence test**

Assert `globals.css` contains `--admin-border`, `--admin-text-muted`, `--admin-focus-ring`, `--admin-row-height`, and that `--admin-sidebar-active` is not the indigo rgba marketing tint (use slate/primary-neutral active instead).

- [ ] **Step 2: Expand `--admin-*` tokens**

Add: `--admin-border`, `--admin-text`, `--admin-text-muted`, `--admin-focus-ring`, `--admin-danger`, `--admin-warning`, `--admin-success`, `--admin-row-height`, `--admin-space-*` (or reuse spacing), update `--admin-sidebar-active` to a calm slate/white overlay (e.g. `rgba(248,250,252,0.12)`), keep `--admin-content-max: 1600px`.

- [ ] **Step 3: Run test — pass**

Run: `npx vitest run test/systemAdmin.uiWave1.test.js`

- [ ] **Step 4: Commit**

```
git add app/globals.css test/systemAdmin.uiWave1.test.js
git commit -m "Add calm-ops admin design tokens for Wave 1 UI."
```

---

### Task 2: AdminHeader + shell chrome

**Files:**
- Create: `components/admin/AdminHeader.jsx`
- Modify: `components/shell/AdminShell.jsx`
- Modify: `components/admin/AdminGlobalSearch.jsx` (compact header variant)
- Modify: `components/admin/index.js`
- Test: `test/systemAdmin.uiWave1.test.js`

**Interfaces:**
- Produces: `AdminHeader({ admin, isMobile, sidebarOpen, onMenuClick, menuButtonRef, navId, title? })`
- Shell must NOT import `AppBar` or `Footer`

- [ ] **Step 1: Extend test — shell has no AppBar/Footer imports; exports AdminHeader**

- [ ] **Step 2: Implement AdminHeader**

Slim bar: menu button (aria-controls=navId), optional title from pathname map or “System Admin”, embed compact `AdminGlobalSearch`, env badge (`NODE_ENV` / `NEXT_PUBLIC_APP_ENV` if present), admin name + role, logout link to existing admin logout route (discover from AppBar or `/api/admin/auth/logout` / `/insightbooks/login`).

- [ ] **Step 3: Rewire AdminShell**

Remove AppBar + Footer; render AdminHeader; keep notice/support banners; content area uses `max-w-[var(--admin-content-max)] mx-auto w-full`.

- [ ] **Step 4: Run tests — pass; smoke shell in browser if possible**

- [ ] **Step 5: Commit**

```
git commit -m "Replace admin AppBar/Footer with dedicated AdminHeader."
```

---

### Task 3: Sidebar calm-ops polish

**Files:**
- Modify: `components/AdminSidebar/AdminSidebar.js`

- [ ] **Step 1: Polish sidebar styling**

Use `--admin-sidebar-*` tokens; section labels uppercase muted; active item clear but not purple glow; collapse tooltips; ensure touch targets; brand wordmark “InsightBooks” / “Admin” at top without emoji.

- [ ] **Step 2: Commit**

```
git commit -m "Polish AdminSidebar for calm-ops density."
```

---

### Task 4: AdminDataTable + AdminFilterBar

**Files:**
- Create: `components/admin/AdminDataTable.jsx`
- Create: `components/admin/AdminFilterBar.jsx`
- Modify: `components/admin/index.js`
- Test: `test/systemAdmin.uiWave1.test.js`

**Interfaces:**
- `AdminDataTable({ columns, rows, rowKey, emptyTitle, emptyDescription, onRowClick? })`
  - `columns`: `{ key, header, render?(row), mobileLabel?, hideOnMobile? }[]`
  - Desktop: table; mobile: stacked cards
- `AdminFilterBar({ search, onSearchChange, searchPlaceholder, children, actions })`
  - Mobile: filters in expandable panel

- [ ] **Step 1: Presence tests for new files + export names**

- [ ] **Step 2: Implement AdminDataTable**

- [ ] **Step 3: Implement AdminFilterBar**

- [ ] **Step 4: Run tests — pass**

- [ ] **Step 5: Commit**

```
git commit -m "Add AdminDataTable and AdminFilterBar primitives."
```

---

### Task 5: Form fields + Modal + Drawer

**Files:**
- Create: `components/admin/AdminField.jsx`
- Create: `components/admin/AdminModal.jsx`
- Create: `components/admin/AdminDrawer.jsx`
- Modify: `components/admin/index.js`
- Test: `test/systemAdmin.uiWave1.test.js`

**Interfaces:**
- `AdminField.Label`, `AdminField.Input`, `AdminField.Select`, `AdminField.Textarea`, `AdminField.Error` (or single `AdminField` with `as`)
- `AdminModal({ open, onClose, title, children, footer })` — Escape + backdrop
- `AdminDrawer({ open, onClose, title, children, side='right' })`

- [ ] **Step 1: Presence tests**

- [ ] **Step 2: Implement field kit + modal + drawer**

- [ ] **Step 3: Run full `npx vitest run test/systemAdmin` — all pass**

- [ ] **Step 4: Commit**

```
git commit -m "Add admin form fields, modal, and drawer primitives."
```

---

### Task 6: Wave 1 exit gate

- [ ] **Step 1: Update** `docs/system-admin-reimplementation/ADMIN_DESIGN_SYSTEM.md` briefly noting Wave 1 shipped primitives
- [ ] **Step 2: Manual checklist** — `/insightbooks/dashboard` at 375px and 1280px: header, sidebar drawer, no footer, no page-wide overflow
- [ ] **Step 3: Commit docs + final note**

```
git commit -m "Mark Wave 1 admin UI foundation ready for page migrations."
```

**Wave 1 done when:** Shell chrome is dedicated admin; primitives exported; tests green; Waves 2–4 can migrate pages onto the kit.
