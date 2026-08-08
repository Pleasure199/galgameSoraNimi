import { api } from './client';

export interface CharacterSuggestion {
  id: number;
  name: string;
}

interface CachedCharacterList {
  version: string;
  characters: CharacterSuggestion[];
}

const STORAGE_KEY = 'character-list-v1';
const REVALIDATE_INTERVAL_MS = 30_000;
let memory: CachedCharacterList | null = null;
let loading: Promise<CharacterSuggestion[]> | null = null;
let validatedAt: number | null = null;
let cacheGeneration = 0;
const listeners = new Set<(characters: CharacterSuggestion[]) => void>();

function removeStored(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Browser storage may be unavailable; the in-memory cache still works.
  }
}

function writeStored(value: CachedCharacterList): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Keep serving the in-memory snapshot when persistence is unavailable.
  }
}

function publish(characters: CharacterSuggestion[]): void {
  for (const listener of listeners) {
    try {
      listener(characters);
    } catch {
      // One mounted consumer must not break cache refresh for the others.
    }
  }
}

function readStored(): CachedCharacterList | null {
  if (memory) return memory;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as CachedCharacterList | null;
    if (parsed?.characters?.length) memory = parsed;
  } catch {
    removeStored();
  }
  return memory;
}

async function refresh(cached: CachedCharacterList | null, generation: number): Promise<CharacterSuggestion[]> {
  const response = await api.get('/characters/list', {
    headers: cached ? { 'If-None-Match': `\"characters-${cached.version}\"` } : undefined,
    validateStatus: (status) => (status >= 200 && status < 300) || status === 304,
  });
  if (generation !== cacheGeneration) return memory?.characters ?? cached?.characters ?? [];
  if (response.status === 304 && cached) {
    memory = cached;
    validatedAt = performance.now();
    return cached.characters;
  }
  const next: CachedCharacterList = {
    version: String(response.data.version),
    characters: response.data.characters,
  };
  memory = next;
  validatedAt = performance.now();
  writeStored(next);
  if (!cached || cached.version !== next.version) publish(next.characters);
  return next.characters;
}

function startRefresh(cached: CachedCharacterList | null): Promise<CharacterSuggestion[]> {
  if (loading) return loading;
  const task = refresh(cached, cacheGeneration);
  loading = task;
  void task.then(
    () => { if (loading === task) loading = null; },
    () => { if (loading === task) loading = null; }
  );
  return task;
}

function revalidateInBackground(cached: CachedCharacterList): void {
  if (validatedAt !== null && performance.now() - validatedAt <= REVALIDATE_INTERVAL_MS) return;
  void startRefresh(cached).catch(() => undefined);
}

export async function getCharacterList(): Promise<CharacterSuggestion[]> {
  const cached = readStored();
  if (cached) {
    revalidateInBackground(cached);
    return cached.characters;
  }
  return startRefresh(null);
}

export function subscribeCharacterList(listener: (characters: CharacterSuggestion[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function clearCharacterListCache(): void {
  cacheGeneration += 1;
  memory = null;
  loading = null;
  validatedAt = null;
  removeStored();
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function matchScore(name: string, query: string): number {
  const characterName = normalizeSearch(name);
  if (characterName === query) return 0;
  if (characterName.startsWith(query)) return 1;
  if (characterName.includes(query)) return 2;
  return Number.POSITIVE_INFINITY;
}

export function searchCharacterList(characters: CharacterSuggestion[], query: string): CharacterSuggestion[] {
  const normalized = normalizeSearch(query);
  if (!normalized) return [];
  return characters
    .map((character) => ({ character, score: matchScore(character.name, normalized) }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((a, b) => a.score - b.score || a.character.name.localeCompare(b.character.name))
    .map((entry) => entry.character)
    .slice(0, 10);
}
