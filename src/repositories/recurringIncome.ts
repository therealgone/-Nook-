import { eq } from 'drizzle-orm';
import { recurringIncome, type RecurringIncome, type NewRecurringIncome } from '../db/schema';
import type { AppDb } from '../db/types';

export async function createRecurringIncome(
  db: AppDb,
  input: Omit<NewRecurringIncome, 'id'>,
): Promise<RecurringIncome> {
  const [row] = await db.insert(recurringIncome).values(input).returning();
  return row;
}

export async function listRecurringIncome(db: AppDb): Promise<RecurringIncome[]> {
  return db.select().from(recurringIncome);
}

export async function updateRecurringIncome(
  db: AppDb,
  id: number,
  input: Partial<Omit<NewRecurringIncome, 'id'>>,
): Promise<RecurringIncome> {
  const [row] = await db.update(recurringIncome).set(input).where(eq(recurringIncome.id, id)).returning();
  return row;
}

export async function deleteRecurringIncome(db: AppDb, id: number): Promise<void> {
  await db.delete(recurringIncome).where(eq(recurringIncome.id, id));
}
