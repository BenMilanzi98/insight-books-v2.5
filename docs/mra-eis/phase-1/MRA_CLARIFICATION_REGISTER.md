# MRA Clarification Register

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

| Question ID | Topic | Exact question | Why it matters | Conflicting sources | Security | Accounting | Ops | Cert | Temporary assumption | Blocked? | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Q-001 | OpenAPI location | Confirm swagger/v1/swagger.json remains canonical | Discovered 200 OK | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | NO | CLOSED |
| Q-002 | Success statusCode | Confirm per-endpoint success values (0 vs 1) | Samples conflict | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-003 | Site products method | Confirm POST vs GET for get-terminal-site-products | OpenAPI POST / guide GET | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-004 | Base URLs | Confirm prod/sandbox bases remain current | Probed 200 | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | NO | CLOSED |
| Q-005 | Duplicate /api/v1 | Confirm sample path duplication is documentation error | Guide samples | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | NO | READY_TO_SUBMIT |
| Q-006 | Localhost samples | Confirm any localhost URLs are non-normative | Prompt concern | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | NO | READY_TO_SUBMIT |
| Q-007 | Authorization format | Is Authorization raw JWT or Bearer prefix? | Guide raw; common Bearer | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-008 | x-access-key | Is x-access-key required on any endpoint? | Absent OpenAPI | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-009 | x-signature scope | Confirm only activation confirmation uses x-signature | OpenAPI only there | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | NO | READY_TO_SUBMIT |
| Q-010 | x-eis-message-hash | Is message-hash required? Algorithm and input? | Absent OpenAPI/guide | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | BLOCKING |
| Q-011 | Hash serialization | If hash required, exact canonical JSON rules? | Depends Q-010 | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | BLOCKING |
| Q-012 | GET/empty hash | Hashing rules for empty body | Depends Q-010 | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | BLOCKING |
| Q-013 | Confirmation signature input | Confirm TAC+secretKey HMAC-SHA512 Base64 | KAT exists; sandbox pending | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | NO | READY_TO_SUBMIT |
| Q-014 | JWT expiry/renewal | Lifetime and request-new-terminal-token response shape | Partial | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-015 | secretKey rotation | How to rotate without reactivation? | Undocumented | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-016 | Activation timeout recovery | Recover if activate succeeded but response lost | No endpoint found | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | BLOCKING |
| Q-017 | SaaS MAC / environment ID | Accepted stable identity for hosted multi-tenant SaaS | MAC mandatory in guide | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | BLOCKING |
| Q-018 | Multi-tenant terminal scope | One terminal per tenant vs shared? | Critical architecture | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | BLOCKING |
| Q-019 | Multi-branch terminals | Terminal per site/till rules | siteId vs terminal | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | BLOCKING |
| Q-020 | Terminal position assignment | Who assigns; concurrency | Fiscal numbering | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-021 | Fiscal number algorithm | Provide worked examples + Base64 integer encoding | Cannot reproduce yet | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | BLOCKING |
| Q-022 | Fiscal timezone | Timezone for Julian day / daily reset | Undocumented | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-023 | Duplicate fiscal number | Exact error/response | Unknown | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-024 | Unknown-outcome recovery | Official recovery sequence for sales timeout | last-online only? | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-025 | Last-online scope | Per terminal/site/TIN? | Undocumented | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | NO | READY_TO_SUBMIT |
| Q-026 | Last-offline scope | Same as online? | Undocumented | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | NO | READY_TO_SUBMIT |
| Q-027 | Line calculation/rounding | Official formulas and scale | Ambiguous | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | BLOCKING |
| Q-028 | Amount tendered | When mandatory? | Schema optional | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | NO | READY_TO_SUBMIT |
| Q-029 | Split payment | Representation? | No enum | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-030 | Credit sale | paymentMethod + AR treatment | Undocumented | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-031 | Product/service flag | isProduct semantics | Boolean only | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | NO | READY_TO_SUBMIT |
| Q-032 | Tax-rate activation | Rejection if not activated? | Likely | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | NO | READY_TO_SUBMIT |
| Q-033 | Levy calculation | Official levy math | Partial | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-034 | VAT5 concurrency | Quantity consumption race | Guide partial | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-035 | Receipt cancellation API | Full void rules | Endpoint exists; rules thin | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-036 | Credit-note process | All cases covered by process-credit-debit-note? | Summary only | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-037 | Refund process | Refund vs credit vs void | Critical | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | BLOCKING |
| Q-038 | Return process | Partial/full return | Critical | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | BLOCKING |
| Q-039 | Offline certification | Mandatory tests for offline claim | Guide high-level | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-040 | Offline signature KAT | Provide official test vector | Cannot certify algo | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | BLOCKING |
| Q-041 | Threshold zero | Does 0 mean unlimited or disabled? | Ambiguous | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | BLOCKING |
| Q-042 | Cumulative amount scope | Per terminal/site/outage? | Ambiguous | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-043 | Offline age start | Clock source | Ambiguous | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-044 | Blocked + offline | May offline continue after shouldBlockTerminal? | Safety critical | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | BLOCKING |
| Q-045 | Config refresh | Are stale versions hard-rejected? | Flag exists | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | NO | READY_TO_SUBMIT |
| Q-046 | Product sync pagination | Limits/rate | Undocumented | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | NO | READY_TO_SUBMIT |
| Q-047 | Initial inventory batch | Confirm max 50 | OpenAPI says 50 | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | NO | READY_TO_SUBMIT |
| Q-048 | Initial inventory duplicates | Behaviour | Undocumented | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | NO | READY_TO_SUBMIT |
| Q-049 | Data retention | Legal minimums | Regs needed | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |
| Q-050 | Re-certification on updates | When productVersion must change | Partial | See discrepancy register | Y/N | Y/N | Y/N | Y/N | Do not invent; prefer OpenAPI method/path | YES | READY_TO_SUBMIT |

**Blocking count:** 35

Submission: DRAFT/READY — not submitted to MRA in Phase 1.

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*
