# Component Inventory — Admin UI

**Audited:** 2026-07-28  
**Evidence:** `components/admin/*`, `components/shell/AdminShell.jsx`, `components/AdminSidebar`

## Shell

| Component | Path | Classification |
|-----------|------|----------------|
| AdminShell | `components/shell/AdminShell.jsx` | `KEEP` / `EXTEND` (Phase 2 foundation) |
| AdminSidebar | `components/AdminSidebar/AdminSidebar.js` | `KEEP` |
| Admin nav config | `lib/admin/adminNav.js` | `KEEP` |

## Admin kit (`components/admin/`)

| Component | Use | Classification |
|-----------|-----|----------------|
| AdminPageContainer / AdminPageEnter | Page layout / motion | `REUSE` |
| AdminPageHeader | Titles / actions | `REUSE` |
| AdminDataTable | Tables (+ mobile layout) | `REUSE` / `EXTEND` |
| AdminSummaryCard | KPI cards | `REUSE` |
| AdminStatusBadge | Status chips | `REUSE` |
| AdminLoadingState / Error / Empty | States | `REUSE` |
| AdminModal / Drawer / Field / FilterBar | Forms & filters | `REUSE` |
| AdminActionMenu | Row actions (portaled) | `REUSE` |
| AdminConfirmationDialog | Destructive confirms | `REUSE` |
| AdminGlobalSearch | Header search | `EXTEND` |
| AdminChartCard / Pie / Trend / Bar | Charts (Recharts) | `REUSE` for intelligence |
| AdminMraEisSectionNav | MRA EIS section strip | `KEEP` (domain-specific) |
| AdminSupportAccessBanner / NoticeBanner | Ops banners | `REUSE` |

## Gaps vs PRD Phase 2 foundation

| Needed | Status |
|--------|--------|
| Date-range selector (shared) | **INCOMPLETE** — not a shared kit component yet |
| Notification centre | **INCOMPLETE** |
| Export dialogs (standard) | **INCOMPLETE** / ad-hoc per page |
| Mobile admin nav drawer | Partial via AdminShell | `EXTEND` |
| Kanban / pipeline board | **NOT_FOUND** |
| Calendar component | **NOT_FOUND** in admin kit |

## Do not reuse for Admin

| Component family | Why |
|------------------|-----|
| Tenant `components/Sidebar` accounting nav | Wrong plane |
| Tenant POS / Invoice modals | Tenant transactional UI |
