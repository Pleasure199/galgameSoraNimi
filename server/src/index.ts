import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config, validateProductionConfig } from './config';
import { assertDatabaseReady } from './db/ready';
import { db } from './db/knex';
import { errorHandler } from './middleware/common';
import authRoutes from './routes/auth';
import characterRoutes from './routes/characters';
import gameRoutes from './routes/game';
import statsRoutes from './routes/stats';
import leaderboardRoutes from './routes/leaderboard';
import announcementRoutes from './routes/announcements';
import {
  closeRedis,
  initRedis,
  isRedisAvailable,
  isRedisTimeoutError,
} from './redis';
import { initCharacterCache } from './services/characterCache';
import { getResourceVersionNotice } from './services/resourceVersion';
import { rateLimit } from './middleware/rateLimit';
import { closePasswordWorkers } from './services/password';
import { parseJsonOnce, rejectOversizedBody } from './middleware/jsonBody';
import { rejectMissingClientAsset, setClientAssetCacheHeaders } from './middleware/clientAssets';
import { injectUmamiScript } from './services/umami';

const SHUTDOWN_TIMEOUT_MS = 10_000;
const CLOUDFLARE_INSIGHTS_SCRIPT_ORIGIN = 'https://static.cloudflareinsights.com';
const CLOUDFLARE_INSIGHTS_BEACON_ORIGIN = 'https://cloudflareinsights.com';

process.on('unhandledRejection', (reason) => {
  if (isRedisTimeoutError(reason)) {
    console.error('[server:redis-timeout-unhandled]', reason);
    return;
  }
  console.error('[server:unhandled-rejection]', reason);
  setImmediate(() => {
    throw reason instanceof Error ? reason : new Error(String(reason));
  });
});

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      try {
        onTimeout();
        reject(new Error('SHUTDOWN_TIMEOUT'));
      } catch (err) {
        reject(err);
      }
    }, timeoutMs);
    timer.unref?.();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function main() {
  validateProductionConfig();
  console.log('[server] 正在验证数据库结构');
  await assertDatabaseReady();
  console.log('[server] 数据库结构验证通过');
  await initRedis();
  await initCharacterCache();

  const app = express();
  app.set('trust proxy', config.trustProxy ? 1 : false);

  // index.html 含内联脚本(主题开关、启动屏进度),CSP 不放开 unsafe-inline,
  // 而是从实际服务的 HTML 计算各内联脚本的 sha256 哈希加入 script-src
  const clientDist = path.resolve(__dirname, '../../client/dist');
  const clientIndexPath = path.join(clientDist, 'index.html');
  const rawIndexHtml = fs.existsSync(clientIndexPath)
    ? fs.readFileSync(clientIndexPath, 'utf8')
    : null;
  const inlineScriptHashes = rawIndexHtml
    ? [...rawIndexHtml.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
        (match) => `'sha256-${crypto.createHash('sha256').update(match[1], 'utf8').digest('base64')}'`
      )
    : [];

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          CLOUDFLARE_INSIGHTS_SCRIPT_ORIGIN,
          ...(config.umami ? [config.umami.origin] : []),
          ...inlineScriptHashes,
        ],
        workerSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: [
          "'self'",
          ...config.corsOrigins,
          CLOUDFLARE_INSIGHTS_BEACON_ORIGIN,
          ...(config.umami ? [config.umami.origin] : []),
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
  }));
  let shuttingDown = false;
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use((req, res, next) => {
    if (shuttingDown) return res.status(503).json({ code: 'SERVER_SHUTTING_DOWN' });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.headers.origin;
      if (origin && !config.corsOrigins.includes(origin)) {
        return res.status(403).json({ code: 'INVALID_ORIGIN' });
      }
    }
    next();
  });
  app.get('/api/health', async (_req, res) =>
    res.json({
      ok: true,
      redis: isRedisAvailable() ? 'up' : 'degraded',
      features: { leaderboard: config.showLeaderboard },
      resourceVersion: await getResourceVersionNotice().catch(() => null),
    })
  );
  app.use('/api', rateLimit({ name: 'api', limit: 600, windowSeconds: 60 }));
  app.use('/api', rejectOversizedBody(64 * 1024), parseJsonOnce('64kb'));

  app.use('/api/auth', authRoutes);
  app.use('/api/characters', characterRoutes);
  app.use('/api/game', gameRoutes);
  app.use('/api/stats', statsRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);
  app.use('/api/announcements', announcementRoutes);

  // 生产环境托管前端构建产物
  if (rawIndexHtml !== null) {
    const indexHtml = injectUmamiScript(rawIndexHtml, config.umami);
    app.use(express.static(clientDist, { index: false, setHeaders: setClientAssetCacheHeaders }));
    app.use(rejectMissingClientAsset);
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.type('html').send(indexHtml);
    });
  }

  app.use(errorHandler);

  let shutdownPromise: Promise<void> | null = null;
  const server = app.listen(config.port, () => {
    console.log(`[server] 天一把服务已启动: http://localhost:${config.port}`);
    console.log(`[server] allowed origins: ${config.corsOrigins.join(', ')}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      shuttingDown = true;
      console.log(`[server] 收到 ${signal},开始优雅退出`);
      const serverClosed = new Promise<void>((resolve) => {
        server.close(() => resolve());
        server.closeIdleConnections?.();
      });
      await Promise.allSettled([
        withTimeout(serverClosed, SHUTDOWN_TIMEOUT_MS, () => server.closeAllConnections?.()),
        withTimeout(closeRedis(), SHUTDOWN_TIMEOUT_MS, () => undefined),
        withTimeout(closePasswordWorkers(), SHUTDOWN_TIMEOUT_MS, () => undefined),
        withTimeout(db.destroy(), SHUTDOWN_TIMEOUT_MS, () => undefined),
      ]);
      console.log('[server] 优雅退出完成');
    })();
    return shutdownPromise;
  };
  const handleSignal = (signal: string) => {
    const forceExitTimer = setTimeout(() => {
      console.error('[server] 优雅退出超时,强制退出');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS * 2 + 2_000);
    void shutdown(signal)
      .then(() => {
        clearTimeout(forceExitTimer);
        process.exit(0);
      })
      .catch((err) => {
        clearTimeout(forceExitTimer);
        console.error('[server] 优雅退出失败:', err);
        process.exit(1);
      });
  };
  process.once('SIGINT', () => handleSignal('SIGINT'));
  process.once('SIGTERM', () => handleSignal('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] 启动失败:', err);
  process.exit(1);
});
