import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { requireAuth } from './middleware/auth';
import authRouter from './routes/auth';
import userConfigRouter from './routes/user-config';
import betsRouter from './routes/bets';
import catalogRouter from './routes/catalog';
import fixturesRouter from './routes/fixtures';
import bookmakersRouter from './routes/bookmakers';
import { sendError } from './errors';
import { refreshFixturesCache, FIXTURES_REFRESH_INTERVAL_MS } from './jobs/refresh-fixtures-cache';

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

// Each router owns one feature domain and is mounted under the shared /api
// prefix — see src/routes/*.ts. Auth requirements are declared per-route
// inside each router (rather than at the mount point here) since several
// domains mix authenticated and unauthenticated endpoints (e.g. fixtures'
// logged-out banner routes).
app.use('/api', authRouter);
app.use('/api', userConfigRouter);
app.use('/api', betsRouter);
app.use('/api', catalogRouter);
app.use('/api', fixturesRouter);
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

  // Kick off an initial refresh on boot (so the banner has data even before
  // the first scheduled interval elapses), then keep it in sync daily.
  // This mirrors scripts/refresh-fixtures.ts and can be run manually via
  // `npm run refresh:fixtures` as well (e.g. from an external cron/CI job).
  void refreshFixturesCache();
  setInterval(() => {
    void refreshFixturesCache();
  }, FIXTURES_REFRESH_INTERVAL_MS);
});
