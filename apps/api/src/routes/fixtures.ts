import express from 'express';
import { prisma } from '../prisma';
import { asyncHandler, requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import {
  ensurePastDateCached,
  MAX_FIXTURE_LOOKAHEAD_DAYS,
  MAX_FIXTURE_RANGE_DAYS,
  parseDateOnly,
  PLAYER_CACHE_FRESHNESS_MS,
  reconcilePlayersForTeamInBackground,
  toDateOnly,
} from '../lib/fixtures-cache';

const router = express.Router();

// Intentionally not behind requireAuth — this powers the animated fixtures
// banner on the logged-out Sign In / Sign Up pages, so it must be readable
// without a session. It only ever reads from our own cached Fixture table
// (refreshed daily by scripts/refresh-fixtures.ts / jobs/refresh-fixtures-cache.ts),
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
router.get('/fixtures/today', asyncHandler(async (req, res) => {
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

// Returns cached fixtures for either a single given date (`date`) or an
// inclusive date range (`from`/`to`), used to populate the Add/Edit Bet
// fixture dropdown(s). The range form exists because Accumulator and Cross
// Match Bet Builder legs can be drawn from fixtures spanning several days
// (e.g. a Saturday + Sunday fixture in the same bet) — the single-`date`
// form remains for Match/Player Prop/Bet Builder, which only ever need one
// day. Neither form allows requesting more than `MAX_FIXTURE_LOOKAHEAD_DAYS`
// days into the future — Add Bet never allows logging that far ahead. Past
// dates that have never been cached are fetched on-demand from TheSportsDB
// (one call per tracked competition, per missing date) and cached
// permanently, enabling retrospective logging for any past date without
// waiting on the daily refresh job.
router.get('/fixtures', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  const dateParam = String(req.query.date || '');
  const fromParam = String(req.query.from || '');
  const toParam = String(req.query.to || '');
  const isRangeRequest = Boolean(fromParam || toParam);

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  const maxFutureDate = new Date(startOfToday);
  maxFutureDate.setUTCDate(maxFutureDate.getUTCDate() + MAX_FIXTURE_LOOKAHEAD_DAYS);

  let startOfRange: Date;
  let endOfRangeExclusive: Date;

  if (isRangeRequest) {
    const fromDate = parseDateOnly(fromParam);
    const toDate = parseDateOnly(toParam);
    if (!fromDate || !toDate) {
      return res.status(400).json({ error: 'Valid from and to query parameters (YYYY-MM-DD) are required.' });
    }
    if (toDate.getTime() < fromDate.getTime()) {
      return res.status(400).json({ error: 'to must not be before from.' });
    }
    const spanDays = Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000));
    if (spanDays > MAX_FIXTURE_RANGE_DAYS) {
      return res.status(400).json({
        error: `The from/to range cannot span more than ${MAX_FIXTURE_RANGE_DAYS} days.`,
      });
    }
    if (toDate.getTime() > maxFutureDate.getTime()) {
      return res.status(400).json({
        error: `Bets can only be logged up to ${MAX_FIXTURE_LOOKAHEAD_DAYS} days in advance.`,
      });
    }
    startOfRange = fromDate;
    endOfRangeExclusive = new Date(toDate);
    endOfRangeExclusive.setUTCDate(endOfRangeExclusive.getUTCDate() + 1);
  } else {
    const requestedDate = parseDateOnly(dateParam);
    if (!requestedDate) {
      return res.status(400).json({ error: 'A valid date query parameter (YYYY-MM-DD) is required.' });
    }
    if (requestedDate.getTime() > maxFutureDate.getTime()) {
      return res.status(400).json({
        error: `Bets can only be logged up to ${MAX_FIXTURE_LOOKAHEAD_DAYS} days in advance.`,
      });
    }
    startOfRange = requestedDate;
    endOfRangeExclusive = new Date(requestedDate);
    endOfRangeExclusive.setUTCDate(endOfRangeExclusive.getUTCDate() + 1);
  }

  const fixturesQuery = () =>
    prisma.fixture.findMany({
      where: { kickoffAt: { gte: startOfRange, lt: endOfRangeExclusive } },
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

  let fixtures = await fixturesQuery();

  // On-demand cache fill for every past date within the requested span that
  // we've never seen before — future dates are always covered by the daily
  // refresh job. We only need to fill dates that came back with zero cached
  // fixtures; a date with at least one cached fixture is assumed already
  // populated (mirrors the pre-existing single-date behavior).
  const cachedDates = new Set(fixtures.map((f) => toDateOnly(f.kickoffAt)));
  const datesNeedingFill: Date[] = [];
  for (
    let cursor = new Date(startOfRange);
    cursor.getTime() < endOfRangeExclusive.getTime();
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const cursorDate = new Date(cursor);
    if (cursorDate.getTime() >= startOfToday.getTime()) continue; // future/today handled by the daily refresh job
    if (cachedDates.has(toDateOnly(cursorDate))) continue;
    datesNeedingFill.push(cursorDate);
  }

  if (datesNeedingFill.length > 0) {
    // Sequential, not Promise.all — every call goes through thesportsdb.ts's
    // shared rate limiter (see the same note elsewhere in this file), so
    // there's no throughput benefit to parallelizing and doing so would only
    // risk bursting past the limiter's pacing.
    for (const missingDate of datesNeedingFill) {
      await ensurePastDateCached(missingDate);
    }
    fixtures = await fixturesQuery();
  }

  res.json(fixtures);
}));

// Returns the cached rosters for both teams in a given fixture, used to
// populate the Add Bet player dropdown when the selected market requires a
// player. Responds with whatever is already cached immediately -- the
// cached rows are already accurate enough to display -- rather than making
// the caller wait on a live TheSportsDB reconciliation call before
// responding. Reconciliation against TheSportsDB's current rosters for
// both teams still happens (unless the cache is fresh enough to skip, see
// PLAYER_CACHE_FRESHNESS_MS), but fires in the background after the
// response has already been sent, so it can keep building up/correcting
// the cache over time without blocking the UI on every fixture selection.
router.get('/fixtures/:id/players', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  const fixture = await prisma.fixture.findUnique({ where: { id: req.params.id } });
  if (!fixture) {
    return res.status(404).json({ error: 'Fixture not found' });
  }

  const teamEntries: Array<{ id: string | null; name: string }> = [
    { id: fixture.homeTeamSportsDbId, name: fixture.homeTeam },
    { id: fixture.awayTeamSportsDbId, name: fixture.awayTeam },
  ];
  const teamIds = teamEntries.map((team) => team.id).filter((id): id is string => Boolean(id));

  // Single batched query for both teams' rosters (rather than one query per
  // team) — cheap either way at 2 teams, but avoids an extra round trip.
  const cachedPlayers = teamIds.length
    ? await prisma.player.findMany({
        where: { teamSportsDbId: { in: teamIds } },
        orderBy: { name: 'asc' },
      })
    : [];
  const cachedByTeam = new Map<string, typeof cachedPlayers>();
  for (const teamId of teamIds) {
    cachedByTeam.set(teamId, cachedPlayers.filter((player) => player.teamSportsDbId === teamId));
  }

  const players = teamEntries.flatMap((team) => (team.id ? cachedByTeam.get(team.id) || [] : []));
  res.json({ homeTeam: fixture.homeTeam, awayTeam: fixture.awayTeam, players });

  // Everything below runs after the response has already been sent -- any
  // error here must never surface to the caller (there's no response left
  // to send it on), so this is deliberately fire-and-forget with its own
  // catch per team (handled inside reconcilePlayersForTeamInBackground).
  for (const team of teamEntries) {
    if (!team.id) continue;
    const cached = cachedByTeam.get(team.id) || [];
    const cacheFreshEnoughToSkip =
      cached.length > 0 &&
      cached.every((player) => Date.now() - player.fetchedAt.getTime() < PLAYER_CACHE_FRESHNESS_MS);
    if (cacheFreshEnoughToSkip) continue;

    void reconcilePlayersForTeamInBackground(team.id, team.name, cached);
  }
}));

export default router;


