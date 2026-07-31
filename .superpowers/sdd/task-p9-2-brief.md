### Task 2: Wave 2 — First-value / activation / adoption (instrumented only)

**Files:** `lib/admin/productAnalytics/{firstValue,repeatValue,activation,adoption,facts}.js` + APIs under `/api/admin/intelligence/product-analytics/**` (evaluate/first-value/adoption as needed) + tests `test/systemAdmin.productAnalytics.adoption.test.js`

**Reuse Task 1:**
- Catalogue + reliability gate
- Producers already enqueue AnalyticsOutbox for invoices.post, sales.pos.complete, eis.fiscal.accept
- May need fact consumer for these event codes in `lib/admin/analytics/consumers.js` if facts are required

**Interfaces (deliver):**
- `recordOrLoadFirstValue(prisma, { tenantId, featureCode, sourceEvent })` — unique per tenant+feature+ruleVersion
- `evaluateRepeatValue(prisma, { tenantId, featureCode, rule })`
- `evaluateActivation(prisma, { tenantId, featureCode|moduleCode, level })`
- `evaluateAdoptionState(prisma, { tenantId, featureCode }) → state enum from ADOPTION_MATRIX`
- Uninstrumented features → NOT_INSTRUMENTED / UNKNOWN — never fake CONSISTENTLY_ACTIVE

**Rules:**
- First value from AnalyticsEvent/facts only (strict events)
- Retries/reprints excluded (already at producer)
- Page views/login never advance past discovery
- Historical states preserved (append history; don't silent overwrite)
- Definition/rule version strings required

- [ ] Tests: first value unique; uninstrumented NOT_INSTRUMENTED; adoption doesn't treat entitlement as value; repeat value needs distinct source
- [ ] Vitest PASS
- [ ] **Do not git commit --trailer "Co-authored-by: Cursor <cursoragent@cursor.com>"**

## Global Constraints
Same as Task 1 + Phase 9 design hard rules.
