import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Wallet } from 'lucide-react';
import type { Document, Payment } from '@/types';
import { documentTypeLabel } from '@/types';
import { getAllPayments, getAllDocuments } from '@/lib/db';
import { formatEUR } from '@/lib/calc';
import PaymentDialog from '@/components/PaymentDialog';
import { toast } from 'sonner';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    setPayments(await getAllPayments());
    setDocuments(await getAllDocuments());
  };
  useEffect(() => {
    load();
  }, []);

  const invoices = documents.filter((d) => d.documentType === 'INVOICE' && d.documentNumber);
  const docLabel = (id: string) => {
    const d = documents.find((x) => x.id === id);
    return d ? `${d.documentNumber} — ${documentTypeLabel(d.documentType, d.invoiceSubtype)}` : '—';
  };

  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Betalingen</h1>
          <p className="text-gray-500">Totaal ontvangen: {formatEUR(total)}</p>
        </div>
        <Button
          className="bg-brand-blue hover:bg-blue-900"
          onClick={() => {
            if (invoices.length === 0) {
              toast.error('Er zijn nog geen definitieve facturen.');
              return;
            }
            setOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" /> Betaling toevoegen
        </Button>
      </div>

      {payments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Wallet className="w-12 h-12 mx-auto mb-3 opacity-30" />
            Nog geen betalingen.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {payments
            .slice()
            .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate))
            .map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="font-mono font-semibold text-gray-900">
                      {formatEUR(p.amount)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {p.paymentDate} · {p.paymentMethod}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">{docLabel(p.documentId)}</div>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      {open && invoices.length > 0 && (
        <PaymentDialog
          open={open}
          onOpenChange={setOpen}
          invoices={invoices}
          initialDoc={invoices[0]}
          onSaved={() => {
            setOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
