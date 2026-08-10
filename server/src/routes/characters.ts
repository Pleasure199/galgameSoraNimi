import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, validateQuery } from '../middleware/common';
import { getPublicCharacterList, searchCachedCharacters } from '../services/characterCache';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();
const characterSearchQuery = z.object({
  search: z.string().trim().max(100).default(''),
  limit: z.coerce.number().int().min(1).max(100000).default(100),
  suggest: z.enum(['0', '1']).default('0').transform((value) => value === '1'),
});

router.get(
  '/list',
  asyncHandler(async (req, res) => {
    const list = await getPublicCharacterList();
    const etag = `\"characters-${list.version}\"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    res.setHeader('X-Character-List-Version', list.version);
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.json(list);
  })
);

/**
 * 查角色 / 自动补全。
 * - ?search=xxx 模糊搜索角色名/作品/声优
 * - ?suggest=1 仅返回 id+name(猜测输入补全用,不泄露属性)
 */
router.get(
  '/',
  rateLimit({
    name: 'character-search',
    limit: 60,
    windowSeconds: 60,
    failClosed: true,
  }),
  validateQuery(characterSearchQuery),
  asyncHandler(async (req, res) => {
    const { search, suggest, limit } = req.query as unknown as z.infer<typeof characterSearchQuery>;

    const characters = searchCachedCharacters(search, suggest ? 10 : limit);

    if (suggest) {
      return res.json(characters.map((c) => ({ id: c.id, name: c.name })));
    }
    res.json(
      characters.map((c) => ({
        id: c.id,
        name: c.name,
        work: c.work,
        company: c.company,
        releaseYear: c.release_year,
        gender: c.gender,
        cv: c.cv,
        hairColor: c.hair_color,
        hairLength: c.hair_length,
        height: c.height,
      }))
    );
  })
);

export default router;
