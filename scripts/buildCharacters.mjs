import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const DATA_PATH = path.join(ROOT, 'server/data/characters.json');
const IDS_PATH = path.join(ROOT, 'server/data/characterIds.json');
const OVERRIDES_PATH = path.join(ROOT, 'server/data/characterNameOverrides.json');
const RAW_PATH = '/private/tmp/vndb-raw.json';

function serialize(rows) {
  const lines = rows.map((r) => {
    const parts = [
      `"name": ${JSON.stringify(r.name)}`,
      `"work": ${JSON.stringify(r.work)}`,
      `"company": ${JSON.stringify(r.company)}`,
      `"release_year": ${r.release_year}`,
      `"gender": ${JSON.stringify(r.gender)}`,
      `"cv": ${JSON.stringify(r.cv)}`,
      `"hair_color": ${JSON.stringify(r.hair_color)}`,
      `"hair_color_family": ${JSON.stringify(r.hair_color_family)}`,
      `"hair_length": ${JSON.stringify(r.hair_length)}`,
      `"height": ${JSON.stringify(r.height)}`,
      `"difficulties": ${JSON.stringify(r.difficulties)}`,
    ];
    return `  { ${parts.join(', ')} }`;
  });
  return `[\n${lines.join(',\n')}\n]\n`;
}

const current = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const ids = JSON.parse(fs.readFileSync(IDS_PATH, 'utf8'));
const overrides = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'));
const raw = fs.existsSync(RAW_PATH)
  ? JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'))
  : [];

const charById = new Map();
for (const vn of raw) {
  for (const char of vn.chars) {
    charById.set(char.id.replace(/^c/, ''), char);
  }
}

const seenNames = new Map();
const rows = current.map((row, index) => {
  const id = String(ids[index] ?? '');
  const char = charById.get(id);
  let name =
    overrides[id]?.name ||
    (char ? (char.original || char.name || '').replace(/\s+/g, '') : row.name);
  if (seenNames.has(name)) {
    let candidate = `${name} (${row.work})`;
    let suffix = 2;
    while (seenNames.has(candidate)) {
      candidate = `${name} (${row.work} ${suffix++})`;
    }
    name = candidate;
  }
  seenNames.set(name, true);
  return { ...row, name };
});

const duplicateNames = rows
  .map((r) => r.name)
  .filter((name, index, all) => all.indexOf(name) !== index);

const dryRun = process.argv.includes('--dry-run');
const target = dryRun ? '/private/tmp/characters-preview.json' : DATA_PATH;
fs.writeFileSync(target, serialize(rows));

console.log(`total: ${rows.length}`);
console.log(`unique names: ${new Set(rows.map((r) => r.name)).size}`);
console.log(`duplicate names: ${duplicateNames.length}`);
console.log(`written ${target}`);
