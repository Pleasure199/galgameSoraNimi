import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.vndb.org/kana';
const OUT = '/private/tmp/vndb-raw.json';

const VNS = [
  { id: 'v36', work: 'AIR', company: 'Key', year: 2000 },
  { id: 'v33', work: 'Kanon', company: 'Key', year: 1999 },
  { id: 'v4', work: 'CLANNAD', company: 'Key', year: 2004 },
  { id: 'v5', work: 'Little Busters!', company: 'Key', year: 2007 },
  { id: 'v751', work: 'Rewrite', company: 'Key', year: 2011 },
  { id: 'v13774', work: 'Angel Beats! (1st Beat)', company: 'Key', year: 2015 },
  { id: 'v34', work: 'planetarian ～星之梦～', company: 'Key', year: 2004 },
  { id: 'v20424', work: 'Summer Pockets', company: 'Key', year: 2018 },
  { id: 'v11', work: 'Fate/stay night', company: 'TYPE-MOON', year: 2004 },
  { id: 'v777', work: '魔法使之夜', company: 'TYPE-MOON', year: 2012 },
  { id: 'v7', work: '月姬', company: 'TYPE-MOON', year: 2000 },
  { id: 'v2002', work: 'STEINS;GATE', company: 'MAGES.', year: 2009 },
  { id: 'v97', work: '沙耶之歌', company: 'Nitroplus', year: 2003 },
  { id: 'v18', work: 'ToHeart', company: 'Leaf', year: 1997 },
  { id: 'v20', work: 'ToHeart2', company: 'Leaf', year: 2004 },
  { id: 'v3', work: '传颂之物', company: 'Leaf', year: 2002 },
  { id: 'v7721', work: '传颂之物 虚伪的假面', company: 'Aquaplus', year: 2015 },
  { id: 'v7771', work: 'WHITE ALBUM 2', company: 'Leaf', year: 2010 },
  { id: 'v236', work: 'WHITE ALBUM', company: 'Leaf', year: 1998 },
  { id: 'v28', work: 'SHUFFLE!', company: 'Navel', year: 2004 },
  { id: 'v264', work: '初音岛', company: 'CIRCUS', year: 2002 },
  { id: 'v266', work: '初音岛II', company: 'CIRCUS', year: 2006 },
  { id: 'v232', work: '夜明前的琉璃色', company: 'August', year: 2005 },
  { id: 'v87', work: 'FORTUNE ARTERIAL', company: 'August', year: 2008 },
  { id: 'v3770', work: '秽翼的尤斯蒂娅', company: 'August', year: 2011 },
  { id: 'v88', work: 'ef - a fairy tale of the two.', company: 'minori', year: 2006 },
  { id: 'v93', work: 'Muv-Luv', company: 'âge', year: 2003 },
  { id: 'v92', work: 'Muv-Luv Alternative', company: 'âge', year: 2006 },
  { id: 'v94', work: '你所期望的永远', company: 'âge', year: 2001 },
  { id: 'v5154', work: '灰色的果实', company: 'Frontwing', year: 2011 },
  { id: 'v7723', work: '灰色的迷宫', company: 'Frontwing', year: 2012 },
  { id: 'v67', work: '寒蝉鸣泣之时', company: '07th Expansion', year: 2002 },
  { id: 'v68', work: '寒蝉鸣泣之时', company: '07th Expansion', year: 2005 },
  { id: 'v69', work: '寒蝉鸣泣之时', company: '07th Expansion', year: 2006 },
  { id: 'v24', work: '海猫鸣泣之时', company: '07th Expansion', year: 2007 },
  { id: 'v2153', work: '海猫鸣泣之时', company: '07th Expansion', year: 2009 },
  { id: 'v1143', work: '认真和我谈恋爱!!', company: 'Minato Soft', year: 2009 },
  { id: 'v182', work: '青空下的约定', company: 'GIGA', year: 2006 },
  { id: 'v19829', work: '9-nine-九次九日九重色', company: 'PALETTE', year: 2017 },
  { id: 'v21668', work: '9-nine-天色天歌天籁音', company: 'PALETTE', year: 2018 },
  { id: 'v23740', work: '9-nine-春色春恋春熙风', company: 'PALETTE', year: 2019 },
  { id: 'v26523', work: '9-nine-雪色雪花雪之痕', company: 'PALETTE', year: 2020 },
];

async function query(endpoint, body, retries = 4) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(`${API}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        continue;
      }
      if (!res.ok) throw new Error(`${endpoint} ${res.status}: ${await res.text()}`);
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  throw new Error(`unreachable: ${endpoint}`);
}

async function fetchCharacters(vnId) {
  const chars = [];
  let page = 1;
  for (;;) {
    const data = await query('character', {
      filters: ['vn', '=', ['id', '=', vnId]],
      fields:
        'id,name,original,gender,sex,height,aliases,traits{id,name,group_name},vns{id,title,role,spoiler}',
      results: 100,
      page,
    });
    chars.push(...data.results);
    if (!data.more) break;
    page += 1;
    await new Promise((r) => setTimeout(r, 250));
  }
  return chars;
}

async function fetchVoiceActors(vnId) {
  const data = await query('vn', {
    filters: ['id', '=', vnId],
    fields: 'id,title,va{character.id,character.name,character.original,staff.id,staff.name,staff.original}',
    results: 1,
  });
  return data.results[0]?.va ?? [];
}

const out = [];
for (const vn of VNS) {
  const chars = await fetchCharacters(vn.id);
  const va = await fetchVoiceActors(vn.id);
  out.push({ ...vn, chars, va });
  console.log(
    `${vn.work} (${vn.id}): ${chars.length} characters, ${va.length} voice actors`
  );
  await new Promise((r) => setTimeout(r, 250));
}

fs.writeFileSync(OUT, JSON.stringify(out));
console.log(`written ${OUT}`);
