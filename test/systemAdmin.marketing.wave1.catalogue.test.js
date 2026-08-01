/**
 * Phase 23 Wave 1 — Marketing catalogue + permissions wiring.
 */
import { describe, it, expect } from 'vitest';
import {
  MARKETING_DEFINITION_VERSION,
  MARKETING_CAMPAIGN_NUMBER_RE,
  MARKETING_CAMPAIGN_STATUS,
  MARKETING_CAMPAIGN_TYPE,
  MARKETING_TAXONOMY_STATUS,
  MARKETING_NORMALISATION_RULE_STATUS,
  MARKETING_SEED_CHANNELS,
  MARKETING_SEED_SOURCES,
  MARKETING_SEED_MEDIUMS,
  MARKETING_WAVE1_UNAVAILABLE_METRICS,
  canTransitionCampaignStatus,
  resolveMarketingAccess,
} from '@/lib/admin/marketing';
import { SYSTEM_ADMIN_PERMISSIONS, NAV_PERMISSION_MAP } from '@/lib/admin/permissions';
import { MARKETING_NAV_ITEM } from '@/lib/admin/marketingNav';
import { ADMIN_NAV_SECTIONS } from '@/lib/admin/adminNav';

describe('Marketing Wave 1 — catalogue', () => {
  it('exports definition version and MKT number pattern', () => {
    expect(MARKETING_DEFINITION_VERSION).toBe('phase23-wave1-v1');
    expect(MARKETING_CAMPAIGN_NUMBER_RE.test('MKT-2026-000001')).toBe(true);
    expect(MARKETING_CAMPAIGN_NUMBER_RE.test('LEAD-2026-000001')).toBe(false);
  });

  it('seeds governed channel/source/medium codes', () => {
    const channelCodes = MARKETING_SEED_CHANNELS.map((c) => c.code);
    expect(channelCodes).toEqual(
      expect.arrayContaining([
        'ORGANIC',
        'PAID_SEARCH',
        'PAID_SOCIAL',
        'EMAIL',
        'REFERRAL',
        'PARTNER',
        'DIRECT',
        'OTHER',
      ])
    );

    const sourceCodes = MARKETING_SEED_SOURCES.map((s) => s.code);
    expect(sourceCodes).toEqual(
      expect.arrayContaining([
        'GOOGLE',
        'META',
        'LINKEDIN',
        'NEWSLETTER',
        'WEBSITE',
        'PARTNER_REFERRAL',
        'UNKNOWN',
        'OTHER',
      ])
    );

    const mediumCodes = MARKETING_SEED_MEDIUMS.map((m) => m.code);
    expect(mediumCodes).toEqual(
      expect.arrayContaining([
        'CPC',
        'CPM',
        'ORGANIC',
        'EMAIL',
        'SOCIAL',
        'REFERRAL',
        'NONE',
        'OTHER',
      ])
    );
  });

  it('lists Wave 1 unavailable KPI metrics (never zero placeholders)', () => {
    expect(MARKETING_WAVE1_UNAVAILABLE_METRICS).toEqual(
      expect.arrayContaining([
        'impressions',
        'clicks',
        'sessions',
        'spend',
        'cpl',
        'cac',
        'roas',
        'attributed_leads',
        'attributed_revenue',
      ])
    );
    expect(MARKETING_WAVE1_UNAVAILABLE_METRICS).toHaveLength(9);
  });

  it('defines campaign, taxonomy, and normalisation statuses', () => {
    expect(MARKETING_CAMPAIGN_STATUS.DRAFT).toBe('DRAFT');
    expect(MARKETING_CAMPAIGN_TYPE.LEAD_GENERATION).toBe('LEAD_GENERATION');
    expect(MARKETING_TAXONOMY_STATUS.ACTIVE).toBe('ACTIVE');
    expect(MARKETING_NORMALISATION_RULE_STATUS.DRAFT).toBe('DRAFT');
  });

  it('allows simple campaign status transitions via allowlist', () => {
    expect(canTransitionCampaignStatus('DRAFT', 'ACTIVE')).toBe(true);
    expect(canTransitionCampaignStatus('DRAFT', 'COMPLETED')).toBe(false);
    expect(canTransitionCampaignStatus('ACTIVE', 'PAUSED')).toBe(true);
    expect(canTransitionCampaignStatus('ARCHIVED', 'ACTIVE')).toBe(false);
  });
});

describe('Marketing Wave 1 — permissions and nav', () => {
  it('registers systemAdmin.marketing.* permissions', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.marketing.view).toBe('systemAdmin.marketing.view');
    expect(SYSTEM_ADMIN_PERMISSIONS.marketing.createCampaigns).toBe(
      'systemAdmin.marketing.createCampaigns'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.marketing.viewLeadSourceEvidence).toBe(
      'systemAdmin.marketing.viewLeadSourceEvidence'
    );
  });

  it('maps marketing routes in NAV_PERMISSION_MAP', () => {
    expect(NAV_PERMISSION_MAP['/insightbooks/marketing']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.marketing.view
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/marketing/campaigns']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.marketing.view
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/marketing/lead-sources']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.marketing.viewLeadSourceEvidence
    );
  });

  it('exposes expandable marketing nav after CRM in overview section', () => {
    expect(MARKETING_NAV_ITEM.expandable).toBe(true);
    expect(MARKETING_NAV_ITEM.icon).toBe('Megaphone');
    expect(MARKETING_NAV_ITEM.subItems.map((s) => s.text)).toEqual(
      expect.arrayContaining([
        'Overview',
        'Campaigns',
        'Taxonomy',
        'Normalisation',
        'Lead sources (CRM evidence)',
      ])
    );

    const overviewItems = ADMIN_NAV_SECTIONS.find((s) => s.id === 'overview')?.items || [];
    const crmIdx = overviewItems.findIndex((i) => i.text === 'CRM');
    const mktIdx = overviewItems.findIndex((i) => i.text === 'Marketing');
    expect(crmIdx).toBeGreaterThanOrEqual(0);
    expect(mktIdx).toBe(crmIdx + 1);
  });

  it('resolveMarketingAccess grants viewLeadSourceEvidence via view fallback', () => {
    const viewOnly = resolveMarketingAccess({
      id: 'a1',
      role: 'Platform Support',
      permissions: { systemAdmin: { marketing: { view: true } } },
    });
    expect(viewOnly.canView).toBe(true);
    expect(viewOnly.canViewLeadSourceEvidence).toBe(true);
    expect(viewOnly.canCreateCampaigns).toBe(false);
  });
});
