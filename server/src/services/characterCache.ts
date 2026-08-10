import crypto from 'crypto';
import { Character } from '../types';
import { DIFFICULTY_LEVELS } from '../difficulties';
import { db } from '../db/knex';

interface CharacterSeed {
  id?: number;
  name: string;
  work: string;
  company: string;
  release_year: number;
  gender: string;
  cv: string;
  hair_color: string;
  hair_color_family: string;
  hair_length?: string;
  height?: number | null;
  difficulties?: string[];
  is_enabled?: boolean;
  data_version?: string;
}

type PublicCharacter = { id: number; name: string; difficulties: string[] };
let charactersById = new Map<number, Character>();
let allCharacters: Character[] = [];
let charactersByDifficulty = new Map<string, Character[]>();
let publicList: { version: string; characters: PublicCharacter[] } = {
  version: '1',
  characters: [],
};

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`[characters] ${label} must be a string`);
  }
  return value;
}

async function loadCharacterCatalog(): Promise<{ version: string; characters: Character[] }> {
  const rows = await db('characters').orderBy('id');
  const seeds = rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    work: row.work,
    company: row.company,
    release_year: Number(row.release_year),
    gender: row.gender,
    cv: row.cv,
    hair_color: row.hair_color,
    hair_color_family: row.hair_color_family,
    hair_length: row.hair_length,
    height: row.height == null ? null : Number(row.height),
    difficulties: JSON.parse(String(row.difficulties)) as string[],
    is_enabled: Boolean(row.is_enabled),
    data_version: String(row.data_version ?? ''),
  })) as CharacterSeed[];
  const difficultyKeys = new Set<string>(DIFFICULTY_LEVELS.map((difficulty) => difficulty.key));
  const seenNames = new Set<string>();
  const characters = seeds.map((seed, index) => {
    const id = Number(seed.id ?? index + 1);
    const name = assertString(seed.name, `name at index ${index}`).trim();
    if (!name || seenNames.has(name)) {
      throw new Error(`[characters] duplicate or missing name at index ${index}`);
    }
    seenNames.add(name);
    if (!Number.isInteger(seed.release_year)) {
      throw new Error(`[characters] ${name} release_year must be an integer`);
    }
    const difficulties = seed.difficulties ?? ['normal'];
    if (
      !Array.isArray(difficulties) ||
      !difficulties.length ||
      difficulties.some((difficulty) => typeof difficulty !== 'string' || !difficulty.trim())
    ) {
      throw new Error(`[characters] ${name} difficulties must be a non-empty string array`);
    }
    if (difficulties.some((difficulty) => !difficultyKeys.has(String(difficulty)))) {
      throw new Error(`[characters] ${name} contains an unknown difficulty`);
    }
    return {
      id,
      name,
      work: assertString(seed.work, `${name} work`),
      company: assertString(seed.company, `${name} company`),
      release_year: seed.release_year,
      gender: assertString(seed.gender, `${name} gender`),
      cv: assertString(seed.cv, `${name} cv`),
      hair_color: assertString(seed.hair_color, `${name} hair_color`),
      hair_color_family: assertString(seed.hair_color_family, `${name} hair_color_family`),
      hair_length: assertString(seed.hair_length ?? '未知', `${name} hair_length`),
      height: seed.height ?? null,
      difficulties: difficulties as string[],
      is_enabled: seed.is_enabled ?? true,
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  const version = crypto.createHash('sha256')
    .update('character-list-v3\0')
    .update(String(rows.length))
    .update(seeds[0]?.data_version ?? '')
    .digest('hex')
    .slice(0, 16);
  return { version, characters };
}

export async function initCharacterCache(): Promise<void> {
  const { version, characters } = await loadCharacterCatalog();
  charactersById = new Map(characters.map((character) => [character.id, character]));
  allCharacters = characters.filter((character) => Boolean(character.is_enabled));
  charactersByDifficulty = new Map(
    DIFFICULTY_LEVELS
      .filter((difficulty) => difficulty.isEnabled)
      .map((difficulty) => [difficulty.key, [] as Character[]])
  );
  for (const character of allCharacters) {
    for (const difficultyKey of character.difficulties) {
      charactersByDifficulty.get(difficultyKey)?.push(character);
    }
  }
  publicList = {
    version,
    characters: allCharacters.map((character) => ({
      id: character.id,
      name: character.name,
      difficulties: character.difficulties,
    })),
  };
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
  for (const character of allCharacters) {
    const searchable = normalizeSearch(`${character.name}\0${character.work}\0${character.cv}`);
    if (!searchable.includes(normalized)) continue;
    result.push(character);
    if (result.length >= limit) break;
  }
  return result;
}

export async function getPublicCharacterList(): Promise<typeof publicList> {
  return publicList;
}
