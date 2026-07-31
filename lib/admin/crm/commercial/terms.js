/**
 * Commercial terms foundation — Phase 15 Wave 2.
 * Versioned terms pins; full template/PDF is Wave 3.
 */

import { resolveCrmAccess } from '../authz.js';
import { hasCrmTermModel, resolveCommercialActor } from './model.js';

export async function createTerm(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!(access.canEditOpportunities || access.isSuperAdmin)) {
    return { ok: false, forbidden: true, reason: 'crm_term_create_forbidden' };
  }
  if (!hasCrmTermModel(prisma)) {
    return { ok: false, error: 'crm_term_model_unavailable', status: 'UNAVAILABLE' };
  }

  const now = args.now || new Date();
  const code = String(args.code || '').trim().toUpperCase();
  if (!code) return { ok: false, error: 'term_code_required' };

  const latest = await prisma.crmTerm.findFirst({
    where: { code },
    orderBy: { version: 'desc' },
  });
  const version = latest ? latest.version + 1 : 1;

  const row = await prisma.crmTerm.create({
    data: {
      code,
      version,
      title: args.title != null ? String(args.title).trim().slice(0, 200) : null,
      bodyJson: args.bodyJson ?? null,
      status: 'DRAFT',
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    term: {
      id: row.id,
      code: row.code,
      version: row.version,
      status: row.status,
      title: row.title,
    },
  };
}

export async function listTerms(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!(access.canViewOpportunities || access.canView || access.isSuperAdmin)) {
    return { ok: false, forbidden: true };
  }
  if (!hasCrmTermModel(prisma)) {
    return { ok: false, error: 'crm_term_model_unavailable', status: 'UNAVAILABLE' };
  }
  const rows = await prisma.crmTerm.findMany({ where: {} });
  return { ok: true, terms: rows };
}
