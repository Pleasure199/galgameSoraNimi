import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initRedis, redis, redisKey } from '../redis';
import { db } from '../db/knex';
import { initDb } from '../db/init';
import {
  getPublicCharacterList,
  isDifficultyAvailable,
  invalidateCharacterCache,
  pickCachedTarget,
  refreshCharacterCache,
} from './characterCache';

beforeAll(async () => {
  await initDb();
  await initRedis();
});

afterAll(async () => {
  await db('characters').whereLike('name', 'cache-test-%').del();
});

describe('character cache invalidation', () => {
  it('does not touch the legacy SHA version key and bumps the v2 revision', async () => {
    const client = redis()!;
    await client.set(redisKey('characters:version'), '0123456789abcdef');
    await client.del(redisKey('characters:revision:v2'));
    await expect(invalidateCharacterCache()).resolves.toBeUndefined();
    expect(await client.get(redisKey('characters:version'))).toBe('0123456789abcdef');
    expect(await client.get(redisKey('characters:revision:v2'))).toBe('1');
  });

  it('removes a disabled character before invalidation returns and changes the list version', async () => {
    const name = `cache-test-${Date.now()}`;
    const [row] = await db('characters').insert({
      name,
      work: '测试',
      company: '测试',
      release_year: 2020,
      gender: '女',
      cv: '测试',
      hair_color: '蓝色',
      hair_color_family: 'blue',
      is_enabled: true,
    }).returning('id');
    const id = Number(typeof row === 'object' ? row.id : row);

    await refreshCharacterCache();
    const before = await getPublicCharacterList();
    expect(before.characters).toContainEqual({ id, name });

    await db('characters').where({ id }).update({ is_enabled: false });
    await invalidateCharacterCache();

    const after = await getPublicCharacterList();
    expect(after.version).not.toBe(before.version);
    expect(after.characters).not.toContainEqual({ id, name });
  });

  it('refreshes a stale instance before serving the public list', async () => {
    const name = `cache-test-cross-instance-${Date.now()}`;
    const [row] = await db('characters').insert({
      name,
      work: '测试',
      company: '测试',
      release_year: 2020,
      gender: '女',
      cv: '测试',
      hair_color: '蓝色',
      hair_color_family: 'blue',
      is_enabled: true,
    }).returning('id');
    const id = Number(typeof row === 'object' ? row.id : row);

    await refreshCharacterCache();
    expect((await getPublicCharacterList()).characters).toContainEqual({ id, name });

    await db('characters').where({ id }).update({ is_enabled: false });
    await redis()!.incr(redisKey('characters:revision:v2'));

    expect((await getPublicCharacterList()).characters).not.toContainEqual({ id, name });
  });

  it('serves targets from the beginner difficulty pool', async () => {
    const name = `cache-test-beginner-${Date.now()}`;
    const [row] = await db('characters').insert({
      name,
      work: '测试',
      company: '测试',
      release_year: 2020,
      gender: '女',
      cv: '测试',
      hair_color: '蓝色',
      hair_color_family: 'blue',
      is_enabled: true,
    }).returning('id');
    const id = Number(typeof row === 'object' ? row.id : row);
    await db('character_difficulties').insert({ character_id: id, difficulty_key: 'beginner' });

    await refreshCharacterCache();

    expect(isDifficultyAvailable('beginner')).toBe(true);
    expect(pickCachedTarget('beginner')?.difficulties).toContain('beginner');
  });
});
