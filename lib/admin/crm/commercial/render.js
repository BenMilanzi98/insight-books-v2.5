/**
 * Deterministic HTML→PDF commercial document render — Phase 15 Wave 3.
 *
 * Approach: build a stable HTML projection, then serialize a real PDF 1.4
 * document with fixed object IDs / no random /ID / no timestamps so the
 * binary (+ sha256) is stable for identical source content. Artifacts are
 * append-only (regenerate = new artifact row, never silent replace).
 */

import { resolveCrmAccess } from '../authz.js';
import {
  getCommercialDomainContract,
} from './catalogue.js';
import { canEditCommercial } from './documents.js';
import {
  hasCrmCommercialArtifactModel,
  hasCrmCommercialRenderJobModel,
  persistArtifactWithChecksum,
  serializeArtifact,
  serializeChecksum,
} from './artifacts.js';
import { sha256Hex } from './checksum.js';
import { resolveCommercialActor } from './model.js';
import {
  buildDeterministicHtmlDocument,
  CRM_COMMERCIAL_PROJECTION,
  CRM_COMMERCIAL_PROJECTIONS,
  loadDefaultBranding,
  projectContentForAudience,
} from './templates.js';
import { loadDocumentVersion } from './versions.js';
import { loadCommercialDocument } from './documents.js';

function normalizeProjection(projection) {
  const p = String(projection || CRM_COMMERCIAL_PROJECTION.ISSUED)
    .trim()
    .toUpperCase();
  if (!CRM_COMMERCIAL_PROJECTIONS.includes(p)) {
    throw new Error(`invalid_projection: ${p}`);
  }
  return p;
}

function pdfEscape(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Convert deterministic HTML (+ structured content) into a stable PDF buffer.
 * Hand-rolled PDF 1.4 (no jsPDF random /ID or CreationDate) for checksum stability.
 */
export function htmlToDeterministicPdfBuffer({
  html,
  title = 'Commercial Document',
  projection = 'ISSUED',
  versionLabel = '',
  content = {},
}) {
  const htmlFingerprint = sha256Hex(html);
  const watermark =
    projection === CRM_COMMERCIAL_PROJECTION.DRAFT
      ? 'DRAFT'
      : projection === CRM_COMMERCIAL_PROJECTION.INTERNAL
        ? 'INTERNAL'
        : '';

  const currency = content.totals?.currency || '';
  const grandTotal = content.totals?.grandTotal ?? '';
  const lines = Array.isArray(content.lineItems) ? content.lineItems : [];
  const lineText = lines
    .map((li, idx) => {
      const ref = li.productRef || li.description || `item-${idx + 1}`;
      return `${ref} | ${li.quantity ?? ''} | ${li.unitPrice ?? li.unit ?? ''} | ${li.currency || currency}`;
    })
    .join('\n');

  const textLines = [
    String(title).slice(0, 120),
    `Version: ${versionLabel}`,
    `Projection: ${projection}`,
    watermark ? `Watermark: ${watermark}` : null,
    `Total: ${grandTotal} ${currency}`.trim(),
    'Items:',
    lineText || '(none)',
    `html-sha256:${htmlFingerprint}`,
  ].filter((x) => x != null);

  // PDF text operators — fixed positions, Helvetica
  let y = 800;
  const ops = ['BT', '/F1 12 Tf', '14 800 Td'];
  for (let i = 0; i < textLines.length; i += 1) {
    if (i === 0) {
      ops.push(`(${pdfEscape(textLines[i])}) Tj`);
    } else {
      y -= 16;
      ops.push('0 -16 Td');
      ops.push(`(${pdfEscape(textLines[i]).slice(0, 110)}) Tj`);
    }
  }
  if (watermark) {
    ops.push('0 -40 Td');
    ops.push('/F1 48 Tf');
    ops.push(`0.85 g (${pdfEscape(watermark)}) Tj`);
    ops.push('0 g');
  }
  ops.push('ET');
  const stream = ops.join('\n');

  const objects = [];
  objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
  objects.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n'
  );
  objects.push(
    `4 0 obj<< /Length ${Buffer.byteLength(stream, 'utf8')} >>stream\n${stream}\nendstream\nendobj\n`
  );
  objects.push('5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n');
  // Fixed info dict — no dates (avoids non-determinism)
  objects.push(
    `6 0 obj<< /Title (${pdfEscape(title).slice(0, 80)}) /Creator (InsightBooks CRM Commercial Wave3) /Producer (InsightBooks Deterministic PDF) >>endobj\n`
  );

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\n`;
  pdf += `startxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

export async function renderCommercialDocument(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (admin && !canEditCommercial(access) && !access.canView) {
    return { ok: false, forbidden: true, reason: 'crm_commercial_render_forbidden' };
  }

  if (!hasCrmCommercialArtifactModel(prisma)) {
    return {
      ok: false,
      error: 'crm_commercial_artifact_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const versionId = args.versionId || args.documentVersionId || args.commercialDocumentVersionId;
  if (!versionId) return { ok: false, error: 'versionId_required' };

  let projection;
  try {
    projection = normalizeProjection(args.projection || CRM_COMMERCIAL_PROJECTION.ISSUED);
  } catch (e) {
    return { ok: false, error: e.message };
  }

  const idempotencyKey = args.idempotencyKey ? String(args.idempotencyKey).trim() : '';

  if (idempotencyKey) {
    try {
      const existing = await prisma.crmCommercialArtifact.findUnique({
        where: {
          versionId_projection_idempotencyKey: {
            versionId,
            projection,
            idempotencyKey,
          },
        },
      });
      if (existing) {
        const checksum = await prisma.crmCommercialChecksum.findFirst({
          where: { artifactId: existing.id },
          orderBy: { createdAt: 'desc' },
        });
        return {
          ok: true,
          alreadyExists: true,
          artifact: serializeArtifact(existing, {
            byteLength: existing.byteLength,
          }),
          checksum: serializeChecksum(checksum),
          domain: getCommercialDomainContract(),
        };
      }
    } catch {
      // compound unique may be unavailable on SQL fallback — try findFirst
      try {
        const existing = await prisma.crmCommercialArtifact.findFirst({
          where: { versionId, projection, idempotencyKey },
          orderBy: { createdAt: 'desc' },
        });
        if (existing) {
          const checksum = await prisma.crmCommercialChecksum.findFirst({
            where: { artifactId: existing.id },
            orderBy: { createdAt: 'desc' },
          });
          return {
            ok: true,
            alreadyExists: true,
            artifact: serializeArtifact(existing, {
              byteLength: existing.byteLength,
            }),
            checksum: serializeChecksum(checksum),
            domain: getCommercialDomainContract(),
          };
        }
      } catch {
        // continue to render
      }
    }
  }

  const version = await loadDocumentVersion(prisma, versionId);
  if (!version) return { ok: false, error: 'document_version_not_found', notFound: true };

  const document = await loadCommercialDocument(prisma, version.documentId);
  const branding = await loadDefaultBranding(prisma);
  const projected = projectContentForAudience(version.contentJson, projection);

  const html = buildDeterministicHtmlDocument({
    branding,
    document: document || {},
    version,
    projection,
    content: projected,
  });

  const now = args.now || new Date();
  let renderJobId = null;
  if (hasCrmCommercialRenderJobModel(prisma)) {
    const job = await prisma.crmCommercialRenderJob.create({
      data: {
        versionId,
        documentVersionId: versionId,
        projection,
        status: 'COMPLETED',
        idempotencyKey: idempotencyKey || null,
        htmlFingerprint: sha256Hex(html),
        createdByAdminId: admin?.id || null,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
    renderJobId = job.id;
  }

  const buffer = htmlToDeterministicPdfBuffer({
    html,
    title: projected.title || document?.title || version.versionLabel,
    projection,
    versionLabel: version.versionLabel,
    content: projected,
  });

  const persisted = await persistArtifactWithChecksum(prisma, {
    versionId,
    documentVersionId: versionId,
    projection,
    buffer,
    htmlSource: html,
    renderJobId,
    idempotencyKey: idempotencyKey || null,
    createdByAdminId: admin?.id || null,
    now,
    storage: args.storage,
  });

  if (!persisted.ok) return persisted;

  return {
    ok: true,
    artifact: persisted.artifact,
    checksum: persisted.checksum,
    html,
    domain: getCommercialDomainContract(),
  };
}
