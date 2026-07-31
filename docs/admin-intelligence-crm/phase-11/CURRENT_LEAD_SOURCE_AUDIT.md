# Current Lead Source Audit

**Audited:** 2026-07-30

| Source candidate | Class | Evidence |
|------------------|-------|----------|
| WEB_CONTACT (`/contact`) | PARTIAL | Form + email notify; no Lead / source code persist |
| WEB_REQUEST_DEMO | NOT_FOUND | Dedicated route absent; contact form doubles as demo request UX |
| WEB_START_TRIAL | NOT_FOUND | No CRM trial-enquiry Lead path |
| WEB_SALES_ENQUIRY | NOT_FOUND | — |
| WHATSAPP | NOT_AVAILABLE | Landing / FloatingWhatsApp CTA only |
| EMAIL_INBOUND | NOT_AVAILABLE | No ingest |
| MANUAL_ADMIN | NOT_FOUND | No CRM admin create |
| CS_EXPANSION_HANDOFF | PARTIAL | `CsExpansionHandoff` READY — record/link only; no Lead create |
| SUPPORT_HANDOFF | PARTIAL | `SupportHandoff` READY — link-only; no Lead create |
| PRODUCT_SIGNAL | NOT_AVAILABLE | Product analytics ≠ Lead volume; optional future context only |
| AFFILIATE_REFERRAL | PARTIAL | Affiliate domain exists — attribution seed, not Lead source enum |
| TENANT_POS_SALE | WRONG_DOMAIN | Never a platform Lead source |

**Implication:** Wave 2 introduces explicit source catalogue + channel codes. Existing CTAs/handoffs become producers only when wired; until then mark volume honesty gates.
