import http from 'http';
import express from 'express';
import { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import leaderboardRoutes from './leaderboard';
import { errorHandler } from '../middleware/common';
import { db } from '../db/knex';
import { initDb } from '../db/init';
import { initRedis } from '../redis';
import { initCharacterCache } from '../services/characterCache';
import { invalidateCached } from '../services/queryCache';
import { signToken, userNameFromUsername } from '../middleware/auth';
import { allLeaderboardCacheKeys } from '../services/leaderboardCache';

let server: http.Server;
let baseUrl: string;

describe('leaderboard', () => {
  beforeAll(async () => {
    await initDb();
    await initRedis();
    await initCharacterCache();
    const app = express();
    app.use('/api/leaderboard', leaderboardRoutes);
    app.use(errorHandler);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('returns at most 50 users with anonymous display IDs', async () => {
    const stamp = Date.now();
    const users = Array.from({ length: 51 }, (_, index) => ({
      username: `leaderboard-${stamp}-${index}`,
      password_hash: 'not-used',
      role: 'user',
      token_version: 0,
    }));
    const inserted = await db('users').insert(users).returning(['id', 'username']);
    const userIds = inserted.map((row: any) => Number(row.id));
    const [target] = await db('characters').select('id').limit(1);
    await db('games').insert(inserted.map((row: any, index: number) => ({
      session_id: `leaderboard-${stamp}-${index}`,
      user_id: Number(row.id),
      target_character_id: Number(target.id),
      mode: 'easy',
      guesses: '[]',
      status: 'won',
      guess_count: 1,
      finished_at: db.fn.now(),
    })));
    await db('games').insert([
      {
        session_id: `leaderboard-${stamp}-beginner-win`,
        user_id: userIds[0],
        target_character_id: Number(target.id),
        mode: 'beginner',
        guesses: '[]',
        status: 'won',
        guess_count: 1,
        finished_at: db.fn.now(),
      },
      {
        session_id: `leaderboard-${stamp}-easy-extra`,
        user_id: userIds[0],
        target_character_id: Number(target.id),
        mode: 'easy',
        guesses: '[]',
        status: 'won',
        guess_count: 1,
        finished_at: db.fn.now(),
      },
      {
        session_id: `leaderboard-${stamp}-normal-a-win`,
        user_id: userIds[0],
        target_character_id: Number(target.id),
        mode: 'normal',
        guesses: '[]',
        status: 'won',
        guess_count: 2,
        finished_at: db.fn.now(),
      },
      {
        session_id: `leaderboard-${stamp}-normal-a-loss`,
        user_id: userIds[0],
        target_character_id: Number(target.id),
        mode: 'normal',
        guesses: '[]',
        status: 'lost',
        guess_count: 8,
        finished_at: db.fn.now(),
      },
      {
        session_id: `leaderboard-${stamp}-normal-b-win`,
        user_id: userIds[1],
        target_character_id: Number(target.id),
        mode: 'normal',
        guesses: '[]',
        status: 'won',
        guess_count: 3,
        finished_at: db.fn.now(),
      },
      {
        session_id: `leaderboard-${stamp}-normal-a-second-win`,
        user_id: userIds[0],
        target_character_id: Number(target.id),
        mode: 'normal',
        guesses: '[]',
        status: 'won',
        guess_count: 4,
        finished_at: db.fn.now(),
      },
    ]);
    await invalidateCached(...allLeaderboardCacheKeys());

    try {
      const beginnerResponse = await fetch(`${baseUrl}/api/leaderboard?difficulty=beginner`);
      const beginnerData = await beginnerResponse.json();
      expect(beginnerResponse.status).toBe(200);
      expect(beginnerData.difficulty).toBe('beginner');
      expect(beginnerData.items[0]).toMatchObject({ id: userIds[0], wins: 1, total: 1 });

      const response = await fetch(`${baseUrl}/api/leaderboard?difficulty=easy`);
      const data = await response.json();
      expect(response.status).toBe(200);
      expect(data.difficulty).toBe('easy');
      expect(data.items).toHaveLength(50);
      expect(data.items[0]).toMatchObject({ id: userIds[0], wins: 2, total: 2, winRate: 1 });
      expect(data.items.every((row: any) => /^用户#[0-9A-Z]{5}$/.test(row.displayId))).toBe(true);
      expect(data.items.every((row: any) => !Object.hasOwn(row, 'username'))).toBe(true);
      expect(data.currentUser).toBeNull();

      const normalResponse = await fetch(`${baseUrl}/api/leaderboard?difficulty=normal`);
      const normalData = await normalResponse.json();
      expect(normalResponse.status).toBe(200);
      expect(normalData.difficulty).toBe('normal');
      expect(normalData.items[0]).toMatchObject({ id: userIds[0], wins: 2, total: 3, winRate: 2 / 3 });
      expect(normalData.items.find((row: any) => row.id === userIds[0])).toMatchObject({
        wins: 2,
        total: 3,
        winRate: 2 / 3,
      });

      const token = signToken({ id: userIds[0], token_version: 0 });
      const ownResponse = await fetch(`${baseUrl}/api/leaderboard?difficulty=normal`, {
        headers: { Cookie: `tianyiba_session=${token}` },
      });
      const ownData = await ownResponse.json();
      expect(ownResponse.status).toBe(200);
      expect(ownData.currentUser).toEqual({
        displayId: userNameFromUsername(users[0].username),
        rank: expect.any(Number),
      });

      await db('users').where({ id: userIds[0] }).update({ leaderboard_hidden: true });
      await invalidateCached(...allLeaderboardCacheKeys());
      for (const hiddenDifficulty of ['beginner', 'easy', 'normal']) {
        const hiddenResponse = await fetch(
          `${baseUrl}/api/leaderboard?difficulty=${hiddenDifficulty}`,
          {
            headers: { Cookie: `tianyiba_session=${token}` },
          }
        );
        const hiddenData = await hiddenResponse.json();
        expect(hiddenResponse.status).toBe(200);
        expect(hiddenData.items.some((row: any) => row.id === userIds[0])).toBe(false);
        expect(hiddenData.currentUser).toEqual({
          displayId: userNameFromUsername(users[0].username),
          rank: null,
        });
      }

      const unavailableResponse = await fetch(`${baseUrl}/api/leaderboard?difficulty=unknown`);
      expect(unavailableResponse.status).toBe(400);
      expect(unavailableResponse.status).toBe(400);
    } finally {
      await db('games').whereIn('user_id', userIds).del();
      await db('users').whereIn('id', userIds).del();
      await invalidateCached(...allLeaderboardCacheKeys());
    }
  });
});
