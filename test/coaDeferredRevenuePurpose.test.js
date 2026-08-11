// test/coaDeferredRevenuePurpose.test.js
import { describe, it, expect } from 'vitest';
import { SYSTEM_ACCOUNT_PURPOSES } from '../lib/coaV2/domain/systemPurposes.js';
import { CODE_DEFERRED_REVENUE } from '../lib/coaPostingCodes.js';
import { LEGACY_MAPPING_CODES } from '../lib/accountingV2/infrastructure/legacy/legacyAccountMappingAdapter.js';
import { LEGACY_KEY_BY_PURPOSE } from '../lib/coaV2/application/accountMappingRegistry.js';

describe('DEFERRED_REVENUE purpose', () => {
  it('is registered as a credit liability with legacy code 2150', () => {
    expect(CODE_DEFERRED_REVENUE).toBe('2150');
    const p = SYSTEM_ACCOUNT_PURPOSES.DEFERRED_REVENUE;
    expect(p).toBeTruthy();
    expect(p.legacyCode).toBe('2150');
    expect(p.normalBalance).toBe('CREDIT');
  });

  it('is wired into the legacy resolution path (same as VAT_OUTPUT)', () => {
    expect(LEGACY_MAPPING_CODES.DEFERRED_REVENUE).toBe('2150');
    expect(LEGACY_KEY_BY_PURPOSE.DEFERRED_REVENUE).toBe('DEFERRED_REVENUE');
  });
});
