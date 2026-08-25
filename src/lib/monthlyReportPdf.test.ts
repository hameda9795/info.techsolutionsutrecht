import { describe, expect, it } from 'vitest';
import type { MonthlyReportRow } from './btw';
import { summarizeMonthlyReport } from './monthlyReportPdf';

const row = (overrides: Partial<MonthlyReportRow>): MonthlyReportRow => ({
  year: 2026,
  month: 1,
  label: 'jan 2026',
  quarter: 1,
  omzetExcl: 0,
  omzetDienstExcl: 0,
  omzetDoorverkoopExcl: 0,
  kostenExcl: 0,
  resultaat: 0,
  btwVerschuldigd: 0,
  voorbelasting: 0,
  nettoBtw: 0,
  ontvangenIncl: 0,
  ontvangenExcl: 0,
  projects: [],
  ...overrides,
});

describe('summarizeMonthlyReport', () => {
  it('calculates totals, ratios, projects and quarters', () => {
    const rows = [
      row({ omzetExcl: 1000, omzetDienstExcl: 800, omzetDoorverkoopExcl: 200, kostenExcl: 250, resultaat: 750, btwVerschuldigd: 210, voorbelasting: 52.5, nettoBtw: 157.5, ontvangenIncl: 605, ontvangenExcl: 500, projects: [{ projectId: 'a', omzetExcl: 700 }, { projectId: 'b', omzetExcl: 300 }] }),
      row({ month: 4, label: 'apr 2026', quarter: 2, omzetExcl: 500, omzetDienstExcl: 500, kostenExcl: 100, resultaat: 400, btwVerschuldigd: 105, voorbelasting: 21, nettoBtw: 84, ontvangenIncl: 605, ontvangenExcl: 500, projects: [{ projectId: 'a', omzetExcl: 500 }] }),
    ];
    const summary = summarizeMonthlyReport(rows, (id) => ({ a: 'Alpha', b: 'Beta' })[id] ?? id);
    expect(summary.totals.omzetExcl).toBe(1500);
    expect(summary.totals.resultaat).toBe(1150);
    expect(summary.resultMargin).toBe(76.67);
    expect(summary.collectionRate).toBe(66.67);
    expect(summary.serviceShare).toBe(86.67);
    expect(summary.projects).toEqual([
      { projectId: 'a', name: 'Alpha', omzetExcl: 1200, share: 80 },
      { projectId: 'b', name: 'Beta', omzetExcl: 300, share: 20 },
    ]);
    expect(summary.quarters[0].omzetExcl).toBe(1000);
    expect(summary.quarters[1].omzetExcl).toBe(500);
    expect(summary.quarters[2].omzetExcl).toBe(0);
  });

  it('keeps ratios at zero when there is no revenue', () => {
    const summary = summarizeMonthlyReport([row({ kostenExcl: 25, resultaat: -25 })], (id) => id);
    expect(summary.resultMargin).toBe(0);
    expect(summary.collectionRate).toBe(0);
    expect(summary.serviceShare).toBe(0);
  });
});
