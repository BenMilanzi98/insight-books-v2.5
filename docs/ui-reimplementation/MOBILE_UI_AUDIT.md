# Mobile UI Audit

**Date:** 2026-07-25

## Shell
- Sidebar slides via transform; backdrop z-index 900 vs sidebar 1000.
- No Escape-to-close / focus trap / focus restore documented.
- AppBar controls can crowd on narrow widths.

## Content patterns
- Many list pages render wide HTML tables → page-wide overflow risk.
- Forms often multi-column without `grid-cols-1` fallback.
- Modals are page-local fixed overlays; complex ones not near-fullscreen.

## Classification
Mobile navigation: REFACTOR. Tables: REIMPLEMENT card/priority strategy. Forms: STANDARDISE one-column.
