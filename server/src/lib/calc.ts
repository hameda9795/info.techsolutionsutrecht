// Kept byte-for-byte identical in logic to src/lib/calc.ts in the frontend repo —
// this is the server-side source of truth used to recompute/validate financial
// totals instead of trusting client-supplied numbers (see routes/documents.ts and
// routes/purchaseInvoices.ts).
import type { AmountMode, DocumentItem, PurchaseBtwCode, SettledAdvance } from '../types.js';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const recalcItem = (item: DocumentItem): DocumentItem => {
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
  btwPercentage: number;
}

export const recalcDocument = (items: DocumentItem[]): DocumentTotals => {
  const lines = items.map(recalcItem);
  const subtotalExclBtw = round2(lines.reduce((s, l) => s + l.lineTotalExclBtw, 0));
  const btwAmount = round2(lines.reduce((s, l) => s + l.lineBtwAmount, 0));
  const totalInclBtw = round2(subtotalExclBtw + btwAmount);

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

export interface PurchaseAmounts {
  amountExclBtw: number;
  btwPercentage: number;
  btwAmount: number;
  amountInclBtw: number;
}

export const recalcPurchaseAmounts = (
  btwCode: PurchaseBtwCode,
  amountInput: number,
  amountInputMode: AmountMode
): PurchaseAmounts => {
  switch (btwCode) {
    case 'NL21':
    case 'NL9': {
      const rate = btwCode === 'NL21' ? 21 : 9;
      if (amountInputMode === 'INCL') {
        const amountInclBtw = round2(amountInput);
        const amountExclBtw = round2(amountInclBtw / (1 + rate / 100));
        const btwAmount = round2(amountInclBtw - amountExclBtw);
        return { amountExclBtw, btwPercentage: rate, btwAmount, amountInclBtw };
      }
      const amountExclBtw = round2(amountInput);
      const btwAmount = round2((amountExclBtw * rate) / 100);
      const amountInclBtw = round2(amountExclBtw + btwAmount);
      return { amountExclBtw, btwPercentage: rate, btwAmount, amountInclBtw };
    }
    case 'EU_VERLEGD':
    case 'BUITEN_EU_VERLEGD': {
      // Reverse charge: the 21% btw is notional (self-assessed for the aangifte only,
      // see btw.ts) — the buyer never actually pays it to the foreign supplier, so the
      // amount actually paid ("totaal betaald") equals the excl.-btw bedrag, not excl.+btw.
      const amountExclBtw = round2(amountInput);
      const btwAmount = round2((amountExclBtw * 21) / 100);
      const amountInclBtw = amountExclBtw;
      return { amountExclBtw, btwPercentage: 21, btwAmount, amountInclBtw };
    }
    case 'GEEN':
    case 'NIET_AFTREKBAAR': {
      const amount = round2(amountInput);
      return { amountExclBtw: amount, btwPercentage: 0, btwAmount: 0, amountInclBtw: amount };
    }
  }
};
