# Current Lead Capture Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Idempotent Lead capture service | NOT_FOUND | No `lib/admin/crm` capture module |
| Persist Lead on public submit | NOT_FOUND | Demo-request emails only |
| `/contact` page | PARTIAL | `app/contact/page.js` → `POST /api/contact/demo-request` |
| `/request-demo` dedicated route | NOT_FOUND | — |
| `/start-trial` dedicated CRM route | NOT_FOUND | Public signup/trial may exist elsewhere as product onboarding — not CRM Lead capture |
| `/sales-enquiry` route | NOT_FOUND | — |
| Demo-request API | PARTIAL / WRONG_DOMAIN as Lead | `app/api/contact/demo-request/route.js` — validates fields, `sendEmail`, calendar URL; **no DB Lead write** |
| WhatsApp capture | NOT_AVAILABLE | CTA opens `wa.me`; no webhook / Lead create |
| Email inbox → Lead | NOT_AVAILABLE | No mail ingest producer |
| Manual admin Lead create API | NOT_FOUND | — |
| CS / Support handoff → Lead | NOT_FOUND | Handoffs READY as records; no Lead bridge |
| Capture source codes | NOT_FOUND | No CRM source catalogue |

**Implication:** Wave 2 shared capture service; wire `/contact`; add dedicated forms with distinct source codes; keep Email/WhatsApp as NOT_AVAILABLE contracts.
