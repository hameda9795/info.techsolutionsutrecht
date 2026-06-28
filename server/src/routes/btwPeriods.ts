import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import type { BtwPeriodMeta } from '../types.js';

const toBtwPeriod = (r: any): BtwPeriodMeta => ({
  id: r.id,
  year: r.year,
  quarter: r.quarter,
  state: r.state,
  note: r.note ?? undefined,
  updatedAt: r.updated_at.toISOString(),
});

export default async function btwPeriodsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/api/btw-periods', async () => {
    const res = await pool.query('SELECT * FROM btw_periods ORDER BY year, quarter');
    return res.rows.map(toBtwPeriod);
  });

  app.put('/api/btw-periods/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const m = req.body as BtwPeriodMeta;
    if (m.id !== id) return reply.code(400).send({ error: 'id mismatch' });
    await pool.query(
      `INSERT INTO btw_periods (id, year, quarter, state, note, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (id) DO UPDATE SET state = $4, note = $5, updated_at = $6`,
      [m.id, m.year, m.quarter, m.state, m.note ?? null, m.updatedAt]
    );
    return { ok: true };
  });
}
