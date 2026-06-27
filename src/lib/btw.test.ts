import { describe, it, expect } from 'vitest';
import type { Document, Payment, PurchaseInvoice } from '../types';
import { round2 } from './calc';
import {
  quarterOf,
  quarterDeadline,
  quarterRange,
  btwPeriodOf,
  isBtwReportable,
  btwReportableAmount,
  reportableExcl,
  computeQuarterReport,
  computeMonthlyReport,
  monthLabel,
  quarterOfMonth,
} from './btw';

// Minimal document factory (only the fields BTW logic reads).
const doc = (p: Partial<Document>): Document => ({
  id: p.id ?? 'x',
  projectId: p.projectId ?? 'p',
  clientId: 'c',
  documentType: p.documentType ?? 'INVOICE',
  invoiceSubtype: p.invoiceSubtype,
  documentNumber: p.documentNumber ?? null,
  status: p.status ?? 'sent',
  issueDate: p.issueDate ?? '2026-02-10',
  items: [],
  subtotalExclBtw: p.subtotalExclBtw ?? 0,
  btwPercentage: 21,
  btwAmount: p.btwAmount ?? 0,
  totalInclBtw: p.totalInclBtw ?? 0,
  settledAdvances: p.settledAdvances,
  paidAmount: p.paidAmount ?? 0,
  remainingAmount: p.remainingAmount ?? 0,
  originalInvoiceId: p.originalInvoiceId,
  createdAt: '2026-02-10T00:00:00.000Z',
  updatedAt: '2026-02-10T00:00:00.000Z',
});

describe('kwartaal-indeling (factuurstelsel)', () => {
  it('maps issue date to the right quarter', () => {
    expect(quarterOf('2026-01-01')).toBe(1);
    expect(quarterOf('2026-03-31')).toBe(1);
    expect(quarterOf('2026-04-01')).toBe(2);
    expect(quarterOf('2026-06-30')).toBe(2);
    expect(quarterOf('2026-09-30')).toBe(3);
    expect(quarterOf('2026-10-01')).toBe(4);
    expect(quarterOf('2026-12-31')).toBe(4);
  });

  it('gives the 2026 deadlines from the spec', () => {
    expect(quarterDeadline(2026, 1)).toBe('2026-04-30');
    expect(quarterDeadline(2026, 2)).toBe('2026-07-31');
    expect(quarterDeadline(2026, 3)).toBe('2026-10-31');
    expect(quarterDeadline(2026, 4)).toBe('2027-01-31');
  });

  it('gives the quarter ranges', () => {
    expect(quarterRange(2026, 1)).toEqual({ start: '2026-01-01', end: '2026-03-31' });
    expect(quarterRange(2026, 4)).toEqual({ start: '2026-10-01', end: '2026-12-31' });
  });

  it('labels the period from a date', () => {
    expect(btwPeriodOf('2026-05-12')).toBe('2026-Q2');
  });
});

describe('welke documenten tellen mee', () => {
  it('only counts numbered INVOICE and CREDIT_NOTE', () => {
    expect(isBtwReportable(doc({ documentType: 'INVOICE', documentNumber: 'F-2026-0001' }))).toBe(true);
    expect(isBtwReportable(doc({ documentType: 'CREDIT_NOTE', documentNumber: 'CN-2026-0001' }))).toBe(true);
    // concept zonder nummer
    expect(isBtwReportable(doc({ documentType: 'INVOICE', documentNumber: null, status: 'draft' }))).toBe(false);
    // offerte / proforma
    expect(isBtwReportable(doc({ documentType: 'OFFERTE', documentNumber: 'OFF-2026-0001' }))).toBe(false);
    expect(isBtwReportable(doc({ documentType: 'PROFORMA', documentNumber: 'PF-2026-0001' }))).toBe(false);
  });
});

describe('btw_reportable_amount (worked example uit de spec)', () => {
  // F-2026-0001 Aanbetalingsfactuur: BTW = €31,50
  const advance = doc({
    id: 'adv',
    documentType: 'INVOICE',
    invoiceSubtype: 'AANBETALING',
    documentNumber: 'F-2026-0001',
    subtotalExclBtw: 150,
    btwAmount: 31.5,
    totalInclBtw: 181.5,
    issueDate: '2026-02-01',
  });

  // F-2026-0002 Eindfactuur: totaal project BTW = €80,73, gekoppelde aanbetaling = €31,50
  const eind = doc({
    id: 'eind',
    documentType: 'INVOICE',
    invoiceSubtype: 'EINDFACTUUR',
    documentNumber: 'F-2026-0002',
    subtotalExclBtw: 384.41,
    btwAmount: 80.73,
    totalInclBtw: 465.14,
    issueDate: '2026-03-15',
    settledAdvances: [
      { documentId: 'adv', number: 'F-2026-0001', exclBtw: 150, btwAmount: 31.5, inclBtw: 181.5 },
    ],
  });

  it('aanbetalingsfactuur reports its full btw', () => {
    expect(btwReportableAmount(advance)).toBe(31.5);
  });

  it('eindfactuur reports total btw minus linked advance btw', () => {
    expect(btwReportableAmount(eind)).toBe(49.23);
  });

  it('creditnota reports negative btw', () => {
    const credit = doc({
      documentType: 'CREDIT_NOTE',
      documentNumber: 'CN-2026-0001',
      subtotalExclBtw: 100,
      btwAmount: 21,
      totalInclBtw: 121,
      issueDate: '2026-03-20',
    });
    expect(btwReportableAmount(credit)).toBe(-21);
  });

  it('quarter Q1 sums advance + eindfactuur net = full project btw', () => {
    const report = computeQuarterReport([advance, eind], [], 2026, 1);
    expect(report.btwVerkoop).toBe(80.73); // 31.50 + 49.23
    expect(report.verkoopExclBtw).toBe(384.41); // 150 + 234.41
    expect(report.invoices).toHaveLength(2);
  });

  // Guards the Rapportage dashboard fix: aggregating reportable amounts across
  // an aanbetaling + eindfactuur must equal the project once, not twice.
  it('Rapportage aggregate does not double count advance + eindfactuur', () => {
    const docs = [advance, eind];
    const omzet = round2(docs.filter(isBtwReportable).reduce((s, d) => s + reportableExcl(d), 0));
    const btw = round2(docs.filter(isBtwReportable).reduce((s, d) => s + btwReportableAmount(d), 0));
    expect(omzet).toBe(384.41); // not 534.41
    expect(btw).toBe(80.73); // not 112.23
  });

  it('Rapportage aggregate subtracts credit notes', () => {
    const credit = doc({
      documentType: 'CREDIT_NOTE',
      documentNumber: 'CN-2026-0009',
      subtotalExclBtw: 100,
      btwAmount: 21,
      totalInclBtw: 121,
      issueDate: '2026-03-22',
    });
    const docs = [advance, eind, credit];
    const btw = round2(docs.filter(isBtwReportable).reduce((s, d) => s + btwReportableAmount(d), 0));
    expect(btw).toBe(59.73); // 80.73 - 21
  });
});

describe('netto btw te betalen', () => {
  const invoice = doc({
    documentType: 'INVOICE',
    documentNumber: 'F-2026-0010',
    subtotalExclBtw: 1000,
    btwAmount: 210,
    totalInclBtw: 1210,
    issueDate: '2026-05-10',
  });
  const credit = doc({
    documentType: 'CREDIT_NOTE',
    documentNumber: 'CN-2026-0003',
    subtotalExclBtw: 100,
    btwAmount: 21,
    totalInclBtw: 121,
    issueDate: '2026-06-01',
  });
  const purchase: PurchaseInvoice = {
    id: 'pur',
    supplierName: 'Hosting BV',
    supplierInvoiceNumber: 'H-99',
    invoiceDate: '2026-04-20',
    category: 'Hosting & Software',
    amountExclBtw: 200,
    btwPercentage: 21,
    btwAmount: 42,
    amountInclBtw: 242,
    paymentStatus: 'paid',
    createdAt: '',
    updatedAt: '',
  };

  it('= btw verkoop - btw creditnota - voorbelasting', () => {
    const r = computeQuarterReport([invoice, credit], [purchase], 2026, 2);
    expect(r.btwVerkoop).toBe(210);
    expect(r.creditnotaBtw).toBe(21);
    expect(r.voorbelasting).toBe(42);
    expect(r.nettoBtwTeBetalen).toBe(147); // 210 - 21 - 42
  });

  it('excludes documents/purchases outside the quarter', () => {
    const r = computeQuarterReport([invoice, credit], [purchase], 2026, 1);
    expect(r.invoices).toHaveLength(0);
    expect(r.purchases).toHaveLength(0);
    expect(r.nettoBtwTeBetalen).toBe(0);
  });
});

describe('maandoverzicht (computeMonthlyReport)', () => {
  it('labels months and maps them to the right quarter', () => {
    expect(monthLabel(2026, 3)).toBe('mrt 2026');
    expect(quarterOfMonth(1)).toBe(1);
    expect(quarterOfMonth(3)).toBe(1);
    expect(quarterOfMonth(4)).toBe(2);
    expect(quarterOfMonth(12)).toBe(4);
  });

  it('returns 12 rows, zero-filled for months with no activity', () => {
    const rows = computeMonthlyReport([], [], [], 2026);
    expect(rows).toHaveLength(12);
    expect(rows.every((r) => r.omzetExcl === 0 && r.nettoBtw === 0)).toBe(true);
  });

  it('attributes revenue/cost/btw to the right month and computes resultaat', () => {
    const invoice = doc({
      id: 'inv-may',
      projectId: 'proj-1',
      documentType: 'INVOICE',
      documentNumber: 'F-2026-0010',
      subtotalExclBtw: 1000,
      btwAmount: 210,
      totalInclBtw: 1210,
      issueDate: '2026-05-10',
    });
    const purchase: PurchaseInvoice = {
      id: 'pur',
      supplierName: 'Hosting BV',
      supplierInvoiceNumber: 'H-99',
      invoiceDate: '2026-05-20',
      category: 'Hosting & Software',
      amountExclBtw: 200,
      btwPercentage: 21,
      btwAmount: 42,
      amountInclBtw: 242,
      paymentStatus: 'paid',
      createdAt: '',
      updatedAt: '',
    };
    const payment: Payment = {
      id: 'pay1',
      documentId: 'inv-may',
      projectId: 'proj-1',
      amount: 500,
      paymentDate: '2026-05-25',
      createdAt: '',
    };

    const rows = computeMonthlyReport([invoice], [purchase], [payment], 2026);
    const may = rows[4]; // index 4 = month 5
    expect(may.omzetExcl).toBe(1000);
    expect(may.kostenExcl).toBe(200);
    expect(may.resultaat).toBe(800);
    expect(may.btwVerschuldigd).toBe(210);
    expect(may.voorbelasting).toBe(42);
    expect(may.nettoBtw).toBe(168);
    expect(may.ontvangenIncl).toBe(500);
    // €500 received against a 1000/1210 invoice → excl. portion = 500 * 1000/1210
    expect(may.ontvangenExcl).toBe(413.22);
    expect(may.quarter).toBe(2);
    // every other month stays untouched
    expect(rows[3].omzetExcl).toBe(0);
  });

  it('breaks revenue down per project within the month', () => {
    const a = doc({
      id: 'a',
      projectId: 'proj-A',
      documentType: 'INVOICE',
      documentNumber: 'F-2026-0020',
      subtotalExclBtw: 700,
      btwAmount: 147,
      totalInclBtw: 847,
      issueDate: '2026-01-10',
    });
    const b = doc({
      id: 'b',
      projectId: 'proj-B',
      documentType: 'INVOICE',
      documentNumber: 'F-2026-0021',
      subtotalExclBtw: 500,
      btwAmount: 105,
      totalInclBtw: 605,
      issueDate: '2026-01-20',
    });
    const rows = computeMonthlyReport([a, b], [], [], 2026);
    const jan = rows[0];
    expect(jan.omzetExcl).toBe(1200);
    expect(jan.projects).toEqual([
      { projectId: 'proj-A', omzetExcl: 700 }, // largest first
      { projectId: 'proj-B', omzetExcl: 500 },
    ]);
  });

  it('the 3 months of a quarter sum to exactly the official kwartaalaangifte', () => {
    const advance = doc({
      id: 'adv',
      documentType: 'INVOICE',
      invoiceSubtype: 'AANBETALING',
      documentNumber: 'F-2026-0001',
      subtotalExclBtw: 150,
      btwAmount: 31.5,
      totalInclBtw: 181.5,
      issueDate: '2026-02-01',
    });
    const eind = doc({
      id: 'eind',
      documentType: 'INVOICE',
      invoiceSubtype: 'EINDFACTUUR',
      documentNumber: 'F-2026-0002',
      subtotalExclBtw: 384.41,
      btwAmount: 80.73,
      totalInclBtw: 465.14,
      issueDate: '2026-03-15',
      settledAdvances: [
        { documentId: 'adv', number: 'F-2026-0001', exclBtw: 150, btwAmount: 31.5, inclBtw: 181.5 },
      ],
    });
    const credit = doc({
      documentType: 'CREDIT_NOTE',
      documentNumber: 'CN-2026-0001',
      subtotalExclBtw: 50,
      btwAmount: 10.5,
      totalInclBtw: 60.5,
      issueDate: '2026-03-20',
    });
    const purchase: PurchaseInvoice = {
      id: 'pur',
      supplierName: 'Hosting BV',
      supplierInvoiceNumber: 'H-1',
      invoiceDate: '2026-01-10',
      category: 'Hosting & Software',
      amountExclBtw: 100,
      btwPercentage: 21,
      btwAmount: 21,
      amountInclBtw: 121,
      paymentStatus: 'paid',
      createdAt: '',
      updatedAt: '',
    };

    const documents = [advance, eind, credit];
    const purchases = [purchase];
    const quarterReport = computeQuarterReport(documents, purchases, 2026, 1);
    const monthly = computeMonthlyReport(documents, purchases, [], 2026);
    const q1Months = monthly.filter((r) => r.quarter === 1);

    expect(round2(q1Months.reduce((s, r) => s + r.omzetExcl, 0))).toBe(quarterReport.verkoopExclBtw - quarterReport.creditnotaExclBtw);
    expect(round2(q1Months.reduce((s, r) => s + r.btwVerschuldigd, 0))).toBe(round2(quarterReport.btwVerkoop - quarterReport.creditnotaBtw));
    expect(round2(q1Months.reduce((s, r) => s + r.voorbelasting, 0))).toBe(quarterReport.voorbelasting);
    expect(round2(q1Months.reduce((s, r) => s + r.nettoBtw, 0))).toBe(quarterReport.nettoBtwTeBetalen);
  });
});
