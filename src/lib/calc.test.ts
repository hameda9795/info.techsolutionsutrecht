import { describe, it, expect } from 'vitest';
import { recalcItem, recalcDocument, applyAdvances, round2 } from './calc';
import { formatNumber } from './numbering';
import type { DocumentItem, SettledAdvance } from '../types';

const item = (description: string, quantity: number, unitPriceExclBtw: number): DocumentItem =>
  recalcItem({
    id: description,
    description,
    quantity,
    unitPriceExclBtw,
    btwPercentage: 21,
    lineTotalExclBtw: 0,
    lineBtwAmount: 0,
    lineTotalInclBtw: 0,
  });

describe('Arix-schildersbedrijf example', () => {
  const items = [item('Ontwerp en bouw website', 1, 300), item('Extra services', 1, 84.41)];

  it('computes document totals (excl / btw / incl)', () => {
    const t = recalcDocument(items);
    expect(t.subtotalExclBtw).toBe(384.41);
    expect(t.btwAmount).toBe(80.73);
    expect(t.totalInclBtw).toBe(465.14);
    expect(t.btwPercentage).toBe(21);
  });

  it('computes the aanbetaling totals', () => {
    const t = recalcDocument([item('Aanbetaling 50%', 1, 150)]);
    expect(t.subtotalExclBtw).toBe(150);
    expect(t.btwAmount).toBe(31.5);
    expect(t.totalInclBtw).toBe(181.5);
  });

  it('settles the aanbetaling on the eindfactuur', () => {
    const totals = recalcDocument(items);
    const advance: SettledAdvance = {
      documentId: 'F-2026-0001',
      number: 'F-2026-0001',
      exclBtw: 150,
      btwAmount: 31.5,
      inclBtw: 181.5,
    };
    const s = applyAdvances(totals, [advance]);
    expect(s.reedsBetaaldInclBtw).toBe(181.5);
    expect(s.nogTeBetalenInclBtw).toBe(283.64);
    expect(s.nogTeBetalenExclBtw).toBe(234.41);
    expect(s.nogTeBetalenBtw).toBe(49.23);
  });
});

describe('aanbetaling — gross-entry (bedrag ontvangen incl. btw)', () => {
  it('derives excl./btw from a received gross amount with no rounding drift', () => {
    const line = recalcItem({
      id: 'x',
      description: 'Aanbetaling',
      quantity: 1,
      unitPriceExclBtw: 0,
      btwPercentage: 21,
      lineTotalExclBtw: 0,
      lineBtwAmount: 0,
      lineTotalInclBtw: 0,
      fixedInclBtw: 100,
    });
    expect(line.lineTotalExclBtw).toBe(82.64);
    expect(line.lineBtwAmount).toBe(17.36);
    expect(line.lineTotalInclBtw).toBe(100);
    // Forward (excl -> btw) calc on 82.64 would round to 99.99, not 100 — the
    // point of gross-entry mode is to guarantee the exact received amount.
    expect(round2(line.lineTotalExclBtw + line.lineBtwAmount)).toBe(100);
  });

  it('document totals on a gross-entry line match the received amount exactly', () => {
    const t = recalcDocument([
      {
        id: 'x',
        description: 'Aanbetaling',
        quantity: 1,
        unitPriceExclBtw: 0,
        btwPercentage: 21,
        lineTotalExclBtw: 0,
        lineBtwAmount: 0,
        lineTotalInclBtw: 0,
        fixedInclBtw: 100,
      },
    ]);
    expect(t.totalInclBtw).toBe(100);
    expect(t.subtotalExclBtw).toBe(82.64);
    expect(t.btwAmount).toBe(17.36);
  });
});

describe('helpers', () => {
  it('rounds to cents', () => {
    expect(round2(80.7261)).toBe(80.73);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('formats document numbers gapless and padded', () => {
    expect(formatNumber('F', 2026, 1)).toBe('F-2026-0001');
    expect(formatNumber('PF', 2026, 42)).toBe('PF-2026-0042');
    expect(formatNumber('CN', 2026, 1234)).toBe('CN-2026-1234');
  });
});
