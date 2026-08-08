import { Knex } from 'knex';
import { db } from './knex';

const REQUIRED_COLUMNS: Record<string, string[]> = {
  users: ['id', 'username', 'password_hash', 'role', 'token_version', 'leaderboard_hidden'],
  app_migrations: ['name', 'applied_at'],
  characters: [
    'id',
    'name',
    'work',
    'company',
    'release_year',
    'gender',
    'cv',
    'hair_color',
    'hair_color_family',
    'is_enabled',
  ],
  difficulty_levels: ['key', 'sort_order', 'is_enabled'],
  character_difficulties: ['character_id', 'difficulty_key'],
  games: ['id', 'session_id', 'user_id', 'guest_key', 'guess_times', 'first_guess_character_id', 'status'],
  announcements: ['id', 'title', 'content', 'is_popup'],
};

/** Applications only verify the migrated schema; DDL remains owned by the migrate service. */
export async function assertDatabaseReady(instance: Knex = db): Promise<void> {
  await instance.raw('select 1');
  const missing: string[] = [];
  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    if (!(await instance.schema.hasTable(table))) {
      missing.push(table);
      continue;
    }
    for (const column of columns) {
      if (!(await instance.schema.hasColumn(table, column))) missing.push(`${table}.${column}`);
    }
  }
  if (missing.length) throw new Error(`DATABASE_SCHEMA_NOT_READY:${missing.join(',')}`);
}
