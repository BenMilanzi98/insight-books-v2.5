# Current Demo Request Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| CrmDemoRequest model | NOT_FOUND | Absent from Prisma |
| DMR numbering | NOT_FOUND | No `DMR-YYYY-######` generator |
| Qualify / convert Demo Request | NOT_FOUND | No qualify/convert services under demos |
| Lead type DEMO_REQUEST | FOUNDATION | `CRM_LEAD_TYPE.DEMO_REQUEST` in `catalogue.js`; tests `systemAdmin.crm.capture.test.js` assert type on REQUEST_DEMO |
| Capture source REQUEST_DEMO | FOUNDATION | `CRM_CAPTURE_SOURCE.REQUEST_DEMO`; `capture.js` → Lead create idempotent |
| Dedicated page/API | FOUNDATION | `app/request-demo/page.js`; `app/api/request-demo/route.js` |
| Contact form overlap | FOUNDATION / DISTINCT | `POST /api/contact/demo-request` uses `WEBSITE_CONTACT_FORM` (not REQUEST_DEMO) — intentional distinct codes (P11) |
| Lead → Opportunity path | CORRECT_AND_REUSABLE (adjacent) | Opportunity from READY handoff exists; not Demo Request convert |
| Demo Request state machine | NOT_FOUND | Design: qualify → convert → CrmDemo |
| Admin Demo Request UI/API | NOT_FOUND | No `/crm/demos/requests` or demo-requests API |

**Implication:** Wave 1 introduces CrmDemoRequest from Lead/capture foundations; convert idempotent to CrmDemo. Do not treat Lead itself as Demo Request entity long-term — Lead remains CRM subject; DMR is Demo plane.
