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

// Regeltype op een verkoopfactuurregel: eigen dienst, of iets doorverkocht
// (bv. domein/hosting) dat meestal ook zelf bij een provider is ingekocht.
// Puur informatief/intern — beide types tellen voor omzet/btw-aangifte mee.
export type LineType = 'DIENST' | 'DOORVERKOOP';

export const LINE_TYPES: LineType[] = ['DIENST', 'DOORVERKOOP'];

export const lineTypeLabel: Record<LineType, string> = {
  DIENST: 'Dienst',
  DOORVERKOOP: 'Doorverkoop',
};

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
  // Dienst (eigen werk) of Doorverkoop (ingekocht bij provider, doorgefactureerd).
  // Default = DIENST. Heeft geen effect op omzet/btw-berekening — alleen intern
  // rapportage-onderscheid. Maakt NOOIT automatisch een inkoopfactuur/btw aan.
  lineType: LineType;
  // Optionele koppeling naar de échte inkoopfactuur van de provider (alleen
  // relevant bij lineType = DOORVERKOOP). Puur informatief voor de winstrapportage.
  linkedPurchaseInvoiceId?: string;
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

/** Hoe is de betaling van de inkoopfactuur gedaan. */
export type PaidVia = 'ZAKELIJK' | 'PRIVE';

export const paidViaLabel: Record<PaidVia, string> = {
  ZAKELIJK: 'Zakelijk',
  PRIVE: 'Privé',
};

/** In welke vorm is "Bedrag" op de inkoopfactuur ingevoerd. */
export type AmountMode = 'EXCL' | 'INCL';

/**
 * Btw-behandeling van een inkoopfactuur — bepaalt het btw-percentage, of de
 * btw aftrekbaar is, en in welke rubriek(en) van de btw-aangifte dit terechtkomt.
 *
 * NL21 / NL9     -> 5b (voorbelasting), bedrag kan excl. of incl. btw ingevoerd worden.
 * GEEN           -> geen btw, geen effect op de aangifte; heel bedrag is kosten.
 * EU_VERLEGD     -> 4b (grondslag) + 5b (zelf berekende, aftrekbare btw); netto 0.
 * BUITEN_EU_VERLEGD -> 4a (grondslag) + 5b (zelf berekende, aftrekbare btw); netto 0.
 * NIET_AFTREKBAAR   -> geen btw-aftrek; heel bedrag (incl. btw) is kosten, geen aangifte-effect.
 */
export type PurchaseBtwCode =
  | 'NL21'
  | 'NL9'
  | 'GEEN'
  | 'EU_VERLEGD'
  | 'BUITEN_EU_VERLEGD'
  | 'NIET_AFTREKBAAR';

export const PURCHASE_BTW_CODES: PurchaseBtwCode[] = [
  'NL21',
  'NL9',
  'GEEN',
  'EU_VERLEGD',
  'BUITEN_EU_VERLEGD',
  'NIET_AFTREKBAAR',
];

export const purchaseBtwCodeLabel: Record<PurchaseBtwCode, string> = {
  NL21: 'NL 21% btw',
  NL9: 'NL 9% btw',
  GEEN: 'Geen btw',
  EU_VERLEGD: 'EU btw verlegd',
  BUITEN_EU_VERLEGD: 'Buiten EU btw verlegd',
  NIET_AFTREKBAAR: 'Btw niet aftrekbaar',
};

/** Korte uitleg per btw-code, getoond als hint in het inkoopfactuur-formulier. */
export const purchaseBtwCodeHint: Record<PurchaseBtwCode, string> = {
  NL21: 'Aftrekbare voorbelasting (5b) tegen 21%.',
  NL9: 'Aftrekbare voorbelasting (5b) tegen 9%.',
  GEEN: 'Geen btw — geen effect op de btw-aangifte.',
  EU_VERLEGD:
    'Diensten uit de EU (bv. OpenAI Ireland). Rubriek 4b + 5b, netto-effect 0.',
  BUITEN_EU_VERLEGD:
    'Diensten van buiten de EU (bv. Anthropic VS, Kimi Singapore). Rubriek 4a + 5b, netto-effect 0.',
  NIET_AFTREKBAAR:
    'Btw niet aftrekbaar (bv. privéfactuur Canva/Google). Heel bedrag is kosten, geen aangifte-effect.',
};

/** Inkoopfactuur / kostenpost — basis voor voorbelasting (aftrekbare btw). */
export interface PurchaseInvoice {
  id: string;
  supplierName: string;
  supplierInvoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD — bepaalt het btw-tijdvak
  category: PurchaseCategory;
  btwCode: PurchaseBtwCode;
  // Het bedrag zoals ingevoerd door de gebruiker, en of dat excl. of incl. btw is.
  // Voor EU/Buiten-EU verlegd en niet-aftrekbaar/geen-btw is dit altijd het volledige
  // bedrag (er wordt dan niets gesplitst op basis van deze modus).
  amountInput: number;
  amountInputMode: AmountMode;
  // Afgeleide bedragen (door recalcPurchaseAmounts berekend):
  amountExclBtw: number;
  btwPercentage: number;
  btwAmount: number;
  amountInclBtw: number;
  paymentStatus: PaymentStatus;
  paidVia: PaidVia;
  attachmentPdf?: string; // download-url van de geüploade bijlage (of een handmatige link)
  attachmentName?: string; // oorspronkelijke bestandsnaam, voor weergave
  attachmentPath?: string; // Storage-pad, nodig om de bijlage later te kunnen verwijderen
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
