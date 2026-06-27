import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, FolderKanban, ChevronRight } from 'lucide-react';
import type { Client, Project } from '@/types';
import { getAllClients, getAllProjects, saveProject, generateId } from '@/lib/db';
import { toast } from 'sonner';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: '', name: '', description: '' });

  const load = async () => {
    setProjects(await getAllProjects());
    setClients(await getAllClients());
  };
  useEffect(() => {
    load();
  }, []);

  const clientName = (id: string) =>
    clients.find((c) => c.id === id)?.name ?? 'Onbekende klant';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientId) {
      toast.error('Kies een klant');
      return;
    }
    const project: Project = {
      id: generateId(),
      clientId: form.clientId,
      name: form.name,
      description: form.description,
      createdAt: new Date().toISOString(),
    };
    await saveProject(project);
    toast.success('Project aangemaakt');
    setOpen(false);
    setForm({ clientId: '', name: '', description: '' });
    navigate(`/projects/${project.id}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projecten</h1>
          <p className="text-gray-500">Klantdossiers en bijbehorende documenten</p>
        </div>
        <Button
          onClick={() => setOpen(true)}
          className="bg-brand-blue hover:bg-blue-900"
          disabled={clients.length === 0}
          title={clients.length === 0 ? 'Maak eerst een klant aan' : undefined}
        >
          <Plus className="w-4 h-4 mr-2" /> Nieuw project
        </Button>
      </div>

      {clients.length === 0 && (
        <Card className="mb-4 border-brand-orange/40 bg-brand-orange/5">
          <CardContent className="py-4 text-sm text-gray-700">
            Je hebt nog geen klanten. Maak eerst een klant aan onder{' '}
            <button className="underline" onClick={() => navigate('/clients')}>
              Klanten
            </button>
            .
          </CardContent>
        </Card>
      )}

      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <FolderKanban className="w-12 h-12 mx-auto mb-3 opacity-30" />
            Nog geen projecten.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="font-semibold text-gray-900">{p.name}</div>
                  <div className="text-sm text-gray-500">{clientName(p.clientId)}</div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuw project</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>Klant *</Label>
              <Select
                value={form.clientId}
                onValueChange={(v) => setForm({ ...form, clientId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Kies een klant" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                      {c.company ? ` — ${c.company}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Projectnaam *</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Bijv. Website Arix-schildersbedrijf"
              />
            </div>
            <div>
              <Label>Omschrijving</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="bg-brand-blue hover:bg-blue-900">
                Aanmaken
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
