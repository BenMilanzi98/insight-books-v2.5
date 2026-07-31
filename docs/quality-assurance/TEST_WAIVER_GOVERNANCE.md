# Test Waiver Governance

Process for **intentionally not** meeting test, coverage, or CI requirements. Waivers do not apply to **Critical** security gaps (GAP-SEC-001, 013, 014, 026, 030) without CISO + engineering sign-off.

---

## Waiver classes

| Class | Code prefix | Use case | Max duration | Approvers |
|---|---|---|---|---|
| Retired API skip | W-SKIP-RETIRED | `describe.skip` for removed APIs | Permanent | Tech lead |
| DB integration skip | W-SKIP-DB | CI without QA tenant | 90 days | QA lead |
| Coverage shortfall | W-COV | Below threshold on legacy path | 30 days | Tech lead |
| Flaky quarantine | W-FLAKY | Quarantined flaky test | 14 days | QA lead |
| Migration deferral | W-MIG | Rehearsal not run pre-release | 7 days | Finance + Eng |
| Security test defer | W-SEC | SEC suite not ready | **Not allowed** for SEC-2/IDOR | Security reviewer |

---

## Active waivers (July 2026)

| Waiver ID | Class | Scope | Reason | Expiry | Status |
|---|---|---|---|---|---|
| W-SKIP-RETIRED-001 | W-SKIP-RETIRED | `accountingV2.posting.test.js` 4 blocks | `postAccountingEvent` removed | Permanent until archive | ACTIVE |
| W-SKIP-RETIRED-002 | W-SKIP-RETIRED | `accountingV2.postingEngine.test.js` shadow block | Shadow mode removed | Permanent until archive | ACTIVE |
| W-SKIP-DB-001 | W-SKIP-DB | 3 skipIf tenant tests | No QA tenant in default CI | 2026-10-01 | ACTIVE |
| W-COV-001 | W-COV | No coverage gate | Tooling not configured GAP-QA-002 | 2026-09-01 | ACTIVE |

**Note:** 55 failing tests are **not waived** — they block G1 and require fix (GAP-QA-001).

---

## Request template

```markdown
## Waiver request W-____-___

- **Class:**
- **Scope:** (files, gates, findings)
- **Linked GAP/Q finding:**
- **Justification:**
- **Compensating control:** (manual test, audit rule, staging job)
- **Expiry date:**
- **Approvers:**
```

Store approved waivers in `docs/quality-assurance/waivers/W-*.md` (folder created when first non-doc waiver needed).

---

## Renewal

| Rule | Detail |
|---|---|
| Renewal limit | 2 extensions max per waiver |
| Renewal review | Must show progress ticket |
| Expired waiver | CI gate enforced; merge blocked |

---

## Prohibited

- Waiving G1 (unit fail) on `main` without fix
- Waiving SEC-2 IDOR test absence past Phase 15 exit
- Permanent W-FLAKY without replacement test plan
- Waiving migration rehearsal for production cutover (see `RELEASE_CERTIFICATION_PROCESS.md`)

---

## Audit trail

Waivers referenced in:
- `FLAKY_AND_SKIPPED_TEST_REGISTER.md`
- `PHASE_16_TASKS.md` exit checklist
- `RELEASE_CERTIFICATION_PROCESS.md` sign-off packet

---

## Related

- `FLAKY_TEST_POLICY.md`
- `CI_QUALITY_GATES.md`
- `docs/security-governance/PHASE_16_READINESS.md`
