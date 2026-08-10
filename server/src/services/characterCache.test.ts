import { beforeAll, describe, expect, it } from 'vitest';
import {
  getDifficultyCharacters,
  getEnabledCharacter,
  getEnabledCharacters,
  getPublicCharacterList,
  initCharacterCache,
  isDifficultyAvailable,
  pickCachedTarget,
  searchCachedCharacters,
} from './characterCache';

describe('character JSON catalog', () => {
  beforeAll(async () => {
    await initCharacterCache();
  });

  it('loads every character from characters.json with deterministic ids', async () => {
    const list = await getPublicCharacterList();

    expect(list.version).toMatch(/^[0-9a-f]{16}$/);
    expect(list.characters).toHaveLength(13373);
    expect(list.characters.find((character) => character.id === 1)).toMatchObject({
      id: 1,
      name: '神尾观铃',
      difficulties: ['normal', 'easy', 'beginner'],
    });
    expect(getEnabledCharacter(1)).toMatchObject({
      id: 1,
      name: '神尾观铃',
      work: 'AIR',
      difficulties: ['normal', 'easy', 'beginner'],
    });
    expect(getEnabledCharacters()).toHaveLength(13373);
  });

  it('builds difficulty pools and targets from the JSON data', () => {
    expect(isDifficultyAvailable('beginner')).toBe(true);
    expect(getDifficultyCharacters('beginner')).toContainEqual(
      expect.objectContaining({ id: 1 })
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
});
