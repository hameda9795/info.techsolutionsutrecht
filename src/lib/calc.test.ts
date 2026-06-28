import { describe, it, expect } from 'vitest';
import { recalcItem, recalcDocument, applyAdvances, recalcPurchaseAmounts, round2 } from './calc';
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
    lineType: 'DIENST',
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
      lineType: 'DIENST',
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
        lineType: 'DIENST',
      },
    ]);
    expect(t.totalInclBtw).toBe(100);
    expect(t.subtotalExclBtw).toBe(82.64);
    expect(t.btwAmount).toBe(17.36);
  });
});

describe('recalcPurchaseAmounts (inkoopfactuur btw-codes)', () => {
  it('NL21, bedrag excl. btw', () => {
    const a = recalcPurchaseAmounts('NL21', 100, 'EXCL');
    expect(a.amountExclBtw).toBe(100);
    expect(a.btwPercentage).toBe(21);
    expect(a.btwAmount).toBe(21);
    expect(a.amountInclBtw).toBe(121);
  });

  it('NL21, bedrag incl. btw', () => {
    const a = recalcPurchaseAmounts('NL21', 121, 'INCL');
    expect(a.amountExclBtw).toBe(100);
    expect(a.btwAmount).toBe(21);
    expect(a.amountInclBtw).toBe(121);
  });

  it('NL9, bedrag excl. en incl. btw', () => {
    const excl = recalcPurchaseAmounts('NL9', 100, 'EXCL');
    expect(excl.btwAmount).toBe(9);
    expect(excl.amountInclBtw).toBe(109);

    const incl = recalcPurchaseAmounts('NL9', 109, 'INCL');
    expect(incl.amountExclBtw).toBe(100);
    expect(incl.btwAmount).toBe(9);
  });

  it('Geen btw — geen splitsing, heel bedrag is kosten', () => {
    const a = recalcPurchaseAmounts('GEEN', 50, 'EXCL');
    expect(a.amountExclBtw).toBe(50);
    expect(a.btwAmount).toBe(0);
    expect(a.amountInclBtw).toBe(50);
  });

  // Spec-voorbeeld: OpenAI Ireland, EU btw verlegd, €19,01 -> 4b=19,01, 5b=3,99
  // Reverse charge: de btw is notioneel (alleen voor de aangifte) — er wordt nooit
  // daadwerkelijk btw betaald aan de leverancier, dus amountInclBtw ("totaal betaald")
  // is gelijk aan amountExclBtw, niet excl.+btw.
  it('EU btw verlegd (OpenAI) — zelf 21% berekenen op het excl.-bedrag', () => {
    const a = recalcPurchaseAmounts('EU_VERLEGD', 19.01, 'EXCL');
    expect(a.amountExclBtw).toBe(19.01);
    expect(a.btwAmount).toBe(3.99);
    expect(a.amountInclBtw).toBe(19.01);
  });

  // Spec-voorbeeld: Anthropic VS, Buiten-EU btw verlegd, €18,00 -> 4a=18,00, 5b=3,78
  // Idem: "totaal betaald" blijft het bedrag zelf, de btw wordt nooit echt bijbetaald.
  it('Buiten-EU btw verlegd (Claude) — zelf 21% berekenen op het excl.-bedrag', () => {
    const a = recalcPurchaseAmounts('BUITEN_EU_VERLEGD', 18.0, 'EXCL');
    expect(a.amountExclBtw).toBe(18.0);
    expect(a.btwAmount).toBe(3.78);
    expect(a.amountInclBtw).toBe(18.0);
  });

  // Namecheap-stijl reverse-charge aankoop: bedrag=€6,58 -> excl=6.58, btw=1.38 (notioneel),
  // totaal betaald = 6.58 (niet 7.96).
  it('Buiten-EU btw verlegd (Namecheap €6,58) — totaal betaald = bedrag, niet bedrag+btw', () => {
    const a = recalcPurchaseAmounts('BUITEN_EU_VERLEGD', 6.58, 'EXCL');
    expect(a.amountExclBtw).toBe(6.58);
    expect(a.btwAmount).toBe(1.38);
    expect(a.amountInclBtw).toBe(6.58);
  });

  // Spec-voorbeeld: Canva privéfactuur, niet aftrekbaar, €12,00 incl. btw -> kosten 12,00, geen aangifte-effect
  it('Btw niet aftrekbaar (Canva) — heel bedrag is kosten, geen btw', () => {
    const a = recalcPurchaseAmounts('NIET_AFTREKBAAR', 12.0, 'INCL');
    expect(a.amountExclBtw).toBe(12.0);
    expect(a.btwAmount).toBe(0);
    expect(a.amountInclBtw).toBe(12.0);
  });

  // Spec-voorbeeld: Google privéfactuur, niet aftrekbaar, €21,99 incl. btw -> kosten 21,99, geen aangifte-effect
  it('Btw niet aftrekbaar (Google) — heel bedrag is kosten, geen btw', () => {
    const a = recalcPurchaseAmounts('NIET_AFTREKBAAR', 21.99, 'INCL');
    expect(a.amountExclBtw).toBe(21.99);
    expect(a.btwAmount).toBe(0);
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
