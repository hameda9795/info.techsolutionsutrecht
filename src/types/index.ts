// ===== Document type system (NL boekhouding) =====

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

// Allowed statuses per document type (used by UI dropdowns / validation)
export const STATUS_BY_TYPE: Record<DocumentType, DocumentStatus[]> = {
  OFFERTE: ['draft', 'sent', 'accepted', 'rejected'],
  PROFORMA: ['draft', 'sent', 'expired'],
  INVOICE: ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'credited'],
  CREDIT_NOTE: ['draft', 'sent', 'processed'],
};

// Series prefix per document type. All INVOICE subtypes share the "F" series.
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

export interface DocumentItem {
  id: string;
  description: string;
  quantity: number;
  unitPriceExclBtw: number;
  btwPercentage: number;
  lineTotalExclBtw: number;
  lineBtwAmount: number;
  lineTotalInclBtw: number;
  // Gross-entry mode (aanbetalingsfactuur): the incl.-btw amount actually
  // received is the fixed input; excl./btw are derived backwards from it so
  // they sum back to exactly this amount. Undefined = normal excl.-price mode.
  fixedInclBtw?: number;
}

// A settled advance invoice (aanbetaling) deducted on an eindfactuur.
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
  invoiceSubtype?: InvoiceSubtype; // only for INVOICE
  documentNumber: string | null; // null while draft (concept)
  status: DocumentStatus;
  issueDate: string;
  dueDate?: string;
  items: DocumentItem[];
  subtotalExclBtw: number;
  btwPercentage: number; // dominant rate (informational header)
  btwAmount: number;
  totalInclBtw: number;
  settledAdvances?: SettledAdvance[]; // eindfactuur only
  paidAmount: number;
  remainingAmount: number;
  notes?: string;
  // Creditnota only:
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

// ===== BTW-aangifte (VAT return) =====

// Kostencategorieën voor inkoopfacturen.
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

/** Inkoopfactuur / kostenpost — basis voor voorbelasting (aftrekbare btw). */
export interface PurchaseInvoice {
  id: string;
  supplierName: string;
  supplierInvoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD — bepaalt het btw-tijdvak
  category: PurchaseCategory;
  amountExclBtw: number;
  btwPercentage: number;
  btwAmount: number;
  amountInclBtw: number;
  paymentStatus: PaymentStatus;
  attachmentPdf?: string; // link/referentie naar de PDF-bijlage
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Status van een btw-tijdvak in het aangifteproces.
export type BtwPeriodState = 'open' | 'prepared' | 'submitted' | 'paid' | 'corrected';

export const BTW_PERIOD_STATES: BtwPeriodState[] = [
  'open',
  'prepared',
  'submitted',
  'paid',
  'corrected',
];

export const btwPeriodStateLabel: Record<BtwPeriodState, string> = {
  open: 'Open',
  prepared: 'Voorbereid',
  submitted: 'Ingediend',
  paid: 'Betaald',
  corrected: 'Gecorrigeerd',
};

export const btwPeriodStateClass: Record<BtwPeriodState, string> = {
  open: 'bg-gray-400',
  prepared: 'bg-blue-600',
  submitted: 'bg-amber-500',
  paid: 'bg-green-600',
  corrected: 'bg-purple-600',
};

/** Opgeslagen status + notitie per tijdvak (id = `${year}_Q${quarter}`). */
export interface BtwPeriodMeta {
  id: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  state: BtwPeriodState;
  note?: string;
  updatedAt: string;
}

export interface CompanyInfo {
  name: string;
  website: string;
  phone: string;
  kvk: string;
  vatId: string;
  email: string;
  address?: string;
  logo?: string;
}

export const COMPANY_INFO: CompanyInfo = {
  name: 'TechSolutionsUtrecht',
  website: 'https://www.techsolutionsutrecht.nl/',
  phone: '+31 623434286',
  kvk: '99202301',
  vatId: 'NL005375937B46',
  email: 'info@techsolutionsutrecht.nl',
  address: 'H Akhgari / St.-ludgerusstraat 199 / 3553 CW Utrecht',
};

// Human-readable labels (NL) for document type + subtype, used in UI and PDF titles.
export const documentTypeLabel = (
  type: DocumentType,
  subtype?: InvoiceSubtype
): string => {
  switch (type) {
    case 'OFFERTE':
      return 'Offerte';
    case 'PROFORMA':
      return 'Proforma factuur';
    case 'CREDIT_NOTE':
      return 'Creditnota';
    case 'INVOICE':
      if (subtype === 'AANBETALING') return 'Aanbetalingsfactuur';
      if (subtype === 'EINDFACTUUR') return 'Eindfactuur';
      return 'Factuur';
  }
};

// Uppercase title shown on the PDF.
export const documentPdfTitle = (
  type: DocumentType,
  subtype?: InvoiceSubtype
): string => documentTypeLabel(type, subtype).toUpperCase();
