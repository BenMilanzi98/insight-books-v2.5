/**

 * Support queues — QUEUE_TEAM_MATRIX catalogue (Phase 10 Wave 2).

 * Seed definitions only; liveStatus remains NOT_FOUND (no fabricated staffing).

 */



import { SUPPORT_QUEUE_CODES, SUPPORT_QUEUE_DEFINITIONS } from './catalogue.js';



export function hasSupportQueueModel(prisma) {

  return typeof prisma?.supportQueue?.upsert === 'function';

}



function definitionRows() {

  return SUPPORT_QUEUE_DEFINITIONS.map((q) => ({

    code: q.code,

    typicalOwnership: q.typicalOwnership,

    liveStatus: 'NOT_FOUND',

  }));

}



/**

 * List queue definitions.

 * - No prisma → sync catalogue response

 * - With prisma → Promise; merges DB rows but never invents staffing metrics

 *

 * @param {import('@prisma/client').PrismaClient} [prisma]

 */

export function listQueues(prisma) {

  if (prisma == null) {

    return { ok: true, items: definitionRows(), source: 'catalogue' };

  }

  return listQueuesWithPrisma(prisma);

}



async function listQueuesWithPrisma(prisma) {

  if (!hasSupportQueueModel(prisma)) {

    return { ok: true, items: definitionRows(), source: 'catalogue' };

  }



  let rows = [];

  try {

    rows = await prisma.supportQueue.findMany({ orderBy: { code: 'asc' } });

  } catch {

    rows = [];

  }



  if (!rows?.length) {

    return { ok: true, items: definitionRows(), source: 'catalogue' };

  }



  const byCode = new Map(rows.map((r) => [r.code, r]));

  const items = SUPPORT_QUEUE_CODES.map((code) => {

    const def = SUPPORT_QUEUE_DEFINITIONS.find((d) => d.code === code);

    const db = byCode.get(code);

    return {

      code,

      typicalOwnership: def?.typicalOwnership || db?.typicalOwnership || null,

      liveStatus: 'NOT_FOUND',

      name: db?.name || code,

      active: db?.active !== false,

    };

  });



  return { ok: true, items, source: 'db+catalogue' };

}



/**

 * Seed SupportQueue rows from QUEUE_TEAM_MATRIX codes.

 *

 * @param {import('@prisma/client').PrismaClient} prisma

 */

export async function seedQueueCatalogue(prisma) {

  if (!hasSupportQueueModel(prisma)) {

    return { ok: false, error: 'support_queue_model_unavailable', status: 'UNAVAILABLE' };

  }



  let count = 0;

  for (const def of SUPPORT_QUEUE_DEFINITIONS) {

    await prisma.supportQueue.upsert({

      where: { code: def.code },

      create: {

        code: def.code,

        name: def.code,

        typicalOwnership: def.typicalOwnership || null,

        liveStatus: 'NOT_FOUND',

        active: true,

      },

      update: {

        typicalOwnership: def.typicalOwnership || null,

        liveStatus: 'NOT_FOUND',

        active: true,

      },

    });

    count += 1;

  }



  return { ok: true, count, codes: [...SUPPORT_QUEUE_CODES] };

}


