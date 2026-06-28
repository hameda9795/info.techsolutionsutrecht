import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import type { Project } from '../types.js';

const toProject = (r: any): Project => ({
  id: r.id,
  clientId: r.client_id,
  name: r.name,
  description: r.description ?? undefined,
  createdAt: r.created_at.toISOString(),
});

export default async function projectsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/api/projects', async (req) => {
    const { clientId } = req.query as { clientId?: string };
    const res = clientId
      ? await pool.query('SELECT * FROM projects WHERE client_id = $1 ORDER BY created_at', [
          clientId,
        ])
      : await pool.query('SELECT * FROM projects ORDER BY created_at');
    return res.rows.map(toProject);
  });

  app.get('/api/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = await pool.query('SELECT * FROM projects WHERE id = $1', [id]);
    if (res.rowCount === 0) return reply.code(404).send({ error: 'Niet gevonden' });
    return toProject(res.rows[0]);
  });

  app.put('/api/projects/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = req.body as Project;
    if (p.id !== id) return reply.code(400).send({ error: 'id mismatch' });
    await pool.query(
      `INSERT INTO projects (id, client_id, name, description, created_at)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (id) DO UPDATE SET
         client_id = $2, name = $3, description = $4`,
      [p.id, p.clientId, p.name, p.description ?? null, p.createdAt]
    );
    return { ok: true };
  });

  app.delete('/api/projects/:id', async (req) => {
    const { id } = req.params as { id: string };
    await pool.query('DELETE FROM projects WHERE id = $1', [id]);
    return { ok: true };
  });
}
