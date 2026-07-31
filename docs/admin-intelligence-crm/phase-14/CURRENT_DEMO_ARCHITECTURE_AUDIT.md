# Current Demo Architecture Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Canonical CrmDemo parent | NOT_FOUND | No `CrmDemo` / `DEMO-` numbering in Prisma (`rg model Crm` → no Demo*) or `lib/admin/crm/demos/*` (glob 0 files) |
| CrmDemoRequest | NOT_FOUND | No `CrmDemoRequest` / `DMR-` numbering |
| Demo hub UI | NOT_FOUND | No `/insightbooks/crm/demos` under `app/insightbooks/crm` (activities/meetings/pipeline present; demos absent) |
| Demo APIs | NOT_FOUND | No `app/api/admin/crm/demos/**` or `demo-requests/**` (70 CRM admin routes; none Demo) |
| Lead DEMO_REQUEST type | FOUNDATION | `lib/admin/crm/catalogue.js` `CRM_LEAD_TYPE.DEMO_REQUEST`; capture maps `REQUEST_DEMO` → type (`capture.js` `defaultLeadType`) |
| Public request-demo capture | FOUNDATION | `app/request-demo/page.js` → `POST /api/request-demo` → `handlePublicCapturePost(..., REQUEST_DEMO)` |
| Meeting as schedule substrate | EXTEND / CORRECT_AND_REUSABLE | `lib/admin/crm/meetings/*` + Prisma `CrmMeeting`; Meeting ≠ Demo (`meetings/index.js` header; P13 MEETING_STATE_MATRIX) |
| Calendar reconcile substrate | EXTEND | `lib/admin/crm/calendar/*` + `CrmCalendarEvent`; Google/Outlook `NOT_CONNECTED` |
| MRA EIS sandbox | WRONG_DOMAIN / FORBIDDEN | `lib/mraEis/application/entitlementService.js` sandboxAllowed; Tenant fiscal sandbox — not Sales Demo Environment |
| Foundations deferral | CORRECT_AND_REUSABLE | `foundations.js` ACTIVITY_SPINE: "Demo/Proposal/Tenant provision deferred" |
| Target architecture mention | FOUNDATION (docs) | `docs/admin-intelligence-crm/TARGET_ARCHITECTURE.md` lists `CrmDemo` as future; Tenant quotations wrong plane |
| One Demo / many projections rule | NOT_FOUND | Design locked; not implemented — Wave 1 |

**Implication:** Wave 1 greenfield `lib/admin/crm/demos/*` + CrmDemo/CrmDemoRequest. Reuse Lead capture as intake; schedule via Meeting; never alias MRA sandbox or Meeting-as-Demo.
