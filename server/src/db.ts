import pg from 'pg';

const { Pool, types } = pg;

// node-postgres parses DATE columns into a JS Date at local midnight, which then
// shifts by a day under .toISOString() in any timezone other than UTC — a classic
// footgun. We never need calendar dates as Date objects (issueDate/dueDate/
// invoiceDate/paymentDate are stored/sent as plain 'YYYY-MM-DD' strings throughout
// this app), so return the raw string unparsed instead. OID 1082 = date.
types.setTypeParser(1082, (val: string) => val);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});

export const generateId = (): string =>
  Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
