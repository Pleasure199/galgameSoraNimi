import { ensureSchema } from './schema';

export async function initDb(): Promise<void> {
  await ensureSchema();
}
