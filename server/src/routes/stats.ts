import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/knex';
import { optionalAuth } from '../middleware/auth';
import { asyncHandler, HttpError, validateParams, validateQuery } from '../middleware/common';
import { cached } from '../services/queryCache';
import { compareGuess, MAX_GUESSES } from '../services/gameService';
import { getCharacter, isDifficultyAvailable } from '../services/characterCache';
import { Character } from '../types';
import { rateLimit, requestIdentity } from '../middleware/rateLimit';
import { globalStatsCacheKey, personalStatsCacheKey } from '../services/statsCache';
import { DIFFICULTY_LEVELS } from '../difficulties';

const router = Router();
router.use(optionalAuth);

type Owner = { user_id: number } | { guest_key: string };

function ownerFor(req: { user?: { id: number }; guestKey?: string }): Owner | null {
  if (req.user) return { user_id: req.user.id };
  if (req.guestKey) return { guest_key: req.guestKey };
  return null;
}

function identityKeyFor(req: { user?: { id: number }; guestKey?: string }): string | null {
  if (req.user) return `u:${req.user.id}`;
  return req.guestKey ? `g:${req.guestKey}` : null;
}

function qualifiedOwner(owner: Owner, alias: string): Record<string, number | string> {
  return Object.fromEntries(
    Object.entries(owner).map(([key, value]) => [`${alias}.${key}`, value])
  );
}

function singleSummary(row: any) {
  const totalGames = Number(row?.totalGames ?? 0);
  const wins = Number(row?.wins ?? 0);
  return {
    totalGames,
    wins,
    winRate: totalGames ? wins / totalGames : 0,
    avgGuesses: row?.avgGuesses != null ? Number(row.avgGuesses) : null,
    bestGuesses: row?.bestGuesses != null ? Number(row.bestGuesses) : null,
  };
}

function singleAggregate(query: ReturnType<typeof db>) {
  return query
    .whereNot('status', 'playing')
    .first()
    .count({ totalGames: 'id' })
    .sum({ wins: db.raw("case when status = 'won' then 1 else 0 end") })
    .avg({ avgGuesses: db.raw("case when status = 'won' then guess_count else null end") })
    .min({ bestGuesses: db.raw("case when status = 'won' then guess_count else null end") });
}

function firstGuessCharacterId(value: unknown): number | null {
  try {
    const guesses = JSON.parse(String(value));
    if (!Array.isArray(guesses) || !guesses.length) return null;
    const first = guesses[0];
    const id = Number(
      typeof first === 'object' && first
        ? (first as { characterId?: unknown }).characterId
        : first
    );
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}

async function firstGuessSummary(query: ReturnType<typeof db>) {
  const [rows, missingRows] = await Promise.all([
    query.clone()
      .where('first_guess_character_id', '>', 0)
      .select({ characterId: 'first_guess_character_id' })
      .count({ count: '*' })
      .groupBy('first_guess_character_id'),
    query.clone()
      .whereNull('first_guess_character_id')
      .where('guess_count', '>', 0)
      .whereNot('status', 'playing')
      .select('guesses'),
  ]) as unknown as [
    Array<{ characterId: unknown; count: unknown }>,
    Array<{ guesses: unknown }>,
  ];
  const counts = new Map<number, number>();
  for (const row of rows) {
    const characterId = Number(row.characterId);
    const count = Number(row.count);
    if (Number.isInteger(characterId) && characterId > 0 && count > 0) {
      counts.set(characterId, (counts.get(characterId) ?? 0) + count);
    }
  }
  for (const row of missingRows) {
    const characterId = firstGuessCharacterId(row.guesses);
    if (characterId) counts.set(characterId, (counts.get(characterId) ?? 0) + 1);
  }
  const validCounts = Array.from(counts, ([characterId, count]) => ({ characterId, count }))
    .filter((row) => Boolean(getCharacter(row.characterId)));
  const total = validCounts.reduce((sum, row) => sum + row.count, 0);
  const top = validCounts
    .sort((a, b) => b.count - a.count || a.characterId - b.characterId)[0];
  if (!top || !total) return null;
  return {
    characterId: top.characterId,
    name: getCharacter(top.characterId)!.name,
    percentage: top.count / total,
  };
}

function answerView(target: Character) {
  return {
    id: target.id,
    name: target.name,
    work: target.work,
    company: target.company,
    releaseYear: target.release_year,
    gender: target.gender,
    cv: target.cv,
    hairColor: target.hair_color,
  };
}

async function globalStats(difficulties: string[]) {
  return cached(globalStatsCacheKey(difficulties), 60, async () => {
    const [single, users, firstGuess] = await Promise.all([
      singleAggregate(db('games').whereIn('mode', difficulties)),
      db('users').count({ total: 'id' }).first(),
      firstGuessSummary(db('games').whereIn('mode', difficulties)),
    ]);
    return {
      ...singleSummary(single),
      registeredUsers: Number(users?.total ?? 0),
      firstGuess,
    };
  });
}

async function personalStats(owner: Owner, identityKey: string, difficulties: string[]) {
  return cached(personalStatsCacheKey(identityKey, difficulties), 30, async () => {
    const [single, firstGuess] = await Promise.all([
      singleAggregate(db('games').where(owner).whereIn('mode', difficulties)),
      firstGuessSummary(db('games').where(owner).whereIn('mode', difficulties)),
    ]);
    return {
      ...singleSummary(single),
      firstGuess,
    };
  });
}

const replayListQuery = z.object({
  type: z.enum(['single']).default('single'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(5).max(30).default(15),
});
const statsSummaryQuery = z.object({
  difficulties: z.string().trim().min(1).max(128).optional(),
});
const replayIdParams = z.object({ id: z.coerce.number().int().positive() });

function safeGuessIds(value: unknown): number[] {
  let array: unknown[] = [];
  if (Array.isArray(value)) {
    array = value;
  } else if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) array = parsed;
    } catch {
      // fall through to an empty list
    }
  }
  return array
    .slice(0, MAX_GUESSES)
    .map((item) => Number(item))
    .filter((id) => Number.isInteger(id) && id > 0);
}

/** 统计:当前身份的个人数据和全站聚合。回放列表独立分页查询。 */
router.get(
  '/me',
  rateLimit({
    name: 'stats-me',
    limit: 30,
    windowSeconds: 60,
    key: requestIdentity,
    failClosed: true,
  }),
  validateQuery(statsSummaryQuery),
  asyncHandler(async (req, res) => {
    const owner = ownerFor(req);
    if (!owner) throw new HttpError(400, 'GUEST_KEY_REQUIRED');
    const identityKey = identityKeyFor(req);
    if (!identityKey) throw new HttpError(400, 'GUEST_KEY_REQUIRED');
    const available: string[] = DIFFICULTY_LEVELS
      .filter((difficulty) => difficulty.isEnabled && isDifficultyAvailable(difficulty.key))
      .map((difficulty) => difficulty.key);
    const raw = (req.query as unknown as z.infer<typeof statsSummaryQuery>).difficulties;
    const requested = raw
      ? [...new Set(raw.split(',').map((difficulty) => difficulty.trim()).filter(Boolean))]
      : available;
    if (!requested.length || requested.some((difficulty) => !available.includes(difficulty))) {
      throw new HttpError(400, 'DIFFICULTY_UNAVAILABLE');
    }
    const difficulties = available.filter((difficulty) => requested.includes(difficulty));
    const [personal, global] = await Promise.all([
      personalStats(owner, identityKey, difficulties),
      globalStats(difficulties),
    ]);

    res.json({ difficulties, personal, global });
  })
);

/** 个人回放列表。固定类型分页，避免跨大表合并和每页 count。 */
router.get(
  '/replays',
  rateLimit({
    name: 'stats-replay-list',
    limit: 30,
    windowSeconds: 60,
    key: requestIdentity,
    failClosed: true,
  }),
  validateQuery(replayListQuery),
  asyncHandler(async (req, res) => {
    const { page, pageSize } = req.query as unknown as z.infer<typeof replayListQuery>;
    const offset = (page - 1) * pageSize;
    const owner = ownerFor(req);
    if (!owner) throw new HttpError(400, 'GUEST_KEY_REQUIRED');
    const rows = await db('games as g')
      .join('characters as c', 'c.id', 'g.target_character_id')
      .where(qualifiedOwner(owner, 'g'))
      .whereNot('g.status', 'playing')
      .orderBy('g.finished_at', 'desc')
      .orderBy('g.id', 'desc')
      .offset(offset)
      .limit(pageSize + 1)
      .select(
        'g.id',
        'g.mode',
        'g.status',
        'g.guess_count as guessCount',
        'g.finished_at as finishedAt',
        'c.name as answer'
      );
    const hasNext = rows.length > pageSize;
    return res.json({
      type: 'single',
      page,
      pageSize,
      hasNext,
      items: rows.slice(0, pageSize).map((row) => ({ type: 'single', ...row })),
    });
  })
);

/** 最近单人对局回放详情，仅允许记录所属账号或访客读取。 */
router.get(
  '/games/:id/replay',
  rateLimit({
    name: 'stats-replay',
    limit: 60,
    windowSeconds: 60,
    key: requestIdentity,
    failClosed: true,
  }),
  validateParams(replayIdParams),
  asyncHandler(async (req, res) => {
    const owner = ownerFor(req);
    if (!owner) throw new HttpError(400, 'GUEST_KEY_REQUIRED');
    const { id } = req.params as unknown as z.infer<typeof replayIdParams>;

    const game = await db('games')
      .where({ id, ...owner })
      .whereNot('status', 'playing')
      .first();
    if (!game) throw new HttpError(404, 'GAME_NOT_FOUND');
    const target = getCharacter(Number(game.target_character_id));
    if (!target) throw new HttpError(404, 'CHARACTER_NOT_FOUND');

    const guesses = safeGuessIds(game.guesses).flatMap((stored) => {
      const guess = getCharacter(stored);
      return guess ? [compareGuess(guess, target)] : [];
    });

    res.json({
      id: game.id,
      mode: game.mode,
      status: game.status,
      guessCount: Number(game.guess_count),
      createdAt: game.created_at,
      finishedAt: game.finished_at,
      answer: answerView(target),
      guesses,
    });
  })
);

export default router;
