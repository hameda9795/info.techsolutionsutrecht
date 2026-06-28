import { useRef, useMemo, useState } from 'react';
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
import { Paperclip, X, ExternalLink } from 'lucide-react';
import type {
  PurchaseInvoice,
  PurchaseCategory,
  PaymentStatus,
  PurchaseBtwCode,
  AmountMode,
  PaidVia,
} from '@/types';
import {
  PURCHASE_CATEGORIES,
  PURCHASE_BTW_CODES,
  purchaseBtwCodeLabel,
  purchaseBtwCodeHint,
  paidViaLabel,
} from '@/types';
import { generateId, savePurchaseInvoice } from '@/lib/db';
import { recalcPurchaseAmounts, round2, formatEUR } from '@/lib/calc';
import {
  uploadPurchaseAttachment,
  deletePurchaseAttachment,
  MAX_ATTACHMENT_SIZE,
  ACCEPTED_ATTACHMENT_TYPES,
} from '@/lib/storage';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: PurchaseInvoice | null;
  onSaved: () => void;
}

// Voor deze codes is het bedrag altijd het volledige/excl. bedrag — de
// excl./incl.-keuze is dan niet van toepassing en wordt verborgen.
const AMOUNT_MODE_CODES: PurchaseBtwCode[] = ['NL21', 'NL9'];

const fieldCls = 'h-12 text-base';
// SelectTrigger's own classes set height via a `data-[size=default]:h-9` rule, which
// has higher CSS specificity than a plain `h-12` override — the `!` forces it through.
const selectCls = '!h-12 text-base';
const labelCls = 'text-sm mb-2';

export default function PurchaseInvoiceForm({ open, onOpenChange, initial, onSaved }: Props) {
  const [supplierName, setSupplierName] = useState(initial?.supplierName ?? '');
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState(
    initial?.supplierInvoiceNumber ?? ''
  );
  const [invoiceDate, setInvoiceDate] = useState(
    initial?.invoiceDate ?? new Date().toISOString().split('T')[0]
  );
  const [category, setCategory] = useState<PurchaseCategory>(
    initial?.category ?? PURCHASE_CATEGORIES[0]
  );
  const [btwCode, setBtwCode] = useState<PurchaseBtwCode>(initial?.btwCode ?? 'NL21');
  const [amountInput, setAmountInput] = useState<number>(initial?.amountInput ?? 0);
  const [amountInputMode, setAmountInputMode] = useState<AmountMode>(
    initial?.amountInputMode ?? 'EXCL'
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    initial?.paymentStatus ?? 'open'
  );
  const [paidVia, setPaidVia] = useState<PaidVia>(initial?.paidVia ?? 'ZAKELIJK');
  const [notes, setNotes] = useState(initial?.notes ?? '');

  // Stabiel id, ook al vóór het opslaan — nodig als Storage-pad voor de bijlage.
  const [id] = useState(initial?.id ?? generateId());

  // Bijlage: de al-opgeslagen bijlage (url/naam/pad), een eventueel nieuw gekozen
  // bestand dat nog geüpload moet worden, en of de bestaande bijlage verwijderd is.
  const [existingAttachment] = useState(
    initial?.attachmentPdf
      ? { url: initial.attachmentPdf, name: initial.attachmentName ?? 'Bijlage', path: initial.attachmentPath }
      : undefined
  );
  const [removeExisting, setRemoveExisting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showAmountMode = AMOUNT_MODE_CODES.includes(btwCode);

  // Btw wordt automatisch afgeleid uit het ingevoerde bedrag en de btw-code.
  const amounts = useMemo(
    () => recalcPurchaseAmounts(btwCode, amountInput, showAmountMode ? amountInputMode : 'EXCL'),
    [btwCode, amountInput, amountInputMode, showAmountMode]
  );

  const pickFile = (file: File) => {
    if (file.size > MAX_ATTACHMENT_SIZE) {
      toast.error('Bestand is te groot (max. 10 MB).');
      return;
    }
    setSelectedFile(file);
    setRemoveExisting(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierName.trim()) {
      toast.error('Vul een leverancier in.');
      return;
    }
    if (amountInput <= 0) {
      toast.error('Het bedrag moet groter dan 0 zijn.');
      return;
    }

    // Verwijderen van een bijlage zonder vervanging: de backend verwijdert het
    // bestand en wist de kolommen in één stap, dus dit moet vóór de save (anders
    // bestaat er geen rij om de huidige bijlage van op te zoeken bij een nieuwe
    // inkoopfactuur, en bij een bestaande zou de volgorde geen verschil maken).
    if (removeExisting && !selectedFile && initial) {
      await deletePurchaseAttachment(id);
    }

    const attachmentPdf = removeExisting ? undefined : existingAttachment?.url;
    const attachmentName = removeExisting ? undefined : existingAttachment?.name;
    const attachmentPath = removeExisting ? undefined : existingAttachment?.path;

    const now = new Date().toISOString();
    const baseRecord: PurchaseInvoice = {
      id,
      supplierName: supplierName.trim(),
      supplierInvoiceNumber: supplierInvoiceNumber.trim(),
      invoiceDate,
      category,
      btwCode,
      amountInput: round2(amountInput),
      amountInputMode: showAmountMode ? amountInputMode : 'EXCL',
      amountExclBtw: amounts.amountExclBtw,
      btwPercentage: amounts.btwPercentage,
      btwAmount: amounts.btwAmount,
      amountInclBtw: amounts.amountInclBtw,
      paymentStatus,
      paidVia,
      attachmentPdf,
      attachmentName,
      attachmentPath,
      notes: notes.trim() || undefined,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    // Sla eerst de rij op — bij een nieuwe inkoopfactuur bestaat de rij anders nog
    // niet wanneer we hierna proberen een bijlage te uploaden naar dit id.
    await savePurchaseInvoice(baseRecord);

    if (selectedFile) {
      setUploading(true);
      try {
        const uploaded = await uploadPurchaseAttachment(id, selectedFile);
        await savePurchaseInvoice({
          ...baseRecord,
          attachmentPdf: uploaded.url,
          attachmentName: uploaded.name,
          attachmentPath: uploaded.path,
          updatedAt: new Date().toISOString(),
        });
      } catch (err) {
        toast.error((err as Error).message || 'Uploaden van de bijlage is mislukt.');
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    toast.success(initial ? 'Inkoopfactuur bijgewerkt' : 'Inkoopfactuur toegevoegd');
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto p-8">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {initial ? 'Inkoopfactuur bewerken' : 'Inkoopfactuur toevoegen'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-6 text-base">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <Label className={labelCls}>Leverancier</Label>
              <Input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className={fieldCls}
              />
            </div>
            <div>
              <Label className={labelCls}>Factuurnummer leverancier</Label>
              <Input
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                className={fieldCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div>
              <Label className={labelCls}>Factuurdatum</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className={fieldCls}
              />
            </div>
            <div>
              <Label className={labelCls}>Categorie</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as PurchaseCategory)}>
                <SelectTrigger className={selectCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PURCHASE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="text-base">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className={`grid gap-5 ${showAmountMode ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div>
              <Label className={labelCls}>Bedrag (€)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={amountInput}
                onChange={(e) => setAmountInput(Number(e.target.value))}
                className={fieldCls}
              />
            </div>
            {showAmountMode && (
              <div>
                <Label className={labelCls}>Bedrag is</Label>
                <Select
                  value={amountInputMode}
                  onValueChange={(v) => setAmountInputMode(v as AmountMode)}
                >
                  <SelectTrigger className={selectCls}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXCL" className="text-base">Excl. btw</SelectItem>
                    <SelectItem value="INCL" className="text-base">Incl. btw</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className={labelCls}>BTW-code</Label>
              <Select value={btwCode} onValueChange={(v) => setBtwCode(v as PurchaseBtwCode)}>
                <SelectTrigger className={selectCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PURCHASE_BTW_CODES.map((c) => (
                    <SelectItem key={c} value={c} className="text-base">
                      {purchaseBtwCodeLabel[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-sm text-gray-500 -mt-2">{purchaseBtwCodeHint[btwCode]}</p>

          {/* Afgeleide bedragen */}
          {(() => {
            const isVerlegd = btwCode === 'EU_VERLEGD' || btwCode === 'BUITEN_EU_VERLEGD';
            return (
              <div className="text-base bg-gray-50 rounded-xl p-5 grid grid-cols-3 gap-4">
                <div>
                  <div className="text-gray-400 text-sm">{isVerlegd ? 'Kosten excl. btw' : 'Excl. btw'}</div>
                  <div className="font-mono font-semibold text-lg">{formatEUR(amounts.amountExclBtw)}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">
                    {isVerlegd ? `Verlegde btw (${amounts.btwPercentage}%)` : `Btw (${amounts.btwPercentage}%)`}
                  </div>
                  <div className="font-mono font-semibold text-lg">{formatEUR(amounts.btwAmount)}</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm">{isVerlegd ? 'Totaal betaald' : 'Incl. btw'}</div>
                  <div className="font-mono font-semibold text-lg">{formatEUR(amounts.amountInclBtw)}</div>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-2 gap-5">
            <div>
              <Label className={labelCls}>Betaalstatus</Label>
              <Select value={paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}>
                <SelectTrigger className={selectCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open" className="text-base">Open</SelectItem>
                  <SelectItem value="paid" className="text-base">Betaald</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className={labelCls}>Betaald via</Label>
              <Select value={paidVia} onValueChange={(v) => setPaidVia(v as PaidVia)}>
                <SelectTrigger className={selectCls}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZAKELIJK" className="text-base">{paidViaLabel.ZAKELIJK}</SelectItem>
                  <SelectItem value="PRIVE" className="text-base">{paidViaLabel.PRIVE}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className={labelCls}>Bijlage</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_ATTACHMENT_TYPES}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) pickFile(file);
                e.target.value = '';
              }}
            />
            {selectedFile ? (
              <div className="flex items-center gap-3 h-12 px-4 rounded-md border bg-gray-50 text-base">
                <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate flex-1">{selectedFile.name}</span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : existingAttachment && !removeExisting ? (
              <div className="flex items-center gap-3 h-12 px-4 rounded-md border bg-gray-50 text-base">
                <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
                <a
                  href={existingAttachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate flex-1 text-brand-blue hover:underline flex items-center gap-1.5"
                >
                  {existingAttachment.name} <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-gray-500 hover:text-brand-blue whitespace-nowrap"
                >
                  Vervangen
                </button>
                <button
                  type="button"
                  onClick={() => setRemoveExisting(true)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 text-base justify-start"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="w-4 h-4 mr-2" /> Bestand kiezen van pc (PDF of foto)
              </Button>
            )}
          </div>
          <div>
            <Label className={labelCls}>Notitie</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldCls} />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="submit"
              disabled={uploading}
              className="h-12 px-6 text-base bg-brand-blue hover:bg-blue-900"
            >
              {uploading ? 'Bijlage uploaden…' : initial ? 'Opslaan' : 'Toevoegen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
