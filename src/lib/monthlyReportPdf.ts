import { jsPDF } from 'jspdf';
import type { MonthlyReportRow } from './btw';
import { COMPANY_INFO } from '@/types';

type ProjectName = (id: string) => string;

export interface MonthlyReportPdfOptions {
  rows: MonthlyReportRow[];
  year: number;
  projectName: ProjectName;
  scopeLabel?: string;
  generatedAt?: Date;
  logoDataUrl?: string;
}

interface Amounts {
  omzetExcl: number;
  omzetDienstExcl: number;
  omzetDoorverkoopExcl: number;
  kostenExcl: number;
  resultaat: number;
  btwVerschuldigd: number;
  voorbelasting: number;
  nettoBtw: number;
  ontvangenIncl: number;
  ontvangenExcl: number;
}

export interface ReportProject {
  projectId: string;
  name: string;
  omzetExcl: number;
  share: number;
}

export interface ReportQuarter extends Amounts {
  quarter: number;
}

export interface MonthlyReportSummary {
  totals: Amounts;
  projects: ReportProject[];
  quarters: ReportQuarter[];
  resultMargin: number;
  collectionRate: number;
  serviceShare: number;
}

const NAVY: [number, number, number] = [30, 53, 104];
const BLUE: [number, number, number] = [39, 66, 126];
const ORANGE: [number, number, number] = [244, 115, 32];
const GREEN: [number, number, number] = [5, 150, 105];
const SLATE: [number, number, number] = [100, 116, 139];
const LIGHT: [number, number, number] = [246, 248, 252];
const BORDER: [number, number, number] = [222, 226, 234];
const WHITE: [number, number, number] = [255, 255, 255];

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const nl = (n: number) => n.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n: number) => `€ ${nl(n)}`;
const percent = (n: number) => `${nl(n)}%`;
const safeRate = (part: number, whole: number) => (whole === 0 ? 0 : round2((part / whole) * 100));
const sum = (rows: MonthlyReportRow[], key: keyof Amounts) => round2(rows.reduce((total, row) => total + row[key], 0));

export const summarizeMonthlyReport = (
  rows: MonthlyReportRow[],
  projectName: ProjectName
): MonthlyReportSummary => {
  const totals: Amounts = {
    omzetExcl: sum(rows, 'omzetExcl'),
    omzetDienstExcl: sum(rows, 'omzetDienstExcl'),
    omzetDoorverkoopExcl: sum(rows, 'omzetDoorverkoopExcl'),
    kostenExcl: sum(rows, 'kostenExcl'),
    resultaat: sum(rows, 'resultaat'),
    btwVerschuldigd: sum(rows, 'btwVerschuldigd'),
    voorbelasting: sum(rows, 'voorbelasting'),
    nettoBtw: sum(rows, 'nettoBtw'),
    ontvangenIncl: sum(rows, 'ontvangenIncl'),
    ontvangenExcl: sum(rows, 'ontvangenExcl'),
  };

  const projectTotals = new Map<string, number>();
  rows.forEach((row) => row.projects.forEach((project) => {
    projectTotals.set(project.projectId, round2((projectTotals.get(project.projectId) ?? 0) + project.omzetExcl));
  }));
  const projects = [...projectTotals.entries()]
    .map(([projectId, omzetExcl]) => ({
      projectId,
      name: projectName(projectId),
      omzetExcl,
      share: safeRate(omzetExcl, totals.omzetExcl),
    }))
    .sort((a, b) => b.omzetExcl - a.omzetExcl);

  const quarters: ReportQuarter[] = [1, 2, 3, 4].map((quarter) => {
    const quarterRows = rows.filter((row) => row.quarter === quarter);
    return {
      quarter,
      omzetExcl: sum(quarterRows, 'omzetExcl'),
      omzetDienstExcl: sum(quarterRows, 'omzetDienstExcl'),
      omzetDoorverkoopExcl: sum(quarterRows, 'omzetDoorverkoopExcl'),
      kostenExcl: sum(quarterRows, 'kostenExcl'),
      resultaat: sum(quarterRows, 'resultaat'),
      btwVerschuldigd: sum(quarterRows, 'btwVerschuldigd'),
      voorbelasting: sum(quarterRows, 'voorbelasting'),
      nettoBtw: sum(quarterRows, 'nettoBtw'),
      ontvangenIncl: sum(quarterRows, 'ontvangenIncl'),
      ontvangenExcl: sum(quarterRows, 'ontvangenExcl'),
    };
  });

  return {
    totals,
    projects,
    quarters,
    resultMargin: safeRate(totals.resultaat, totals.omzetExcl),
    collectionRate: safeRate(totals.ontvangenExcl, totals.omzetExcl),
    serviceShare: safeRate(totals.omzetDienstExcl, totals.omzetExcl),
  };
};

const drawHeader = (pdf: jsPDF, logoDataUrl?: string) => {
  const width = pdf.internal.pageSize.getWidth();
  if (logoDataUrl) pdf.addImage(logoDataUrl, 'PNG', 12, 9, 42, 16, 'company-logo', 'SLOW');
  else {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(15);
    pdf.setTextColor(...NAVY);
    pdf.text('Tech', 12, 18);
    pdf.setTextColor(...ORANGE);
    pdf.text('Solutions', 27, 18);
  }
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.2);
  pdf.setTextColor(...SLATE);
  const info = [
    COMPANY_INFO.name,
    `KvK ${COMPANY_INFO.kvk}  |  BTW ${COMPANY_INFO.vatId}`,
    `${COMPANY_INFO.email}  |  ${COMPANY_INFO.phone}`,
  ];
  info.forEach((line, index) => pdf.text(line, width - 12, 11.5 + index * 4.2, { align: 'right' }));
  pdf.setDrawColor(...ORANGE);
  pdf.setLineWidth(0.8);
  pdf.line(12, 29, width - 12, 29);
};

const drawTitle = (pdf: jsPDF, title: string, subtitle: string) => {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.setTextColor(...NAVY);
  pdf.text(title, 12, 41);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);
  pdf.setTextColor(...SLATE);
  pdf.text(subtitle, 12, 47);
};

const drawCard = (
  pdf: jsPDF,
  x: number,
  width: number,
  label: string,
  value: string,
  hint: string,
  accent: [number, number, number] = NAVY
) => {
  pdf.setFillColor(...WHITE);
  pdf.setDrawColor(...BORDER);
  pdf.roundedRect(x, 54, width, 27, 2.5, 2.5, 'FD');
  pdf.setFillColor(...accent);
  pdf.roundedRect(x, 54, 2.5, 27, 2.5, 2.5, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.setTextColor(...SLATE);
  pdf.text(label.toUpperCase(), x + 6, 61.5);
  pdf.setFontSize(13.5);
  pdf.setTextColor(...accent);
  pdf.text(value, x + 6, 70.2);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.2);
  pdf.setTextColor(...SLATE);
  pdf.text(hint, x + 6, 76.5);
};

const drawMonthlyChart = (pdf: jsPDF, rows: MonthlyReportRow[]) => {
  const x = 12;
  const y = 91;
  const width = 188;
  const height = 92;
  pdf.setFillColor(...WHITE);
  pdf.setDrawColor(...BORDER);
  pdf.roundedRect(x, y, width, height, 2.5, 2.5, 'FD');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9.5);
  pdf.setTextColor(...NAVY);
  pdf.text('Ontwikkeling per maand', x + 7, y + 10);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(...SLATE);
  pdf.text('Gefactureerd en ontvangen, bedragen excl. btw', x + 7, y + 15);

  const plotX = x + 16;
  const plotY = y + 23;
  const plotW = width - 24;
  const plotH = 54;
  const maxValue = Math.max(1, ...rows.flatMap((row) => [row.omzetExcl, row.kostenExcl, row.ontvangenExcl]));
  pdf.setDrawColor(230, 233, 240);
  pdf.setLineWidth(0.2);
  for (let i = 0; i <= 4; i += 1) {
    const lineY = plotY + (plotH / 4) * i;
    pdf.line(plotX, lineY, plotX + plotW, lineY);
    pdf.setFontSize(5.5);
    pdf.setTextColor(...SLATE);
    pdf.text(nl(maxValue * (1 - i / 4)), plotX - 2, lineY + 1.5, { align: 'right' });
  }
  const slot = plotW / Math.max(1, rows.length);
  const points: Array<[number, number]> = [];
  rows.forEach((row, index) => {
    const center = plotX + slot * index + slot / 2;
    const omzetH = (row.omzetExcl / maxValue) * plotH;
    const kostenH = (row.kostenExcl / maxValue) * plotH;
    pdf.setFillColor(...BLUE);
    pdf.rect(center - 3.2, plotY + plotH - omzetH, 3, omzetH, 'F');
    pdf.setFillColor(203, 213, 225);
    pdf.rect(center + 0.4, plotY + plotH - kostenH, 3, kostenH, 'F');
    points.push([center, plotY + plotH - (row.ontvangenExcl / maxValue) * plotH]);
    pdf.setFontSize(5.5);
    pdf.setTextColor(...SLATE);
    pdf.text(row.label.slice(0, 3), center, plotY + plotH + 5, { align: 'center' });
  });
  pdf.setDrawColor(...ORANGE);
  pdf.setLineWidth(0.8);
  for (let i = 1; i < points.length; i += 1) pdf.line(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
  points.forEach(([pointX, pointY]) => {
    pdf.setFillColor(...ORANGE);
    pdf.circle(pointX, pointY, 1, 'F');
  });
  const legendY = y + height - 5;
  [[BLUE, 'Omzet'], [[203, 213, 225] as [number, number, number], 'Kosten'], [ORANGE, 'Ontvangen excl.']].forEach(([color, label], index) => {
    const legendX = x + 55 + index * 32;
    pdf.setFillColor(...(color as [number, number, number]));
    pdf.rect(legendX, legendY - 2.2, 3, 2.2, 'F');
    pdf.setFontSize(5.8);
    pdf.setTextColor(...SLATE);
    pdf.text(label as string, legendX + 4.5, legendY);
  });
};

const drawInsights = (pdf: jsPDF, summary: MonthlyReportSummary, scopeLabel?: string) => {
  const x = 206;
  const y = 91;
  const width = 79;
  const height = 92;
  pdf.setFillColor(...NAVY);
  pdf.roundedRect(x, y, width, height, 2.5, 2.5, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(...WHITE);
  pdf.text('In één oogopslag', x + 7, y + 11);
  const insights: [string, string, string][] = [
    ['Resultaatmarge', percent(summary.resultMargin), 'resultaat / omzet'],
    ['Ontvangstgraad', percent(summary.collectionRate), 'ontvangen excl. / omzet'],
    ['Aandeel diensten', percent(summary.serviceShare), 'dienstomzet / totale omzet'],
    ['Grootste project', summary.projects[0]?.name ?? 'Geen omzet', summary.projects[0] ? `${percent(summary.projects[0].share)} van omzet` : 'geen projectgegevens'],
  ];
  insights.forEach(([label, value, hint], index) => {
    const itemY = y + 22 + index * 15.5;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.2);
    pdf.setTextColor(183, 198, 226);
    pdf.text(label.toUpperCase(), x + 7, itemY);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(index === 3 ? 8.5 : 11);
    pdf.setTextColor(...WHITE);
    const clipped = pdf.splitTextToSize(value, width - 14)[0];
    pdf.text(clipped, x + 7, itemY + 5.5);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5.7);
    pdf.setTextColor(183, 198, 226);
    pdf.text(hint, x + 7, itemY + 9.5);
  });
  if (scopeLabel) {
    pdf.setFillColor(255, 247, 237);
    pdf.roundedRect(x + 5, y + height - 17, width - 10, 11, 1.5, 1.5, 'F');
    pdf.setFontSize(5.8);
    pdf.setTextColor(154, 52, 18);
    pdf.text('Projectfilter: kosten zijn niet per project toegerekend.', x + 8, y + height - 10.5);
  }
};

const drawMonthlyTable = (pdf: jsPDF, rows: MonthlyReportRow[], summary: MonthlyReportSummary) => {
  const x = 12;
  const y = 53;
  const widths = [25, 31, 29, 31, 29, 31, 25, 31, 31];
  const headers = ['MAAND', 'OMZET', 'DIENST', 'DOORVERKOOP', 'KOSTEN', 'RESULTAAT', 'BTW', 'ONTV. INCL.', 'ONTV. EXCL.'];
  const rowH = 8;
  let cursorX = x;
  pdf.setFillColor(...NAVY);
  pdf.roundedRect(x, y, widths.reduce((a, b) => a + b, 0), 8, 2, 2, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(5.8);
  pdf.setTextColor(...WHITE);
  headers.forEach((header, index) => {
    pdf.text(header, index === 0 ? cursorX + 3 : cursorX + widths[index] - 3, y + 5.1, { align: index === 0 ? 'left' : 'right' });
    cursorX += widths[index];
  });
  rows.forEach((row, rowIndex) => {
    const rowY = y + 8 + rowIndex * rowH;
    pdf.setFillColor(...(rowIndex % 2 === 0 ? WHITE : LIGHT));
    pdf.rect(x, rowY, widths.reduce((a, b) => a + b, 0), rowH, 'F');
    pdf.setDrawColor(...BORDER);
    pdf.line(x, rowY + rowH, 290, rowY + rowH);
    const values = [row.label, money(row.omzetExcl), money(row.omzetDienstExcl), money(row.omzetDoorverkoopExcl), money(row.kostenExcl), money(row.resultaat), money(row.nettoBtw), money(row.ontvangenIncl), money(row.ontvangenExcl)];
    cursorX = x;
    values.forEach((value, index) => {
      pdf.setFont('helvetica', index === 0 || index === 5 ? 'bold' : 'normal');
      pdf.setFontSize(6.2);
      pdf.setTextColor(...(index === 5 && row.resultaat >= 0 ? GREEN : index === 6 && row.nettoBtw > 0 ? ORANGE : index === 0 ? NAVY : SLATE));
      pdf.text(value, index === 0 ? cursorX + 3 : cursorX + widths[index] - 3, rowY + 5.1, { align: index === 0 ? 'left' : 'right' });
      cursorX += widths[index];
    });
  });
  const totalY = y + 8 + rows.length * rowH;
  pdf.setFillColor(...NAVY);
  pdf.rect(x, totalY, widths.reduce((a, b) => a + b, 0), 9, 'F');
  const totalValues = ['JAARTOTAAL', money(summary.totals.omzetExcl), money(summary.totals.omzetDienstExcl), money(summary.totals.omzetDoorverkoopExcl), money(summary.totals.kostenExcl), money(summary.totals.resultaat), money(summary.totals.nettoBtw), money(summary.totals.ontvangenIncl), money(summary.totals.ontvangenExcl)];
  cursorX = x;
  totalValues.forEach((value, index) => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.2);
    pdf.setTextColor(...(index === 6 ? ORANGE : WHITE));
    pdf.text(value, index === 0 ? cursorX + 3 : cursorX + widths[index] - 3, totalY + 5.8, { align: index === 0 ? 'left' : 'right' });
    cursorX += widths[index];
  });

  const guideY = totalY + 14;
  pdf.setFillColor(249, 250, 251);
  pdf.setDrawColor(...BORDER);
  pdf.roundedRect(12, guideY, 273, 23, 2, 2, 'FD');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.2);
  pdf.setTextColor(...NAVY);
  pdf.text('Leeswijzer', 18, guideY + 7);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.1);
  pdf.setTextColor(...SLATE);
  pdf.text('Omzet = gefactureerd excl. btw. Resultaat = omzet minus kosten. BTW = verschuldigde btw minus voorbelasting.', 18, guideY + 13);
  pdf.text('Ontvangen = betalingen die werkelijk binnenkwamen; dit kan door betaalmomenten afwijken van de gefactureerde omzet.', 18, guideY + 18.5);
};

const drawProjectTable = (pdf: jsPDF, projects: ReportProject[], startIndex = 0) => {
  const x = 12;
  const y = 53;
  const tableW = 126;
  pdf.setFillColor(...NAVY);
  pdf.roundedRect(x, y, tableW, 8, 2, 2, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6);
  pdf.setTextColor(...WHITE);
  pdf.text('PROJECT', x + 4, y + 5.2);
  pdf.text('OMZET', x + 102, y + 5.2, { align: 'right' });
  pdf.text('AANDEEL', x + 122, y + 5.2, { align: 'right' });
  projects.forEach((project, index) => {
    const rowY = y + 8 + index * 8;
    pdf.setFillColor(...(index % 2 === 0 ? WHITE : LIGHT));
    pdf.rect(x, rowY, tableW, 8, 'F');
    pdf.setDrawColor(...BORDER);
    pdf.line(x, rowY + 8, x + tableW, rowY + 8);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.4);
    pdf.setTextColor(...NAVY);
    pdf.text(`${startIndex + index + 1}. ${pdf.splitTextToSize(project.name, 70)[0]}`, x + 4, rowY + 5.2);
    pdf.setFont('helvetica', 'bold');
    pdf.text(money(project.omzetExcl), x + 102, rowY + 5.2, { align: 'right' });
    pdf.setTextColor(...ORANGE);
    pdf.text(percent(project.share), x + 122, rowY + 5.2, { align: 'right' });
  });
};

const drawAnalysisPage = (pdf: jsPDF, summary: MonthlyReportSummary) => {
  const visibleProjects = summary.projects.slice(0, 8);
  drawProjectTable(pdf, visibleProjects);
  if (visibleProjects.length === 0) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...SLATE);
    pdf.text('Geen projectomzet in deze periode.', 16, 70);
  }
  const chartY = 132;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(...NAVY);
  pdf.text('Topprojecten', 12, chartY);
  const top = summary.projects.slice(0, 6);
  const max = Math.max(1, ...top.map((project) => project.omzetExcl));
  top.forEach((project, index) => {
    const y = chartY + 8 + index * 8;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5.7);
    pdf.setTextColor(...SLATE);
    pdf.text(pdf.splitTextToSize(project.name, 38)[0], 12, y + 3.8);
    pdf.setFillColor(232, 236, 244);
    pdf.roundedRect(52, y, 75, 5, 1.5, 1.5, 'F');
    pdf.setFillColor(...BLUE);
    pdf.roundedRect(52, y, (project.omzetExcl / max) * 75, 5, 1.5, 1.5, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...NAVY);
    pdf.text(money(project.omzetExcl), 133, y + 3.8, { align: 'right' });
  });

  const x = 149;
  const y = 53;
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...NAVY);
  pdf.text('Kwartaaloverzicht', x, y - 4);
  // Keep the complete table inside the 12 mm right page margin.
  const widths = [15, 24, 23, 25, 21, 28];
  const headers = ['KW.', 'OMZET', 'KOSTEN', 'RESULTAAT', 'BTW', 'ONTVANGEN'];
  let cursorX = x;
  pdf.setFillColor(...NAVY);
  pdf.roundedRect(x, y, widths.reduce((a, b) => a + b, 0), 8, 2, 2, 'F');
  pdf.setFontSize(5.8);
  pdf.setTextColor(...WHITE);
  headers.forEach((header, index) => {
    pdf.text(header, index === 0 ? cursorX + 3 : cursorX + widths[index] - 3, y + 5.2, { align: index === 0 ? 'left' : 'right' });
    cursorX += widths[index];
  });
  summary.quarters.forEach((quarter, index) => {
    const rowY = y + 8 + index * 10;
    pdf.setFillColor(...(index % 2 === 0 ? WHITE : LIGHT));
    pdf.rect(x, rowY, widths.reduce((a, b) => a + b, 0), 10, 'F');
    const values = [`Q${quarter.quarter}`, money(quarter.omzetExcl), money(quarter.kostenExcl), money(quarter.resultaat), money(quarter.nettoBtw), money(quarter.ontvangenIncl)];
    cursorX = x;
    values.forEach((value, valueIndex) => {
      pdf.setFont('helvetica', valueIndex === 0 || valueIndex === 3 ? 'bold' : 'normal');
      pdf.setFontSize(6.2);
      pdf.setTextColor(...(valueIndex === 3 && quarter.resultaat >= 0 ? GREEN : valueIndex === 4 && quarter.nettoBtw > 0 ? ORANGE : NAVY));
      pdf.text(value, valueIndex === 0 ? cursorX + 3 : cursorX + widths[valueIndex] - 3, rowY + 6.2, { align: valueIndex === 0 ? 'left' : 'right' });
      cursorX += widths[valueIndex];
    });
  });

  pdf.setFillColor(248, 250, 252);
  pdf.setDrawColor(...BORDER);
  pdf.roundedRect(x, 109, 136, 67, 2.5, 2.5, 'FD');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(...NAVY);
  pdf.text('Samenvatting en begrippen', x + 7, 119);
  const notes = [
    `Resultaat: ${money(summary.totals.resultaat)} (${percent(summary.resultMargin)} van de omzet).`,
    `Openstaande timing: omzet ${money(summary.totals.omzetExcl)} tegenover ontvangen excl. ${money(summary.totals.ontvangenExcl)}.`,
    `BTW te betalen: ${money(summary.totals.nettoBtw)} na aftrek van ${money(summary.totals.voorbelasting)} voorbelasting.`,
    'Doorverkoop is apart getoond en maakt niet automatisch een inkoopfactuur of inkoop-btw aan.',
  ];
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.4);
  pdf.setTextColor(...SLATE);
  let noteY = 128;
  notes.forEach((note) => {
    const lines = pdf.splitTextToSize(note, 120);
    pdf.setFillColor(...ORANGE);
    pdf.circle(x + 8, noteY - 1.4, 0.8, 'F');
    pdf.text(lines, x + 12, noteY);
    noteY += lines.length * 4 + 4;
  });
};

const drawProjectContinuation = (pdf: jsPDF, projects: ReportProject[], startIndex: number) => {
  drawProjectTable(pdf, projects, startIndex);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(...SLATE);
  pdf.text('Alle projecten zijn opgenomen; de volgorde is gebaseerd op omzet excl. btw.', 12, 190);
};

const addFooters = (pdf: jsPDF) => {
  const pages = pdf.getNumberOfPages();
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(...BORDER);
    pdf.setLineWidth(0.2);
    pdf.line(12, height - 10, width - 12, height - 10);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(5.8);
    pdf.setTextColor(...SLATE);
    pdf.text(COMPANY_INFO.website.replace(/^https?:\/\//, '').replace(/\/$/, ''), 12, height - 5.5);
    pdf.text(`Pagina ${page} van ${pages}`, width - 12, height - 5.5, { align: 'right' });
  }
};

export const buildMonthlyReportPdf = (options: MonthlyReportPdfOptions): jsPDF => {
  const { rows, year, projectName, scopeLabel, logoDataUrl, generatedAt = new Date() } = options;
  const summary = summarizeMonthlyReport(rows, projectName);
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({
    title: `Managementrapportage ${year}`,
    subject: scopeLabel ? `Rapportage ${scopeLabel}` : 'Rapportage alle projecten',
    author: COMPANY_INFO.name,
    creator: COMPANY_INFO.name,
  });
  const scope = scopeLabel ?? 'Alle projecten';
  const date = generatedAt.toLocaleDateString('nl-NL', { day: '2-digit', month: 'long', year: 'numeric' });

  drawHeader(pdf, logoDataUrl);
  drawTitle(pdf, `Managementrapportage ${year}`, `${scope}  |  Gegenereerd op ${date}`);
  const gap = 4;
  const cardW = (273 - gap * 4) / 5;
  drawCard(pdf, 12, cardW, 'Omzet', money(summary.totals.omzetExcl), 'excl. btw', NAVY);
  drawCard(pdf, 12 + (cardW + gap), cardW, 'Kosten', money(summary.totals.kostenExcl), 'excl. btw', SLATE);
  drawCard(pdf, 12 + (cardW + gap) * 2, cardW, 'Resultaat', money(summary.totals.resultaat), 'omzet - kosten', summary.totals.resultaat >= 0 ? GREEN : ORANGE);
  drawCard(pdf, 12 + (cardW + gap) * 3, cardW, 'BTW te betalen', money(summary.totals.nettoBtw), 'na voorbelasting', ORANGE);
  drawCard(pdf, 12 + (cardW + gap) * 4, cardW, 'Ontvangen', money(summary.totals.ontvangenIncl), 'incl. btw', NAVY);
  drawMonthlyChart(pdf, rows);
  drawInsights(pdf, summary, scopeLabel);

  pdf.addPage('a4', 'landscape');
  drawHeader(pdf, logoDataUrl);
  drawTitle(pdf, 'Maandoverzicht', `${scope}  |  Alle bedragen in euro`);
  drawMonthlyTable(pdf, rows, summary);

  pdf.addPage('a4', 'landscape');
  drawHeader(pdf, logoDataUrl);
  drawTitle(pdf, 'Project- en kwartaalanalyse', `${scope}  |  Verdeling en ontwikkeling`);
  drawAnalysisPage(pdf, summary);

  const remainingProjects = summary.projects.slice(8);
  for (let index = 0; index < remainingProjects.length; index += 16) {
    pdf.addPage('a4', 'landscape');
    drawHeader(pdf, logoDataUrl);
    drawTitle(pdf, 'Projectdetails (vervolg)', `${scope}  |  Volledige projectverdeling`);
    drawProjectContinuation(pdf, remainingProjects.slice(index, index + 16), index + 8);
  }
  addFooters(pdf);
  return pdf;
};

const loadOptimizedLogo = (): Promise<string | undefined> => new Promise((resolve) => {
  const image = new Image();
  image.onload = () => {
    const source = document.createElement('canvas');
    source.width = image.naturalWidth;
    source.height = image.naturalHeight;
    const context = source.getContext('2d', { willReadFrequently: true });
    if (!context) return resolve(undefined);
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, source.width, source.height).data;
    let minX = source.width;
    let minY = source.height;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < source.height; y += 2) {
      for (let x = 0; x < source.width; x += 2) {
        const offset = (y * source.width + x) * 4;
        const visible = pixels[offset + 3] > 15 && (pixels[offset] < 247 || pixels[offset + 1] < 247 || pixels[offset + 2] < 247);
        if (visible) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (minX > maxX || minY > maxY) return resolve(undefined);
    const padding = 12;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(source.width, maxX + padding);
    maxY = Math.min(source.height, maxY + padding);
    const cropW = maxX - minX;
    const cropH = maxY - minY;
    const scale = Math.min(1, 900 / cropW, 360 / cropH);
    const output = document.createElement('canvas');
    output.width = Math.max(1, Math.round(cropW * scale));
    output.height = Math.max(1, Math.round(cropH * scale));
    output.getContext('2d')?.drawImage(source, minX, minY, cropW, cropH, 0, 0, output.width, output.height);
    resolve(output.toDataURL('image/png'));
  };
  image.onerror = () => resolve(undefined);
  image.src = '/logo.png';
});

const slug = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const exportMonthlyPdf = async (
  rows: MonthlyReportRow[],
  year: number,
  projectName: ProjectName,
  scopeLabel?: string
) => {
  const logoDataUrl = await loadOptimizedLogo();
  const pdf = buildMonthlyReportPdf({ rows, year, projectName, scopeLabel, logoDataUrl });
  const suffix = scopeLabel ? `-${slug(scopeLabel)}` : '';
  pdf.save(`managementrapportage-${year}${suffix}.pdf`);
};
