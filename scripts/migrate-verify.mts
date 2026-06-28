// Proves the migration lost/changed nothing, by recomputing the BTW-aangifte
// figures from BOTH the Firebase export and the new Postgres data using the
// exact same (already unit-tested) calculation code the app itself uses, and
// diffing them to the cent for every quarter that has any data.
//
// Usage: DATABASE_URL=postgresql://... npm run migrate:verify -- backups/factor-backup-<ts>.json
import { readFileSync } from 'node:fs';
import pg from 'pg';
import type { Document, Payment, PurchaseInvoice } from '../src/types/index.ts';
import { computeQuarterReport, computeMonthlyReport, btwYears, type Quarter } from '../src/lib/btw.ts';
import { recalcDocument, recalcPurchaseAmounts, round2 } from '../src/lib/calc.ts';

const { Pool, types } = pg;
types.setTypeParser(1082, (val: string) => val);

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run migrate:verify -- <backup.json>');
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
  data: Record<string, RawDoc[]>;
}

const backup: BackupFile = JSON.parse(readFileSync(file, 'utf8'));

// ----- Reshape the raw Firebase export into typed Document[]/PurchaseInvoice[] -----
const firebaseDocuments: Document[] = (backup.data.documents ?? []).map((d) => ({
  id: String(d.id ?? d._docId),
  projectId: d.projectId as string,
  clientId: d.clientId as string,
  documentType: d.documentType as Document['documentType'],
  invoiceSubtype: d.invoiceSubtype as Document['invoiceSubtype'],
  documentNumber: (d.documentNumber as string | null) ?? null,
  status: d.status as Document['status'],
  issueDate: String(d.issueDate).slice(0, 10),
  dueDate: d.dueDate ? String(d.dueDate).slice(0, 10) : undefined,
  items: ((d.items as Document['items']) ?? []).map((it) => ({ lineType: 'DIENST', ...it })),
  subtotalExclBtw: Number(d.subtotalExclBtw ?? 0),
  btwPercentage: Number(d.btwPercentage ?? 21),
  btwAmount: Number(d.btwAmount ?? 0),
  totalInclBtw: Number(d.totalInclBtw ?? 0),
  settledAdvances: d.settledAdvances as Document['settledAdvances'],
  paidAmount: Number(d.paidAmount ?? 0),
  remainingAmount: Number(d.remainingAmount ?? 0),
  notes: d.notes as string | undefined,
  originalInvoiceId: d.originalInvoiceId as string | undefined,
  reason: d.reason as string | undefined,
  createdAt: d.createdAt as string,
  updatedAt: d.updatedAt as string,
}));

const inferBtwCode = (p: RawDoc): PurchaseInvoice['btwCode'] => {
  if (p.btwCode) return p.btwCode as PurchaseInvoice['btwCode'];
  const pct = Number(p.btwPercentage ?? 21);
  return pct === 9 ? 'NL9' : pct === 0 ? 'GEEN' : 'NL21';
};

const firebasePurchases: PurchaseInvoice[] = (backup.data.purchaseInvoices ?? []).map((p) => ({
  id: String(p.id ?? p._docId),
  supplierName: p.supplierName as string,
  supplierInvoiceNumber: (p.supplierInvoiceNumber as string) ?? '',
  invoiceDate: String(p.invoiceDate).slice(0, 10),
  category: p.category as PurchaseInvoice['category'],
  btwCode: inferBtwCode(p),
  amountInput: Number(p.amountInput ?? p.amountExclBtw ?? 0),
  amountInputMode: (p.amountInputMode as PurchaseInvoice['amountInputMode']) ?? 'EXCL',
  amountExclBtw: Number(p.amountExclBtw ?? 0),
  btwPercentage: Number(p.btwPercentage ?? 0),
  btwAmount: Number(p.btwAmount ?? 0),
  amountInclBtw: Number(p.amountInclBtw ?? 0),
  paymentStatus: (p.paymentStatus as PurchaseInvoice['paymentStatus']) ?? 'open',
  paidVia: (p.paidVia as PurchaseInvoice['paidVia']) ?? 'ZAKELIJK',
  createdAt: p.createdAt as string,
  updatedAt: p.updatedAt as string,
}));

const firebasePayments: Payment[] = (backup.data.payments ?? []).map((p) => ({
  id: String(p.id ?? p._docId),
  documentId: p.documentId as string,
  projectId: p.projectId as string,
  amount: Number(p.amount ?? 0),
  paymentDate: String(p.paymentDate).slice(0, 10),
  paymentMethod: p.paymentMethod as string | undefined,
  note: p.note as string | undefined,
  createdAt: p.createdAt as string,
}));

// ----- Pull the same data back out of Postgres -----
async function loadFromPostgres(pool: pg.Pool) {
  const docsRes = await pool.query('SELECT * FROM documents');
  const documents: Document[] = docsRes.rows.map((r) => ({
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
  }));

  const pursRes = await pool.query('SELECT * FROM purchase_invoices');
  const purchases: PurchaseInvoice[] = pursRes.rows.map((r) => ({
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
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }));

  const paysRes = await pool.query('SELECT * FROM payments');
  const payments: Payment[] = paysRes.rows.map((r) => ({
    id: r.id,
    documentId: r.document_id,
    projectId: r.project_id,
    amount: Number(r.amount),
    paymentDate: r.payment_date,
    paymentMethod: r.payment_method ?? undefined,
    note: r.note ?? undefined,
    createdAt: r.created_at.toISOString(),
  }));

  return { documents, purchases, payments };
}

let failures = 0;
const fail = (msg: string) => {
  console.error('  ❌ ' + msg);
  failures++;
};
const ok = (msg: string) => console.log('  ✅ ' + msg);

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const pg_ = await loadFromPostgres(pool);
  await pool.end();

  console.log('=== 1. Row counts ===');
  const countCheck = (label: string, a: number, b: number) =>
    a === b ? ok(`${label}: ${a} == ${b}`) : fail(`${label}: Firebase=${a} vs Postgres=${b}`);
  countCheck('documents', firebaseDocuments.length, pg_.documents.length);
  countCheck('purchase invoices', firebasePurchases.length, pg_.purchases.length);
  countCheck('payments', firebasePayments.length, pg_.payments.length);

  console.log('\n=== 2. Per-document recompute (recalcDocument) matches stored totals ===');
  for (const d of pg_.documents) {
    const totals = recalcDocument(d.items);
    if (
      round2(totals.subtotalExclBtw) !== round2(d.subtotalExclBtw) ||
      round2(totals.btwAmount) !== round2(d.btwAmount) ||
      round2(totals.totalInclBtw) !== round2(d.totalInclBtw)
    ) {
      fail(
        `document ${d.documentNumber ?? d.id}: stored (${d.subtotalExclBtw}/${d.btwAmount}/${d.totalInclBtw}) != recomputed (${totals.subtotalExclBtw}/${totals.btwAmount}/${totals.totalInclBtw})`
      );
    }
  }
  if (failures === 0) ok(`all ${pg_.documents.length} documents' stored totals match recalcDocument(items)`);

  console.log('\n=== 3. Per-purchase recompute (recalcPurchaseAmounts) matches stored totals ===');
  let purchaseFailures = 0;
  for (const p of pg_.purchases) {
    const amounts = recalcPurchaseAmounts(p.btwCode, p.amountInput, p.amountInputMode);
    if (round2(amounts.btwAmount) !== round2(p.btwAmount) || round2(amounts.amountExclBtw) !== round2(p.amountExclBtw)) {
      fail(
        `purchase ${p.supplierName}/${p.id}: stored (${p.amountExclBtw}/${p.btwAmount}) != recomputed (${amounts.amountExclBtw}/${amounts.btwAmount})`
      );
      purchaseFailures++;
    }
  }
  if (purchaseFailures === 0) ok(`all ${pg_.purchases.length} purchase invoices' stored amounts match recalcPurchaseAmounts()`);

  console.log('\n=== 4. BTW-aangifte quarterly totals: Firebase vs Postgres (must match to the cent) ===');
  const years = new Set([
    ...btwYears(firebaseDocuments, firebasePurchases),
    ...btwYears(pg_.documents, pg_.purchases),
  ]);
  for (const year of years) {
    for (const quarter of [1, 2, 3, 4] as Quarter[]) {
      const fbReport = computeQuarterReport(firebaseDocuments, firebasePurchases, year, quarter);
      const pgReport = computeQuarterReport(pg_.documents, pg_.purchases, year, quarter);
      const hasData =
        fbReport.invoices.length || fbReport.creditNotes.length || fbReport.purchases.length ||
        pgReport.invoices.length || pgReport.creditNotes.length || pgReport.purchases.length;
      if (!hasData) continue;

      const fields: (keyof typeof fbReport)[] = [
        'verkoopExclBtw', 'btwVerkoop', 'creditnotaExclBtw', 'creditnotaBtw',
        'inkoopExclBtw', 'rubriek4a', 'rubriek4b', 'voorbelasting', 'nettoBtwTeBetalen',
      ];
      let mismatch = false;
      for (const f of fields) {
        if (fbReport[f] !== pgReport[f]) {
          fail(`${year}-Q${quarter} ${f}: Firebase=${fbReport[f]} vs Postgres=${pgReport[f]}`);
          mismatch = true;
        }
      }
      if (!mismatch) ok(`${year}-Q${quarter}: all 9 BTW-aangifte fields match exactly`);
    }
  }

  console.log('\n=== 5. Monthly report cross-check (different aggregation path) ===');
  for (const year of years) {
    const fbMonthly = computeMonthlyReport(firebaseDocuments, firebasePurchases, firebasePayments, year);
    const pgMonthly = computeMonthlyReport(pg_.documents, pg_.purchases, pg_.payments, year);
    let mismatch = false;
    for (let i = 0; i < 12; i++) {
      const a = fbMonthly[i];
      const b = pgMonthly[i];
      if (a.omzetExcl !== b.omzetExcl || a.kostenExcl !== b.kostenExcl || a.nettoBtw !== b.nettoBtw) {
        fail(`${year} month ${i + 1}: omzet/kosten/btw differ between Firebase and Postgres`);
        mismatch = true;
      }
    }
    if (!mismatch) ok(`${year}: all 12 months match between Firebase and Postgres`);
  }

  console.log(`\n${'='.repeat(60)}`);
  if (failures > 0) {
    console.error(`MIGRATION VERIFICATION FAILED: ${failures} discrepancy(ies) found. DO NOT cut over yet.`);
    process.exit(1);
  } else {
    console.log('MIGRATION VERIFICATION PASSED: zero discrepancies. Safe to cut over.');
  }
}

main();
