# Demo Source Matrix

| Source | Producer today | Creates CrmDemo / DMR | Wave | Class |
|--------|----------------|----------------------|------|-------|
| Public `/request-demo` | `captureLead` REQUEST_DEMO | Lead DEMO_REQUEST only | 1 convert | FOUNDATION |
| `/contact` demo-request | capture WEBSITE_CONTACT_FORM + email | Lead (not DEMO_REQUEST type by default) | 1 optional map | FOUNDATION |
| Manual admin Lead DEMO_REQUEST | `createLead` type | Lead only | 1 convert | FOUNDATION |
| CS/Support/Product handoff | `intakeHandoffAsLead` | Lead EXPANSION/etc — not Demo | — | WRONG_SHAPE for Demo unless retyped |
| Qualify Demo Request | — | No | 1 | NOT_FOUND |
| Convert Demo Request → Demo | — | No | 1 | NOT_FOUND |
| Manual create Demo | — | No | 1 | NOT_FOUND |
| Schedule Demo | — | No (Meeting exists separately) | 1 | NOT_FOUND / Meeting EXTEND |
| Meeting create alone | `createMeeting` | Meeting ≠ Demo | — | FORBIDDEN as Demo source |
| MRA EIS sandbox grant | entitlementService | No | — | WRONG_DOMAIN / FORBIDDEN |
| Opportunity Closed Won | close.js | No | — | FORBIDDEN invent Demo |
| Fabricated engagement import | — | No | — | FORBIDDEN |
| Email/WhatsApp inbound | Foundations | No | — | NOT_AVAILABLE |
| Analytics / POS sales | Ops / Tenant | No | — | WRONG_DOMAIN |

**Rule:** Demo Request and Demo are first-class. Lead DEMO_REQUEST is intake foundation — convert idempotently. Never invent Demo volume from Meetings, MRA sandbox, or analytics.
