import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Download, ArrowLeft, Loader2 } from 'lucide-react';
import type { Client, Document, Project } from '@/types';
import { COMPANY_INFO, documentPdfTitle, documentTypeLabel } from '@/types';
import { getDocument, getClient, getProject } from '@/lib/db';
import { applyAdvances, formatEUR } from '@/lib/calc';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const A4: React.CSSProperties = {
  width: '794px',
  minHeight: '1123px',
  padding: '38px 50px 80px 50px',
};

const Header = () => (
  <div className="flex justify-between items-start mb-4 pb-4 border-b-[3px] border-brand-orange">
    <img src="/logo.png" alt="Logo" className="w-40 h-auto object-contain" />
    <div className="text-right text-[11px] text-gray-600 leading-relaxed">
      <strong className="text-brand-blue text-sm block mb-1">{COMPANY_INFO.name}</strong>
      <div>{COMPANY_INFO.address}</div>
      <div>{COMPANY_INFO.phone}</div>
      <div className="text-brand-orange font-medium">{COMPANY_INFO.email}</div>
      <div>KVK: {COMPANY_INFO.kvk}</div>
      <div>BTW-id: {COMPANY_INFO.vatId}</div>
    </div>
  </div>
);

const Footer = ({ text }: { text: string }) => (
  <div className="absolute bottom-[40px] left-[50px] right-[50px] border-t-[2px] border-brand-orange pt-3 text-[10px] text-gray-400">
    {text}
  </div>
);

export default function DocumentViewer() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);
  const [docu, setDocu] = useState<Document | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) return;
      const d = await getDocument(id);
      setDocu(d ?? null);
      if (d) {
        setClient((await getClient(d.clientId)) ?? null);
        setProject((await getProject(d.projectId)) ?? null);
      }
      setLoading(false);
    })();
  }, [id]);

  const addPage = async (pdf: jsPDF, el: HTMLDivElement, first: boolean) => {
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    const img = canvas.toDataURL('image/png');
    // Fit the whole page within one A4 (scale by the smaller ratio so nothing is clipped).
    const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    const x = (pageW - w) / 2;
    if (!first) pdf.addPage();
    pdf.addImage(img, 'PNG', x, 0, w, h);
  };

  const generatePDF = async () => {
    if (!page1Ref.current || !docu) return;
    const pdf = new jsPDF('p', 'mm', 'a4');
    await addPage(pdf, page1Ref.current, true);
    if (docu.notes && page2Ref.current) {
      await addPage(pdf, page2Ref.current, false);
    }
    pdf.save(`${docu.documentNumber ?? 'concept'}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-brand-blue" />
      </div>
    );
  }
  if (!docu || !client) {
    return <div className="text-center py-20 text-gray-500">Document niet gevonden.</div>;
  }

  const isProforma = docu.documentType === 'PROFORMA';
  const isCredit = docu.documentType === 'CREDIT_NOTE';
  const isEindfactuur = docu.documentType === 'INVOICE' && docu.invoiceSubtype === 'EINDFACTUUR';
  const title = documentPdfTitle(docu.documentType, docu.invoiceSubtype);
  const hasNotes = !!docu.notes;
  const numberLabel =
    docu.documentType === 'OFFERTE'
      ? 'Offertenummer'
      : isCredit
        ? 'Creditnotanummer'
        : 'Factuurnummer';
  const dateLabel = docu.documentType === 'OFFERTE' || isProforma ? 'Geldig tot' : 'Vervaldatum';

  const settlement =
    isEindfactuur && docu.settledAdvances && docu.settledAdvances.length > 0
      ? applyAdvances(
          {
            subtotalExclBtw: docu.subtotalExclBtw,
            btwAmount: docu.btwAmount,
            totalInclBtw: docu.totalInclBtw,
            btwPercentage: docu.btwPercentage,
          },
          docu.settledAdvances
        )
      : null;

  const typeLabel = documentTypeLabel(docu.documentType, docu.invoiceSubtype);
  const numberText = docu.documentNumber ? ` ${docu.documentNumber}` : ' (concept)';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
        >
          <ArrowLeft className="w-4 h-4" /> Terug
        </button>
        <Button onClick={generatePDF} className="bg-brand-blue hover:bg-blue-900">
          <Download className="w-4 h-4 mr-2" /> Download PDF
        </Button>
      </div>

      <div className="flex flex-col items-center gap-6">
        {/* PAGE 1 */}
        <div ref={page1Ref} className="bg-white shadow-xl relative overflow-hidden text-gray-800" style={A4}>
          <Header />

          {/* Title bar */}
          <div className="bg-brand-blue text-white px-5 py-3 rounded-md flex justify-between items-center mb-3">
            <h1 className="text-lg font-bold tracking-widest uppercase">{title}</h1>
            <div className="text-right text-[11px] leading-relaxed opacity-90">
              <div>
                {numberLabel}:{' '}
                <span className="text-brand-orange font-bold text-sm ml-1">
                  {docu.documentNumber ?? 'CONCEPT'}
                </span>
              </div>
              <div>
                Datum: <span className="font-semibold">{docu.issueDate}</span>
              </div>
              {docu.dueDate && (
                <div>
                  {dateLabel}: <span className="font-semibold">{docu.dueDate}</span>
                </div>
              )}
            </div>
          </div>

          {/* Proforma / credit notices */}
          {isProforma && (
            <div className="bg-amber-50 border border-amber-300 text-amber-800 text-[11px] rounded-md px-4 py-2 mb-4">
              <strong>PROFORMA FACTUUR — Geen officiële btw-factuur.</strong> Niet gebruiken voor
              btw-aangifte.
            </div>
          )}
          {isCredit && docu.reason && (
            <div className="bg-purple-50 border border-purple-200 text-purple-800 text-[11px] rounded-md px-4 py-2 mb-4">
              Reden: {docu.reason}
            </div>
          )}

          {/* Client + details */}
          <div className="flex gap-6 mb-4">
            <div className="flex-1 bg-brand-gray border-l-[4px] border-brand-orange py-3 px-4 rounded-r-sm">
              <h3 className="text-[10px] uppercase tracking-wider text-brand-orange font-bold mb-2">Aan</h3>
              <div className="text-[12px] leading-relaxed">
                <strong className="text-brand-blue block text-[13px] mb-1">{client.name}</strong>
                {client.company && <div>{client.company}</div>}
                {client.address && <div>{client.address}</div>}
                {client.kvk && <div className="text-gray-500">KVK: {client.kvk}</div>}
                <div className="text-gray-500">{client.email}</div>
              </div>
            </div>
            <div className="flex-1 bg-brand-gray border-l-[4px] border-brand-orange py-3 px-4 rounded-r-sm">
              <h3 className="text-[10px] uppercase tracking-wider text-brand-orange font-bold mb-2">Details</h3>
              <div className="text-[12px] leading-relaxed">
                {project && (
                  <div className="flex justify-between mb-0.5">
                    <span>Project:</span>
                    <span className="font-semibold text-brand-blue">{project.name}</span>
                  </div>
                )}
                <div className="flex justify-between mb-0.5">
                  <span>Type:</span>
                  <span>{typeLabel}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items table */}
          <table className="w-full border-collapse mb-4">
            <thead>
              <tr className="bg-brand-blue text-white">
                <th className="py-2 px-3 text-[11px] text-left font-semibold uppercase rounded-tl-sm">Omschrijving</th>
                <th className="py-2 px-3 text-[11px] text-center font-semibold uppercase w-16">Aantal</th>
                <th className="py-2 px-3 text-[11px] text-right font-semibold uppercase w-24">Prijs excl.</th>
                <th className="py-2 px-3 text-[11px] text-center font-semibold uppercase w-16">BTW</th>
                <th className="py-2 px-3 text-[11px] text-right font-semibold uppercase w-28 rounded-tr-sm">Totaal excl.</th>
              </tr>
            </thead>
            <tbody>
              {docu.items.map((it, i) => (
                <tr key={it.id} className={i % 2 === 0 ? 'bg-brand-gray/50' : 'bg-white'}>
                  <td className="py-2 px-3 text-[12px] align-top font-medium">{it.description}</td>
                  <td className="py-2 px-3 text-[12px] text-center align-top text-gray-600">{it.quantity}</td>
                  <td className="py-2 px-3 text-[12px] text-right align-top text-gray-600">{formatEUR(it.unitPriceExclBtw)}</td>
                  <td className="py-2 px-3 text-[12px] text-center align-top text-gray-600">{it.btwPercentage}%</td>
                  <td className="py-2 px-3 text-[12px] text-right align-top font-semibold">{formatEUR(it.lineTotalExclBtw)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-4">
            <div className="w-[320px] text-[12px]">
              <div className="flex justify-between py-1.5 px-3 text-gray-600">
                <span>Subtotaal excl. btw</span>
                <span className="font-medium">{formatEUR(docu.subtotalExclBtw)}</span>
              </div>
              <div className="flex justify-between py-1.5 px-3 text-gray-600 bg-gray-50 rounded">
                <span>BTW</span>
                <span>{formatEUR(docu.btwAmount)}</span>
              </div>
              <div className="flex justify-between py-2 px-3 mt-1.5 bg-brand-blue text-white rounded">
                <span className="font-semibold text-xs">TOTAAL INCL. BTW</span>
                <span className="font-bold text-sm text-brand-orange">{formatEUR(docu.totalInclBtw)}</span>
              </div>

              {settlement && (
                <div className="mt-3 border-t pt-2">
                  {docu.settledAdvances!.map((a) => (
                    <div key={a.documentId} className="flex justify-between py-1 px-3 text-red-600">
                      <span>Reeds betaald via factuur {a.number}</span>
                      <span>- {formatEUR(a.inclBtw)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 px-3 mt-1.5 bg-brand-orange text-white rounded">
                    <span className="font-semibold text-xs">NOG TE BETALEN</span>
                    <span className="font-bold text-sm">{formatEUR(settlement.nogTeBetalenInclBtw)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Eindfactuur: detailed accounting table */}
          {settlement && (
            <div className="mb-6 text-[11px] border rounded-md overflow-hidden">
              <div className="bg-gray-100 px-3 py-1.5 font-semibold text-gray-700">Boekhoudkundige specificatie</div>
              <table className="w-full">
                <tbody>
                  <Row label="Totaal excl. btw" value={formatEUR(settlement.totalExclBtw)} />
                  <Row label="BTW" value={formatEUR(settlement.totalBtw)} />
                  <Row label="Totaal incl. btw" value={formatEUR(settlement.totalInclBtw)} bold />
                  <Row label="Aanbetaling excl. btw" value={`- ${formatEUR(settlement.reedsBetaaldExclBtw)}`} red />
                  <Row label="BTW aanbetaling" value={`- ${formatEUR(settlement.reedsBetaaldBtw)}`} red />
                  <Row label="Reeds betaald incl. btw" value={`- ${formatEUR(settlement.reedsBetaaldInclBtw)}`} red />
                  <Row label="Nog te betalen incl. btw" value={formatEUR(settlement.nogTeBetalenInclBtw)} bold />
                </tbody>
              </table>
            </div>
          )}

          <Footer
            text={`© ${new Date().getFullYear()} ${COMPANY_INFO.name} · ${typeLabel}${numberText} — Pagina 1${hasNotes ? '/2' : ''}`}
          />
        </div>

        {/* PAGE 2 — Opmerkingen */}
        {hasNotes && (
          <div ref={page2Ref} className="bg-white shadow-xl relative overflow-hidden text-gray-800" style={A4}>
            <Header />
            <div className="mt-6">
              <h2 className="text-lg font-bold text-brand-blue mb-5 border-b pb-2">Opmerkingen</h2>
              <div className="bg-brand-gray border-l-[4px] border-brand-blue py-5 px-5 rounded-r-sm text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                {docu.notes}
              </div>
            </div>
            <Footer
              text={`© ${new Date().getFullYear()} ${COMPANY_INFO.name} · ${typeLabel}${numberText} — Pagina 2/2`}
            />
          </div>
        )}
      </div>
    </div>
  );
}

const Row = ({
  label,
  value,
  bold,
  red,
}: {
  label: string;
  value: string;
  bold?: boolean;
  red?: boolean;
}) => (
  <tr className="border-t">
    <td className={`px-3 py-1.5 ${bold ? 'font-semibold' : ''} ${red ? 'text-red-600' : 'text-gray-600'}`}>
      {label}
    </td>
    <td className={`px-3 py-1.5 text-right font-mono ${bold ? 'font-semibold' : ''} ${red ? 'text-red-600' : ''}`}>
      {value}
    </td>
  </tr>
);
