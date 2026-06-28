import type {
  Document,
  DocumentItem,
  DocumentStatus,
  DocumentType,
  InvoiceSubtype,
  SettledAdvance,
} from '@/types';
import { recalcDocument, round2 } from './calc';
import { generateId, saveDocument, finalizeDocumentApi, recordPaymentApi, createCreditNoteApi } from './db';

/** Net amount the customer still owes on an invoice (full total minus settled advances). */
export const amountDue = (docu: Document): number => {
  const advances = (docu.settledAdvances ?? []).reduce((s, a) => s + a.inclBtw, 0);
  return round2(docu.totalInclBtw - advances);
};

/**
 * Status to *display* for a document. An invoice that is still open (sent /
 * partially_paid) and past its due date is shown as "overdue". This is derived
 * on read — the stored status is never silently changed.
 */
export const displayStatus = (docu: Document): DocumentStatus => {
  const today = new Date().toISOString().slice(0, 10);
  if (
    docu.documentType === 'INVOICE' &&
    (docu.status === 'sent' || docu.status === 'partially_paid') &&
    docu.dueDate &&
    docu.dueDate < today
  ) {
    return 'overdue';
  }
  return docu.status;
};

export interface DraftInput {
  projectId: string;
  clientId: string;
  documentType: DocumentType;
  invoiceSubtype?: InvoiceSubtype;
  issueDate: string;
  dueDate?: string;
  items: DocumentItem[];
  settledAdvances?: SettledAdvance[];
  notes?: string;
  originalInvoiceId?: string;
  reason?: string;
}

/**
 * Build a fresh draft (concept) document for the form's live preview. The backend
 * always recomputes totals from `items` on save, so this is a client-side preview
 * only — never the source of truth.
 */
export const buildDraft = (input: DraftInput): Document => {
  const totals = recalcDocument(input.items);
  const now = new Date().toISOString();
  const advancesIncl = (input.settledAdvances ?? []).reduce((s, a) => s + a.inclBtw, 0);
  const due = round2(totals.totalInclBtw - advancesIncl);
  return {
    id: generateId(),
    projectId: input.projectId,
    clientId: input.clientId,
    documentType: input.documentType,
    invoiceSubtype: input.invoiceSubtype,
    documentNumber: null,
    status: 'draft',
    issueDate: input.issueDate,
    dueDate: input.dueDate,
    items: input.items,
    subtotalExclBtw: totals.subtotalExclBtw,
    btwPercentage: totals.btwPercentage,
    btwAmount: totals.btwAmount,
    totalInclBtw: totals.totalInclBtw,
    settledAdvances: input.settledAdvances,
    paidAmount: 0,
    remainingAmount: due,
    notes: input.notes,
    originalInvoiceId: input.originalInvoiceId,
    reason: input.reason,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Persist edits to a draft. The backend re-checks the draft lock and recomputes
 * totals server-side (never trusting client-sent numbers) and returns the
 * canonical, saved document.
 */
export const saveDraftEdits = (docu: Document): Promise<Document> => saveDocument(docu);

/**
 * Finalize a concept: atomically allocate the gapless official number and move
 * to "sent". No-op (idempotent) if it already has a number. The allocation and
 * status change happen together in one database transaction on the server.
 */
export const finalizeDocument = (docu: Document): Promise<Document> =>
  finalizeDocumentApi(docu.id);

/** Record a payment against an invoice; the server updates paid/remaining/status atomically. */
export const recordPayment = (
  docu: Document,
  input: { amount: number; paymentDate: string; paymentMethod?: string; note?: string }
): Promise<Document> => recordPaymentApi(docu.id, input);

/**
 * Create a creditnota for an existing invoice and mark the original "credited"
 * if fully credited. Handled atomically on the server.
 */
export const createCreditNote = (
  original: Document,
  opts: { items?: DocumentItem[]; reason: string; issueDate: string }
): Promise<Document> => createCreditNoteApi(original.id, opts);
