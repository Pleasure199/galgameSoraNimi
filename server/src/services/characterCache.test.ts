import { beforeAll, describe, expect, it } from 'vitest';
import {
  computeCatalogVersion,
  getDifficultyCharacters,
  getEnabledCharacter,
  getEnabledCharacters,
  getPublicCharacterList,
  getWorks,
  searchCachedCharactersByWork,
  initCharacterCache,
  isDifficultyAvailable,
  pickCachedTarget,
  searchCachedCharacters,
} from './characterCache';

describe('character catalog', () => {
  beforeAll(async () => {
    await initCharacterCache();
  });

  it('loads every character from PostgreSQL with deterministic ids', async () => {
    const list = await getPublicCharacterList();

    expect(list.version).toMatch(/^[0-9a-f]{16}$/);
    expect(list.characters).toHaveLength(13373);
    expect(list.characters.find((character) => character.id === 1)).toMatchObject({
      id: 1,
      name: '神尾观铃',
      difficulties: ['beginner', 'easy', 'normal', 'hard', 'complete'],
    });
    expect(getEnabledCharacter(1)).toMatchObject({
      id: 1,
      name: '神尾观铃',
      work: 'AIR',
      difficulties: ['beginner', 'easy', 'normal', 'hard', 'complete'],
    });
    expect(getEnabledCharacters()).toHaveLength(13373);
  });

  it('changes the catalog version when difficulties change', () => {
    const base = { id: 1, name: '在原七海', difficulties: ['normal'], data_version: 'vndb-2026-08-07' };
    const promoted = { ...base, difficulties: ['beginner', 'easy', 'normal'] };
    expect(computeCatalogVersion([base])).not.toBe(computeCatalogVersion([promoted]));
  });

  it('builds difficulty pools and targets from the catalog', () => {
    expect(isDifficultyAvailable('beginner')).toBe(true);
    expect(getDifficultyCharacters('beginner')).toContainEqual(
      expect.objectContaining({ id: 14 })
    );
    expect(getDifficultyCharacters('unknown')).toEqual([]);

    const target = pickCachedTarget('beginner');
    expect(target).not.toBeNull();
    expect(getDifficultyCharacters('beginner')).toContainEqual(target);
  });

  it('searches by name, work and cv', () => {
    expect(searchCachedCharacters('神尾', 10)).toContainEqual(
      expect.objectContaining({ id: 1 })
    );
    expect(searchCachedCharacters('AIR', 100)).toContainEqual(
      expect.objectContaining({ id: 1 })
    );
    expect(searchCachedCharacters('川上とも子', 100)).toContainEqual(
      expect.objectContaining({ id: 1 })
    );
  });

  it('returns every character under a work', () => {
    const air = searchCachedCharactersByWork('AIR', 1000);
    expect(air.length).toBeGreaterThan(1);
    expect(air.every((character) => character.work.includes('AIR'))).toBe(true);
  });

  it('lists works with their companies', () => {
    const works = getWorks();
    expect(works.length).toBeGreaterThan(0);
    expect(works.find((work) => work.name === 'AIR')).toMatchObject({
      name: 'AIR',
      company: 'Key',
    });
  });
});
