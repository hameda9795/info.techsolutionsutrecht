import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import type { CounterRow } from '../types.js';

export default async function miscRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // Read-only counters overview (Instellingen page).
  app.get('/api/counters', async () => {
    const res = await pool.query('SELECT * FROM counters ORDER BY year, prefix');
    return res.rows.map(
      (r): CounterRow => ({ id: r.id, prefix: r.prefix, year: r.year, value: r.value })
    );
  });

  // Read-only legacy archive (old, informally-shaped invoice records).
  app.get('/api/legacy-invoices', async () => {
    const res = await pool.query('SELECT * FROM legacy_invoices ORDER BY id');
    return res.rows.map((r) => ({ _docId: r.id, ...r.data }));
  });
}
