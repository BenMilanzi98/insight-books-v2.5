/**
 * CRM email template foundations — Phase 13 Wave 2.
 * Versioned codes; allowlisted {{var}} substitution only — no eval / executable expressions.
 */

import {
  CRM_EMAIL_TEMPLATE_ALLOWED_VARS,
  CRM_EMAIL_TEMPLATE_STATUS,
} from './catalogue.js';
import {
  hasCrmEmailTemplateModel,
  serializeEmailTemplate,
} from './model.js';
import { resolveCrmAccess } from '../authz.js';

const ALLOWED = new Set(CRM_EMAIL_TEMPLATE_ALLOWED_VARS);
const FORBIDDEN_EXPR = /\$\{|`|<%|%>|javascript:|<\s*script/i;

/**
 * Safe substitution: {{contactName}} only for allowlisted keys.
 * Unknown tokens left as-is; no executable expressions.
 *
 * @param {string} template
 * @param {Record<string, string|number|null|undefined>} vars
 * @returns {string}
 */
export function renderEmailTemplateSafe(template, vars = {}) {
  const src = template == null ? '' : String(template);
  if (FORBIDDEN_EXPR.test(src)) {
    throw new Error('executable_template_expressions_forbidden');
  }
  return src.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (match, key) => {
    if (!ALLOWED.has(key)) return match;
    const val = vars[key];
    if (val == null) return '';
    return String(val);
  });
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} args
 */
export async function createEmailTemplateVersion(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canEditActivities && !access.canEditLeads) {
    return { ok: false, forbidden: true, reason: 'crm_email_template_forbidden' };
  }

  if (!hasCrmEmailTemplateModel(prisma)) {
    return {
      ok: false,
      error: 'crm_email_template_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const code = args.code ? String(args.code).trim().toUpperCase() : '';
  if (!code || !/^[A-Z][A-Z0-9_]{1,63}$/.test(code)) {
    return { ok: false, error: 'invalid_template_code' };
  }

  const subjectTemplate = args.subjectTemplate != null ? String(args.subjectTemplate) : '';
  const bodyHtmlTemplate = args.bodyHtmlTemplate != null ? String(args.bodyHtmlTemplate) : '';
  const bodyTextTemplate = args.bodyTextTemplate != null ? String(args.bodyTextTemplate) : '';

  try {
    renderEmailTemplateSafe(subjectTemplate, {});
    renderEmailTemplateSafe(bodyHtmlTemplate, {});
    renderEmailTemplateSafe(bodyTextTemplate, {});
  } catch {
    return { ok: false, error: 'executable_template_expressions_forbidden' };
  }

  const now = args.now || new Date();
  let version = args.version != null ? Number(args.version) : null;
  if (version == null || Number.isNaN(version) || version < 1) {
    try {
      const latest = await prisma.crmEmailTemplate.findFirst({
        where: { code },
        orderBy: { version: 'desc' },
      });
      version = latest ? latest.version + 1 : 1;
    } catch {
      version = 1;
    }
  }

  const status = String(args.status || CRM_EMAIL_TEMPLATE_STATUS.DRAFT)
    .trim()
    .toUpperCase();

  const row = await prisma.crmEmailTemplate.create({
    data: {
      code,
      version,
      status,
      name: args.name != null ? String(args.name).trim().slice(0, 200) : null,
      subjectTemplate,
      bodyHtmlTemplate,
      bodyTextTemplate,
      createdByAdminId: args.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    template: serializeEmailTemplate(row),
    executableExpressions: false,
  };
}

/**
 * Resolve ACTIVE template by code (highest version) or explicit version.
 */
export async function getActiveEmailTemplate(prisma, args = {}) {
  if (!hasCrmEmailTemplateModel(prisma)) {
    return {
      ok: false,
      error: 'crm_email_template_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  const code = args.code ? String(args.code).trim().toUpperCase() : '';
  if (!code) return { ok: false, error: 'template_code_required' };

  const where = { code, status: CRM_EMAIL_TEMPLATE_STATUS.ACTIVE };
  if (args.version != null) where.version = Number(args.version);

  const row = await prisma.crmEmailTemplate.findFirst({
    where,
    orderBy: { version: 'desc' },
  });
  if (!row) return { ok: false, error: 'template_not_found', notFound: true };
  return { ok: true, template: serializeEmailTemplate(row) };
}

export { CRM_EMAIL_TEMPLATE_ALLOWED_VARS };
