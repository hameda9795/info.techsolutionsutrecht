import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { Invoice } from '@/types/invoice';
import { COMPANY_INFO } from '@/types/invoice';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { cn } from '@/lib/utils';

interface InvoiceViewerProps {
  invoice: Invoice;
}

export default function InvoiceViewer({ invoice }: InvoiceViewerProps) {
  const page1Ref = useRef<HTMLDivElement>(null);
  const page2Ref = useRef<HTMLDivElement>(null);

  const generatePDF = async () => {
    if (!page1Ref.current) return;

    try {
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

      // Page 2 (only if notes exist)
      if (invoice.notes && page2Ref.current) {
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
      }

      pdf.save(`${invoice.invoiceNumber}.pdf`);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  const isProforma = invoice.type === 'proforma';
  const docTitle = isProforma ? 'OFFERTE' : 'FACTUUR';

  const Header = () => (
    <div className="flex justify-between items-start mb-6 pb-4 border-b-[3px] border-brand-orange">
      <div className="flex items-center">
        <img src="/logo.png" alt="TechSolutionsUtrecht Logo" className="w-40 h-auto object-contain" />
      </div>
      <div className="text-right text-[11px] text-gray-600 leading-relaxed">
        <strong className="text-brand-blue text-sm block mb-1">{COMPANY_INFO.name}</strong>
        <div>{COMPANY_INFO.address}</div>
        <div>{COMPANY_INFO.phone}</div>
        <div className="text-brand-orange font-medium">{COMPANY_INFO.email}</div>
        <div>KVK: {COMPANY_INFO.kvk}</div>
        <div>BTW-id: {COMPANY_INFO.vatId}</div>
        <div>
          <a href={COMPANY_INFO.website} target="_blank" rel="noreferrer" className="text-brand-orange no-underline hover:underline">
            {COMPANY_INFO.website}
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4 font-sans text-gray-800">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-6">

        {/* Download Button */}
        <div className="print:hidden w-full max-w-[794px] flex justify-end">
          <Button onClick={generatePDF} className="bg-brand-blue hover:bg-blue-900 shadow-md">
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>

        {/* PAGE 1 - Invoice */}
        <div
          ref={page1Ref}
          className="bg-white shadow-xl relative print:shadow-none print:w-full overflow-hidden"
          style={{ width: '794px', minHeight: '1123px', padding: '45px 50px' }}
        >
          <Header />

          {/* Document Title Bar */}
          <div className="bg-brand-blue text-white px-5 py-3 rounded-md flex justify-between items-center mb-6 shadow-sm">
            <h1 className="text-lg font-bold tracking-widest uppercase">{docTitle}</h1>
            <div className="text-right text-[11px] leading-relaxed opacity-90">
              <div>
                {isProforma ? 'Offertenummer' : 'Factuurnummer'}:{" "}
                <span className="text-brand-orange font-bold text-sm ml-1">{invoice.invoiceNumber}</span>
              </div>
              <div>
                Datum: <span className="font-semibold">{invoice.date}</span>
              </div>
              <div>
                {isProforma ? 'Geldig tot' : 'Vervaldatum'}:{" "}
                <span className="font-semibold">{invoice.dueDate}</span>
              </div>
            </div>
          </div>

          {/* Two Column Section: Client & Info */}
          <div className="flex gap-6 mb-6">
            <div className="flex-1 bg-brand-gray border-l-[4px] border-brand-orange py-3 px-4 rounded-r-sm">
              <h3 className="text-[10px] uppercase tracking-wider text-brand-orange font-bold mb-2">Aan</h3>
              <div className="text-[12px] text-gray-800 leading-relaxed">
                <strong className="text-brand-blue block text-[13px] mb-1">{invoice.clientName}</strong>
                {invoice.clientCompany && <div className="mb-0.5">{invoice.clientCompany}</div>}
                {invoice.clientAddress && <div className="mb-0.5">{invoice.clientAddress}</div>}
                {invoice.clientKvk && <div className="mb-0.5 text-gray-500">KVK: {invoice.clientKvk}</div>}
                <div className="text-gray-500">{invoice.clientEmail}</div>
              </div>
            </div>

            <div className="flex-1 bg-brand-gray border-l-[4px] border-brand-orange py-3 px-4 rounded-r-sm">
              <h3 className="text-[10px] uppercase tracking-wider text-brand-orange font-bold mb-2">Details</h3>
              <div className="text-[12px] text-gray-800 leading-relaxed">
                <div className="flex justify-between mb-0.5">
                  <span>Referentie:</span>
                  <span className="font-semibold text-brand-blue">{invoice.id.substring(0, 8).toUpperCase()}</span>
                </div>
                <div className="flex justify-between mb-0.5">
                  <span>Type:</span>
                  <span className="capitalize">{isProforma ? 'Proforma' : 'Standaard'}</span>
                </div>
                <div className="flex justify-between mb-0.5">
                  <span>BTW:</span>
                  <span>{invoice.vatRate}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="mb-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-brand-blue text-white">
                  <th className="py-2.5 px-3 text-[11px] text-left font-semibold uppercase tracking-wide rounded-tl-sm">
                    Omschrijving
                  </th>
                  <th className="py-2.5 px-3 text-[11px] text-center font-semibold uppercase tracking-wide w-20">
                    Aantal
                  </th>
                  <th className="py-2.5 px-3 text-[11px] text-right font-semibold uppercase tracking-wide w-28">
                    Prijs
                  </th>
                  <th className="py-2.5 px-3 text-[11px] text-right font-semibold uppercase tracking-wide w-28 rounded-tr-sm">
                    Totaal
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr
                    key={item.id}
                    className={cn(
                      'border-b border-gray-100',
                      index % 2 === 0 ? 'bg-brand-gray/50' : 'bg-white'
                    )}
                  >
                    <td className="py-2.5 px-3 text-[12px] align-top">
                      <div className="font-medium text-gray-800">{item.description}</div>
                    </td>
                    <td className="py-2.5 px-3 text-[12px] text-center align-top text-gray-600">
                      {item.quantity}
                    </td>
                    <td className="py-2.5 px-3 text-[12px] text-right align-top text-gray-600">
                      € {item.unitPrice.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-[12px] text-right align-top font-semibold text-gray-800">
                      € {item.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end mb-6">
            <div className="w-[260px]">
              <div className="flex justify-between py-1.5 px-3 text-[12px] text-gray-600">
                <span>Subtotaal</span>
                <span className="font-medium text-gray-800">€ {invoice.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1.5 px-3 text-[12px] text-gray-600 bg-gray-50 rounded">
                <span>BTW ({invoice.vatRate}%)</span>
                <span>€ {invoice.vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-2.5 px-3 mt-1.5 bg-brand-blue text-white rounded shadow-sm">
                <span className="font-semibold text-sm">TOTAAL</span>
                <span className="font-bold text-base text-brand-orange">
                  € {invoice.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="absolute bottom-[45px] left-[50px] right-[50px] border-t-[2px] border-brand-orange pt-3 flex justify-between items-center text-[10px] text-gray-400">
            <div>
              &copy; {new Date().getFullYear()} {COMPANY_INFO.name}. {isProforma ? 'Proforma' : 'Factuur'} — Pagina 1{invoice.notes ? '/2' : ''}
            </div>
            <div className="flex gap-4">
              <span>Algemene Voorwaarden</span>
              <span>Privacy Policy</span>
            </div>
          </div>
        </div>

        {/* PAGE 2 - Opmerkingen (only if notes exist) */}
        {invoice.notes && (
          <div
            ref={page2Ref}
            className="bg-white shadow-xl relative print:shadow-none print:w-full overflow-hidden"
            style={{ width: '794px', minHeight: '1123px', padding: '45px 50px' }}
          >
            <Header />

            <div className="mt-10">
              <h2 className="text-lg font-bold text-brand-blue mb-6 border-b pb-2">Vervolg — Opmerkingen</h2>

              <div className="bg-brand-gray border-l-[4px] border-brand-blue py-5 px-5 rounded-r-sm">
                <h3 className="text-[11px] uppercase tracking-wider text-brand-blue font-bold mb-3">
                  Opmerkingen
                </h3>
                <div className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {invoice.notes}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="absolute bottom-[45px] left-[50px] right-[50px] border-t-[2px] border-brand-orange pt-3 flex justify-between items-center text-[10px] text-gray-400">
              <div>
                &copy; {new Date().getFullYear()} {COMPANY_INFO.name}. {isProforma ? 'Proforma' : 'Factuur'} — Pagina 2/2
              </div>
              <div className="flex gap-4">
                <span>Algemene Voorwaarden</span>
                <span>Privacy Policy</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
