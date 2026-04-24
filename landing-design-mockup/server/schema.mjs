/**
 * Схема PostgreSQL для гаража (Render Postgres + DATABASE_URL).
 */

const CREATE_TABLE = `
CREATE TABLE IF NOT EXISTS garage_cars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  link_url TEXT NOT NULL DEFAULT '',
  legal_status TEXT NOT NULL DEFAULT '',
  electrical TEXT NOT NULL DEFAULT '',
  rust_where TEXT NOT NULL DEFAULT '',
  rust_degree TEXT NOT NULL DEFAULT '',
  chips_where TEXT NOT NULL DEFAULT '',
  chips_damage TEXT NOT NULL DEFAULT '',
  damaged TEXT NOT NULL DEFAULT '',
  dents_where TEXT NOT NULL DEFAULT '',
  dents_damage TEXT NOT NULL DEFAULT '',
  repaint_where TEXT NOT NULL DEFAULT '',
  repaint_degree TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  general_condition TEXT NOT NULL DEFAULT '',
  desc1 TEXT NOT NULL DEFAULT '',
  desc2 TEXT NOT NULL DEFAULT '',
  desc3 TEXT NOT NULL DEFAULT ''
);
`;

const CREATE_INDEX = `
CREATE INDEX IF NOT EXISTS garage_cars_created_at_idx ON garage_cars (created_at);
`;

const MIGRATE_COLUMNS = [
  `ALTER TABLE garage_cars ADD COLUMN IF NOT EXISTS listing_status TEXT NOT NULL DEFAULT 'listed'`,
  `ALTER TABLE garage_cars ADD COLUMN IF NOT EXISTS purchase_price TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE garage_cars ADD COLUMN IF NOT EXISTS sale_price TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE garage_cars ADD COLUMN IF NOT EXISTS invested_amount TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE garage_cars ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT ''`,
];

/** @param {{ query: (sql: string) => Promise<unknown> }} pool */
export async function ensureSchema(pool) {
  await pool.query(CREATE_TABLE);
  await pool.query(CREATE_INDEX);
  for (const sql of MIGRATE_COLUMNS) {
    await pool.query(sql);
  }
}
