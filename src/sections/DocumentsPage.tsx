import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Client, Document, DocumentType, Project } from '@/types';
import { documentTypeLabel } from '@/types';
import { getAllDocuments, getAllProjects, getAllClients } from '@/lib/db';
import { formatEUR } from '@/lib/calc';
import { displayStatus } from '@/lib/documents';
import { statusBadge } from '@/components/statusBadge';

const FILTERS: { label: string; value: 'ALL' | DocumentType }[] = [
  { label: 'Alle', value: 'ALL' },
  { label: 'Offertes', value: 'OFFERTE' },
  { label: 'Proforma', value: 'PROFORMA' },
  { label: 'Facturen', value: 'INVOICE' },
  { label: "Creditnota's", value: 'CREDIT_NOTE' },
];

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [filter, setFilter] = useState<'ALL' | DocumentType>('ALL');

  useEffect(() => {
    (async () => {
      setDocuments(await getAllDocuments());
      setProjects(await getAllProjects());
      setClients(await getAllClients());
    })();
  }, []);

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? '—';
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? '—';

  const shown = documents
    .filter((d) => filter === 'ALL' || d.documentType === filter)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documenten</h1>
          <p className="text-gray-500">Alle offertes, proforma's, facturen en creditnota's</p>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as 'ALL' | DocumentType)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {shown.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            Geen documenten.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {shown.map((d) => (
            <Card key={d.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-semibold text-gray-900 w-32">
                    {d.documentNumber ?? 'Concept'}
                  </span>
                  <span className="text-sm text-gray-600">
                    {documentTypeLabel(d.documentType, d.invoiceSubtype)}
                  </span>
                  {statusBadge(displayStatus(d))}
                  <span className="text-sm text-gray-400">
                    {clientName(d.clientId)} · {projectName(d.projectId)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono font-semibold text-brand-blue">
                    {formatEUR(d.totalInclBtw)}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/documents/${d.id}`)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
