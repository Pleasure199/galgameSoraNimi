import { describe, expect, it } from 'vitest';
import { AVAILABLE_DIFFICULTIES, DIFFICULTIES } from './difficulties';

describe('difficulty config', () => {
  it('keeps the available difficulty levels sorted', () => {
    expect(AVAILABLE_DIFFICULTIES.map((item) => item.key)).toEqual([
      'beginner',
      'easy',
      'normal',
      'hard',
      'complete',
    ]);
    expect(DIFFICULTIES.find((item) => item.key === 'beginner')?.sortOrder).toBeLessThan(
      DIFFICULTIES.find((item) => item.key === 'easy')?.sortOrder ?? Infinity
    );
    expect(DIFFICULTIES.find((item) => item.key === 'easy')?.sortOrder).toBeLessThan(
      DIFFICULTIES.find((item) => item.key === 'normal')?.sortOrder ?? Infinity
    );
    expect(DIFFICULTIES.find((item) => item.key === 'normal')?.sortOrder).toBeLessThan(
      DIFFICULTIES.find((item) => item.key === 'hard')?.sortOrder ?? Infinity
    );
    expect(DIFFICULTIES.find((item) => item.key === 'hard')?.sortOrder).toBeLessThan(
      DIFFICULTIES.find((item) => item.key === 'complete')?.sortOrder ?? Infinity
    );
  });

});
