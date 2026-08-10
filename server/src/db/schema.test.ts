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

describe('schema migration', () => {
  it('creates the character and game schema with game columns', async () => {
    const instance = memoryDb();
    await ensureSchema(instance);

    expect(await instance.schema.hasTable('characters')).toBe(true);
    expect(await instance.schema.hasTable('character_name_overrides')).toBe(true);
    expect(await instance.schema.hasTable('character_difficulties')).toBe(false);
    expect(await instance.schema.hasTable('difficulty_levels')).toBe(false);
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
  });

  it('drops a legacy games table without guest_key and recreates it', async () => {
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

    await instance('games').insert({
      session_id: 'post-migration-game',
      guest_key: 'guest',
      target_character_id: 1,
      mode: 'easy',
      guesses: '[]',
      guess_times: '[]',
      status: 'won',
      guess_count: 0,
      finished_at: instance.fn.now(),
    });
    const game = await instance('games').where({ session_id: 'post-migration-game' }).first();
    expect(Number(game.target_character_id)).toBe(1);
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
