import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { DATABASE_URL } from './dbUrl.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIERS_PATH = path.join(ROOT, 'scripts/difficultyTiers.json');

const tiers = JSON.parse(fs.readFileSync(TIERS_PATH, 'utf8'));

const DIFFICULTIES = [
  { key: 'beginner', names: tiers.beginner, value: '["beginner","easy","normal","hard","complete"]' },
  { key: 'easy', names: tiers.easy, value: '["easy","normal","hard","complete"]' },
  { key: 'normal', names: tiers.normal, value: '["normal","hard","complete"]' },
  { key: 'hard', names: tiers.hard, value: '["hard","complete"]' },
];

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query('begin');
  try {
    await client.query(`update characters set difficulties = '["complete"]'`);
    for (const difficulty of DIFFICULTIES) {
      for (const character of difficulty.names) {
        await client.query('update characters set difficulties = $1 where vndb_id = $2', [
          difficulty.value,
          character.vndb_id,
        ]);
      }
    }
    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  }

  const pools = (await client.query(
    `select
       count(*) filter (where difficulties like '%beginner%') as beginner,
       count(*) filter (where difficulties like '%easy%') as easy,
       count(*) filter (where difficulties like '%normal%') as normal,
       count(*) filter (where difficulties like '%hard%') as hard,
       count(*) filter (where difficulties like '%complete%') as complete
     from characters`
  )).rows[0];
  const incomplete = (await client.query(
    `select count(*)::int as n from characters
     where (difficulties like '%beginner%' or difficulties like '%easy%' or difficulties like '%normal%' or difficulties like '%hard%')
       and (gender = '未知' or cv = '未知' or hair_color = '未知' or hair_color_family = 'unknown'
            or hair_length = '未知' or release_year = 0 or work = '未知' or company = '未知')`
  )).rows[0].n;

  console.log('pools', JSON.stringify(pools));
  console.log('incomplete in first four tiers:', incomplete);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
