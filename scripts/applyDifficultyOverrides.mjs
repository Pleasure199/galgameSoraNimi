import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd());
const DATA_PATH = path.join(ROOT, 'server/data/characters.json');

function isComplete(row) {
  return ['男', '女'].includes(row.gender)
    && row.hair_color_family !== 'unknown'
    && row.hair_length !== '未知'
    && row.cv !== '未知'
    && row.writer !== '未知';
}

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
      `"writer": ${JSON.stringify(r.writer)}`,
      `"difficulties": ${JSON.stringify(r.difficulties)}`,
    ];
    return `  { ${parts.join(', ')} }`;
  });
  return `[\n${lines.join(',\n')}\n]\n`;
}

const rows = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')).map((row) => {
  if (row.work === 'PARQUET') {
    return { ...row, difficulties: ['normal'] };
  }
  if (!isComplete(row)) {
    return { ...row, difficulties: ['normal'] };
  }
  if (/9-nine/.test(row.work)) {
    return { ...row, difficulties: ['normal', 'easy', 'beginner'] };
  }
  return row;
});

const dryRun = process.argv.includes('--dry-run');
const target = dryRun ? '/private/tmp/characters-override-preview.json' : DATA_PATH;
fs.writeFileSync(target, serialize(rows));

console.log(`total: ${rows.length}`);
console.log(`beginner: ${rows.filter((row) => row.difficulties.includes('beginner')).length}`);
console.log(`easy: ${rows.filter((row) => row.difficulties.includes('easy')).length}`);
console.log(`normal: ${rows.filter((row) => row.difficulties.includes('normal')).length}`);
console.log(`parquet beginner: ${rows.filter((row) => row.work === 'PARQUET' && row.difficulties.includes('beginner')).length}`);
console.log(`incomplete in beginner: ${rows.filter((row) => row.difficulties.includes('beginner') && !isComplete(row)).length}`);
console.log(`9-nine beginner: ${rows.filter((row) => /9-nine/.test(row.work) && row.difficulties.includes('beginner')).length}`);
console.log(`9-nine total: ${rows.filter((row) => /9-nine/.test(row.work)).length}`);
console.log(dryRun ? 'dry-run only' : `written ${DATA_PATH}`);
