const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else if (name === 'page.js') out.push(full);
  }
  return out;
}

const pages = walk(path.join(root, 'app'));
let fixed = 0;
for (const file of pages) {
  let src = fs.readFileSync(file, 'utf8');
  if (!src.includes('UseTranslatedDocumentTitle')) continue;
  src = src.replace(
    /import UseTranslatedDocumentTitle from '@\/components\/i18n\/UseTranslatedDocumentTitle';\r?\n/g,
    ''
  );
  src = src.replace(
    /\s*<UseTranslatedDocumentTitle titleKey="[^"]+" \/>\r?\n/g,
    '\n'
  );
  fs.writeFileSync(file, src);
  fixed++;
  console.log('reverted', path.relative(root, file));
}
console.log('fixed', fixed);
