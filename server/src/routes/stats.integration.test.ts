import http from 'http';
import express from 'express';
import jwt from 'jsonwebtoken';
import { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import statsRoutes from './stats';
import { config } from '../config';
import { db } from '../db/knex';
import { initDb } from '../db/init';
import { initRedis } from '../redis';
import { errorHandler } from '../middleware/common';
import { initCharacterCache, getCharacter } from '../services/characterCache';
import { invalidateCached } from '../services/queryCache';
import { allGlobalStatsCacheKeys } from '../services/statsCache';

let server: http.Server;
let baseUrl: string;

function guestCookie(key: string): string {
  const token = jwt.sign({ key, typ: 'guest' }, config.jwtSecret, {
    expiresIn: '1h',
    algorithm: 'HS256',
  });
  return `tianyiba_guest=${token}`;
}

async function request(path: string, cookie: string) {
  const response = await fetch(`${baseUrl}${path}`, { headers: { Cookie: cookie } });
  return { response, data: await response.json() };
}

describe('stats and replay', () => {
  beforeAll(async () => {
    await initDb();
    await initRedis();
    await initCharacterCache();
    const app = express();
    app.use('/api/stats', statsRoutes);
    app.use(errorHandler);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('returns personal and global stats and protects replay ownership', async () => {
    const stamp = Date.now();
    const ownerKey = `stats-owner-${stamp}`;
    const otherKey = `stats-other-${stamp}`;
    const sessionId = `stats-session-${stamp}`;
    const [characterRow] = await db('characters').select('id').limit(1);
    const target = getCharacter(Number(characterRow.id))!;
    const [gameId] = await db('games')
      .insert({
        session_id: sessionId,
        guest_key: ownerKey,
        target_character_id: target.id,
        mode: 'easy',
        guesses: JSON.stringify([target.id]),
        first_guess_character_id: target.id,
        status: 'won',
        guess_count: 1,
        finished_at: db.fn.now(),
      })
      .returning('id')
      .then((rows) => rows.map((item: any) => typeof item === 'object' ? item.id : item));
    await invalidateCached(...allGlobalStatsCacheKeys());

    try {
      const easyStats = await request('/api/stats/me?difficulties=easy', guestCookie(ownerKey));
      expect(easyStats.response.status).toBe(200);
      expect(easyStats.data.difficulties).toEqual(['easy']);
      expect(easyStats.data.personal.totalGames).toBe(1);
      expect(easyStats.data.personal.wins).toBe(1);
      expect(easyStats.data.personal.winRate).toBe(1);
      expect(easyStats.data.personal.firstGuess).toEqual({
        characterId: target.id,
        name: target.name,
        percentage: 1,
      });
      expect(easyStats.data.global.totalGames).toBeGreaterThanOrEqual(1);
      expect(easyStats.data.global.firstGuess).toMatchObject({
        characterId: expect.any(Number),
        name: expect.any(String),
        percentage: expect.any(Number),
      });
      expect(easyStats.data.global.firstGuess.percentage).toBeGreaterThan(0);
      expect(easyStats.data.global.firstGuess.percentage).toBeLessThanOrEqual(1);

      const normalStats = await request('/api/stats/me?difficulties=normal', guestCookie(ownerKey));
      expect(normalStats.response.status).toBe(200);
      expect(normalStats.data.difficulties).toEqual(['normal']);
      expect(normalStats.data.personal).toMatchObject({
        totalGames: 0,
        wins: 0,
        winRate: 0,
        bestGuesses: null,
      });

      const combinedStats = await request('/api/stats/me?difficulties=normal,easy', guestCookie(ownerKey));
      expect(combinedStats.response.status).toBe(200);
      expect(combinedStats.data.difficulties).toEqual(['easy', 'normal']);
      expect(combinedStats.data.personal).toMatchObject({ totalGames: 1, wins: 1 });

      const singleList = await request('/api/stats/replays?type=single&page=1&pageSize=5', guestCookie(ownerKey));
      expect(singleList.response.status).toBe(200);
      expect(singleList.data.items[0]).toMatchObject({ type: 'single', id: gameId });

      const replay = await request(`/api/stats/games/${gameId}/replay`, guestCookie(ownerKey));
      expect(replay.response.status).toBe(200);
      expect(replay.data.answer.name).toBe(target.name);
      expect(replay.data.answer.work).toBe(target.work);
      expect(replay.data.guesses).toHaveLength(1);
      expect(replay.data.guesses[0].correct).toBe(true);
      expect(replay.data.guesses[0].characterId).toBe(target.id);

      const forbidden = await request(`/api/stats/games/${gameId}/replay`, guestCookie(otherKey));
      expect(forbidden.response.status).toBe(404);
      expect(forbidden.data.code).toBe('GAME_NOT_FOUND');
    } finally {
      await db('games').where({ session_id: sessionId }).del();
      await invalidateCached(...allGlobalStatsCacheKeys());
    }
  });

  it('counts current and legacy first guesses and excludes invalid character ids', async () => {
    const stamp = Date.now();
    const ownerKey = `first-guess-owner-${stamp}`;
    const characters = await db('characters').select('id').orderBy('id').limit(2);
    const favorite = getCharacter(Number(characters[0].id))!;
    const other = getCharacter(Number(characters[1].id))!;
    const games: Array<{ suffix: string; guesses: unknown[]; firstGuessCharacterId: number | null }> = [
      { suffix: 'current', guesses: [favorite.id], firstGuessCharacterId: favorite.id },
      { suffix: 'legacy', guesses: [{ characterId: favorite.id }], firstGuessCharacterId: null },
      { suffix: 'other', guesses: [other.id], firstGuessCharacterId: other.id },
      { suffix: 'invalid', guesses: [99999999], firstGuessCharacterId: 0 },
    ];

    await db('games').insert(games.map((game) => ({
      session_id: `first-guess-${game.suffix}-${stamp}`,
      guest_key: ownerKey,
      target_character_id: favorite.id,
      mode: 'easy',
      guesses: JSON.stringify(game.guesses),
      first_guess_character_id: game.firstGuessCharacterId,
      status: 'won',
      guess_count: 1,
      finished_at: db.fn.now(),
    })));

    try {
      const stats = await request('/api/stats/me?difficulties=easy', guestCookie(ownerKey));
      expect(stats.response.status).toBe(200);
      expect(stats.data.personal.firstGuess).toEqual({
        characterId: favorite.id,
        name: favorite.name,
        percentage: 2 / 3,
      });
    } finally {
      await db('games').where({ guest_key: ownerKey }).del();
      await invalidateCached(...allGlobalStatsCacheKeys());
    }
  });

  it('rejects unavailable difficulty filters', async () => {
    const stats = await request('/api/stats/me?difficulties=easy,impossible', guestCookie(`invalid-stats-${Date.now()}`));
    expect(stats.response.status).toBe(400);
    expect(stats.data.code).toBe('DIFFICULTY_UNAVAILABLE');
  });
});
