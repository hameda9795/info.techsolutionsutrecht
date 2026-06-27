import type { DocumentItem, SettledAdvance } from '@/types';

/** Round to 2 decimals (cents), avoiding binary float drift. */
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Format a number as Dutch currency, e.g. 1234.5 -> "€ 1.234,50". */
export const formatEUR = (n: number): string =>
  '€ ' +
  n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Recompute the derived line totals for a single item (BTW per regel). */
export const recalcItem = (item: DocumentItem): DocumentItem => {
  // Gross-entry mode: the incl.-btw amount is the fixed input (e.g. "I received
  // €100 as aanbetaling"). Derive excl./btw backwards so they sum exactly back
  // to it — a forward (excl -> btw) calc can land 1 cent off due to double rounding.
  if (item.fixedInclBtw != null) {
    const lineTotalInclBtw = round2(item.fixedInclBtw);
    const lineTotalExclBtw = round2(lineTotalInclBtw / (1 + item.btwPercentage / 100));
    const lineBtwAmount = round2(lineTotalInclBtw - lineTotalExclBtw);
    const unitPriceExclBtw = item.quantity ? round2(lineTotalExclBtw / item.quantity) : lineTotalExclBtw;
    return { ...item, unitPriceExclBtw, lineTotalExclBtw, lineBtwAmount, lineTotalInclBtw };
  }
  const lineTotalExclBtw = round2(item.quantity * item.unitPriceExclBtw);
  const lineBtwAmount = round2((lineTotalExclBtw * item.btwPercentage) / 100);
  const lineTotalInclBtw = round2(lineTotalExclBtw + lineBtwAmount);
  return { ...item, lineTotalExclBtw, lineBtwAmount, lineTotalInclBtw };
};

export interface DocumentTotals {
  subtotalExclBtw: number;
  btwAmount: number;
  totalInclBtw: number;
  /** Dominant BTW rate across the lines (informational, for the header). */
  btwPercentage: number;
}

/** Sum the (recalculated) lines into document-level totals. */
export const recalcDocument = (items: DocumentItem[]): DocumentTotals => {
  const lines = items.map(recalcItem);
  const subtotalExclBtw = round2(lines.reduce((s, l) => s + l.lineTotalExclBtw, 0));
  const btwAmount = round2(lines.reduce((s, l) => s + l.lineBtwAmount, 0));
  const totalInclBtw = round2(subtotalExclBtw + btwAmount);

  // Dominant rate = the rate carrying the largest excl. base.
  const byRate = new Map<number, number>();
  for (const l of lines) {
    byRate.set(l.btwPercentage, (byRate.get(l.btwPercentage) ?? 0) + l.lineTotalExclBtw);
  }
  let btwPercentage = 21;
  let max = -1;
  for (const [rate, base] of byRate) {
    if (base > max) {
      max = base;
      btwPercentage = rate;
    }
  }

  return { subtotalExclBtw, btwAmount, totalInclBtw, btwPercentage };
};

export interface AdvanceSettlement {
  totalExclBtw: number;
  totalBtw: number;
  totalInclBtw: number;
  reedsBetaaldExclBtw: number;
  reedsBetaaldBtw: number;
  reedsBetaaldInclBtw: number;
  nogTeBetalenExclBtw: number;
  nogTeBetalenBtw: number;
  nogTeBetalenInclBtw: number;
}

/**
 * Apply already-invoiced advance payments (aanbetalingen) to a document's totals.
 * Used for the eindfactuur: full work minus the selected aanbetalingsfacturen.
 */
export const applyAdvances = (
  totals: DocumentTotals,
  advances: SettledAdvance[]
): AdvanceSettlement => {
  const reedsBetaaldExclBtw = round2(advances.reduce((s, a) => s + a.exclBtw, 0));
  const reedsBetaaldBtw = round2(advances.reduce((s, a) => s + a.btwAmount, 0));
  const reedsBetaaldInclBtw = round2(advances.reduce((s, a) => s + a.inclBtw, 0));
  return {
    totalExclBtw: totals.subtotalExclBtw,
    totalBtw: totals.btwAmount,
    totalInclBtw: totals.totalInclBtw,
    reedsBetaaldExclBtw,
    reedsBetaaldBtw,
    reedsBetaaldInclBtw,
    nogTeBetalenExclBtw: round2(totals.subtotalExclBtw - reedsBetaaldExclBtw),
    nogTeBetalenBtw: round2(totals.btwAmount - reedsBetaaldBtw),
    nogTeBetalenInclBtw: round2(totals.totalInclBtw - reedsBetaaldInclBtw),
  };
};
