# CRM Source Matrix

| Source code (planned) | Channel | Producer today | Lead persist | Wave | Class |
|-----------------------|---------|----------------|--------------|------|-------|
| WEB_CONTACT | Web form | `/contact` + demo-request email | No | 2 | PARTIAL → READY |
| WEB_REQUEST_DEMO | Web form | Absent dedicated route | No | 2 | NOT_FOUND |
| WEB_START_TRIAL | Web form | Absent CRM route | No | 2 | NOT_FOUND |
| WEB_SALES_ENQUIRY | Web form | Absent | No | 2 | NOT_FOUND |
| MANUAL_ADMIN | Admin API | Absent | No | 1–2 | NOT_FOUND |
| CS_EXPANSION_HANDOFF | Internal | `CsExpansionHandoff` record | No | 2 | PARTIAL |
| SUPPORT_HANDOFF | Internal | `SupportHandoff` record | No | 2 | PARTIAL |
| PRODUCT_CONTEXT | Internal | Optional featureCode on handoff | No | 2+ | NOT_AVAILABLE as volume |
| WHATSAPP | Messaging | `wa.me` CTA | No | Deferred | NOT_AVAILABLE |
| EMAIL_INBOUND | Email | — | No | Deferred | NOT_AVAILABLE |
| AFFILIATE | Partner | Affiliate domain | No | Later | PARTIAL seed |
| TENANT_POS | POS | `sales.*` | — | — | WRONG_DOMAIN |

**Rule:** Distinct source codes per form/handoff; never invent volume for NOT_AVAILABLE channels.
