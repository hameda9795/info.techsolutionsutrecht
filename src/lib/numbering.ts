// Gapless number allocation now happens server-side (see server/src/lib/numbering.ts)
// inside the same transaction as the document's finalize update. This module only
// keeps the pure display-formatting helper used by Instellingen.tsx.

/** Read current counter values (for the Instellingen overview). Read-only. */
export const formatNumber = (prefix: string, year: number, value: number): string =>
  `${prefix}-${year}-${String(value).padStart(4, '0')}`;
