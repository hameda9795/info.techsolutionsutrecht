import { db } from './firebase';
import { doc, runTransaction } from 'firebase/firestore';
import { SERIES_PREFIX, type DocumentType } from '@/types';

const COUNTERS = 'counters';

/**
 * Atomically allocate the next gapless number for a document type's series.
 * All INVOICE subtypes share the "F" series. Number is allocated at finalize
 * time (draft -> sent) so deleting a concept never leaves a gap.
 *
 * Counter doc id: `{year}_{prefix}` (e.g. "2026_F"), field `value`.
 * Returns a formatted number like "F-2026-0001".
 */
export const allocateNumber = async (
  type: DocumentType,
  year: number = new Date().getFullYear()
): Promise<string> => {
  const prefix = SERIES_PREFIX[type];
  const counterRef = doc(db, COUNTERS, `${year}_${prefix}`);

  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? (snap.data().value as number) : 0;
    const value = current + 1;
    tx.set(counterRef, { prefix, year, value }, { merge: true });
    return value;
  });

  return `${prefix}-${year}-${String(next).padStart(4, '0')}`;
};

/** Read current counter values (for the Instellingen overview). Read-only. */
export const formatNumber = (prefix: string, year: number, value: number): string =>
  `${prefix}-${year}-${String(value).padStart(4, '0')}`;
