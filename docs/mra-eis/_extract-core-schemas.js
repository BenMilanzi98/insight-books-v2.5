const fs = require('fs');
const prod = JSON.parse(fs.readFileSync('docs/mra-eis/swagger-production.v1.json', 'utf8'));
const s = prod.components.schemas;
const paths = prod.paths;

const wanted = [
  'SalesInvoice',
  'InvoiceHeader',
  'InvoiceSummary',
  'LineItemDto',
  'InvoiceResponse',
  'InvoiceResponseAPIResponse',
  'UnActivatedTerminal',
  'TerminalRuntimeEnvironment',
  'Platform',
  'POS',
  'TerminalCredentials',
  'ActivatedTerminal',
  'TerminalActivationResponse',
  'TerminalActivationResponseAPIResponse',
  'ActivatedTerminalConfirmation',
  'Configuration',
  'TaxConfiguration',
  'TaxpayerConfiguration',
  'TerminalConfiguration',
  'OfflineLimit',
  'LastSubmittedInvoice',
  'TaxBreakDown',
  'LevyBreakDown',
  'TaxRateDto',
  'ProductIdentifier',
  'APIError',
  'PongResponse',
  'PongResponseAPIResponse',
];

const out = { extractedAt: new Date().toISOString(), source: 'production swagger v1', schemas: {} };
for (const k of wanted) out.schemas[k] = s[k] || null;

// Auth-related: dump parameters on a few ops
out.operationAuthHints = {};
for (const [path, item] of Object.entries(paths)) {
  for (const [method, op] of Object.entries(item)) {
    if (typeof op !== 'object' || !op) continue;
    const params = [...(item.parameters || []), ...(op.parameters || [])];
    const security = op.security;
    if (params.length || security) {
      out.operationAuthHints[`${method.toUpperCase()} ${path}`] = { parameters: params, security };
    }
  }
}

// Check for description text mentioning signature/hash/Bearer
const raw = JSON.stringify(prod);
out.mentions = {
  authorization: (raw.match(/Authorization|Bearer|jwtToken|secretKey|x-signature|message.?hash|x-eis/gi) || [])
    .reduce((a, w) => ((a[w] = (a[w] || 0) + 1), a), {}),
};

fs.writeFileSync('docs/mra-eis/core-schemas.extracted.json', JSON.stringify(out, null, 2));
console.log('wrote core-schemas.extracted.json');
console.log('mentions', out.mentions);
console.log('ops with params', Object.keys(out.operationAuthHints).length);
for (const [k, v] of Object.entries(out.operationAuthHints)) {
  console.log(k, JSON.stringify(v).slice(0, 300));
}
