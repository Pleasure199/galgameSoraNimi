import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const ROOT = path.resolve(process.cwd());
const DATA_PATH = path.join(ROOT, 'server/data/characters.json');
const IDS_PATH = path.join(ROOT, 'server/data/characterIds.json');
const BANGUMI_DIR = process.env.BANGUMI_DIR || '/private/tmp/bgm';
const VNDB_DIR = process.env.VNDB_DIR || '/private/tmp/vndb-db/db';

const YUZUSOFT_WORKS = new Set([
  '魔女的夜宴',
  '千恋＊万花',
  'RIDDLE JOKER',
  '星光咖啡馆与死神之蝶',
  '天使☆嚣嚣 RE-BOOT!',
]);

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

const HAIR_COLORS = [
  ['Black', '黑色', 'black'],
  ['Brown', '棕色', 'brown'],
  ['Blond', '金色', 'blond'],
  ['Red', '红色', 'red'],
  ['Blue', '蓝色', 'blue'],
  ['Grey', '灰色', 'gray'],
  ['Violet', '紫色', 'purple'],
  ['Green', '绿色', 'green'],
  ['White', '白色', 'white'],
  ['Orange', '橙色', 'orange'],
  ['Pink', '粉色', 'pink'],
  ['Teal', '青色', 'cyan'],
  ['Yellow', '黄色', 'yellow'],
];

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

const nameRows = readTsv(path.join(VNDB_DIR, 'chars_names'));
const aliasRows = readTsv(path.join(VNDB_DIR, 'chars_alias'));
const vndbNames = new Map();
for (const row of nameRows) {
  const id = row[0].replace(/^c/, '');
  if (!vndbNames.has(id)) vndbNames.set(id, new Set());
  if (row[2]) vndbNames.get(id).add(normalizeForMatch(row[2]));
  if (row[3]) vndbNames.get(id).add(normalizeForMatch(row[3]));
}
for (const row of aliasRows) {
  const id = row[0].replace(/^c/, '');
  if (!vndbNames.has(id)) vndbNames.set(id, new Set());
  if (row[2]) vndbNames.get(id).add(normalizeForMatch(row[2]));
  if (row[3]) vndbNames.get(id).add(normalizeForMatch(row[3]));
}

const vnCharRows = readTsv(path.join(VNDB_DIR, 'chars_vns'));
const vnToCharIds = new Map();
for (const row of vnCharRows) {
  const vid = row[1].replace(/^v/, '');
  const cid = row[0].replace(/^c/, '');
  if (!vnToCharIds.has(vid)) vnToCharIds.set(vid, []);
  vnToCharIds.get(vid).push(cid);
}

const traits = readTsv(path.join(VNDB_DIR, 'traits'));
const traitParents = readTsv(path.join(VNDB_DIR, 'traits_parents'));
const traitNames = new Map(traits.map((row) => [row[0], row[7]]));
const parentOf = new Map(traitParents.map((row) => [row[0], row[1]]));
const ancestorsCache = new Map();
function ancestors(tid) {
  if (ancestorsCache.has(tid)) return ancestorsCache.get(tid);
  const set = new Set();
  let cur = tid;
  while (cur && cur !== '\\N' && !set.has(cur)) {
    set.add(cur);
    cur = parentOf.get(cur);
  }
  ancestorsCache.set(tid, set);
  return set;
}

const traitsByChar = new Map();
for (const row of readTsv(path.join(VNDB_DIR, 'chars_traits'))) {
  const id = row[0].replace(/^c/, '');
  if (!traitsByChar.has(id)) traitsByChar.set(id, []);
  traitsByChar.get(id).push(row[1]);
}

function hairColorFromTraits(charId) {
  const names = new Set();
  for (const tid of traitsByChar.get(charId) || []) {
    if (ancestors(tid).has('i2')) names.add(traitNames.get(tid));
  }
  for (const [trait, cn, family] of HAIR_COLORS) {
    if (names.has(trait)) return [cn, family];
  }
  return null;
}

function hairLengthFromTraits(charId) {
  const names = new Set();
  for (const tid of traitsByChar.get(charId) || []) {
    if (ancestors(tid).has('i852')) names.add(traitNames.get(tid));
  }
  if (['Long', 'Waist Length+', 'Ankle Length'].some((name) => names.has(name))) return '长发';
  if (names.has('Shoulder-length')) return '中发';
  if (['Short', 'Bob Cut', 'Crew Cut', 'Spiky', 'Pixie Cut'].some((name) => names.has(name))) return '短发';
  return null;
}

const staffAliasRows = readTsv(path.join(VNDB_DIR, 'staff_alias'));
const staffNameByAliasId = new Map(staffAliasRows.map((row) => [row[1], row[2].trim()]));
const cvByVnChar = new Map();
const cvByChar = new Map();
for (const row of readTsv(path.join(VNDB_DIR, 'vn_seiyuu'))) {
  const vid = row[0].replace(/^v/, '');
  const cid = row[1].replace(/^c/, '');
  const aid = row[2];
  const key = `${vid}|${cid}`;
  if (!cvByVnChar.has(key)) cvByVnChar.set(key, aid);
  if (!cvByChar.has(cid)) cvByChar.set(cid, aid);
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

const rows = current.map((row, index) => {
  if (!YUZUSOFT_WORKS.has(row.work)) return row;

  const id = String(ids[index] ?? '');
  let matchedId = id.startsWith('bgm:') ? null : id;
  let vnId = null;

  if (id.startsWith('bgm:')) {
    const character = characterById.get(Number(id.slice(4)));
    const vnIds = workToVnIds.get(normalizeForMatch(row.work)) || new Set();
    vnId = [...vnIds][0] || null;
    const candidates = [...vnIds].flatMap((vid) => vnToCharIds.get(vid) || []);
    if (character) matchedId = matchVndbCharacter(character, candidates);
  }

  let gender = row.gender;
  let hairColor = row.hair_color;
  let hairFamily = row.hair_color_family;
  let hairLength = row.hair_length;
  let cv = row.cv;

  if (matchedId) {
    if (!['男', '女'].includes(gender)) {
      // Yuzusoft characters should already have a usable gender; keep Bangumi value as fallback.
      gender = gender || '未知';
    }
    if (hairFamily === 'unknown') {
      const color = hairColorFromTraits(matchedId);
      if (color) [hairColor, hairFamily] = color;
    }
    if (hairLength === '未知') {
      const length = hairLengthFromTraits(matchedId);
      if (length) hairLength = length;
    }
    if (cv === '未知') {
      const key = vnId ? `${vnId}|${matchedId}` : null;
      const aid = (key && cvByVnChar.get(key)) || cvByChar.get(matchedId);
      if (aid) {
        const staffName = staffNameByAliasId.get(aid);
        if (staffName) cv = staffName;
      }
    }
  }

  return {
    ...row,
    gender,
    cv,
    hair_color: hairColor,
    hair_color_family: hairFamily,
    hair_length: hairLength,
    difficulties: ['normal', 'easy', 'beginner'],
  };
});

const dryRun = process.argv.includes('--dry-run');
const target = dryRun ? '/private/tmp/characters-yuzusoft-preview.json' : DATA_PATH;
fs.writeFileSync(target, serialize(rows));

const yuzuRows = rows.filter((row) => YUZUSOFT_WORKS.has(row.work));
const incomplete = yuzuRows.filter((row) => !(
  ['男', '女'].includes(row.gender)
  && row.hair_color_family !== 'unknown'
  && row.hair_length !== '未知'
  && row.cv !== '未知'
  && row.writer !== '未知'
));

console.log(`yuzusoft rows: ${yuzuRows.length}`);
console.log(`yuzusoft beginner: ${yuzuRows.filter((row) => row.difficulties.includes('beginner')).length}`);
console.log(`yuzusoft incomplete after fill: ${incomplete.length}`);
for (const row of incomplete) {
  console.log(`${row.name}（${row.work}） cv=${row.cv} hair=${row.hair_color}/${row.hair_length}`);
}
console.log(`total beginner: ${rows.filter((row) => row.difficulties.includes('beginner')).length}`);
console.log(`total easy: ${rows.filter((row) => row.difficulties.includes('easy')).length}`);
console.log(dryRun ? 'dry-run only' : `written ${DATA_PATH}`);
