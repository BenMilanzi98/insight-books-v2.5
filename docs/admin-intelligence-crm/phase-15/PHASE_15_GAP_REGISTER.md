# Phase 15 Gap Register

**Audited:** 2026-07-31  
**Inputs:** Phase 14 `PHASE_15_INPUTS.md`, Wave 0 audits, design/plan

| ID | Gap | Severity | Wave | Notes |
|----|-----|----------|------|-------|
| G15-01 | No CrmProposalRequest / PRQ numbering | BLOCKER | 1 | Greenfield under `lib/admin/crm/commercial/*` |
| G15-02 | No CrmCommercialDocument + versions | BLOCKER | 1 | Approach 1 spine |
| G15-03 | No CrmProposal / CrmQuotation typed extensions | BLOCKER | 1 | Distinct; may link |
| G15-04 | No qualify/convert Proposal Request (idempotent) | BLOCKER | 1 | Consume Demo + Opp handoffs |
| G15-05 | No status machine / immutability foundations | BLOCKER | 1 | Issued edit blocked |
| G15-06 | No commercial hub UI/APIs (thin stubs OK) | HIGH | 1 stubs → 4 | proposals/quotations/commercial |
| G15-07 | No CRM Price Books / entries | BLOCKER | 2 | New PB- domain |
| G15-08 | No calculateCommercialDocument / snapshots | BLOCKER | 2 | Deterministic + idempotent |
| G15-09 | No CRM FX snapshots (explicit) | HIGH | 2 | Forbid currencyService silent 1.0 |
| G15-10 | No CRM commercial tax rules | HIGH | 2 | No Tenant GL / MRA fiscal |
| G15-11 | No discount policies / exception engine | HIGH | 2 | SoD on protected paths |
| G15-12 | No commercial approval engine | BLOCKER | 2 | ≠ close/probability stubs |
| G15-13 | No terms/clauses foundations | HIGH | 2 | Restricted projection later |
| G15-14 | No proposal/quotation templates + branding | HIGH | 3 | |
| G15-15 | No deterministic PDF + checksum + private storage | BLOCKER | 3 | Real renderer |
| G15-16 | No issue / delivery / review access | BLOCKER | 3 | Eligibility + Phase 13 email |
| G15-17 | No acceptance/rejection with identity/authority | BLOCKER | 3 | ≠ Closed Won |
| G15-18 | No expiry/withdraw/supersede | HIGH | 3 | Idempotent jobs |
| G15-19 | E-sign provider | CARRY | 3 boundary | NOT_CONFIGURED — models only |
| G15-20 | No commercial reports/exports/schedules | HIGH | 4 | Honesty gates |
| G15-21 | No DQ / reconciliation / reliability gate | HIGH | 4 | Never false zero |
| G15-22 | No Closed-Won readiness + Phase 16 handoff create | HIGH | 4 | Payload only; EXTEND conversionReadiness |
| G15-23 | Tenant Quotation alias risk | PROCESS | All | WRONG_DOMAIN docs + guards |
| G15-24 | Opp estimate treated as issued price | PROCESS | All | FABRICATED_PRICE_RISK |
| G15-25 | resolveCrmScope stub | CARRY | Harden | mode:all |
| G15-26 | Weighted Pipeline UI | DEFERRED | Phase 16 | |
| G15-27 | Prisma EPERM Windows | CARRY | All | SQL + hasCrm*Model |
| G15-28 | Telephony / calendar sync / ingest / Demo cloud/recording | CARRY | Orthogonal | NOT_AVAILABLE / NOT_CONNECTED |
| G15-29 | Rich commercial UI beyond thin stubs | MEDIUM | 1–4 | Thin stubs acceptable early |
| G15-30 | AI proposals/pricing/clauses | FORBIDDEN | — | Never |

**No TBD blocking Wave 1 after CONDITIONAL GO** — Demo/Opp handoffs, Account/Contact/consent, Opp commercial/products foundations, Email/eligibility, and approved design are sufficient to start Proposal Request + commercial document spine; pricing/PDF/acceptance/reports follow Waves 2–4.
