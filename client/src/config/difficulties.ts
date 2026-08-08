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

/** 暂时固定难度：删除难度选择后，客户端统一使用普通档（完整角色池）。 */
export const SINGLE_MODE = 'normal';
