# Design: POS visual parity for accounting module pages (Approach B)

**Date:** 2026-08-11  
**Status:** Approved (Approach B)

## Goal

Hand-restyle accounting module pages so they match `/pos` visual language: large title, muted subtitle, glass action buttons, glass content cards with top accent bars.

## POS pattern (source of truth)

- Page wrapper: `w-full`
- Header: `flex flex-col sm:flex-row justify-between … mb-6 lg:mb-8`
- Title: `text-3xl font-bold tracking-tight text-[var(--text-primary)] sm:text-4xl`
- Subtitle: `text-sm text-gray-600`
- Secondary actions: `px-4 py-2.5 border border-gray-300 bg-white/80 backdrop-blur-sm rounded-lg … hover:bg-white hover:shadow-md`
- Panels: `tenant-glass-card tenant-glass-card--accent` (or absolute `h-1` gradient bar + white/80 glass)

## Pages in scope

financial-calendar-v2, bank-reconciliation, equity-management, accounting-close, budget-forecast/forecasts, loan-readiness, capital-account, chart-of-accounts, journal-entries, trial-balance, reversals, general-ledger-v2

## Out of scope

Logic/API changes; chrome-extension console noise; admin insightbooks pages.
