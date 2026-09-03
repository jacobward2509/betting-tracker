import { prisma } from '../prisma';
import { sanitizeUniqueStrings } from './bet-calculations';

export const DEFAULT_BET_TYPE = 'Player Prop';
export const DEFAULT_STAKE = 5;

export const supportsUserConfigModels = () =>
  Boolean((prisma as any).userBookmaker) && Boolean((prisma as any).userPreference);

export type UserConfigOverrides = {
  enabledBookmakers?: string[] | null;
  defaultBookmaker?: string | null;
  defaultBetType?: string | null;
  defaultStake?: number | null;
};

export const ensureUserBetConfig = async (userId: string, overrides?: UserConfigOverrides) => {
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
