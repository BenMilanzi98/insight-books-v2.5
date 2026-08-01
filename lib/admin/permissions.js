/**
 * Granular systemAdmin.* permission catalog for the platform control plane.
 * Stored on Admin.permissions as nested objects; Super Admin is break-glass via decision service.
 */

import { authorizeAdminDecision } from './authorization/authorizeAdminDecision.js';

export const SYSTEM_ADMIN_PERMISSIONS = {
  dashboard: {
    view: 'systemAdmin.dashboard.view',
    financialMetrics: 'systemAdmin.dashboard.financialMetrics',
    securityMetrics: 'systemAdmin.dashboard.securityMetrics',
    operationalMetrics: 'systemAdmin.dashboard.operationalMetrics',
  },
  tenants: {
    view: 'systemAdmin.tenants.view',
    create: 'systemAdmin.tenants.create',
    edit: 'systemAdmin.tenants.edit',
    activate: 'systemAdmin.tenants.activate',
    suspend: 'systemAdmin.tenants.suspend',
    reactivate: 'systemAdmin.tenants.reactivate',
    archive: 'systemAdmin.tenants.archive',
    export: 'systemAdmin.tenants.export',
    supportAccess: 'systemAdmin.tenants.supportAccess',
  },
  users: {
    view: 'systemAdmin.users.view',
    create: 'systemAdmin.users.create',
    edit: 'systemAdmin.users.edit',
    assignTenant: 'systemAdmin.users.assignTenant',
    assignRole: 'systemAdmin.users.assignRole',
    resetPassword: 'systemAdmin.users.resetPassword',
    revokeSessions: 'systemAdmin.users.revokeSessions',
    lock: 'systemAdmin.users.lock',
    unlock: 'systemAdmin.users.unlock',
    suspend: 'systemAdmin.users.suspend',
    archive: 'systemAdmin.users.archive',
    export: 'systemAdmin.users.export',
  },
  settings: {
    view: 'systemAdmin.settings.view',
    manage: 'systemAdmin.settings.manage',
    security: 'systemAdmin.settings.security',
    billing: 'systemAdmin.settings.billing',
    email: 'systemAdmin.settings.email',
    features: 'systemAdmin.settings.features',
    integrations: 'systemAdmin.settings.integrations',
  },
  android: {
    view: 'systemAdmin.android.view',
    createRelease: 'systemAdmin.android.createRelease',
    publishRelease: 'systemAdmin.android.publishRelease',
    revokeRelease: 'systemAdmin.android.revokeRelease',
  },
  affiliates: {
    view: 'systemAdmin.affiliates.view',
    create: 'systemAdmin.affiliates.create',
    approve: 'systemAdmin.affiliates.approve',
    manageCommissions: 'systemAdmin.affiliates.manageCommissions',
    approvePayouts: 'systemAdmin.affiliates.approvePayouts',
    export: 'systemAdmin.affiliates.export',
  },
  billing: {
    view: 'systemAdmin.billing.view',
    plansManage: 'systemAdmin.billing.plans.manage',
    subscriptionsManage: 'systemAdmin.billing.subscriptions.manage',
    invoicesCreate: 'systemAdmin.billing.invoices.create',
    invoicesApprove: 'systemAdmin.billing.invoices.approve',
    paymentsView: 'systemAdmin.billing.payments.view',
    paymentsManage: 'systemAdmin.billing.payments.manage',
    creditsManage: 'systemAdmin.billing.credits.manage',
    refundsManage: 'systemAdmin.billing.refunds.manage',
    reconciliation: 'systemAdmin.billing.reconciliation',
    reportsExport: 'systemAdmin.billing.reports.export',
  },
  mraPlans: {
    view: 'systemAdmin.mraPlans.view',
    create: 'systemAdmin.mraPlans.create',
    editDraft: 'systemAdmin.mraPlans.editDraft',
    approve: 'systemAdmin.mraPlans.approve',
    publish: 'systemAdmin.mraPlans.publish',
    suspend: 'systemAdmin.mraPlans.suspend',
    retire: 'systemAdmin.mraPlans.retire',
    version: 'systemAdmin.mraPlans.version',
    preview: 'systemAdmin.mraPlans.preview',
    export: 'systemAdmin.mraPlans.export',
  },
  email: {
    view: 'systemAdmin.email.view',
    configurationManage: 'systemAdmin.email.configuration.manage',
    templatesManage: 'systemAdmin.email.templates.manage',
    logsView: 'systemAdmin.email.logs.view',
    retry: 'systemAdmin.email.retry',
    suppressionManage: 'systemAdmin.email.suppression.manage',
  },
  mraEntitlement: {
    view: 'systemAdmin.mraEntitlement.view',
    grant: 'systemAdmin.mraEntitlement.grant',
    suspend: 'systemAdmin.mraEntitlement.suspend',
    revoke: 'systemAdmin.mraEntitlement.revoke',
    export: 'systemAdmin.mraEntitlement.export',
  },
  audit: {
    view: 'systemAdmin.audit.view',
    export: 'systemAdmin.audit.export',
  },
  security: {
    view: 'systemAdmin.security.view',
    manageSessions: 'systemAdmin.security.manageSessions',
    manageLocks: 'systemAdmin.security.manageLocks',
    reviewImpersonation: 'systemAdmin.security.reviewImpersonation',
    manageAlerts: 'systemAdmin.security.manageAlerts',
  },
  health: {
    view: 'systemAdmin.health.view',
    retryJobs: 'systemAdmin.health.retryJobs',
    cancelJobs: 'systemAdmin.health.cancelJobs',
    manageIncidents: 'systemAdmin.health.manageIncidents',
  },
  /** Intelligence — Phase 5 executive summaries (routes gated; default deny until granted). */
  intel: {
    executiveRead: 'systemAdmin.intel.executive.read',
    revenueRead: 'systemAdmin.intel.revenue.read',
    customersRead: 'systemAdmin.intel.customers.read',
    /** Wave 3 — create portfolios / assign ownership (view still customersRead). */
    managePortfolios: 'systemAdmin.intel.customers.managePortfolios',
    /** Phase 8 Wave 1 — Customer Health */
    customerHealthRead: 'systemAdmin.intel.customerHealth.read',
    customerHealthManageDefinitions: 'systemAdmin.intel.customerHealth.manageDefinitions',
    customerHealthRebuild: 'systemAdmin.intel.customerHealth.rebuild',
    productRead: 'systemAdmin.intel.product.read',
    /** Phase 9 Wave 1 — Product Analytics */
    productAnalyticsRead: 'systemAdmin.intel.productAnalytics.read',
    productAnalyticsManageDefinitions:
      'systemAdmin.intel.productAnalytics.manageDefinitions',
    productAnalyticsExport: 'systemAdmin.intel.productAnalytics.export',
    productAnalyticsRunReconciliation:
      'systemAdmin.intel.productAnalytics.runReconciliation',
    productAnalyticsAcknowledgeSignals:
      'systemAdmin.intel.productAnalytics.acknowledgeSignals',
    productAnalyticsViewUserLevel:
      'systemAdmin.intel.productAnalytics.viewUserLevelData',
  },
  /** Phase 8 Wave 2/3 — Customer Success Ops. */
  customerSuccess: {
    read: 'systemAdmin.customerSuccess.read',
    manageCases: 'systemAdmin.customerSuccess.manageCases',
    manageRenewals: 'systemAdmin.customerSuccess.manageRenewals',
  },
  /**
   * Phase 10 Wave 1 — Support Ops (≠ CsCase ≠ PlatformSupportAccess).
   * Active: viewTickets / createTickets / transitionStatus.
   * Remaining keys stubbed from SUPPORT_SECURITY_MATRIX for later waves.
   */
  support: {
    view: 'systemAdmin.support.viewTickets',
    viewTickets: 'systemAdmin.support.viewTickets',
    createTickets: 'systemAdmin.support.createTickets',
    transitionStatus: 'systemAdmin.support.transitionStatus',
    replyPublicly: 'systemAdmin.support.replyPublicly',
    addInternalNotes: 'systemAdmin.support.addInternalNotes',
    addRestrictedNotes: 'systemAdmin.support.addRestrictedNotes',
    assignTickets: 'systemAdmin.support.assignTickets',
    mergeTickets: 'systemAdmin.support.mergeTickets',
    manageSla: 'systemAdmin.support.manageSla',
    export: 'systemAdmin.support.export',
    scheduleReports: 'systemAdmin.support.scheduleReports',
    runReconciliation: 'systemAdmin.support.runReconciliation',
  },
  /**
   * Phase 23 Wave 1 — Marketing (≠ Affiliate campaign).
   * Lead source SoT remains CRM CrmLead.source / CrmCaptureRecord.
   * Performance KPIs (impressions, spend, CAC, ROAS) are later-wave — not Wave 1.
   */
  marketing: {
    view: 'systemAdmin.marketing.view',
    manageCampaigns: 'systemAdmin.marketing.manageCampaigns',
    createCampaigns: 'systemAdmin.marketing.createCampaigns',
    editCampaigns: 'systemAdmin.marketing.editCampaigns',
    manageTaxonomy: 'systemAdmin.marketing.manageTaxonomy',
    manageNormalisation: 'systemAdmin.marketing.manageNormalisation',
    viewLeadSourceEvidence: 'systemAdmin.marketing.viewLeadSourceEvidence',
    export: 'systemAdmin.marketing.export',
  },
  /**
   * Phase 11 Wave 1–3 — CRM Core (≠ Customer ≠ SupportTicket ≠ CsCase).
   * Active Wave 3+: assignLeads, qualifyLeads, scoreLeads, manageConsent,
   * overrideQualification. Remaining keys stubbed for later waves.
   * Never use POS sales.*.
   */
  crm: {
    view: 'systemAdmin.crm.view',
    viewLeads: 'systemAdmin.crm.viewLeads',
    createLeads: 'systemAdmin.crm.createLeads',
    editLeads: 'systemAdmin.crm.editLeads',
    viewAccounts: 'systemAdmin.crm.viewAccounts',
    createAccounts: 'systemAdmin.crm.createAccounts',
    viewContacts: 'systemAdmin.crm.viewContacts',
    createContacts: 'systemAdmin.crm.createContacts',
    transitionStatus: 'systemAdmin.crm.transitionStatus',
    assignLeads: 'systemAdmin.crm.assignLeads',
    qualifyLeads: 'systemAdmin.crm.qualifyLeads',
    scoreLeads: 'systemAdmin.crm.scoreLeads',
    overrideQualification: 'systemAdmin.crm.overrideQualification',
    manageConsent: 'systemAdmin.crm.manageConsent',
    /** Stub — Wave 4 merge / later */
    mergeLeads: 'systemAdmin.crm.mergeLeads',
    export: 'systemAdmin.crm.export',
    runReconciliation: 'systemAdmin.crm.runReconciliation',
    /** Phase 12 Wave 1 — live Pipeline / Opportunities */
    pipelineView: 'systemAdmin.crm.pipeline.view',
    pipelineManageDefinitions: 'systemAdmin.crm.pipeline.manageDefinitions',
    pipelineTransitionStages: 'systemAdmin.crm.pipeline.transitionStages',
    /** Legacy scaffold alias */
    pipelineManage: 'systemAdmin.crm.pipeline.manage',
    opportunitiesView: 'systemAdmin.crm.opportunities.view',
    opportunitiesCreate: 'systemAdmin.crm.opportunities.create',
    opportunitiesEdit: 'systemAdmin.crm.opportunities.edit',
    /** Phase 13 Wave 1 — Activities / Tasks / Follow-Ups */
    activitiesView: 'systemAdmin.crm.activities.view',
    activitiesEdit: 'systemAdmin.crm.activities.edit',
  },
};

export const ADMIN_ROLES = {
  SUPER_ADMIN: 'Super Admin',
  BILLING_ADMIN: 'Billing Administrator',
  SECURITY_ADMIN: 'Security Administrator',
  COMPLIANCE_ADMIN: 'Compliance Administrator',
  PLATFORM_AUDITOR: 'Platform Auditor',
  PLATFORM_SUPPORT: 'Platform Support',
};

/** Map nav href prefixes to required permission (view). */
export const NAV_PERMISSION_MAP = {
  '/insightbooks/dashboard': SYSTEM_ADMIN_PERMISSIONS.dashboard.view,
  '/insightbooks/tenant-management': SYSTEM_ADMIN_PERMISSIONS.tenants.view,
  '/insightbooks/tenant-identity-transfer': SYSTEM_ADMIN_PERMISSIONS.tenants.view,
  '/insightbooks/user-management': SYSTEM_ADMIN_PERMISSIONS.users.view,
  '/insightbooks/global-settings': SYSTEM_ADMIN_PERMISSIONS.settings.view,
  '/insightbooks/feature-entitlements': SYSTEM_ADMIN_PERMISSIONS.settings.features,
  '/insightbooks/mobile-app': SYSTEM_ADMIN_PERMISSIONS.android.view,
  '/insightbooks/affiliate': SYSTEM_ADMIN_PERMISSIONS.affiliates.view,
  '/insightbooks/affiliate/commissions': SYSTEM_ADMIN_PERMISSIONS.affiliates.view,
  '/insightbooks/affiliate/payouts': SYSTEM_ADMIN_PERMISSIONS.affiliates.view,
  '/insightbooks/billing': SYSTEM_ADMIN_PERMISSIONS.billing.view,
  '/insightbooks/billing/overview': SYSTEM_ADMIN_PERMISSIONS.billing.view,
  '/insightbooks/billing/plans': SYSTEM_ADMIN_PERMISSIONS.billing.view,
  '/insightbooks/billing/mra-eis-plans': SYSTEM_ADMIN_PERMISSIONS.billing.view,
  '/insightbooks/billing/subscriptions': SYSTEM_ADMIN_PERMISSIONS.billing.view,
  '/insightbooks/billing/invoices': SYSTEM_ADMIN_PERMISSIONS.billing.view,
  '/insightbooks/billing/payments': SYSTEM_ADMIN_PERMISSIONS.billing.view,
  '/insightbooks/billing/credits': SYSTEM_ADMIN_PERMISSIONS.billing.view,
  '/insightbooks/billing/reconciliation': SYSTEM_ADMIN_PERMISSIONS.billing.view,
  '/insightbooks/reports': SYSTEM_ADMIN_PERMISSIONS.billing.view,
  '/insightbooks/imports': SYSTEM_ADMIN_PERMISSIONS.tenants.create,
  '/insightbooks/email-management': SYSTEM_ADMIN_PERMISSIONS.email.view,
  '/insightbooks/email-management/templates': SYSTEM_ADMIN_PERMISSIONS.email.view,
  '/insightbooks/email-management/suppression': SYSTEM_ADMIN_PERMISSIONS.email.view,
  '/insightbooks/mra-eis': SYSTEM_ADMIN_PERMISSIONS.mraEntitlement.view,
  '/insightbooks/mra-eis/centre': SYSTEM_ADMIN_PERMISSIONS.mraEntitlement.view,
  '/insightbooks/mra-eis/terminals': SYSTEM_ADMIN_PERMISSIONS.mraEntitlement.view,
  '/insightbooks/mra-eis/configuration': SYSTEM_ADMIN_PERMISSIONS.mraEntitlement.view,
  '/insightbooks/mra-eis/mappings': SYSTEM_ADMIN_PERMISSIONS.mraEntitlement.view,
  '/insightbooks/mra-eis/catalogue': SYSTEM_ADMIN_PERMISSIONS.mraEntitlement.view,
  '/insightbooks/audit': SYSTEM_ADMIN_PERMISSIONS.audit.view,
  '/insightbooks/security': SYSTEM_ADMIN_PERMISSIONS.security.view,
  '/insightbooks/security/monitoring': SYSTEM_ADMIN_PERMISSIONS.security.view,
  '/insightbooks/security/compliance': SYSTEM_ADMIN_PERMISSIONS.security.view,
  '/insightbooks/system-health': SYSTEM_ADMIN_PERMISSIONS.health.view,
  '/insightbooks/analytics-pipeline': SYSTEM_ADMIN_PERMISSIONS.health.view,
  '/insightbooks/intelligence': SYSTEM_ADMIN_PERMISSIONS.intel.executiveRead,
  '/insightbooks/intelligence/executive': SYSTEM_ADMIN_PERMISSIONS.intel.executiveRead,
  '/insightbooks/intelligence/revenue': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/overview': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/recurring': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/mrr': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/arr': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/movements': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/billing': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/collections': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/receivables': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/payment-performance':
    SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/credits-refunds':
    SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/mra-eis': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/customers': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/segments': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/concentration': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/retention': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/cohorts': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/subscriptions': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/plans': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/forecast': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/reconciliation': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/reports': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/definitions': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/revenue/settings': SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  '/insightbooks/intelligence/customers': SYSTEM_ADMIN_PERMISSIONS.intel.customersRead,
  '/insightbooks/intelligence/customers/overview': SYSTEM_ADMIN_PERMISSIONS.intel.customersRead,
  '/insightbooks/intelligence/customers/directory': SYSTEM_ADMIN_PERMISSIONS.intel.customersRead,
  '/insightbooks/intelligence/customers/lifecycle': SYSTEM_ADMIN_PERMISSIONS.intel.customersRead,
  '/insightbooks/intelligence/customers/engagement': SYSTEM_ADMIN_PERMISSIONS.intel.customersRead,
  '/insightbooks/intelligence/customers/commercial': SYSTEM_ADMIN_PERMISSIONS.intel.customersRead,
  '/insightbooks/intelligence/customers/renewals': SYSTEM_ADMIN_PERMISSIONS.intel.customersRead,
  '/insightbooks/intelligence/customers/mra-eis': SYSTEM_ADMIN_PERMISSIONS.intel.customersRead,
  '/insightbooks/intelligence/customers/adoption': SYSTEM_ADMIN_PERMISSIONS.intel.customersRead,
  '/insightbooks/intelligence/customers/support': SYSTEM_ADMIN_PERMISSIONS.intel.customersRead,
  '/insightbooks/intelligence/customers/signals': SYSTEM_ADMIN_PERMISSIONS.intel.customersRead,
  '/insightbooks/intelligence/customers/portfolios': SYSTEM_ADMIN_PERMISSIONS.intel.customersRead,
  '/insightbooks/intelligence/customers/reconciliation':
    SYSTEM_ADMIN_PERMISSIONS.intel.customersRead,
  '/insightbooks/intelligence/customers/reports': SYSTEM_ADMIN_PERMISSIONS.intel.customersRead,
  '/insightbooks/intelligence/customers/definitions': SYSTEM_ADMIN_PERMISSIONS.intel.customersRead,
  '/insightbooks/intelligence/customers/settings': SYSTEM_ADMIN_PERMISSIONS.intel.customersRead,
  '/insightbooks/intelligence/customer-health':
    SYSTEM_ADMIN_PERMISSIONS.intel.customerHealthRead,
  '/insightbooks/intelligence/customer-health/overview':
    SYSTEM_ADMIN_PERMISSIONS.intel.customerHealthRead,
  '/insightbooks/intelligence/customer-health/definitions':
    SYSTEM_ADMIN_PERMISSIONS.intel.customerHealthRead,
  '/insightbooks/intelligence/customer-health/snapshots':
    SYSTEM_ADMIN_PERMISSIONS.intel.customerHealthRead,
  '/insightbooks/intelligence/customer-health/reconciliation':
    SYSTEM_ADMIN_PERMISSIONS.intel.customerHealthRead,
  '/insightbooks/intelligence/customer-health/reports':
    SYSTEM_ADMIN_PERMISSIONS.intel.customerHealthRead,
  '/insightbooks/intelligence/product-analytics':
    SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead,
  '/insightbooks/intelligence/product-analytics/overview':
    SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead,
  '/insightbooks/intelligence/product-analytics/modules':
    SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead,
  '/insightbooks/intelligence/product-analytics/features':
    SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead,
  '/insightbooks/intelligence/product-analytics/adoption':
    SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead,
  '/insightbooks/intelligence/product-analytics/activation':
    SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead,
  '/insightbooks/intelligence/product-analytics/first-value':
    SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead,
  '/insightbooks/intelligence/product-analytics/funnels':
    SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead,
  '/insightbooks/intelligence/product-analytics/cohorts':
    SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead,
  '/insightbooks/intelligence/product-analytics/signals':
    SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead,
  '/insightbooks/intelligence/product-analytics/definitions':
    SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead,
  '/insightbooks/intelligence/product-analytics/reconciliation':
    SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsRead,
  '/insightbooks/intelligence/product-analytics/reports':
    SYSTEM_ADMIN_PERMISSIONS.intel.productAnalyticsExport,
  '/insightbooks/customer-success': SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read,
  '/insightbooks/customer-success/command-centre':
    SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read,
  '/insightbooks/customer-success/cases': SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read,
  '/insightbooks/customer-success/tasks': SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read,
  '/insightbooks/customer-success/interventions':
    SYSTEM_ADMIN_PERMISSIONS.customerSuccess.manageCases,
  '/insightbooks/customer-success/renewals': SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read,
  '/insightbooks/customer-success/playbooks': SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read,
  '/insightbooks/customer-success/success-plans':
    SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read,
  '/insightbooks/customer-success/onboarding': SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read,
  '/insightbooks/customer-success/onboarding/requests':
    SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read,
  '/insightbooks/customer-success/onboarding/projects':
    SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read,
  '/insightbooks/customer-success/training': SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read,
  '/insightbooks/customer-success/surveys': SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read,
  '/insightbooks/customer-success/handoffs': SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read,
  '/insightbooks/customer-success/reports': SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read,
  '/insightbooks/support': SYSTEM_ADMIN_PERMISSIONS.support.viewTickets,
  '/insightbooks/support/tickets': SYSTEM_ADMIN_PERMISSIONS.support.viewTickets,
  '/insightbooks/support/my-work': SYSTEM_ADMIN_PERMISSIONS.support.viewTickets,
  '/insightbooks/support/queues': SYSTEM_ADMIN_PERMISSIONS.support.viewTickets,
  '/insightbooks/support/sla': SYSTEM_ADMIN_PERMISSIONS.support.viewTickets,
  '/insightbooks/support/handoffs': SYSTEM_ADMIN_PERMISSIONS.support.viewTickets,
  '/insightbooks/support/foundations': SYSTEM_ADMIN_PERMISSIONS.support.viewTickets,
  '/insightbooks/support/reports': SYSTEM_ADMIN_PERMISSIONS.support.viewTickets,
  '/insightbooks/crm': SYSTEM_ADMIN_PERMISSIONS.crm.view,
  '/insightbooks/crm/my-work': SYSTEM_ADMIN_PERMISSIONS.crm.viewLeads,
  '/insightbooks/crm/overview': SYSTEM_ADMIN_PERMISSIONS.crm.view,
  '/insightbooks/crm/leads': SYSTEM_ADMIN_PERMISSIONS.crm.viewLeads,
  '/insightbooks/crm/accounts': SYSTEM_ADMIN_PERMISSIONS.crm.viewAccounts,
  '/insightbooks/crm/contacts': SYSTEM_ADMIN_PERMISSIONS.crm.viewContacts,
  '/insightbooks/crm/duplicates': SYSTEM_ADMIN_PERMISSIONS.crm.viewLeads,
  '/insightbooks/crm/imports': SYSTEM_ADMIN_PERMISSIONS.crm.view,
  '/insightbooks/crm/reports': SYSTEM_ADMIN_PERMISSIONS.crm.view,
  '/insightbooks/crm/settings': SYSTEM_ADMIN_PERMISSIONS.crm.view,
  '/insightbooks/crm/foundations': SYSTEM_ADMIN_PERMISSIONS.crm.view,
  '/insightbooks/crm/pipeline': SYSTEM_ADMIN_PERMISSIONS.crm.pipelineView,
  '/insightbooks/crm/pipeline/overview': SYSTEM_ADMIN_PERMISSIONS.crm.pipelineView,
  '/insightbooks/crm/pipeline/board': SYSTEM_ADMIN_PERMISSIONS.crm.pipelineView,
  '/insightbooks/crm/pipeline/list': SYSTEM_ADMIN_PERMISSIONS.crm.pipelineView,
  '/insightbooks/crm/pipeline/my-pipeline': SYSTEM_ADMIN_PERMISSIONS.crm.pipelineView,
  '/insightbooks/crm/opportunities': SYSTEM_ADMIN_PERMISSIONS.crm.opportunitiesView,
  '/insightbooks/crm/opportunities/new': SYSTEM_ADMIN_PERMISSIONS.crm.opportunitiesCreate,
  '/insightbooks/crm/activities': SYSTEM_ADMIN_PERMISSIONS.crm.view,
  '/insightbooks/crm/tasks': SYSTEM_ADMIN_PERMISSIONS.crm.view,
  '/insightbooks/crm/follow-ups': SYSTEM_ADMIN_PERMISSIONS.crm.view,
  '/insightbooks/crm/calls': SYSTEM_ADMIN_PERMISSIONS.crm.view,
  '/insightbooks/crm/emails': SYSTEM_ADMIN_PERMISSIONS.crm.view,
  '/insightbooks/crm/demos': SYSTEM_ADMIN_PERMISSIONS.crm.view,
  '/insightbooks/crm/demos/my-demos': SYSTEM_ADMIN_PERMISSIONS.crm.view,
  '/insightbooks/crm/demos/list': SYSTEM_ADMIN_PERMISSIONS.crm.view,
  '/insightbooks/crm/demos/requests': SYSTEM_ADMIN_PERMISSIONS.crm.view,
  '/insightbooks/marketing': SYSTEM_ADMIN_PERMISSIONS.marketing.view,
  '/insightbooks/marketing/overview': SYSTEM_ADMIN_PERMISSIONS.marketing.view,
  '/insightbooks/marketing/campaigns': SYSTEM_ADMIN_PERMISSIONS.marketing.view,
  '/insightbooks/marketing/taxonomy': SYSTEM_ADMIN_PERMISSIONS.marketing.view,
  '/insightbooks/marketing/normalisation': SYSTEM_ADMIN_PERMISSIONS.marketing.view,
  '/insightbooks/marketing/lead-sources':
    SYSTEM_ADMIN_PERMISSIONS.marketing.viewLeadSourceEvidence,
};

/** Future Intelligence / CRM keys — scaffold only; default deny until later phases. */
export const INTEL_CRM_PERMISSION_SCAFFOLD = {
  intel: {
    executiveRead: 'systemAdmin.intel.executive.read',
    revenueRead: 'systemAdmin.intel.revenue.read',
    customersRead: 'systemAdmin.intel.customers.read',
    managePortfolios: 'systemAdmin.intel.customers.managePortfolios',
    customerHealthRead: 'systemAdmin.intel.customerHealth.read',
    customerHealthManageDefinitions: 'systemAdmin.intel.customerHealth.manageDefinitions',
    customerHealthRebuild: 'systemAdmin.intel.customerHealth.rebuild',
    productRead: 'systemAdmin.intel.product.read',
    productAnalyticsRead: 'systemAdmin.intel.productAnalytics.read',
    productAnalyticsManageDefinitions:
      'systemAdmin.intel.productAnalytics.manageDefinitions',
    productAnalyticsExport: 'systemAdmin.intel.productAnalytics.export',
    productAnalyticsRunReconciliation:
      'systemAdmin.intel.productAnalytics.runReconciliation',
    productAnalyticsAcknowledgeSignals:
      'systemAdmin.intel.productAnalytics.acknowledgeSignals',
    productAnalyticsViewUserLevel:
      'systemAdmin.intel.productAnalytics.viewUserLevelData',
  },
  customerSuccess: {
    read: 'systemAdmin.customerSuccess.read',
    manageCases: 'systemAdmin.customerSuccess.manageCases',
    manageRenewals: 'systemAdmin.customerSuccess.manageRenewals',
  },
  support: {
    viewTickets: 'systemAdmin.support.viewTickets',
    createTickets: 'systemAdmin.support.createTickets',
    transitionStatus: 'systemAdmin.support.transitionStatus',
    replyPublicly: 'systemAdmin.support.replyPublicly',
    addInternalNotes: 'systemAdmin.support.addInternalNotes',
    addRestrictedNotes: 'systemAdmin.support.addRestrictedNotes',
    assignTickets: 'systemAdmin.support.assignTickets',
    mergeTickets: 'systemAdmin.support.mergeTickets',
    manageSla: 'systemAdmin.support.manageSla',
    export: 'systemAdmin.support.export',
    scheduleReports: 'systemAdmin.support.scheduleReports',
    runReconciliation: 'systemAdmin.support.runReconciliation',
  },
  crm: {
    /** Legacy scaffold aliases — prefer SYSTEM_ADMIN_PERMISSIONS.crm.* */
    leadsView: 'systemAdmin.crm.leads.view',
    leadsManage: 'systemAdmin.crm.leads.manage',
    pipelineView: 'systemAdmin.crm.pipeline.view',
    pipelineManage: 'systemAdmin.crm.pipeline.manage',
    pipelineManageDefinitions: 'systemAdmin.crm.pipeline.manageDefinitions',
    pipelineTransitionStages: 'systemAdmin.crm.pipeline.transitionStages',
    opportunitiesView: 'systemAdmin.crm.opportunities.view',
    opportunitiesCreate: 'systemAdmin.crm.opportunities.create',
    opportunitiesEdit: 'systemAdmin.crm.opportunities.edit',
    activitiesView: 'systemAdmin.crm.activities.view',
    activitiesEdit: 'systemAdmin.crm.activities.edit',
    view: 'systemAdmin.crm.view',
    viewLeads: 'systemAdmin.crm.viewLeads',
    createLeads: 'systemAdmin.crm.createLeads',
    editLeads: 'systemAdmin.crm.editLeads',
    viewAccounts: 'systemAdmin.crm.viewAccounts',
    createAccounts: 'systemAdmin.crm.createAccounts',
    viewContacts: 'systemAdmin.crm.viewContacts',
    createContacts: 'systemAdmin.crm.createContacts',
    transitionStatus: 'systemAdmin.crm.transitionStatus',
    assignLeads: 'systemAdmin.crm.assignLeads',
    qualifyLeads: 'systemAdmin.crm.qualifyLeads',
    scoreLeads: 'systemAdmin.crm.scoreLeads',
    overrideQualification: 'systemAdmin.crm.overrideQualification',
    manageConsent: 'systemAdmin.crm.manageConsent',
    mergeLeads: 'systemAdmin.crm.mergeLeads',
    export: 'systemAdmin.crm.export',
    runReconciliation: 'systemAdmin.crm.runReconciliation',
  },
};

/**
 * Parse "systemAdmin.tenants.view" or "category.action" into nested lookup keys.
 */
export function permissionKeyParts(permission) {
  if (!permission || typeof permission !== 'string') return null;
  const parts = permission.split('.');
  if (parts[0] === 'systemAdmin' && parts.length >= 3) {
    return {
      root: 'systemAdmin',
      category: parts[1],
      action: parts.slice(2).join('.'),
    };
  }
  if (parts.length === 2) {
    return { root: null, category: parts[0], action: parts[1] };
  }
  return null;
}

/**
 * Client-safe permission check (no Prisma / JWT imports).
 * Delegates to canonical authorizeAdminDecision (default deny; Super Admin break-glass).
 * Supports systemAdmin.* and legacy category.action.
 */
export function adminHasPermission(admin, permission) {
  return authorizeAdminDecision({ admin, permission }).allowed === true;
}
