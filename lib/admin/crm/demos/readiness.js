/**

 * Demo readiness spine — Phase 14 Wave 1–3.

 * NOT_READY / PARTIALLY_READY / READY / BLOCKED.

 * Missing Meeting / presenter / Contact blocks READY_TO_DELIVER.

 * Wave 2: agenda/script pins reported (INFO when missing).

 * Wave 3: env READY / checklist / rehearsal when configured — Critical fails block.

 */



import {

  CRM_DEMO_CHECKLIST_EXECUTION_STATUS,

  CRM_DEMO_ENVIRONMENT_HEALTH,

  CRM_DEMO_ENVIRONMENT_STATUS,

  CRM_DEMO_REHEARSAL_OUTCOME,

  CRM_READINESS_STATUS,

  CRM_SUBJECT_TYPE,

  CRM_TIMELINE_EVENT_TYPE,

} from '../catalogue.js';

import { resolveCrmAccess } from '../authz.js';

import { appendTimelineEvent } from '../timeline.js';

import { hasCrmMeetingModel } from '../meetings/model.js';

import { hasCrmCalendarEventModel } from '../calendar/model.js';

import { CRM_DEMO_PARTICIPANT_ROLE } from './catalogue.js';

import {

  hasCrmDemoModel,

  hasCrmDemoParticipantModel,

  serializeDemo,

} from './model.js';

import {

  evaluateLogicalEnvironmentHealth,

  hasCrmDemoEnvironmentModel,

} from './environments.js';

import { hasCrmDemoChecklistExecutionModel } from './checklists.js';

import { hasCrmDemoRehearsalModel } from './rehearsals.js';



function item(key, ok, severity, detail, blocker = false) {

  return {

    key,

    ok: Boolean(ok),

    severity: severity || (ok ? 'INFO' : 'WARN'),

    detail: detail || null,

    blocker: Boolean(blocker),

  };

}



function deriveStatus(items) {

  const blockers = items.filter((i) => i.blocker && !i.ok);

  if (blockers.length > 0) return CRM_READINESS_STATUS.BLOCKED;

  const failed = items.filter((i) => !i.ok);

  if (failed.length === 0) return CRM_READINESS_STATUS.READY;

  const requiredFailed = failed.filter((i) => i.severity !== 'INFO');

  if (requiredFailed.length === 0) return CRM_READINESS_STATUS.PARTIALLY_READY;

  const allSoft = requiredFailed.every((i) => i.severity === 'WARN');

  if (allSoft && requiredFailed.length < items.length) {

    return CRM_READINESS_STATUS.PARTIALLY_READY;

  }

  return CRM_READINESS_STATUS.NOT_READY;

}



async function loadDemoRow(prisma, demoId) {

  const id = demoId ? String(demoId).trim() : '';

  if (!id || !hasCrmDemoModel(prisma)) return null;

  try {

    if (/^DEMO-\d{4}-\d{6}$/.test(id)) {

      return await prisma.crmDemo.findUnique({ where: { demoNumber: id } });

    }

    return await prisma.crmDemo.findUnique({ where: { id } });

  } catch {

    return null;

  }

}



/**

 * Evaluate Demo readiness. Never fabricates Meeting / attendance / env / proposal.

 */

export async function evaluateDemoReadiness(prisma, args = {}) {

  const access = resolveCrmAccess(args.admin);

  if (

    !(

      access.canViewActivities ||

      access.canViewLeads ||

      access.canViewOpportunities ||

      access.canView

    )

  ) {

    return { ok: false, forbidden: true, reason: 'crm_demo_readiness_forbidden' };

  }

  if (!hasCrmDemoModel(prisma)) {

    return { ok: false, error: 'crm_demo_model_unavailable', status: 'UNAVAILABLE' };

  }



  const row = await loadDemoRow(prisma, args.demoId);

  if (!row) return { ok: false, notFound: true, error: 'demo_not_found' };



  const items = [];

  const now = args.now || new Date();



  items.push(

    item(

      'demo_number',

      Boolean(row.demoNumber),

      'CRITICAL',

      row.demoNumber ? `Number ${row.demoNumber}` : 'Demo number missing',

      !row.demoNumber

    )

  );



  const meetingLinked = Boolean(row.meetingId);

  items.push(

    item(

      'meeting_linked',

      meetingLinked,

      'CRITICAL',

      meetingLinked

        ? `Meeting ${row.meetingId} linked`

        : 'CrmMeeting required before READY_TO_DELIVER',

      !meetingLinked

    )

  );



  let timesReconcile = false;

  let calendarLinked = Boolean(row.calendarEventId);

  if (meetingLinked && hasCrmMeetingModel(prisma)) {

    try {

      const meeting = await prisma.crmMeeting.findUnique({

        where: { id: row.meetingId },

      });

      if (meeting && row.startsAtUtc && row.endsAtUtc) {

        const mStart = new Date(meeting.startsAtUtc).getTime();

        const mEnd = new Date(meeting.endsAtUtc).getTime();

        const dStart = new Date(row.startsAtUtc).getTime();

        const dEnd = new Date(row.endsAtUtc).getTime();

        timesReconcile =

          mStart === dStart &&

          mEnd === dEnd &&

          String(meeting.timezone || '') === String(row.timezone || '');

      }

      if (!calendarLinked && hasCrmCalendarEventModel(prisma)) {

        const events = await prisma.crmCalendarEvent.findMany({

          where: { meetingId: row.meetingId },

          take: 1,

        });

        calendarLinked = events.length > 0;

      }

    } catch {

      timesReconcile = false;

    }

  }



  items.push(

    item(

      'calendar_linked',

      calendarLinked,

      'CRITICAL',

      calendarLinked

        ? 'Calendar Event linked'

        : 'Calendar Event required with Meeting',

      meetingLinked && !calendarLinked

    )

  );



  items.push(

    item(

      'times_reconcile',

      !meetingLinked || timesReconcile,

      'CRITICAL',

      timesReconcile || !meetingLinked

        ? 'Demo times reconcile with Meeting'

        : 'Demo startsAt/endsAt/timezone must match Meeting',

      meetingLinked && !timesReconcile

    )

  );



  let hasPresenter = false;

  let hasPrimaryContact = Boolean(row.contactId);

  if (hasCrmDemoParticipantModel(prisma)) {

    try {

      const parts = await prisma.crmDemoParticipant.findMany({

        where: { demoId: row.id },

      });

      hasPresenter = parts.some(

        (p) => p.role === CRM_DEMO_PARTICIPANT_ROLE.PRESENTER

      );

      hasPrimaryContact =

        hasPrimaryContact ||

        parts.some((p) => p.role === CRM_DEMO_PARTICIPANT_ROLE.PRIMARY_CONTACT);

    } catch {

      // keep flags

    }

  }



  items.push(

    item(

      'presenter_assigned',

      hasPresenter,

      'CRITICAL',

      hasPresenter ? 'Presenter assigned' : 'Presenter (ADMIN) required',

      !hasPresenter

    )

  );



  items.push(

    item(

      'primary_contact',

      hasPrimaryContact,

      'CRITICAL',

      hasPrimaryContact

        ? 'Primary Contact present'

        : 'Primary Contact required',

      !hasPrimaryContact

    )

  );



  const agendaPinned = Boolean(row.pinnedAgendaId);

  const scriptPinned = Boolean(row.pinnedScriptId);

  items.push(

    item(

      'agenda_version',

      agendaPinned,

      'INFO',

      agendaPinned

        ? `Agenda version pinned (${row.pinnedAgendaId})`

        : 'Agenda version not pinned (Wave 2)',

      false

    )

  );

  items.push(

    item(

      'script_version',

      scriptPinned,

      'INFO',

      scriptPinned

        ? `Script version pinned (${row.pinnedScriptId})`

        : 'Script version not pinned (Wave 2)',

      false

    )

  );



  // Wave 3 — logical environment (when configured)

  const envRequired = row.requiresLogicalEnvironment === true;

  let envOk = !envRequired;

  let envDetail = 'Logical Demo Environment not required for this Demo type';

  let envSeverity = 'INFO';

  if (envRequired) {

    envSeverity = 'CRITICAL';

    envOk = false;

    envDetail = 'Logical Demo Environment READY required';

    if (row.environmentId && hasCrmDemoEnvironmentModel(prisma)) {

      try {

        const env = await prisma.crmDemoEnvironment.findUnique({

          where: { id: row.environmentId },

        });

        if (env) {

          const health = evaluateLogicalEnvironmentHealth(env, now);

          const ready =

            env.status === CRM_DEMO_ENVIRONMENT_STATUS.READY &&

            health.ok &&

            health.healthStatus === CRM_DEMO_ENVIRONMENT_HEALTH.HEALTHY;

          envOk = ready;

          envDetail = ready

            ? `Environment ${env.envNumber} READY (logical; DEMO banner)`

            : `Environment ${env.envNumber} not READY (${env.status}/${health.healthStatus})`;

        }

      } catch {

        envOk = false;

        envDetail = 'Environment lookup failed';

      }

    } else {

      envDetail = 'No logical Demo Environment linked (required)';

    }

  }

  items.push(

    item('logical_environment', envOk, envSeverity, envDetail, envRequired && !envOk)

  );



  // Wave 3 — checklist (when configured)

  const checklistRequired = row.requiresChecklist === true;

  let checklistOk = !checklistRequired;

  let checklistDetail = 'Demo checklist not required for this Demo type';

  let checklistSeverity = 'INFO';

  if (checklistRequired) {

    checklistSeverity = 'CRITICAL';

    checklistOk = false;

    checklistDetail = 'Checklist execution PASSED without Critical fails required';

    if (

      row.latestChecklistExecutionId &&

      hasCrmDemoChecklistExecutionModel(prisma)

    ) {

      try {

        const exec = await prisma.crmDemoChecklistExecution.findUnique({

          where: { id: row.latestChecklistExecutionId },

        });

        if (exec) {

          const passed =

            exec.status === CRM_DEMO_CHECKLIST_EXECUTION_STATUS.PASSED &&

            exec.criticalFailed !== true;

          checklistOk = passed;

          checklistDetail = passed

            ? 'Checklist PASSED (no Critical fails)'

            : `Checklist ${exec.status}${exec.criticalFailed ? ' with Critical fails' : ''}`;

        }

      } catch {

        checklistOk = false;

      }

    } else {

      checklistDetail = 'No checklist execution recorded (required)';

    }

  }

  items.push(

    item(

      'checklist_gate',

      checklistOk,

      checklistSeverity,

      checklistDetail,

      checklistRequired && !checklistOk

    )

  );



  // Wave 3 — rehearsal (when configured)

  const rehearsalRequired = row.requiresRehearsal === true;

  let rehearsalOk = !rehearsalRequired;

  let rehearsalDetail = 'Demo rehearsal not required for this Demo type';

  let rehearsalSeverity = 'INFO';

  if (rehearsalRequired) {

    rehearsalSeverity = 'CRITICAL';

    rehearsalOk = false;

    rehearsalDetail = 'Rehearsal PASSED without Critical issues required';

    if (row.latestRehearsalId && hasCrmDemoRehearsalModel(prisma)) {

      try {

        const reh = await prisma.crmDemoRehearsal.findUnique({

          where: { id: row.latestRehearsalId },

        });

        if (reh) {

          const passed =

            reh.outcome === CRM_DEMO_REHEARSAL_OUTCOME.PASSED &&

            !(Number(reh.criticalIssueCount) > 0);

          rehearsalOk = passed;

          rehearsalDetail = passed

            ? 'Rehearsal PASSED (no Critical issues)'

            : `Rehearsal ${reh.outcome} (criticalIssues=${reh.criticalIssueCount || 0})`;

        }

      } catch {

        rehearsalOk = false;

      }

    } else {

      rehearsalDetail = 'No rehearsal recorded (required)';

    }

  }

  items.push(

    item(

      'rehearsal_gate',

      rehearsalOk,

      rehearsalSeverity,

      rehearsalDetail,

      rehearsalRequired && !rehearsalOk

    )

  );



  const readinessStatus = deriveStatus(items);

  const blockers = items.filter((i) => i.blocker && !i.ok).map((i) => i.key);

  const readinessJson = {

    status: readinessStatus,

    items,

    blockers,

    evaluatedAt: now.toISOString(),

    wave: 3,

    inventAttendanceForbidden: true,

    inventProposalForbidden: true,

    inventTenantProvisionForbidden: true,

    inventEnvironmentReadyForbidden: true,

    mraEisSandboxEqualsDemoEnvironment: false,

    requiresLogicalEnvironment: envRequired,

    requiresChecklist: checklistRequired,

    requiresRehearsal: rehearsalRequired,

  };



  if (args.persist !== false) {

    try {

      await prisma.crmDemo.update({

        where: { id: row.id },

        data: {

          readinessStatus,

          readinessJson,

          updatedAt: now,

        },

      });

    } catch {

      // non-fatal for evaluation return

    }

  }



  if (args.timeline !== false) {

    await appendTimelineEvent(prisma, {

      subjectType: CRM_SUBJECT_TYPE.DEMO,

      subjectId: row.id,

      eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_READINESS_EVALUATED,

      summary: `Demo readiness: ${readinessStatus}`,

      payload: {

        readinessStatus,

        blockers,

        checklistKeys: items.map((i) => i.key),

      },

      actorAdminId: args.admin?.id || null,

      at: now,

    });

  }



  const refreshed = await loadDemoRow(prisma, row.id);



  return {

    ok: true,

    demo: serializeDemo(refreshed || { ...row, readinessStatus, readinessJson }),

    readinessStatus,

    items,

    blockers,

    readinessJson,

  };

}



/**

 * Configure which Wave 3 readiness gates apply to a Demo.

 */

export async function configureDemoReadinessRequirements(prisma, args = {}) {

  const access = resolveCrmAccess(args.admin);

  if (

    !(

      access.canEditActivities ||

      access.canEditLeads ||

      access.canEditOpportunities ||

      access.canCreateLeads

    )

  ) {

    return { ok: false, forbidden: true, reason: 'crm_demo_configure_forbidden' };

  }

  const row = await loadDemoRow(prisma, args.demoId);

  if (!row) return { ok: false, notFound: true, error: 'demo_not_found' };



  const data = { updatedAt: args.now || new Date() };

  if (args.requiresLogicalEnvironment !== undefined) {

    data.requiresLogicalEnvironment = args.requiresLogicalEnvironment === true;

  }

  if (args.requiresChecklist !== undefined) {

    data.requiresChecklist = args.requiresChecklist === true;

  }

  if (args.requiresRehearsal !== undefined) {

    data.requiresRehearsal = args.requiresRehearsal === true;

  }



  const updated = await prisma.crmDemo.update({

    where: { id: row.id },

    data,

  });

  return { ok: true, demo: serializeDemo(updated) };

}


