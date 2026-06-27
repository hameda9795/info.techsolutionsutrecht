import { useState } from 'react';
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
import type { PurchaseInvoice, PurchaseCategory, PaymentStatus } from '@/types';
import { PURCHASE_CATEGORIES } from '@/types';
import { generateId, savePurchaseInvoice } from '@/lib/db';
import { round2, formatEUR } from '@/lib/calc';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: PurchaseInvoice | null;
  onSaved: () => void;
}

export default function PurchaseInvoiceForm({ open, onOpenChange, initial, onSaved }: Props) {
  const [supplierName, setSupplierName] = useState(initial?.supplierName ?? '');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState(
    initial?.supplierInvoiceNumber ?? ''
  );
  const [invoiceDate, setInvoiceDate] = useState(
    initial?.invoiceDate ?? new Date().toISOString().split('T')[0]
  );
  const [category, setCategory] = useState<PurchaseCategory>(
    initial?.category ?? PURCHASE_CATEGORIES[0]
  );
  const [amountExclBtw, setAmountExclBtw] = useState<number>(initial?.amountExclBtw ?? 0);
  const [btwPercentage, setBtwPercentage] = useState<number>(initial?.btwPercentage ?? 21);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    initial?.paymentStatus ?? 'open'
  );
  const [attachmentPdf, setAttachmentPdf] = useState(initial?.attachmentPdf ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  // BTW wordt automatisch afgeleid uit het excl.-bedrag en het percentage.
  const btwAmount = round2((amountExclBtw * btwPercentage) / 100);
  const amountInclBtw = round2(amountExclBtw + btwAmount);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      toast.error('Vul een leverancier in.');
      return;
    }
    if (amountExclBtw <= 0) {
      toast.error('Het bedrag excl. btw moet groter dan 0 zijn.');
      return;
    }
    const now = new Date().toISOString();
    const record: PurchaseInvoice = {
      id: initial?.id ?? generateId(),
      supplierName: supplierName.trim(),
      supplierInvoiceNumber: supplierInvoiceNumber.trim(),
      invoiceDate,
      category,
      amountExclBtw: round2(amountExclBtw),
      btwPercentage,
      btwAmount,
      amountInclBtw,
      paymentStatus,
      attachmentPdf: attachmentPdf.trim() || undefined,
      notes: notes.trim() || undefined,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    await savePurchaseInvoice(record);
    toast.success(initial ? 'Inkoopfactuur bijgewerkt' : 'Inkoopfactuur toegevoegd');
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? 'Inkoopfactuur bewerken' : 'Inkoopfactuur toevoegen'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Leverancier</Label>
              <Input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} />
            </div>
            <div>
              <Label>Factuurnummer leverancier</Label>
              <Input
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Factuurdatum</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Categorie</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as PurchaseCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PURCHASE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bedrag excl. btw (€)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amountExclBtw}
                onChange={(e) => setAmountExclBtw(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>BTW-percentage</Label>
              <Select
                value={String(btwPercentage)}
                onValueChange={(v) => setBtwPercentage(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[21, 9, 0].map((p) => (
                    <SelectItem key={p} value={String(p)}>
                      {p}%
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Afgeleide bedragen */}
          <div className="text-sm bg-gray-50 rounded-lg p-3 grid grid-cols-3 gap-2">
            <div>
              <div className="text-gray-400 text-xs">BTW (voorbelasting)</div>
              <div className="font-mono font-semibold">{formatEUR(btwAmount)}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs">Incl. btw</div>
              <div className="font-mono font-semibold">{formatEUR(amountInclBtw)}</div>
            </div>
            <div>
              <Label className="text-xs text-gray-400">Betaalstatus</Label>
              <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}>
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="paid">Betaald</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Bijlage (PDF link / referentie)</Label>
            <Input
              value={attachmentPdf}
              onChange={(e) => setAttachmentPdf(e.target.value)}
              placeholder="https://… of bestandsnaam"
            />
          </div>
          <div>
            <Label>Notitie</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="submit" className="bg-brand-blue hover:bg-blue-900">
              {initial ? 'Opslaan' : 'Toevoegen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
