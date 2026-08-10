import { describe, it, expect } from 'vitest';
import { compareGuess, MAX_GUESSES } from './gameService';
import { Character } from '../types';

function makeCharacter(overrides: Partial<Character>): Character {
  return {
    id: 1,
    name: '牧濑红莉栖',
    work: 'STEINS;GATE',
    company: 'MAGES.',
    release_year: 2009,
    gender: '女',
    cv: '今井麻美',
    hair_color: '红色',
    hair_color_family: 'red',
    hair_length: '长发',
    writer: '林直孝',
    is_enabled: true,
    difficulties: ['normal'],
    ...overrides,
  };
}

describe('compareGuess', () => {
  const target = makeCharacter({ id: 10 });

  it('猜中时所有属性 correct', () => {
    const fb = compareGuess(target, target);
    expect(fb.correct).toBe(true);
    expect(Object.values(fb.attributes).every((a) => a.level === 'correct')).toBe(true);
  });

  it('作品不同给 wrong', () => {
    const guess = makeCharacter({ id: 2, work: 'CLANNAD' });
    expect(compareGuess(guess, target).attributes.work.level).toBe('wrong');
  });

  it('会社不同给 wrong', () => {
    const guess = makeCharacter({ id: 2, company: 'Key' });
    expect(compareGuess(guess, target).attributes.company.level).toBe('wrong');
  });

  it('性别不同给 wrong', () => {
    const guess = makeCharacter({ id: 2, gender: '男' });
    expect(compareGuess(guess, target).attributes.gender.level).toBe('wrong');
  });

  it('声优不同给 wrong', () => {
    const guess = makeCharacter({ id: 2, cv: '花澤香菜' });
    expect(compareGuess(guess, target).attributes.cv.level).toBe('wrong');
  });

  it('发售时间相差 2 年给 close 并带方向提示', () => {
    const guess = makeCharacter({ id: 2, release_year: target.release_year - 2 });
    const fb = compareGuess(guess, target);
    expect(fb.attributes.releaseYear.level).toBe('close');
    expect(fb.attributes.releaseYear.hint).toBe('higher');
  });

  it('发售时间相差 3 年给 wrong 并带方向提示', () => {
    const guess = makeCharacter({ id: 2, release_year: target.release_year + 3 });
    const fb = compareGuess(guess, target);
    expect(fb.attributes.releaseYear.level).toBe('wrong');
    expect(fb.attributes.releaseYear.hint).toBe('lower');
  });

  it('发色相同给 correct', () => {
    const guess = makeCharacter({ id: 2, hair_color: '红色' });
    expect(compareGuess(guess, target).attributes.hairColor.level).toBe('correct');
  });

  it('发色不同但同色系给 close', () => {
    const guess = makeCharacter({ id: 2, hair_color: '深红', hair_color_family: 'red' });
    expect(compareGuess(guess, target).attributes.hairColor.level).toBe('close');
  });

  it('发色不同且不同色系给 wrong', () => {
    const guess = makeCharacter({ id: 2, hair_color: '黑色', hair_color_family: 'black' });
    expect(compareGuess(guess, target).attributes.hairColor.level).toBe('wrong');
  });

  it('发长相同给 correct', () => {
    const guess = makeCharacter({ id: 2, hair_length: '长发' });
    expect(compareGuess(guess, target).attributes.hairLength.level).toBe('correct');
  });

  it('发长不同给 wrong', () => {
    const guess = makeCharacter({ id: 2, hair_length: '短发' });
    expect(compareGuess(guess, target).attributes.hairLength.level).toBe('wrong');
  });

  it('剧本家相同给 correct', () => {
    const guess = makeCharacter({ id: 2, writer: '林直孝' });
    expect(compareGuess(guess, target).attributes.writer.level).toBe('correct');
  });

  it('剧本家不同给 wrong', () => {
    const guess = makeCharacter({ id: 2, writer: '麻枝准' });
    expect(compareGuess(guess, target).attributes.writer.level).toBe('wrong');
  });

  it('MAX_GUESSES 与服务端默认一致为 8', () => {
    expect(MAX_GUESSES).toBe(8);
  });
});
