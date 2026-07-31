/**
 * Commercial document templates + branding foundations — Phase 15 Wave 3.
 */

import { getCommercialDomainContract } from './catalogue.js';
import { resolveCommercialActor } from './model.js';

export const CRM_COMMERCIAL_PROJECTION = Object.freeze({
  DRAFT: 'DRAFT',
  INTERNAL: 'INTERNAL',
  ISSUED: 'ISSUED',
});

export const CRM_COMMERCIAL_PROJECTIONS = Object.freeze(
  Object.values(CRM_COMMERCIAL_PROJECTION)
);

/** Fields stripped from customer-safe / ISSUED projections. */
export const CUSTOMER_UNSAFE_CONTENT_KEYS = Object.freeze([
  'internalNotes',
  'approvalChatter',
  'priceFloors',
  'floorPrices',
  'minPrices',
  'discountApprovals',
  'approvalHistory',
  'internalComments',
  'salespersonNotes',
]);

export function hasCrmCommercialTemplateModel(prisma) {
  return typeof prisma?.crmCommercialTemplate?.create === 'function';
}

export function hasCrmCommercialBrandingModel(prisma) {
  return typeof prisma?.crmCommercialBranding?.create === 'function';
}

export function projectContentForAudience(contentJson, projection) {
  const src =
    contentJson && typeof contentJson === 'object' && !Array.isArray(contentJson)
      ? { ...contentJson }
      : {};
  const proj = String(projection || '')
    .trim()
    .toUpperCase();

  if (proj === CRM_COMMERCIAL_PROJECTION.INTERNAL || proj === CRM_COMMERCIAL_PROJECTION.DRAFT) {
    return {
      ...src,
      projection: proj,
      customerSafe: false,
    };
  }

  // ISSUED (customer-safe): strip internals
  const safe = { ...src };
  for (const key of CUSTOMER_UNSAFE_CONTENT_KEYS) {
    delete safe[key];
  }
  return {
    ...safe,
    projection: CRM_COMMERCIAL_PROJECTION.ISSUED,
    customerSafe: true,
  };
}

export function buildDeterministicHtmlDocument({
  branding = {},
  document = {},
  version = {},
  projection,
  content = {},
}) {
  const proj = String(projection || CRM_COMMERCIAL_PROJECTION.ISSUED).toUpperCase();
  const legalName = branding.legalName || 'InsightBooks';
  const title = content.title || document.title || version.versionLabel || 'Commercial Document';
  const versionLabel = version.versionLabel || '';
  const currency = content.totals?.currency || document.currency || '';
  const grandTotal = content.totals?.grandTotal ?? '';
  const lines = Array.isArray(content.lineItems) ? content.lineItems : [];

  const lineRows = lines
    .map((li, idx) => {
      const ref = li.productRef || li.description || `item-${idx + 1}`;
      const qty = li.quantity ?? '';
      const unit = li.unitPrice ?? li.unit ?? '';
      const cur = li.currency || currency;
      return `<tr><td>${escapeHtml(String(ref))}</td><td>${escapeHtml(String(qty))}</td><td>${escapeHtml(String(unit))}</td><td>${escapeHtml(String(cur))}</td></tr>`;
    })
    .join('');

  const watermark =
    proj === CRM_COMMERCIAL_PROJECTION.DRAFT
      ? 'DRAFT'
      : proj === CRM_COMMERCIAL_PROJECTION.INTERNAL
        ? 'INTERNAL'
        : '';

  // Deterministic HTML: fixed attribute order, no timestamps, stable whitespace.
  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8"/>',
    `<title>${escapeHtml(title)}</title>`,
    '<style>',
    'body{font-family:Helvetica,Arial,sans-serif;color:#0f172a;margin:24px}',
    'h1{font-size:20px;margin:0 0 8px}',
    'table{border-collapse:collapse;width:100%;margin-top:16px}',
    'td,th{border:1px solid #cbd5e1;padding:6px;text-align:left;font-size:12px}',
    '.wm{position:fixed;top:40%;left:20%;font-size:72px;opacity:0.12;transform:rotate(-30deg);pointer-events:none}',
    '</style>',
    '</head>',
    '<body>',
    watermark ? `<div class="wm">${watermark}</div>` : '',
    `<header data-brand="${escapeHtml(legalName)}"><strong>${escapeHtml(legalName)}</strong></header>`,
    `<h1>${escapeHtml(title)}</h1>`,
    `<p data-version="${escapeHtml(versionLabel)}" data-projection="${proj}">Version ${escapeHtml(versionLabel)} · ${proj}</p>`,
    `<p data-total="${escapeHtml(String(grandTotal))}" data-currency="${escapeHtml(String(currency))}">Total: ${escapeHtml(String(grandTotal))} ${escapeHtml(String(currency))}</p>`,
    '<table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Currency</th></tr></thead>',
    `<tbody>${lineRows}</tbody></table>`,
    '</body>',
    '</html>',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function loadDefaultBranding(prisma) {
  if (!hasCrmCommercialBrandingModel(prisma)) {
    return {
      id: null,
      code: 'DEFAULT',
      legalName: 'InsightBooks',
      primaryColor: '#0F172A',
      status: 'ACTIVE',
    };
  }
  try {
    const byCode = await prisma.crmCommercialBranding.findUnique({
      where: { code: 'DEFAULT' },
    });
    if (byCode) return byCode;
    const first = await prisma.crmCommercialBranding.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
    return (
      first || {
        id: null,
        code: 'DEFAULT',
        legalName: 'InsightBooks',
        primaryColor: '#0F172A',
        status: 'ACTIVE',
      }
    );
  } catch {
    return {
      id: null,
      code: 'DEFAULT',
      legalName: 'InsightBooks',
      primaryColor: '#0F172A',
      status: 'ACTIVE',
    };
  }
}

export async function createCommercialTemplate(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  if (!hasCrmCommercialTemplateModel(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_template_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  const now = args.now || new Date();
  const row = await prisma.crmCommercialTemplate.create({
    data: {
      code: String(args.code || 'DEFAULT').trim().slice(0, 64),
      version: Number(args.version) || 1,
      name: args.name != null ? String(args.name).trim().slice(0, 200) : null,
      projectionDefaultsJson: args.projectionDefaultsJson ?? null,
      bodyHtml: args.bodyHtml != null ? String(args.bodyHtml) : null,
      status: args.status || 'ACTIVE',
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });
  return { ok: true, template: row, domain: getCommercialDomainContract() };
}
