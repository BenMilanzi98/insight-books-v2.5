import { describe, expect, it } from 'vitest';
import {
  createMoney,
  createQuantity,
  createChecksum,
  createMraTin,
  assertTenantBusinessMatch,
  createIdempotencyKey,
} from '../lib/mraEis/index.js';

describe('Phase 5 value objects', () => {
  it('normalizes money to 2dp', () => {
    expect(createMoney(10.456).value).toBe('10.46');
  });

  it('rejects negative quantity', () => {
    expect(() => createQuantity(-1)).toThrow();
  });

  it('produces stable checksums', () => {
    const a = createChecksum({ a: 1, b: 2 });
    const b = createChecksum({ a: 1, b: 2 });
    expect(a.value).toBe(b.value);
  });

  it('validates tin format', () => {
    expect(createMraTin('TEST-TIN-001').value).toBe('TEST-TIN-001');
    expect(() => createMraTin('x')).toThrow();
  });

  it('enforces tenant=business match in Phase 5 hierarchy', () => {
    expect(() => assertTenantBusinessMatch('t1', 't1')).not.toThrow();
    expect(() => assertTenantBusinessMatch('t1', 't2')).toThrow(/Business context|mismatch/i);
  });

  it('builds idempotency keys', () => {
    expect(createIdempotencyKey(['a', 'b']).value).toBe('a:b');
  });
});
