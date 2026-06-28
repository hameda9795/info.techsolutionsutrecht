import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { recalcDocument, round2 } from '../lib/calc.js';
import { allocateNumber } from '../lib/numbering.js';
import { isLocked, canDelete } from '../lib/lock.js';
import type { Document, DocumentType, SettledAdvance } from '../types.js';

const toDocument = (r: any): Document => ({
  id: r.id,
  projectId: r.project_id,
  clientId: r.client_id,
  documentType: r.document_type,
  invoiceSubtype: r.invoice_subtype ?? undefined,
  documentNumber: r.document_number,
  status: r.status,
  issueDate: r.issue_date,
  dueDate: r.due_date ?? undefined,
  items: r.items,
  subtotalExclBtw: Number(r.subtotal_excl_btw),
  btwPercentage: Number(r.btw_percentage),
  btwAmount: Number(r.btw_amount),
  totalInclBtw: Number(r.total_incl_btw),
  settledAdvances: r.settled_advances ?? undefined,
  paidAmount: Number(r.paid_amount),
  remainingAmount: Number(r.remaining_amount),
  notes: r.notes ?? undefined,
  originalInvoiceId: r.original_invoice_id ?? undefined,
  reason: r.reason ?? undefined,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});

const advancesIncl = (advances?: SettledAdvance[]) =>
  round2((advances ?? []).reduce((s, a) => s + a.inclBtw, 0));

const amountDue = (docu: Document): number =>
  round2(docu.totalInclBtw - advancesIncl(docu.settledAdvances));

const invoiceStatusFor = (due: number, paid: number): Document['status'] => {
  if (paid <= 0) return 'sent';
  if (round2(paid) >= round2(due)) return 'paid';
  return 'partially_paid';
};

export default async function documentsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/api/documents', async (req) => {
    const { projectId } = req.query as { projectId?: string };
    const res = projectId
      ? await pool.query('SELECT * FROM documents WHERE project_id = $1 ORDER BY issue_date', [
          projectId,
        ])
      : await pool.query('SELECT * FROM documents ORDER BY issue_date');
    return res.rows.map(toDocument);
  });

  app.get('/api/documents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
    if (res.rowCount === 0) return reply.code(404).send({ error: 'Niet gevonden' });
    return toDocument(res.rows[0]);
  });

  // Upsert: create a brand-new draft, or edit an existing draft. Status/documentNumber/
  // paidAmount are never taken from the client — only finalize/payments endpoints set those.
  app.put('/api/documents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Document;
    if (body.id !== id) return reply.code(400).send({ error: 'id mismatch' });

    const totals = recalcDocument(body.items);
    const existing = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);

    if (existing.rowCount === 0) {
      // New draft.
      const due = round2(totals.totalInclBtw - advancesIncl(body.settledAdvances));
      const now = new Date().toISOString();
      await pool.query(
        `INSERT INTO documents (
           id, project_id, client_id, document_type, invoice_subtype, document_number, status,
           issue_date, due_date, items, subtotal_excl_btw, btw_percentage, btw_amount,
           total_incl_btw, settled_advances, paid_amount, remaining_amount, notes,
           original_invoice_id, reason, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,NULL,'draft',$6,$7,$8,$9,$10,$11,$12,$13,0,$14,$15,$16,$17,$18,$18)`,
        [
          body.id,
          body.projectId,
          body.clientId,
          body.documentType,
          body.invoiceSubtype ?? null,
          body.issueDate,
          body.dueDate ?? null,
          JSON.stringify(body.items),
          totals.subtotalExclBtw,
          totals.btwPercentage,
          totals.btwAmount,
          totals.totalInclBtw,
          body.settledAdvances ? JSON.stringify(body.settledAdvances) : null,
          due,
          body.notes ?? null,
          body.originalInvoiceId ?? null,
          body.reason ?? null,
          now,
        ]
      );
    } else {
      const current = toDocument(existing.rows[0]);
      if (isLocked(current)) {
        return reply.code(409).send({ error: 'Document is vergrendeld en kan niet worden bewerkt.' });
      }
      const due = round2(totals.totalInclBtw - advancesIncl(body.settledAdvances) - current.paidAmount);
      await pool.query(
        `UPDATE documents SET
           issue_date = $2, due_date = $3, items = $4, subtotal_excl_btw = $5, btw_percentage = $6,
           btw_amount = $7, total_incl_btw = $8, settled_advances = $9, remaining_amount = $10,
           notes = $11, reason = $12, updated_at = $13
         WHERE id = $1`,
        [
          id,
          body.issueDate,
          body.dueDate ?? null,
          JSON.stringify(body.items),
          totals.subtotalExclBtw,
          totals.btwPercentage,
          totals.btwAmount,
          totals.totalInclBtw,
          body.settledAdvances ? JSON.stringify(body.settledAdvances) : null,
          due,
          body.notes ?? null,
          body.reason ?? current.reason ?? null,
          new Date().toISOString(),
        ]
      );
    }

    const res = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
    return toDocument(res.rows[0]);
  });

  app.delete('/api/documents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const res = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
    if (res.rowCount === 0) return { ok: true };
    if (!canDelete(toDocument(res.rows[0]))) {
      return reply.code(409).send({ error: 'Definitieve documenten kunnen niet worden verwijderd.' });
    }
    await pool.query('DELETE FROM documents WHERE id = $1', [id]);
    return { ok: true };
  });

  // Allocate the gapless official number and move draft -> sent. Idempotent.
  app.post('/api/documents/:id/finalize', async (req, reply) => {
    const { id } = req.params as { id: string };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await client.query('SELECT * FROM documents WHERE id = $1 FOR UPDATE', [id]);
      if (res.rowCount === 0) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'Niet gevonden' });
      }
      const docu = toDocument(res.rows[0]);
      if (docu.documentNumber) {
        await client.query('COMMIT');
        return docu;
      }
      const number = await allocateNumber(client, docu.documentType as DocumentType);
      await client.query(
        `UPDATE documents SET document_number = $2, status = 'sent', updated_at = $3 WHERE id = $1`,
        [id, number, new Date().toISOString()]
      );
      await client.query('COMMIT');
      const updated = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
      return toDocument(updated.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // Create a (draft) creditnota for this invoice; mark the original "credited" if fully credited.
  app.post('/api/documents/:id/credit-note', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { items, reason, issueDate } = req.body as {
      items?: Document['items'];
      reason: string;
      issueDate: string;
    };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const origRes = await client.query('SELECT * FROM documents WHERE id = $1 FOR UPDATE', [id]);
      if (origRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'Niet gevonden' });
      }
      const original = toDocument(origRes.rows[0]);
      const creditItems = items ?? original.items;
      const totals = recalcDocument(creditItems);
      const creditId = `${id}-cn-${Date.now().toString(36)}`;
      const now = new Date().toISOString();

      await client.query(
        `INSERT INTO documents (
           id, project_id, client_id, document_type, document_number, status, issue_date, items,
           subtotal_excl_btw, btw_percentage, btw_amount, total_incl_btw, paid_amount,
           remaining_amount, original_invoice_id, reason, created_at, updated_at
         ) VALUES ($1,$2,$3,'CREDIT_NOTE',NULL,'draft',$4,$5,$6,$7,$8,$9,0,$10,$11,$12,$13,$13)`,
        [
          creditId,
          original.projectId,
          original.clientId,
          issueDate,
          JSON.stringify(creditItems),
          totals.subtotalExclBtw,
          totals.btwPercentage,
          totals.btwAmount,
          totals.totalInclBtw,
          totals.totalInclBtw,
          id,
          reason,
          now,
        ]
      );

      const isFullCredit = round2(totals.totalInclBtw) >= round2(original.totalInclBtw);
      if (isFullCredit) {
        await client.query(`UPDATE documents SET status = 'credited', updated_at = $2 WHERE id = $1`, [
          id,
          now,
        ]);
      }

      await client.query('COMMIT');
      const created = await pool.query('SELECT * FROM documents WHERE id = $1', [creditId]);
      return toDocument(created.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // Record a payment against an invoice and recompute paid/remaining/status.
  app.post('/api/documents/:id/payments', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { amount, paymentDate, paymentMethod, note } = req.body as {
      amount: number;
      paymentDate: string;
      paymentMethod?: string;
      note?: string;
    };
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const docRes = await client.query('SELECT * FROM documents WHERE id = $1 FOR UPDATE', [id]);
      if (docRes.rowCount === 0) {
        await client.query('ROLLBACK');
        return reply.code(404).send({ error: 'Niet gevonden' });
      }
      const docu = toDocument(docRes.rows[0]);
      const now = new Date().toISOString();
      const paymentId = `${id}-pay-${Date.now().toString(36)}`;
      await client.query(
        `INSERT INTO payments (id, document_id, project_id, amount, payment_date, payment_method, note, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [paymentId, id, docu.projectId, amount, paymentDate, paymentMethod ?? null, note ?? null, now]
      );
      const sumRes = await client.query(
        'SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE document_id = $1',
        [id]
      );
      const paid = round2(Number(sumRes.rows[0].total));
      const due = amountDue(docu);
      const status = docu.status === 'credited' ? 'credited' : invoiceStatusFor(due, paid);
      await client.query(
        `UPDATE documents SET paid_amount = $2, remaining_amount = $3, status = $4, updated_at = $5 WHERE id = $1`,
        [id, paid, round2(due - paid), status, now]
      );
      await client.query('COMMIT');
      const updated = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
      return toDocument(updated.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}
