import { DIFFICULTY_LEVELS } from '../difficulties';

export function leaderboardCacheKey(mode: 'single', difficulty: string): string {
  return `leaderboard:${mode}:${difficulty}`;
}

export function allLeaderboardCacheKeys(): string[] {
  return DIFFICULTY_LEVELS.map((difficulty) => leaderboardCacheKey('single', difficulty.key));
}
