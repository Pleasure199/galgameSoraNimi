import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const ROOT = path.resolve(process.cwd());
const DATA_PATH = path.join(ROOT, 'server/data/characters.json');
const IDS_PATH = path.join(ROOT, 'server/data/characterIds.json');
const BANGUMI_DIR = process.env.BANGUMI_DIR || '/private/tmp/bgm';

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

const COMPANY_CN = {
  'KEY': 'Key',
  'TYPE-MOON': 'TYPE-MOON',
  'LEAF': 'Leaf',
  'AQUAPLUS': 'Aquaplus',
  'AUGUST': 'August',
  'CIRCUS': 'CIRCUS',
  'FRONTWING': 'Frontwing',
  'GIGA': 'GIGA',
  'MINATO SOFT': 'Minato Soft',
  'NAVEL': 'Navel',
  'NITROPLUS': 'Nitroplus',
  'PALETTE': 'PALETTE',
  '07TH EXPANSION': '07th Expansion',
  'MAGES': 'MAGES.',
  '5PB': 'MAGES.',
  'MINORI': 'minori',
  'AGE': 'âge',
  'ビジュアルアーツ': 'Visual Art\'s',
  'アクアプラス': 'Aquaplus',
  'オーガスト': 'August',
  'サーカス': 'CIRCUS',
  'フロントウイング': 'Frontwing',
  'ニトロプラス': 'Nitroplus',
  'パレット': 'PALETTE',
  'ネイブル': 'Navel',
  'ミナトソフト': 'Minato Soft',
  'エイジ': 'âge',
};

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

function companyOf(infobox) {
  const source = field(infobox, '开发') || field(infobox, '发行') || field(infobox, '开发商');
  const first = source.split(/[、,，\n|]/)[0].trim();
  const upper = first.toUpperCase();
  for (const [key, name] of Object.entries(COMPANY_CN)) {
    if (upper.includes(key)) return name;
  }
  return first || '未知';
}

function genderOf(value) {
  return value === '男' || value === '女' ? value : '未知';
}

function writerOf(subject) {
  const source = field(subject.infobox || '', '剧本')
    || field(subject.infobox || '', '脚本')
    || field(subject.infobox || '', '企画');
  const names = [];
  for (const raw of source.split(/[、,，；;\n]/)) {
    const name = raw.split(/[（(]/)[0].replace(/\s+/g, '').trim();
    if (name && !names.includes(name)) names.push(name);
    if (names.length >= 4) break;
  }
  return names.join('、') || '未知';
}

function hairOf(value) {
  const source = String(value || '').trim();
  if (!source || source === '未知' || source.includes('秃')) return ['未知', 'unknown'];
  if (source.includes('黑')) return ['黑色', 'black'];
  if (source.includes('棕') || source.includes('褐') || source.includes('茶')) return ['棕色', 'brown'];
  if (source.includes('金')) return ['金色', 'blond'];
  if (source.includes('白') || source.includes('银')) return ['白色', 'white'];
  if (source.includes('红') || source.includes('赤')) return ['红色', 'red'];
  if (source.includes('橙') || source.includes('橘')) return ['橙色', 'orange'];
  if (source.includes('黄')) return ['黄色', 'yellow'];
  if (source.includes('绿')) return ['绿色', 'green'];
  if (source.includes('蓝')) return ['蓝色', 'blue'];
  if (source.includes('紫') || source.includes('绀')) return ['紫色', 'purple'];
  if (source.includes('粉') || source.includes('桃')) return ['粉色', 'pink'];
  if (source.includes('灰')) return ['灰色', 'gray'];
  if (source.includes('青')) return ['青色', 'cyan'];
  return [source, 'unknown'];
}

function cvOf(character) {
  const infobox = character.infobox || '';
  const value = field(infobox, 'CV') || field(infobox, '声优');
  const first = value.split('/')[0].replace(/\s+/g, '').trim();
  return first || '未知';
}

function difficultiesOf(character) {
  const collects = Number(character.collects ?? 0);
  const difficulties = ['normal'];
  if (collects >= 200) difficulties.push('easy');
  if (collects >= 1000) difficulties.push('beginner');
  return difficulties;
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

const subjects = await readJsonLines(path.join(BANGUMI_DIR, 'subject.jsonlines'));
const subjectChars = await readJsonLines(path.join(BANGUMI_DIR, 'subject-characters.jsonlines'));
const characters = await readJsonLines(path.join(BANGUMI_DIR, 'character.jsonlines'));

const selectedSubjects = subjects.filter((subject) => (
  subject.type === 4 &&
  subject.date &&
  gameTypeOf(subject)
));
const selectedSubjectIds = new Set(selectedSubjects.map((subject) => subject.id));
const characterById = new Map(characters.map((character) => [character.id, character]));
const charactersBySubject = new Map();
for (const link of subjectChars) {
  if (!selectedSubjectIds.has(link.subject_id)) continue;
  if (!charactersBySubject.has(link.subject_id)) {
    charactersBySubject.set(link.subject_id, []);
  }
  charactersBySubject.get(link.subject_id).push(link.character_id);
}

const rows = current.slice();
const seenIds = new Set(ids.map((id) => String(id)));
const seenNames = new Set(rows.map((row) => row.name));
const seenWorkNames = new Set(rows.map((row) => `${row.work}|${row.name}`));
const seenBangumiIds = new Set();
let added = 0;
let skippedDuplicates = 0;

for (const subject of selectedSubjects) {
  const work = subject.name_cn?.trim() || subject.name?.trim() || '未知';
  const releaseYear = Number(String(subject.date).slice(0, 4));
  const company = companyOf(subject.infobox || '');
  const writer = writerOf(subject);
  const characterIds = charactersBySubject.get(subject.id) || [];

  for (const bangumiId of characterIds) {
    if (seenBangumiIds.has(bangumiId)) continue;
    const character = characterById.get(bangumiId);
    if (!character || character.role !== 1) continue;

    const infobox = character.infobox || '';
    const [hairColor, hairFamily] = hairOf(field(infobox, '发色'));
    const baseName = (field(infobox, '简体中文名')
      || character.name
      || '').replace(/\s+/g, '');
    if (!baseName) continue;
    if (seenWorkNames.has(`${work}|${baseName}`)) {
      skippedDuplicates += 1;
      continue;
    }
    seenBangumiIds.add(bangumiId);
    let name = baseName;
    if (seenNames.has(name)) {
      let candidate = `${baseName} (${work})`;
      let suffix = 2;
      while (seenNames.has(candidate)) candidate = `${baseName} (${work} ${suffix++})`;
      name = candidate;
    }
    seenNames.add(name);
    seenWorkNames.add(`${work}|${name}`);

    rows.push({
      name,
      work,
      company,
      release_year: releaseYear,
      gender: genderOf(field(infobox, '性别')),
      cv: cvOf(character),
      hair_color: hairColor,
      hair_color_family: hairFamily,
      hair_length: '未知',
      writer,
      difficulties: difficultiesOf(character),
    });
    ids.push(`bgm:${bangumiId}`);
    added += 1;
  }
}

const duplicateNames = rows
  .map((row) => row.name)
  .filter((name, index, all) => all.indexOf(name) !== index);

const dryRun = process.argv.includes('--dry-run');
if (!dryRun) {
  fs.writeFileSync(DATA_PATH, serialize(rows));
  fs.writeFileSync(IDS_PATH, JSON.stringify(ids, null, 2) + '\n');
} else {
  fs.writeFileSync('/private/tmp/characters-bangumi-preview.json', serialize(rows));
}

console.log(`existing: ${current.length}`);
console.log(`added: ${added}`);
console.log(`skipped duplicate work+name rows: ${skippedDuplicates}`);
console.log(`total: ${rows.length}`);
console.log(`unique names: ${new Set(rows.map((row) => row.name)).size}`);
console.log(`duplicate names: ${duplicateNames.length}`);
console.log(dryRun ? 'dry-run only' : 'written characters.json');
