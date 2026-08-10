import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const ROOT = path.resolve(process.cwd());
const DATA_PATH = path.join(ROOT, 'server/data/characters.json');
const BANGUMI_DIR = process.env.BANGUMI_DIR || '/private/tmp/bgm';
const VNDB_DIR = process.env.VNDB_DIR || '/private/tmp/vndb-db/db';
const BEGINNER_SIZE = Number(process.env.BEGINNER_SIZE || 200);
const EASY_SIZE = Number(process.env.EASY_SIZE || 2000);
const POP_WEIGHT = Number(process.env.POP_WEIGHT || 0.5);
const FAME_WEIGHT = Number(process.env.FAME_WEIGHT || 0.4);
const RECENCY_WEIGHT = Number(process.env.RECENCY_WEIGHT || 0.1);

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

const log1p = (value) => Math.log1p(Math.max(0, Number(value) || 0));

function favoriteTotal(favorite) {
  if (!favorite || typeof favorite !== 'object') return 0;
  return Object.values(favorite).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function percentileRanks(values) {
  const ranks = new Array(values.length);
  const order = values
    .map((value, index) => [value, index])
    .sort((a, b) => b[0] - a[0]);
  order.forEach(([, index], rank) => {
    ranks[index] = values.length > 1
      ? ((values.length - 1 - rank) / (values.length - 1)) * 100
      : 100;
  });
  return ranks;
}

const current = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
const ids = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/data/characterIds.json'), 'utf8'));
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
const workSubjects = new Map();
for (const subject of subjects) {
  const vnId = vndbBySubject.get(subject.id);
  if (vnId) {
    for (const name of [subject.name_cn, subject.name, vnZhTitle.get(String(vnId))]) {
      if (!name) continue;
      const key = normalizeForMatch(name);
      if (!workToVnIds.has(key)) workToVnIds.set(key, new Set());
      workToVnIds.get(key).add(String(vnId));
    }
  }
  for (const name of [subject.name_cn, subject.name]) {
    if (!name) continue;
    const key = normalizeForMatch(name);
    if (!workSubjects.has(key)) workSubjects.set(key, []);
    workSubjects.get(key).push(subject);
  }
}

const vnStats = new Map();
for (const row of readTsv(path.join(VNDB_DIR, 'vn'))) {
  const vid = row[0].replace(/^v/, '');
  vnStats.set(vid, {
    votes: Number(row[4]) || 0,
    rating: Number(row[5]) || 0,
  });
}

const complete = [];
const popularityValues = [];
const fameValues = [];
const recencyValues = [];

for (let index = 0; index < current.length; index += 1) {
  const row = current[index];
  const id = String(ids[index] ?? '');
  const completeRow = ['男', '女'].includes(row.gender)
    && row.hair_color_family !== 'unknown'
    && row.hair_length !== '未知'
    && row.cv !== '未知'
    && row.writer !== '未知';
  if (!completeRow) continue;

  const workKey = normalizeForMatch(row.work);
  const workList = workSubjects.get(workKey) || [];
  const bangumiFavorites = workList.map((subject) => favoriteTotal(subject.favorite));
  const bangumiScores = workList.map((subject) => Number(subject.score) || 0);
  const bangumiFame = Math.max(0, ...bangumiFavorites);
  const bangumiScore = Math.max(0, ...bangumiScores);

  const vnIds = workToVnIds.get(workKey) || new Set();
  let vnVotes = 0;
  let vnRating = 0;
  for (const vnId of vnIds) {
    const stats = vnStats.get(vnId);
    if (!stats) continue;
    vnVotes = Math.max(vnVotes, stats.votes);
    vnRating = Math.max(vnRating, stats.rating);
  }

  const bgmId = id.startsWith('bgm:') ? Number(id.slice(4)) : null;
  const charCollects = bgmId ? (characterById.get(bgmId)?.collects || 0) : 0;

  const popularity = log1p(bangumiFame) + log1p(vnVotes) * 0.8 + log1p(charCollects) * 1.2;
  const fame = bangumiScore + vnRating / 100;
  const recency = row.release_year;

  complete.push({ index, row, popularity, fame, recency });
  popularityValues.push(popularity);
  fameValues.push(fame);
  recencyValues.push(recency);
}

const popularityRanks = percentileRanks(popularityValues);
const fameRanks = percentileRanks(fameValues);
const recencyRanks = percentileRanks(recencyValues);

const scored = complete.map((item, index) => ({
  ...item,
  score: popularityRanks[index] * POP_WEIGHT
    + fameRanks[index] * FAME_WEIGHT
    + recencyRanks[index] * RECENCY_WEIGHT,
})).sort((a, b) => b.score - a.score);

const difficultyByIndex = new Map(current.map((_, index) => [index, ['normal']]));
for (let index = 0; index < scored.length; index += 1) {
  if (index < BEGINNER_SIZE) {
    difficultyByIndex.set(scored[index].index, ['normal', 'easy', 'beginner']);
  } else if (index < EASY_SIZE) {
    difficultyByIndex.set(scored[index].index, ['normal', 'easy']);
  }
}

const rows = current.map((row, index) => ({
  ...row,
  difficulties: difficultyByIndex.get(index) || ['normal'],
}));

const dryRun = process.argv.includes('--dry-run');
const target = dryRun ? '/private/tmp/characters-reclass-preview.json' : DATA_PATH;
fs.writeFileSync(target, serialize(rows));

console.log(`total: ${rows.length}`);
console.log(`complete attribute rows: ${complete.length}`);
console.log(`beginner: ${rows.filter((row) => row.difficulties.includes('beginner')).length}`);
console.log(`easy: ${rows.filter((row) => row.difficulties.includes('easy')).length}`);
console.log(`normal: ${rows.filter((row) => row.difficulties.includes('normal')).length}`);
console.log('--- top 30 beginner ---');
const beginner = rows.filter((row) => row.difficulties.includes('beginner'));
for (const row of beginner.slice(0, 30)) console.log(`${row.name}（${row.work}）`);
console.log(dryRun ? 'dry-run only' : `written ${DATA_PATH}`);
