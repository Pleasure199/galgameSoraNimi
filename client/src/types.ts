export type FeedbackLevel = 'correct' | 'close' | 'wrong';

export interface AttributeFeedback {
  value: string | number | boolean;
  level: FeedbackLevel;
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

export interface UserInfo {
  id: number;
  username: string;
  role: 'user' | 'admin';
}

export interface CharacterInfo {
  id: number;
  name: string;
  work: string;
  company: string;
  releaseYear: number;
  gender: string;
  cv: string;
  hairColor: string;
  hairLength: string;
  height: number | null;
}
