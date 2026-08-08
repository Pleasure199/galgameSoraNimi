import { db } from '../db/knex';
import { redis, redisKey, redisPublisher, redisSubscriber } from '../redis';
import { Character } from '../types';
import { DIFFICULTY_LEVELS } from '../difficulties';

const INVALIDATE_CHANNEL = redisKey('characters:invalidate');
// v1 stored a SHA string and cannot be incremented safely during rolling upgrades.
const VERSION_KEY = redisKey('characters:revision:v2');
const REFRESH_DEBOUNCE_MS = 100;

type PublicCharacter = { id: number; name: string };
type SearchableCharacter = { character: Character; search: string };
let charactersById = new Map<number, Character>();
let allCharacters: Character[] = [];
let charactersByDifficulty = new Map<string, Character[]>();
let searchableCharacters: SearchableCharacter[] = [];
let publicList: { version: string; characters: PublicCharacter[] } = {
  version: '1',
  characters: [],
};
let refreshPromise: Promise<void> | null = null;
let refreshTimer: NodeJS.Timeout | null = null;
let refreshGeneration = 0;
let pendingVersion: string | null = null;

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export async function refreshCharacterCache(): Promise<void> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    let appliedGeneration = -1;
    while (appliedGeneration !== refreshGeneration) {
      const requestedGeneration = refreshGeneration;
      const [rows, memberships, storedVersion] = await Promise.all([
        db<Character>('characters').orderBy('name'),
        db('character_difficulties').select('character_id', 'difficulty_key'),
        redis()?.get(VERSION_KEY) ?? Promise.resolve(null),
      ]);
      const hydrated = rows.map((character) => ({ ...character, difficulties: [] as string[] }));
      const hydratedById = new Map(hydrated.map((character) => [Number(character.id), character]));
      charactersByDifficulty = new Map(
        DIFFICULTY_LEVELS
          .filter((difficulty) => difficulty.isEnabled)
          .map((difficulty) => [difficulty.key, [] as Character[]])
      );
      for (const membership of memberships) {
        const character = hydratedById.get(Number(membership.character_id));
        if (!character) continue;
        const difficultyKey = String(membership.difficulty_key);
        character.difficulties.push(difficultyKey);
        if (Boolean(character.is_enabled)) charactersByDifficulty.get(difficultyKey)?.push(character);
      }
      allCharacters = hydrated.filter((character) => Boolean(character.is_enabled));
      charactersById = new Map(hydrated.map((character) => [character.id, character]));
      searchableCharacters = allCharacters.map((character) => ({
        character,
        search: normalizeSearch(`${character.name}\0${character.work}\0${character.cv}`),
      }));
      publicList = {
        version: pendingVersion || storedVersion || String(Date.now()),
        characters: allCharacters.map((character) => ({ id: character.id, name: character.name })),
      };
      pendingVersion = null;
      appliedGeneration = requestedGeneration;
    }
  })().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

function scheduleCharacterCacheRefresh(): void {
  refreshGeneration += 1;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    void refreshCharacterCache().catch((err) => console.error('[characters] refresh failed', err));
  }, REFRESH_DEBOUNCE_MS);
  refreshTimer.unref?.();
}

export async function initCharacterCache(): Promise<void> {
  const client = redis();
  if (client) {
    await client.set(VERSION_KEY, '1', { NX: true });
    const subscriber = redisSubscriber();
    if (subscriber) await subscriber.subscribe(INVALIDATE_CHANNEL, scheduleCharacterCacheRefresh);
  }
  await refreshCharacterCache();
}

export function getCharacter(id: number): Character | undefined {
  return charactersById.get(id);
}

export function getEnabledCharacter(id: number): Character | undefined {
  const character = charactersById.get(id);
  return character && Boolean(character.is_enabled) ? character : undefined;
}

export function getEnabledCharacters(): Character[] {
  return allCharacters.slice();
}

export function getDifficultyCharacters(key: string): Character[] {
  return charactersByDifficulty.get(key) ?? [];
}

export function pickCachedTarget(mode: string): Character | null {
  const pool = charactersByDifficulty.get(mode) ?? [];
  return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
}

export function isDifficultyAvailable(key: string): boolean {
  const difficulty = DIFFICULTY_LEVELS.find((item) => item.key === key);
  return Boolean(difficulty?.isEnabled && (charactersByDifficulty.get(key)?.length ?? 0) > 0);
}

export function searchCachedCharacters(search: string, limit: number): Character[] {
  const normalized = normalizeSearch(search);
  if (!normalized) return allCharacters.slice(0, limit);
  const result: Character[] = [];
  for (const entry of searchableCharacters) {
    if (!entry.search.includes(normalized)) continue;
    result.push(entry.character);
    if (result.length >= limit) break;
  }
  return result;
}

export async function getPublicCharacterList(): Promise<typeof publicList> {
  const storedVersion = await redis()?.get(VERSION_KEY);
  if (storedVersion && storedVersion !== publicList.version) {
    pendingVersion = storedVersion;
    refreshGeneration += 1;
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    await refreshCharacterCache();
  }
  return publicList;
}

export async function invalidateCharacterCache(): Promise<void> {
  const client = redis();
  let nextVersion = String(Date.now());
  if (client) {
    try {
      nextVersion = String(await client.incr(VERSION_KEY));
    } catch (err) {
      console.warn('[characters] cache revision update failed', err instanceof Error
        ? err.message
        : err);
    }
  }
  pendingVersion = nextVersion;
  refreshGeneration += 1;
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  await refreshCharacterCache();
  if (client) {
    try {
      await redisPublisher()?.publish(INVALIDATE_CHANNEL, nextVersion);
    } catch (err) {
      console.warn('[characters] cache invalidation notification failed', err instanceof Error
        ? err.message
        : err);
    }
  }
}
