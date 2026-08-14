import { eq } from 'drizzle-orm';
import { incomeEntries, type IncomeEntry, type NewIncomeEntry } from '../db/schema';
import type { AppDb } from '../db/types';

export async function logIncome(db: AppDb, input: Omit<NewIncomeEntry, 'id'>): Promise<IncomeEntry> {
  const [row] = await db.insert(incomeEntries).values(input).returning();
  return row;
}

export async function listIncome(db: AppDb): Promise<IncomeEntry[]> {
  return db.select().from(incomeEntries);
}

export async function updateIncome(
  db: AppDb,
  id: number,
  input: Partial<Omit<NewIncomeEntry, 'id'>>,
): Promise<IncomeEntry> {
  const [row] = await db.update(incomeEntries).set(input).where(eq(incomeEntries.id, id)).returning();
  return row;
}

export async function deleteIncome(db: AppDb, id: number): Promise<void> {
  await db.delete(incomeEntries).where(eq(incomeEntries.id, id));
}

export async function totalIncome(db: AppDb): Promise<number> {
  const all = await listIncome(db);
  return all.reduce((sum, entry) => sum + entry.amount, 0);
}
