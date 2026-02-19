import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bookmakersRouter from './routes/bookmakers';
import { prisma } from './prisma';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const ALLOWED_ORIGINS = CORS_ORIGIN.split(',')
  .map((value) => value.trim())
  .filter(Boolean);

app.disable('etag');
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
  }),
);
app.use(express.json());

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

const calculateProfit = (input: {
  stake?: unknown;
  odds?: unknown;
  result?: unknown;
  stakeType?: unknown;
  cashOutValue?: unknown;
}): number | null => {
  const stake = toNumberOrNull(input.stake);
  const odds = toOddsOrNull(input.odds);
  const cashOutValue = toNumberOrNull(input.cashOutValue);
  const result = String(input.result || '').toUpperCase();
  const stakeType = String(input.stakeType || '').toUpperCase();

  if (stake === null) return null;

  if (result === 'WON') {
    if (odds === null) return null;
    return stake * odds - stake;
  }

  if (result === 'LOST') {
    if (stakeType === 'FREE') return 0;
    return -stake;
  }

  if (result === 'VOID') {
    if (cashOutValue === null) return null;
    return cashOutValue - stake;
  }

  return null;
};

const normalizeEmail = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

const isValidEmail = (email: string): boolean => /.+@.+\..+/.test(email);
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

app.post('/api/auth/signup', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const name = normalizeName(req.body?.name);
  const password = String(req.body?.password || '');
  const preferences = req.body?.preferences || null;

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }
  if (name.length < 2) {
    return res.status(400).json({ error: 'Name must be at least 2 characters long.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const allBookmakers = await prisma.bookmakers.findMany({ orderBy: { bookmakers: 'asc' } });
  const allowedBookmakers = new Set(allBookmakers.map((item) => item.bookmakers));
  const enabledBookmakersInput = Array.isArray(preferences?.enabledBookmakers)
    ? sanitizeUniqueStrings(preferences.enabledBookmakers)
    : null;
  const defaultBookmakerInput =
    preferences?.defaultBookmaker === null || preferences?.defaultBookmaker === undefined
      ? null
      : String(preferences.defaultBookmaker).trim();
  const defaultBetTypeInput =
    preferences?.defaultBetType === null || preferences?.defaultBetType === undefined
      ? null
      : String(preferences.defaultBetType).trim();
  const defaultStakeInput =
    preferences?.defaultStake === null || preferences?.defaultStake === undefined || preferences?.defaultStake === ''
      ? null
      : Number(preferences.defaultStake);

  if (defaultStakeInput !== null && (!Number.isFinite(defaultStakeInput) || defaultStakeInput <= 0)) {
    return res.status(400).json({ error: 'Default stake must be a positive number.' });
  }
  if (defaultBookmakerInput !== null && !allowedBookmakers.has(defaultBookmakerInput as any)) {
    return res.status(400).json({ error: 'Invalid default bookmaker.' });
  }
  if (enabledBookmakersInput) {
    const invalid = enabledBookmakersInput.find((item) => !allowedBookmakers.has(item as any));
    if (invalid) {
      return res.status(400).json({ error: `Invalid bookmaker: ${invalid}` });
    }
    if (enabledBookmakersInput.length === 0) {
      return res.status(400).json({ error: 'At least one bookmaker must be enabled.' });
    }
  }
  if (
    defaultBookmakerInput !== null &&
    enabledBookmakersInput &&
    !enabledBookmakersInput.includes(defaultBookmakerInput)
  ) {
    return res.status(400).json({ error: 'Default bookmaker must be one of enabled bookmakers.' });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: hashPassword(password),
    },
  });

  await ensureUserBetConfig(user.id, {
    enabledBookmakers: enabledBookmakersInput,
    defaultBookmaker: defaultBookmakerInput,
    defaultBetType: defaultBetTypeInput,
    defaultStake: defaultStakeInput,
  });

  const token = await createSession(user.id);

  res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
  });
});

app.post('/api/auth/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password.' });
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
});

app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
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

app.post('/api/bets', requireAuth, async (req: AuthenticatedRequest, res) => {
  const data: Record<string, unknown> = { ...req.body };
  data.result = normalizeResultValue(data.result);
  data.cashOutValue = data.result === 'VOID' ? toNumberOrNull(data.cashOutValue) : null;
  data.userId = req.user?.id;

  const stake = toNumberOrNull(data.stake);
  const odds = toOddsOrNull(data.odds);
  if (odds === null || odds < 1) {
    return res
      .status(400)
      .json({ error: 'Invalid odds. Use decimal (e.g. 2.5) or fractional (e.g. 3/2).' });
  }

  data.odds = odds;

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
    result: normalizedResult,
    cashOutValue: normalizedCashOutValue,
  };

  const data: Record<string, unknown> = {
    ...req.body,
    result: normalizedResult,
    cashOutValue: normalizedCashOutValue,
  };
  const stake = toNumberOrNull(merged.stake);
  const odds = toOddsOrNull(merged.odds);
  if (odds === null || odds < 1) {
    return res
      .status(400)
      .json({ error: 'Invalid odds. Use decimal (e.g. 2.5) or fractional (e.g. 3/2).' });
  }

  data.odds = odds;

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

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
