### Task 1: Eligibility + SoD defaults (backend alignment)

**Files:**
- Modify: `lib/bankReconciliation/domain/enums.js`
- Modify: `lib/bankReconciliation/application/configService.js`
- Create: `lib/bankReconciliation/domain/guidedLabels.js`
- Create: `test/bankReconciliation.guidedEligibility.test.js`
- Modify: `test/bankReconciliation.completion.test.js` (only if assertions drift)

**Interfaces:**
- Produces: `RECONCILABLE_PAYMENT_TYPES = ['Bank', 'Mobile Money']`
- Produces: `isGuidedReconcilableAccountType(type: string): boolean`
- Produces: `guidedStatementStatusLabel(matchingStatus: string): string`
- Produces: config default `requireSeparateApprover: false`

- [ ] **Step 1: Write failing tests**

Create `test/bankReconciliation.guidedEligibility.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { RECONCILABLE_PAYMENT_TYPES } from '../lib/bankReconciliation/domain/enums.js';
import {
  isGuidedReconcilableAccountType,
  guidedStatementStatusLabel,
} from '../lib/bankReconciliation/domain/guidedLabels.js';
import { assertReconcilablePaymentAccount } from '../lib/bankReconciliation/application/configService.js';
import { AccountingValidationError } from '../lib/accountingV2/domain/errors.js';

describe('guided recon eligibility', () => {
  it('allows only Bank and Mobile Money', () => {
    expect([...RECONCILABLE_PAYMENT_TYPES]).toEqual(['Bank', 'Mobile Money']);
    expect(isGuidedReconcilableAccountType('Bank')).toBe(true);
    expect(isGuidedReconcilableAccountType('Mobile Money')).toBe(true);
    expect(isGuidedReconcilableAccountType('Cash')).toBe(false);
  });

  it('rejects Cash on assert', () => {
    expect(() =>
      assertReconcilablePaymentAccount({
        isActive: true,
        accountType: 'Cash',
        tenantId: 't1',
        coaAccountId: 'a1',
        coaAccount: { tenantId: 't1', postingAllowed: true, acceptsNewTransactions: true },
      })
    ).toThrow(AccountingValidationError);
  });

  it('maps statement statuses to guide labels', () => {
    expect(guidedStatementStatusLabel('MATCHED')).toBe('Matched');
    expect(guidedStatementStatusLabel('UNMATCHED')).toBe('Unmatched bank');
    expect(guidedStatementStatusLabel('PARTIAL')).toBe('Unmatched bank');
  });
});
```

- [ ] **Step 2: Run tests â€” expect fail**

Run: `npx vitest run test/bankReconciliation.guidedEligibility.test.js`

Expected: FAIL (missing `guidedLabels.js` and/or Cash still in enums)

- [ ] **Step 3: Implement**

In `enums.js`:

```js
export const RECONCILABLE_PAYMENT_TYPES = Object.freeze(['Bank', 'Mobile Money']);
```

Create `lib/bankReconciliation/domain/guidedLabels.js`:

```js
import { RECONCILABLE_PAYMENT_TYPES, StatementMatchingStatus } from './enums.js';

export function isGuidedReconcilableAccountType(accountType) {
  return RECONCILABLE_PAYMENT_TYPES.includes(accountType);
}

/** Guide Â§5 statuses for statement rows */
export function guidedStatementStatusLabel(matchingStatus) {
  if (matchingStatus === StatementMatchingStatus.MATCHED) return 'Matched';
  if (matchingStatus === StatementMatchingStatus.CLASSIFIED) return 'Matched';
  return 'Unmatched bank';
}

export function guidedOutstandingLabel() {
  return 'Outstanding';
}
```

In `configService.js` `upsertConfiguration`:

```js
requireSeparateApprover: input.requireSeparateApprover ?? false,
```

Keep assert message accurate: `Only Bank and Mobile Money accounts are reconcilable`.

- [ ] **Step 4: Run tests â€” expect pass**

Run: `npx vitest run test/bankReconciliation.guidedEligibility.test.js test/bankReconciliation.completion.test.js`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/bankReconciliation/domain/enums.js lib/bankReconciliation/domain/guidedLabels.js lib/bankReconciliation/application/configService.js test/bankReconciliation.guidedEligibility.test.js
git commit -m "fix(bank-rec): tighten Bank/Mobile Money eligibility and SoD default"
```

---
