// Domain types mirroring src/types/index.ts in the frontend. Kept in sync by hand —
// this server only needs the data shapes, not the UI-only labels/colors/constants.

export type DocumentType = 'OFFERTE' | 'PROFORMA' | 'INVOICE' | 'CREDIT_NOTE';
export type InvoiceSubtype = 'NORMAL' | 'AANBETALING' | 'EINDFACTUUR';
export type DocumentStatus =
  | 'draft'
  | 'sent'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'partially_paid'
  | 'paid'
  | 'overdue'
  | 'credited'
  | 'processed';

export const SERIES_PREFIX: Record<DocumentType, string> = {
  OFFERTE: 'OFF',
  PROFORMA: 'PF',
  INVOICE: 'F',
  CREDIT_NOTE: 'CN',
};

export interface Client {
  id: string;
  name: string;
  email: string;
  company?: string;
  address?: string;
  kvk?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  createdAt: string;
}

export type LineType = 'DIENST' | 'DOORVERKOOP';

export interface DocumentItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceExclBtw: number;
  btwPercentage: number;
  lineTotalExclBtw: number;
  lineBtwAmount: number;
  lineTotalInclBtw: number;
  fixedInclBtw?: number;
  lineType: LineType;
  linkedPurchaseInvoiceId?: string;
}

export interface SettledAdvance {
  documentId: string;
  number: string;
  exclBtw: number;
  btwAmount: number;
  inclBtw: number;
}

export interface Document {
  id: string;
  projectId: string;
  clientId: string;
  documentType: DocumentType;
  invoiceSubtype?: InvoiceSubtype;
  documentNumber: string | null;
  status: DocumentStatus;
  issueDate: string;
  dueDate?: string;
  items: DocumentItem[];
  subtotalExclBtw: number;
  btwPercentage: number;
  btwAmount: number;
  totalInclBtw: number;
  settledAdvances?: SettledAdvance[];
  paidAmount: number;
  remainingAmount: number;
  notes?: string;
  originalInvoiceId?: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  documentId: string;
  projectId: string;
  amount: number;
  paymentDate: string;
  paymentMethod?: string;
  note?: string;
  createdAt: string;
}

export const PURCHASE_CATEGORIES = [
  'Hosting & Software',
  'Kantoorbenodigdheden',
  'Marketing & Reclame',
  'Reiskosten',
  'Inkoop goederen',
  'Professioneel advies',
  'Telefoon & Internet',
  'Overig',
] as const;
export type PurchaseCategory = (typeof PURCHASE_CATEGORIES)[number];

export type PaymentStatus = 'open' | 'paid';
export type PaidVia = 'ZAKELIJK' | 'PRIVE';
export type AmountMode = 'EXCL' | 'INCL';

export type PurchaseBtwCode =
  | 'NL21'
  | 'NL9'
  | 'GEEN'
  | 'EU_VERLEGD'
  | 'BUITEN_EU_VERLEGD'
  | 'NIET_AFTREKBAAR';

export interface PurchaseInvoice {
  id: string;
  supplierName: string;
  supplierInvoiceNumber: string;
  invoiceDate: string;
  category: PurchaseCategory;
  btwCode: PurchaseBtwCode;
  amountInput: number;
  amountInputMode: AmountMode;
  amountExclBtw: number;
  btwPercentage: number;
  btwAmount: number;
  amountInclBtw: number;
  paymentStatus: PaymentStatus;
  paidVia: PaidVia;
  attachmentPdf?: string;
  attachmentName?: string;
  attachmentPath?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type BtwPeriodState = 'open' | 'prepared' | 'submitted' | 'paid' | 'corrected';

export interface BtwPeriodMeta {
  id: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  state: BtwPeriodState;
  note?: string;
  updatedAt: string;
}

export interface CounterRow {
  id: string;
  prefix: string;
  year: number;
  value: number;
}
