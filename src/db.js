import pg from 'pg';

const { Pool, types } = pg;

const PG_DATE_OID = 1082;
types.setTypeParser(PG_DATE_OID, (value) => value);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export function query(text, params) {
  return pool.query(text, params);
}
