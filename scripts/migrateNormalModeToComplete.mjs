import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://tianyiba:tianyiba@127.0.0.1:5432/tianyiba';

/**
 * 旧版本 normal 表示“完整版”，新版 normal 表示“普通版”。
 * 把历史 normal 对局迁移到 complete，避免旧完整版对局被算进普通版排行榜。
 */
async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  const result = await client.query(`update games set mode = 'complete' where mode = 'normal'`);
  console.log(`migrated ${result.rowCount} games from normal to complete`);
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
