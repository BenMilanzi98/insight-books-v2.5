# Closed-Period and Prior-Year Repair Policy

Periods are never reopened automatically, and the posting engine independently
rejects journals into closed periods — a repair cannot bypass period control.

## Treatment ladder

1. **Current open period correction** — normal repair posting; original
   transaction date preserved in metadata.
2. **Reopened period correction** — only via the accounting-period module's own
   authorization (period controller + documented reason); repair posts; period
   is re-closed; the reopen/re-close is in the period audit trail.
3. **Prior-period adjustment (period closed, year open)** — post in the earliest
   permitted open period; affected historical period recorded in journal
   metadata; disclosure metadata attached.
4. **Prior-year adjustment** — as above plus retained-earnings impact
   assessment; approval requires Finance Manager + auditor/designated reviewer;
   previously issued statements trigger the disclosure requirement on the
   batch.
5. **Tax-impacting adjustment** — additionally requires tax reviewer sign-off
   and the tax impact recorded on the batch for return amendment assessment.

Requirements for every closed-period repair: authorization, documented reason,
matrix approval, immutable audit trail, re-close procedure, report regeneration
for affected periods, stakeholder notification where statements were issued.

Where policy requires correcting in the current period: preserve the original
transaction date, use the approved adjustment posting date, and record the
affected historical period in metadata — all three are fields of the repair
command/journal metadata.
