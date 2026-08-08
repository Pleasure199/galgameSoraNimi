import { db } from './knex';
import { ensureSchema } from './schema';
import charactersData from './seeds/characters.json';

// 手动执行:补充种子数据中数据库尚不存在的角色(按角色名去重)
async function run() {
  await ensureSchema();
  const existing = new Set(
    (await db('characters').select('name')).map((row: any) => row.name)
  );
  const rows = (charactersData as any[]).filter((character) => !existing.has(character.name));
  if (rows.length) {
    await db.batchInsert('characters', rows.map((character) => ({
      name: character.name,
      work: character.work,
      company: character.company,
      release_year: character.release_year,
      gender: character.gender,
      cv: character.cv,
      hair_color: character.hair_color,
      hair_color_family: character.hair_color_family,
      is_enabled: character.is_enabled ?? true,
    })), 50);
  }
  if (rows.length) {
    const difficultiesByCharacter = new Map<string, string[]>(
      rows.map((character) => [character.name, character.difficulties ?? ['normal']])
    );
    const characters = await db('characters')
      .whereIn('name', rows.map((character) => character.name))
      .select('id', 'name');
    const memberships = characters.flatMap((character: any) =>
      (difficultiesByCharacter.get(character.name) ?? ['normal']).map((difficultyKey) => ({
        character_id: character.id,
        difficulty_key: difficultyKey,
      }))
    );
    for (let index = 0; index < memberships.length; index += 500) {
      await db('character_difficulties')
        .insert(memberships.slice(index, index + 500))
        .onConflict(['character_id', 'difficulty_key'])
        .ignore();
    }
  }
  console.log(`[seed] 新增 ${rows.length} 名角色`);
  await db.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
