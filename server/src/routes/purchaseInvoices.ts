import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';
import { recalcPurchaseAmounts } from '../lib/calc.js';
import type { PurchaseInvoice } from '../types.js';

const toPurchaseInvoice = (r: any): PurchaseInvoice => ({
  id: r.id,
  supplierName: r.supplier_name,
  supplierInvoiceNumber: r.supplier_invoice_number,
  invoiceDate: r.invoice_date,
  category: r.category,
  btwCode: r.btw_code,
  amountInput: Number(r.amount_input),
  amountInputMode: r.amount_input_mode,
  amountExclBtw: Number(r.amount_excl_btw),
  btwPercentage: Number(r.btw_percentage),
  btwAmount: Number(r.btw_amount),
  amountInclBtw: Number(r.amount_incl_btw),
  paymentStatus: r.payment_status,
  paidVia: r.paid_via,
  attachmentPdf: r.attachment_pdf ?? undefined,
  attachmentName: r.attachment_name ?? undefined,
  attachmentPath: r.attachment_path ?? undefined,
  notes: r.notes ?? undefined,
  createdAt: r.created_at.toISOString(),
  updatedAt: r.updated_at.toISOString(),
});

export default async function purchaseInvoicesRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  app.get('/api/purchase-invoices', async () => {
    const res = await pool.query('SELECT * FROM purchase_invoices ORDER BY invoice_date');
    return res.rows.map(toPurchaseInvoice);
  });

  app.put('/api/purchase-invoices/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const p = req.body as PurchaseInvoice;
    if (p.id !== id) return reply.code(400).send({ error: 'id mismatch' });

    // Never trust client-computed derived amounts for tax-relevant data —
    // always recompute server-side from the raw input + btw code.
    const amounts = recalcPurchaseAmounts(p.btwCode, p.amountInput, p.amountInputMode);

    await pool.query(
      `INSERT INTO purchase_invoices (
         id, supplier_name, supplier_invoice_number, invoice_date, category, btw_code,
         amount_input, amount_input_mode, amount_excl_btw, btw_percentage, btw_amount,
         amount_incl_btw, payment_status, paid_via, attachment_pdf, attachment_name,
         attachment_path, notes, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       ON CONFLICT (id) DO UPDATE SET
         supplier_name = $2, supplier_invoice_number = $3, invoice_date = $4, category = $5,
         btw_code = $6, amount_input = $7, amount_input_mode = $8, amount_excl_btw = $9,
         btw_percentage = $10, btw_amount = $11, amount_incl_btw = $12, payment_status = $13,
         paid_via = $14, attachment_pdf = $15, attachment_name = $16, attachment_path = $17,
         notes = $18, updated_at = $20`,
      [
        p.id,
        p.supplierName,
        p.supplierInvoiceNumber,
        p.invoiceDate,
        p.category,
        p.btwCode,
        p.amountInput,
        p.amountInputMode,
        amounts.amountExclBtw,
        amounts.btwPercentage,
        amounts.btwAmount,
        amounts.amountInclBtw,
        p.paymentStatus,
        p.paidVia,
        p.attachmentPdf ?? null,
        p.attachmentName ?? null,
        p.attachmentPath ?? null,
        p.notes ?? null,
        p.createdAt,
        p.updatedAt,
      ]
    );
    return { ok: true };
  });

  app.delete('/api/purchase-invoices/:id', async (req) => {
    const { id } = req.params as { id: string };
    await pool.query('DELETE FROM purchase_invoices WHERE id = $1', [id]);
    return { ok: true };
  });
}
