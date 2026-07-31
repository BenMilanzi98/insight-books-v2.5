# Cache Foundation Audit

## Current

No shared admin client cache layer. Next.js fetch cache may apply on server components; most admin UI is client-fetched.

## Phase 2 rules (document + light helpers)

| Rule | Detail |
|------|--------|
| Default | No stale financial caches in browser beyond in-flight dedupe |
| Mutations | Invalidate by resource key helper (callback registry — simple) |
| Server | Prefer `cache: 'no-store'` on admin authenticated GETs |
| Do not | Introduce Redis/admin CDN caching for control plane in this phase |
