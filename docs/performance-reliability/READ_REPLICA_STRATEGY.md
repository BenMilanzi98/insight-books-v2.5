# Read Replica Strategy

**Purpose:** Scale read-heavy CP-10..14 without overloading primary PostgreSQL.

**Current:** **No read replica** configured ([CURRENT_PERFORMANCE_ARCHITECTURE.md](./CURRENT_PERFORMANCE_ARCHITECTURE.md)).

**Target:** Streaming replica; route read-only Prisma client for reports/ledger lists; **writes always primary** (posting, close).

**Status:** NOT STARTED — required before multi-app horizontal scale at high read load.

**Links:** [SCALING_STRATEGY.md](./SCALING_STRATEGY.md), [TARGET_PERFORMANCE_ARCHITECTURE.md](./TARGET_PERFORMANCE_ARCHITECTURE.md)
