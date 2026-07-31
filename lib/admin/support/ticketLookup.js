/**

 * Shared SupportTicket lookup by cuid or SUP-YYYY-######.

 */



import { SUPPORT_TICKET_NUMBER_RE } from './catalogue.js';



/**

 * @param {import('@prisma/client').PrismaClient} prisma

 * @param {string} idOrNumber

 */

export async function findSupportTicket(prisma, idOrNumber) {

  const id = idOrNumber ? String(idOrNumber).trim() : '';

  if (!id) return null;

  if (typeof prisma?.supportTicket?.findUnique !== 'function') return null;



  let row = null;

  try {

    if (SUPPORT_TICKET_NUMBER_RE.test(id)) {

      row = await prisma.supportTicket.findUnique({ where: { ticketNumber: id } });

    } else {

      row = await prisma.supportTicket.findUnique({ where: { id } });

    }

    if (!row && typeof prisma.supportTicket.findFirst === 'function') {

      row = await prisma.supportTicket.findFirst({

        where: { OR: [{ id }, { ticketNumber: id }] },

      });

    }

  } catch {

    row = null;

  }

  return row;

}

