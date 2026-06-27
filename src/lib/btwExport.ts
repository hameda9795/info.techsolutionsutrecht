import jsPDF from 'jspdf';
import type { BtwQuarterReport, MonthlyReportRow } from './btw';
import { COMPANY_INFO } from '@/types';

/** Bedrag als platte string met 2 decimalen (komma), bv. "1234,50" — voor CSV/PDF. */
const nl = (n: number): string =>
  n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const triggerDownload = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/** De zes samenvattingsregels die in Mijn Belastingdienst Zakelijk ingevoerd worden. */
const summaryRows = (r: BtwQuarterReport): [string, number][] => [
  ['Verkoop excl. btw', r.verkoopExclBtw],
  ['BTW verkoop', r.btwVerkoop],
  ['Creditnota correcties (btw)', -r.creditnotaBtw],
  ['Inkoop excl. btw', r.inkoopExclBtw],
  ['Voorbelasting', r.voorbelasting],
  ['Netto BTW te betalen', r.nettoBtwTeBetalen],
];

/** Exporteer het kwartaalrapport als CSV (samenvatting + detailregels). */
export const exportBtwCsv = (r: BtwQuarterReport) => {
  const lines: string[] = [];
  const push = (...cells: (string | number)[]) =>
    lines.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'));

  push(`BTW-aangifte ${r.label}`);
  push('Periode', `${r.periodStart} t/m ${r.periodEnd}`);
  push('Deadline', r.deadline);
  push('');

  push('Samenvatting', 'Bedrag (EUR)');
  for (const [label, value] of summaryRows(r)) push(label, nl(value));
  push('');

  push('Verkoopfacturen');
  push('Nummer', 'Datum', 'Type', 'Excl. btw', 'BTW aangifte', 'Incl. btw', 'Status');
  for (const inv of r.invoices) {
    push(
      inv.documentNumber,
      inv.issueDate,
      inv.invoiceSubtype ?? 'NORMAL',
      nl(inv.btwReportableExcl),
      nl(inv.btwReportableAmount),
      nl(inv.totalInclBtw),
      inv.status
    );
  }
  push('');

  push("Creditnota's");
  push('Nummer', 'Datum', 'Excl. btw', 'BTW aangifte', 'Incl. btw');
  for (const cn of r.creditNotes) {
    push(cn.documentNumber, cn.issueDate, nl(cn.btwReportableExcl), nl(cn.btwReportableAmount), nl(-cn.totalInclBtw));
  }
  push('');

  push('Kosten / Inkoopfacturen');
  push('Leverancier', 'Factuurnr.', 'Datum', 'Categorie', 'Excl. btw', 'Voorbelasting', 'Incl. btw', 'Betaalstatus');
  for (const p of r.purchases) {
    push(
      p.supplierName,
      p.supplierInvoiceNumber,
      p.invoiceDate,
      p.category,
      nl(p.amountExclBtw),
      nl(p.btwAmount),
      nl(p.amountInclBtw),
      p.paymentStatus
    );
  }

  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `btw-aangifte-${r.label}.csv`);
};

/** Exporteer het kwartaalrapport als PDF (samenvatting + detailregels). */
export const exportBtwPdf = (r: BtwQuarterReport) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const left = 18;
  const right = 192;
  let y = 20;

  const line = (label: string, value: string, opts?: { bold?: boolean }) => {
    pdf.setFont('helvetica', opts?.bold ? 'bold' : 'normal');
    pdf.text(label, left, y);
    pdf.text(value, right, y, { align: 'right' });
    y += 6;
  };
  const heading = (text: string) => {
    y += 4;
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'bold');
    pdf.text(text, left, y);
    pdf.setDrawColor(200);
    pdf.line(left, y + 1.5, right, y + 1.5);
    y += 7;
    pdf.setFontSize(9);
  };

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'bold');
  pdf.text(`BTW-aangifte ${r.label}`, left, y);
  y += 7;
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`${COMPANY_INFO.name} · BTW-id ${COMPANY_INFO.vatId}`, left, y);
  y += 5;
  pdf.text(`Periode ${r.periodStart} t/m ${r.periodEnd} · Deadline ${r.deadline}`, left, y);
  y += 4;

  heading('Samenvatting');
  for (const [label, value] of summaryRows(r)) {
    const isNet = label.startsWith('Netto');
    line(label, `€ ${nl(value)}`, { bold: isNet });
  }

  heading('Verkoopfacturen');
  if (r.invoices.length === 0) line('Geen verkoopfacturen', '');
  for (const inv of r.invoices) {
    line(
      `${inv.documentNumber} · ${inv.issueDate} · ${inv.invoiceSubtype ?? 'NORMAL'}`,
      `excl € ${nl(inv.btwReportableExcl)} · btw € ${nl(inv.btwReportableAmount)}`
    );
    if (y > 270) {
      pdf.addPage();
      y = 20;
    }
  }

  heading("Creditnota's");
  if (r.creditNotes.length === 0) line("Geen creditnota's", '');
  for (const cn of r.creditNotes) {
    line(`${cn.documentNumber} · ${cn.issueDate}`, `btw € ${nl(cn.btwReportableAmount)}`);
  }

  heading('Kosten / Inkoopfacturen');
  if (r.purchases.length === 0) line('Geen inkoopfacturen', '');
  for (const p of r.purchases) {
    line(
      `${p.supplierName} · ${p.supplierInvoiceNumber || '—'} · ${p.invoiceDate}`,
      `excl € ${nl(p.amountExclBtw)} · btw € ${nl(p.btwAmount)}`
    );
    if (y > 270) {
      pdf.addPage();
      y = 20;
    }
  }

  pdf.save(`btw-aangifte-${r.label}.pdf`);
};

/**
 * Exporteer het maandoverzicht (Rapportage) als CSV. Eén regel per maand, met
 * de omzet per project eronder ingesprongen, en een jaartotaal.
 */
export const exportMonthlyCsv = (
  rows: MonthlyReportRow[],
  year: number,
  projectName: (projectId: string) => string,
  scopeLabel?: string
) => {
  const lines: string[] = [];
  const push = (...cells: (string | number)[]) =>
    lines.push(cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'));

  push(`Maandoverzicht ${year}${scopeLabel ? ` — ${scopeLabel}` : ''}`);
  push('');
  push(
    'Maand',
    'Omzet excl. btw',
    'Kosten excl. btw',
    'BTW te betalen',
    'Ontvangen incl. btw',
    'Ontvangen excl. btw'
  );
  for (const row of rows) {
    push(
      row.label,
      nl(row.omzetExcl),
      nl(row.kostenExcl),
      nl(row.nettoBtw),
      nl(row.ontvangenIncl),
      nl(row.ontvangenExcl)
    );
    for (const p of row.projects) {
      push(`   • ${projectName(p.projectId)}`, nl(p.omzetExcl), '', '', '', '');
    }
  }
  push('');

  const total = (key: keyof MonthlyReportRow) =>
    rows.reduce((s, r) => s + (r[key] as number), 0);
  push(
    'Jaartotaal',
    nl(total('omzetExcl')),
    nl(total('kostenExcl')),
    nl(total('nettoBtw')),
    nl(total('ontvangenIncl')),
    nl(total('ontvangenExcl'))
  );

  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  triggerDownload(blob, `maandoverzicht-${year}.csv`);
};
