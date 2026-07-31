/**
 * CRM foundations — import / reporting / Email / WhatsApp / Opportunity pipeline contracts.
 * Wave 4 upgrades Opportunity import/reporting/pipeline to READY where honestly delivered.
 * Never invent import success or channel volume.
 */

import {
  CRM_FOUNDATION_KIND,
  CRM_FOUNDATION_STATUS,
  CRM_WAVE4_DEFINITION_VERSION,
} from './catalogue.js';
import { resolveCrmAccess } from './authz.js';
import {
  WEIGHTED_PIPELINE_UI_ENABLED,
  resolveWeightedPipelineUiAccess,
} from './opportunities/commercial.js';

const FOUNDATION_CONTRACTS = Object.freeze({
  [CRM_FOUNDATION_KIND.IMPORT]: {
    status: CRM_FOUNDATION_STATUS.READY,
    contract:
      'Phase 12 Wave 4: Opportunity bulk import preview + confirm with idempotent keys, currency/basis gates, and no fake success rates. Lead bulk import tooling remains foundation-thin.',
    deferredTo: null,
    opportunityImportReady: true,
    inventImportMetricsForbidden: true,
  },
  [CRM_FOUNDATION_KIND.REPORTING]: {
    status: CRM_FOUNDATION_STATUS.READY,
    contract:
      'Phase 12 Wave 4 Pipeline reporting + Phase 13 Wave 4 Activity reporting centre + Phase 14 Wave 4 Demo reporting centre + Phase 15 Wave 4 Commercial reporting centre (honesty-gated; EMPTY/UNAVAILABLE — never false zeroes) + audited schedules. Currency-separated Pipeline + Commercial totals. Weighted Pipeline reports remain dark until Phase 16. Lead export JSON/CSV still available.',
    deferredTo: null,
    pipelineReportingReady: true,
    activityReportingReady: true,
    demoReportingReady: true,
    commercialReportingReady: true,
    inventReportZeroesForbidden: true,
    weightedUiEnabled: false,
  },
  [CRM_FOUNDATION_KIND.EMAIL_INGEST]: {
    status: CRM_FOUNDATION_STATUS.NOT_AVAILABLE,
    contract:
      'Email → Lead ingest remains NOT_AVAILABLE. Never invent inbound email Lead volume.',
    deferredTo: 'Later',
  },
  [CRM_FOUNDATION_KIND.WHATSAPP_INGEST]: {
    status: CRM_FOUNDATION_STATUS.NOT_AVAILABLE,
    contract:
      'WhatsApp → Lead ingest remains NOT_AVAILABLE. wa.me CTA is not capture volume.',
    deferredTo: 'Later',
  },
  [CRM_FOUNDATION_KIND.OPPORTUNITY_PIPELINE]: {
    status: CRM_FOUNDATION_STATUS.READY,
    contract:
      'Phase 12 Waves 1–4: ACTIVE NEW_BUSINESS / EXPANSION / MRA_EIS Pipelines, governed stages, Opportunity create from READY handoff + audited import, board/close/readiness, duplicates/merge SoD, import + currency-separated reports. Weighted UI remains dark until Phase 16. Closed Won ≠ provision.',
    deferredTo: null,
    opportunityId: null,
    inventOpportunityForbidden: true,
    inventRevenueForbidden: true,
    inventProposalForbidden: true,
    inventConversionForbidden: true,
    weightedUiEnabled: false,
  },
  [CRM_FOUNDATION_KIND.ACTIVITY_SPINE]: {
    status: CRM_FOUNDATION_STATUS.READY,
    contract:
      'Phase 13 Waves 1–4: CrmActivity parent (ACT-YYYY-######) + Task/Follow-Up + Calls + Email SMTP + Meetings + internal Calendar/ICS + Reminders (dedupe; delivery ≠ complete) + versioned Activity/Task templates + automation foundations (SoD; small approved triggers; idempotent; no sequences) + Activity reporting/schedules/DQ/recon. RSVP ≠ attendance; SMTP accept ≠ delivered; reminder ≠ Sales contact. Telephony NOT_AVAILABLE; recording NOT_AVAILABLE; Google/Outlook NOT_CONNECTED. Demo/Proposal/Tenant provision deferred. Never fabricate engagement or alias CsTask/Support threads/SupportSlaCalendar.',
    deferredTo: null,
    inventActivityVolumeForbidden: true,
    telephony: 'NOT_AVAILABLE',
    recording: 'NOT_AVAILABLE',
    emailSmtp: 'FOUNDATION',
    inventEmailDeliveredForbidden: true,
    inventCallConnectedForbidden: true,
    inventAttendanceFromRsvpForbidden: true,
    externalCalendar: 'NOT_CONNECTED',
    icsExport: true,
    remindersReady: true,
    automationFoundations: true,
    activityReportingReady: true,
    sequencesForbidden: true,
  },
  [CRM_FOUNDATION_KIND.DEMO_SPINE]: {
    status: CRM_FOUNDATION_STATUS.READY,
    contract:
      'Phase 14 Waves 1–4: CrmDemoRequest (DMR) + CrmDemo (DEMO) + qualify/convert idempotent + schedule via required CrmMeeting+Calendar + participants + readiness + Agenda/Script/Scenario/Content + Logical DENV + data packs + checklist/rehearsal + delivery session (Meeting COMPLETED ≠ DELIVERED) + source-backed attendance (RSVP ≠ attendance) + recording governance only (provider NOT_AVAILABLE; no media files) + feedback/outcome (completeness ≠ success; never auto-mutates Opportunity) + Follow-Ups via Phase 13 + Proposal/Trial handoff payloads only + honesty-gated Demo reports/schedules. Never alias MRA EIS sandbox; cloud infra NOT_AVAILABLE; invent zeroes forbidden.',
    deferredTo: null,
    inventAttendanceFromRsvpForbidden: true,
    inventProposalForbidden: true,
    inventTrialForbidden: true,
    inventTenantProvisionForbidden: true,
    inventEnvironmentReadyForbidden: true,
    autoOpportunityStageMutationForbidden: true,
    autoOpportunityProbabilityMutationForbidden: true,
    mraEisSandboxEqualsDemoEnvironment: false,
    demoEqualsMeeting: false,
    meetingCompletedEqualsDemoDelivered: false,
    recording: 'NOT_AVAILABLE',
    inventRecordingFileForbidden: true,
    cloudDemoInfra: 'NOT_AVAILABLE',
    activeDirectlyEditable: false,
    restrictedScriptOnCustomerForbidden: true,
    sodApproveRequired: true,
    productionDataPackForbidden: true,
    demoBannerRequired: true,
    expiryRequired: true,
    completenessEqualsSuccessForbidden: true,
    inventReportZeroesForbidden: true,
    handoffPayloadOnly: true,
    demoReportingReady: true,
  },
  [CRM_FOUNDATION_KIND.COMMERCIAL_SPINE]: {
    status: CRM_FOUNDATION_STATUS.READY,
    contract:
      'Phase 15 Waves 1–4: Proposal Request + CrmCommercialDocument spine + Price Books/pricing/tax/FX/discounts/approvals + templates/PDF/checksum/issue/delivery/review/acceptance + commercial hubs + honesty-gated reports/DQ/recon + Closed-Won readiness + Phase 16 conversion handoff payloads only. Tenant Quotation = WRONG_DOMAIN. Acceptance ≠ Closed Won. Never auto-mutate Opportunity stage/probability/close date. E-sign NOT_CONFIGURED. Invent zeroes forbidden. Currency-separated overview.',
    deferredTo: null,
    inventProposalForbidden: true,
    inventTenantProvisionForbidden: true,
    inventConversionForbidden: true,
    inventReportZeroesForbidden: true,
    acceptanceDoesNotCloseWon: true,
    autoOpportunityStageMutationForbidden: true,
    autoOpportunityProbabilityMutationForbidden: true,
    handoffPayloadOnly: true,
    eSign: 'NOT_CONFIGURED',
    commercialReportingReady: true,
    currencySeparated: true,
  },
});

/**
 * @param {import('@prisma/client').PrismaClient} _prisma
 * @param {{ admin: object, kind?: string }} args
 */
export async function getCrmFoundations(_prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, reason: 'crm_view_forbidden' };
  }

  const kindFilter = args.kind
    ? String(args.kind).trim().toUpperCase().replace(/-/g, '_')
    : null;

  const kinds = Object.values(CRM_FOUNDATION_KIND);
  const selected = kindFilter
    ? kinds.filter(
        (k) =>
          k === kindFilter ||
          k.replace(/_/g, '') === kindFilter.replace(/_/g, '')
      )
    : kinds;

  if (kindFilter && selected.length === 0) {
    return {
      ok: false,
      error: `kind must be one of ${kinds.join('|')}`,
    };
  }

  const items = selected.map((kind) => {
    const c = FOUNDATION_CONTRACTS[kind];
    return {
      kind,
      status: c.status,
      contract: c.contract,
      deferredTo: c.deferredTo,
      opportunityId: c.opportunityId === undefined ? undefined : null,
      inventOpportunityForbidden: Boolean(c.inventOpportunityForbidden),
      inventImportMetricsForbidden: Boolean(c.inventImportMetricsForbidden),
      inventReportZeroesForbidden: Boolean(c.inventReportZeroesForbidden),
      weightedUiEnabled:
        c.weightedUiEnabled === undefined
          ? undefined
          : resolveWeightedPipelineUiAccess({}).unlocked,
      items: [],
    };
  });

  return {
    ok: true,
    definitionVersion: CRM_WAVE4_DEFINITION_VERSION,
    status: CRM_FOUNDATION_STATUS.READY,
    items,
    meta: {
      inventImportMetricsForbidden: true,
      inventReportZeroesForbidden: true,
      emailChannel: 'NOT_AVAILABLE',
      whatsappChannel: 'NOT_AVAILABLE',
      opportunityCreate: 'READY',
      opportunityImport: 'READY',
      pipelineReporting: 'READY',
      activityReporting: 'READY',
      activitySpine: 'READY',
      telephony: 'NOT_AVAILABLE',
      googleOutlook: 'NOT_CONNECTED',
      weightedUiEnabled: resolveWeightedPipelineUiAccess({}).unlocked,
      weightedUiCapability: WEIGHTED_PIPELINE_UI_ENABLED === true,
      pipelines: ['NEW_BUSINESS', 'EXPANSION', 'MRA_EIS'],
    },
  };
}

export { FOUNDATION_CONTRACTS };
