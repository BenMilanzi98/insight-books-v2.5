/**
 * CRM Emails — Phase 13 Wave 2 public surface.
 * Distinct from Support email threads / transactional lib/emailService templates.
 */

export {
  CRM_EMAIL_ACTIVITY_STATUS,
  CRM_EMAIL_ACTIVITY_STATUSES,
  CRM_EMAIL_SEND_STATUS,
  CRM_EMAIL_SEND_STATUSES,
  CRM_EMAIL_DELIVERY_EVENT,
  CRM_EMAIL_DELIVERY_EVENTS,
  CRM_EMAIL_TEMPLATE_STATUS,
  CRM_EMAIL_TEMPLATE_STATUSES,
  CRM_EMAIL_TEMPLATE_ALLOWED_VARS,
  CRM_EMAIL_TRACKING_PIXELS_ENABLED,
} from './catalogue.js';

export {
  hasCrmEmailActivityModel,
  hasCrmEmailSendRequestModel,
  hasCrmEmailDeliveryEventModel,
  hasCrmEmailTemplateModel,
  serializeEmailActivity,
  serializeSendRequest,
  serializeDeliveryEvent,
  serializeEmailTemplate,
} from './model.js';

export {
  renderEmailTemplateSafe,
  createEmailTemplateVersion,
  getActiveEmailTemplate,
} from './templates.js';

export { sendCrmSmtpMail, defaultSmtpSend } from './smtpAdapter.js';

export {
  createEmailDraft,
  evaluateEmailSendEligibility,
  evaluateEmailEligibility,
  requestEmailSend,
  listEmailActivities,
} from './service.js';
