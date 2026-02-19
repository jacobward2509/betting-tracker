import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

router.get('/bookmakers', async (req, res) => {
  try {
    const userId = (req as any).user?.id as string | undefined;
    const allBookmakers = await prisma.bookmakers.findMany({
      orderBy: { bookmakers: 'asc' },
    });

    if (!userId) {
      return res.json(allBookmakers);
    }

    const userBookmaker = (prisma as any).userBookmaker;
    if (!userBookmaker) {
      return res.json(allBookmakers);
    }

    const enabled = await userBookmaker.findMany({
      where: { userId },
      orderBy: { bookmaker: 'asc' },
      select: { bookmaker: true },
    });

    if (!enabled.length) {
      return res.json(allBookmakers);
    }

    const enabledSet = new Set(enabled.map((item) => item.bookmaker));
    const filtered = allBookmakers.filter((item) => enabledSet.has(item.bookmakers));
    return res.json(filtered);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch bookmakers' });
  }
});

export default router;
