import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import type { Payment } from '../types.js';

const toPayment = (r: any): Payment => ({
  id: r.id,
  documentId: r.document_id,
  projectId: r.project_id,
  amount: Number(r.amount),
  paymentDate: r.payment_date,
  paymentMethod: r.payment_method ?? undefined,
  note: r.note ?? undefined,
  createdAt: r.created_at.toISOString(),
});

export default async function paymentsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/api/payments', async (req) => {
    const { documentId, projectId } = req.query as { documentId?: string; projectId?: string };
    let res;
    if (documentId) {
      res = await pool.query('SELECT * FROM payments WHERE document_id = $1 ORDER BY payment_date', [
        documentId,
      ]);
    } else if (projectId) {
      res = await pool.query('SELECT * FROM payments WHERE project_id = $1 ORDER BY payment_date', [
        projectId,
      ]);
    } else {
      res = await pool.query('SELECT * FROM payments ORDER BY payment_date');
    }
    return res.rows.map(toPayment);
  });

  app.put('/api/payments/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = req.body as Payment;
    if (p.id !== id) return reply.code(400).send({ error: 'id mismatch' });
    await pool.query(
      `INSERT INTO payments (id, document_id, project_id, amount, payment_date, payment_method, note, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         amount = $4, payment_date = $5, payment_method = $6, note = $7`,
      [
        p.id,
        p.documentId,
        p.projectId,
        p.amount,
        p.paymentDate,
        p.paymentMethod ?? null,
        p.note ?? null,
        p.createdAt,
      ]
    );
    return { ok: true };
  });

  app.delete('/api/payments/:id', async (req) => {
    const { id } = req.params as { id: string };
    await pool.query('DELETE FROM payments WHERE id = $1', [id]);
    return { ok: true };
  });
}
