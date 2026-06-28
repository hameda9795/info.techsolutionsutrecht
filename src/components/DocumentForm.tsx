import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Link2, Unlink } from 'lucide-react';
import type {
  Client,
  Document,
  DocumentItem,
  DocumentType,
  InvoiceSubtype,
  LineType,
  Project,
  PurchaseInvoice,
  SettledAdvance,
} from '@/types';
import { documentTypeLabel, LINE_TYPES, lineTypeLabel } from '@/types';
import { recalcItem, recalcDocument, applyAdvances, formatEUR } from '@/lib/calc';
import { buildDraft, saveDraftEdits, createCreditNote } from '@/lib/documents';
import { saveDocument, generateId, getAllPurchaseInvoices } from '@/lib/db';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  project: Project;
  client: Client;
  documentType: DocumentType;
  invoiceSubtype?: InvoiceSubtype;
  existing?: Document | null;
  originalInvoice?: Document | null;
  availableAdvances?: Document[];
  onSaved: () => void;
}

const NO_LINK = 'NONE';

const blankItem = (grossEntry = false): DocumentItem => ({
  id: generateId(),
  description: '',
  quantity: 1,
  unitPriceExclBtw: 0,
  btwPercentage: 21,
  lineTotalExclBtw: 0,
  lineBtwAmount: 0,
  lineTotalInclBtw: 0,
  fixedInclBtw: grossEntry ? 0 : undefined,
  lineType: 'DIENST',
});

const today = () => new Date().toISOString().split('T')[0];

export default function DocumentForm({
  open,
  onOpenChange,
  project,
  client,
  documentType,
  invoiceSubtype,
  existing,
  originalInvoice,
  availableAdvances = [],
  onSaved,
}: Props) {
  const isEindfactuur = documentType === 'INVOICE' && invoiceSubtype === 'EINDFACTUUR';
  const isAanbetaling = documentType === 'INVOICE' && invoiceSubtype === 'AANBETALING';
  const isCreditNote = documentType === 'CREDIT_NOTE';

  // Oudere documenten (vóór deze versie) hebben nog geen lineType — val terug op Dienst.
  const withLineType = (i: DocumentItem): DocumentItem => ({ ...i, lineType: i.lineType ?? 'DIENST' });

  const seedItems = (): DocumentItem[] => {
    if (existing) return existing.items.map((i) => withLineType({ ...i }));
    if (isCreditNote && originalInvoice)
      return originalInvoice.items.map((i) => withLineType({ ...i, id: generateId() }));
    return [blankItem(isAanbetaling)];
  };

  const [items, setItems] = useState<DocumentItem[]>(seedItems);
  const [issueDate, setIssueDate] = useState(existing?.issueDate ?? today());
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [reason, setReason] = useState(existing?.reason ?? '');
  const [selectedAdvanceIds, setSelectedAdvanceIds] = useState<string[]>(
    existing?.settledAdvances?.map((a) => a.documentId) ?? []
  );
  const [purchaseInvoices, setPurchaseInvoices] = useState<PurchaseInvoice[]>([]);

  useEffect(() => {
    getAllPurchaseInvoices()
      .then(setPurchaseInvoices)
      .catch((err) => console.error('Kon inkoopfacturen niet laden voor koppeling:', err));
  }, []);

  const updateItem = (
    id: string,
    field: keyof DocumentItem,
    value: string | number | undefined
  ) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? recalcItem({ ...it, [field]: value }) : it))
    );
  };
  const addItem = () => setItems((p) => [...p, blankItem(isAanbetaling)]);
  const removeItem = (id: string) =>
    setItems((p) => (p.length > 1 ? p.filter((i) => i.id !== id) : p));

  const totals = useMemo(() => recalcDocument(items), [items]);

  const selectedAdvances: SettledAdvance[] = useMemo(
    () =>
      availableAdvances
        .filter((a) => selectedAdvanceIds.includes(a.id))
        .map((a) => ({
          documentId: a.id,
          number: a.documentNumber ?? '',
          exclBtw: a.subtotalExclBtw,
          btwAmount: a.btwAmount,
          inclBtw: a.totalInclBtw,
        })),
    [availableAdvances, selectedAdvanceIds]
  );

  const settlement = useMemo(
    () => applyAdvances(totals, selectedAdvances),
    [totals, selectedAdvances]
  );

  const title = `${existing ? 'Bewerken' : 'Nieuw'}: ${documentTypeLabel(documentType, invoiceSubtype)}`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some((i) => !i.description.trim())) {
      toast.error('Vul een omschrijving in voor elke regel.');
      return;
    }
    if (isCreditNote && !reason.trim()) {
      toast.error('Geef een reden op voor de creditnota.');
      return;
    }

    try {
      if (isCreditNote && originalInvoice && !existing) {
        await createCreditNote(originalInvoice, { items, reason, issueDate });
        toast.success('Creditnota aangemaakt. Originele factuur is gecrediteerd.');
      } else if (existing) {
        const updated: Document = {
          ...existing,
          items,
          issueDate,
          dueDate: dueDate || undefined,
          notes: notes || undefined,
          reason: isCreditNote ? reason : existing.reason,
          settledAdvances: isEindfactuur ? selectedAdvances : existing.settledAdvances,
        };
        await saveDraftEdits(updated);
        toast.success('Concept bijgewerkt');
      } else {
        const draft = buildDraft({
          projectId: project.id,
          clientId: client.id,
          documentType,
          invoiceSubtype,
          issueDate,
          dueDate: dueDate || undefined,
          items,
          settledAdvances: isEindfactuur ? selectedAdvances : undefined,
          notes: notes || undefined,
        });
        await saveDocument(draft);
        toast.success('Concept aangemaakt');
      }
      onSaved();
    } catch (err) {
      toast.error((err as Error).message ?? 'Opslaan mislukt');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-7 text-base">
          {isCreditNote && originalInvoice && (
            <div className="text-base bg-purple-50 border border-purple-200 rounded-lg p-4">
              Creditnota voor factuur{' '}
              <strong>{originalInvoice.documentNumber}</strong>.{' '}
              {totals.totalInclBtw >= originalInvoice.totalInclBtw
                ? 'De originele factuur wordt volledig gecrediteerd en op "gecrediteerd" gezet.'
                : 'Dit is een gedeeltelijke creditnota; de originele factuur blijft openstaan voor het restbedrag.'}
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label className="text-sm mb-2">Datum</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="h-12 text-base"
              />
            </div>
            <div>
              <Label className="text-sm mb-2">
                {documentType === 'OFFERTE' || documentType === 'PROFORMA' ? 'Geldig tot' : 'Vervaldatum'}
              </Label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-12 text-base"
              />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-4">
            <Label className="text-base font-semibold">Regels</Label>
            {items.map((it) => {
              const linkedPurchase = it.linkedPurchaseInvoiceId
                ? purchaseInvoices.find((p) => p.id === it.linkedPurchaseInvoiceId)
                : undefined;
              return (
                <div key={it.id} className="space-y-4 bg-gray-50 p-5 rounded-xl border border-gray-100">
                  {/* Row 1: omschrijving + verwijderen */}
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Label className="text-sm mb-2">Omschrijving</Label>
                      <Input
                        value={it.description}
                        onChange={(e) => updateItem(it.id, 'description', e.target.value)}
                        className="h-12 text-base"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="!h-12 !w-12 shrink-0"
                      onClick={() => removeItem(it.id)}
                      disabled={items.length === 1}
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>

                  {/* Row 2: aantal/prijs (of bedrag), btw%, regeltype */}
                  <div className="grid grid-cols-12 gap-3 items-end">
                    {isAanbetaling ? (
                      <div className="col-span-7">
                        <Label className="text-sm mb-2">Bedrag ontvangen (incl. btw)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={it.fixedInclBtw ?? it.lineTotalInclBtw}
                          onChange={(e) => updateItem(it.id, 'fixedInclBtw', Number(e.target.value))}
                          className="h-12 text-base"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="col-span-2">
                          <Label className="text-sm mb-2">Aantal</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={it.quantity}
                            onChange={(e) => updateItem(it.id, 'quantity', Number(e.target.value))}
                            className="h-12 text-base"
                          />
                        </div>
                        <div className="col-span-3">
                          <Label className="text-sm mb-2">Prijs excl.</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={it.unitPriceExclBtw}
                            onChange={(e) => updateItem(it.id, 'unitPriceExclBtw', Number(e.target.value))}
                            className="h-12 text-base"
                          />
                        </div>
                      </>
                    )}
                    <div className="col-span-2">
                      <Label className="text-sm mb-2">BTW %</Label>
                      <Input
                        type="number"
                        min="0"
                        step="1"
                        value={it.btwPercentage}
                        onChange={(e) => updateItem(it.id, 'btwPercentage', Number(e.target.value))}
                        className="h-12 text-base"
                      />
                    </div>
                    <div className={isAanbetaling ? 'col-span-3' : 'col-span-5'}>
                      <Label className="text-sm mb-2">Regeltype</Label>
                      <Select
                        value={it.lineType}
                        onValueChange={(v) => updateItem(it.id, 'lineType', v as LineType)}
                      >
                        <SelectTrigger className="!h-12 text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LINE_TYPES.map((lt) => (
                            <SelectItem key={lt} value={lt} className="text-base">
                              {lineTypeLabel[lt]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {it.lineType === 'DOORVERKOOP' && (
                    <div className="flex flex-wrap items-center gap-3 text-sm bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                      <span className="text-amber-700">
                        Doorverkoop — wordt mee aangegeven in omzet/btw, maakt nooit automatisch een
                        inkoopfactuur. Heeft mogelijk een gekoppelde inkoopfactuur:
                      </span>
                      <Select
                        value={it.linkedPurchaseInvoiceId ?? NO_LINK}
                        onValueChange={(v) =>
                          updateItem(it.id, 'linkedPurchaseInvoiceId', v === NO_LINK ? undefined : v)
                        }
                      >
                        <SelectTrigger className="!h-10 text-sm w-64 ml-auto bg-white">
                          {linkedPurchase ? (
                            <span className="flex items-center gap-1.5">
                              <Link2 className="w-3.5 h-3.5" /> {linkedPurchase.supplierName} ·{' '}
                              {formatEUR(linkedPurchase.amountInclBtw)}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-gray-400">
                              <Unlink className="w-3.5 h-3.5" /> Koppel inkoopfactuur
                            </span>
                          )}
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          <SelectItem value={NO_LINK}>Geen koppeling</SelectItem>
                          {purchaseInvoices.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.supplierName} · {p.invoiceDate} · {formatEUR(p.amountInclBtw)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="text-right text-sm text-gray-500">
                    Regel: {formatEUR(it.lineTotalExclBtw)} excl · BTW {formatEUR(it.lineBtwAmount)} ·{' '}
                    {formatEUR(it.lineTotalInclBtw)} incl
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              variant="outline"
              onClick={addItem}
              className="w-full h-12 text-base"
            >
              <Plus className="w-5 h-5 mr-2" /> Regel toevoegen
            </Button>
          </div>

          {/* Advance selection for eindfactuur */}
          {isEindfactuur && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Aanbetalingen verrekenen</Label>
              {availableAdvances.length === 0 ? (
                <p className="text-base text-gray-400">
                  Geen definitieve aanbetalingsfacturen in dit project.
                </p>
              ) : (
                availableAdvances.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 border rounded-lg p-4 cursor-pointer text-base"
                  >
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-brand-blue"
                      checked={selectedAdvanceIds.includes(a.id)}
                      onChange={(e) =>
                        setSelectedAdvanceIds((prev) =>
                          e.target.checked ? [...prev, a.id] : prev.filter((x) => x !== a.id)
                        )
                      }
                    />
                    <span className="font-semibold">{a.documentNumber}</span>
                    <span className="text-gray-500 ml-auto">{formatEUR(a.totalInclBtw)}</span>
                  </label>
                ))
              )}
            </div>
          )}

          {/* Creditnota reason */}
          {isCreditNote && (
            <div>
              <Label className="text-sm mb-2">Reden *</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Bijv. correctie factuur"
                className="h-12 text-base"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <Label className="text-sm mb-2">Opmerkingen</Label>
            <textarea
              className="w-full p-4 border rounded-lg text-base focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Totals */}
          <div className="bg-gray-100 rounded-xl p-6 text-base space-y-2">
            <div className="flex justify-between">
              <span>Subtotaal excl. btw</span>
              <span className="font-mono">{formatEUR(totals.subtotalExclBtw)}</span>
            </div>
            <div className="flex justify-between">
              <span>BTW</span>
              <span className="font-mono">{formatEUR(totals.btwAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg border-t pt-2">
              <span>Totaal incl. btw</span>
              <span className="font-mono">{formatEUR(totals.totalInclBtw)}</span>
            </div>
            {isEindfactuur && selectedAdvances.length > 0 && (
              <>
                <div className="flex justify-between text-red-600">
                  <span>Reeds betaald (aanbetaling)</span>
                  <span className="font-mono">- {formatEUR(settlement.reedsBetaaldInclBtw)}</span>
                </div>
                <div className="flex justify-between font-bold text-brand-orange border-t pt-1">
                  <span>Nog te betalen</span>
                  <span className="font-mono">{formatEUR(settlement.nogTeBetalenInclBtw)}</span>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-12 px-6 text-base"
            >
              Annuleren
            </Button>
            <Button type="submit" className="h-12 px-6 text-base bg-brand-blue hover:bg-blue-900">
              Opslaan als concept
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
