# Inventory Architecture Audit

**Phase:** 2 — Internal Architecture Audit
**Audit date:** 2026-07-22

- Local stock authoritative via Product.stockLevel + InventoryTransaction.
- FIFO COGS on sale (`consumeFifoForSale`).
- MRA Virtual Warehouse is **separate compliance view** — must not mutate local stock from MRA sync without approved Stock Movement.
- Initial Inventory upload ≠ Opening Stock GL.

---
*Phase 2 forensic audit. No MRA API calls. No production EIS implementation.*
