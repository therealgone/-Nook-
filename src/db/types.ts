import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type * as schema from './schema';

export type AppDb = BaseSQLiteDatabase<any, any, typeof schema>;
