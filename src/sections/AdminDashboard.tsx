import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Trash2,
  Eye,
  Copy,
  FileText,
  CheckCircle,
  Clock,
  Pencil
} from 'lucide-react';
import type { Invoice, InvoiceItem } from '@/types/invoice';
import {
  saveInvoice,
  getAllInvoices,
  generateId,
  generateInvoiceNumber,
  deleteInvoice,
  updateInvoice
} from '@/lib/storage';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

export default function AdminDashboard() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: generateId(), description: '', quantity: 1, unitPrice: 0, total: 0 }
  ]);

  const [formData, setFormData] = useState({
    type: 'proforma' as 'proforma' | 'invoice',
    clientName: '',
    clientEmail: '',
    clientCompany: '',
    clientAddress: '',
    clientKvk: '',
    dueDate: '',
    notes: '',
    vatRate: 21
  });

  useEffect(() => {
    setInvoices(getAllInvoices());
  }, []);

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const vatAmount = (subtotal * formData.vatRate) / 100;
    const total = subtotal + vatAmount;
    return { subtotal, vatAmount, total };
  };

  const addItem = () => {
    setItems([...items, {
      id: generateId(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    }]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = updated.quantity * updated.unitPrice;
        }
        return updated;
      }
      return item;
    }));
  };

  const [editingId, setEditingId] = useState<string | null>(null);

  const handleEdit = (invoice: Invoice) => {
    setEditingId(invoice.id);
    setFormData({
      type: invoice.type,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      clientCompany: invoice.clientCompany || '',
      clientAddress: invoice.clientAddress || '',
      clientKvk: invoice.clientKvk || '',
      dueDate: invoice.dueDate,
      notes: invoice.notes || '',
      vatRate: invoice.vatRate
    });
    setItems(invoice.items);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setFormData({
      type: 'proforma',
      clientName: '',
      clientEmail: '',
      clientCompany: '',
      clientAddress: '',
      clientKvk: '',
      dueDate: '',
      notes: '',
      vatRate: 21
    });
    setItems([{ id: generateId(), description: '', quantity: 1, unitPrice: 0, total: 0 }]);
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { subtotal, vatAmount, total } = calculateTotals();

    if (editingId) {
      // Update existing
      const existingInvoice = invoices.find(inv => inv.id === editingId);
      if (existingInvoice) {
        const updatedInvoice: Invoice = {
          ...existingInvoice,
          type: formData.type,
          dueDate: formData.dueDate,
          clientName: formData.clientName,
          clientEmail: formData.clientEmail,
          clientCompany: formData.clientCompany,
          clientAddress: formData.clientAddress,
          clientKvk: formData.clientKvk,
          items: items,
          subtotal,
          vatRate: formData.vatRate,
          vatAmount,
          total,
          notes: formData.notes
        };

        updateInvoice(updatedInvoice);
        setInvoices(invoices.map(inv => inv.id === editingId ? updatedInvoice : inv));
        toast.success('Factuur succesvol bijgewerkt!');
      }
    } else {
      // Create new
      const newInvoice: Invoice = {
        id: generateId(),
        type: formData.type,
        invoiceNumber: generateInvoiceNumber(formData.type),
        date: new Date().toISOString().split('T')[0],
        dueDate: formData.dueDate,
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        clientCompany: formData.clientCompany,
        clientAddress: formData.clientAddress,
        clientKvk: formData.clientKvk,
        items: items,
        subtotal,
        vatRate: formData.vatRate,
        vatAmount,
        total,
        notes: formData.notes,
        status: 'pending'
      };

      saveInvoice(newInvoice);
      setInvoices([...invoices, newInvoice]);
      toast.success(`${formData.type === 'proforma' ? 'Proforma' : 'Factuur'} succesvol aangemaakt!`);
    }

    resetForm();
  };

  const copyLink = (invoiceId: string) => {
    const link = `${window.location.origin}/invoice/${invoiceId}`;
    navigator.clipboard.writeText(link);
    toast.success('Link gekopieerd!');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Goedgekeurd</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" /> In Afwachting</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Weet u zeker dat u wilt verwijderen?')) {
      deleteInvoice(id);
      setInvoices(invoices.filter(inv => inv.id !== id));
      toast.success('Verwijderd!');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <Toaster position="top-center" />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-brand-blue text-white p-3 rounded-xl shadow-lg">
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Tech<span className="text-brand-orange">Solutions</span></h1>
              <p className="text-gray-500 font-medium">Factuur Beheer Systeem</p>
            </div>
          </div>
          <Button onClick={() => setShowForm(!showForm)} className="bg-brand-blue hover:bg-blue-900 shadow-md transition-all hover:scale-105">
            <Plus className="w-4 h-4 mr-2" />
            {showForm ? 'Sluiten' : 'Nieuwe Factuur Maken'}
          </Button>
        </div>

        {/* Create Form */}
        {showForm && (
          <Card className="mb-8 shadow-lg">
            <CardHeader>
              <CardTitle>{editingId ? 'Factuur/Proforma Bewerken' : 'Nieuwe Factuur/Proforma Maken'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <Tabs defaultValue="proforma" onValueChange={(v) => setFormData({ ...formData, type: v as 'proforma' | 'invoice' })}>
                  <TabsList className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="proforma">Proforma</TabsTrigger>
                    <TabsTrigger value="invoice">Factuur</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-700 border-b pb-2">Klantgegevens</h3>

                    <div>
                      <Label>Klant Email *</Label>
                      <Input
                        required
                        type="email"
                        value={formData.clientEmail}
                        onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                        placeholder="klant@voorbeeld.nl"
                      />
                    </div>

                    <div>
                      <Label>Naam Klant *</Label>
                      <Input
                        required
                        value={formData.clientName}
                        onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <Label>Bedrijf</Label>
                      <Input
                        value={formData.clientCompany}
                        onChange={(e) => setFormData({ ...formData, clientCompany: e.target.value })}
                        placeholder="Bedrijfsnaam"
                      />
                    </div>

                    <div>
                      <Label>Adres</Label>
                      <Input
                        value={formData.clientAddress}
                        onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
                        placeholder="Straat, Stad, Postcode"
                      />
                    </div>

                    <div>
                      <Label>KVK Nummer</Label>
                      <Input
                        value={formData.clientKvk}
                        onChange={(e) => setFormData({ ...formData, clientKvk: e.target.value })}
                        placeholder="12345678"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-700 border-b pb-2">Factuurgegevens</h3>

                    <div>
                      <Label>Vervaldatum *</Label>
                      <Input
                        required
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      />
                    </div>

                    <div>
                      <Label>BTW (%)</Label>
                      <Input
                        type="number"
                        value={formData.vatRate}
                        onChange={(e) => setFormData({ ...formData, vatRate: Number(e.target.value) })}
                        placeholder="21"
                      />
                    </div>

                    <div>
                      <Label>Opmerkingen</Label>
                      <textarea
                        className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent"
                        rows={4}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Aanvullende opmerkingen..."
                      />
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-700 border-b pb-2">Factuuritems</h3>

                  {items.map((item) => (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-end bg-gray-50 p-4 rounded-lg">
                      <div className="col-span-5">
                        <Label className="text-xs">Omschrijving</Label>
                        <Input
                          value={item.description}
                          onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                          placeholder="Dienstomschrijving"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Aantal</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Prijs (€)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(item.id, 'unitPrice', Number(e.target.value))}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Totaal</Label>
                        <div className="p-2 bg-white border rounded text-right font-mono">
                          €{item.total.toFixed(2)}
                        </div>
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          disabled={items.length === 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  <Button type="button" variant="outline" onClick={addItem} className="w-full">
                    <Plus className="w-4 h-4 mr-2" /> Item Toevoegen
                  </Button>
                </div>

                {/* Totals */}
                <div className="bg-gray-100 p-4 rounded-lg">
                  <div className="flex justify-between py-1">
                    <span>Subtotaal:</span>
                    <span className="font-mono">€{calculateTotals().subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>BTW ({formData.vatRate}%):</span>
                    <span className="font-mono">€{calculateTotals().vatAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-2 text-lg font-bold border-t">
                    <span>Totaal:</span>
                    <span className="font-mono text-brand-orange">€{calculateTotals().total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button type="submit" className="flex-1 bg-green-600 hover:bg-green-700">
                    <FileText className="w-4 h-4 mr-2" /> {editingId ? 'Factuur Bijwerken' : 'Factuur Maken'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Annuleren
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Invoices List */}
        <Card>
          <CardHeader>
            <CardTitle>Factuur Overzicht</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p>Nog geen factuur aangemaakt</p>
              </div>
            ) : (
              <div className="space-y-4">
                {invoices.slice().reverse().map((invoice) => (
                  <div key={invoice.id} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex-1 mb-4 md:mb-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-bold text-lg">{invoice.invoiceNumber}</span>
                        {getStatusBadge(invoice.status)}
                        <Badge variant={invoice.type === 'proforma' ? 'secondary' : 'default'}>
                          {invoice.type === 'proforma' ? 'Proforma' : 'Factuur'}
                        </Badge>
                      </div>
                      <p className="text-gray-600">{invoice.clientName} ({invoice.clientEmail})</p>
                      <p className="text-sm text-gray-500">
                        Datum: {invoice.date} | Vervaldatum: {invoice.dueDate}
                      </p>
                      <p className="font-mono font-semibold text-brand-blue mt-1">
                        €{invoice.total.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(invoice)}>
                        <Pencil className="w-4 h-4 mr-1" /> Bewerken
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => copyLink(invoice.id)}>
                        <Copy className="w-4 h-4 mr-1" /> Link
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => window.open(`#/invoice/${invoice.id}`, '_blank')}>
                        <Eye className="w-4 h-4 mr-1" /> Bekijken
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(invoice.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
