const fs = require('fs');
const path = require('path');

const dir = 'docs/mra-eis/guide';
const files = [
  'hmac_sha512.htm',
  'secret_key.htm',
  'signing_offline_receipts.htm',
  'invoice_number_generation.htm',
  'error_codes.htm',
  'terminal_activated_confirmation.htm',
  'sale_transaction.htm',
  'success_scenario.htm',
  'errors.htm',
  'eis_api_2.htm',
  'developer_pre_integration_guide.htm',
  'terminal_activation.htm',
  'get_latest_configuration.htm',
  'request_3.htm',
  'request_4.htm',
  'response_4.htm',
];

function strip(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#xa0;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

let out = '';
for (const f of files) {
  const p = path.join(dir, f);
  if (!fs.existsSync(p)) {
    out += `\n===== MISSING ${f} =====\n`;
    continue;
  }
  out += `\n===== ${f} =====\n`;
  out += strip(fs.readFileSync(p, 'utf8')).slice(0, 6000) + '\n';
}
fs.writeFileSync('docs/mra-eis/_guide-extracts.txt', out);
console.log('wrote _guide-extracts.txt', out.length);
