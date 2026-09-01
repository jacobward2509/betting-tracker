import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import bookmakersRouter from './routes/bookmakers';
import { prisma } from './prisma';
import { sendError, zodFieldErrors } from './errors';
import {
  loginRequestSchema,
  signupRequestSchema,
  updateProfileRequestSchema,
  updateUserConfigRequestSchema,
} from './validation';
import {
  fetchFixturesForDate,
  fetchFixturesForDateWithStats,
  fetchPlayersForTeam,
  isSuspectedPlayerTruncation,
} from './services/thesportsdb';


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
  try {
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

    // session.user can transiently come back null if the account was deleted
    // (cascading the Session row away) in the moment between this query
    // starting and Prisma resolving the include — treat that the same as "no
    // session found" rather than letting Prisma's runtime error bubble up as
    // an unhandled rejection that would crash the process.
    if (!session || !session.user || session.expiresAt <= new Date()) {
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
  } catch (err) {
    next(err);
  }
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
    await prisma.$transaction(async (tx) => {
      const txUserBookmaker = (tx as any).userBookmaker;
      await txUserBookmaker.deleteMany({ where: { userId } });
      await txUserBookmaker.createMany({
        data: desiredEnabled.map((bookmaker) => ({ userId, bookmaker: bookmaker as any })),
      });
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


app.get('/api/auth/me', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  res.json({ user: req.user });
}));

app.delete('/api/auth/me', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  // Deleting the User row cascades to Session, UserBookmaker, UserPreference, and
  // Bet rows (all onDelete: Cascade in schema.prisma) — fully removes the account
  // and everything it created. Used to clean up accounts seeded by the Playwright
  // API and UI suites.
  await prisma.user.delete({ where: { id: req.user!.id } });
  res.sendStatus(204);
}));

app.patch('/api/auth/me', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  const parsed = updateProfileRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'Please correct the highlighted fields and try again.',
      zodFieldErrors(parsed.error),
    );
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { name: parsed.data.name },
  });

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
}));

app.post('/api/auth/logout', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  if (req.sessionToken) {
    try {
      await prisma.session.delete({ where: { token: req.sessionToken } });
    } catch (error: any) {
      // P2025 = "Record to delete does not exist" — the session may have
      // already been removed (e.g. expired-session cleanup in requireAuth,
      // or a concurrent logout). That's an acceptable no-op; any other error
      // (e.g. a genuine DB failure) should not be silently swallowed, since
      // the client would otherwise receive a 204 implying logout succeeded
      // when the session might still exist server-side.
      if (error?.code !== 'P2025') {
        throw error;
      }
    }
  }
  res.sendStatus(204);
}));

app.get('/api/user/config', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  if (!supportsUserConfigModels()) {
    return sendError(
      res,
      503,
      'SERVICE_UNAVAILABLE',
      'User config models are not available yet. Run Prisma migrate + generate, then restart API.',
    );
  }

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
}));

app.put('/api/user/config', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  if (!supportsUserConfigModels()) {
    return sendError(
      res,
      503,
      'SERVICE_UNAVAILABLE',
      'User config models are not available yet. Run Prisma migrate + generate, then restart API.',
    );
  }

  const parsed = updateUserConfigRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(
      res,
      400,
      'VALIDATION_ERROR',
      'Please correct the highlighted fields and try again.',
      zodFieldErrors(parsed.error),
    );
  }

  const userId = req.user!.id;
  const [allBookmakers, allBetTypes] = await Promise.all([
    prisma.bookmakers.findMany({ orderBy: { bookmakers: 'asc' } }),
    prisma.betTypes.findMany({ orderBy: { betTypes: 'asc' } }),
  ]);
  const allowedBookmakers = new Set(allBookmakers.map((item) => item.bookmakers));
  const allowedBetTypes = new Set(allBetTypes.map((item) => item.betTypes));

  const body = parsed.data;
  const inputEnabled = Array.isArray(body.enabledBookmakers)
    ? sanitizeUniqueStrings(body.enabledBookmakers)
    : null;
  const defaultBookmakerInput =
    body.defaultBookmaker === null || body.defaultBookmaker === undefined
      ? null
      : body.defaultBookmaker;
  const defaultBetTypeInput =
    body.defaultBetType === null || body.defaultBetType === undefined ? null : body.defaultBetType;
  const defaultStakeInput =
    body.defaultStake === null || body.defaultStake === undefined ? null : body.defaultStake;

  if (defaultBookmakerInput !== null && !allowedBookmakers.has(defaultBookmakerInput as any)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid default bookmaker.', [
      { field: 'defaultBookmaker', message: 'Invalid default bookmaker.' },
    ]);
  }

  if (defaultBetTypeInput !== null && !allowedBetTypes.has(defaultBetTypeInput)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid default bet type.', [
      { field: 'defaultBetType', message: 'Invalid default bet type.' },
    ]);
  }

  if (inputEnabled) {
    const invalid = inputEnabled.find((item) => !allowedBookmakers.has(item as any));
    if (invalid) {
      return sendError(res, 400, 'VALIDATION_ERROR', `Invalid bookmaker: ${invalid}`, [
        { field: 'enabledBookmakers', message: `Invalid bookmaker: ${invalid}` },
      ]);
    }
    if (inputEnabled.length === 0) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'At least one bookmaker must be enabled.', [
        { field: 'enabledBookmakers', message: 'At least one bookmaker must be enabled.' },
      ]);
    }
  }

  const currentConfig = await ensureUserBetConfig(userId);
  const currentEnabled = currentConfig.enabledBookmakers;
  const nextEnabled = inputEnabled || currentEnabled;

  if (defaultBookmakerInput !== null && !nextEnabled.includes(defaultBookmakerInput as any)) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'Default bookmaker must be enabled.', [
      { field: 'defaultBookmaker', message: 'Default bookmaker must be enabled.' },
    ]);
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
}));

// GET BETS (with basic filtering)
app.get('/api/bets', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
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
}));

app.get('/api/team-suggestions', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
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
}));

app.get('/api/suggestions', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
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
}));

app.get('/api/player-suggestions', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
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
}));

app.post('/api/bets', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  const data: Record<string, unknown> = { ...req.body };
  data.result = normalizeResultValue(data.result);
  data.stakeType = normalizeStakeTypeValue(data.stakeType);
  data.cashOutValue = data.result === 'VOID' ? toNumberOrNull(data.cashOutValue) : null;
  data.userId = req.user?.id;

  // Structured-market fields are all optional/nullable — sanitize empty
  // strings (sent by the Vue <select> "unselected" state) down to null so
  // Prisma never receives an invalid FK/decimal value.
  data.marketId = data.marketId ? Number(data.marketId) : null;
  data.selectionId = data.selectionId ? Number(data.selectionId) : null;
  data.lineValue = data.lineValue !== null && data.lineValue !== undefined && data.lineValue !== ''
    ? toNumberOrNull(data.lineValue)
    : null;
  data.fixtureId = data.fixtureId ? String(data.fixtureId) : null;
  data.playerId = data.playerId ? String(data.playerId) : null;

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
}));

app.put('/api/bets/:id', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
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
  data.marketId = data.marketId ? Number(data.marketId) : existing.marketId;
  data.selectionId = data.selectionId ? Number(data.selectionId) : existing.selectionId;
  data.lineValue = data.lineValue !== null && data.lineValue !== undefined && data.lineValue !== ''
    ? toNumberOrNull(data.lineValue)
    : existing.lineValue;
  data.fixtureId = data.fixtureId ? String(data.fixtureId) : existing.fixtureId;
  data.playerId = data.playerId ? String(data.playerId) : existing.playerId;
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
}));

app.patch('/api/bets/bulk-result', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
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
}));

app.delete('/api/bets/:id', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  const existing = await prisma.bet.findFirst({
    where: { id: req.params.id, userId: req.user?.id },
    select: { id: true },
  });

  if (!existing) {
    return res.status(404).json({ error: 'Bet not found' });
  }

  await prisma.bet.delete({ where: { id: req.params.id } });
  res.sendStatus(204);
}));

app.get('/api/bet-types', requireAuth, asyncHandler(async (_req, res) => {
  const betTypes = await prisma.betTypes.findMany({ orderBy: { betTypes: 'asc' } });
  res.json(betTypes);
}));

app.get('/api/player-prop-markets', requireAuth, asyncHandler(async (_req, res) => {
  const markets = await prisma.playerPropMarkets.findMany({ orderBy: { markets: 'asc' } });
  res.json(markets);
}));

// Structured market catalog (Market/MarketSelection/MarketLine) that powers
// the Add/Edit Bet dropdowns going forward. Supersedes /api/bet-types and
// /api/player-prop-markets above, which are left in place unchanged for
// backward compatibility with any historical bet data still referencing the
// old flat string tables.
app.get('/api/markets', requireAuth, asyncHandler(async (_req, res) => {
  const markets = await prisma.market.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      selections: { orderBy: { sortOrder: 'asc' } },
      lines: { orderBy: { sortOrder: 'asc' } },
    },
  });
  res.json(markets);
}));

const MAX_FIXTURE_LOOKAHEAD_DAYS = 7;

const toDateOnly = (date: Date): string => date.toISOString().slice(0, 10);

const parseDateOnly = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

// Intentionally not behind requireAuth — this powers the animated fixtures
// banner on the logged-out Sign In / Sign Up pages, so it must be readable
// without a session. It only ever reads from our own cached Fixture table
// (refreshed daily by scripts/refresh-fixtures.ts / the scheduler below),
// never calling out to TheSportsDB directly from a request handler.
//
// "Today" is resolved against the caller's own local calendar day, not the
// server's UTC clock — otherwise a viewer whose local time is far enough
// ahead of UTC would see a fixture the server still considers "today" (by
// UTC) even though it has already rolled over into "tomorrow" locally. The
// optional `tzOffsetMinutes` query param mirrors JS's
// `Date.getTimezoneOffset()` sign convention (positive = local time is
// behind UTC, negative = ahead) and defaults to `0` (UTC) when omitted or
// invalid, preserving existing behavior for any caller that doesn't send it.
app.get('/api/fixtures/today', asyncHandler(async (req, res) => {
  const rawOffset = Number(req.query.tzOffsetMinutes);
  const tzOffsetMinutes = Number.isFinite(rawOffset) ? rawOffset : 0;

  // Shift "now" into the caller's local time, truncate to that local
  // calendar day, then shift back to UTC to get correct query boundaries.
  const nowLocal = new Date(Date.now() - tzOffsetMinutes * 60 * 1000);
  const startOfDayLocal = new Date(nowLocal);
  startOfDayLocal.setUTCHours(0, 0, 0, 0);
  const endOfDayLocal = new Date(startOfDayLocal);
  endOfDayLocal.setUTCDate(endOfDayLocal.getUTCDate() + 1);

  const startOfDay = new Date(startOfDayLocal.getTime() + tzOffsetMinutes * 60 * 1000);
  const endOfDay = new Date(endOfDayLocal.getTime() + tzOffsetMinutes * 60 * 1000);

  const fixtures = await prisma.fixture.findMany({
    where: { kickoffAt: { gte: startOfDay, lt: endOfDay } },
    orderBy: { kickoffAt: 'asc' },
    select: {
      id: true,
      league: true,
      homeTeam: true,
      awayTeam: true,
      kickoffAt: true,
      venue: true,
    },
  });

  res.json(fixtures);
}));

// Returns cached fixtures for a single given date, used to populate the Add
// Bet fixture dropdown. `date` must not be more than 7 days in the future —
// Add Bet never allows logging that far ahead. Past dates that have never
// been cached are fetched on-demand from TheSportsDB (one call per tracked
// competition) and cached permanently, enabling retrospective logging for
// any past date without waiting on the daily refresh job.
app.get('/api/fixtures', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  const dateParam = String(req.query.date || '');
  const requestedDate = parseDateOnly(dateParam);
  if (!requestedDate) {
    return res.status(400).json({ error: 'A valid date query parameter (YYYY-MM-DD) is required.' });
  }

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const maxFutureDate = new Date(startOfToday);
  maxFutureDate.setUTCDate(maxFutureDate.getUTCDate() + MAX_FIXTURE_LOOKAHEAD_DAYS);

  if (requestedDate.getTime() > maxFutureDate.getTime()) {
    return res.status(400).json({
      error: `Bets can only be logged up to ${MAX_FIXTURE_LOOKAHEAD_DAYS} days in advance.`,
    });
  }

  const isPastDate = requestedDate.getTime() < startOfToday.getTime();
  const startOfRequestedDay = requestedDate;
  const endOfRequestedDay = new Date(requestedDate);
  endOfRequestedDay.setUTCDate(endOfRequestedDay.getUTCDate() + 1);

  let fixtures = await prisma.fixture.findMany({
    where: { kickoffAt: { gte: startOfRequestedDay, lt: endOfRequestedDay } },
    orderBy: { kickoffAt: 'asc' },
  });

  // On-demand cache fill for a past date we've never seen before — future
  // dates are always covered by the daily refresh job, so this is the only
  // path that ever hits TheSportsDB live from a request handler, and only
  // for genuinely new historical lookups.
  if (isPastDate && fixtures.length === 0) {
    const dateString = toDateOnly(requestedDate);
    const fetched = await fetchFixturesForDate(dateString);

    if (fetched.length > 0) {
      await prisma.$transaction(
        fetched.map((fixture) =>
          prisma.fixture.upsert({
            where: { sportsDbEventId: fixture.sportsDbEventId },
            create: {
              sportsDbEventId: fixture.sportsDbEventId,
              league: fixture.league,
              homeTeam: fixture.homeTeam,
              awayTeam: fixture.awayTeam,
              homeTeamSportsDbId: fixture.homeTeamSportsDbId,
              awayTeamSportsDbId: fixture.awayTeamSportsDbId,
              kickoffAt: fixture.kickoffAt,
              venue: fixture.venue,
              isHistorical: true,
            },
            update: {
              homeTeam: fixture.homeTeam,
              awayTeam: fixture.awayTeam,
              homeTeamSportsDbId: fixture.homeTeamSportsDbId,
              awayTeamSportsDbId: fixture.awayTeamSportsDbId,
              kickoffAt: fixture.kickoffAt,
              venue: fixture.venue,
              isHistorical: true,
              fetchedAt: new Date(),
            },
          }),
        ),
      );

      fixtures = await prisma.fixture.findMany({
        where: { kickoffAt: { gte: startOfRequestedDay, lt: endOfRequestedDay } },
        orderBy: { kickoffAt: 'asc' },
      });
    }
  }

  res.json(fixtures);
}));

// Returns the cached rosters for both teams in a given fixture, used to
// populate the Add Bet player dropdown when the selected market requires a
// player. Every time a fixture is selected, we reconcile our Player cache
// against TheSportsDB's current rosters for both teams rather than trusting
// whatever is already cached indefinitely -- this is what actually builds
// up (and keeps accurate) our per-team cache over time, instead of relying
// solely on the narrow next-7-days window the daily refresh job covers.
//
// Reconciliation per team:
//   - Upsert every player TheSportsDB currently returns for the team, keyed
//     by their globally-unique sportsDbId. If a player has moved from
//     another team we already had them cached under, this upsert naturally
//     re-points their teamSportsDbId/teamName to the new team.
//   - Delete any Player row still pointing at this team that TheSportsDB no
//     longer lists on that team's roster -- this is what removes a player
//     from their old team once they have moved on (their row either gets
//     recreated under the new team by that team's own upsert above/below,
//     or simply disappears if they left a tracked team's squad entirely).
//     Bet.playerId references SetNull on delete, so historical bets
//     referencing a removed player are preserved, just unlinked.
//   - If the upstream fetch for a team fails (network error, rate limit) or
//     returns zero players, we skip both the upsert and the prune for that
//     team and fall back to whatever is already cached -- a transient
//     failure must never be allowed to wipe out a previously good cache.
//   - If the fetch returns exactly the free tier's known cap size while we
//     already have a fuller roster cached (isSuspectedPlayerTruncation),
//     we still upsert what came back but skip the delete step -- this
//     guards against a configured key reverting to the free tier (e.g. a
//     Premium subscription lapsing) silently pruning a good cache down to
//     10 players just because that's all a truncated response contained.
app.get('/api/fixtures/:id/players', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
  if (!fixture) {
    return res.status(404).json({ error: 'Fixture not found' });
  }

  const teamEntries: Array<{ id: string | null; name: string }> = [
    { id: fixture.homeTeamSportsDbId, name: fixture.homeTeam },
    { id: fixture.awayTeamSportsDbId, name: fixture.awayTeam },
  ];

  const players: Record<string, unknown>[] = [];
  for (const team of teamEntries) {
    if (!team.id) continue;

    let cached = await prisma.player.findMany({
      where: { teamSportsDbId: team.id },
      orderBy: { name: 'asc' },
    });

    try {
      const fetched = await fetchPlayersForTeam(team.id);
      if (fetched.length > 0) {
        const fetchedIds = fetched.map((player) => player.sportsDbId);
        const suspectedTruncation = isSuspectedPlayerTruncation(fetched.length, cached.length);

        const operations: Array<ReturnType<typeof prisma.player.upsert> | ReturnType<typeof prisma.player.deleteMany>> = [
          ...fetched.map((player) =>
            prisma.player.upsert({
              where: { sportsDbId: player.sportsDbId },
              create: {
                sportsDbId: player.sportsDbId,
                teamSportsDbId: player.teamSportsDbId,
                teamName: team.name,
                name: player.name,
                position: player.position,
              },
              update: {
                teamSportsDbId: player.teamSportsDbId,
                teamName: team.name,
                name: player.name,
                position: player.position,
                fetchedAt: new Date(),
              },
            }),
          ),
        ];

        if (!suspectedTruncation) {
          // Remove players no longer on this team's roster (retired, left the
          // club, or moved to another team -- TheSportsDB simply won't list
          // them here anymore). If they moved to the fixture's other team,
          // that team's own upsert above/below re-adds them there.
          operations.push(
            prisma.player.deleteMany({
              where: { teamSportsDbId: team.id, sportsDbId: { notIn: fetchedIds } },
            }),
          );
        } else {
          console.warn(
            `Suspected truncated roster fetch for team ${team.id} (got ${fetched.length}, had ` +
              `${cached.length} cached) -- skipping prune to avoid destroying a fuller cache.`,
          );
        }

        await prisma.$transaction(operations);

        cached = await prisma.player.findMany({
          where: { teamSportsDbId: team.id },
          orderBy: { name: 'asc' },
        });
      }
    } catch (error) {
      console.error(`Failed to refresh roster for team ${team.id}:`, error);
    }

    players.push(...cached);
  }

  res.json({ homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam, players });
}));


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

const refreshFixturesCache = async () => {
  try {
    const today = new Date();
    const dates = Array.from({ length: MAX_FIXTURE_LOOKAHEAD_DAYS + 1 }, (_, i) => {
      const date = new Date(today);
      date.setUTCDate(date.getUTCDate() + i);
      return toDateOnly(date);
    });

    // Sequential (not Promise.all) — every call fetchFixturesForDateWithStats
    // makes goes through thesportsdb.ts's shared rate limiter, which paces
    // every request against TheSportsDB's global 30/minute free-tier
    // budget. No artificial extra delay between dates is needed since the
    // limiter already enforces the real constraint (see the same note in
    // scripts/refresh-fixtures.ts).
    const fixturesByDate: Array<Awaited<ReturnType<typeof fetchFixturesForDateWithStats>>> = [];
    for (const date of dates) {
      fixturesByDate.push(await fetchFixturesForDateWithStats(date));
    }
    const fixtures = fixturesByDate.flatMap((r) => r.fixtures);
    const totalFailedLeagues = fixturesByDate.reduce((sum, r) => sum + r.failedLeagues, 0);
    const totalLeagueCalls = fixturesByDate.reduce((sum, r) => sum + r.totalLeagues, 0);

    await prisma.$transaction(
      fixtures.map((fixture) =>
        prisma.fixture.upsert({
          where: { sportsDbEventId: fixture.sportsDbEventId },
          create: {
            sportsDbEventId: fixture.sportsDbEventId,
            league: fixture.league,
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            homeTeamSportsDbId: fixture.homeTeamSportsDbId,
            awayTeamSportsDbId: fixture.awayTeamSportsDbId,
            kickoffAt: fixture.kickoffAt,
            venue: fixture.venue,
            isHistorical: false,
          },
          update: {
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            homeTeamSportsDbId: fixture.homeTeamSportsDbId,
            awayTeamSportsDbId: fixture.awayTeamSportsDbId,
            kickoffAt: fixture.kickoffAt,
            venue: fixture.venue,
            fetchedAt: new Date(),
          },
        }),
      ),
    );

    // Pruning only ever targets the future window (isHistorical: false) —
    // past-dated fixtures cached via the on-demand GET /api/fixtures path
    // are permanent records and must never be deleted here. Also skip
    // entirely if a meaningful share of this run's upstream calls failed
    // (e.g. rate-limited), since that would otherwise wipe out a valid
    // cache just because TheSportsDB temporarily refused requests.
    if (totalLeagueCalls > 0 && totalFailedLeagues / totalLeagueCalls > 0.2) {
      console.warn(
        `Skipping fixtures prune: ${totalFailedLeagues}/${totalLeagueCalls} upstream league calls failed ` +
          `this run (likely rate-limited).`,
      );
    } else {
      const fetchedIds = fixtures.map((fixture) => fixture.sportsDbEventId);
      await prisma.fixture.deleteMany({
        where: { sportsDbEventId: { notIn: fetchedIds }, isHistorical: false },
      });
    }

    console.log(
      `Fixtures cache refreshed: ${fixtures.length} fixtures for ${dates[0]}..${dates[dates.length - 1]}.`,
    );
  } catch (error) {
    console.error('Failed to refresh fixtures cache:', error);
  }
};


const FIXTURES_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);

  // Kick off an initial refresh on boot (so the banner has data even before
  // the first scheduled interval elapses), then keep it in sync daily.
  // This mirrors scripts/refresh-fixtures.ts and can be run manually via
  // `npm run refresh:fixtures` as well (e.g. from an external cron/CI job).
  void refreshFixturesCache();
  setInterval(() => {
    void refreshFixturesCache();
  }, FIXTURES_REFRESH_INTERVAL_MS);
});

