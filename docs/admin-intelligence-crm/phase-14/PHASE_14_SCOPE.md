# Phase 14 Scope — Sales Demo Management

**Locked:** 2026-07-30 (design approved)  
**Sequencing:** Approach B — Wave 0 forensic → Waves 1–4 implementation

## In scope

1. **Demo Requests** — capture qualification path from Lead `DEMO_REQUEST` / `REQUEST_DEMO`; numbering `DMR-YYYY-######`; qualify/convert idempotent
2. **CrmDemo** — first-class entity `DEMO-YYYY-######`; status/readiness spine; Opportunity/Lead projections
3. **Scheduling** — required CrmMeeting + Calendar Event via Phase 13; conflict/timezone reuse; Demo times reconcile
4. **Participants / Presenters** — RSVP ≠ attendance; recording consent separate
5. **Agenda / Script / Scenario / Content** — versioned; SoD approve; customer-safe vs restricted projections; en/ny foundations
6. **Logical Demo Environments** — DENV numbering; governance + local/logical READY path; data packs; Production-data rejection; expiry/reset idempotent; DEMO banner
7. **Checklist / Rehearsal** — block readiness on Critical fails
8. **Delivery** — session, questions, live issues; source-backed attendance
9. **Recording governance** — request/consent/approve/deny only; provider NOT_AVAILABLE
10. **Feedback / Outcome / Follow-Up** — outcome ≠ auto Opportunity mutation; Follow-Up via Phase 13
11. **Proposal / Trial handoffs** — typed payloads only; Phase 15 owns Proposal create
12. **Demo reporting centre + schedules** — honesty-gated; no false zeroes
13. **Phase 15 pack** — FINAL report + inputs + readiness checklist at Wave 4 exit

## Explicitly out of scope

- Proposal/Quotation/e-sign/contracts create
- Production Tenant / Subscription / Invoice / Payment provision
- AI scripts / answers / summaries
- Live recording provider / fabricated recording files
- Real cloud/container Demo infra (logical provisioner only)
- Automatic Opportunity stage / probability / close-date changes
- Full Trial management
- Production data cloning
- Sales quotas / commissions
- Accounting / billing / MRA fiscal changes
- System CoA admin (stays removed)
- Weighted Pipeline UI (Phase 16)
- Live telephony / Google-Outlook sync / Email-WhatsApp ingest (carry NOT_AVAILABLE / NOT_CONNECTED)

## Carry blockers (document; do not invent CONNECTED)

| Blocker | Status |
|---------|--------|
| Telephony / Call recording | NOT_AVAILABLE |
| Google / Outlook calendar sync | NOT_CONNECTED |
| Email / WhatsApp Lead ingest | NOT_AVAILABLE |
| `resolveCrmScope` owner/team/territory | stub `mode: 'all'` |
| Prisma EPERM on Windows | SQL + `hasCrm*Model` guards |
| Recording media provider | NOT_AVAILABLE |
| Real cloud Demo infra | NOT_AVAILABLE (logical only) |
| Weighted Pipeline UI | Phase 16 |
| Proposal/Tenant create transactions | handoff only |

## Domain boundary

| Concept | Plane |
|---------|-------|
| CrmDemo / CrmDemoRequest | Phase 14 Sales Demo |
| CrmMeeting / Calendar | Phase 13 Activity (schedule reuse) |
| Lead `DEMO_REQUEST` / capture `REQUEST_DEMO` | Phase 11 foundation → Demo Request convert |
| MRA EIS sandbox entitlement | WRONG_DOMAIN — never alias as Demo Environment |
| Tenant POS `sales.*` | WRONG_DOMAIN |
| CsTask / Support | WRONG_DOMAIN |
