import express from 'express';
import { prisma } from '../prisma';
import { sendError, zodFieldErrors } from '../errors';
import { updateUserConfigRequestSchema } from '../validation';
import { asyncHandler, requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { sanitizeUniqueStrings } from '../lib/bet-calculations';
import {
  DEFAULT_BET_TYPE,
  DEFAULT_STAKE,
  ensureUserBetConfig,
  supportsUserConfigModels,
} from '../lib/user-config';

const router = express.Router();

router.get('/user/config', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
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

router.put('/user/config', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  if (!supportsUserConfigModels()) {
    return sendError(
      res,
      503,
      'SERVICE_UNAVAILABLE',
      'User config models are not available yet. Run Prisma migrate + generate, then restart API.',
    );
  }

  const userId = req.user!.id;
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

  res.json({
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

export default router;
