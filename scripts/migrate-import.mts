// Import a Firebase backup JSON (produced by scripts/backup.mjs) into the new
// Postgres database (factor_db on the user's own Hetzner server).
//
// Usage: DATABASE_URL=postgresql://... npm run migrate:import -- backups/factor-backup-<ts>.json [--force]
//
// Safe by default: aborts if any target table already has rows, unless --force
// is passed (so an accidental double-run can never silently duplicate/clobber data).
import { readFileSync } from 'node:fs';
import pg from 'pg';

const { Pool, types } = pg;
// Same fix as the API server: don't let node-postgres turn DATE columns into
// timezone-shifted JS Date objects — keep them as plain 'YYYY-MM-DD' strings.
types.setTypeParser(1082, (val: string) => val);

const file = process.argv[2];
const force = process.argv.includes('--force');
if (!file) {
  console.error('Usage: npm run migrate:import -- <backup.json> [--force]');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Set DATABASE_URL to the factor_db connection string.');
  process.exit(1);
}

interface RawDoc {
  _docId: string;
  [key: string]: unknown;
}
interface BackupFile {
  exportedAt: string;
  project: string;
  data: Record<string, RawDoc[]>;
}

const backup: BackupFile = JSON.parse(readFileSync(file, 'utf8'));
console.log(`Loaded backup from ${backup.exportedAt} (Firebase project ${backup.project})`);
for (const [name, rows] of Object.entries(backup.data)) {
  console.log(`  ${name}: ${rows.length} records`);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const isoDate = (v: unknown): string | null => {
  if (!v) return null;
  // Already 'YYYY-MM-DD' (most data) or a full ISO timestamp — take the date part either way.
  return String(v).slice(0, 10);
};
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' ? v : Number(v) || fallback);
const str = (v: unknown): string | null => (v == null ? null : String(v));

// Same defaulting logic the old frontend's db.ts applied on read, for records
// saved before the btw-code/regeltype fields existed.
const normalizeItems = (items: unknown): unknown => {
  if (!Array.isArray(items)) return [];
  return items.map((it) => ({ lineType: 'DIENST', ...(it as object) }));
};
const inferBtwCode = (p: RawDoc): string => {
  if (p.btwCode) return String(p.btwCode);
  const pct = num(p.btwPercentage);
  return pct === 9 ? 'NL9' : pct === 0 ? 'GEEN' : 'NL21';
};

async function main() {
  const client = await pool.connect();
  try {
    const counts = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public'`
    );
    for (const { table_name } of counts.rows) {
      const r = await client.query(`SELECT count(*) FROM ${table_name}`);
      if (Number(r.rows[0].count) > 0 && !force) {
        console.error(
          `Table "${table_name}" already has ${r.rows[0].count} row(s). Refusing to import without --force.`
        );
        process.exit(1);
      }
    }

    await client.query('BEGIN');

    for (const c of backup.data.clients ?? []) {
      await client.query(
        `INSERT INTO clients (id, name, email, company, address, kvk, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
        [c.id ?? c._docId, c.name, c.email, c.company ?? null, c.address ?? null, c.kvk ?? null, c.createdAt]
      );
    }
    console.log(`Imported ${backup.data.clients?.length ?? 0} clients`);

    for (const p of backup.data.projects ?? []) {
      await client.query(
        `INSERT INTO projects (id, client_id, name, description, created_at)
         VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
        [p.id ?? p._docId, p.clientId, p.name, p.description ?? null, p.createdAt]
      );
    }
    console.log(`Imported ${backup.data.projects?.length ?? 0} projects`);

    for (const d of backup.data.documents ?? []) {
      await client.query(
        `INSERT INTO documents (
           id, project_id, client_id, document_type, invoice_subtype, document_number, status,
           issue_date, due_date, items, subtotal_excl_btw, btw_percentage, btw_amount,
           total_incl_btw, settled_advances, paid_amount, remaining_amount, notes,
           original_invoice_id, reason, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
         ON CONFLICT (id) DO NOTHING`,
        [
          d.id ?? d._docId,
          d.projectId,
          d.clientId,
          d.documentType,
          d.invoiceSubtype ?? null,
          d.documentNumber ?? null,
          d.status,
          isoDate(d.issueDate),
          isoDate(d.dueDate),
          JSON.stringify(normalizeItems(d.items)),
          num(d.subtotalExclBtw),
          num(d.btwPercentage, 21),
          num(d.btwAmount),
          num(d.totalInclBtw),
          d.settledAdvances ? JSON.stringify(d.settledAdvances) : null,
          num(d.paidAmount),
          num(d.remainingAmount),
          str(d.notes),
          str(d.originalInvoiceId),
          str(d.reason),
          d.createdAt,
          d.updatedAt,
        ]
      );
    }
    console.log(`Imported ${backup.data.documents?.length ?? 0} documents`);

    for (const p of backup.data.payments ?? []) {
      await client.query(
        `INSERT INTO payments (id, document_id, project_id, amount, payment_date, payment_method, note, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [
          p.id ?? p._docId,
          p.documentId,
          p.projectId,
          num(p.amount),
          isoDate(p.paymentDate),
          str(p.paymentMethod),
          str(p.note),
          p.createdAt,
        ]
      );
    }
    console.log(`Imported ${backup.data.payments?.length ?? 0} payments`);

    for (const p of backup.data.purchaseInvoices ?? []) {
      const btwCode = inferBtwCode(p);
      await client.query(
        `INSERT INTO purchase_invoices (
           id, supplier_name, supplier_invoice_number, invoice_date, category, btw_code,
           amount_input, amount_input_mode, amount_excl_btw, btw_percentage, btw_amount,
           amount_incl_btw, payment_status, paid_via, attachment_pdf, attachment_name,
           attachment_path, notes, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         ON CONFLICT (id) DO NOTHING`,
        [
          p.id ?? p._docId,
          p.supplierName,
          p.supplierInvoiceNumber ?? '',
          isoDate(p.invoiceDate),
          p.category,
          btwCode,
          num(p.amountInput, num(p.amountExclBtw)),
          p.amountInputMode ?? 'EXCL',
          num(p.amountExclBtw),
          num(p.btwPercentage),
          num(p.btwAmount),
          num(p.amountInclBtw),
          p.paymentStatus ?? 'open',
          p.paidVia ?? 'ZAKELIJK',
          str(p.attachmentPdf),
          str(p.attachmentName),
          str(p.attachmentPath),
          str(p.notes),
          p.createdAt,
          p.updatedAt,
        ]
      );
    }
    console.log(`Imported ${backup.data.purchaseInvoices?.length ?? 0} purchase invoices`);

    for (const m of backup.data.btwPeriods ?? []) {
      await client.query(
        `INSERT INTO btw_periods (id, year, quarter, state, note, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [m.id ?? m._docId, num(m.year), num(m.quarter), m.state, str(m.note), m.updatedAt]
      );
    }
    console.log(`Imported ${backup.data.btwPeriods?.length ?? 0} btw periods`);

    for (const c of backup.data.counters ?? []) {
      const id = c.id ?? c._docId;
      await client.query(
        `INSERT INTO counters (id, prefix, year, value) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
        [id, c.prefix, num(c.year), num(c.value)]
      );
    }
    console.log(`Imported ${backup.data.counters?.length ?? 0} counters`);

    for (const inv of backup.data.invoices ?? []) {
      const { _docId, ...rest } = inv;
      await client.query(
        `INSERT INTO legacy_invoices (id, data) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`,
        [_docId, JSON.stringify(rest)]
      );
    }
    console.log(`Imported ${backup.data.invoices?.length ?? 0} legacy invoices`);

    await client.query('COMMIT');
    console.log('\nImport committed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import failed, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
