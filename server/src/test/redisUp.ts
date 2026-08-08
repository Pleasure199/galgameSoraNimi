import net from 'net';
import { config } from '../config';

let cached: boolean | null = null;

/**
 * Fast TCP reachability probe for the configured Redis host, used by tests to
 * skip Redis-dependent cases when the server is not running. Deliberately does
 * not touch the redis module so the suite never hangs on its reconnect loop.
 */
export async function isRedisUp(): Promise<boolean> {
  if (cached !== null) return cached;
  let host = '127.0.0.1';
  let port = 6379;
  try {
    const url = new URL(config.redisUrl);
    host = url.hostname || host;
    port = Number(url.port || port);
  } catch {
    // fall back to defaults
  }
  cached = await new Promise<boolean>((resolve) => {
    const socket = net.connect({ port, host });
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 1500);
    timer.unref?.();
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });
  });
  return cached;
}
