import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const ROOT = path.resolve(process.cwd());
const DATA_PATH = path.join(ROOT, 'server/data/characters.json');
const IDS_PATH = path.join(ROOT, 'server/data/characterIds.json');
const BANGUMI_DIR = process.env.BANGUMI_DIR || '/private/tmp/bgm';
const VNDB_DIR = process.env.VNDB_DIR || '/private/tmp/vndb-db/db';

const GALGAME_TAGS = [
  'galgame',
  'gal game',
  'r18',
  '18禁',
  '视觉小说',
  '恋爱adv',
  '美少女游戏',
  'エロゲ',
  'ノベルゲーム',
];
const GALGAME_TYPE_RE = /Galgame|Gal Game|GalGame|美少女|18禁|エロゲ|ノベルゲーム|视觉小说|恋爱/i;
const SUFFIX_RE = /^(.+?)\s*[（(](.+?)[）)]$/;

async function readJsonLines(file) {
  const lines = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line) continue;
    try {
      lines.push(JSON.parse(line));
    } catch {
      // Ignore malformed archive lines.
    }
  }
  return lines;
}

function readTsv(file) {
  return fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split('\t'));
}

function field(infobox, key) {
  const match = infobox.match(new RegExp(`\\|${key}=\\s*([^|\\n\\r}]+)`));
  return match ? match[1].trim() : '';
}

function gameTypeOf(subject) {
  const tags = (subject.tags || []).map((tag) => String(tag.name || '').toLowerCase());
  if (tags.some((tag) => GALGAME_TAGS.some((name) => tag.includes(name)))) return true;
  const type = `${field(subject.infobox || '', '游戏类型')} ${field(subject.infobox || '', '类型')}`;
  return GALGAME_TYPE_RE.test(type);
}

function normalizeForMatch(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s・·･.,，。、!！?？'"“”‘’()（）\[\]【】{}:：;；_\-—－/\\|]+/g, '');
}

function bangumiNames(character) {
  const names = new Set();
  const infobox = character.infobox || '';
  names.add(character.name);
  names.add(field(infobox, '简体中文名'));
  names.add(field(infobox, '日文名'));
  const aliasBlock = infobox.match(/\|别名=\s*\{([\s\S]*?)\n?\}/)?.[1] || '';
  for (const line of aliasBlock.split(/\r?\n/)) {
    const match = line.match(/\[([^\]|]+)(?:\|([^\]]+))?\]/);
    if (!match) continue;
    names.add(match[2] || match[1]);
  }
  return [...names].filter(Boolean).map(normalizeForMatch).filter(Boolean);
}

function baseName(name) {
  const match = name.match(SUFFIX_RE);
  return match ? match[1].trim() : name;
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

const current = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const ids = JSON.parse(fs.readFileSync(IDS_PATH, 'utf8'));
const subjects = (await readJsonLines(path.join(BANGUMI_DIR, 'subject.jsonlines')))
  .filter((subject) => subject.type === 4 && subject.date && gameTypeOf(subject));
const characters = await readJsonLines(path.join(BANGUMI_DIR, 'character.jsonlines'));
const characterById = new Map(characters.map((character) => [character.id, character]));

const vndbBySubject = new Map();
for (const subject of subjects) {
  const match = (subject.infobox || '').match(/vndb\.org\/v(\d+)/i);
  if (match) vndbBySubject.set(subject.id, match[1]);
}

const vnTitles = readTsv(path.join(VNDB_DIR, 'vn_titles'));
const vnZhTitle = new Map();
for (const row of vnTitles) {
  const vid = row[0].replace(/^v/, '');
  const [, lang, official, title] = row;
  if (lang === 'zh-Hans' && title && /[\u4e00-\u9fff]/.test(title)) {
    if (!vnZhTitle.has(vid) || official === 't') vnZhTitle.set(vid, title.trim());
  }
}

const workToVnIds = new Map();
for (const subject of subjects) {
  const vnId = vndbBySubject.get(subject.id);
  if (!vnId) continue;
  for (const name of [subject.name_cn, subject.name, vnZhTitle.get(String(vnId))]) {
    if (!name) continue;
    const key = normalizeForMatch(name);
    if (!workToVnIds.has(key)) workToVnIds.set(key, new Set());
    workToVnIds.get(key).add(String(vnId));
  }
}

const vndbNames = new Map();
for (const row of readTsv(path.join(VNDB_DIR, 'chars_names'))) {
  const id = row[0].replace(/^c/, '');
  if (!vndbNames.has(id)) vndbNames.set(id, new Set());
  if (row[2]) vndbNames.get(id).add(normalizeForMatch(row[2]));
  if (row[3]) vndbNames.get(id).add(normalizeForMatch(row[3]));
}
for (const row of readTsv(path.join(VNDB_DIR, 'chars_alias'))) {
  const id = row[0].replace(/^c/, '');
  if (!vndbNames.has(id)) vndbNames.set(id, new Set());
  if (row[2]) vndbNames.get(id).add(normalizeForMatch(row[2]));
  if (row[3]) vndbNames.get(id).add(normalizeForMatch(row[3]));
}

const vnToCharIds = new Map();
for (const row of readTsv(path.join(VNDB_DIR, 'chars_vns'))) {
  const vid = row[1].replace(/^v/, '');
  const cid = row[0].replace(/^c/, '');
  if (!vnToCharIds.has(vid)) vnToCharIds.set(vid, []);
  vnToCharIds.get(vid).push(cid);
}

function matchVndbCharacter(character, candidateIds) {
  const bgmNames = new Set(bangumiNames(character));
  if (!bgmNames.size || !candidateIds.length) return null;
  const exact = candidateIds.filter((cid) => {
    const names = vndbNames.get(cid);
    if (!names) return false;
    return [...names].some((name) => bgmNames.has(name));
  });
  return exact.length === 1 ? exact[0] : null;
}

function findVndbMatch(row, id) {
  if (!id.startsWith('bgm:')) return id;
  const character = characterById.get(Number(id.slice(4)));
  if (!character) return null;
  const vnIds = workToVnIds.get(normalizeForMatch(row.work)) || new Set();
  const candidates = [...vnIds].flatMap((vnId) => vnToCharIds.get(vnId) || []);
  return matchVndbCharacter(character, candidates);
}

const keptRows = [];
const keptIds = [];
const seenId = new Map();
let removedById = 0;

for (let index = 0; index < current.length; index += 1) {
  const id = String(ids[index] ?? '');
  const row = current[index];
  if (seenId.has(id)) {
    removedById += 1;
    continue;
  }
  seenId.set(id, true);
  keptRows.push(row);
  keptIds.push(id);
}

const byBase = new Map();
for (let index = 0; index < keptRows.length; index += 1) {
  const base = baseName(keptRows[index].name);
  if (!byBase.has(base)) byBase.set(base, []);
  byBase.get(base).push(index);
}

const removeIndexes = new Set();
let removedCrossSource = 0;
for (const indexes of byBase.values()) {
  if (indexes.length < 2) continue;
  const plain = indexes.find((index) => keptRows[index].name === baseName(keptRows[index].name));
  if (plain === undefined) continue;
  const plainId = keptIds[plain];
  const plainVndb = findVndbMatch(keptRows[plain], plainId);

  for (const index of indexes) {
    if (index === plain) continue;
    const row = keptRows[index];
    const id = keptIds[index];
    const vndb = findVndbMatch(row, id);
    const isSame = plainVndb && vndb && String(plainVndb) === String(vndb);
    if (!isSame) continue;
    removeIndexes.add(index);
    removedCrossSource += 1;
  }
}

const finalRows = keptRows.filter((_, index) => !removeIndexes.has(index));
const finalIds = keptIds.filter((_, index) => !removeIndexes.has(index));

const dryRun = process.argv.includes('--dry-run');
const target = dryRun ? '/private/tmp/characters-dedup-preview.json' : DATA_PATH;
fs.writeFileSync(target, serialize(finalRows));
if (!dryRun) {
  fs.writeFileSync(IDS_PATH, JSON.stringify(finalIds, null, 2) + '\n');
}

console.log(`total: ${current.length}`);
console.log(`removed by same id: ${removedById}`);
console.log(`removed cross-source: ${removedCrossSource}`);
console.log(`kept: ${finalRows.length}`);
console.log(`unique names: ${new Set(finalRows.map((row) => row.name)).size}`);
console.log(`duplicate names: ${finalRows.map((row) => row.name).filter((name, index, all) => all.indexOf(name) !== index).length}`);
console.log(`beginner: ${finalRows.filter((row) => row.difficulties.includes('beginner')).length}`);
console.log(`easy: ${finalRows.filter((row) => row.difficulties.includes('easy')).length}`);
console.log(dryRun ? 'dry-run only' : `written ${DATA_PATH} and ${IDS_PATH}`);
