import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { Converter } from 'opencc-js';

const ROOT = path.resolve(process.cwd());
const LEGACY_CHARACTERS_PATH = path.join(ROOT, 'server/data/characters.json');
const LEGACY_IDS_PATH = path.join(ROOT, 'server/data/characterIds.json');
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://tianyiba:tianyiba@127.0.0.1:5432/tianyiba';

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
  '竜': '龙', '亀': '龟', '姫': '姬', '瀬': '濑', '瀨': '濑', '黒': '黑', '両': '两',
  '塚': '冢', '恵': '惠', '桜': '樱', '鉄': '铁', '絆': '绊', '飛': '飞', '薫': '薰',
  '菫': '堇', '霧': '雾', '聖': '圣', '衛': '卫', '樹': '树', '岡': '冈', '絵': '绘',
  '縁': '缘', '綾': '绫', '純': '纯', '鳴': '鸣', '倉': '仓', '響': '响', '駆': '驱',
  '葉': '叶', '呂': '吕', '萩': '荻', '苺': '莓', '雛': '雏', '瑠': '琉', '璃': '璃',
  '浜': '滨', '濱': '滨', '邊': '边', '峯': '峰', '嶋': '岛', '渕': '渊', '髙': '高',
  '圓': '圆', '図': '图', '団': '团', '囲': '围', '増': '增', '応': '应', '広': '广',
  '拡': '扩', '層': '层', '円': '圆', '遼': '辽', '聡': '聪', '顯': '显', '賢': '贤',
  '貢': '贡', '豊': '丰', '勝': '胜', '優': '优', '華': '华', '蓮': '莲', '穂': '穗',
  '稲': '稻', '麦': '麦', '穀': '谷', '黙': '默', '兎': '兔', '魚': '鱼', '鯨': '鲸',
  '鯉': '鲤', '鮎': '鲇', '鮭': '鲑', '鰻': '鳗', '鮪': '鲔', '鱈': '鳕', '鶏': '鸡',
  '鳩': '鸠', '鴨': '鸭', '鷹': '鹰', '鳶': '鸢', '鴉': '鸦', '鷲': '鹫', '貝': '贝',
  '蛍': '萤', '蝶': '蝶', '蜂': '蜂', '蟻': '蚁', '蚊': '蚊', '巻': '卷', '畫': '画',
  '書': '书', '語': '语', '読': '读', '説': '说', '談': '谈', '論': '论', '議': '议',
  '譯': '译', '訳': '译', '話': '话', '詩': '诗', '詞': '词', '調': '调', '試': '试',
  '誤': '误', '誘': '诱', '譜': '谱', '護': '护', '識': '识', '変': '变', '計': '计',
  '記': '记', '討': '讨', '訓': '训', '診': '诊', '註': '注', '証': '证', '評': '评',
  '誕': '诞', '謝': '谢', '謹': '谨', '謎': '谜', '謙': '谦', '講': '讲', '譲': '让',
  '讀': '读', '驗': '验', '驚': '惊', '髪': '发', '髮': '发', '體': '体', '門': '门',
  '窓': '窗', '戸': '户', '車': '车', '剣': '剑', '劍': '剑', '槍': '枪', '鎧': '铠',
  '帯': '带', '鈴': '铃', '鐘': '钟', '楽': '乐', '唄': '呗', '謡': '谣', '踊': '踊',
  '藝': '艺', '術': '术', '徳': '德', '節': '节', '操': '操', '禪': '禅', '夢': '梦',
  '戀': '恋', '愛': '爱', '覺': '觉', '報': '报', '敵': '敌', '親': '亲', '孫': '孙',
  '従': '从', '僕': '仆', '聖': '圣', '児': '儿', '経': '经', '結': '结', '続': '续',
  '絶': '绝', '総': '总', '緑': '绿', '網': '网', '線': '线', '練': '练', '編': '编',
  '綺': '绮', '挙': '举', '舊': '旧', '薬': '药', '様': '样', '機': '机', '権': '权',
  '検': '检', '構': '构', '歳': '岁', '歴': '历', '殺': '杀', '満': '满', '災': '灾',
  '煙': '烟', '熱': '热', '為': '为', '與': '与', '興': '兴', 'の': '之', '々': '々',
};

const opencc = Converter({ from: 'tw', to: 'cn' });
function simplifyName(value) {
  return [...opencc(value)]
    .map((char) => JP2CN[char] ?? char)
    .join('');
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  const legacy = JSON.parse(fs.readFileSync(LEGACY_CHARACTERS_PATH, 'utf8'));
  const ids = JSON.parse(fs.readFileSync(LEGACY_IDS_PATH, 'utf8'));
  const existing = await client.query('select id, vndb_id, name from characters');
  const existingById = new Map(existing.rows.map((row) => [row.vndb_id, row]));
  const existingNames = new Set(existing.rows.map((row) => row.name));

  let inserted = 0;
  let updated = 0;
  let skippedDuplicate = 0;
  for (let index = 0; index < legacy.length; index += 1) {
    const vndbId = `c${String(ids[index]).replace(/^c/, '')}`;
    const row = legacy[index];
    const name = simplifyName(row.name);
    const current = existingById.get(vndbId);
    if (current) {
      if (current.name === name) continue;
      if (existingNames.has(name)) {
        skippedDuplicate += 1;
        continue;
      }
      existingNames.delete(current.name);
      existingNames.add(name);
      await client.query('update characters set name = $1 where vndb_id = $2', [name, vndbId]);
      updated += 1;
      continue;
    }
    let finalName = name;
    if (existingNames.has(finalName)) {
      finalName = `${name}（${row.work}）`;
      let suffix = 2;
      while (existingNames.has(finalName)) {
        finalName = `${name}（${row.work} ${suffix++}）`;
      }
    }
    existingNames.add(finalName);
    await client.query(
      `insert into characters (
         id, vndb_id, name, work, company, release_year, gender, cv,
         hair_color, hair_color_family, hair_length, height, difficulties,
         is_enabled, data_version
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
       )
       on conflict (vndb_id) do nothing`,
      [
        index + 1,
        vndbId,
        finalName,
        row.work,
        row.company,
        row.release_year,
        row.gender,
        row.cv,
        row.hair_color,
        row.hair_color_family,
        row.hair_length,
        row.height ?? null,
        JSON.stringify(row.difficulties),
        row.is_enabled ?? true,
        'legacy-json',
      ]
    );
    inserted += 1;
  }

  const weird = await client.query(
    "select id, vndb_id, name from characters where coalesce(data_version, '') <> 'legacy-json'"
  );
  const removed = [];
  for (const row of weird.rows) {
    if (WEIRD_PATTERNS.some((pattern) => pattern.test(row.name))) {
      await client.query('delete from characters where id = $1', [row.id]);
      removed.push({ id: row.id, vndb_id: row.vndb_id, name: row.name });
    }
  }

  console.log(`inserted legacy: ${inserted}`);
  console.log(`updated to simplified: ${updated}`);
  console.log(`skipped duplicate names: ${skippedDuplicate}`);
  console.log(`removed weird: ${removed.length}`);
  for (const row of removed) {
    console.log(`- ${row.id} ${row.vndb_id} ${row.name}`);
  }
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
