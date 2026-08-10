import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const ROOT = path.resolve(process.cwd());
const LEGACY_CHARACTERS_PATH = path.join(ROOT, 'server/data/characters.json');
const LEGACY_IDS_PATH = path.join(ROOT, 'server/data/characterIds.json');
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://tianyiba:tianyiba@127.0.0.1:5432/tianyiba';
const DATA_VERSION = 'vndb-2026-08-07';

const COLOR_MAP = {
  Black: ['黑色', 'black'],
  Brown: ['棕色', 'brown'],
  Blond: ['金色', 'blond'],
  Red: ['红色', 'red'],
  Blue: ['蓝色', 'blue'],
  Grey: ['灰色', 'gray'],
  Violet: ['紫色', 'purple'],
  Green: ['绿色', 'green'],
  White: ['白色', 'white'],
  Orange: ['橙色', 'orange'],
  Pink: ['粉色', 'pink'],
  Teal: ['青色', 'cyan'],
  Claret: ['酒红', 'red'],
  Yellow: ['黄色', 'yellow'],
};

const LONG = new Set(['Long', 'Waist Length+', 'Ankle Length']);
const MED = new Set(['Shoulder-length']);
const SHORT = new Set(['Short', 'Bob Cut', 'Crew Cut', 'Spiky']);
const ROLE_PRIORITY = { main: 0, primary: 1, side: 2, appears: 3 };
const WEIRD_PATTERNS = [
  /[?？]/,
  /主人公|男主角|女主角|店主|店长|男孩|女孩|未知的|人类女孩|金发小女孩|好奇的小女孩|陌生女孩/,
  /X先生|Y先生|Z先生|X女士|凌女士|渡边先生|维尔米拉女士|维度销售女士|龙农场女孩|熊女孩/,
  /^Protagonist$/i,
  /^Hero$/i,
];
const JP2CN = {
  '観': '观', '鈴': '铃', '遙': '遥', '澤': '泽', '沢': '泽', '宮': '宫', '島': '岛',
  '園': '园', '風': '风', '東': '东', '馬': '马', '鳥': '鸟', '鶴': '鹤', '龍': '龙',
  '竜': '龙', '亀': '龟', '姫': '姬', '瀬': '濑', '瀨': '濑', '黒': '黑', '両': '两', '塚': '冢',
  '恵': '惠', '桜': '樱', '鉄': '铁', '絆': '绊', '飛': '飞', '薫': '薰', '菫': '堇',
  '霧': '雾', '聖': '圣', '衛': '卫', '樹': '树', '岡': '冈', '絵': '绘', '縁': '缘',
  '綾': '绫', '純': '纯', '鳴': '鸣', '倉': '仓', '響': '响', '駆': '驱', '葉': '叶',
  '呂': '吕', '鉄': '铁',
  '萩': '荻', '苺': '莓', '雛': '雏', '瑠': '琉', '璃': '璃', '浜': '滨', '濱': '滨',
  '邊': '边', '峯': '峰', '嶋': '岛', '渕': '渊', '髙': '高', '圓': '圆', '図': '图',
  '団': '团', '囲': '围', '増': '增', '応': '应', '広': '广', '拡': '扩', '層': '层',
  '円': '圆', '遼': '辽', '聡': '聪', '顯': '显', '賢': '贤', '貢': '贡', '豊': '丰',
  '勝': '胜', '優': '优', '華': '华', '蓮': '莲', '穂': '穗', '稲': '稻', '麦': '麦',
  '穀': '谷', '黙': '默', '兎': '兔', '魚': '鱼', '鯨': '鲸', '鯉': '鲤', '鮎': '鲇',
  '鮭': '鲑', '鰻': '鳗', '鮪': '鲔', '鱈': '鳕', '鶏': '鸡', '鳩': '鸠', '鴨': '鸭',
  '鷹': '鹰', '鳶': '鸢', '鴉': '鸦', '鷲': '鹫', '貝': '贝', '蛍': '萤', '蝶': '蝶',
  '蜂': '蜂', '蟻': '蚁', '蚊': '蚊', '巻': '卷', '畫': '画', '書': '书', '語': '语',
  '読': '读', '説': '说', '談': '谈', '論': '论', '議': '议', '譯': '译', '訳': '译',
  '話': '话', '詩': '诗', '詞': '词', '調': '调', '試': '试', '誤': '误', '誘': '诱',
  '譜': '谱', '護': '护', '識': '识', '変': '变', '計': '计', '記': '记', '討': '讨',
  '訓': '训', '診': '诊', '註': '注', '証': '证', '評': '评', '誕': '诞', '謝': '谢',
  '謹': '谨', '謎': '谜', '謙': '谦', '講': '讲', '譲': '让', '讀': '读', '驗': '验',
  '驚': '惊', '髪': '发', '髮': '发', '體': '体', '門': '门', '窓': '窗', '戸': '户',
  '車': '车', '剣': '剑', '劍': '剑', '槍': '枪', '鎧': '铠', '帯': '带', '鈴': '铃',
  '鐘': '钟', '楽': '乐', '唄': '呗', '謡': '谣', '踊': '踊', '藝': '艺', '術': '术',
  '徳': '德', '節': '节', '操': '操', '禪': '禅', '夢': '梦', '戀': '恋', '愛': '爱',
  '覺': '觉', '報': '报', '敵': '敌', '親': '亲', '孫': '孙', '従': '从', '僕': '仆',
  '聖': '圣', '児': '儿', '経': '经', '結': '结', '続': '续', '絶': '绝', '総': '总',
  '緑': '绿', '網': '网', '線': '线', '練': '练', '編': '编', '綺': '绮', '挙': '举',
  '舊': '旧', '薬': '药', '様': '样', '機': '机', '権': '权', '検': '检', '構': '构',
  '歳': '岁', '歴': '历', '殺': '杀', '満': '满', '災': '灾', '煙': '烟', '熱': '热',
  '為': '为', '與': '与', '興': '兴', 'の': '之', '々': '々',
};

function genderOf(sex, gender) {
  const raw = sex || gender || '';
  if (raw === 'm') return '男';
  if (raw === 'f') return '女';
  if (raw === 'b' || raw === 'n' || raw === 'o' || raw === 'a') return '其他';
  return '未知';
}

function hairOf(traitNames) {
  for (const [en, cn] of Object.entries(COLOR_MAP)) {
    if (traitNames.has(en)) return cn;
  }
  return ['未知', 'unknown'];
}

function hairLengthOf(traitNames) {
  if ([...LONG].some((name) => traitNames.has(name))) return '长发';
  if ([...MED].some((name) => traitNames.has(name))) return '中发';
  if ([...SHORT].some((name) => traitNames.has(name))) return '短发';
  return '未知';
}

async function main() {
  const { Converter } = await import('opencc-js');
  const opencc = Converter({ from: 'tw', to: 'cn' });
  const simplifyName = (value) => [...opencc(value)]
    .map((char) => JP2CN[char] ?? char)
    .join('');

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query('set search_path to vndb, public');

  const overrideRes = await client.query(
    'select vndb_id, name from character_name_overrides'
  );
  const overrides = new Map(
    overrideRes.rows.map((row) => [row.vndb_id.replace(/^c/, ''), row.name])
  );
  const legacyCharacters = JSON.parse(fs.readFileSync(LEGACY_CHARACTERS_PATH, 'utf8'));
  const legacyIds = JSON.parse(fs.readFileSync(LEGACY_IDS_PATH, 'utf8'));
  const legacyIdByVndb = new Map();
  const legacyRowByVndb = new Map();
  const beginnerIds = new Set();
  legacyCharacters.forEach((row, index) => {
    const vndbId = `c${String(legacyIds[index]).replace(/^c/, '')}`;
    legacyIdByVndb.set(vndbId, index + 1);
    legacyRowByVndb.set(vndbId, row);
    if (row.difficulties?.includes('beginner')) beginnerIds.add(vndbId);
  });

  const [charsRes, zhRes, vnRes, vnTitlesRes, releaseRes, companyRes, seiyuuRes, staffRes, traitsRes] =
    await Promise.all([
      client.query('select id, sex, gender from chars'),
      client.query("select id, name from chars_names where lang = 'zh-Hans'"),
      client.query('select id, vid, role from chars_vns'),
      client.query('select id, lang, title from vn_titles'),
      client.query(
        'select rv.vid, min(r.released) as released from releases_vn rv join releases r on r.id = rv.id group by rv.vid'
      ),
      client.query(
        `select rv.vid, min(p.name) as name
         from releases_producers rp
         join releases_vn rv on rv.id = rp.id
         join producers p on p.id = rp.pid
         where rp.developer = true
         group by rv.vid`
      ),
      client.query('select id, cid, aid from vn_seiyuu'),
      client.query('select aid, name from staff_alias'),
      client.query('select id, name from traits'),
    ]);

  const zhNameById = new Map(zhRes.rows.map((row) => [row.id, row.name]));
  const sexById = new Map(charsRes.rows.map((row) => [row.id, row]));
  const vnsByChar = new Map();
  for (const row of vnRes.rows) {
    if (!vnsByChar.has(row.id)) vnsByChar.set(row.id, []);
    vnsByChar.get(row.id).push(row);
  }

  const titlesByVn = new Map();
  for (const row of vnTitlesRes.rows) {
    if (!titlesByVn.has(row.id)) titlesByVn.set(row.id, []);
    titlesByVn.get(row.id).push(row);
  }
  const yearByVn = new Map(releaseRes.rows.map((row) => [row.vid, Number(row.released) || 0]));
  const companyByVn = new Map(companyRes.rows.map((row) => [row.vid, row.name]));
  const cvByVnChar = new Map();
  for (const row of seiyuuRes.rows) {
    const key = `${row.id}:${row.cid}`;
    if (!cvByVnChar.has(key)) cvByVnChar.set(key, row.aid);
  }
  const staffNameByAid = new Map(staffRes.rows.map((row) => [row.aid, row.name]));
  const traitNameById = new Map(traitsRes.rows.map((row) => [row.id, row.name]));

  const candidateIds = new Set([
    ...zhNameById.keys(),
    ...overrides.keys().map((id) => `c${id.replace(/^c/, '')}`),
  ]);
  const traitRows = candidateIds.size
    ? (await client.query(
        'select id, tid from chars_traits where id = any($1::text[])',
        [[...candidateIds]]
      )).rows
    : [];
  const traitsByChar = new Map();
  for (const row of traitRows) {
    if (!traitsByChar.has(row.id)) traitsByChar.set(row.id, []);
    traitsByChar.get(row.id).push(row.tid);
  }

  function chooseVn(charId) {
    const rows = vnsByChar.get(charId) || [];
    if (!rows.length) return null;
    return rows
      .map((row) => {
        const hasTitle = titlesByVn.has(row.vid);
        const hasZh = titlesByVn.get(row.vid)?.some((t) => t.lang === 'zh-Hans') ?? false;
        return {
          row,
          score: (ROLE_PRIORITY[row.role] ?? 9) * 100 + (hasZh ? 0 : 10) + (hasTitle ? 0 : 20),
        };
      })
      .sort((a, b) => a.score - b.score)[0].row;
  }

  function workTitle(vnId) {
    const titles = titlesByVn.get(vnId) || [];
    const preferred = ['zh-Hans', 'ja', 'en'];
    for (const lang of preferred) {
      const match = titles.find((title) => title.lang === lang && title.title);
      if (match) return match.title;
    }
    return titles.find((title) => title.title)?.title ?? vnId;
  }

  const rows = [];
  let nextId = Math.max(0, ...legacyIdByVndb.values()) + 1;

  for (const vndbId of candidateIds) {
    const displayName = simplifyName(
      overrides.get(vndbId.replace(/^c/, '')) || zhNameById.get(vndbId)
    );
    if (!displayName || WEIRD_PATTERNS.some((pattern) => pattern.test(displayName))) continue;

    const char = sexById.get(vndbId) ?? {};
    const vn = chooseVn(vndbId);
    const legacy = legacyRowByVndb.get(vndbId);
    const traitNames = new Set(
      (traitsByChar.get(vndbId) || []).map((tid) => traitNameById.get(tid)).filter(Boolean)
    );
    const [hairColor, hairFamily] = hairOf(traitNames);
    const role = vn?.role ?? 'appears';
    const difficulties = legacy?.difficulties
      ? [...legacy.difficulties]
      : role === 'main' || role === 'primary'
        ? ['normal', 'easy']
        : ['normal'];
    if (beginnerIds.has(vndbId) && !difficulties.includes('beginner')) difficulties.push('beginner');

    const cvAid = vn ? cvByVnChar.get(`${vn.vid}:${vndbId}`) : null;
    rows.push({
      id: legacyIdByVndb.get(vndbId) ?? nextId++,
      vndb_id: vndbId,
      name: displayName,
      work: legacy?.work ?? (vn ? workTitle(vn.vid) : '未知'),
      company: legacy?.company ?? (vn ? companyByVn.get(vn.vid) || '未知' : '未知'),
      release_year: legacy?.release_year ?? (vn ? Math.floor((yearByVn.get(vn.vid) || 0) / 10000) : 0),
      gender: legacy?.gender ?? genderOf(char.sex, char.gender),
      cv: legacy?.cv ?? (cvAid != null ? staffNameByAid.get(cvAid) || '未知' : '未知'),
      hair_color: legacy?.hair_color ?? hairColor,
      hair_color_family: legacy?.hair_color_family ?? hairFamily,
      hair_length: legacy?.hair_length ?? hairLengthOf(traitNames),
      difficulties: JSON.stringify(difficulties),
      is_enabled: true,
      data_version: DATA_VERSION,
      sourceRank: legacy ? 0 : overrides.has(vndbId.replace(/^c/, '')) ? 1 : 2,
    });
  }

  const rowsByName = new Map();
  for (const row of rows) {
    const current = rowsByName.get(row.name);
    if (!current || row.sourceRank < current.sourceRank) rowsByName.set(row.name, row);
  }
  const finalRows = [...rowsByName.values()].sort((a, b) => a.id - b.id);

  await client.query('truncate table characters restart identity');
  for (const row of finalRows) {
    await client.query(
      `insert into characters (
         id, vndb_id, name, work, company, release_year, gender, cv,
         hair_color, hair_color_family, hair_length, difficulties,
         is_enabled, data_version
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
       )`,
      [
        row.id,
        row.vndb_id,
        row.name,
        row.work,
        row.company,
        row.release_year,
        row.gender,
        row.cv,
        row.hair_color,
        row.hair_color_family,
        row.hair_length,
        row.difficulties,
        row.is_enabled,
        row.data_version,
      ]
    );
  }

  console.log(`imported ${finalRows.length} characters`);
  console.log(`overrides: ${overrides.size}`);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
