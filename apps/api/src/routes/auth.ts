import express from 'express';
import { prisma } from '../prisma';
import { sendError, zodFieldErrors } from '../errors';
import { loginRequestSchema, signupRequestSchema, updateProfileRequestSchema } from '../validation';
import { asyncHandler, requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { createSession, DUMMY_PASSWORD_HASH, hashPassword, verifyPassword } from '../lib/password';
import { ensureUserBetConfig } from '../lib/user-config';

const router = express.Router();

router.post('/auth/signup', asyncHandler(async (req, res) => {
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

router.post('/auth/login', asyncHandler(async (req, res) => {
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

router.get('/auth/me', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  res.json({ user: req.user });
}));

router.delete('/auth/me', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
  // Deleting the User row cascades to Session, UserBookmaker, UserPreference, and
  // Bet rows (all onDelete: Cascade in schema.prisma) — fully removes the account
  // and everything it created. Used to clean up accounts seeded by the Playwright
  // API and UI suites.
  await prisma.user.delete({ where: { id: req.user!.id } });
  res.sendStatus(204);
}));

router.patch('/auth/me', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
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

router.post('/auth/logout', requireAuth, asyncHandler<AuthenticatedRequest>(async (req, res) => {
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

export default router;
