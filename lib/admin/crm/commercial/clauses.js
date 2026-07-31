/**
 * Commercial clauses foundation — Phase 15 Wave 2.
 * Versioned clause pins; full PDF composition is Wave 3.
 */

import { resolveCrmAccess } from '../authz.js';
import { hasCrmClauseModel, resolveCommercialActor } from './model.js';

export async function createClause(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!(access.canEditOpportunities || access.isSuperAdmin)) {
    return { ok: false, forbidden: true, reason: 'crm_clause_create_forbidden' };
  }
  if (!hasCrmClauseModel(prisma)) {
    return { ok: false, error: 'crm_clause_model_unavailable', status: 'UNAVAILABLE' };
  }

  const now = args.now || new Date();
  const code = String(args.code || '').trim().toUpperCase();
  if (!code) return { ok: false, error: 'clause_code_required' };

  const latest = await prisma.crmClause.findFirst({
    where: { code },
    orderBy: { version: 'desc' },
  });
  const version = latest ? latest.version + 1 : 1;

  const row = await prisma.crmClause.create({
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
    clause: {
      id: row.id,
      code: row.code,
      version: row.version,
      status: row.status,
      title: row.title,
    },
  };
}

export async function listClauses(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!(access.canViewOpportunities || access.canView || access.isSuperAdmin)) {
    return { ok: false, forbidden: true };
  }
  if (!hasCrmClauseModel(prisma)) {
    return { ok: false, error: 'crm_clause_model_unavailable', status: 'UNAVAILABLE' };
  }
  const rows = await prisma.crmClause.findMany({ where: {} });
  return { ok: true, clauses: rows };
}
