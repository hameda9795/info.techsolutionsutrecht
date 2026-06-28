import type { Document, Payment, PurchaseInvoice } from '@/types';
import { round2 } from './calc';

export type Quarter = 1 | 2 | 3 | 4;

/** ISO date (YYYY-MM-DD) -> kalenderjaar. */
export const yearOf = (isoDate: string): number => Number(isoDate.slice(0, 4));

/** ISO date (YYYY-MM-DD) -> maand (1-12). */
export const monthOf = (isoDate: string): number => Number(isoDate.slice(5, 7));

/** ISO date (YYYY-MM-DD) -> kwartaal (1-4). */
export const quarterOf = (isoDate: string): Quarter =>
  (Math.floor((monthOf(isoDate) - 1) / 3) + 1) as Quarter;

/** Btw-tijdvaklabel, bv. "2026-Q1". */
export const btwPeriodLabel = (year: number, quarter: Quarter): string =>
  `${year}-Q${quarter}`;

/** Btw-tijdvak (factuurstelsel) waarin een document/inkoop valt, o.b.v. issue/invoice-datum. */
export const btwPeriodOf = (isoDate: string): string =>
  btwPeriodLabel(yearOf(isoDate), quarterOf(isoDate));

/** Begin- en einddatum van een kwartaal. */
export const quarterRange = (
  year: number,
  quarter: Quarter
): { start: string; end: string } => {
  const ranges: Record<Quarter, [string, string]> = {
    1: ['01-01', '03-31'],
    2: ['04-01', '06-30'],
    3: ['07-01', '09-30'],
    4: ['10-01', '12-31'],
  };
  const [start, end] = ranges[quarter];
  return { start: `${year}-${start}`, end: `${year}-${end}` };
};

/**
 * Aangifte-deadline: laatste dag van de maand ná het kwartaal.
 * Q1->30-04, Q2->31-07, Q3->31-10, Q4->31-01 (volgend jaar).
 */
export const quarterDeadline = (year: number, quarter: Quarter): string => {
  switch (quarter) {
    case 1:
      return `${year}-04-30`;
    case 2:
      return `${year}-07-31`;
    case 3:
      return `${year}-10-31`;
    case 4:
      return `${year + 1}-01-31`;
  }
};

// ===== Welke documenten tellen mee voor de btw? =====

/**
 * Factuurstelsel: alleen definitieve (genummerde) officiële documenten — INVOICE en
 * CREDIT_NOTE — tellen mee. Offertes, proforma's en concepten (draft) niet.
 * Het tijdvak volgt de issue_date / factuurdatum, niet de betaaldatum.
 */
export const isBtwReportable = (docu: Document): boolean =>
  !!docu.documentNumber &&
  docu.status !== 'draft' &&
  (docu.documentType === 'INVOICE' || docu.documentType === 'CREDIT_NOTE');

/** Som van de btw van de gekoppelde aanbetalingsfacturen (eindfactuur). */
export const linkedAdvanceBtw = (docu: Document): number =>
  round2((docu.settledAdvances ?? []).reduce((s, a) => s + a.btwAmount, 0));

/** Som van de excl.-bedragen van de gekoppelde aanbetalingsfacturen (eindfactuur). */
export const linkedAdvanceExcl = (docu: Document): number =>
  round2((docu.settledAdvances ?? []).reduce((s, a) => s + a.exclBtw, 0));

/** Ids van de gekoppelde aanbetalingsfacturen. */
export const linkedAdvanceIds = (docu: Document): string[] =>
  (docu.settledAdvances ?? []).map((a) => a.documentId);

/**
 * Btw die in dit tijdvak aangegeven moet worden voor één document.
 * - aanbetalingsfactuur / normale factuur: volledige btw
 * - eindfactuur met gekoppelde aanbetaling: totale btw − reeds aangegeven btw
 * - creditnota: negatief (correctie in het tijdvak van de creditnota zelf)
 */
export const btwReportableAmount = (docu: Document): number => {
  if (docu.documentType === 'CREDIT_NOTE') return round2(-docu.btwAmount);
  return round2(docu.btwAmount - linkedAdvanceBtw(docu));
};

/** Excl.-omzet die in dit tijdvak aangegeven moet worden (zelfde aanbetalingslogica). */
export const reportableExcl = (docu: Document): number => {
  if (docu.documentType === 'CREDIT_NOTE') return round2(-docu.subtotalExclBtw);
  return round2(docu.subtotalExclBtw - linkedAdvanceExcl(docu));
};

// ===== Inkoopfacturen: rubriek-toewijzing per btw-code =====
//
// Belangrijk: alleen een ECHTE inkoopfactuur (PurchaseInvoice) raakt deze
// rubrieken. Doorverkoop-regels op een verkoopfactuur maken nooit een
// inkoopfactuur of inkoop-btw aan (zie DocumentItem.lineType).
//
// NL21/NL9          -> 5b (aftrekbare voorbelasting).
// EU_VERLEGD        -> 4b (grondslag) + 5b (zelf berekende, aftrekbare btw).
// BUITEN_EU_VERLEGD -> 4a (grondslag) + 5b (zelf berekende, aftrekbare btw).
// GEEN/NIET_AFTREKBAAR -> geen enkele rubriek; volledige bedrag is kosten.
//
// Voor verlegde btw (EU/Buiten-EU) wordt hetzelfde bedrag opgeteld bij de
// verschuldigde btw (alsof zelf gefactureerd) én bij de aftrekbare voorbelasting
// — het netto-effect op "Netto btw te betalen" is dus 0, maar de grondslag
// (4a/4b) en de btw zelf (5b) moeten wel zichtbaar in de aangifte staan.

/** Rubriek 4a: grondslag inkoop van buiten de EU (btw verlegd). */
export const purchaseRubriek4a = (p: PurchaseInvoice): number =>
  p.btwCode === 'BUITEN_EU_VERLEGD' ? p.amountExclBtw : 0;

/** Rubriek 4b: grondslag inkoop binnen de EU (btw verlegd). */
export const purchaseRubriek4b = (p: PurchaseInvoice): number =>
  p.btwCode === 'EU_VERLEGD' ? p.amountExclBtw : 0;

/** Aftrekbare voorbelasting (rubriek 5b) — NL21/NL9 + de zelf berekende verlegde btw. */
export const purchaseVoorbelasting = (p: PurchaseInvoice): number =>
  p.btwCode === 'NL21' ||
  p.btwCode === 'NL9' ||
  p.btwCode === 'EU_VERLEGD' ||
  p.btwCode === 'BUITEN_EU_VERLEGD'
    ? p.btwAmount
    : 0;

/** Verlegde btw die ook bij de verschuldigde btw moet (annuleert tegen de voorbelasting hierboven). */
export const purchaseVerlegdVerschuldigd = (p: PurchaseInvoice): number =>
  p.btwCode === 'EU_VERLEGD' || p.btwCode === 'BUITEN_EU_VERLEGD' ? p.btwAmount : 0;

/** Kosten (excl. btw waar aftrekbaar, anders het volledige incl.-bedrag) voor de management-rapportage. */
export const purchaseKosten = (p: PurchaseInvoice): number => p.amountExclBtw;

// ===== Genormaliseerde rij voor de aangifte =====

export interface BtwInvoiceRow {
  documentId: string;
  documentNumber: string;
  issueDate: string;
  documentType: Document['documentType'];
  invoiceSubtype?: Document['invoiceSubtype'];
  status: Document['status'];
  subtotalExclBtw: number;
  btwAmount: number;
  totalInclBtw: number;
  paidAmount: number;
  remainingAmount: number;
  linkedAdvanceInvoiceIds: string[];
  linkedAdvanceBtwAmount: number;
  btwReportableExcl: number;
  btwReportableAmount: number;
  btwPeriod: string;
}

export const toBtwRow = (docu: Document): BtwInvoiceRow => ({
  documentId: docu.id,
  documentNumber: docu.documentNumber ?? '',
  issueDate: docu.issueDate,
  documentType: docu.documentType,
  invoiceSubtype: docu.invoiceSubtype,
  status: docu.status,
  subtotalExclBtw: docu.subtotalExclBtw,
  btwAmount: docu.btwAmount,
  totalInclBtw: docu.totalInclBtw,
  paidAmount: docu.paidAmount,
  remainingAmount: docu.remainingAmount,
  linkedAdvanceInvoiceIds: linkedAdvanceIds(docu),
  linkedAdvanceBtwAmount: linkedAdvanceBtw(docu),
  btwReportableExcl: reportableExcl(docu),
  btwReportableAmount: btwReportableAmount(docu),
  btwPeriod: btwPeriodOf(docu.issueDate),
});

// ===== Kwartaalrapport =====

export interface BtwQuarterReport {
  year: number;
  quarter: Quarter;
  label: string; // "2026-Q1"
  periodStart: string;
  periodEnd: string;
  deadline: string;
  invoices: BtwInvoiceRow[]; // verkoopfacturen (INVOICE)
  creditNotes: BtwInvoiceRow[]; // creditnota's
  purchases: PurchaseInvoice[]; // kosten / inkoopfacturen
  // Samenvatting:
  verkoopExclBtw: number; // rubriek 1a grondslag
  btwVerkoop: number; // rubriek 1a btw
  creditnotaExclBtw: number; // magnitude (positief)
  creditnotaBtw: number; // magnitude (positief)
  inkoopExclBtw: number; // kosten (excl. waar aftrekbaar, anders volledig bedrag)
  rubriek4a: number; // grondslag inkoop van buiten de EU (btw verlegd)
  rubriek4b: number; // grondslag inkoop binnen de EU (btw verlegd)
  voorbelasting: number; // rubriek 5b: NL21/NL9 + zelf berekende verlegde btw
  nettoBtwTeBetalen: number;
}

const sum = (ns: number[]): number => round2(ns.reduce((s, n) => s + n, 0));

/**
 * Stel het btw-rapport voor één kwartaal samen.
 * Documenten worden ingedeeld op issue_date (factuurstelsel), inkoopfacturen op invoiceDate.
 *
 * Netto btw te betalen = btw verkoop − btw creditnota's + verlegde btw (4a/4b) − voorbelasting (5b).
 * De verlegde btw zit zowel in de verschuldigde kant als in de voorbelasting (5b), dus die
 * twee termen heffen elkaar exact op — het netto-effect van reverse charge is altijd 0.
 */
export const computeQuarterReport = (
  documents: Document[],
  purchases: PurchaseInvoice[],
  year: number,
  quarter: Quarter
): BtwQuarterReport => {
  const label = btwPeriodLabel(year, quarter);

  const rows = documents
    .filter(isBtwReportable)
    .filter((d) => btwPeriodOf(d.issueDate) === label)
    .map(toBtwRow);

  const invoices = rows.filter((r) => r.documentType === 'INVOICE');
  const creditNotes = rows.filter((r) => r.documentType === 'CREDIT_NOTE');

  const periodPurchases = purchases.filter(
    (p) => btwPeriodOf(p.invoiceDate) === label
  );

  const verkoopExclBtw = sum(invoices.map((r) => r.btwReportableExcl));
  const btwVerkoop = sum(invoices.map((r) => r.btwReportableAmount));
  // Creditnota-rijen zijn negatief; toon de correctie als positieve magnitude.
  const creditnotaExclBtw = round2(-sum(creditNotes.map((r) => r.btwReportableExcl)));
  const creditnotaBtw = round2(-sum(creditNotes.map((r) => r.btwReportableAmount)));
  const inkoopExclBtw = sum(periodPurchases.map(purchaseKosten));
  const rubriek4a = sum(periodPurchases.map(purchaseRubriek4a));
  const rubriek4b = sum(periodPurchases.map(purchaseRubriek4b));
  const voorbelasting = sum(periodPurchases.map(purchaseVoorbelasting));
  const btwVerlegdVerschuldigd = sum(periodPurchases.map(purchaseVerlegdVerschuldigd));
  const nettoBtwTeBetalen = round2(
    btwVerkoop + btwVerlegdVerschuldigd - creditnotaBtw - voorbelasting
  );

  const { start, end } = quarterRange(year, quarter);

  return {
    year,
    quarter,
    label,
    periodStart: start,
    periodEnd: end,
    deadline: quarterDeadline(year, quarter),
    invoices,
    creditNotes,
    purchases: periodPurchases,
    verkoopExclBtw,
    btwVerkoop,
    creditnotaExclBtw,
    creditnotaBtw,
    inkoopExclBtw,
    rubriek4a,
    rubriek4b,
    voorbelasting,
    nettoBtwTeBetalen,
  };
};

/** Bepaal voor welke jaren er btw-data is (op basis van facturen + inkoop). */
export const btwYears = (
  documents: Document[],
  purchases: PurchaseInvoice[]
): number[] => {
  const years = new Set<number>();
  for (const d of documents) {
    if (isBtwReportable(d)) years.add(yearOf(d.issueDate));
  }
  for (const p of purchases) years.add(yearOf(p.invoiceDate));
  years.add(new Date().getFullYear());
  return [...years].sort((a, b) => b - a);
};

// ===== Maandoverzicht (management report) =====

const MONTH_LABELS = [
  'jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
];

/** Dutch short month label, e.g. "mrt 2026". */
export const monthLabel = (year: number, month: number): string =>
  `${MONTH_LABELS[month - 1]} ${year}`;

/** Kwartaal van een maandnummer (1-12). */
export const quarterOfMonth = (month: number): Quarter =>
  (Math.floor((month - 1) / 3) + 1) as Quarter;

/** Omzet (excl. btw) per project binnen één maand. */
export interface MonthlyProjectRevenue {
  projectId: string;
  omzetExcl: number;
}

/**
 * Verdeel de (reeds aanbetaling/creditnota-gecorrigeerde) excl.-omzet van een document
 * naar verhouding van de Dienst- versus Doorverkoop-regels erop. Puur voor de interne
 * winstrapportage — heeft geen invloed op de btw-aangifte (die telt alle regels samen).
 */
export interface LineTypeSplit {
  dienstExcl: number;
  doorverkoopExcl: number;
}

export const lineTypeSplit = (docu: Document): LineTypeSplit => {
  const reportable = reportableExcl(docu);
  const totalRaw = docu.items.reduce((s, i) => s + i.lineTotalExclBtw, 0);
  if (totalRaw === 0) return { dienstExcl: reportable, doorverkoopExcl: 0 };
  const doorverkoopRaw = docu.items
    .filter((i) => i.lineType === 'DOORVERKOOP')
    .reduce((s, i) => s + i.lineTotalExclBtw, 0);
  const doorverkoopExcl = round2(reportable * (doorverkoopRaw / totalRaw));
  return { dienstExcl: round2(reportable - doorverkoopExcl), doorverkoopExcl };
};

export interface MonthlyReportRow {
  year: number;
  month: number; // 1-12
  label: string;
  quarter: Quarter;
  /** Omzet excl. btw, netto van creditnota's (factuurstelsel, issue_date). */
  omzetExcl: number;
  /** Omzetdeel uit eigen diensten (Dienst-regels). */
  omzetDienstExcl: number;
  /** Omzetdeel uit doorverkochte zaken (Doorverkoop-regels, bv. domein/hosting). */
  omzetDoorverkoopExcl: number;
  /** Inkoop/kosten excl. btw (op factuurdatum). */
  kostenExcl: number;
  /** omzetExcl − kostenExcl: bedrijfsresultaat vóór inkomstenbelasting. */
  resultaat: number;
  /** Verschuldigde btw over de omzet, netto van creditnota-correcties. */
  btwVerschuldigd: number;
  /** Aftrekbare btw over de inkoop (voorbelasting). */
  voorbelasting: number;
  /** btwVerschuldigd − voorbelasting: de btw die je voor deze maand betaalt. */
  nettoBtw: number;
  /** Daadwerkelijk ontvangen klantbetalingen in deze maand, incl. btw (kasbasis). */
  ontvangenIncl: number;
  /** Het excl.-btw deel van het ontvangen bedrag (jouw omzetdeel van de kas). */
  ontvangenExcl: number;
  /** Omzet uitgesplitst per project (excl. btw), aflopend gesorteerd. */
  projects: MonthlyProjectRevenue[];
}

/**
 * Maandelijks management-overzicht voor één kalenderjaar: omzet (per project),
 * kosten, de btw die je betaalt en de daadwerkelijk ontvangen bedragen — alles
 * per maand (factuurstelsel: zelfde grondslag als de officiële kwartaalaangifte).
 * De som van de 3 maanden in een kwartaal komt exact overeen met
 * computeQuarterReport voor dat kwartaal.
 *
 * Het ontvangen bedrag wordt opgesplitst in incl. en excl. btw: een klant betaalt
 * altijd inclusief btw, maar het btw-deel houd je apart voor de Belastingdienst.
 * Het excl.-deel wordt afgeleid uit de btw-verhouding van de betaalde factuur.
 *
 * Let op: dit is de omzetbelasting (btw). Inkomstenbelasting wordt jaarlijks
 * over de jaarwinst geheven (met ondernemersaftrek e.d.) en is geen maand- of
 * kwartaalberekening — die rekenen we hier dus niet voor.
 */
export const computeMonthlyReport = (
  documents: Document[],
  purchases: PurchaseInvoice[],
  payments: Payment[],
  year: number
): MonthlyReportRow[] => {
  const reportableDocs = documents
    .filter(isBtwReportable)
    .filter((d) => yearOf(d.issueDate) === year);
  const yearPurchases = purchases.filter((p) => yearOf(p.invoiceDate) === year);
  const yearPayments = payments.filter((p) => yearOf(p.paymentDate) === year);

  // Split a payment into its excl.-btw portion using the btw-ratio of the
  // invoice it was paid against. Fallback to 21% if the invoice is unknown.
  const docById = new Map(documents.map((d) => [d.id, d]));
  const exclPortionOf = (pay: Payment): number => {
    const d = docById.get(pay.documentId);
    if (d && d.totalInclBtw > 0) return pay.amount * (d.subtotalExclBtw / d.totalInclBtw);
    return pay.amount / 1.21;
  };

  const rows: MonthlyReportRow[] = [];
  for (let month = 1; month <= 12; month++) {
    const docsInMonth = reportableDocs.filter((d) => monthOf(d.issueDate) === month);
    const purchasesInMonth = yearPurchases.filter((p) => monthOf(p.invoiceDate) === month);
    const paymentsInMonth = yearPayments.filter((p) => monthOf(p.paymentDate) === month);

    const omzetExcl = sum(docsInMonth.map(reportableExcl));
    const omzetDienstExcl = sum(docsInMonth.map((d) => lineTypeSplit(d).dienstExcl));
    const omzetDoorverkoopExcl = sum(docsInMonth.map((d) => lineTypeSplit(d).doorverkoopExcl));
    const btwVerschuldigd = sum(docsInMonth.map(btwReportableAmount));
    const kostenExcl = sum(purchasesInMonth.map(purchaseKosten));
    const voorbelasting = sum(purchasesInMonth.map(purchaseVoorbelasting));
    const btwVerlegdVerschuldigd = sum(purchasesInMonth.map(purchaseVerlegdVerschuldigd));
    const ontvangenIncl = sum(paymentsInMonth.map((p) => p.amount));
    const ontvangenExcl = sum(paymentsInMonth.map(exclPortionOf));

    // Omzet per project (excl. btw), grootste eerst.
    const byProject = new Map<string, number>();
    for (const d of docsInMonth) {
      byProject.set(d.projectId, (byProject.get(d.projectId) ?? 0) + reportableExcl(d));
    }
    const projects = [...byProject.entries()]
      .map(([projectId, v]) => ({ projectId, omzetExcl: round2(v) }))
      .filter((p) => p.omzetExcl !== 0)
      .sort((a, b) => b.omzetExcl - a.omzetExcl);

    rows.push({
      year,
      month,
      label: monthLabel(year, month),
      quarter: quarterOfMonth(month),
      omzetExcl,
      omzetDienstExcl,
      omzetDoorverkoopExcl,
      kostenExcl,
      resultaat: round2(omzetExcl - kostenExcl),
      btwVerschuldigd,
      voorbelasting,
      nettoBtw: round2(btwVerschuldigd + btwVerlegdVerschuldigd - voorbelasting),
      ontvangenIncl,
      ontvangenExcl,
      projects,
    });
  }
  return rows;
};
