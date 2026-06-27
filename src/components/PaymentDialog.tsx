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
import type { Document } from '@/types';
import { documentTypeLabel } from '@/types';
import { recordPayment, amountDue } from '@/lib/documents';
import { formatEUR } from '@/lib/calc';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoices: Document[];
  initialDoc: Document;
  onSaved: () => void;
}

export default function PaymentDialog({
  open,
  onOpenChange,
  invoices,
  initialDoc,
  onSaved,
}: Props) {
  const [docId, setDocId] = useState(initialDoc.id);
  const [amount, setAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Bankoverschrijving');
  const [note, setNote] = useState('');

  const selected = invoices.find((d) => d.id === docId) ?? initialDoc;
  const due = amountDue(selected);
  const remaining = selected.remainingAmount;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      toast.error('Voer een bedrag groter dan 0 in.');
      return;
    }
    if (amount > remaining + 0.005) {
      toast.error(
        `Bedrag is hoger dan het openstaande bedrag (${formatEUR(remaining)}).`
      );
      return;
    }
    await recordPayment(selected, { amount, paymentDate, paymentMethod, note: note || undefined });
    toast.success('Betaling geregistreerd');
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Betaling toevoegen</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label>Factuur</Label>
            <Select value={docId} onValueChange={setDocId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {invoices.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.documentNumber} — {documentTypeLabel(d.documentType, d.invoiceSubtype)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm bg-gray-50 rounded-lg p-3 flex justify-between">
            <span className="text-gray-500">Te betalen: {formatEUR(due)}</span>
            <span className="text-gray-500">Nog open: {formatEUR(remaining)}</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bedrag (€)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Datum</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Betaalmethode</Label>
            <Input value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} />
          </div>
          <div>
            <Label>Notitie</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAmount(remaining)}
          >
            Volledig openstaand bedrag ({formatEUR(remaining)})
          </Button>

          <DialogFooter>
            <Button type="submit" className="bg-brand-blue hover:bg-blue-900">
              Betaling opslaan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
