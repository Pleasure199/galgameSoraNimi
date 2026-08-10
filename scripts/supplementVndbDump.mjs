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
  return value.split('/')[0].replace(/\s+/g, '').trim() || '未知';
}

function normalizeName(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function simplifyNameList(value, personNameCn) {
  return String(value || '')
    .split(/[、,，；;\/\n]/)
    .map((part) => {
      const bare = part.split(/[（(]/)[0].trim();
      return personNameCn.get(normalizeName(bare)) || personNameCn.get(normalizeName(part)) || bare;
    })
    .filter(Boolean)
    .join('、');
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
const overrides = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'));

const subjects = await readJsonLines(path.join(BANGUMI_DIR, 'subject.jsonlines'));
const subjectChars = await readJsonLines(path.join(BANGUMI_DIR, 'subject-characters.jsonlines'));
const characters = await readJsonLines(path.join(BANGUMI_DIR, 'character.jsonlines'));
const persons = await readJsonLines(path.join(BANGUMI_DIR, 'person.jsonlines'));
const personChars = await readJsonLines(path.join(BANGUMI_DIR, 'person-characters.jsonlines'));

const personById = new Map(persons.map((person) => [person.id, person]));
const personNameCn = new Map();
for (const person of persons) {
  const infobox = person.infobox || '';
  const cn = field(infobox, '简体中文名') || person.name;
  for (const name of [person.name, field(infobox, '日文名'), field(infobox, '别名')]) {
    if (name) personNameCn.set(normalizeName(name), cn);
  }
}
const personCharacters = new Map();
for (const link of personChars) {
  if (!personCharacters.has(link.character_id)) personCharacters.set(link.character_id, []);
  personCharacters.get(link.character_id).push(link.person_id);
}

function cvFromPerson(characterId) {
  const personIds = personCharacters.get(Number(characterId)) || [];
  const people = personIds
    .map((personId) => personById.get(personId))
    .filter(Boolean);
  const voiceActors = people.filter((person) => (person.career || []).includes('seiyu'));
  const pool = voiceActors.length ? voiceActors : people;
  for (const person of pool) {
    const cn = field(person.infobox || '', '简体中文名') || person.name;
    return normalizeName(cn);
  }
  return null;
}

const selectedSubjects = subjects.filter((subject) => (
  subject.type === 4 && subject.date && gameTypeOf(subject)
));
const subjectById = new Map(selectedSubjects.map((subject) => [subject.id, subject]));
const characterById = new Map(characters.map((character) => [character.id, character]));
const subjectByCharacterId = new Map();
const selectedSubjectIds = new Set(selectedSubjects.map((subject) => subject.id));
for (const link of subjectChars) {
  if (!selectedSubjectIds.has(link.subject_id)) continue;
  if (!subjectByCharacterId.has(link.character_id)) {
    subjectByCharacterId.set(link.character_id, link.subject_id);
  }
}

const vndbVnBySubject = new Map();
for (const subject of selectedSubjects) {
  const match = (subject.infobox || '').match(/vndb\.org\/v(\d+)/i);
  if (match) vndbVnBySubject.set(subject.id, match[1]);
}

const workWriter = new Map();
for (const subject of selectedSubjects) {
  const writer = writerOf(subject);
  for (const key of [subject.name_cn, subject.name]) {
    if (key) workWriter.set(key, writer);
  }
}

const charRows = readTsv(path.join(VNDB_DIR, 'chars'));
const nameRows = readTsv(path.join(VNDB_DIR, 'chars_names'));
const aliasRows = readTsv(path.join(VNDB_DIR, 'chars_alias'));
const traitRows = readTsv(path.join(VNDB_DIR, 'chars_traits'));
const vnCharRows = readTsv(path.join(VNDB_DIR, 'chars_vns'));
const traits = readTsv(path.join(VNDB_DIR, 'traits'));
const traitParents = readTsv(path.join(VNDB_DIR, 'traits_parents'));
const seiyuuRows = readTsv(path.join(VNDB_DIR, 'vn_seiyuu'));
const staffRows = readTsv(path.join(VNDB_DIR, 'staff'));
const staffAliasRows = readTsv(path.join(VNDB_DIR, 'staff_alias'));

const charBasic = new Map();
for (const row of charRows) {
  const id = row[0].replace(/^c/, '');
  const sex = row[4] === 'f' ? 'f' : row[4] === 'm' ? 'm' : row[6] === 'f' ? 'f' : row[6] === 'm' ? 'm' : null;
  if (sex) charBasic.set(id, sex);
}

const vndbNames = new Map();
const vndbZh = new Map();
for (const row of nameRows) {
  const id = row[0].replace(/^c/, '');
  const [, lang, name, latin] = row;
  if (!vndbNames.has(id)) vndbNames.set(id, new Set());
  if (name) vndbNames.get(id).add(normalizeForMatch(name));
  if (latin) vndbNames.get(id).add(normalizeForMatch(latin));
  if (lang === 'zh-Hans' && name && !vndbZh.has(id)) vndbZh.set(id, name.trim());
}
for (const row of aliasRows) {
  const id = row[0].replace(/^c/, '');
  const name = row[2];
  const latin = row[3];
  if (!vndbNames.has(id)) vndbNames.set(id, new Set());
  if (name) vndbNames.get(id).add(normalizeForMatch(name));
  if (latin) vndbNames.get(id).add(normalizeForMatch(latin));
}

const traitNames = new Map();
for (const row of traits) traitNames.set(row[0], row[7]);
const parentOf = new Map();
for (const row of traitParents) parentOf.set(row[0], row[1]);
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
for (const row of traitRows) {
  const id = row[0].replace(/^c/, '');
  const tid = row[1];
  if (!traitsByChar.has(id)) traitsByChar.set(id, []);
  traitsByChar.get(id).push(tid);
}

function hairColorFromTraits(charId) {
  const ids = traitsByChar.get(charId) || [];
  const names = new Set();
  for (const tid of ids) {
    if (ancestors(tid).has('i2')) names.add(traitNames.get(tid));
  }
  for (const [trait, cn, family] of HAIR_COLORS) {
    if (names.has(trait)) return [cn, family];
  }
  return null;
}

function hairLengthFromTraits(charId) {
  const ids = traitsByChar.get(charId) || [];
  const names = new Set();
  for (const tid of ids) {
    if (ancestors(tid).has('i852')) names.add(traitNames.get(tid));
  }
  if (['Long', 'Waist Length+', 'Ankle Length'].some((name) => names.has(name))) return '长发';
  if (names.has('Shoulder-length')) return '中发';
  if (['Short', 'Bob Cut', 'Crew Cut', 'Spiky', 'Pixie Cut'].some((name) => names.has(name))) return '短发';
  return null;
}

const vnToCharIds = new Map();
for (const row of vnCharRows) {
  const cid = row[0].replace(/^c/, '');
  const vid = row[1].replace(/^v/, '');
  if (!vnToCharIds.has(vid)) vnToCharIds.set(vid, []);
  vnToCharIds.get(vid).push(cid);
}

const staffNameByAliasId = new Map();
for (const row of staffAliasRows) staffNameByAliasId.set(row[1], row[2].trim());

const cvByVnChar = new Map();
const cvByChar = new Map();
for (const row of seiyuuRows) {
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

const seenNames = new Set();
let matchedRows = 0;
let zhNameFilled = 0;
const rows = current.map((row, index) => {
  const id = String(ids[index] ?? '');
  let name = row.name;
  let writer = row.writer || workWriter.get(row.work) || '未知';
  let gender = row.gender;
  let cv = row.cv;
  let hairColor = row.hair_color;
  let hairFamily = row.hair_color_family;
  let hairLength = row.hair_length || '未知';
  let matchedId = null;
  let matchedVn = null;
  let subjectId = null;

  if (id.startsWith('bgm:')) {
    const bgmId = Number(id.slice(4));
    const character = characterById.get(bgmId);
    subjectId = subjectByCharacterId.get(bgmId);
    if (character) {
      const infobox = character.infobox || '';
      name = field(infobox, '简体中文名') || name;
      gender = !['男', '女'].includes(gender) ? field(infobox, '性别') || gender : gender;
      cv = cv === '未知' ? (cvFromPerson(id.slice(4)) || cvOf(character)) : cv;
      const [bgmHair, bgmFamily] = hairOf(field(infobox, '发色'));
      if (hairFamily === 'unknown') {
        hairColor = bgmHair;
        hairFamily = bgmFamily;
      }
    }
    if (subjectId) {
      matchedVn = vndbVnBySubject.get(subjectId) || null;
      const candidates = matchedVn ? vnToCharIds.get(String(matchedVn)) || [] : [];
      const matched = character ? matchVndbCharacter(character, candidates) : null;
      if (matched) {
        matchedId = matched;
        matchedRows += 1;
      }
    }
  } else {
    if (overrides[id]?.name) name = overrides[id].name;
    matchedId = id;
    matchedRows += 1;
  }

  if (matchedId) {
    const sex = charBasic.get(matchedId);
    if (sex && !['男', '女'].includes(gender)) gender = sex === 'f' ? '女' : '男';
    if (hairFamily === 'unknown') {
      const color = hairColorFromTraits(matchedId);
      if (color) [hairColor, hairFamily] = color;
    }
    if (hairLength === '未知') {
      const length = hairLengthFromTraits(matchedId);
      if (length) hairLength = length;
    }
    if (cv === '未知') {
      const key = matchedVn ? `${matchedVn}|${matchedId}` : null;
      const aid = (key && cvByVnChar.get(key)) || cvByChar.get(matchedId);
      if (aid) {
        const staffName = staffNameByAliasId.get(aid);
        if (staffName) cv = staffName;
      }
    }
    if (/[\u3040-\u30ff]/.test(name)) {
      const zh = vndbZh.get(matchedId);
      if (zh && zh !== name) {
        name = zh;
        zhNameFilled += 1;
      }
    }
  }

  if (subjectId && subjectById.has(subjectId)) writer = writerOf(subjectById.get(subjectId));
  writer = simplifyNameList(writer, personNameCn);
  cv = simplifyNameList(cv, personNameCn);
  const company = simplifyNameList(row.company, personNameCn);

  if (seenNames.has(name)) {
    let candidate = `${name} (${row.work})`;
    let suffix = 2;
    while (seenNames.has(candidate)) candidate = `${name} (${row.work} ${suffix++})`;
    name = candidate;
  }
  seenNames.add(name);

  return {
    name,
    work: row.work,
    company,
    release_year: row.release_year,
    gender: gender === '未知' ? '未知' : gender,
    cv,
    hair_color: hairColor,
    hair_color_family: hairFamily,
    hair_length: hairLength,
    writer,
    difficulties: row.difficulties,
  };
});

const duplicateNames = rows
  .map((row) => row.name)
  .filter((name, index, all) => all.indexOf(name) !== index);

const dryRun = process.argv.includes('--dry-run');
const target = dryRun ? '/private/tmp/characters-vndb-preview.json' : DATA_PATH;
fs.writeFileSync(target, serialize(rows));

console.log(`total: ${rows.length}`);
console.log(`unique names: ${new Set(rows.map((row) => row.name)).size}`);
console.log(`duplicate names: ${duplicateNames.length}`);
console.log(`vndb matched rows: ${matchedRows}`);
console.log(`zh name filled: ${zhNameFilled}`);
console.log(`writer known: ${rows.filter((row) => row.writer !== '未知').length}`);
console.log(`cv known: ${rows.filter((row) => row.cv !== '未知').length}`);
console.log(`hair known: ${rows.filter((row) => row.hair_color_family !== 'unknown').length}`);
console.log(`hair length known: ${rows.filter((row) => row.hair_length !== '未知').length}`);
console.log(`gender known: ${rows.filter((row) => ['男', '女'].includes(row.gender)).length}`);
console.log(`written ${target}`);
