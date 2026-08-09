export interface User {
  id: number;
  username: string;
  display_id: string | null;
  password_hash: string;
  role: 'user' | 'admin';
  token_version: number;
  created_at: string;
}

export interface Character {
  id: number;
  /** 角色名，唯一、可猜，猜中即胜 */
  name: string;
  /** 作品 */
  work: string;
  /** 所属会社 */
  company: string;
  /** 发售时间（年） */
  release_year: number;
  /** 性别 */
  gender: string;
  /** 声优 */
  cv: string;
  /** 发色 */
  hair_color: string;
  /** 色系（隐藏字段，仅用于发色 close 判定） */
  hair_color_family: string;
  /** 发长 */
  hair_length: string;
  /** 身高（cm），未知为 null */
  height: number | null;
  /** 难度归属，直接来自角色 JSON 数据集 */
  difficulties: string[];
  is_enabled: boolean;
}

export type FeedbackLevel = 'correct' | 'close' | 'wrong';

export interface AttributeFeedback {
  value: string | number | boolean;
  level: FeedbackLevel;
  /** 数值型属性的方向提示: higher = 目标比猜测大 */
  hint?: 'higher' | 'lower';
}

export interface GuessFeedback {
  characterId: number;
  name: string;
  correct: boolean;
  attributes: {
    work: AttributeFeedback;
    company: AttributeFeedback;
    releaseYear: AttributeFeedback;
    gender: AttributeFeedback;
    cv: AttributeFeedback;
    hairColor: AttributeFeedback;
    hairLength: AttributeFeedback;
    height: AttributeFeedback;
  };
}

export interface GameRow {
  id: number;
  session_id: string | null;
  user_id: number | null;
  guest_key: string | null;
  target_character_id: number;
  mode: string;
  guesses: string;
  guess_times: string;
  status: 'playing' | 'won' | 'lost';
  guess_count: number;
  created_at: string;
  finished_at: string | null;
}
