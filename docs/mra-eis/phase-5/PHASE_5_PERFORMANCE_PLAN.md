# Performance Plan

- Bounded pagination (max 200)
- Indexed status/queue scans
- Batch line/payment inserts in snapshot create
- Avoid unbounded JSON loads in list APIs
- Outbox/transmission claim uses SKIP LOCKED

---
*Phase 5 implementation. No MRA API calls. No terminal activation. No plaintext credentials. No posted Journals/Sales/Stock mutated.*
