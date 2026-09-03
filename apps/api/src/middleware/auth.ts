import express from 'express';
import { prisma } from '../prisma';

// Express 4 does not automatically forward rejected promises from async route
// handlers to error-handling middleware — this wrapper does that so unexpected
// errors always reach the centralized handler registered in server.ts instead
// of becoming unhandled promise rejections.
export const asyncHandler =
  <Req extends express.Request = express.Request>(
    handler: (req: Req, res: express.Response, next: express.NextFunction) => Promise<unknown>,
  ) =>
  (req: Req, res: express.Response, next: express.NextFunction) => {
    handler(req, res, next).catch(next);
  };

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthenticatedRequest = express.Request & {
  user?: AuthenticatedUser;
  sessionToken?: string;
};

export const requireAuth = async (
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
