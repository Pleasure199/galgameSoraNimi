import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { DATABASE_URL } from './dbUrl.mjs';

const ROOT = path.resolve(process.cwd());
const WEB_POPULARITY_PATH = path.join(ROOT, 'scripts/webPopularity.json');
const DOC_PATH = path.join(ROOT, 'docs/difficulty-pools.md');

function listSection(title, rows) {
  const lines = [`## ${title}`, ''];
  for (const row of rows) {
    lines.push(`- ${row.name}（${row.work}）`);
  }
  lines.push('');
  return lines.join('\n');
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  const rows = (await client.query(
    'select id, name, work, difficulties from characters order by id'
  )).rows;
  await client.end();

  const web = JSON.parse(fs.readFileSync(WEB_POPULARITY_PATH, 'utf8'));
  const byName = new Map(rows.map((row) => [row.name, row]));
  const difficultySet = (row) => new Set(JSON.parse(row.difficulties));
  const beginnerRows = rows.filter((row) => difficultySet(row).has('beginner'));
  const easyRows = rows.filter((row) => difficultySet(row).has('easy'));

  const orderByWeb = (pool, names) => {
    const ordered = [];
    const used = new Set();
    for (const name of names) {
      const row = byName.get(name);
      if (!row || !pool.has(row.id)) continue;
      ordered.push(row);
      used.add(row.id);
    }
    for (const row of pool.values()) {
      if (!used.has(row.id)) ordered.push(row);
    }
    return ordered;
  };
  const beginnerPool = new Map(beginnerRows.map((row) => [row.id, row]));
  const easyPool = new Map(easyRows.map((row) => [row.id, row]));
  const beginnerOrdered = orderByWeb(beginnerPool, web.beginner);
  const easyOrdered = orderByWeb(easyPool, [...web.beginner, ...web.easyExtra]);

  const content = [
    '# 难度角色池',
    '',
    '难度分配不依据 VNDB 票数，而是依据中文社区公开票选与榜单整理的网络知名度名单（scripts/webPopularity.json）。',
    '',
    `- 入门版（${beginnerOrdered.length}）：属性完整，且为作品男女主角（VNDB 角色定位 main/primary）中知名度最高的角色。`,
    `- 简单版（${easyOrdered.length}）：属性完整且知名度较高的角色。`,
    `- 完整版（${rows.length}）：全部角色。`,
    '',
    '名单来源：VGOver《十四位视觉小说游戏最受欢迎的女主角》、Key 20/25 周年官方人气投票、Getchu 美少女游戏大赏 2012-2022 角色部门、2pick Galgame 女主角二选一、弹丸论破官方/社区人气投票、电击 Online《命运石之门》人气投票、TYPE-MOON 十周年人气投票。',
    '',
    listSection(`入门版 beginner（${beginnerOrdered.length}）`, beginnerOrdered),
    listSection(`简单版 easy（${easyOrdered.length}）`, easyOrdered),
  ].join('\n');

  fs.writeFileSync(DOC_PATH, content);
  console.log(`beginner=${beginnerOrdered.length}, easy=${easyOrdered.length}, normal=${rows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
