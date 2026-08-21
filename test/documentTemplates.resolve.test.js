import { describe, expect, it, vi } from 'vitest';
import { resolveDocumentTemplate } from '../lib/documentTemplates/resolveDocumentTemplate.js';

function mockDb({ byId, defaults, any }) {
  return {
    invoiceTemplate: {
      findFirst: vi.fn(async ({ where }) => {
        if (where?.id) return byId?.[where.id] || null;
        if (where?.isDefault) return defaults?.[0] || null;
        return any?.[0] || null;
      }),
    },
  };
}

describe('resolveDocumentTemplate', () => {
  it('uses explicit templateId when it belongs to tenant', async () => {
    const template = {
      id: 't1',
      tenantId: 'ten1',
      content: JSON.stringify({ layoutId: 'ledger', primaryColor: '#111111' }),
    };
    const db = mockDb({ byId: { t1: template } });
    const resolved = await resolveDocumentTemplate(db, { tenantId: 'ten1', templateId: 't1' });
    expect(resolved.layoutId).toBe('ledger');
    expect(resolved.primaryColor).toBe('#111111');
    expect(resolved.template.id).toBe('t1');
  });

  it('falls back to tenant default when templateId missing', async () => {
    const def = {
      id: 'd1',
      tenantId: 'ten1',
      isDefault: true,
      content: JSON.stringify({ style: 'professional' }),
    };
    const db = mockDb({ defaults: [def] });
    const resolved = await resolveDocumentTemplate(db, { tenantId: 'ten1', templateId: null });
    expect(resolved.layoutId).toBe('modern');
    expect(resolved.template.id).toBe('d1');
  });

  it('returns classic appearance when no templates exist', async () => {
    const db = mockDb({});
    const resolved = await resolveDocumentTemplate(db, { tenantId: 'ten1' });
    expect(resolved.template).toBeNull();
    expect(resolved.layoutId).toBe('classic');
  });
});
