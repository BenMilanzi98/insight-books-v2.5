const fs = require('fs');
const planPath = process.argv[2];
const n = Number(process.argv[3]);
const outPath = process.argv[4] || `.superpowers/sdd/task-${n}-brief.md`;
const plan = fs.readFileSync(planPath, 'utf8');
const lines = plan.split(/\r?\n/);
const out = [];
let intask = false;
let fence = false;
const headingRe = /^#+\s+Task\s+(\d+)/;
for (const line of lines) {
  if (/^```/.test(line)) fence = !fence;
  if (!fence) {
    const m = line.match(headingRe);
    if (m) intask = Number(m[1]) === n;
  }
  if (intask) out.push(line);
}
if (!out.length) {
  console.error(`task ${n} not found in ${planPath}`);
  process.exit(3);
}
fs.mkdirSync(require('path').dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out.join('\n') + '\n');
console.log(`wrote ${outPath}: ${out.length} lines`);
