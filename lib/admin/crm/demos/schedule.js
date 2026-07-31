/**

 * Demo scheduling — Phase 14 Wave 1.

 * Requires one CrmMeeting + Calendar Event; times reconcile via Phase 13 patterns.

 * Demo ≠ Meeting; schedule does not fabricate attendance or Proposal.

 */



import {

  CRM_CALENDAR_EVENT_STATUS,

  CRM_DEMO_STATUS,

  CRM_MEETING_STATUS,

  CRM_SUBJECT_TYPE,

  CRM_TIMELINE_EVENT_TYPE,

} from '../catalogue.js';

import { resolveCrmAccess } from '../authz.js';

import { createCalendarEventForMeeting } from '../calendar/index.js';

import { hasCrmCalendarEventModel, serializeCalendarEvent } from '../calendar/model.js';

import { createMeeting } from '../meetings/index.js';

import { hasCrmMeetingModel, serializeMeeting } from '../meetings/model.js';

import { appendTimelineEvent } from '../timeline.js';

import { getDemoDomainContract } from './catalogue.js';

import { hasCrmDemoModel, serializeDemo } from './model.js';

import { canEditDemos, loadDemo } from './service.js';

import { evaluateDemoReadiness } from './readiness.js';



function toUtcDate(value) {

  if (!value) return null;

  const d = value instanceof Date ? value : new Date(value);

  return Number.isNaN(d.getTime()) ? null : d;

}



/**

 * Fail-closed: Demo SCHEDULED requires a non-cancelled Meeting and a live Calendar Event.

 * Recreates Calendar when Meeting is live but Calendar is missing.

 */

async function resolveLiveScheduleAnchors(prisma, args = {}) {

  const meetingId = args.meetingId ? String(args.meetingId).trim() : '';

  if (!meetingId) {

    return { ok: false, error: 'meeting_required_for_demo_schedule' };

  }

  if (!hasCrmMeetingModel(prisma)) {

    return { ok: false, error: 'crm_meeting_model_unavailable', status: 'UNAVAILABLE' };

  }

  if (!hasCrmCalendarEventModel(prisma)) {

    return {

      ok: false,

      error: 'crm_calendar_event_model_unavailable',

      status: 'UNAVAILABLE',

    };

  }



  let meeting = null;

  try {

    meeting = await prisma.crmMeeting.findUnique({ where: { id: meetingId } });

  } catch {

    meeting = null;

  }

  if (!meeting) {

    return { ok: false, error: 'meeting_not_found_for_demo_schedule' };

  }

  if (meeting.status === CRM_MEETING_STATUS.CANCELLED) {

    return {

      ok: false,

      error: 'meeting_cancelled_cannot_schedule_demo',

      meeting: serializeMeeting(meeting),

    };

  }



  const preferredCalendarId = args.calendarEventId

    ? String(args.calendarEventId).trim()

    : null;



  let calendarRow = null;

  try {

    const events = await prisma.crmCalendarEvent.findMany({

      where: { meetingId },

    });

    const live = (events || []).filter(

      (e) => e && e.status !== CRM_CALENDAR_EVENT_STATUS.CANCELLED

    );

    if (preferredCalendarId) {

      calendarRow = live.find((e) => e.id === preferredCalendarId) || null;

    }

    if (!calendarRow) {

      calendarRow = live[0] || null;

    }

  } catch {

    calendarRow = null;

  }



  let calendarEvent = calendarRow ? serializeCalendarEvent(calendarRow) : null;



  if (!calendarEvent) {

    const startsAtUtc = toUtcDate(args.startsAtUtc) || toUtcDate(meeting.startsAtUtc);

    const endsAtUtc = toUtcDate(args.endsAtUtc) || toUtcDate(meeting.endsAtUtc);

    const timezone =

      (args.timezone != null ? String(args.timezone).trim() : '') ||

      String(meeting.timezone || '').trim();

    const calResult = await createCalendarEventForMeeting(prisma, {

      admin: args.admin,

      internalTrusted: true,

      activityId: args.activityId || meeting.activityId || null,

      meetingId,

      title: args.title || meeting.title || 'Demo',

      startsAtUtc,

      endsAtUtc,

      timezone,

      ownerAdminId: args.ownerAdminId || meeting.ownerAdminId || args.admin?.id || null,

      visibility: meeting.visibility,

      location: args.location != null ? args.location : meeting.location,

      now: args.now || new Date(),

    });

    if (!calResult.ok || !calResult.event?.id) {

      return {

        ok: false,

        error: calResult.error || 'calendar_event_required_for_demo_schedule',

        status: calResult.status,

        meeting: serializeMeeting(meeting),

      };

    }

    calendarEvent = calResult.event;

  }



  return {

    ok: true,

    meeting: serializeMeeting(meeting),

    calendarEvent,

    recreatedCalendar: !calendarRow,

  };

}



/**

 * Schedule a Demo → create/link CrmMeeting + Calendar Event; reconcile times.

 */

export async function scheduleDemo(prisma, args = {}) {

  const access = resolveCrmAccess(args.admin);

  if (!canEditDemos(access)) {

    return { ok: false, forbidden: true, reason: 'crm_demo_schedule_forbidden' };

  }

  if (!hasCrmDemoModel(prisma)) {

    return { ok: false, error: 'crm_demo_model_unavailable', status: 'UNAVAILABLE' };

  }



  const demo = await loadDemo(prisma, args.demoId);

  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };



  if (

    demo.status === CRM_DEMO_STATUS.CANCELLED ||

    demo.status === CRM_DEMO_STATUS.ARCHIVED

  ) {

    return { ok: false, error: 'demo_not_schedulable', status: demo.status };

  }



  const timezone = args.timezone != null ? String(args.timezone).trim() : '';

  if (!timezone) {

    return { ok: false, error: 'timezone_required' };

  }



  const startsAtUtc = toUtcDate(args.startsAt || args.startsAtUtc);

  const endsAtUtc = toUtcDate(args.endsAt || args.endsAtUtc);

  if (!startsAtUtc || !endsAtUtc) {

    return { ok: false, error: 'startsAt_and_endsAt_required' };

  }

  if (endsAtUtc <= startsAtUtc) {

    return { ok: false, error: 'end_before_start' };

  }



  const scheduleKey = args.idempotencyKey

    ? String(args.idempotencyKey).trim()

    : `demo-schedule:${demo.id}`;



  const now = args.now || new Date();

  const title = args.title || demo.title || `Demo ${demo.demoNumber}`;

  const ownerAdminId = args.ownerAdminId || demo.ownerAdminId || args.admin?.id;



  const anchorArgs = {

    admin: args.admin,

    title,

    startsAtUtc,

    endsAtUtc,

    timezone,

    location: args.location,

    ownerAdminId,

    now,

  };



  // Idempotent retry — exact key or already linked meeting with same window

  const sameWindow =

    demo.meetingId &&

    demo.startsAtUtc &&

    demo.endsAtUtc &&

    new Date(demo.startsAtUtc).getTime() === startsAtUtc.getTime() &&

    new Date(demo.endsAtUtc).getTime() === endsAtUtc.getTime() &&

    String(demo.timezone || '') === timezone;



  if (

    (demo.scheduleIdempotencyKey === scheduleKey && demo.meetingId) ||

    sameWindow

  ) {

    const anchors = await resolveLiveScheduleAnchors(prisma, {

      ...anchorArgs,

      meetingId: demo.meetingId,

      calendarEventId: demo.calendarEventId,

    });

    if (!anchors.ok) return anchors;



    if (

      demo.status === CRM_DEMO_STATUS.SCHEDULED &&

      demo.calendarEventId === anchors.calendarEvent.id

    ) {

      return {

        ok: true,

        demo: serializeDemo(demo),

        meeting: anchors.meeting,

        calendarEvent: anchors.calendarEvent,

        alreadyExists: true,

        meetingId: demo.meetingId,

        calendarEventId: anchors.calendarEvent.id,

        domain: getDemoDomainContract(),

      };

    }



    // Live anchors exist but Demo row incomplete — persist SCHEDULED below

    const meetingResult = {

      ok: true,

      meeting: anchors.meeting,

      calendarEvent: anchors.calendarEvent,

      alreadyExists: true,

    };

    return persistScheduledDemo(prisma, {

      demo,

      args,

      scheduleKey,

      timezone,

      startsAtUtc,

      endsAtUtc,

      now,

      meetingResult,

      meetingId: anchors.meeting.id,

      calendarEventId: anchors.calendarEvent.id,

    });

  }



  const meetingResult = await createMeeting(prisma, {

    admin: args.admin,

    title,

    subjectType: CRM_SUBJECT_TYPE.DEMO,

    subjectId: demo.id,

    contactId: args.contactId || demo.contactId,

    purpose: args.purpose || 'DEMO_COMMUNICATION',

    timezone,

    startsAtUtc,

    endsAtUtc,

    startsAtOriginal: args.startsAtOriginal,

    endsAtOriginal: args.endsAtOriginal,

    location: args.location,

    notes: args.notes != null ? args.notes : demo.notes,

    visibility: args.visibility,

    participants: args.participants,

    sendInvitations: args.sendInvitations === true,

    conflictPolicy: args.conflictPolicy,

    conflictReason: args.conflictReason,

    ownerAdminId,

    idempotencyKey: scheduleKey,

    now,

  });



  if (!meetingResult.ok) {

    return meetingResult;

  }



  const meetingId = meetingResult.meeting?.id || null;

  if (!meetingId) {

    return { ok: false, error: 'meeting_create_returned_no_id' };

  }



  // Always verify live Meeting + Calendar (including createMeeting alreadyExists)

  const anchors = await resolveLiveScheduleAnchors(prisma, {

    ...anchorArgs,

    meetingId,

    calendarEventId: meetingResult.calendarEvent?.id || null,

    activityId: meetingResult.activity?.id || meetingResult.meeting?.activityId || null,

  });

  if (!anchors.ok) {

    return anchors;

  }



  if (

    meetingResult.alreadyExists &&

    demo.meetingId === meetingId &&

    demo.calendarEventId === anchors.calendarEvent.id &&

    demo.status === CRM_DEMO_STATUS.SCHEDULED

  ) {

    return {

      ok: true,

      demo: serializeDemo(demo),

      meeting: anchors.meeting,

      calendarEvent: anchors.calendarEvent,

      alreadyExists: true,

      domain: getDemoDomainContract(),

    };

  }



  return persistScheduledDemo(prisma, {

    demo,

    args,

    scheduleKey,

    timezone,

    startsAtUtc,

    endsAtUtc,

    now,

    meetingResult: {

      ...meetingResult,

      meeting: anchors.meeting,

      calendarEvent: anchors.calendarEvent,

    },

    meetingId,

    calendarEventId: anchors.calendarEvent.id,

  });

}



async function persistScheduledDemo(prisma, ctx) {

  const {

    demo,

    args,

    scheduleKey,

    timezone,

    startsAtUtc,

    endsAtUtc,

    now,

    meetingResult,

    meetingId,

    calendarEventId,

  } = ctx;



  if (!meetingId || !calendarEventId) {

    return {

      ok: false,

      error: 'calendar_event_required_for_demo_schedule',

      meeting: meetingResult.meeting || null,

    };

  }



  let updated;

  try {

    updated = await prisma.crmDemo.update({

      where: { id: demo.id },

      data: {

        status: CRM_DEMO_STATUS.SCHEDULED,

        meetingId,

        calendarEventId,

        timezone,

        startsAtUtc,

        endsAtUtc,

        startsAtOriginal: args.startsAtOriginal

          ? String(args.startsAtOriginal)

          : demo.startsAtOriginal,

        endsAtOriginal: args.endsAtOriginal

          ? String(args.endsAtOriginal)

          : demo.endsAtOriginal,

        scheduleIdempotencyKey: scheduleKey,

        updatedAt: now,

      },

    });

  } catch (err) {

    return { ok: false, error: err?.message || 'demo_schedule_persist_failed' };

  }



  await appendTimelineEvent(prisma, {

    subjectType: CRM_SUBJECT_TYPE.DEMO,

    subjectId: demo.id,

    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_SCHEDULED,

    summary: `Demo ${demo.demoNumber} scheduled via Meeting ${meetingResult.meeting?.meetingNumber}`,

    payload: {

      meetingId,

      calendarEventId,

      startsAtUtc: startsAtUtc.toISOString(),

      endsAtUtc: endsAtUtc.toISOString(),

      timezone,

      attendanceInvented: false,

    },

    actorAdminId: args.admin?.id || null,

    at: now,

  });



  const readiness = await evaluateDemoReadiness(prisma, {

    admin: args.admin,

    demoId: demo.id,

    now,

    persist: true,

    timeline: false,

  });



  return {

    ok: true,

    demo: serializeDemo(updated),

    meeting: meetingResult.meeting,

    calendarEvent: meetingResult.calendarEvent,

    activity: meetingResult.activity,

    participants: meetingResult.participants,

    conflicts: meetingResult.conflicts,

    integrations: meetingResult.integrations,

    readinessStatus: readiness.readinessStatus,

    readinessBlockers: readiness.blockers,

    alreadyExists: Boolean(meetingResult.alreadyExists),

    domain: getDemoDomainContract(),

  };

}


