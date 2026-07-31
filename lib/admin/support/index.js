/**
 * Support Ops — Phase 10 Waves 1–4 public surface.
 * Support Ticket ≠ CsCase ≠ PlatformSupportAccess.
 */

export {
  SUPPORT_DEFINITION_VERSION,
  SUPPORT_TICKET_STATUS,
  SUPPORT_TICKET_STATUSES,
  SUPPORT_WAITING_STATUSES,
  SUPPORT_EARLY_TERMINAL_FROM,
  SUPPORT_TERMINALISH_STATUSES,
  SUPPORT_TICKET_TYPE,
  SUPPORT_IMPACT,
  SUPPORT_URGENCY,
  SUPPORT_PRIORITY,
  SUPPORT_SEVERITY,
  SUPPORT_SOURCE_CHANNEL,
  SUPPORT_CHANNEL_AVAILABILITY,
  SUPPORT_TRANSITION_TABLE,
  SUPPORT_TICKET_NUMBER_RE,
  SUPPORT_LIST_MAX_LIMIT,
  SUPPORT_LIST_DEFAULT_LIMIT,
  SUPPORT_MESSAGE_TYPE,
  SUPPORT_MESSAGE_TYPES,
  SUPPORT_CUSTOMER_VISIBLE_MESSAGE_TYPES,
  SUPPORT_CUSTOMER_SAFE_SYSTEM_EVENT_CODES,
  SUPPORT_ATTACHMENT_STATE,
  SUPPORT_ATTACHMENT_STATES,
  SUPPORT_ATTACHMENT_NON_DOWNLOADABLE_STATES,
  SUPPORT_ALLOWED_MIME_TYPES,
  SUPPORT_ATTACHMENT_MAX_BYTES,
  SUPPORT_QUEUE_CODE,
  SUPPORT_QUEUE_CODES,
  SUPPORT_QUEUE_DEFINITIONS,
  SUPPORT_TEAM_CODE,
  SUPPORT_TEAM_DEFINITIONS,
  SUPPORT_HANDOFF_TARGET,
  SUPPORT_HANDOFF_TARGETS,
  SUPPORT_HANDOFF_STATUS,
  SUPPORT_RELIABILITY_STATUS,
  SUPPORT_FOUNDATION_KIND,
  SUPPORT_FOUNDATION_STATUS,
  SUPPORT_EXPORT_VERSION,
  SUPPORT_RECON_VERSION,
  SUPPORT_WAVE4_DEFINITION_VERSION,
  channelAvailability,
  defaultPriority,
} from './catalogue.js';

export { formatTicketNumber, utcYearOf, allocateTicketNumber } from './numbering.js';

export { canTransition, assertTransition } from './stateMachine.js';

export { resolveSupportAccess, resolveSupportQueueScope } from './authz.js';

export {
  hasSupportTicketModel,
  createTicket,
  getTicket,
  listTickets,
  transitionTicketStatus,
  serializeTicket,
} from './tickets.js';

export {
  hasSupportMessageModel,
  addPublicReply,
  addInternalNote,
  addRestrictedNote,
  listMessages,
  projectForCustomer,
  visibleMessageTypesForAdmin,
  serializeMessage,
} from './messages.js';

export {
  SUPPORT_ATTACHMENT_STORAGE_ROOT,
  getSupportAttachmentStorageRoot,
  hasSupportAttachmentModel,
  createAttachment,
  listAttachments,
  markScanResult,
  getAttachmentDownload,
  canDownloadAttachment,
  serializeAttachment,
  absolutePathForKey,
  sanitizeContentDispositionFileName,
} from './attachments.js';

export {
  hasSupportQueueModel,
  listQueues,
  seedQueueCatalogue,
} from './queues.js';

export {
  hasSupportTeamModel,
  listTeams,
  isEligibleAssignee,
} from './teams.js';

export {
  hasSupportAssignmentHistoryModel,
  assignTicket,
  serializeAssignmentHistory,
} from './assignment.js';

export {
  SUPPORT_SLA_CLOCK_TYPE,
  SUPPORT_SLA_CLOCK_TYPES,
  SUPPORT_SLA_CLOCK_STATE,
  SUPPORT_SLA_CLOCK_STATES,
  SUPPORT_SLA_EVENT_TYPE,
  SUPPORT_DEFAULT_SLA_POLICY_VERSION_ID,
  SUPPORT_DEFAULT_SLA_CALENDAR_VERSION_ID,
  SUPPORT_SLA_AVAILABILITY,
  getDefaultSlaCalendar,
  getSlaCalendarByVersion,
  elapsedBusinessMs,
  addBusinessMs,
  getDefaultSlaPolicy,
  getSlaPolicyByVersion,
  shouldPauseForStatus,
  listSlaPolicies,
  hasSupportSlaClockModel,
  startClocksOnTicketCreate,
  stopFirstResponseOnPublicReply,
  onTicketStatusChangeForSla,
  evaluateClockBreach,
  listClocksForTicket,
  serializeClock,
} from './sla/index.js';

export {
  hasSupportHandoffModel,
  createSupportHandoff,
  listSupportHandoffs,
  sanitizeHandoffPayload,
  serializeHandoff,
} from './handoffs.js';

export {
  hasSupportReconciliationRunModel,
  runSupportReconciliation,
  getSupportReconciliation,
  applySupportReconHonesty,
} from './reconciliation.js';

export {
  hasSupportExportAuditModel,
  buildSupportExportPack,
} from './export.js';

export { getSupportFoundations, FOUNDATION_CONTRACTS } from './foundations.js';
