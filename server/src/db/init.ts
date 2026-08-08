import { db } from './knex';
import { ensureSchema } from './schema';
import charactersData from './seeds/characters.json';

export async function seedCharactersIfEmpty(): Promise<void> {
  const row = await db('characters').count<{ c: number }[]>({ c: '*' });
  const count = Number(row[0].c);
  if (count > 0) return;
  const rows = (charactersData as any[]).map((character) => ({
    name: character.name,
    work: character.work,
    company: character.company,
    release_year: character.release_year,
    gender: character.gender,
    cv: character.cv,
    hair_color: character.hair_color,
    hair_color_family: character.hair_color_family,
    is_enabled: character.is_enabled ?? true,
  }));
  await db.batchInsert('characters', rows, 50);
  const characters = await db('characters').select('id', 'name');
  const difficultiesByCharacter = new Map<string, string[]>(
    (charactersData as any[]).map((character) => [character.name, character.difficulties ?? ['normal']])
  );
  const memberships = characters.flatMap((character) =>
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
  console.log(`[seed] 已导入 ${rows.length} 名角色`);
}

export async function initDb(): Promise<void> {
  await ensureSchema();
  await seedCharactersIfEmpty();
}
