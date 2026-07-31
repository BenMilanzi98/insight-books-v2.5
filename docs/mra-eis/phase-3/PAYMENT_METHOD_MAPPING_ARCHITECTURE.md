# Payment Method Mapping Architecture

**Phase:** 3 — Target Architecture
**Date:** 2026-07-22

Map local keys (cash, airtel_money, …) → verified MRA enums (**Phase 1 RC** — conditional).

Credit invoice fiscalizes once at issue; later payment ≠ new EIS sale. Split payment only if MRA representation verified.

---
*Phase 3 architecture. No MRA API calls. No production EIS implementation. No posted Journals modified.*
