# Current Proposal Architecture Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Canonical CrmProposal | NOT_FOUND | No `model CrmProposal` in `prisma/schema.prisma`; no `lib/admin/crm/commercial/*` or `proposals.js` CRM module |
| CrmCommercialDocument spine | NOT_FOUND | Design Approach 1 locked; not implemented |
| CrmProposalRequest / PRQ numbering | NOT_FOUND | No `PRQ-` / proposal-request services |
| PROP- numbering | NOT_FOUND | — |
| Proposal hub UI | NOT_FOUND | No `app/insightbooks/crm/proposals/**` (CRM has demos/pipeline/opportunities/activities; no proposals) |
| Proposal APIs | NOT_FOUND | No `app/api/admin/crm/proposals/**` or `proposal-requests/**` |
| Opp proposal readiness | CORRECT_AND_REUSABLE | `lib/admin/crm/opportunities/proposalReadiness.js` — checklist + `CRM_PROPOSAL_HANDOFF`; `proposalCreated: false` |
| Demo proposal handoff | CORRECT_AND_REUSABLE | `lib/admin/crm/demos/handoffs.js` `emitDemoProposalHandoff` — idempotent; rejects `createProposal` |
| Opp commercial estimate as Proposal | WRONG_SOURCE / FABRICATED_PRICE_RISK | `commercial.js` non-binding amount — must not be issued as Proposal truth |
| Tenant Quotation as Proposal | WRONG_DOMAIN | `Quotation` tenant AR model — different plane |
| Target architecture mention | FOUNDATION (docs) | `TARGET_ARCHITECTURE.md` lists `CrmProposal` future; tenant quotations wrong plane |
| Foundations deferral | CORRECT_AND_REUSABLE | Phase 12–14 honesty: invent Proposal forbidden |

**Implication:** Wave 1 greenfield `lib/admin/crm/commercial/*` + CrmProposalRequest / CrmCommercialDocument / CrmProposal. Consume Demo + Opp handoffs as request sources; never alias tenant Quotation or invent from estimate alone.
