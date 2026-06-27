import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Users } from 'lucide-react';
import type { Client } from '@/types';
import {
  getAllClients,
  saveClient,
  deleteClient,
  getProjectsByClient,
  generateId,
} from '@/lib/db';
import { toast } from 'sonner';

const empty = (): Client => ({
  id: '',
  name: '',
  email: '',
  company: '',
  address: '',
  kvk: '',
  createdAt: '',
});

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Client>(empty());

  const load = async () => setClients(await getAllClients());
  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setForm(empty());
    setOpen(true);
  };
  const openEdit = (c: Client) => {
    setForm(c);
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const record: Client = {
      ...form,
      id: form.id || generateId(),
      createdAt: form.createdAt || new Date().toISOString(),
    };
    await saveClient(record);
    toast.success('Klant opgeslagen');
    setOpen(false);
    load();
  };

  const remove = async (c: Client) => {
    const projects = await getProjectsByClient(c.id);
    if (projects.length > 0) {
      toast.error('Klant heeft nog projecten. Verwijder eerst de projecten.');
      return;
    }
    if (!confirm(`Klant "${c.name}" verwijderen?`)) return;
    await deleteClient(c.id);
    toast.success('Klant verwijderd');
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Klanten</h1>
          <p className="text-gray-500">Beheer je klantgegevens</p>
        </div>
        <Button onClick={openNew} className="bg-brand-blue hover:bg-blue-900">
          <Plus className="w-4 h-4 mr-2" /> Nieuwe klant
        </Button>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            Nog geen klanten.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {clients.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="font-semibold text-gray-900">{c.name}</div>
                  {c.company && <div className="text-sm text-gray-600">{c.company}</div>}
                  <div className="text-sm text-gray-500">{c.email}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => remove(c)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Klant bewerken' : 'Nieuwe klant'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Naam *</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Bedrijf</Label>
              <Input
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />
            </div>
            <div>
              <Label>Adres</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div>
              <Label>KVK</Label>
              <Input
                value={form.kvk}
                onChange={(e) => setForm({ ...form, kvk: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="bg-brand-blue hover:bg-blue-900">
                Opslaan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
