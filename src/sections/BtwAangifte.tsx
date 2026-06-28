import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Download, FileDown, Pencil, Trash2, Receipt, Paperclip } from 'lucide-react';
import type {
  Document,
  PurchaseInvoice,
  BtwPeriodMeta,
  BtwPeriodState,
} from '@/types';
import {
  BTW_PERIOD_STATES,
  btwPeriodStateLabel,
  btwPeriodStateClass,
  purchaseBtwCodeLabel,
  paidViaLabel,
} from '@/types';
import {
  getAllDocuments,
  getAllPurchaseInvoices,
  getAllBtwPeriods,
  saveBtwPeriod,
  deletePurchaseInvoice,
} from '@/lib/db';
import { formatEUR } from '@/lib/calc';
import {
  computeQuarterReport,
  btwYears,
  type Quarter,
  type BtwQuarterReport,
} from '@/lib/btw';
import { exportBtwCsv, exportBtwPdf } from '@/lib/btwExport';
import { deletePurchaseAttachment } from '@/lib/storage';
import PurchaseInvoiceForm from '@/components/PurchaseInvoiceForm';
import { toast } from 'sonner';

const QUARTERS: Quarter[] = [1, 2, 3, 4];

export default function BtwAangifte() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>([]);
  const [periods, setPeriods] = useState<BtwPeriodMeta[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [quarter, setQuarter] = useState<Quarter>(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseInvoice | null>(null);

  const load = async () => {
    const [docs, purs, pers] = await Promise.all([
      getAllDocuments(),
      getAllPurchaseInvoices(),
      getAllBtwPeriods(),
    ]);
    setDocuments(docs);
    setPurchases(purs);
    setPeriods(pers);
  };
  useEffect(() => {
    load();
  }, []);

  const years = useMemo(() => btwYears(documents, purchases), [documents, purchases]);

  const report: BtwQuarterReport = useMemo(
    () => computeQuarterReport(documents, purchases, year, quarter),
    [documents, purchases, year, quarter]
  );

  const periodMeta = (q: Quarter): BtwPeriodMeta | undefined =>
    periods.find((p) => p.year === year && p.quarter === q);

  const currentState: BtwPeriodState = periodMeta(quarter)?.state ?? 'open';

  const setState = async (state: BtwPeriodState) => {
    const id = `${year}_Q${quarter}`;
    const meta: BtwPeriodMeta = {
      id,
      year,
      quarter,
      state,
      note: periodMeta(quarter)?.note,
      updatedAt: new Date().toISOString(),
    };
    await saveBtwPeriod(meta);
    setPeriods((prev) => [...prev.filter((p) => p.id !== id), meta]);
    toast.success(`Tijdvak ${year}-Q${quarter}: ${btwPeriodStateLabel[state]}`);
  };

  const removePurchase = async (p: PurchaseInvoice) => {
    if (!confirm(`Inkoopfactuur van ${p.supplierName} verwijderen?`)) return;
    // Bijlage eerst opruimen — die lookup gebeurt op id, dus moet vóór het
    // verwijderen van de rij zelf gebeuren, anders is er niets meer om op te zoeken.
    if (p.attachmentPath) await deletePurchaseAttachment(p.id);
    await deletePurchaseInvoice(p.id);
    toast.success('Inkoopfactuur verwijderd');
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">BTW-aangifte</h1>
          <p className="text-gray-500">
            Factuurstelsel — facturen tellen mee op factuurdatum (issue_date), niet op betaaldatum.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28">
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
          <Button
            className="bg-brand-blue hover:bg-blue-900"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" /> Inkoopfactuur
          </Button>
        </div>
      </div>

      <Tabs value={String(quarter)} onValueChange={(v) => setQuarter(Number(v) as Quarter)}>
        <TabsList className="grid grid-cols-4 w-full max-w-md mb-4">
          {QUARTERS.map((q) => {
            const st = periodMeta(q)?.state ?? 'open';
            return (
              <TabsTrigger key={q} value={String(q)} className="relative">
                Q{q}
                <span
                  className={`ml-2 inline-block w-2 h-2 rounded-full ${btwPeriodStateClass[st]}`}
                  title={btwPeriodStateLabel[st]}
                />
              </TabsTrigger>
            );
          })}
        </TabsList>

        {QUARTERS.map((q) => (
          <TabsContent key={q} value={String(q)}>
            {q === quarter && (
              <QuarterPanel
                report={report}
                state={currentState}
                onSetState={setState}
                onEditPurchase={(p) => {
                  setEditing(p);
                  setFormOpen(true);
                }}
                onDeletePurchase={removePurchase}
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      {formOpen && (
        <PurchaseInvoiceForm
          open={formOpen}
          onOpenChange={setFormOpen}
          initial={editing}
          onSaved={() => {
            setFormOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function QuarterPanel({
  report,
  state,
  onSetState,
  onEditPurchase,
  onDeletePurchase,
}: {
  report: BtwQuarterReport;
  state: BtwPeriodState;
  onSetState: (s: BtwPeriodState) => void;
  onEditPurchase: (p: PurchaseInvoice) => void;
  onDeletePurchase: (p: PurchaseInvoice) => void;
}) {
  const summary: { label: string; value: number; strong?: boolean }[] = [
    { label: '1a — Verkoop excl. btw (binnenland, 21%)', value: report.verkoopExclBtw },
    { label: '1a — BTW verkoop', value: report.btwVerkoop },
    { label: "Creditnota correcties (btw)", value: -report.creditnotaBtw },
    { label: '4a — Inkoop diensten buiten EU (verlegd)', value: report.rubriek4a },
    { label: '4b — Inkoop diensten binnen EU (verlegd)', value: report.rubriek4b },
    { label: 'Kosten excl. btw (totaal inkoop)', value: report.inkoopExclBtw },
    { label: '5b — Voorbelasting (incl. verlegde btw)', value: report.voorbelasting },
    { label: 'Netto BTW te betalen', value: report.nettoBtwTeBetalen, strong: true },
  ];

  return (
    <div className="space-y-5">
      {/* Periode + deadline + status */}
      <Card>
        <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm text-gray-500">Periode</div>
            <div className="font-semibold text-gray-900">
              {report.periodStart} t/m {report.periodEnd}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Deadline aangifte</div>
            <div className="font-semibold text-brand-blue">{report.deadline}</div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Netto te betalen</div>
            <div className="font-bold text-xl text-brand-blue">
              {formatEUR(report.nettoBtwTeBetalen)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-1">Status</div>
            <Select value={state} onValueChange={(v) => onSetState(v as BtwPeriodState)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BTW_PERIOD_STATES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {btwPeriodStateLabel[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportBtwPdf(report)}>
              <Download className="w-4 h-4 mr-1" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportBtwCsv(report)}>
              <FileDown className="w-4 h-4 mr-1" /> CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Samenvatting */}
      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Samenvatting (voor Mijn Belastingdienst Zakelijk)</h2>
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
            {summary.map((row) => (
              <div
                key={row.label}
                className={`flex justify-between py-1.5 border-b border-gray-100 ${
                  row.strong ? 'font-bold text-brand-blue text-base' : 'text-gray-700'
                }`}
              >
                <span>{row.label}</span>
                <span className="font-mono">{formatEUR(row.value)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Netto BTW te betalen = BTW verkoop + verlegde btw (rubriek 4a/4b) − BTW creditnota's −
            voorbelasting (rubriek 5b). De verlegde btw zit ook in de voorbelasting, dus het
            netto-effect van reverse charge (EU/Buiten-EU verlegd) is altijd 0.
          </p>
        </CardContent>
      </Card>

      {/* Verkoopfacturen */}
      <Section title="Verkoopfacturen" count={report.invoices.length}>
        {report.invoices.length === 0 ? (
          <Empty>Geen verkoopfacturen in dit tijdvak.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 text-xs uppercase">
              <tr>
                <th className="py-2">Nummer</th>
                <th>Datum</th>
                <th>Type</th>
                <th className="text-right">Excl. btw</th>
                <th className="text-right">BTW aangifte</th>
                <th className="text-right">Incl. btw</th>
              </tr>
            </thead>
            <tbody>
              {report.invoices.map((inv) => (
                <tr key={inv.documentId} className="border-t">
                  <td className="py-2 font-medium">{inv.documentNumber}</td>
                  <td>{inv.issueDate}</td>
                  <td className="text-gray-500">
                    {inv.invoiceSubtype === 'AANBETALING'
                      ? 'Aanbetaling'
                      : inv.invoiceSubtype === 'EINDFACTUUR'
                        ? 'Eindfactuur'
                        : 'Factuur'}
                    {inv.linkedAdvanceBtwAmount > 0 && (
                      <span className="text-xs text-gray-400 block">
                        − aanbet. btw {formatEUR(inv.linkedAdvanceBtwAmount)}
                      </span>
                    )}
                  </td>
                  <td className="text-right font-mono">{formatEUR(inv.btwReportableExcl)}</td>
                  <td className="text-right font-mono font-semibold">
                    {formatEUR(inv.btwReportableAmount)}
                  </td>
                  <td className="text-right font-mono text-gray-500">{formatEUR(inv.totalInclBtw)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Creditnota's */}
      <Section title="Creditnota's" count={report.creditNotes.length}>
        {report.creditNotes.length === 0 ? (
          <Empty>Geen creditnota's in dit tijdvak.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 text-xs uppercase">
              <tr>
                <th className="py-2">Nummer</th>
                <th>Datum</th>
                <th className="text-right">Excl. btw</th>
                <th className="text-right">BTW correctie</th>
              </tr>
            </thead>
            <tbody>
              {report.creditNotes.map((cn) => (
                <tr key={cn.documentId} className="border-t text-red-600">
                  <td className="py-2 font-medium">{cn.documentNumber}</td>
                  <td>{cn.issueDate}</td>
                  <td className="text-right font-mono">{formatEUR(cn.btwReportableExcl)}</td>
                  <td className="text-right font-mono font-semibold">
                    {formatEUR(cn.btwReportableAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {/* Kosten / Inkoopfacturen */}
      <Section title="Kosten / Inkoopfacturen" count={report.purchases.length}>
        {report.purchases.length === 0 ? (
          <Empty>Geen inkoopfacturen in dit tijdvak.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400 text-xs uppercase">
              <tr>
                <th className="py-2">Leverancier</th>
                <th>Datum</th>
                <th>Categorie</th>
                <th>BTW-code</th>
                <th className="text-right">Kosten</th>
                <th className="text-right">Btw (5b)</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {report.purchases.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-2 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {p.supplierName}
                      {p.attachmentPdf && (
                        <a
                          href={p.attachmentPdf}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={p.attachmentName ?? 'Bijlage'}
                          className="text-gray-400 hover:text-brand-blue"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </span>
                    {p.supplierInvoiceNumber && (
                      <span className="text-xs text-gray-400 block">{p.supplierInvoiceNumber}</span>
                    )}
                  </td>
                  <td>{p.invoiceDate}</td>
                  <td className="text-gray-500">{p.category}</td>
                  <td className="text-gray-500">
                    {purchaseBtwCodeLabel[p.btwCode]}
                    <span className="text-xs text-gray-400 block">{paidViaLabel[p.paidVia]}</span>
                  </td>
                  <td className="text-right font-mono">{formatEUR(p.amountExclBtw)}</td>
                  <td className="text-right font-mono font-semibold">{formatEUR(p.btwAmount)}</td>
                  <td>
                    <Badge
                      variant={p.paymentStatus === 'paid' ? 'default' : 'secondary'}
                      className={p.paymentStatus === 'paid' ? 'bg-green-600' : ''}
                    >
                      {p.paymentStatus === 'paid' ? 'Betaald' : 'Open'}
                    </Badge>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" onClick={() => onEditPurchase(p)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onDeletePurchase(p)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  );
}

const Section = ({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) => (
  <Card>
    <CardContent className="p-5">
      <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Receipt className="w-4 h-4 text-gray-400" />
        {title}
        <Badge variant="secondary" className="ml-1">
          {count}
        </Badge>
      </h2>
      <div className="overflow-x-auto">{children}</div>
    </CardContent>
  </Card>
);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <div className="text-sm text-gray-400 py-4">{children}</div>
);
