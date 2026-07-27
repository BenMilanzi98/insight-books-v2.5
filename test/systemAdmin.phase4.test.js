import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  calculateCommission,
  commissionIdempotencyKey,
  payoutIdempotencyKey,
  maskPaymentDetails,
  commissionReversalKey,
} from '@/lib/admin/affiliateIntegrity';
import {
  assertNoSigningSecrets,
  assertValidChecksum,
  assertReleaseChannel,
  sha256Hex,
} from '@/lib/admin/androidRelease';
import { shouldResendOnly, maskSecret } from '@/lib/admin/emailSafety';
import { ADMIN_NAV_SECTIONS } from '@/lib/admin/adminNav';

const root = process.cwd();

describe('Phase 4 — affiliate commissions/payouts', () => {
  it('calculates commission and builds stable keys', () => {
    const calc = calculateCommission({ paymentAmount: 100000, commissionRatePercent: 20 });
    expect(calc.ok).toBe(true);
    expect(calc.commission).toBe(20000);
    expect(commissionIdempotencyKey('t1', 'pay1')).toBe('aff-comm:t1:pay1');
    expect(payoutIdempotencyKey('a1', '2026-07')).toBe('aff-payout:a1:2026-07');
    expect(commissionReversalKey('aff-comm:t1:pay1')).toBe('aff-comm-rev:aff-comm:t1:pay1');
  });

  it('masks payment details', () => {
    expect(maskPaymentDetails(null)).toBeNull();
    expect(maskPaymentDetails('1234567890')).toMatch(/7890$/);
    expect(maskPaymentDetails('1234567890')).not.toContain('123456');
  });

  it('affiliate list API masks bank details', () => {
    const src = readFileSync(join(root, 'app/api/admin/affiliate/route.js'), 'utf8');
    expect(src).toMatch(/bankDetailsMasked|maskPaymentDetails/);
    expect(src).not.toMatch(/bankDetails:\s*affiliate\.paymentDetails/);
  });
});

describe('Phase 4 — Android release safety', () => {
  it('rejects signing secrets and validates checksum/channel', () => {
    expect(assertNoSigningSecrets({ keystorePassword: 'x' }).ok).toBe(false);
    expect(assertNoSigningSecrets({ latestVersionCode: 2 }).ok).toBe(true);
    expect(assertValidChecksum('ab'.repeat(32)).ok).toBe(true);
    expect(assertValidChecksum('short').ok).toBe(false);
    expect(assertReleaseChannel('stable').channel).toBe('STABLE');
    expect(sha256Hex(Buffer.from('apk'))).toHaveLength(64);
  });

  it('mobile-app route uses checksum fields and secret deny', () => {
    const src = readFileSync(join(root, 'app/api/admin/mobile-app/route.js'), 'utf8');
    expect(src).toMatch(/apkChecksum/);
    expect(src).toMatch(/assertNoSigningSecrets/);
  });
});

describe('Phase 4 — email templates / retry / suppression', () => {
  it('retry requires existing communication id', () => {
    expect(shouldResendOnly('')).toBe(false);
    expect(shouldResendOnly('clog_123')).toBe(true);
    expect(maskSecret('secret')).toBe('••••••••');
  });

  it('email APIs and pages exist', () => {
    expect(existsSync(join(root, 'app/api/admin/email/templates/route.js'))).toBe(true);
    expect(existsSync(join(root, 'app/api/admin/email/retry/route.js'))).toBe(true);
    expect(existsSync(join(root, 'app/api/admin/email/suppression/route.js'))).toBe(true);
    expect(existsSync(join(root, 'app/insightbooks/email-management/templates/page.js'))).toBe(
      true
    );
    expect(
      existsSync(join(root, 'app/insightbooks/email-management/suppression/page.js'))
    ).toBe(true);
  });

  it('retry route does not create business duplicates from payload', () => {
    const src = readFileSync(join(root, 'app/api/admin/email/retry/route.js'), 'utf8');
    expect(src).toMatch(/shouldResendOnly/);
    expect(src).toMatch(/No business record was duplicated|no duplicate business/i);
  });

  it('nav includes email template and suppression links', () => {
    const mail = ADMIN_NAV_SECTIONS.find((s) => s.id === 'communication');
    const subs = mail.items[0].subItems.map((s) => s.href);
    expect(subs).toContain('/insightbooks/email-management/templates');
    expect(subs).toContain('/insightbooks/email-management/suppression');
  });

  it('nav includes affiliate commissions and payouts', () => {
    const apps = ADMIN_NAV_SECTIONS.find((s) => s.id === 'apps');
    const aff = apps.items.find((i) => i.href === '/insightbooks/affiliate');
    const subs = aff.subItems.map((s) => s.href);
    expect(subs).toContain('/insightbooks/affiliate/commissions');
    expect(subs).toContain('/insightbooks/affiliate/payouts');
    expect(existsSync(join(root, 'app/insightbooks/affiliate/commissions/page.js'))).toBe(true);
    expect(existsSync(join(root, 'app/insightbooks/affiliate/payouts/page.js'))).toBe(true);
  });
});
