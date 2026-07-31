const fs = require('fs');

const prod = JSON.parse(fs.readFileSync('docs/mra-eis/swagger-production.v1.json', 'utf8'));
const sand = JSON.parse(fs.readFileSync('docs/mra-eis/swagger-sandbox.v1.json', 'utf8'));

function summarize(spec, label) {
  const lines = [];
  lines.push(`=== ${label} ===`);
  lines.push(`openapi/swagger: ${spec.openapi || spec.swagger}`);
  lines.push(`info: ${JSON.stringify(spec.info)}`);
  lines.push(
    `servers: ${JSON.stringify(spec.servers || { host: spec.host, basePath: spec.basePath, schemes: spec.schemes })}`
  );
  const sec = spec.components?.securitySchemes || spec.securityDefinitions || {};
  lines.push(`securitySchemes: ${JSON.stringify(sec)}`);
  lines.push(`globalSecurity: ${JSON.stringify(spec.security)}`);
  const paths = Object.keys(spec.paths || {}).sort();
  lines.push(`pathCount: ${paths.length}`);
  lines.push(['METHOD', 'PATH', 'TAGS', 'HEADERS', 'BODY', 'RESPONSES', 'OPERATION_ID', 'SUMMARY'].join('\t'));
  for (const p of paths) {
    const methods = Object.keys(spec.paths[p]).filter(
      (k) => !['parameters', 'summary', 'description', 'servers', '$ref'].includes(k)
    );
    for (const m of methods) {
      const op = spec.paths[p][m];
      const tags = (op.tags || []).join('|');
      const hdr = (op.parameters || [])
        .filter((x) => x.in === 'header')
        .map((x) => `${x.name}${x.required ? '*' : ''}`)
        .join(',');
      const body = op.requestBody ? Object.keys(op.requestBody.content || {}).join('|') : '';
      const res = Object.keys(op.responses || {}).join(',');
      lines.push(
        [m.toUpperCase(), p, tags, hdr || '-', body || '-', res, op.operationId || '-', (op.summary || '').replace(/\s+/g, ' ')].join(
          '\t'
        )
      );
    }
  }
  const schemas = Object.keys(spec.components?.schemas || spec.definitions || {}).sort();
  lines.push(`schemaCount: ${schemas.length}`);
  lines.push(schemas.join('\n'));
  return lines.join('\n');
}

const out = [
  summarize(prod, 'PRODUCTION'),
  '',
  summarize(sand, 'SANDBOX'),
  '',
  `ONLY_IN_SANDBOX: ${[...new Set(Object.keys(sand.paths || {}))].filter((x) => !prod.paths[x]).join(', ')}`,
  `ONLY_IN_PROD: ${[...new Set(Object.keys(prod.paths || {}))].filter((x) => !sand.paths[x]).join(', ')}`,
].join('\n');

fs.writeFileSync('docs/mra-eis/_swagger-summary.txt', out);
console.log(out);
