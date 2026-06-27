import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  FileMinus,
  Loader2,
} from 'lucide-react';
import type {
  Client,
  Document,
  DocumentType,
  InvoiceSubtype,
  Payment,
  Project,
} from '@/types';
import { documentTypeLabel } from '@/types';
import {
  getProject,
  getClient,
  getDocumentsByProject,
  getPaymentsByProject,
  deleteDocument,
  deletePayment,
  deleteProject,
} from '@/lib/db';
import { finalizeDocument, displayStatus } from '@/lib/documents';
import { canDelete, isLocked } from '@/lib/lock';
import { formatEUR } from '@/lib/calc';
import { toast } from 'sonner';
import DocumentForm from '@/components/DocumentForm';
import PaymentDialog from '@/components/PaymentDialog';
import { statusBadge } from '@/components/statusBadge';

interface FormState {
  documentType: DocumentType;
  invoiceSubtype?: InvoiceSubtype;
  existing?: Document | null;
  originalInvoice?: Document | null;
}

export default function ProjectDossier() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [formState, setFormState] = useState<FormState | null>(null);
  const [paymentDoc, setPaymentDoc] = useState<Document | null>(null);
  // Prevents a double-click on "Definitief" from burning two invoice numbers.
  const finalizingRef = useRef(false);

  const load = useCallback(async () => {
    if (!id) return;
    const p = await getProject(id);
    setProject(p ?? null);
    if (p) setClient((await getClient(p.clientId)) ?? null);
    setDocuments(await getDocumentsByProject(id));
    setPayments(await getPaymentsByProject(id));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }

  if (!project || !client) {
    return (
      <div className="text-center py-20 text-gray-500">
        Project niet gevonden.{' '}
        <button className="underline" onClick={() => navigate('/')}>
          Terug
        </button>
      </div>
    );
  }

  const byType = (t: DocumentType) => documents.filter((d) => d.documentType === t);
  // Paid aanbetalingsfacturen available to settle on an eindfactuur.
  const availableAdvances = documents.filter(
    (d) =>
      d.documentType === 'INVOICE' &&
      d.invoiceSubtype === 'AANBETALING' &&
      d.documentNumber
  );

  const openstaand = documents
    .filter(
      (d) =>
        d.documentType === 'INVOICE' &&
        ['sent', 'partially_paid', 'overdue'].includes(d.status)
    )
    .reduce((s, d) => s + d.remainingAmount, 0);

  const finalize = async (d: Document) => {
    if (finalizingRef.current) return;
    if (!confirm('Document definitief maken? Hierna krijgt het een vast nummer en kan het niet meer worden gewijzigd.'))
      return;
    finalizingRef.current = true;
    try {
      const updated = await finalizeDocument(d);
      toast.success(`Definitief: ${updated.documentNumber}`);
      await load();
    } catch (err) {
      toast.error((err as Error).message ?? 'Definitief maken mislukt');
    } finally {
      finalizingRef.current = false;
    }
  };

  const remove = async (d: Document) => {
    if (!canDelete(d)) {
      toast.error('Definitieve documenten kunnen niet worden verwijderd. Maak een creditnota.');
      return;
    }
    if (!confirm('Concept verwijderen?')) return;
    await deleteDocument(d.id);
    toast.success('Verwijderd');
    load();
  };

  const startCreditNote = (invoice: Document) => {
    setFormState({ documentType: 'CREDIT_NOTE', originalInvoice: invoice });
  };

  const removeProject = async () => {
    const numbered = documents.filter((d) => d.documentNumber);
    if (numbered.length > 0) {
      toast.error(
        'Dit project bevat definitieve documenten en kan niet worden verwijderd. Corrigeer via een creditnota.'
      );
      return;
    }
    if (
      !confirm(
        `Project "${project!.name}" verwijderen? Alle concepten en betalingen van dit project worden ook verwijderd.`
      )
    )
      return;
    for (const d of documents) await deleteDocument(d.id);
    for (const p of payments) await deletePayment(p.id);
    await deleteProject(project!.id);
    toast.success('Project verwijderd');
    navigate('/');
  };

  const DocSection = ({ title, type }: { title: string; type: DocumentType }) => {
    const list = byType(type);
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="text-sm text-gray-400">Nog geen documenten.</p>
          ) : (
            <div className="space-y-2">
              {list.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-2 border rounded-lg p-3"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-gray-900">
                      {d.documentNumber ?? 'Concept'}
                    </span>
                    <span className="text-sm text-gray-500">
                      {documentTypeLabel(d.documentType, d.invoiceSubtype)}
                    </span>
                    {statusBadge(displayStatus(d))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-brand-blue mr-2">
                      {formatEUR(d.totalInclBtw)}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => navigate(`/documents/${d.id}`)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    {!isLocked(d) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFormState({ documentType: d.documentType, invoiceSubtype: d.invoiceSubtype, existing: d })}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    {!isLocked(d) && (
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => finalize(d)}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Definitief
                      </Button>
                    )}
                    {d.documentType === 'INVOICE' && isLocked(d) && d.status !== 'credited' && (
                      <Button variant="outline" size="sm" onClick={() => startCreditNote(d)}>
                        <FileMinus className="w-4 h-4 mr-1" /> Creditnota
                      </Button>
                    )}
                    {canDelete(d) && (
                      <Button variant="destructive" size="sm" onClick={() => remove(d)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="w-4 h-4" /> Projecten
        </button>
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 border-red-200 hover:bg-red-50"
          onClick={removeProject}
        >
          <Trash2 className="w-4 h-4 mr-1" /> Project verwijderen
        </Button>
      </div>

      {/* Header / dossier info */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardContent className="p-5">
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            {project.description && (
              <p className="text-gray-500 mt-1">{project.description}</p>
            )}
            <div className="mt-4 text-sm text-gray-700">
              <div className="font-semibold text-brand-blue">{client.name}</div>
              {client.company && <div>{client.company}</div>}
              {client.address && <div>{client.address}</div>}
              {client.kvk && <div className="text-gray-500">KVK: {client.kvk}</div>}
              <div className="text-gray-500">{client.email}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-brand-blue text-white">
          <CardContent className="p-5">
            <div className="text-sm text-white/70">Openstaand bedrag</div>
            <div className="text-3xl font-bold mt-2">{formatEUR(openstaand)}</div>
            <div className="text-xs text-white/60 mt-2">
              {payments.length} betaling(en) geregistreerd
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setFormState({ documentType: 'OFFERTE' })}>
          Nieuwe offerte
        </Button>
        <Button variant="outline" onClick={() => setFormState({ documentType: 'PROFORMA' })}>
          Nieuwe proforma
        </Button>
        <Button
          variant="outline"
          onClick={() => setFormState({ documentType: 'INVOICE', invoiceSubtype: 'AANBETALING' })}
        >
          Nieuwe aanbetalingsfactuur
        </Button>
        <Button
          variant="outline"
          onClick={() => setFormState({ documentType: 'INVOICE', invoiceSubtype: 'EINDFACTUUR' })}
        >
          Nieuwe eindfactuur
        </Button>
        <Button
          variant="outline"
          onClick={() => setFormState({ documentType: 'INVOICE', invoiceSubtype: 'NORMAL' })}
        >
          Nieuwe factuur
        </Button>
        <Button className="bg-brand-orange hover:bg-orange-600" onClick={() => {
          const invoices = documents.filter((d) => d.documentType === 'INVOICE' && d.documentNumber);
          if (invoices.length === 0) {
            toast.error('Er is nog geen definitieve factuur om een betaling aan te koppelen.');
            return;
          }
          setPaymentDoc(invoices[0]);
        }}>
          Betaling toevoegen
        </Button>
      </div>

      {/* Document sections */}
      <div className="grid gap-4">
        <DocSection title="Offertes" type="OFFERTE" />
        <DocSection title="Proforma facturen" type="PROFORMA" />
        <DocSection title="Facturen" type="INVOICE" />
        <DocSection title="Creditnota's" type="CREDIT_NOTE" />
      </div>

      {/* Payments */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Betalingen</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-gray-400">Nog geen betalingen.</p>
          ) : (
            <div className="space-y-2">
              {payments
                .slice()
                .sort((a, b) => a.paymentDate.localeCompare(b.paymentDate))
                .map((pay) => {
                  const linked = documents.find((d) => d.id === pay.documentId);
                  return (
                    <div
                      key={pay.id}
                      className="flex items-center justify-between border rounded-lg p-3 text-sm"
                    >
                      <div>
                        <span className="font-mono font-semibold">{formatEUR(pay.amount)}</span>
                        <span className="text-gray-500 ml-3">{pay.paymentDate}</span>
                        {pay.paymentMethod && (
                          <span className="text-gray-400 ml-3">{pay.paymentMethod}</span>
                        )}
                      </div>
                      <div className="text-gray-500">
                        {linked?.documentNumber ?? 'factuur'}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      {formState && (
        <DocumentForm
          open={!!formState}
          onOpenChange={(v) => !v && setFormState(null)}
          project={project}
          client={client}
          documentType={formState.documentType}
          invoiceSubtype={formState.invoiceSubtype}
          existing={formState.existing}
          originalInvoice={formState.originalInvoice}
          availableAdvances={availableAdvances}
          onSaved={() => {
            setFormState(null);
            load();
          }}
        />
      )}

      {paymentDoc && (
        <PaymentDialog
          open={!!paymentDoc}
          onOpenChange={(v) => !v && setPaymentDoc(null)}
          invoices={documents.filter((d) => d.documentType === 'INVOICE' && d.documentNumber)}
          initialDoc={paymentDoc}
          onSaved={() => {
            setPaymentDoc(null);
            load();
          }}
        />
      )}
    </div>
  );
}
