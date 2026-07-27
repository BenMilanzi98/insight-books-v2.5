import { describe, it, expect } from 'vitest';
import {
  maskSecret,
  shouldResendOnly,
  sanitizeTemplateVariables,
} from '@/lib/admin/emailSafety';

describe('emailSafety', () => {
  it('maskSecret never returns raw secrets', () => {
    expect(maskSecret('smtp-super-secret')).toBe('••••••••');
    expect(maskSecret('x')).toBe('••••••••');
    expect(maskSecret(null)).toBeNull();
    expect(maskSecret(undefined)).toBeNull();
    expect(maskSecret('')).toBeNull();
    expect(maskSecret('   ')).toBeNull();
  });

  it('shouldResendOnly requires a non-empty communication id', () => {
    expect(shouldResendOnly('comm_123')).toBe(true);
    expect(shouldResendOnly('  id  ')).toBe(true);
    expect(shouldResendOnly('')).toBe(false);
    expect(shouldResendOnly('   ')).toBe(false);
    expect(shouldResendOnly(null)).toBe(false);
    expect(shouldResendOnly(12)).toBe(false);
  });

  it('sanitizeTemplateVariables strips HTML from untrusted strings', () => {
    const clean = sanitizeTemplateVariables({
      name: '<script>alert(1)</script>Ada',
      note: 'Hello <b>world</b>',
      nested: { title: '<img src=x onerror=1>' },
      list: ['<a href="x">click</a>', 3],
      count: 2,
    });
    expect(clean.name).toBe('alert(1)Ada');
    expect(clean.note).toBe('Hello world');
    expect(clean.nested.title).toBe('');
    expect(clean.list[0]).toBe('click');
    expect(clean.list[1]).toBe(3);
    expect(clean.count).toBe(2);
  });

  it('sanitizeTemplateVariables returns {} for non-objects', () => {
    expect(sanitizeTemplateVariables(null)).toEqual({});
    expect(sanitizeTemplateVariables('x')).toEqual({});
    expect(sanitizeTemplateVariables([])).toEqual({});
  });
});
