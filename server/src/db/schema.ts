import { Knex } from 'knex';
import { db } from './knex';
import { userNameFromUsername } from '../services/identityDisplay';

const USER_DISPLAY_ID_BACKFILL_BATCH_SIZE = 1000;

async function backfillUserDisplayIds(instance: Knex): Promise<void> {
  let cursor = 0;
  while (true) {
    const users = await instance('users')
      .select('id', 'username')
      .where('id', '>', cursor)
      .where((builder) => builder.whereNull('display_id').orWhere('display_id', ''))
      .orderBy('id')
      .limit(USER_DISPLAY_ID_BACKFILL_BATCH_SIZE);
    if (!users.length) return;
    cursor = Number(users[users.length - 1].id);
    await instance.transaction(async (trx) => {
      for (const user of users) {
        await trx('users').where({ id: user.id }).update({
          display_id: userNameFromUsername(user.username),
        });
      }
    });
  }
}

export async function ensureSchema(instance: Knex = db): Promise<void> {
  if (!(await instance.schema.hasTable('users'))) {
    await instance.schema.createTable('users', (t) => {
      t.increments('id').primary();
      t.string('username', 32).notNullable().unique();
      t.string('display_id', 8).nullable();
      t.string('password_hash', 128).notNullable();
      t.string('role', 16).notNullable().defaultTo('user');
      t.integer('token_version').notNullable().defaultTo(0);
      t.boolean('leaderboard_hidden').notNullable().defaultTo(false);
      t.timestamp('created_at').notNullable().defaultTo(instance.fn.now());
    });
  }
  if (!(await instance.schema.hasColumn('users', 'token_version'))) {
    await instance.schema.alterTable('users', (t) => t.integer('token_version').notNullable().defaultTo(0));
  }
  if (!(await instance.schema.hasColumn('users', 'display_id'))) {
    await instance.schema.alterTable('users', (t) => t.string('display_id', 8).nullable());
  }
  if (!(await instance.schema.hasColumn('users', 'leaderboard_hidden'))) {
    await instance.schema.alterTable('users', (t) => {
      t.boolean('leaderboard_hidden').notNullable().defaultTo(false);
    });
  }
  await backfillUserDisplayIds(instance);
  const usersIndexConcurrently = instance.client.config.client === 'pg' ? ' concurrently' : '';
  await instance.raw(
    `create index${usersIndexConcurrently} if not exists "users_display_id_idx" on "users" ("display_id")`
  );

  if (!(await instance.schema.hasTable('app_migrations'))) {
    await instance.schema.createTable('app_migrations', (t) => {
      t.string('name', 128).primary();
      t.timestamp('applied_at').notNullable().defaultTo(instance.fn.now());
    });
  }

  // 旧版 games 表 user_id 不可空且无 guest_key;检测到旧结构则重建(开发期数据可丢弃)
  if (
    (await instance.schema.hasTable('games')) &&
    !(await instance.schema.hasColumn('games', 'guest_key'))
  ) {
    await instance.schema.dropTable('games');
  }
  if (!(await instance.schema.hasTable('games'))) {
    await instance.schema.createTable('games', (t) => {
      t.increments('id').primary();
      t.string('session_id', 64).nullable();
      t.integer('user_id').nullable().references('id').inTable('users');
      t.string('guest_key', 64).nullable().index();
      t.integer('target_character_id').notNullable();
      t.string('mode', 16).notNullable().defaultTo('easy');
      t.text('guesses').notNullable().defaultTo('[]');
      t.text('guess_times').notNullable().defaultTo('[]');
      t.integer('first_guess_character_id').nullable();
      t.string('status', 16).notNullable().defaultTo('playing');
      t.integer('guess_count').notNullable().defaultTo(0);
      t.timestamp('created_at').notNullable().defaultTo(instance.fn.now());
      t.timestamp('finished_at').nullable();
    });
  }
  if (!(await instance.schema.hasColumn('games', 'session_id'))) {
    await instance.schema.alterTable('games', (t) => t.string('session_id', 64).nullable());
  }
  if (!(await instance.schema.hasColumn('games', 'guess_times'))) {
    await instance.schema.alterTable('games', (t) => t.text('guess_times').notNullable().defaultTo('[]'));
  }
  if (!(await instance.schema.hasColumn('games', 'first_guess_character_id'))) {
    await instance.schema.alterTable('games', (t) => t.integer('first_guess_character_id').nullable());
  }
  await instance.raw(
    'create unique index if not exists "games_session_id_unique" on "games" ("session_id")'
  );
  // Active single-player games now live only in Redis and are not historical records.
  await instance('games').where({ status: 'playing' }).del();

  const gameIndexes = [
    ['games_user_status_mode_idx', ['user_id', 'status', 'mode']],
    ['games_guest_status_mode_idx', ['guest_key', 'status', 'mode']],
    ['games_user_finished_idx', ['user_id', 'finished_at']],
    ['games_guest_finished_idx', ['guest_key', 'finished_at']],
  ] as const;
  for (const [name, columns] of gameIndexes) {
    const quotedColumns = columns.map((column) => `\"${column}\"`).join(', ');
    await instance.raw(`create index if not exists \"${name}\" on \"games\" (${quotedColumns})`);
  }
  const firstGuessIndexes = [
    ['games_first_guess_idx', ['first_guess_character_id']],
    ['games_user_first_guess_idx', ['user_id', 'first_guess_character_id']],
    ['games_guest_first_guess_idx', ['guest_key', 'first_guess_character_id']],
  ] as const;
  for (const [name, columns] of firstGuessIndexes) {
    const quotedColumns = columns.map((column) => `\"${column}\"`).join(', ');
    const concurrently = instance.client.config.client === 'pg' ? ' concurrently' : '';
    await instance.raw(
      `create index${concurrently} if not exists \"${name}\" on \"games\" (${quotedColumns})`
    );
  }

  if (!(await instance.schema.hasTable('announcements'))) {
    await instance.schema.createTable('announcements', (t) => {
      t.increments('id').primary();
      t.string('title', 128).notNullable();
      t.text('content').notNullable();
      t.boolean('is_popup').notNullable().defaultTo(false);
      t.timestamp('created_at').notNullable().defaultTo(instance.fn.now());
    });
  }
  if (!(await instance.schema.hasColumn('announcements', 'is_popup'))) {
    await instance.schema.alterTable('announcements', (t) => {
      t.boolean('is_popup').notNullable().defaultTo(false);
    });
  }
}
