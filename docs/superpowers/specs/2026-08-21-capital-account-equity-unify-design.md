# Capital Account ← Equity Management unify — Design Spec

**Date:** 2026-08-21  
**Status:** Approved  
**Choice:** B — Unified page (equity main + transfers link)

## Goals

1. `/capital-account` hosts simplified Equity UI (owners / record / history).
2. Clear Transfers section linking to `/capital-account/transfers`.
3. `/equity-management` redirects to `/capital-account`.
4. Single sidebar entry; fix `GET /api/capital-account` 500.

## Non-goals

Rename `/api/equity-management` APIs; rewrite transfer posting.

## Acceptance

- Equity Post works from `/capital-account`.
- Transfers reachable from page.
- Redirect works.
- Capital account GET returns 200 when GL exists (degraded secondary data OK).
