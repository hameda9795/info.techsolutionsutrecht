import type { Document } from '../types.js';

/** A document is locked once it leaves "draft" — correct it with a creditnota, never by editing. */
export const isLocked = (docu: Pick<Document, 'status'>): boolean => docu.status !== 'draft';

/** Whether a document may still be deleted (only unnumbered concepts). */
export const canDelete = (docu: Pick<Document, 'status' | 'documentNumber'>): boolean =>
  docu.status === 'draft' && !docu.documentNumber;
