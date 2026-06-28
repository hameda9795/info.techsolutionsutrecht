import type { PoolClient } from 'pg';
import type { DocumentType } from '../types.js';
import { SERIES_PREFIX } from '../types.js';

export const formatNumber = (prefix: string, year: number, value: number): string =>
  `${prefix}-${year}-${String(value).padStart(4, '0')}`;

/**
 * Atomically allocate the next gapless number for a document type's series, using
 * the same row-locking semantics `INSERT ... ON CONFLICT DO UPDATE` provides — the
 * conflicting row is locked for the statement's duration, serializing concurrent
 * callers, and the increment only survives if the caller's transaction commits
 * (so a failed finalize never burns/skips a number). MUST be called inside the
 * same transaction (`client`) as the document update that consumes the number.
 */
export const allocateNumber = async (
  client: PoolClient,
  type: DocumentType,
  year: number = new Date().getFullYear()
): Promise<string> => {
  const prefix = SERIES_PREFIX[type];
  const id = `${year}_${prefix}`;
  const res = await client.query<{ value: number }>(
    `INSERT INTO counters (id, prefix, year, value)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (id) DO UPDATE SET value = counters.value + 1
     RETURNING value`,
    [id, prefix, year]
  );
  return formatNumber(prefix, year, res.rows[0].value);
};
