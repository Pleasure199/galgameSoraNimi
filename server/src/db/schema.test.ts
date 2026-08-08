import knex from 'knex';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureSchema } from './schema';
import { userNameFromUsername } from '../services/identityDisplay';

const instances: ReturnType<typeof knex>[] = [];

function memoryDb() {
  const instance = knex({
    client: 'better-sqlite3',
    connection: { filename: ':memory:' },
    useNullAsDefault: true,
  });
  instances.push(instance);
  return instance;
}

afterEach(async () => {
  await Promise.all(instances.splice(0).map((instance) => instance.destroy()));
});

describe('character schema migration', () => {
  it('creates the characters schema with difficulty memberships and game columns', async () => {
    const instance = memoryDb();
    await ensureSchema(instance);

    expect(await instance.schema.hasTable('characters')).toBe(true);
    expect(await instance.schema.hasColumn('characters', 'name')).toBe(true);
    expect(await instance.schema.hasColumn('characters', 'work')).toBe(true);
    expect(await instance.schema.hasColumn('characters', 'company')).toBe(true);
    expect(await instance.schema.hasColumn('characters', 'release_year')).toBe(true);
    expect(await instance.schema.hasColumn('characters', 'gender')).toBe(true);
    expect(await instance.schema.hasColumn('characters', 'cv')).toBe(true);
    expect(await instance.schema.hasColumn('characters', 'hair_color')).toBe(true);
    expect(await instance.schema.hasColumn('characters', 'hair_color_family')).toBe(true);
    expect(await instance.schema.hasColumn('characters', 'is_enabled')).toBe(true);
    expect(await instance.schema.hasTable('character_difficulties')).toBe(true);
    expect(await instance.schema.hasTable('difficulty_levels')).toBe(true);
    expect(await instance.schema.hasTable('app_migrations')).toBe(true);
    expect(await instance.schema.hasColumn('games', 'target_character_id')).toBe(true);
    expect(await instance.schema.hasColumn('games', 'guess_times')).toBe(true);
    expect(await instance.schema.hasColumn('games', 'first_guess_character_id')).toBe(true);
    expect(await instance.schema.hasColumn('users', 'display_id')).toBe(true);
    expect(await instance.schema.hasColumn('users', 'leaderboard_hidden')).toBe(true);
    expect(await instance.schema.hasColumn('announcements', 'is_popup')).toBe(true);
    expect(await instance.schema.hasTable('api_tokens')).toBe(false);
    expect(await instance.schema.hasTable('match_records')).toBe(false);
    expect(await instance.schema.hasTable('players')).toBe(false);

    const difficultyRows = await instance('difficulty_levels').select('key', 'sort_order', 'is_enabled');
    expect(difficultyRows.map((row) => row.key)).toEqual(['beginner', 'easy', 'normal']);
    expect(difficultyRows.map((row) => row.sort_order)).toEqual([5, 10, 20]);
    expect(difficultyRows.every((row) => row.is_enabled === 1)).toBe(true);
  });

  it('drops a legacy games table without guest_key and recreates it for characters', async () => {
    const instance = memoryDb();
    await instance.schema.createTable('games', (table) => {
      table.increments('id').primary();
      table.integer('user_id').notNullable();
      table.integer('target_player_id').notNullable();
      table.string('mode', 16).notNullable().defaultTo('easy');
      table.string('status', 16).notNullable().defaultTo('playing');
    });

    await ensureSchema(instance);

    expect(await instance.schema.hasColumn('games', 'target_player_id')).toBe(false);
    expect(await instance.schema.hasColumn('games', 'guest_key')).toBe(true);
    expect(await instance.schema.hasColumn('games', 'target_character_id')).toBe(true);
    expect(await instance.schema.hasColumn('games', 'first_guess_character_id')).toBe(true);
    expect(await instance.schema.hasColumn('games', 'guess_times')).toBe(true);

    const [character] = await instance('characters')
      .insert({
        name: '牧濑红莉栖',
        work: 'STEINS;GATE',
        company: 'MAGES.',
        release_year: 2009,
        gender: '女',
        cv: '今井麻美',
        hair_color: '红色',
        hair_color_family: 'red',
        is_enabled: true,
      })
      .returning('id');
    await instance('games').insert({
      session_id: 'post-migration-game',
      guest_key: 'guest',
      target_character_id: character.id,
      mode: 'easy',
      guesses: '[]',
      guess_times: '[]',
      status: 'won',
      guess_count: 0,
      finished_at: instance.fn.now(),
    });
    const game = await instance('games').where({ session_id: 'post-migration-game' }).first();
    expect(Number(game.target_character_id)).toBe(Number(character.id));
  });

  it('adds the popup flag to an existing announcements table', async () => {
    const instance = memoryDb();
    await instance.schema.createTable('announcements', (table) => {
      table.increments('id').primary();
      table.string('title', 128).notNullable();
      table.text('content').notNullable();
      table.timestamp('created_at').notNullable().defaultTo(instance.fn.now());
    });
    await instance('announcements').insert({ title: 'legacy', content: 'content' });

    await ensureSchema(instance);

    expect(await instance.schema.hasColumn('announcements', 'is_popup')).toBe(true);
    expect((await instance('announcements').where({ title: 'legacy' }).first()).is_popup).toBe(0);
  });

  it('backfills missing user display ids', async () => {
    const instance = memoryDb();
    await instance.schema.createTable('users', (table) => {
      table.increments('id').primary();
      table.string('username', 32).notNullable().unique();
      table.string('display_id', 8).nullable();
      table.string('password_hash', 128).notNullable();
      table.string('role', 16).notNullable().defaultTo('user');
      table.timestamp('created_at').notNullable().defaultTo(instance.fn.now());
    });
    await instance('users').insert({ username: 'legacy-user', display_id: null, password_hash: 'test' });

    await ensureSchema(instance);

    const user = await instance('users').where({ username: 'legacy-user' }).first();
    expect(user.display_id).toBe(userNameFromUsername('legacy-user'));
    expect(user.leaderboard_hidden).toBe(0);
  });
});
