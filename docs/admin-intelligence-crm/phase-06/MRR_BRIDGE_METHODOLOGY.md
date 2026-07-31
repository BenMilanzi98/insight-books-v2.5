# MRR Bridge Methodology

## Strategy: reconstruct-then-snapshot

1. **Point-in-time:** `normalizeAmountToMrr(amount, plan)` for active paid non-trial rows (`activePaidSubscriptionWhere`).
2. **Reconstruct day D:** Include subscriptions where commercial access covers D (`startedAt`/`paymentDate` ≤ D < `expiresAt` or equivalent best-effort), `isTrial=false`, status not inactive. Split CORE vs MRA_EIS via plan category/code.
3. **Confidence:** If required fields missing (`startedAt` null, conflicting status) → mark day `LOW_CONFIDENCE` and exclude from bridge components (UNAVAILABLE), still allow point-in-time current MRR from live query.
4. **Persist:** Write `AnalyticsDailySnapshot` / monthly with keys:
   - `mrr_estimated_total_<CCY>`
   - `mrr_estimated_core_<CCY>`
   - `mrr_estimated_mra_eis_<CCY>`
5. **Forward:** On subscription lifecycle consume, refresh today’s snapshot.
6. **Bridge (period):**  
   - Opening = snapshot at period start  
   - Closing = snapshot at period end  
   - Movements classified by subscription id transitions between open and close:
     - New: present at close, absent at open  
     - Churned: present at open, absent at close  
     - Expansion / contraction: same id, MRR delta ±  
     - Reactivation: absent at open, present at close, with prior churn evidence when available  
   - If opening or closing snapshot missing → **entire bridge UNAVAILABLE** (do not invent components).

## Labels

Always: **Estimated contracted MRR** — not GAAP recognised revenue.
