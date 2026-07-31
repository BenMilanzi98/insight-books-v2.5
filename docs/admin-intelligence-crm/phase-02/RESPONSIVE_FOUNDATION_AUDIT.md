# Responsive Foundation Audit

| Breakpoint behaviour | Status |
|----------------------|--------|
| `<768` mobile drawer | Present in AdminShell |
| Desktop collapse | Present |
| AdminDataTable mobile cards | Partial — verify/extend |
| Page-wide horizontal overflow | Risk on dense tables — enforce `min-w-0` / overflow rules on containers |
| 320px target | Must verify after foundation changes |

## Phase 2 rules

- `AdminPageContainer` / viewport: `min-w-0 overflow-x-hidden` (or controlled scroll)
- Tables: horizontal scroll region, never page-level overflow
- Touch targets ≥ 44px on primary controls (header already uses h-11)
