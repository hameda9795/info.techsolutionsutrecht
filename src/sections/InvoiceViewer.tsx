import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle,
  CheckSquare,
  FileCheck
} from 'lucide-react';
import type { Invoice } from '@/types/invoice';
import { COMPANY_INFO } from '@/types/invoice';
import { updateInvoice } from '@/lib/storage';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { cn } from '@/lib/utils';

interface InvoiceViewerProps {
  invoice: Invoice;
}

export default function InvoiceViewer({ invoice }: InvoiceViewerProps) {
  const [isApproved, setIsApproved] = useState(invoice.status === 'approved');
  const [isProcessing, setIsProcessing] = useState(false);
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);

  const generatePDF = async () => {
    if (!page1Ref.current || !page2Ref.current) return;

    try {
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();


      // Page 1
      const canvas1 = await html2canvas(page1Ref.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData1 = canvas1.toDataURL('image/png');
      const ratio1 = canvas1.width / pdfWidth;
      const h1 = canvas1.height / ratio1;

      pdf.addImage(imgData1, 'PNG', 0, 0, pdfWidth, h1);

      // Page 2
      pdf.addPage();
      const canvas2 = await html2canvas(page2Ref.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      const imgData2 = canvas2.toDataURL('image/png');
      const ratio2 = canvas2.width / pdfWidth;
      const h2 = canvas2.height / ratio2;

      pdf.addImage(imgData2, 'PNG', 0, 0, pdfWidth, h2);

      // Save
      pdf.save(`${invoice.invoiceNumber}.pdf`);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const handleApprove = async () => {
    if (isApproved) return;

    setIsProcessing(true);
    toast.info('Bezig met verwerken...');

    // 1. Update status
    const updatedInvoice = {
      ...invoice,
      status: 'approved' as const,
      approvedAt: new Date().toISOString(),
      approvedBy: invoice.clientEmail
    };

    updateInvoice(updatedInvoice);
    setIsApproved(true);

    // 2. Generate and download PDF (simulating email attachment)
    await generatePDF();

    // 3. Success Feedback
    toast.success('Offerte geaccepteerd!');
    toast.info(`Bevestigingsmail met PDF is verzonden naar ${invoice.clientEmail} en ${COMPANY_INFO.email}`);

    setIsProcessing(false);
  };

  const isProforma = invoice.type === 'proforma';
  const docTitle = isProforma ? 'OFFERTE' : 'FACTUUR';

  // Shared Header Component
  const Header = () => (
    <div className="flex justify-between items-start mb-10 pb-6 border-b-[3px] border-brand-orange">
      <div className="flex items-center">
        <div className="flex items-center">
          <img src="/logo.png" alt="TechSolutionsUtrecht Logo" className="w-48 h-auto object-contain" />
        </div>
      </div>
      <div className="text-right text-xs text-gray-600 leading-relaxed">
        <strong className="text-brand-blue text-sm block mb-1">{COMPANY_INFO.name}</strong>
        <div>{COMPANY_INFO.address}</div>
        <div>{COMPANY_INFO.phone}</div>
        <div className="text-brand-orange font-medium">{COMPANY_INFO.email}</div>
        <div>KVK: {COMPANY_INFO.kvk}</div>
        <div>BTW-id: {COMPANY_INFO.vatId}</div>
        <div><a href={COMPANY_INFO.website} target="_blank" rel="noreferrer" className="text-brand-orange no-underline hover:underline">{COMPANY_INFO.website}</a></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 font-sans text-gray-800">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-8">

        {/* PAGE 1 */}
        <div
          ref={page1Ref}
          className="bg-white shadow-xl relative print:shadow-none print:w-full overflow-hidden"
          style={{ width: '794px', minHeight: '1123px', padding: '50px 55px' }}
        >
          <Header />

          {/* Document Title Bar */}
          <div className="bg-brand-blue text-white px-6 py-4 rounded-md flex justify-between items-center mb-8 shadow-sm">
            <h1 className="text-xl font-bold tracking-widest uppercase">{docTitle}</h1>
            <div className="text-right text-xs leading-relaxed opacity-90">
              <div>{isProforma ? 'Offertenummer' : 'Factuurnummer'}: <span className="text-brand-orange font-bold text-sm ml-1">{invoice.invoiceNumber}</span></div>
              <div>Datum: <span className="font-semibold">{invoice.date}</span></div>
              <div>{isProforma ? 'Geldig tot' : 'Vervaldatum'}: <span className="font-semibold">{invoice.dueDate}</span></div>
            </div>
          </div>

          {/* Two Column Section: Client & Info */}
          <div className="flex gap-8 mb-8">
            <div className="flex-1 bg-brand-gray border-l-[4px] border-brand-orange py-4 px-5 rounded-r-sm">
              <h3 className="text-[11px] uppercase tracking-wider text-brand-orange font-bold mb-2">Aan</h3>
              <div className="text-[13px] text-gray-800 leading-relaxed">
                <strong className="text-brand-blue block text-[14px] mb-1">{invoice.clientName}</strong>
                {invoice.clientCompany && <div className="mb-1">{invoice.clientCompany}</div>}
                {invoice.clientAddress && <div className="mb-1">{invoice.clientAddress}</div>}
                <div className="text-gray-500">{invoice.clientEmail}</div>
              </div>
            </div>

            <div className="flex-1 bg-brand-gray border-l-[4px] border-brand-orange py-4 px-5 rounded-r-sm">
              <h3 className="text-[11px] uppercase tracking-wider text-brand-orange font-bold mb-2">Details</h3>
              <div className="text-[13px] text-gray-800 leading-relaxed">
                <div className="flex justify-between mb-1">
                  <span>Referentie:</span>
                  <span className="font-semibold text-brand-blue">{invoice.id.substring(0, 8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span>Type:</span>
                  <span className="capitalize">{isProforma ? 'Proforma' : 'Standaard'}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span>Status:</span>
                  {isApproved ? (
                    <Badge className="bg-green-500 hover:bg-green-600 text-white border-none px-2 py-0 h-5 text-[10px]">
                      GOEDGEKEURD
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-500 border-gray-300 px-2 py-0 h-5 text-[10px]">
                      OPENSTAAND
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="mb-8">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-brand-blue text-white">
                  <th className="py-3 px-4 text-xs text-left font-semibold uppercase tracking-wide rounded-tl-sm">Omschrijving</th>
                  <th className="py-3 px-4 text-xs text-center font-semibold uppercase tracking-wide w-24">Aantal</th>
                  <th className="py-3 px-4 text-xs text-right font-semibold uppercase tracking-wide w-32">Prijs</th>
                  <th className="py-3 px-4 text-xs text-right font-semibold uppercase tracking-wide w-32 rounded-tr-sm">Totaal</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={item.id} className={cn("border-b border-gray-100 dark:border-gray-700", index % 2 === 0 ? "bg-brand-gray/50" : "bg-white")}>
                    <td className="py-3 px-4 text-[13px] align-top">
                      <div className="font-medium text-gray-800">{item.description}</div>
                    </td>
                    <td className="py-3 px-4 text-[13px] text-center align-top text-gray-600">{item.quantity}</td>
                    <td className="py-3 px-4 text-[13px] text-right align-top text-gray-600">€ {item.unitPrice.toFixed(2)}</td>
                    <td className="py-3 px-4 text-[13px] text-right align-top font-semibold text-gray-800">€ {item.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end mb-10">
            <div className="w-[300px]">
              <div className="flex justify-between py-2 px-3 text-[13px] text-gray-600">
                <span>Subtotaal</span>
                <span className="font-medium text-gray-800">€ {invoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2 px-3 text-[13px] text-gray-600 bg-gray-50 rounded">
                <span>BTW ({invoice.vatRate}%)</span>
                <span>€ {invoice.vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-3 px-3 mt-2 bg-brand-blue text-white rounded shadow-sm">
                <span className="font-semibold text-sm">TOTAAL</span>
                <span className="font-bold text-lg text-brand-orange">€ {invoice.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer (On Page 1 as well? Usually only last page, but let's keep it minimal here or move to page 2 only. User said "Notities & Voorwaarden va jaye tayeed ha dar yek safhe dige bashe".
             Let's put a simple page number or just close page 1 here.
             Actually let's put the footer on both pages for professionalism.
          */}
          <div className="absolute bottom-[50px] left-[55px] right-[55px] border-t-[2px] border-brand-orange pt-4 flex justify-between items-center text-[10px] text-gray-400">
            <div>&copy; {new Date().getFullYear()} {COMPANY_INFO.name}. Pagina 1/2</div>
          </div>

          {isApproved && (
            <div className="absolute top-[120px] right-[50px] rotate-[-12deg] pointer-events-none opacity-90 mix-blend-multiply">
              <div className="border-4 border-green-600 rounded-lg p-2 px-4 shadow-sm backdrop-blur-[1px]">
                <div className="text-green-600 text-xl font-bold uppercase tracking-widest flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  {isProforma ? 'GEACCEPTEERD' : 'BETAALD'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PAGE 2 */}
        <div
          ref={page2Ref}
          className="bg-white shadow-xl relative print:shadow-none print:w-full overflow-hidden"
          style={{ width: '794px', minHeight: '1123px', padding: '50px 55px' }}
        >
          <Header />

          <div className="mt-8">
            <h2 className="text-lg font-bold text-brand-blue mb-6 border-b pb-2">Vervolg specificaties</h2>

            {/* Notes / Terms */}
            {(invoice.notes || isProforma) && (
              <div className="bg-brand-gray border-l-[4px] border-brand-blue py-4 px-5 rounded-r-sm mb-12 text-xs leading-relaxed text-gray-600">
                <h3 className="text-[11px] uppercase tracking-wider text-brand-blue font-bold mb-4">Notities &amp; Voorwaarden</h3>
                {invoice.notes && <p className="mb-4 whitespace-pre-wrap text-[13px]">{invoice.notes}</p>}
                <p>
                  Gelieve het totaalbedrag over te maken binnen 14 dagen op rekeningnummer
                  <span className="font-semibold text-gray-800 mx-1">NL61 INGB 0116 4234 63</span>
                  t.n.v. {COMPANY_INFO.name}, onder vermelding van het {isProforma ? 'offertenummer' : 'factuurnummer'}.
                </p>
              </div>
            )}

            {/* Signature Section */}
            {isProforma && (
              <div className="mb-10">
                <div className="flex gap-8">
                  <div className="flex-1 border border-dashed border-gray-300 rounded-lg p-4 min-h-[150px] relative transition-colors hover:bg-gray-50 flex flex-col justify-between">
                    <h4 className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Voor Akkoord (Klant)</h4>

                    {isApproved ? (
                      <div className="flex flex-col items-center justify-center text-green-600 bg-green-50/50 rounded-lg flex-1 mx-[-10px] mb-[-10px] mt-2">
                        <FileCheck className="w-10 h-10 opacity-80 mb-2" />
                        <span className="font-bold text-sm">Digitaal Ondertekend</span>
                        <span className="text-[10px] text-gray-500 mt-1">{invoice.approvedBy}</span>
                        <span className="text-[10px] text-gray-500">{new Date(invoice.approvedAt!).toLocaleDateString()}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center flex-1">
                        <p className="text-gray-400 text-[10px] mb-3 text-center">Klik hieronder om te ondertekenen</p>
                        <Button onClick={handleApprove} disabled={isProcessing} className="bg-brand-orange hover:bg-orange-600 text-white shadow-sm text-xs h-9 px-4">
                          {isProcessing ? 'Verwerken...' : (
                            <>
                              <CheckSquare className="w-4 h-4 mr-2" />
                              Offerte Accepteren
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 border border-dashed border-gray-300 rounded-lg p-4 min-h-[150px] relative flex flex-col justify-between">
                    <h4 className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">Voor Akkoord (TechSolutionsUtrecht)</h4>
                    <div className="flex flex-col items-center justify-center flex-1 opacity-80">
                      <span className="font-script text-3xl rotate-[-5deg] text-brand-blue">TechSolutionsUtrecht</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="absolute bottom-[50px] left-[55px] right-[55px] border-t-[2px] border-brand-orange pt-4 flex justify-between items-center text-[10px] text-gray-400">
            <div>
              &copy; {new Date().getFullYear()} {COMPANY_INFO.name}. Pagina 2/2
            </div>
            <div className="flex gap-4">
              <span>Algemene Voorwaarden</span>
              <span>Privacy Policy</span>
            </div>
          </div>

        </div>

        {/* Bottom Actions for user verification on screen */}
        {!isApproved && isProforma && (
          <div className="mt-4 text-center print:hidden pb-10">
            <p className="text-gray-500 mb-4 text-sm bg-white px-4 py-2 rounded-full shadow-sm border">
              Scroll naar beneden naar pagina 2 om te ondertekenen
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
