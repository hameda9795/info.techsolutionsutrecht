import { uploadAttachment, deleteAttachment, type UploadedAttachment } from './db';

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10 MB
export const ACCEPTED_ATTACHMENT_TYPES = '.pdf,.jpg,.jpeg,.png,.webp';

export type { UploadedAttachment };

/** Upload een inkoopfactuur-bijlage (PDF/foto) naar de eigen backend en geef de url terug. */
export const uploadPurchaseAttachment = (
  purchaseId: string,
  file: File
): Promise<UploadedAttachment> => uploadAttachment(purchaseId, file);

/**
 * Verwijder de bijlage van een inkoopfactuur. De backend kent het bestandspad
 * zelf (nooit aan de client blootgesteld) en zoekt het op via het factuur-id.
 * Faalt stil als er geen bijlage (meer) is.
 */
export const deletePurchaseAttachment = async (purchaseId: string): Promise<void> => {
  try {
    await deleteAttachment(purchaseId);
  } catch {
    // Bestand bestond al niet (meer) — niets aan te doen.
  }
};
