import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SYSTEM_ACCOUNT_PURPOSES } from '../lib/coaV2/domain/systemPurposes.js';

const damageRoute = readFileSync(
  new URL('../app/api/rentals/charges/damage/route.js', import.meta.url),
  'utf8'
);
const repairRoute = readFileSync(
  new URL('../app/api/rentals/charges/repair/route.js', import.meta.url),
  'utf8'
);

describe('rental charge CoA mappings', () => {
  it('registers an expense purpose for repairs and maintenance', () => {
    expect(SYSTEM_ACCOUNT_PURPOSES.REPAIRS_AND_MAINTENANCE).toMatchObject({
      categories: ['EXPENSE'],
      normalBalance: 'DEBIT',
      legacyCode: '5380',
    });
  });

  it('returns actionable CoA-mapping guidance for an unmapped damage account', () => {
    expect(damageRoute).toContain('MissingAccountMappingError');
    expect(damageRoute).toContain(
      'Configure OTHER_INCOME for RENTALS/DAMAGE in CoA mappings before recording a damage charge.'
    );
  });

  it('resolves repair through its purpose before a repair-name fallback', () => {
    expect(repairRoute).toContain("'REPAIRS_AND_MAINTENANCE'");
    expect(repairRoute).toContain("startsWith: 'Repair'");
    expect(repairRoute).not.toContain("accountCode: '5380'");
  });
});
