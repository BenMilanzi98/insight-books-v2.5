### Task 8: Smoke verification (manual / scripted)

**Files:** none required (optional `.cursor` script deleted after)

- [ ] **Step 1:** Create Pending inventory invoice on local tenant → confirm Product Sales GL movement for that journal is 0; Deferred 2150 credited; Invoice-COGS posted
- [ ] **Step 2:** Partial payment → Product Sales increases by pro-rata net; AR decreases; Deferred decreases
- [ ] **Step 3:** Pay remainder → deferred for invoice ~0; cumulative sales net = invoice net
- [ ] **Step 4:** Dashboard revenue for today moves with payments, not unpaid invoice total
- [ ] **Step 5:** Pay a legacy invoice (if any with 4100 on issue) → no second revenue recognition

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| Issue: Dr AR / Cr Deferred / Cr VAT | 3 |
| Issue: instant COGS | 5 (existing ensure) |
| Payment: Cash/AR | existing + 6 |
| Payment: Deferred → Sales pro-rata | 2, 4, 6 |
| Last payment remaining net | 2, 6 |
| Purpose DEFERRED_REVENUE 2150 | 1 |
| Skip legacy accrual invoices | 6 |
| No historical rewrite | Global + 6 |
| Reverse Invoice-Revenue | 7 |
| Draft no GL until finalize/force | 5 |
| Dashboard follows Sales Revenue | emergent from 3–6 |

## Placeholder / consistency self-review

- Source type locked: **`Invoice-Revenue`**, event **`INVOICE_REVENUE_RECOGNIZED`**
- Purpose locked: **`DEFERRED_REVENUE`**, code **`2150`**
- No TBD left in tasks
