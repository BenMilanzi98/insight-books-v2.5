/**
 * Email Activity catalogue — Phase 13 Wave 2.
 * SMTP accept ≠ delivered; no fabricated opens/replies; no tracking pixels.
 */

import {
  CRM_EMAIL_ACTIVITY_STATUS,
  CRM_EMAIL_ACTIVITY_STATUSES,
  CRM_EMAIL_SEND_STATUS,
  CRM_EMAIL_SEND_STATUSES,
  CRM_EMAIL_DELIVERY_EVENT,
  CRM_EMAIL_DELIVERY_EVENTS,
  CRM_EMAIL_TEMPLATE_STATUS,
  CRM_EMAIL_TEMPLATE_STATUSES,
} from '../catalogue.js';

export {
  CRM_EMAIL_ACTIVITY_STATUS,
  CRM_EMAIL_ACTIVITY_STATUSES,
  CRM_EMAIL_SEND_STATUS,
  CRM_EMAIL_SEND_STATUSES,
  CRM_EMAIL_DELIVERY_EVENT,
  CRM_EMAIL_DELIVERY_EVENTS,
  CRM_EMAIL_TEMPLATE_STATUS,
  CRM_EMAIL_TEMPLATE_STATUSES,
};

/** Allowlisted template substitution keys only — never eval / executable expressions. */
export const CRM_EMAIL_TEMPLATE_ALLOWED_VARS = Object.freeze([
  'contactName',
  'contactEmail',
  'accountName',
  'ownerName',
  'subjectTitle',
]);

export const CRM_EMAIL_TRACKING_PIXELS_ENABLED = false;
