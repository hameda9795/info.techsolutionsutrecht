import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import type { Client } from '../types.js';

const toClient = (r: any): Client => ({
  id: r.id,
  name: r.name,
  email: r.email,
  company: r.company ?? undefined,
  address: r.address ?? undefined,
  kvk: r.kvk ?? undefined,
  createdAt: r.created_at.toISOString(),
});

export default async function clientsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/api/clients', async () => {
    const res = await pool.query('SELECT * FROM clients ORDER BY created_at');
    return res.rows.map(toClient);
  });

  app.get('/api/clients/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = await pool.query('SELECT * FROM clients WHERE id = $1', [id]);
    if (res.rowCount === 0) return reply.code(404).send({ error: 'Niet gevonden' });
    return toClient(res.rows[0]);
  });

  app.put('/api/clients/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const c = req.body as Client;
    if (c.id !== id) return reply.code(400).send({ error: 'id mismatch' });
    await pool.query(
      `INSERT INTO clients (id, name, email, company, address, kvk, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET
         name = $2, email = $3, company = $4, address = $5, kvk = $6`,
      [c.id, c.name, c.email, c.company ?? null, c.address ?? null, c.kvk ?? null, c.createdAt]
    );
    return { ok: true };
  });

  app.delete('/api/clients/:id', async (req) => {
    const { id } = req.params as { id: string };
    await pool.query('DELETE FROM clients WHERE id = $1', [id]);
    return { ok: true };
  });
}
