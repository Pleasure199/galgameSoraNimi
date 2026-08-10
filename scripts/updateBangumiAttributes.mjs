import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const ROOT = path.resolve(process.cwd());
const DATA_PATH = path.join(ROOT, 'server/data/characters.json');
const IDS_PATH = path.join(ROOT, 'server/data/characterIds.json');
const OVERRIDES_PATH = path.join(ROOT, 'server/data/characterNameOverrides.json');
const BANGUMI_DIR = process.env.BANGUMI_DIR || '/private/tmp/bgm';
const VNDB_RAW_PATH = process.env.VNDB_RAW_PATH || '/private/tmp/vndb-raw.json';
const VNDB_CHARS_PATH = process.env.VNDB_CHARS_PATH || '/private/tmp/vndb-chars.jsonl';
const VNDB_VNS_PATH = process.env.VNDB_VNS_PATH || '/private/tmp/vndb-vns.jsonl';

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

function matchVndbCharacter(character, candidates) {
  const bgmNames = bangumiNames(character);
  if (!bgmNames.length || !candidates.length) return null;

  const exactOriginal = candidates.filter((candidate) => (
    candidate.original && bgmNames.includes(normalizeForMatch(candidate.original))
  ));
  if (exactOriginal.length === 1) return exactOriginal[0];
  if (exactOriginal.length > 1) return null;

  const exactName = candidates.filter((candidate) => {
    const vndbNames = [candidate.name, ...(candidate.aliases || [])].map(normalizeForMatch);
    return vndbNames.some((name) => bgmNames.includes(name));
  });
  return exactName.length === 1 ? exactName[0] : null;
}

function vndbHair(char) {
  const names = new Set(
    (char.traits || [])
      .filter((trait) => trait.group_name === 'Hair')
      .map((trait) => trait.name)
  );
  const colors = [
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
  for (const [trait, cn, family] of colors) {
    if (names.has(trait)) return [cn, family];
  }
  return ['未知', 'unknown'];
}

function vndbHairLength(char) {
  const names = new Set(
    (char.traits || [])
      .filter((trait) => trait.group_name === 'Hair')
      .map((trait) => trait.name)
  );
  if (['Long', 'Waist Length+', 'Ankle Length'].some((name) => names.has(name))) return '长发';
  if (names.has('Shoulder-length')) return '中发';
  if (['Short', 'Bob Cut', 'Crew Cut', 'Spiky'].some((name) => names.has(name))) return '短发';
  return '未知';
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

const vndbCharById = new Map();
const vndbCvById = new Map();
if (fs.existsSync(VNDB_CHARS_PATH)) {
  for (const char of await readJsonLines(VNDB_CHARS_PATH)) {
    const id = char.id.replace(/^c/, '');
    if (!vndbCharById.has(id)) vndbCharById.set(id, char);
  }
}
if (fs.existsSync(VNDB_VNS_PATH)) {
  for (const vn of await readJsonLines(VNDB_VNS_PATH)) {
    for (const entry of vn.va || []) {
      const id = entry.character.id.replace(/^c/, '');
      if (!vndbCvById.has(id)) {
        vndbCvById.set(id, (entry.staff.original || entry.staff.name || '未知').replace(/\s+/g, ''));
      }
    }
  }
}

const vndbRaw = fs.existsSync(VNDB_RAW_PATH)
  ? JSON.parse(fs.readFileSync(VNDB_RAW_PATH, 'utf8'))
  : [];
for (const vn of vndbRaw) {
  for (const entry of vn.va || []) {
    const id = entry.character.id.replace(/^c/, '');
    if (!vndbCvById.has(id)) {
      vndbCvById.set(id, (entry.staff.original || entry.staff.name || '未知').replace(/\s+/g, ''));
    }
  }
  for (const char of vn.chars || []) {
    const id = char.id.replace(/^c/, '');
    if (!vndbCharById.has(id)) vndbCharById.set(id, char);
  }
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

const vnToCharIds = new Map();
for (const [id, char] of vndbCharById) {
  for (const vn of char.vns || []) {
    const vnId = vn.id.replace(/^v/, '');
    if (!vnToCharIds.has(vnId)) vnToCharIds.set(vnId, []);
    vnToCharIds.get(vnId).push(id);
  }
}

const workWriter = new Map();
for (const subject of selectedSubjects) {
  const writer = writerOf(subject);
  for (const key of [subject.name_cn, subject.name]) {
    if (key) workWriter.set(key, writer);
  }
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

const seenNames = new Set();
let matchedVndb = 0;
const rows = current.map((row, index) => {
  const id = String(ids[index] ?? '');
  let name = row.name;
  let writer = row.writer || workWriter.get(row.work) || '未知';
  let gender = row.gender;
  let cv = row.cv;
  let hairColor = row.hair_color;
  let hairFamily = row.hair_color_family;
  let hairLength = row.hair_length || '未知';

  if (id.startsWith('bgm:')) {
    const character = characterById.get(Number(id.slice(4)));
    const subjectId = subjectByCharacterId.get(Number(id.slice(4)));
    if (character) {
      const infobox = character.infobox || '';
      name = field(infobox, '简体中文名') || name;
      gender = gender === '未知' ? field(infobox, '性别') || gender : gender;
      cv = cv === '未知' ? (cvFromPerson(id.slice(4)) || cvOf(character)) : cv;
      const [bgmHair, bgmFamily] = hairOf(field(infobox, '发色'));
      if (hairFamily === 'unknown') {
        hairColor = bgmHair;
        hairFamily = bgmFamily;
      }
    }
    if (subjectId && subjectById.has(subjectId)) {
      writer = writerOf(subjectById.get(subjectId));
    }
    if (character && subjectId) {
      const vndbId = vndbVnBySubject.get(subjectId);
      const candidates = (vndbId ? vnToCharIds.get(String(vndbId)) || [] : [])
        .map((charId) => vndbCharById.get(charId))
        .filter(Boolean);
      const matched = matchVndbCharacter(character, candidates);
      if (matched) {
        matchedVndb += 1;
        gender = !['男', '女'].includes(gender) && matched.gender?.[0] === 'm' ? '男'
          : !['男', '女'].includes(gender) && matched.gender?.[0] === 'f' ? '女'
            : gender;
        if (hairFamily === 'unknown') [hairColor, hairFamily] = vndbHair(matched);
        if (hairLength === '未知') hairLength = vndbHairLength(matched);
        if (cv === '未知') cv = vndbCvById.get(matched.id.replace(/^c/, '')) || '未知';
      }
    }
  } else {
    if (overrides[id]?.name) name = overrides[id].name;
    const vndb = vndbCharById.get(id);
    if (vndb) {
      matchedVndb += 1;
      gender = !['男', '女'].includes(gender) && vndb.gender?.[0] === 'm' ? '男'
        : !['男', '女'].includes(gender) && vndb.gender?.[0] === 'f' ? '女'
          : gender;
      if (hairFamily === 'unknown') [hairColor, hairFamily] = vndbHair(vndb);
      if (hairLength === '未知') hairLength = vndbHairLength(vndb);
      if (cv === '未知') cv = vndbCvById.get(id) || '未知';
    }
  }

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
const target = dryRun ? '/private/tmp/characters-updated-preview.json' : DATA_PATH;
fs.writeFileSync(target, serialize(rows));

console.log(`total: ${rows.length}`);
console.log(`unique names: ${new Set(rows.map((row) => row.name)).size}`);
console.log(`duplicate names: ${duplicateNames.length}`);
console.log(`writer known: ${rows.filter((row) => row.writer !== '未知').length}`);
console.log(`cv known: ${rows.filter((row) => row.cv !== '未知').length}`);
console.log(`hair known: ${rows.filter((row) => row.hair_color_family !== 'unknown').length}`);
console.log(`vndb matched rows: ${matchedVndb}`);
console.log(`written ${target}`);
