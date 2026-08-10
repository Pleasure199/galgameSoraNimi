import http from 'http';
import express from 'express';
import { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../db/knex';
import { initDb } from '../db/init';
import { errorHandler } from '../middleware/common';
import { initRedis } from '../redis';
import { invalidateCached } from '../services/queryCache';
import announcementRoutes from './announcements';

let server: http.Server;
let baseUrl: string;

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  return { response, data: await response.json() };
}

describe('popup announcements', () => {
  beforeAll(async () => {
    await initDb();
    await initRedis();
    const app = express();
    app.use(express.json());
    app.use('/api/announcements', announcementRoutes);
    app.use(errorHandler);
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    if (!server) return;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('returns the popup flag for persisted announcements', async () => {
    const stamp = Date.now();
    const title = `popup-${stamp}`;
    const inserted = await db('announcements')
      .insert({ title, content: '必须确认', is_popup: true })
      .returning('id')
      .then((rows) => rows.map((item: any) => typeof item === 'object' ? item.id : item));
    const id = inserted[0];
    await invalidateCached('announcements');

    try {
      const list = await request('/api/announcements');
      expect(list.response.status).toBe(200);
      expect(list.data).toContainEqual(expect.objectContaining({
        id,
        title,
        is_popup: true,
      }));
    } finally {
      await db('announcements').where({ id }).del();
      await invalidateCached('announcements');
    }
  });
});
