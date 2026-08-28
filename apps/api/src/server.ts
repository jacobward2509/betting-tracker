import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import bookmakersRouter from './routes/bookmakers';
import { prisma } from './prisma';
import { sendError, zodFieldErrors } from './errors';
import { loginRequestSchema, signupRequestSchema } from './validation';

// Express 4 does not automatically forward rejected promises from async route
// handlers to error-handling middleware — this wrapper does that so unexpected
// errors always reach the centralized handler at the bottom of this file
// instead of becoming unhandled promise rejections.
const asyncHandler =
  <Req extends express.Request = express.Request>(
    handler: (req: Req, res: express.Response, next: express.NextFunction) => Promise<unknown>,
  ) =>
  (req: Req, res: express.Response, next: express.NextFunction) => {
    handler(req, res, next).catch(next);
  };


dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const ALLOWED_ORIGINS = CORS_ORIGIN.split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const isLocalDevOrigin = (origin: string): boolean =>
  /^https?:\/\/localhost:\d+$/i.test(origin) || /^https?:\/\/127\.0\.0\.1:\d+$/i.test(origin);

app.disable('etag');
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin) || isLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
  }),
);
app.use(express.json({ limit: '10kb' }));

const SESSION_DAYS = 30;
const DEFAULT_BET_TYPE = 'Player Prop';
const DEFAULT_STAKE = 5;
const supportsUserConfigModels = () =>
  Boolean((prisma as any).userBookmaker) && Boolean((prisma as any).userPreference);

type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
};

type AuthenticatedRequest = express.Request & {
  user?: AuthenticatedUser;
  sessionToken?: string;
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toOddsOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value).trim();
  const decimal = Number(text);
  if (Number.isFinite(decimal)) return decimal;

  const fraction = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!fraction) return null;

  const numerator = Number(fraction[1]);
  const denominator = Number(fraction[2]);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }

  return numerator / denominator + 1;
};

const normalizeResultValue = (value: unknown): 'OPEN' | 'WON' | 'LOST' | 'VOID' => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

  if (normalized === 'WON' || normalized === 'WIN') return 'WON';
  if (normalized === 'LOST' || normalized === 'LOSS') return 'LOST';
  if (normalized === 'VOID' || normalized === 'CASHED_OUT' || normalized === 'CASHEDOUT') {
    return 'VOID';
  }
  return 'OPEN';
};

const normalizeStakeTypeValue = (value: unknown): 'NORMAL' | 'FREE' | 'NORMAL_PLUS_FREE' => {
  const normalized = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/\+/g, '_PLUS_');

  if (normalized === 'FREE') return 'FREE';
  if (normalized === 'NORMAL_PLUS_FREE') return 'NORMAL_PLUS_FREE';
  return 'NORMAL';
};

const calculateProfit = (input: {
  stake?: unknown;
  normalStake?: unknown;
  odds?: unknown;
  result?: unknown;
  stakeType?: unknown;
  cashOutValue?: unknown;
}): number | null => {
  const stake = toNumberOrNull(input.stake);
  const normalStakeInput = toNumberOrNull(input.normalStake);
  const odds = toOddsOrNull(input.odds);
  const cashOutValue = toNumberOrNull(input.cashOutValue);
  const result = String(input.result || '').toUpperCase();
  const stakeType = normalizeStakeTypeValue(input.stakeType);

  if (stake === null) return null;
  const effectiveStake =
    stakeType === 'FREE' ? 0 : stakeType === 'NORMAL_PLUS_FREE' ? Math.max(0, Math.min(normalStakeInput ?? stake, stake)) : stake;

  if (result === 'WON') {
    if (odds === null) return null;
    if (stakeType === 'NORMAL_PLUS_FREE') {
      // For mixed stake wins, free stake is not returned:
      // P/L = (total stake * odds) - total stake
      return stake * odds - stake;
    }
    return stake * odds - effectiveStake;
  }

  if (result === 'LOST') {
    return -effectiveStake;
  }

  if (result === 'VOID') {
    if (cashOutValue === null) return null;
    return cashOutValue - effectiveStake;
  }

  return null;
};

const normalizeName = (value: unknown): string =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const sanitizeUniqueStrings = (items: unknown[]): string[] => {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const item of items) {
    const value = String(item || '').trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values;
};

const parseFixtureTeams = (fixture: unknown): string[] => {
  const raw = String(fixture || '').trim();
  if (!raw) return [];
  const parts = raw
    .split(/\s+vs\s+/i)
    .map((value) => value.trim())
    .filter(Boolean);
  if (parts.length < 2) return [];
  return [parts[0], parts[1]];
};

const parsePlayerFromSelection = (selection: unknown, market: unknown): string => {
  const text = String(selection || '')
    .trim()
    .replace(/\s+/g, ' ');
  const normalizedMarket = String(market || '').trim();
  if (!text) return '';

  if (normalizedMarket) {
    const idx = text.toLowerCase().indexOf(normalizedMarket.toLowerCase());
    if (idx > 0) {
      return text.slice(0, idx).trim();
    }
  }

  const legacyMatch = text.match(/^(.*?)\s+[OU]\s*(\d+(?:\.\d+)?)\s+(.+)$/i);
  if (legacyMatch) {
    return String(legacyMatch[1] || '').trim();
  }

  // Heuristic fallback for legacy/imported text such as:
  // "Joelinton to be carded", "Joelinton carded", "Joelinton AGS", "Joelinton O0.5 FW"
  const fallback = text
    .replace(/\b[OU]\s*\d+(?:\.\d+)?\b/gi, ' ')
    .replace(/\b\d+(?:\.\d+)?\b/g, ' ')
    .replace(
      /\b(shots?|sot|fouls?\s+won|fouls?\s+committed|tackles?|to\s+be\s+carded|carded|ags|fw|fc)\b.*$/i,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
  if (fallback) return fallback;

  // Final fallback: allow single-token player names.
  const firstToken = text.split(/\s+/).filter(Boolean)[0] || '';
  if (firstToken) return firstToken;

  return '';
};

type UserConfigOverrides = {
  enabledBookmakers?: string[] | null;
  defaultBookmaker?: string | null;
  defaultBetType?: string | null;
  defaultStake?: number | null;
};

const hashPassword = (password: string): string => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
};

const verifyPassword = (password: string, stored: string): boolean => {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;

  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  const derivedBuf = Buffer.from(derived, 'hex');
  const hashBuf = Buffer.from(hash, 'hex');
  if (derivedBuf.length !== hashBuf.length) return false;
  return crypto.timingSafeEqual(derivedBuf, hashBuf);
};

// Used to run a scrypt comparison of equivalent cost when no user is found
// for the given email, so login response times don't reveal whether an
// account exists (a timing side-channel / email-enumeration vector).
const DUMMY_PASSWORD_HASH = hashPassword(crypto.randomBytes(32).toString('hex'));


const createSession = async (userId: string) => {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return token;
};

const requireAuth = async (
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction,
) => {
  const authHeader = String(req.headers.authorization || '');
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = tokenMatch?.[1]?.trim();

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await prisma.session.delete({ where: { token } }).catch(() => undefined);
    }
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  };
  req.sessionToken = token;

  next();
};

const ensureUserBetConfig = async (userId: string, overrides?: UserConfigOverrides) => {
  const allBookmakers = await prisma.bookmakers.findMany({ orderBy: { bookmakers: 'asc' } });
  const allBookmakerValues = allBookmakers.map((item) => item.bookmakers);
  const requestedEnabled = Array.isArray(overrides?.enabledBookmakers)
    ? sanitizeUniqueStrings(overrides!.enabledBookmakers || [])
    : null;
  const allowedSet = new Set(allBookmakerValues);
  const validatedEnabled =
    requestedEnabled && requestedEnabled.length > 0
      ? requestedEnabled.filter((bookmaker) => allowedSet.has(bookmaker as any))
      : null;
  const desiredEnabled = validatedEnabled && validatedEnabled.length > 0
    ? validatedEnabled
    : allBookmakerValues;
  const userBookmaker = (prisma as any).userBookmaker;
  const userPreference = (prisma as any).userPreference;

  if (!supportsUserConfigModels()) {
    const fallbackDefaultBookmaker =
      overrides?.defaultBookmaker && desiredEnabled.includes(overrides.defaultBookmaker)
        ? overrides.defaultBookmaker
        : desiredEnabled[0] || null;
    return {
      allBookmakerValues,
      enabledBookmakers: desiredEnabled,
      preference: {
        defaultBookmaker: fallbackDefaultBookmaker,
        defaultBetType: overrides?.defaultBetType || DEFAULT_BET_TYPE,
        defaultStake:
          overrides?.defaultStake !== null && overrides?.defaultStake !== undefined
            ? overrides.defaultStake
            : DEFAULT_STAKE,
      },
    };
  }

  const enabledRows = await userBookmaker.findMany({ where: { userId }, select: { bookmaker: true }, orderBy: { bookmaker: 'asc' } });
  if ((!enabledRows.length && desiredEnabled.length) || validatedEnabled) {
    await userBookmaker.deleteMany({ where: { userId } });
    await userBookmaker.createMany({
      data: desiredEnabled.map((bookmaker) => ({ userId, bookmaker: bookmaker as any })),
    });
  }

  const refreshedEnabledRows = await userBookmaker.findMany({
    where: { userId },
    select: { bookmaker: true },
    orderBy: { bookmaker: 'asc' },
  });

  const enabledBookmakers =
    refreshedEnabledRows.length > 0
      ? refreshedEnabledRows.map((item) => item.bookmaker)
      : allBookmakerValues;

  let preference = await userPreference.findUnique({ where: { userId } });
  const desiredDefaultBookmaker =
    overrides?.defaultBookmaker && enabledBookmakers.includes(overrides.defaultBookmaker)
      ? overrides.defaultBookmaker
      : enabledBookmakers[0] || null;
  const desiredDefaultBetType = overrides?.defaultBetType || DEFAULT_BET_TYPE;
  const desiredDefaultStake =
    overrides?.defaultStake !== null && overrides?.defaultStake !== undefined
      ? overrides.defaultStake
      : DEFAULT_STAKE;

  if (!preference) {
    preference = await userPreference.create({
      data: {
        userId,
        defaultBookmaker: desiredDefaultBookmaker,
        defaultBetType: desiredDefaultBetType,
        defaultStake: desiredDefaultStake,
      },
    });
  } else {
    const shouldForceDefaultBookmaker =
      (preference.defaultBookmaker && !enabledBookmakers.includes(preference.defaultBookmaker)) ||
      overrides?.defaultBookmaker !== undefined;
    const hasOverrideValues =
      overrides?.defaultBetType !== undefined || overrides?.defaultStake !== undefined;

    if (shouldForceDefaultBookmaker || hasOverrideValues) {
      preference = await userPreference.update({
        where: { userId },
        data: {
          defaultBookmaker: shouldForceDefaultBookmaker
            ? desiredDefaultBookmaker
            : preference.defaultBookmaker,
          defaultBetType:
            overrides?.defaultBetType !== undefined
              ? desiredDefaultBetType
              : preference.defaultBetType,
          defaultStake:
            overrides?.defaultStake !== undefined
              ? desiredDefaultStake
              : preference.defaultStake,
        },
      });
    }
  }

  return {
    allBookmakerValues,
    enabledBookmakers,
    preference,
  };
};

app.post('/api/auth/signup', asyncHandler(async (req, res) => {
  const parsed = signupRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'Please correct the highlighted fields and try again.',
      zodFieldErrors(parsed.error),
    );
  }

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return sendError(res, 400, 'ACCOUNT_EXISTS', 'An account with this email already exists.');
  }

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(password),
      },
    });
  } catch (error: any) {
    // Guards against the race between the findUnique check above and this
    // create() call — two concurrent signups for the same email can both
    // pass the check, so the unique constraint is the real source of truth.
    if (error?.code === 'P2002') {
      return sendError(res, 400, 'ACCOUNT_EXISTS', 'An account with this email already exists.');
    }
    throw error;
  }

  // Preferences (bookmakers/bet type/stake) are configured separately via
  // PUT /api/user/config once the client has an authenticated session, so
  // signup only ever needs to fall back to defaults here.
  await ensureUserBetConfig(user.id);

  const token = await createSession(user.id);

  res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const parsed = loginRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'Please correct the highlighted fields and try again.',
      zodFieldErrors(parsed.error),
    );
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // Always run a scrypt comparison of equivalent cost, even when no user is
  // found, so response timing can't be used to enumerate registered emails.
  const passwordValid = verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);

  if (!user || !passwordValid) {
    return sendError(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const token = await createSession(user.id);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
}));


app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

app.delete('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  // Deleting the User row cascades to Session, UserBookmaker, UserPreference, and
  // Bet rows (all onDelete: Cascade in schema.prisma) — fully removes the account
  // and everything it created. Used to clean up accounts seeded by the Playwright
  // API and UI suites.
  await prisma.user.delete({ where: { id: req.user!.id } });
  res.sendStatus(204);
});

app.patch('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  const name = normalizeName(req.body?.name);
  if (name.length < 2) {
    return res.status(400).json({ error: 'Name must be at least 2 characters long.' });
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { name },
  });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
});

app.post('/api/auth/logout', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (req.sessionToken) {
    await prisma.session.delete({ where: { token: req.sessionToken } }).catch(() => undefined);
  }
  res.sendStatus(204);
});

app.get('/api/user/config', requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { allBookmakerValues, enabledBookmakers, preference } = await ensureUserBetConfig(userId);

  const defaults = {
    bookmaker:
      preference?.defaultBookmaker && enabledBookmakers.includes(preference.defaultBookmaker)
        ? preference.defaultBookmaker
        : enabledBookmakers[0] || null,
    betType: preference?.defaultBetType || DEFAULT_BET_TYPE,
    stake:
      preference?.defaultStake !== null && preference?.defaultStake !== undefined
        ? Number(preference.defaultStake)
        : DEFAULT_STAKE,
  };

  res.json({
    bookmakers: allBookmakerValues.map((bookmaker) => ({
      bookmaker,
      enabled: enabledBookmakers.includes(bookmaker),
    })),
    enabledBookmakers,
    defaults,
  });
});

app.put('/api/user/config', requireAuth, async (req: AuthenticatedRequest, res) => {
  if (!supportsUserConfigModels()) {
    return res.status(503).json({
      error: 'User config models are not available yet. Run Prisma migrate + generate, then restart API.',
    });
  }

  const userId = req.user!.id;
  const allBookmakers = await prisma.bookmakers.findMany({ orderBy: { bookmakers: 'asc' } });
  const allowedBookmakers = new Set(allBookmakers.map((item) => item.bookmakers));

  const body = req.body || {};
  const inputEnabled = Array.isArray(body.enabledBookmakers)
    ? sanitizeUniqueStrings(body.enabledBookmakers)
    : null;
  const defaultBookmakerInput =
    body.defaultBookmaker === null || body.defaultBookmaker === undefined
      ? null
      : String(body.defaultBookmaker).trim();
  const defaultBetTypeInput =
    body.defaultBetType === null || body.defaultBetType === undefined
      ? null
      : String(body.defaultBetType).trim();
  const defaultStakeInput =
    body.defaultStake === null || body.defaultStake === undefined || body.defaultStake === ''
      ? null
      : Number(body.defaultStake);

  if (defaultStakeInput !== null && (!Number.isFinite(defaultStakeInput) || defaultStakeInput <= 0)) {
    return res.status(400).json({ error: 'Default stake must be a positive number.' });
  }

  if (defaultBookmakerInput !== null && !allowedBookmakers.has(defaultBookmakerInput as any)) {
    return res.status(400).json({ error: 'Invalid default bookmaker.' });
  }

  if (inputEnabled) {
    const invalid = inputEnabled.find((item) => !allowedBookmakers.has(item as any));
    if (invalid) {
      return res.status(400).json({ error: `Invalid bookmaker: ${invalid}` });
    }
    if (inputEnabled.length === 0) {
      return res.status(400).json({ error: 'At least one bookmaker must be enabled.' });
    }
  }

  const currentConfig = await ensureUserBetConfig(userId);
  const currentEnabled = currentConfig.enabledBookmakers;
  const nextEnabled = inputEnabled || currentEnabled;

  if (defaultBookmakerInput !== null && !nextEnabled.includes(defaultBookmakerInput as any)) {
    return res.status(400).json({ error: 'Default bookmaker must be enabled.' });
  }

  const nextDefaultBookmaker =
    defaultBookmakerInput !== null
      ? defaultBookmakerInput
      : nextEnabled[0] || null;

  await prisma.$transaction(async (tx) => {
    const txUserBookmaker = (tx as any).userBookmaker;
    const txUserPreference = (tx as any).userPreference;
    if (inputEnabled) {
      await txUserBookmaker.deleteMany({ where: { userId } });
      await txUserBookmaker.createMany({
        data: inputEnabled.map((bookmaker) => ({ userId, bookmaker: bookmaker as any })),
      });
    }

    const shouldUpsertPreference =
      defaultBookmakerInput !== null || defaultBetTypeInput !== null || defaultStakeInput !== null || inputEnabled !== null;

    if (shouldUpsertPreference) {
      await txUserPreference.upsert({
        where: { userId },
        create: {
          userId,
          defaultBookmaker: nextDefaultBookmaker as any,
          defaultBetType: defaultBetTypeInput || DEFAULT_BET_TYPE,
          defaultStake: defaultStakeInput !== null ? defaultStakeInput : DEFAULT_STAKE,
        },
        update: {
          defaultBookmaker: nextDefaultBookmaker as any,
          defaultBetType: defaultBetTypeInput || undefined,
          defaultStake: defaultStakeInput !== null ? defaultStakeInput : undefined,
        },
      });
    }
  });

  const userPreference = (prisma as any).userPreference;
  const userBookmaker = (prisma as any).userBookmaker;
  const [preference, enabledRows] = await Promise.all([
    userPreference.findUnique({ where: { userId } }),
    userBookmaker.findMany({
      where: { userId },
      select: { bookmaker: true },
      orderBy: { bookmaker: 'asc' },
    }),
  ]);

  const enabledBookmakers =
    enabledRows.length > 0 ? enabledRows.map((item) => item.bookmaker) : allBookmakers.map((item) => item.bookmakers);

  return res.json({
    bookmakers: allBookmakers.map((item) => ({
      bookmaker: item.bookmakers,
      enabled: enabledBookmakers.includes(item.bookmakers),
    })),
    enabledBookmakers,
    defaults: {
      bookmaker:
        preference?.defaultBookmaker && enabledBookmakers.includes(preference.defaultBookmaker)
          ? preference.defaultBookmaker
          : enabledBookmakers[0] || null,
      betType: preference?.defaultBetType || DEFAULT_BET_TYPE,
      stake:
        preference?.defaultStake !== null && preference?.defaultStake !== undefined
          ? Number(preference.defaultStake)
          : DEFAULT_STAKE,
    },
  });
});

// GET BETS (with basic filtering)
app.get('/api/bets', requireAuth, async (req: AuthenticatedRequest, res) => {
  const { search, bookmaker, result } = req.query;

  const bets = await prisma.bet.findMany({
    where: {
      userId: req.user?.id,
      AND: [
        search
          ? {
              OR: [
                { fixture: { contains: String(search), mode: 'insensitive' } },
                { selection: { contains: String(search), mode: 'insensitive' } },
              ],
            }
          : {},
        bookmaker ? { bookmaker: String(bookmaker) as any } : {},
        result ? { result: String(result) as any } : {},
      ],
    },
    orderBy: { placedAt: 'desc' },
  });

  res.json(bets);
});

app.get('/api/team-suggestions', requireAuth, async (req: AuthenticatedRequest, res) => {
  const query = String(req.query.q || '')
    .trim()
    .toLowerCase();
  const rows = await prisma.bet.findMany({
    where: {
      userId: req.user?.id,
      fixture: {
        contains: 'vs',
        mode: 'insensitive',
      },
    },
    select: {
      fixture: true,
    },
    orderBy: {
      placedAt: 'desc',
    },
    take: 5000,
  });

  const stats = new Map<string, { name: string; count: number }>();
  for (const row of rows) {
    const teams = parseFixtureTeams(row.fixture);
    for (const team of teams) {
      const key = team.toLowerCase();
      const existing = stats.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        stats.set(key, { name: team, count: 1 });
      }
    }
  }

  const suggestions = Array.from(stats.values())
    .filter((item) => !query || item.name.toLowerCase().includes(query))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 100)
    .map((item) => item.name);

  return res.json(suggestions);
});

app.get('/api/suggestions', requireAuth, async (req: AuthenticatedRequest, res) => {
  const rows = await prisma.bet.findMany({
    where: {
      userId: req.user?.id,
    },
    select: {
      fixture: true,
      betType: true,
      selection: true,
      playerPropMarket: true,
    },
    orderBy: {
      placedAt: 'desc',
    },
    take: 5000,
  });

  const teamStats = new Map<string, { name: string; count: number }>();
  const playerStats = new Map<string, { name: string; count: number }>();

  for (const row of rows) {
    const teams = parseFixtureTeams(row.fixture);
    for (const team of teams) {
      const key = team.toLowerCase();
      const existing = teamStats.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        teamStats.set(key, { name: team, count: 1 });
      }
    }

    if (String(row.betType || '') === 'Player Prop') {
      const player = parsePlayerFromSelection(row.selection, row.playerPropMarket);
      if (player) {
        const key = player.toLowerCase();
        const existing = playerStats.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          playerStats.set(key, { name: player, count: 1 });
        }
      }
    }
  }

  const teams = Array.from(teamStats.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    })
    .map((item) => item.name);

  const players = Array.from(playerStats.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    })
    .map((item) => item.name);

  return res.json({ teams, players });
});

app.get('/api/player-suggestions', requireAuth, async (req: AuthenticatedRequest, res) => {
  const query = String(req.query.q || '')
    .trim()
    .toLowerCase();
  const rows = await prisma.bet.findMany({
    where: {
      userId: req.user?.id,
      betType: 'Player Prop',
    },
    select: {
      selection: true,
      playerPropMarket: true,
    },
    orderBy: {
      placedAt: 'desc',
    },
    take: 5000,
  });

  const stats = new Map<string, { name: string; count: number }>();
  for (const row of rows) {
    const player = parsePlayerFromSelection(row.selection, row.playerPropMarket);
    if (!player) continue;
    const key = player.toLowerCase();
    const existing = stats.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      stats.set(key, { name: player, count: 1 });
    }
  }

  const suggestions = Array.from(stats.values())
    .filter((item) => !query || item.name.toLowerCase().includes(query))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 100)
    .map((item) => item.name);

  return res.json(suggestions);
});

app.post('/api/bets', requireAuth, async (req: AuthenticatedRequest, res) => {
  const data: Record<string, unknown> = { ...req.body };
  data.result = normalizeResultValue(data.result);
  data.stakeType = normalizeStakeTypeValue(data.stakeType);
  data.cashOutValue = data.result === 'VOID' ? toNumberOrNull(data.cashOutValue) : null;
  data.userId = req.user?.id;

  const stake = toNumberOrNull(data.stake);
  const normalStake = toNumberOrNull(data.normalStake);
  const odds = toOddsOrNull(data.odds);
  if (odds === null || odds < 1) {
    return res
      .status(400)
      .json({ error: 'Invalid odds. Use decimal (e.g. 2.5) or fractional (e.g. 3/2).' });
  }

  data.odds = odds;
  if (data.stakeType === 'NORMAL_PLUS_FREE') {
    if (stake === null || normalStake === null) {
      return res
        .status(400)
        .json({ error: 'Normal stake is required when Stake Type is Normal + Free.' });
    }
    if (normalStake < 0 || normalStake > stake) {
      return res
        .status(400)
        .json({ error: 'Normal stake must be between 0 and total stake.' });
    }
    data.normalStake = normalStake;
  } else {
    data.normalStake = null;
  }

  if (stake !== null) {
    data.potentialReturn = stake * odds;
  }
  data.profit = calculateProfit(data);

  const bet = await prisma.bet.create({ data: data as any });
  res.json(bet);
});

app.put('/api/bets/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const existing = await prisma.bet.findFirst({
    where: { id: req.params.id, userId: req.user?.id },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Bet not found' });
  }

  const normalizedResult = normalizeResultValue(req.body.result ?? existing.result);
  const normalizedCashOutValue =
    normalizedResult === 'VOID'
      ? toNumberOrNull(req.body.cashOutValue ?? existing.cashOutValue)
      : null;

  const merged = {
    ...existing,
    ...req.body,
    stakeType: normalizeStakeTypeValue(req.body.stakeType ?? existing.stakeType),
    result: normalizedResult,
    cashOutValue: normalizedCashOutValue,
  };

  const data: Record<string, unknown> = {
    ...req.body,
    stakeType: normalizeStakeTypeValue(req.body.stakeType ?? existing.stakeType),
    result: normalizedResult,
    cashOutValue: normalizedCashOutValue,
  };
  const stake = toNumberOrNull(merged.stake);
  const normalStake = toNumberOrNull(merged.normalStake);
  const odds = toOddsOrNull(merged.odds);
  if (odds === null || odds < 1) {
    return res
      .status(400)
      .json({ error: 'Invalid odds. Use decimal (e.g. 2.5) or fractional (e.g. 3/2).' });
  }

  data.odds = odds;
  if (data.stakeType === 'NORMAL_PLUS_FREE') {
    if (stake === null || normalStake === null) {
      return res
        .status(400)
        .json({ error: 'Normal stake is required when Stake Type is Normal + Free.' });
    }
    if (normalStake < 0 || normalStake > stake) {
      return res
        .status(400)
        .json({ error: 'Normal stake must be between 0 and total stake.' });
    }
    data.normalStake = normalStake;
  } else {
    data.normalStake = null;
  }

  if (stake !== null) {
    data.potentialReturn = stake * odds;
  }
  data.profit = calculateProfit(merged);

  const bet = await prisma.bet.update({
    where: { id: req.params.id },
    data: data as any,
  });
  res.json(bet);
});

app.patch('/api/bets/bulk-result', requireAuth, async (req: AuthenticatedRequest, res) => {
  const ids = Array.isArray(req.body?.ids) ? sanitizeUniqueStrings(req.body.ids) : [];
  if (!ids.length) {
    return res.status(400).json({ error: 'At least one bet id is required.' });
  }

  const normalizedResult = normalizeResultValue(req.body?.result);
  const normalizedCashOutValue =
    normalizedResult === 'VOID' ? toNumberOrNull(req.body?.cashOutValue) : null;

  if (normalizedResult === 'VOID' && (normalizedCashOutValue === null || normalizedCashOutValue < 0)) {
    return res.status(400).json({ error: 'Cash Out value is required for Cashed Out result.' });
  }

  const existingBets = await prisma.bet.findMany({
    where: {
      id: { in: ids },
      userId: req.user?.id,
    },
  });

  if (!existingBets.length) {
    return res.status(404).json({ error: 'No matching bets found.' });
  }

  await prisma.$transaction(
    existingBets.map((bet) => {
      const payload = {
        ...bet,
        result: normalizedResult,
        cashOutValue: normalizedCashOutValue,
      };
      const profit = calculateProfit(payload);
      return prisma.bet.update({
        where: { id: bet.id },
        data: {
          result: normalizedResult,
          cashOutValue: normalizedCashOutValue,
          profit,
        } as any,
      });
    }),
  );

  return res.json({
    updatedCount: existingBets.length,
    ids: existingBets.map((bet) => bet.id),
  });
});

app.delete('/api/bets/:id', requireAuth, async (req: AuthenticatedRequest, res) => {
  const existing = await prisma.bet.findFirst({
    where: { id: req.params.id, userId: req.user?.id },
    select: { id: true },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Bet not found' });
  }

  await prisma.bet.delete({ where: { id: req.params.id } });
  res.sendStatus(204);
});

app.get('/api/bet-types', requireAuth, async (_req, res) => {
  const betTypes = await prisma.betTypes.findMany({ orderBy: { betTypes: 'asc' } });
  res.json(betTypes);
});

app.get('/api/player-prop-markets', requireAuth, async (_req, res) => {
  const markets = await prisma.playerPropMarkets.findMany({ orderBy: { markets: 'asc' } });
  res.json(markets);
});

app.use('/api', requireAuth, bookmakersRouter);

// Centralized error handler. Must be registered last (after all routes) and
// declared with 4 parameters so Express recognizes it as an error handler.
// Handles malformed JSON / oversized bodies from express.json() as well as
// any error surfaced via asyncHandler()'s next(err) forwarding.
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.type === 'entity.too.large' || err?.status === 413) {
    return sendError(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
  }

  if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Request body must be valid JSON.');
  }

  console.error(err);
  return sendError(res, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
});

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});

