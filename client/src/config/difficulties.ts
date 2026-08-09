export interface DifficultyOption {
  key: string;
  sortOrder: number;
  enabled: boolean;
  recommended?: boolean;
}

export const DIFFICULTIES: DifficultyOption[] = [
  { key: 'beginner', sortOrder: 5, enabled: true, recommended: true },
  { key: 'easy', sortOrder: 10, enabled: true },
  { key: 'normal', sortOrder: 20, enabled: true },
];

export const AVAILABLE_DIFFICULTIES = DIFFICULTIES
  .filter((difficulty) => difficulty.enabled)
  .sort((a, b) => a.sortOrder - b.sortOrder);

/** 排行榜等未接入多难度筛选的页面仍使用完整版作为默认档。 */
export const SINGLE_MODE = 'normal';
