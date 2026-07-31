/**
 * Demo Follow-Ups — Phase 14 Wave 4.
 * Creates Follow-Ups via Phase 13 createFollowUp; subject DEMO (or Lead/Opp).
 * Reminder delivery ≠ Follow-Up complete.
 */

import {
  CRM_DEMO_STATUS,
  CRM_SUBJECT_TYPE,
  CRM_TIMELINE_EVENT_TYPE,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { createFollowUp } from '../followUps.js';
import { appendTimelineEvent } from '../timeline.js';
import { getDemoDomainContract } from './catalogue.js';
import { serializeDemo } from './model.js';
import { canEditDemos, loadDemo, transitionDemoStatus } from './service.js';

/**
 * Create a Follow-Up linked to the Demo (Phase 13 service).
 */
export async function createDemoFollowUp(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_follow_up_forbidden' };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const title =
    args.title != null
      ? String(args.title).trim()
      : `Follow-up: ${demo.demoNumber || demo.title || 'Demo'}`;
  if (!title) return { ok: false, error: 'title_required' };

  // Prefer DEMO subject; allow override to LEAD/OPPORTUNITY when provided
  let subjectType = CRM_SUBJECT_TYPE.DEMO;
  let subjectId = demo.id;
  if (args.subjectType && args.subjectId) {
    subjectType = String(args.subjectType).trim().toUpperCase();
    subjectId = String(args.subjectId).trim();
  } else if (args.linkToOpportunity === true && demo.opportunityId) {
    subjectType = CRM_SUBJECT_TYPE.OPPORTUNITY;
    subjectId = demo.opportunityId;
  } else if (args.linkToLead === true && demo.leadId) {
    subjectType = CRM_SUBJECT_TYPE.LEAD;
    subjectId = demo.leadId;
  }

  const result = await createFollowUp(prisma, {
    admin: args.admin,
    subjectType,
    subjectId,
    title,
    dueAt: args.dueAt,
    channel: args.channel,
    contactId: args.contactId || demo.contactId || null,
    purpose: args.purpose,
    ownerAdminId: args.ownerAdminId || demo.ownerAdminId || null,
    now: args.now,
  });

  if (!result.ok) return result;

  const now = args.now || new Date();
  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: demo.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_FOLLOW_UP_CREATED,
    summary: `Demo Follow-Up created: ${title}`,
    payload: {
      followUpId: result.followUp?.id || null,
      subjectType,
      subjectId,
      reminderDeliveryEqualsComplete: false,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  if (
    demo.status === CRM_DEMO_STATUS.DELIVERED ||
    demo.status === CRM_DEMO_STATUS.OUTCOME_RECORDED
  ) {
    await transitionDemoStatus(prisma, {
      admin: args.admin,
      demoId: demo.id,
      toStatus: CRM_DEMO_STATUS.FOLLOW_UP_PENDING,
      reason: 'follow_up_created',
      now,
    });
  }

  const refreshed = await loadDemo(prisma, demo.id);
  return {
    ok: true,
    followUp: result.followUp,
    demo: serializeDemo(refreshed),
    autoExecuted: false,
    domain: getDemoDomainContract(),
  };
}
