import type {
  Document,
  DocumentItem,
  DocumentStatus,
  DocumentType,
  InvoiceSubtype,
  Payment,
  SettledAdvance,
} from '@/types';
import { recalcDocument, round2 } from './calc';
import { allocateNumber } from './numbering';
import { isLocked } from './lock';
import {
  generateId,
  saveDocument,
  savePayment,
  getPaymentsByDocument,
  getDocument,
} from './db';

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

/** Build a fresh draft (concept) document with recalculated totals. */
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

/** Re-derive totals + remaining for an editable (draft) document, then persist. */
export const saveDraftEdits = async (docu: Document): Promise<Document> => {
  if (isLocked(docu)) throw new Error('Document is vergrendeld en kan niet worden bewerkt.');
  const totals = recalcDocument(docu.items);
  const updated: Document = {
    ...docu,
    ...totals,
    remainingAmount: round2(
      totals.totalInclBtw -
        (docu.settledAdvances ?? []).reduce((s, a) => s + a.inclBtw, 0) -
        docu.paidAmount
    ),
    updatedAt: new Date().toISOString(),
  };
  await saveDocument(updated);
  return updated;
};

/**
 * Finalize a concept: allocate the gapless official number and move to "sent".
 * No-op if it already has a number.
 */
export const finalizeDocument = async (docu: Document): Promise<Document> => {
  if (docu.documentNumber) return docu;
  const number = await allocateNumber(docu.documentType);
  const updated: Document = {
    ...docu,
    documentNumber: number,
    status: 'sent',
    updatedAt: new Date().toISOString(),
  };
  await saveDocument(updated);
  return updated;
};

const invoiceStatusFor = (due: number, paid: number): Document['status'] => {
  if (paid <= 0) return 'sent';
  if (round2(paid) >= round2(due)) return 'paid';
  return 'partially_paid';
};

/** Record a payment against an invoice and update its paid/remaining/status. */
export const recordPayment = async (
  docu: Document,
  input: { amount: number; paymentDate: string; paymentMethod?: string; note?: string }
): Promise<Document> => {
  const payment: Payment = {
    id: generateId(),
    documentId: docu.id,
    projectId: docu.projectId,
    amount: input.amount,
    paymentDate: input.paymentDate,
    paymentMethod: input.paymentMethod,
    note: input.note,
    createdAt: new Date().toISOString(),
  };
  await savePayment(payment);
  return recomputePayments(docu);
};

/** Recompute paidAmount/remainingAmount/status from all payments for the document. */
export const recomputePayments = async (docu: Document): Promise<Document> => {
  const payments = await getPaymentsByDocument(docu.id);
  const paid = round2(payments.reduce((s, p) => s + p.amount, 0));
  const due = amountDue(docu);
  // Don't override terminal states like 'credited'.
  const status = docu.status === 'credited' ? 'credited' : invoiceStatusFor(due, paid);
  const updated: Document = {
    ...docu,
    paidAmount: paid,
    remainingAmount: round2(due - paid),
    status,
    updatedAt: new Date().toISOString(),
  };
  await saveDocument(updated);
  return updated;
};

/**
 * Create a creditnota for an existing invoice and mark the original "credited".
 * The credit document mirrors the invoice items (or a provided subset).
 */
export const createCreditNote = async (
  original: Document,
  opts: { items?: DocumentItem[]; reason: string; issueDate: string }
): Promise<Document> => {
  const items = opts.items ?? original.items;
  const credit = buildDraft({
    projectId: original.projectId,
    clientId: original.clientId,
    documentType: 'CREDIT_NOTE',
    issueDate: opts.issueDate,
    items,
    originalInvoiceId: original.id,
    reason: opts.reason,
  });
  await saveDocument(credit);

  // Only mark the original "credited" when the credit note covers the full
  // invoice amount. A partial creditnota leaves the invoice open for the rest,
  // so its remaining amount keeps showing up in the openstaand-overzicht.
  const isFullCredit = round2(credit.totalInclBtw) >= round2(original.totalInclBtw);
  const updatedOriginal = await getDocument(original.id);
  if (updatedOriginal && isFullCredit) {
    await saveDocument({
      ...updatedOriginal,
      status: 'credited',
      updatedAt: new Date().toISOString(),
    });
  }
  return credit;
};
