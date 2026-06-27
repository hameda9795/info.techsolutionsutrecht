import { useMemo, useState } from 'react';
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
import { Plus, Trash2 } from 'lucide-react';
import type {
  Client,
  Document,
  DocumentItem,
  DocumentType,
  InvoiceSubtype,
  Project,
  SettledAdvance,
} from '@/types';
import { documentTypeLabel } from '@/types';
import { recalcItem, recalcDocument, applyAdvances, formatEUR } from '@/lib/calc';
import { buildDraft, saveDraftEdits, createCreditNote } from '@/lib/documents';
import { saveDocument, generateId } from '@/lib/db';
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

  const seedItems = (): DocumentItem[] => {
    if (existing) return existing.items.map((i) => ({ ...i }));
    if (isCreditNote && originalInvoice) return originalInvoice.items.map((i) => ({ ...i, id: generateId() }));
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

  const updateItem = (
    id: string,
    field: keyof DocumentItem,
    value: string | number
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          {isCreditNote && originalInvoice && (
            <div className="text-sm bg-purple-50 border border-purple-200 rounded-lg p-3">
              Creditnota voor factuur{' '}
              <strong>{originalInvoice.documentNumber}</strong>.{' '}
              {totals.totalInclBtw >= originalInvoice.totalInclBtw
                ? 'De originele factuur wordt volledig gecrediteerd en op "gecrediteerd" gezet.'
                : 'Dit is een gedeeltelijke creditnota; de originele factuur blijft openstaan voor het restbedrag.'}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Datum</Label>
              <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div>
              <Label>{documentType === 'OFFERTE' || documentType === 'PROFORMA' ? 'Geldig tot' : 'Vervaldatum'}</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <Label className="font-semibold">Regels</Label>
            {items.map((it) => (
              <div key={it.id} className="grid grid-cols-12 gap-2 items-end bg-gray-50 p-3 rounded-lg">
                <div className="col-span-5">
                  <Label className="text-xs">Omschrijving</Label>
                  <Input
                    value={it.description}
                    onChange={(e) => updateItem(it.id, 'description', e.target.value)}
                  />
                </div>
                {isAanbetaling ? (
                  <div className="col-span-4">
                    <Label className="text-xs">Bedrag ontvangen (incl. btw)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={it.fixedInclBtw ?? it.lineTotalInclBtw}
                      onChange={(e) => updateItem(it.id, 'fixedInclBtw', Number(e.target.value))}
                    />
                  </div>
                ) : (
                  <>
                    <div className="col-span-2">
                      <Label className="text-xs">Aantal</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={it.quantity}
                        onChange={(e) => updateItem(it.id, 'quantity', Number(e.target.value))}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Prijs excl.</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={it.unitPriceExclBtw}
                        onChange={(e) => updateItem(it.id, 'unitPriceExclBtw', Number(e.target.value))}
                      />
                    </div>
                  </>
                )}
                <div className="col-span-2">
                  <Label className="text-xs">BTW %</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={it.btwPercentage}
                    onChange={(e) => updateItem(it.id, 'btwPercentage', Number(e.target.value))}
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeItem(it.id)}
                    disabled={items.length === 1}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="col-span-12 text-right text-xs text-gray-500">
                  Regel: {formatEUR(it.lineTotalExclBtw)} excl · BTW {formatEUR(it.lineBtwAmount)} ·{' '}
                  {formatEUR(it.lineTotalInclBtw)} incl
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addItem} className="w-full">
              <Plus className="w-4 h-4 mr-2" /> Regel toevoegen
            </Button>
          </div>

          {/* Advance selection for eindfactuur */}
          {isEindfactuur && (
            <div className="space-y-2">
              <Label className="font-semibold">Aanbetalingen verrekenen</Label>
              {availableAdvances.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Geen definitieve aanbetalingsfacturen in dit project.
                </p>
              ) : (
                availableAdvances.map((a) => (
                  <label
                    key={a.id}
                    className="flex items-center gap-3 border rounded-lg p-3 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-blue"
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
              <Label>Reden *</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Bijv. correctie factuur" />
            </div>
          )}

          {/* Notes */}
          <div>
            <Label>Opmerkingen</Label>
            <textarea
              className="w-full p-3 border rounded-lg text-sm focus:ring-2 focus:ring-brand-blue focus:border-transparent"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Totals */}
          <div className="bg-gray-100 rounded-lg p-4 text-sm space-y-1">
            <div className="flex justify-between">
              <span>Subtotaal excl. btw</span>
              <span className="font-mono">{formatEUR(totals.subtotalExclBtw)}</span>
            </div>
            <div className="flex justify-between">
              <span>BTW</span>
              <span className="font-mono">{formatEUR(totals.btwAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-1">
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button type="submit" className="bg-brand-blue hover:bg-blue-900">
              Opslaan als concept
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
