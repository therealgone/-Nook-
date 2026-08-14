import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { CREATE_TABLES_SQL } from './ddl';
import type { AppDb } from './types';

export function createTestDb(): AppDb {
  const sqlite = new Database(':memory:');
  sqlite.exec(CREATE_TABLES_SQL);
  return drizzle(sqlite, { schema });
}

export type { AppDb };
