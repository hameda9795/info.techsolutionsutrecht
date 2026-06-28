import type { FastifyInstance } from 'fastify';
import {
  verifyPassword,
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  getSessionIdFromRequest,
  requireAuth,
} from '../auth.js';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function authRoutes(app: FastifyInstance) {
  app.post(
    '/api/auth/login',
    {
      config: {
        rateLimit: { max: 5, timeWindow: '15 minutes' },
      },
    },
    async (req, reply) => {
      const { password } = req.body as { password?: string };
      // Constant-ish delay on every attempt (success or failure) to blunt fast
      // automated guessing — this is the single shared credential for the app.
      await wait(500);
      if (!password || !(await verifyPassword(password))) {
        req.log.warn({ ip: req.ip }, 'failed login attempt');
        return reply.code(401).send({ error: 'Ongeldig wachtwoord' });
      }
      const { id, expiresAt } = await createSession();
      setSessionCookie(reply, id, expiresAt);
      return { ok: true };
    }
  );

  app.post('/api/auth/logout', async (req, reply) => {
    const sessionId = getSessionIdFromRequest(req);
    if (sessionId) await destroySession(sessionId);
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get('/api/auth/me', { preHandler: requireAuth }, async () => ({ ok: true }));
}
