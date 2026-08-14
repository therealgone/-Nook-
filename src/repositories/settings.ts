import { settings, type Settings } from '../db/schema';
import type { AppDb } from '../db/types';

export async function getSettings(db: AppDb): Promise<Settings | undefined> {
  const [row] = await db.select().from(settings);
  return row;
}
