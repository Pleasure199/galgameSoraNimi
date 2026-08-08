import { Character, GuessFeedback, AttributeFeedback } from '../types';

const RELEASE_YEAR_CLOSE_RANGE = 2;

function textAttr(guess: string, target: string): AttributeFeedback {
  return { value: guess, level: guess === target ? 'correct' : 'wrong' };
}

/** 发色:相同 correct;不同但同色系 close */
function hairColorAttr(guess: Character, target: Character): AttributeFeedback {
  if (guess.hair_color === target.hair_color)
    return { value: guess.hair_color, level: 'correct' };
  if (guess.hair_color_family && guess.hair_color_family === target.hair_color_family)
    return { value: guess.hair_color, level: 'close' };
  return { value: guess.hair_color, level: 'wrong' };
}

function numberAttr(
  guessVal: number,
  targetVal: number,
  closeRange: number
): AttributeFeedback {
  if (guessVal === targetVal) return { value: guessVal, level: 'correct' };
  const level = Math.abs(guessVal - targetVal) <= closeRange ? 'close' : 'wrong';
  return {
    value: guessVal,
    level,
    hint: targetVal > guessVal ? 'higher' : 'lower',
  };
}

/** 逐属性对比猜测角色与目标角色,产出反馈 */
export function compareGuess(guess: Character, target: Character): GuessFeedback {
  const correct = guess.id === target.id;
  return {
    characterId: guess.id,
    name: guess.name,
    correct,
    attributes: {
      work: textAttr(guess.work, target.work),
      company: textAttr(guess.company, target.company),
      releaseYear: numberAttr(guess.release_year, target.release_year, RELEASE_YEAR_CLOSE_RANGE),
      gender: textAttr(guess.gender, target.gender),
      cv: textAttr(guess.cv, target.cv),
      hairColor: hairColorAttr(guess, target),
    },
  };
}

export const MAX_GUESSES = 8;
