import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';

import authRoutes from './routes/auth.js';
import clientsRoutes from './routes/clients.js';
import projectsRoutes from './routes/projects.js';
import documentsRoutes from './routes/documents.js';
import paymentsRoutes from './routes/payments.js';
import purchaseInvoicesRoutes from './routes/purchaseInvoices.js';
import btwPeriodsRoutes from './routes/btwPeriods.js';
import miscRoutes from './routes/misc.js';
import attachmentsRoutes from './routes/attachments.js';
import { pruneExpiredSessions } from './auth.js';

const requiredEnv = ['DATABASE_URL', 'AUTH_PASSWORD_HASH'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    process.exit(1);
  }
}

const app = Fastify({ logger: true, trustProxy: true });

const allowedOrigins = (process.env.FRONTEND_ORIGINS ?? '').split(',').filter(Boolean);

await app.register(cors, {
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  credentials: true,
});
await app.register(cookie);
await app.register(multipart);
await app.register(rateLimit, { global: false });

// CSRF defense-in-depth: the session cookie is SameSite=None (required so the
// frontend can reach this API cross-site, e.g. local dev on a different origin —
// see auth.ts for why `lax` doesn't work here), which on its own would otherwise
// let any site ride the cookie along on a state-changing request. Browsers always
// send `Origin` on fetch/XHR (including same-site ones), so requiring it to match
// the allowlist on every mutating request closes that gap independently of CORS
// (CORS only stops the attacker's JS from *reading* the response, not from sending
// the request in the first place).
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
app.addHook('onRequest', async (req, reply) => {
  if (!MUTATING_METHODS.has(req.method)) return;
  const origin = req.headers.origin;
  if (!origin || !allowedOrigins.includes(origin)) {
    reply.code(403).send({ error: 'Verzoek geweigerd (ongeldige origin).' });
  }
});

await app.register(authRoutes);
await app.register(clientsRoutes);
await app.register(projectsRoutes);
await app.register(documentsRoutes);
await app.register(paymentsRoutes);
await app.register(purchaseInvoicesRoutes);
await app.register(btwPeriodsRoutes);
await app.register(miscRoutes);
await app.register(attachmentsRoutes);

app.get('/api/health', async () => ({ ok: true }));

// Best-effort housekeeping; failure here must never crash the process.
setInterval(() => {
  pruneExpiredSessions().catch((err) => app.log.error(err, 'failed to prune sessions'));
}, 60 * 60 * 1000);

// Bind to all interfaces *inside* the container — the host-level restriction to
// loopback-only comes from the `-p 127.0.0.1:PORT:PORT` Docker publish flag, not
// from this bind address. Binding to 127.0.0.1 here would make the app unreachable
// even through Docker's own port forwarding (it arrives on the container's eth0,
// not its loopback).
const port = Number(process.env.PORT ?? 3020);
app.listen({ port, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
