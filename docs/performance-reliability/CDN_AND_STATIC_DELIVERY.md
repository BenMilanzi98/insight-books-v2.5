# CDN and Static Delivery

**Purpose:** Edge caching for static assets and public uploads policy.

**Current:** Next.js `_next/static` served from app; **no nginx/CDN config in repo**.

**Target:** CDN in front of static; long cache headers for hashed assets; uploads remain origin-only.

**Status:** NOT STARTED.

**Links:** [TARGET_PERFORMANCE_ARCHITECTURE.md](./TARGET_PERFORMANCE_ARCHITECTURE.md), [SCALING_STRATEGY.md](./SCALING_STRATEGY.md)
