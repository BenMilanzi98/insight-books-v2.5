#!/usr/bin/env node
/** Emit empty control-total templates (exact decimals) for cutover evidence packs. */

const fs = require('fs');
const path = require('path');

const outDir = path.join(process.cwd(), 'artifacts', 'production-cutover', 'source-financial-control-totals');
fs.mkdirSync(outDir, { recursive: true });

const financial = {
  businessId: null,
  capturedAt: new Date().toISOString(),
  journalCount: null,
  journalLineCount: null,
  totalDebits: null,
  totalCredits: null,
  balanced: null,
  notes: 'TO FILL FROM PRODUCTION — use exact decimals; never floating-point authority.',
};

const security = {
  capturedAt: new Date().toISOString(),
  userCount: null,
  membershipCount: null,
  roleCount: null,
  auditEventCount: null,
  notes: 'TO FILL FROM PRODUCTION',
};

const documents = {
  capturedAt: new Date().toISOString(),
  fileCount: null,
  totalBytes: null,
  notes: 'TO FILL — no file contents in artifacts',
};

fs.writeFileSync(path.join(outDir, 'financial-template.json'), JSON.stringify(financial, null, 2));
fs.writeFileSync(
  path.join(process.cwd(), 'artifacts', 'production-cutover', 'security-control-totals-template.json'),
  JSON.stringify(security, null, 2)
);
fs.writeFileSync(
  path.join(process.cwd(), 'artifacts', 'production-cutover', 'document-control-totals-template.json'),
  JSON.stringify(documents, null, 2)
);

console.log(
  JSON.stringify(
    {
      ok: true,
      filled: false,
      outDir,
    },
    null,
    2
  )
);
