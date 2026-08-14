import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';
import { CREATE_TABLES_SQL } from './ddl';
import { settings, categories } from './schema';
import type { AppDb } from './types';

type ColumnInfo = { name: string; notnull: number };

function isColumnNotNull(sqlite: SQLiteDatabase, table: string, column: string): boolean {
  const rows = sqlite.getAllSync<ColumnInfo>(`PRAGMA table_info(${table});`);
  const col = rows.find((r) => r.name === column);
  return col ? col.notnull === 1 : false;
}

// Older installs created `categories`/`recurring_payments` with NOT NULL columns
// that later became optional (unlimited categories, recurring payments without a
// category). SQLite can't ALTER a column's nullability directly, so rebuild the
// table in place, preserving existing rows, when the old constraint is detected.
function migrateLegacySchema(sqlite: SQLiteDatabase): void {
  if (isColumnNotNull(sqlite, 'categories', 'budget_amount')) {
    sqlite.execSync(`
      ALTER TABLE categories RENAME TO categories_old;
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        budget_amount REAL,
        budget_period TEXT
      );
      INSERT INTO categories SELECT * FROM categories_old;
      DROP TABLE categories_old;
    `);
  }

  if (isColumnNotNull(sqlite, 'recurring_payments', 'category_id')) {
    sqlite.execSync(`
      ALTER TABLE recurring_payments RENAME TO recurring_payments_old;
      CREATE TABLE recurring_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        label TEXT NOT NULL,
        amount REAL NOT NULL,
        category_id INTEGER REFERENCES categories(id),
        frequency TEXT NOT NULL,
        next_due_date TEXT NOT NULL
      );
      INSERT INTO recurring_payments SELECT * FROM recurring_payments_old;
      DROP TABLE recurring_payments_old;
    `);
  }
}

const DEFAULT_CATEGORIES = [
  { name: 'Groceries', icon: 'cart', color: '#4CAF50', budgetAmount: 400, budgetPeriod: 'monthly' as const },
  { name: 'Utilities', icon: 'flash', color: '#2196F3', budgetAmount: 150, budgetPeriod: 'monthly' as const },
  { name: 'Transport', icon: 'car', color: '#FF9800', budgetAmount: 100, budgetPeriod: 'monthly' as const },
  { name: 'Dining', icon: 'restaurant', color: '#E91E63', budgetAmount: 150, budgetPeriod: 'monthly' as const },
];

let dbInstance: AppDb | undefined;

export function getDb(): AppDb {
  if (dbInstance) return dbInstance;
  const sqlite = openDatabaseSync('money.db');
  sqlite.execSync(CREATE_TABLES_SQL);
  migrateLegacySchema(sqlite);
  dbInstance = drizzle(sqlite, { schema });
  return dbInstance;
}

export async function seedDefaultsIfNeeded(db: AppDb): Promise<void> {
  const existingSettings = await db.select().from(settings);
  if (existingSettings.length === 0) {
    await db.insert(settings).values({ currency: 'USD', onboardingComplete: true });
  }

  const existingCategories = await db.select().from(categories);
  if (existingCategories.length === 0) {
    await db.insert(categories).values(DEFAULT_CATEGORIES);
  }
}
