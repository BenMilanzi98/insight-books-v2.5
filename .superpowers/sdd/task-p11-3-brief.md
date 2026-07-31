### Task 3: Wave 3 — Qualification + scoring + ownership/territories + consent/DNC

**Depends on:** Waves 1–2 CRM (WORKING_TREE).

**Files (create / extend):**
- `lib/admin/crm/qualification/{catalogue,definitions,evaluate,index}.js` — versioned definitions; responses; UNKNOWN ≠ NO; blocking rules
- `lib/admin/crm/scoring/{catalogue,definitions,engine,index}.js` — deterministic 0–100; dimensions; contributions; confidence; bands; critical caps; **immutable history**; never label as probability/Revenue
- `lib/admin/crm/teams.js`, `territories.js`, `assignment.js` — sales teams/membership stubs; territory rules with precedence; assign strategies MANUAL + at least one of ROUND_ROBIN / TERRITORY_BASED; assignment history; accept/reject/return-to-queue; no silent reassign loops
- `lib/admin/crm/consent.js`, `eligibility.js` — consent purposes/statuses; DNC flags; `checkCommunicationEligibility({ contactId, purpose, channel })` — UNKNOWN/DENIED/WITHDRAWN/DNC block; never infer GRANTED
- Extend catalogue/authz/index; wire permissions for qualify/score/assign/consent
- Prisma models as needed: qualification definition/version/response, score definition/version/evaluation/contribution, sales team/member, territory/rule, assignment history, consent, communication preference, do-not-contact
- SQL: `scripts/sql/crm-core-phase11-wave3.sql`
- APIs under `app/api/admin/crm/` for qualification evaluate, score run, assign/accept, consent, eligibility check, teams/territories list
- Tests: `test/systemAdmin.crm.qualification.test.js`, `scoring.test.js`, `assignment.test.js`, `consent.test.js` (names flexible)

**Do NOT:** Opportunity create; ML/AI scoring; auto outbound messages; full Email/WhatsApp ingest; silent merge.

## Qualification

- At least one ACTIVE definition version (e.g. SMALL_BUSINESS_STANDARD or BANT-lite) with required criteria
- Response states: YES | NO | PARTIAL | UNKNOWN | NOT_APPLICABLE | PENDING_VERIFICATION
- Cannot mark Lead QUALIFIED while required criterion is UNKNOWN or blocking NO
- Override requires permission + reason
- Active definition not edited in place — new version

## Scoring

- Versioned definition with explicit weights
- Evaluation stores contributions + confidence (HIGH|MEDIUM|LOW|INSUFFICIENT)
- Missing data lowers confidence — does not invent values
- Critical caps: DO_NOT_CONTACT / SPAM / compliance block override positive engagement
- Historical evaluations immutable when definition changes
- UI/API labels must not say “probability” / “conversion chance” / “expected revenue”

## Assignment / territories

- Deterministic rule evaluation; ambiguous territory → visible failure
- Same owner+team noop; history on change
- Acceptance SLA fields optional foundation (assignedAt, acceptedAt)

## Consent / DNC

- Purposes include SALES_CONTACT, DEMO_COMMUNICATION, MARKETING_EMAIL, MARKETING_WHATSAPP (subset OK)
- Statuses: GRANTED|DENIED|WITHDRAWN|EXPIRED|PENDING|NOT_REQUIRED|UNKNOWN
- DNC: DO_NOT_EMAIL, DO_NOT_CALL, DO_NOT_WHATSAPP, DO_NOT_CONTACT_ALL, …
- Eligibility service is the gate for future outbound (Phase 11 provides service even if no auto-send)

## Global Constraints

Same Phase 11 plan constraints. **Do not git commit.** WORKING_TREE. SQL + guards if EPERM.

## Acceptance

- [ ] Versioned qualification; UNKNOWN ≠ NO
- [ ] Deterministic score + contributions + confidence; not probability
- [ ] Assignment history; no silent reassign loops
- [ ] Consent source-traceable; DNC blocks eligibility
- [ ] Vitest PASS (+ prior CRM suites green)
