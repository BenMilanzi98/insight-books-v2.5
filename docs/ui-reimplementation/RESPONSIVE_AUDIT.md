# Responsive Audit

**Date:** 2026-07-25

## Breakpoints in use

- Shell mobile cutover: `768px` (`RootLayoutClient`)
- Tailwind defaults (sm/md/lg/xl) used inconsistently across pages
- No documented container system; many pages use `max-w-7xl` or none

## Issues

| Issue | Severity | Class |
|-------|----------|-------|
| Mobile sidebar width animates to 0 without focus trap | High | REFACTOR |
| Main padding `24px 32px` tight on 320px | Medium | STANDARDISE |
| Tables often full desktop grids | High | REIMPLEMENT mobile strategy |
| Filters inline on desktop only | Medium | EXTEND FilterDrawer |
| Dual V2 pages add more ad-hoc layouts | Medium | STANDARDISE |

## Target test widths

320, 360, 375, 390, 412, 430, 768, 1024, 1280, 1440, 1920, 2560 — smoke per wave.
