const fs = require('fs');
function strip(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}
for (const f of [
  'hmac_implementation_examples.htm',
  'hmac_online_tool.htm',
  'request_1.htm',
  'request_2.htm',
  'response_1.htm',
  'response_2.htm',
]) {
  const p = `docs/mra-eis/guide/${f}`;
  if (!fs.existsSync(p)) {
    console.log('MISSING', f);
    continue;
  }
  console.log('\n=====', f, '=====');
  console.log(strip(fs.readFileSync(p, 'utf8')).slice(0, 7000));
}
