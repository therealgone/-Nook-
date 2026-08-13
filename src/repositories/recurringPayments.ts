import { eq } from 'drizzle-orm';
import { recurringPayments, type RecurringPayment, type NewRecurringPayment } from '../db/schema';
import type { AppDb } from '../db/testDb';

export async function createRecurringPayment(
  db: AppDb,
  input: Omit<NewRecurringPayment, 'id'>,
): Promise<RecurringPayment> {
  const [row] = await db.insert(recurringPayments).values(input).returning();
  return row;
}

export async function listRecurringPayments(db: AppDb): Promise<RecurringPayment[]> {
  return db.select().from(recurringPayments);
}

export async function updateRecurringPayment(
  db: AppDb,
  id: number,
  input: Partial<Omit<NewRecurringPayment, 'id'>>,
): Promise<RecurringPayment> {
  const [row] = await db.update(recurringPayments).set(input).where(eq(recurringPayments.id, id)).returning();
  return row;
}

export async function deleteRecurringPayment(db: AppDb, id: number): Promise<void> {
  await db.delete(recurringPayments).where(eq(recurringPayments.id, id));
}
