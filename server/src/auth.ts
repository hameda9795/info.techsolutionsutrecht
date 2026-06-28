import { randomBytes } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const SESSION_COOKIE = 'factor_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const verifyPassword = async (password: string): Promise<boolean> => {
  const hash = process.env.AUTH_PASSWORD_HASH;
  if (!hash) throw new Error('AUTH_PASSWORD_HASH is not configured');
  return bcrypt.compare(password, hash);
};

export const createSession = async (): Promise<{ id: string; expiresAt: Date }> => {
  // Session ids are security tokens — must come from a CSPRNG, not Math.random()
  // (which is what db.ts's generateId() uses, fine for ordinary record ids only).
  const id = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await pool.query('INSERT INTO sessions (id, expires_at) VALUES ($1, $2)', [id, expiresAt]);
  return { id, expiresAt };
};

export const destroySession = async (sessionId: string): Promise<void> => {
  await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
};

const isSessionValid = async (sessionId: string): Promise<boolean> => {
  const res = await pool.query('SELECT 1 FROM sessions WHERE id = $1 AND expires_at > now()', [
    sessionId,
  ]);
  return res.rowCount! > 0;
};

export const setSessionCookie = (reply: FastifyReply, sessionId: string, expiresAt: Date) => {
  reply.setCookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    // `none` rather than `lax`: the frontend (info.techsolutionsutrecht.nl) and this
    // API (api.techsolutionsutrecht.nl) are same-site in production so `lax` would
    // technically work there, but local frontend dev (http://localhost:5173) talking
    // to this same deployed API is genuinely cross-site — `lax` silently drops the
    // cookie on cross-site fetch, breaking local dev with no clear error. `none`
    // requires `secure` (already set) and is safe here because state-changing
    // requests are independently guarded by requireOriginCheck (see index.ts) plus
    // the strict CORS allowlist — see comment there for the full reasoning.
    sameSite: 'none',
    path: '/',
    expires: expiresAt,
  });
};

export const clearSessionCookie = (reply: FastifyReply) => {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
};

export const getSessionIdFromRequest = (req: FastifyRequest): string | undefined =>
  req.cookies[SESSION_COOKIE];

/** Fastify preHandler hook: rejects with 401 if there's no valid session. Attach to every protected route. */
export const requireAuth = async (req: FastifyRequest, reply: FastifyReply) => {
  const sessionId = getSessionIdFromRequest(req);
  if (!sessionId || !(await isSessionValid(sessionId))) {
    reply.code(401).send({ error: 'Niet ingelogd' });
  }
};

/** Periodically clear expired sessions so the table doesn't grow unbounded. */
export const pruneExpiredSessions = async (): Promise<void> => {
  await pool.query('DELETE FROM sessions WHERE expires_at <= now()');
};
