import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const ROOT = path.resolve(process.cwd());
const DATA_PATH = path.join(ROOT, 'server/data/characters.json');
const IDS_PATH = path.join(ROOT, 'server/data/characterIds.json');
const OVERRIDES_PATH = path.join(ROOT, 'server/data/characterNameOverrides.json');
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

const TRADITIONAL_CHARS =
  '門關體學見愛發長亞優麗圖國圓萬與無東車馬龍鳳蘭華葉遠遊變讀說話語認讓請這這個們會沒來為後點覺聽開間線紙紅綠藍黃雙對難詞書畫頭髮鬚鳥魚龍龜鬆響聲聞親觀覽師醫藥驗錢銀銅鐵鋼錫鉛鍾鈴讓請謝讚譴責購買賣';

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

function hasTraditional(value) {
  return [...String(value || '')].some((ch) => TRADITIONAL_CHARS.includes(ch));
}

function needsChineseName(value) {
  if (/[\u3040-\u30ff]/.test(value)) return true;
  if (!/[\u4e00-\u9fff\u3040-\u30ff]/.test(value)) return true;
  return hasTraditional(value);
}

const current = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const ids = JSON.parse(fs.readFileSync(IDS_PATH, 'utf8'));
const overrides = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'));

const subjects = (await readJsonLines(path.join(BANGUMI_DIR, 'subject.jsonlines')))
  .filter((subject) => subject.type === 4 && subject.date && gameTypeOf(subject));
const vndbBySubject = new Map();
for (const subject of subjects) {
  const match = (subject.infobox || '').match(/vndb\.org\/v(\d+)/i);
  if (match) vndbBySubject.set(subject.id, match[1]);
}
const characters = await readJsonLines(path.join(BANGUMI_DIR, 'character.jsonlines'));
const characterById = new Map(characters.map((character) => [character.id, character]));

const vnTitleRows = readTsv(path.join(VNDB_DIR, 'vn_titles'));
const vnZhTitle = new Map();
const vnZhHant = new Map();
for (const row of vnTitleRows) {
  const vid = row[0].replace(/^v/, '');
  const [, lang, official, title] = row;
  if (lang === 'zh-Hans' && title && /[\u4e00-\u9fff]/.test(title)) {
    if (!vnZhTitle.has(vid) || official === 't') vnZhTitle.set(vid, title.trim());
  }
  if (lang === 'zh-Hant' && title) {
    if (!vnZhHant.has(vid)) vnZhHant.set(vid, new Set());
    vnZhHant.get(vid).add(normalizeForMatch(title));
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
const vnCharRows = readTsv(path.join(VNDB_DIR, 'chars_vns'));

const vndbNames = new Map();
const vndbZhHans = new Map();
const vndbZhHant = new Map();
for (const row of nameRows) {
  const id = row[0].replace(/^c/, '');
  const [, lang, name, latin] = row;
  if (!vndbNames.has(id)) vndbNames.set(id, new Set());
  if (name) vndbNames.get(id).add(normalizeForMatch(name));
  if (latin) vndbNames.get(id).add(normalizeForMatch(latin));
  if (lang === 'zh-Hans' && name && /[\u4e00-\u9fff]/.test(name) && !vndbZhHans.has(id)) {
    vndbZhHans.set(id, name.trim());
  }
  if (lang === 'zh-Hant' && name) {
    if (!vndbZhHant.has(id)) vndbZhHant.set(id, new Set());
    vndbZhHant.get(id).add(normalizeForMatch(name));
  }
}
for (const row of aliasRows) {
  const id = row[0].replace(/^c/, '');
  const name = row[2];
  const latin = row[3];
  if (!vndbNames.has(id)) vndbNames.set(id, new Set());
  if (name) vndbNames.get(id).add(normalizeForMatch(name));
  if (latin) vndbNames.get(id).add(normalizeForMatch(latin));
}

const vnToCharIds = new Map();
for (const row of vnCharRows) {
  const cid = row[0].replace(/^c/, '');
  const vid = row[1].replace(/^v/, '');
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

const kept = [];
const keptIds = [];
const removedByWork = new Map();
for (let index = 0; index < current.length; index += 1) {
  const id = String(ids[index] ?? '');
  const found = !id.startsWith('bgm:')
    ? true
    : (workToVnIds.get(normalizeForMatch(current[index].work))?.size ?? 0) > 0;
  if (!found) {
    removedByWork.set(current[index].work, (removedByWork.get(current[index].work) || 0) + 1);
    continue;
  }
  kept.push(current[index]);
  keptIds.push(id);
}

const seenIdWork = new Set();
const dedupedKept = [];
const dedupedIds = [];
for (let index = 0; index < kept.length; index += 1) {
  const key = `${keptIds[index]}|${kept[index].work}`;
  if (seenIdWork.has(key)) continue;
  seenIdWork.add(key);
  dedupedKept.push(kept[index]);
  dedupedIds.push(keptIds[index]);
}

const keptWithMatch = dedupedKept.map((row, index) => {
  const id = String(dedupedIds[index] ?? '');
  if (!id.startsWith('bgm:')) return { row, matchedId: id };
  const character = characterById.get(Number(id.slice(4)));
  const vnIds = workToVnIds.get(normalizeForMatch(row.work)) || new Set();
  const candidates = [...vnIds].flatMap((vnId) => vnToCharIds.get(vnId) || []);
  const matchedId = character ? matchVndbCharacter(character, candidates) : null;
  return { row, matchedId };
});

const workCandidates = new Map();
for (const { row } of keptWithMatch) {
  const vnIds = workToVnIds.get(normalizeForMatch(row.work)) || new Set();
  if (vnIds.size !== 1) continue;
  const title = vnZhTitle.get([...vnIds][0]);
  if (title && needsChineseName(row.work)) {
    if (!workCandidates.has(row.work)) workCandidates.set(row.work, new Set());
    workCandidates.get(row.work).add(title);
  }
}

const workReplacements = new Map();
for (const [work, titles] of workCandidates) {
  if (titles.size === 1) workReplacements.set(work, [...titles][0]);
}

const seenNames = new Set();
let characterNameConverted = 0;
let workNameConverted = 0;
let zhCandidateRows = 0;
let zhCandidateDifferent = 0;
const rows = keptWithMatch.map(({ row, matchedId }, index) => {
  let name = row.name;
  const realId = String(dedupedIds[index] ?? '');
  const override = overrides[realId]?.name;
  if (override) {
    name = override;
  } else if (matchedId && vndbZhHans.has(matchedId)) {
    zhCandidateRows += 1;
    const zh = vndbZhHans.get(matchedId);
    if (needsChineseName(name) && zh !== name) {
      zhCandidateDifferent += 1;
      name = zh;
      characterNameConverted += 1;
    }
  }

  let work = row.work;
  const replacement = workReplacements.get(work);
  if (replacement && replacement !== work) {
    work = replacement;
    workNameConverted += 1;
  }

  if (seenNames.has(name)) {
    let candidate = `${name} (${work})`;
    let suffix = 2;
    while (seenNames.has(candidate)) candidate = `${name} (${work} ${suffix++})`;
    name = candidate;
  }
  seenNames.add(name);

  return { ...row, name, work };
});

const dryRun = process.argv.includes('--dry-run');
const target = dryRun ? '/private/tmp/characters-filtered-preview.json' : DATA_PATH;
fs.writeFileSync(target, serialize(rows));
if (!dryRun) {
  fs.writeFileSync(IDS_PATH, JSON.stringify(dedupedIds, null, 2) + '\n');
}

console.log(`total: ${current.length}`);
console.log(`kept: ${rows.length}`);
console.log(`removed by vndb filter: ${current.length - kept.length}`);
console.log(`removed duplicate rows: ${kept.length - dedupedKept.length}`);
console.log(`removed total: ${current.length - rows.length}`);
console.log(`removed works: ${removedByWork.size}`);
console.log(`character names converted: ${characterNameConverted}`);
console.log(`zh candidate rows: ${zhCandidateRows}`);
console.log(`zh candidate different: ${zhCandidateDifferent}`);
console.log(`work names converted: ${workNameConverted}`);
console.log(`unique names: ${new Set(rows.map((row) => row.name)).size}`);
console.log(`duplicate names: ${rows.map((row) => row.name).filter((name, index, all) => all.indexOf(name) !== index).length}`);
console.log(dryRun ? 'dry-run only' : `written ${DATA_PATH} and ${IDS_PATH}`);
