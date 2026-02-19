import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';

const router = Router();

const betSchema = z.object({
  fixture: z.string().min(1, 'Fixture is required'),
  selection: z.string().min(1, 'Selection is required'),
  bookmaker: z.string().min(1, 'Bookmaker is required'),
  stakeType: z.enum(['NORMAL', 'FREE']),
  betType: z.string().min(1, 'Bet type is required'),
  playerPropMarket: z.string().nullable().optional(),
  stake: z.number().positive('Stake must be positive'),
  odds: z.number().min(1, 'Odds must be >= 1'),
  potentialReturn: z.number().positive(),
  result: z.enum(['OPEN', 'WON', 'LOST', 'VOID']),
  placedAt: z
    .string()
    .refine((s) => !isNaN(Date.parse(s)), 'placedAt must be a valid date'),
});

router.post('/', async (req, res) => {
  try {
    const parsed = betSchema.parse(req.body);

    const bet = await prisma.bet.create({
      data: {
        fixture: parsed.fixture,
        selection: parsed.selection,
        bookmaker: parsed.bookmaker,
        stakeType: parsed.stakeType,
        betType: parsed.betType,
        playerPropMarket: parsed.playerPropMarket ?? null,
        stake: parsed.stake,
        odds: parsed.odds,
        potentialReturn: parsed.potentialReturn,
        result: parsed.result,
        placedAt: new Date(parsed.placedAt),
      },
    });

    res.status(201).json({ success: true, bet });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: err.errors.map((e) => ({
          field: e.path[0],
          message: e.message,
        })),
      });
    }

    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Optional: health check
router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

export default router;
