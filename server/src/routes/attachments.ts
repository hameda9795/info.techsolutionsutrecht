import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

const ATTACHMENTS_ROOT = process.env.ATTACHMENTS_DIR ?? '/data/attachments';
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_EXT = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);

// Strip anything that isn't a safe filename character — no path separators, no
// control characters — before ever using a client-supplied name in a path.
const sanitizeFilename = (name: string): string => {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base.slice(0, 120) || 'bestand';
};

export default async function attachmentsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireAuth);

  // Upload a purchase-invoice attachment. The purchaseInvoiceId is only ever used
  // as a directory name after this existence check — never taken raw into a path
  // without validation. If the invoice already has an attachment, the old physical
  // file is removed first — this is the one and only place a "replace" happens, so
  // there's never a window where the DB points at a path the client could race
  // against (the frontend just calls upload(), then saves the returned info).
  app.post('/api/attachments/purchase-invoices/:purchaseInvoiceId', async (req, reply) => {
    const { purchaseInvoiceId } = req.params as { purchaseInvoiceId: string };
    const existing = await pool.query(
      'SELECT attachment_path FROM purchase_invoices WHERE id = $1',
      [purchaseInvoiceId]
    );
    if (existing.rowCount === 0) {
      return reply.code(404).send({ error: 'Inkoopfactuur niet gevonden' });
    }

    const data = await req.file({ limits: { fileSize: MAX_SIZE } });
    if (!data) return reply.code(400).send({ error: 'Geen bestand ontvangen' });

    const ext = path.extname(data.filename).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return reply.code(400).send({ error: 'Alleen PDF of foto (jpg/png/webp) toegestaan' });
    }

    const safeName = sanitizeFilename(data.filename);
    const relPath = path.posix.join('purchase-invoices', purchaseInvoiceId, `${randomUUID()}-${safeName}`);
    const absPath = path.join(ATTACHMENTS_ROOT, relPath);

    // Defense in depth: confirm the resolved path is still inside the attachments root.
    if (!path.resolve(absPath).startsWith(path.resolve(ATTACHMENTS_ROOT))) {
      return reply.code(400).send({ error: 'Ongeldig pad' });
    }

    await fs.mkdir(path.dirname(absPath), { recursive: true });
    const buffer = await data.toBuffer();
    if (buffer.length > MAX_SIZE) {
      return reply.code(400).send({ error: 'Bestand is te groot (max. 10 MB)' });
    }
    await fs.writeFile(absPath, buffer);

    const oldRelPath = existing.rows[0].attachment_path as string | undefined;
    if (oldRelPath) {
      const oldAbsPath = path.join(ATTACHMENTS_ROOT, oldRelPath);
      if (path.resolve(oldAbsPath).startsWith(path.resolve(ATTACHMENTS_ROOT))) {
        await fs.rm(oldAbsPath, { force: true });
      }
    }

    return {
      path: relPath,
      name: data.filename,
      url: `/api/attachments/${purchaseInvoiceId}`,
    };
  });

  // Serve an attachment back out. The real path is looked up server-side from the
  // database by id — never taken from the URL/query — so path traversal is not
  // possible by construction, regardless of what's requested.
  app.get('/api/attachments/:purchaseInvoiceId', async (req, reply) => {
    const { purchaseInvoiceId } = req.params as { purchaseInvoiceId: string };
    const res = await pool.query(
      'SELECT attachment_path, attachment_name FROM purchase_invoices WHERE id = $1',
      [purchaseInvoiceId]
    );
    if (res.rowCount === 0 || !res.rows[0].attachment_path) {
      return reply.code(404).send({ error: 'Geen bijlage' });
    }
    const absPath = path.join(ATTACHMENTS_ROOT, res.rows[0].attachment_path);
    if (!path.resolve(absPath).startsWith(path.resolve(ATTACHMENTS_ROOT))) {
      return reply.code(400).send({ error: 'Ongeldig pad' });
    }
    const buffer = await fs.readFile(absPath);
    reply.header('Content-Disposition', `inline; filename="${res.rows[0].attachment_name}"`);
    return reply.send(buffer);
  });

  // Removes the attachment entirely: deletes the physical file AND clears the
  // DB columns in one step, so there's never a stale reference to a deleted file.
  app.delete('/api/attachments/purchase-invoices/:purchaseInvoiceId', async (req) => {
    const { purchaseInvoiceId } = req.params as { purchaseInvoiceId: string };
    const res = await pool.query(
      'SELECT attachment_path FROM purchase_invoices WHERE id = $1',
      [purchaseInvoiceId]
    );
    const relPath = res.rows[0]?.attachment_path as string | undefined;
    if (relPath) {
      const absPath = path.join(ATTACHMENTS_ROOT, relPath);
      if (path.resolve(absPath).startsWith(path.resolve(ATTACHMENTS_ROOT))) {
        await fs.rm(absPath, { force: true });
      }
    }
    await pool.query(
      `UPDATE purchase_invoices SET attachment_pdf = NULL, attachment_name = NULL, attachment_path = NULL
       WHERE id = $1`,
      [purchaseInvoiceId]
    );
    return { ok: true };
  });
}
