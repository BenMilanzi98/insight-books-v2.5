/**
 * Dry-run classification of legacy EIS/EFD-like fields.
 * Does not mutate Sales, Journals, or Stock.
 *
 * Usage: node scripts/mra-eis-phase5-legacy-classify.js
 */
import prisma from '../lib/prisma.js';
import fs from 'fs';
import path from 'path';

const classifications = [];

function classify(row, type, reason) {
  classifications.push({ id: row.id, tenantId: row.tenantId, type, reason });
}

async function main() {
  const report = {
    generatedAt: new Date().toISOString(),
    mode: 'DRY_RUN',
    notes: [
      'Does not create snapshots or transmissions for historical sales.',
      'Does not mark legacy records accepted without evidence.',
      'Does not mutate Journals/Sales/Stock.',
    ],
    summary: {},
    rows: [],
  };

  try {
    const eisInvoices = await prisma.eISInvoice.findMany({ take: 500 });
    for (const inv of eisInvoices) {
      if (inv.status === 'ACCEPTED' || inv.validationUrl) {
        classify(inv, 'LEGACY_ACCEPTED_RECORD', 'Legacy EISInvoice with acceptance/validation evidence');
      } else if (inv.status === 'PENDING' || inv.status === 'SUBMITTED') {
        classify(inv, 'LEGACY_PENDING_RECORD', 'Legacy EISInvoice pending/submitted');
      } else {
        classify(inv, 'AMBIGUOUS', 'Legacy EISInvoice without clear acceptance evidence');
      }
    }

    const eisConfigs = await prisma.eISConfiguration.findMany({ take: 500 });
    for (const cfg of eisConfigs) {
      classify(cfg, 'LEGACY_SETTINGS_ONLY', 'Legacy EISConfiguration row');
    }

    const tenants = await prisma.tenant.findMany({
      where: { eisEnabled: true },
      select: { id: true, eisEnabled: true },
      take: 500,
    });
    for (const t of tenants) {
      classifications.push({
        id: t.id,
        tenantId: t.id,
        type: 'LEGACY_SETTINGS_ONLY',
        reason: 'Tenant.eisEnabled=true (control-plane supersedes; do not auto-transmit)',
      });
    }
  } catch (err) {
    report.error = err.message;
  }

  const counts = {};
  for (const row of classifications) {
    counts[row.type] = (counts[row.type] || 0) + 1;
  }
  report.summary = counts;
  report.rows = classifications;
  if (classifications.length === 0 && !report.error) {
    report.summary = { NO_EXISTING_DATA: 1 };
  }

  const outDir = path.resolve('docs/mra-eis/phase-5');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'PHASE_5_LEGACY_DATA_MIGRATION_REPORT.md');
  const md = [
    '# Phase 5 Legacy Data Migration Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    '',
    '## Summary',
    '',
    '```json',
    JSON.stringify(report.summary, null, 2),
    '```',
    '',
    '## Notes',
    '',
    ...report.notes.map((n) => `- ${n}`),
    '',
    report.error ? `## Error\n\n${report.error}\n` : '',
    `Row samples: ${Math.min(classifications.length, 50)} of ${classifications.length}`,
    '',
    '```json',
    JSON.stringify(classifications.slice(0, 50), null, 2),
    '```',
    '',
  ].join('\n');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(JSON.stringify({ ok: !report.error, summary: report.summary, outPath }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
