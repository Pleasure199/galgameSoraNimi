import fs from 'node:fs';
import readline from 'node:readline';
import pg from 'pg';
import { DATABASE_URL } from './dbUrl.mjs';

const BGM_DIR = process.env.BGM_DIR || '/private/tmp/bgm2';

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[\s'’\-・〜～!！?？:：()（）\[\]【】.…_＊*]/g, '');
}

function field(infobox, key) {
  const match = infobox.match(new RegExp(`\\|${key}=\\s*([^|\\n\\r}]+)`));
  return match ? match[1].trim() : '';
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  const subjectByTitle = new Map();
  const subjectLines = readline.createInterface({
    input: fs.createReadStream(`${BGM_DIR}/subject.jsonlines`),
    crlfDelay: Infinity,
  });
  subjectLines.on('line', (line) => {
    try {
      const subject = JSON.parse(line);
      if (subject.type !== 4) return;
      for (const title of [subject.name, subject.name_cn]) {
        const key = normalize(title);
        if (!key) continue;
        if (!subjectByTitle.has(key)) subjectByTitle.set(key, []);
        subjectByTitle.get(key).push(subject.id);
      }
    } catch {
      // Ignore malformed archive lines.
    }
  });
  await new Promise((resolve) => subjectLines.on('close', resolve));

  const characterBySubject = new Map();
  const subjectCharLines = readline.createInterface({
    input: fs.createReadStream(`${BGM_DIR}/subject-characters.jsonlines`),
    crlfDelay: Infinity,
  });
  subjectCharLines.on('line', (line) => {
    try {
      const row = JSON.parse(line);
      if (!characterBySubject.has(row.subject_id)) characterBySubject.set(row.subject_id, []);
      characterBySubject.get(row.subject_id).push(row.character_id);
    } catch {
      // Ignore malformed archive lines.
    }
  });
  await new Promise((resolve) => subjectCharLines.on('close', resolve));

  const bangumiChars = new Map();
  const characterLines = fs.readFileSync(`${BGM_DIR}/character.jsonlines`, 'utf8').split('\n');
  for (const line of characterLines) {
    if (!line) continue;
    try {
      const character = JSON.parse(line);
      const cn = field(character.infobox || '', '简体中文名');
      if (!cn) continue;
      bangumiChars.set(character.id, {
        id: character.id,
        name: character.name || '',
        cn,
        jp: field(character.infobox || '', '日文名') || character.name || '',
        roman: field(character.infobox || '', '罗马字') || '',
      });
    } catch {
      // Ignore malformed archive lines.
    }
  }

  const [vnTitlesRes, charsNamesRes, charsVnsRes] = await Promise.all([
    client.query('select id, lang, title from vndb.vn_titles'),
    client.query('select id, lang, name, latin from vndb.chars_names'),
    client.query('select id, vid from vndb.chars_vns'),
  ]);

  const vnSubjects = new Map();
  for (const row of vnTitlesRes.rows) {
    const subjectIds = subjectByTitle.get(normalize(row.title));
    if (!subjectIds) continue;
    for (const subjectId of subjectIds) {
      if (!vnSubjects.has(row.id)) vnSubjects.set(row.id, new Set());
      vnSubjects.get(row.id).add(subjectId);
    }
  }

  const vnsByChar = new Map();
  for (const row of charsVnsRes.rows) {
    if (!vnsByChar.has(row.id)) vnsByChar.set(row.id, []);
    vnsByChar.get(row.id).push(row.vid);
  }

  const jaNames = new Map();
  const romanNames = new Map();
  for (const row of charsNamesRes.rows) {
    if (row.lang === 'ja') {
      if (!jaNames.has(row.id)) jaNames.set(row.id, []);
      jaNames.get(row.id).push(row.name);
      if (row.latin && !romanNames.has(row.id)) romanNames.set(row.id, row.latin);
    }
  }

  const bangumiByName = new Map();
  for (const character of bangumiChars.values()) {
    const jpKey = normalize(character.jp);
    if (jpKey) {
      if (!bangumiByName.has(jpKey)) bangumiByName.set(jpKey, []);
      bangumiByName.get(jpKey).push(character);
    }
    const romanKey = normalize(character.roman);
    if (romanKey) {
      if (!bangumiByName.has(romanKey)) bangumiByName.set(romanKey, []);
      bangumiByName.get(romanKey).push(character);
    }
  }

  const found = new Map();
  const seenChars = new Set();
  for (const charId of jaNames.keys()) {
    const vnIds = vnsByChar.get(charId) || [];
    const subjectIds = new Set();
    for (const vnId of vnIds) {
      for (const subjectId of vnSubjects.get(vnId) || []) subjectIds.add(subjectId);
    }
    const candidates = [];
    for (const subjectId of subjectIds) {
      for (const bangumiId of characterBySubject.get(subjectId) || []) {
        const character = bangumiChars.get(bangumiId);
        if (character) candidates.push(character);
      }
    }
    if (!candidates.length || seenChars.has(charId)) continue;
    const jaList = jaNames.get(charId) || [];
    const roman = romanNames.get(charId) || '';
    const matched = [];
    for (const character of candidates) {
      if (jaList.some((name) => normalize(name) === normalize(character.jp))) {
        matched.push(character);
      } else if (roman && normalize(roman) === normalize(character.roman)) {
        matched.push(character);
      }
    }
    const unique = new Map();
    for (const character of matched) {
      if (!unique.has(character.cn)) unique.set(character.cn, character);
    }
    if (unique.size === 1) {
      const [cn, character] = [...unique.entries()][0];
      found.set(charId, { cn, source: character.id });
      seenChars.add(charId);
    }
  }

  let inserted = 0;
  for (const [charId, entry] of found) {
    const result = await client.query(
      `insert into character_name_overrides (vndb_id, name, source)
       values ($1, $2, 'Bangumi 简体中文名')
       on conflict (vndb_id) do nothing`,
      [charId, entry.cn]
    );
    inserted += result.rowCount ?? 0;
  }

  console.log(`bangumi cn candidates: ${bangumiChars.size}`);
  console.log(`matched vndb characters: ${found.size}`);
  console.log(`inserted overrides: ${inserted}`);
  for (const id of ['c44768', 'c44769', 'c44770', 'c44771', 'c44772', 'c44773']) {
    const row = found.get(id);
    console.log(id, row?.cn ?? '(not found)');
  }
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
