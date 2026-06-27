import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileDown,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Receipt,
  PiggyBank,
  Landmark,
} from 'lucide-react';
import type { Document, Payment, PurchaseInvoice, Project } from '@/types';
import {
  getAllDocuments,
  getAllPayments,
  getAllPurchaseInvoices,
  getAllProjects,
} from '@/lib/db';
import { formatEUR, round2 } from '@/lib/calc';
import { computeMonthlyReport, btwYears, type MonthlyReportRow } from '@/lib/btw';
import { exportMonthlyCsv } from '@/lib/btwExport';

const ALL = 'ALL';

export default function Rapportage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [projectId, setProjectId] = useState<string>(ALL);
  const [openMonth, setOpenMonth] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [docs, pays, purs, projs] = await Promise.all([
        getAllDocuments(),
        getAllPayments(),
        getAllPurchaseInvoices(),
        getAllProjects(),
      ]);
      setDocuments(docs);
      setPayments(pays);
      setPurchases(purs);
      setProjects(projs);
    })();
  }, []);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? 'Onbekend project';
  const years = useMemo(() => btwYears(documents, purchases), [documents, purchases]);
  const isFiltered = projectId !== ALL;

  // When a single project is selected, costs/voorbelasting are excluded — they
  // are company-wide and not bookkept per project.
  const rows = useMemo(() => {
    const docs = isFiltered ? documents.filter((d) => d.projectId === projectId) : documents;
    const pays = isFiltered ? payments.filter((p) => p.projectId === projectId) : payments;
    const purs = isFiltered ? [] : purchases;
    return computeMonthlyReport(docs, purs, pays, year);
  }, [documents, payments, purchases, year, projectId, isFiltered]);

  const total = (key: keyof MonthlyReportRow) =>
    round2(rows.reduce((s, r) => s + (r[key] as number), 0));

  const omzet = total('omzetExcl');
  const kosten = total('kostenExcl');
  const winst = round2(omzet - kosten);
  const btw = total('nettoBtw');
  const ontvangenIncl = total('ontvangenIncl');

  const now = new Date();
  const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : -1;

  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-brand-blue">Rapportage</h1>
          <p className="text-gray-500 text-sm mt-1">
            Hoe staat elke maand ervoor — omzet, kosten, btw en wat je echt ontving.
          </p>
        </div>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-1">
              Jaar
            </label>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="w-28 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-[11px] font-medium uppercase tracking-wider text-gray-400 mb-1">
              Project
            </label>
            <Select
              value={projectId}
              onValueChange={(v) => {
                setProjectId(v);
                setOpenMonth(null);
              }}
            >
              <SelectTrigger className="w-56 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Alle projecten</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            className="bg-white"
            onClick={() =>
              exportMonthlyCsv(rows, year, projectName, isFiltered ? projectName(projectId) : undefined)
            }
          >
            <FileDown className="w-4 h-4 mr-2" /> CSV
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Omzet"
          value={omzet}
          hint={`excl. btw · ${year}`}
          icon={<TrendingUp className="w-5 h-5" />}
          tone="blue"
        />
        <Kpi
          label="Kosten"
          value={kosten}
          hint="excl. btw · inkoopfacturen"
          icon={<Receipt className="w-5 h-5" />}
          tone="slate"
        />
        <Kpi
          label="Resultaat"
          value={winst}
          hint="omzet − kosten"
          icon={<PiggyBank className="w-5 h-5" />}
          tone={winst >= 0 ? 'green' : 'red'}
        />
        <Kpi
          label="BTW te betalen"
          value={btw}
          hint="dit jaar opgebouwd"
          icon={<Landmark className="w-5 h-5" />}
          tone="orange"
        />
      </div>

      {isFiltered && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
          Je bekijkt <strong>{projectName(projectId)}</strong>. Kosten worden niet per project
          bijgehouden en zijn hier €&nbsp;0,00 — kies "Alle projecten" voor het volledige
          kostenoverzicht.
        </p>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-gray-200/80 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="bg-gradient-to-r from-brand-blue to-[#26407c] text-white/90">
                <th className="text-left font-heading font-semibold text-[11px] uppercase tracking-wider py-3.5 px-5 w-48">
                  Maand
                </th>
                <th className="text-right font-heading font-semibold text-[11px] uppercase tracking-wider py-3.5 px-5">
                  Omzet
                </th>
                <th className="text-right font-heading font-semibold text-[11px] uppercase tracking-wider py-3.5 px-5">
                  Kosten
                </th>
                <th className="text-right font-heading font-semibold text-[11px] uppercase tracking-wider py-3.5 px-5">
                  BTW te betalen
                </th>
                <th className="text-right font-heading font-semibold text-[11px] uppercase tracking-wider py-3.5 px-5">
                  Ontvangen incl.
                </th>
                <th className="text-right font-heading font-semibold text-[11px] uppercase tracking-wider py-3.5 px-5">
                  Ontvangen excl.
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const empty = r.omzetExcl === 0 && r.kostenExcl === 0 && r.ontvangenIncl === 0;
                const canExpand = r.projects.length > 0 && !isFiltered;
                const isOpen = openMonth === r.month;
                return (
                  <MonthRows
                    key={r.month}
                    row={r}
                    empty={empty}
                    canExpand={canExpand}
                    isOpen={isOpen}
                    isCurrent={r.month === currentMonth}
                    onToggle={() => setOpenMonth(isOpen ? null : r.month)}
                    projectName={projectName}
                  />
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-brand-blue text-white">
                <td className="py-4 px-5 font-heading font-bold">Jaartotaal {year}</td>
                <td className="text-right py-4 px-5 font-semibold tabular-nums">{formatEUR(omzet)}</td>
                <td className="text-right py-4 px-5 font-semibold tabular-nums text-white/80">
                  {formatEUR(kosten)}
                </td>
                <td className="text-right py-4 px-5 font-semibold tabular-nums text-brand-orange">
                  {formatEUR(btw)}
                </td>
                <td className="text-right py-4 px-5 font-semibold tabular-nums">
                  {formatEUR(ontvangenIncl)}
                </td>
                <td className="text-right py-4 px-5 font-semibold tabular-nums text-white/80">
                  {formatEUR(total('ontvangenExcl'))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5 text-xs text-gray-400">
        <p>
          <strong className="text-gray-600">Omzet</strong> — wat je dit jaar gefactureerd hebt (excl.
          btw). Klik een maand open voor de verdeling per project.
        </p>
        <p>
          <strong className="text-gray-600">Kosten</strong> — je inkoopfacturen/kosten van die maand
          (excl. btw).
        </p>
        <p>
          <strong className="text-gray-600">BTW te betalen</strong> — btw op je omzet minus btw op je
          kosten; dit betaal je per kwartaal aan de Belastingdienst.
        </p>
        <p>
          <strong className="text-gray-600">Ontvangen</strong> — geld dat die maand echt binnenkwam.
          Incl. = totaal, excl. = jouw deel (de btw daarin houd je apart voor de fiscus).
        </p>
      </div>
    </div>
  );
}

const KPI_TONES = {
  blue: 'bg-blue-50 text-brand-blue',
  slate: 'bg-slate-100 text-slate-600',
  green: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
  orange: 'bg-orange-50 text-brand-orange',
} as const;

function Kpi({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  icon: React.ReactNode;
  tone: keyof typeof KPI_TONES;
}) {
  const valueColor =
    tone === 'green' ? 'text-emerald-600' : tone === 'red' ? 'text-red-600' : 'text-brand-blue';
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{label}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${KPI_TONES[tone]}`}>{icon}</span>
      </div>
      <div className={`mt-3 font-heading text-2xl font-bold tabular-nums ${valueColor}`}>
        {formatEUR(value)}
      </div>
      <div className="mt-1 text-xs text-gray-400">{hint}</div>
    </div>
  );
}

function MonthRows({
  row,
  empty,
  canExpand,
  isOpen,
  isCurrent,
  onToggle,
  projectName,
}: {
  row: MonthlyReportRow;
  empty: boolean;
  canExpand: boolean;
  isOpen: boolean;
  isCurrent: boolean;
  onToggle: () => void;
  projectName: (id: string) => string;
}) {
  const btwTone = row.nettoBtw > 0 ? 'text-brand-orange' : row.nettoBtw < 0 ? 'text-emerald-600' : 'text-gray-400';
  return (
    <>
      <tr
        className={`border-b border-gray-100 transition-colors ${
          canExpand ? 'cursor-pointer hover:bg-brand-gray' : ''
        } ${empty ? 'text-gray-300' : 'text-gray-800'} ${
          isCurrent ? 'bg-blue-50/40' : ''
        }`}
        onClick={canExpand ? onToggle : undefined}
      >
        <td className="py-3 px-5">
          <span className="inline-flex items-center gap-2">
            {canExpand ? (
              isOpen ? (
                <ChevronDown className="w-4 h-4 text-brand-orange" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )
            ) : (
              <span className="w-4" />
            )}
            <span className={`capitalize ${empty ? '' : 'font-medium'}`}>{row.label}</span>
            {isCurrent && (
              <span className="rounded-full bg-brand-orange/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-orange">
                nu
              </span>
            )}
          </span>
        </td>
        <td className="text-right py-3 px-5 tabular-nums font-medium">{formatEUR(row.omzetExcl)}</td>
        <td className="text-right py-3 px-5 tabular-nums text-gray-500">{formatEUR(row.kostenExcl)}</td>
        <td className={`text-right py-3 px-5 tabular-nums font-medium ${empty ? '' : btwTone}`}>
          {formatEUR(row.nettoBtw)}
        </td>
        <td className="text-right py-3 px-5 tabular-nums font-medium">
          {formatEUR(row.ontvangenIncl)}
        </td>
        <td className="text-right py-3 px-5 tabular-nums text-gray-500">
          {formatEUR(row.ontvangenExcl)}
        </td>
      </tr>
      {isOpen &&
        row.projects.map((p) => (
          <tr key={p.projectId} className="bg-brand-gray text-gray-600">
            <td className="py-2 pl-12 pr-5">
              <span className="flex items-center gap-2.5 border-l-2 border-brand-orange/50 pl-3">
                {projectName(p.projectId)}
              </span>
            </td>
            <td className="text-right py-2 px-5 tabular-nums">{formatEUR(p.omzetExcl)}</td>
            <td colSpan={4} />
          </tr>
        ))}
    </>
  );
}
