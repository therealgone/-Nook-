import { and, eq } from 'drizzle-orm';
import { payPeriods, type PayPeriod } from '../db/schema';
import type { AppDb } from '../db/types';

export async function listPayPeriods(db: AppDb): Promise<PayPeriod[]> {
  return db.select().from(payPeriods);
}

export async function findPayPeriod(db: AppDb, startDate: string, endDate: string): Promise<PayPeriod | undefined> {
  const [row] = await db
    .select()
    .from(payPeriods)
    .where(and(eq(payPeriods.startDate, startDate), eq(payPeriods.endDate, endDate)));
  return row;
}

export async function createPayPeriod(db: AppDb, startDate: string, endDate: string): Promise<PayPeriod> {
  const [row] = await db
    .insert(payPeriods)
    .values({ startDate, endDate, allocatedSurplus: 0, coveredDeficit: 0, createdAt: new Date().toISOString() })
    .returning();
  return row;
}

export async function addAllocatedSurplus(db: AppDb, id: number, amount: number): Promise<PayPeriod> {
  const [current] = await db.select().from(payPeriods).where(eq(payPeriods.id, id));
  const [row] = await db
    .update(payPeriods)
    .set({ allocatedSurplus: current.allocatedSurplus + amount })
    .where(eq(payPeriods.id, id))
    .returning();
  return row;
}

export async function addCoveredDeficit(db: AppDb, id: number, amount: number): Promise<PayPeriod> {
  const [current] = await db.select().from(payPeriods).where(eq(payPeriods.id, id));
  const [row] = await db
    .update(payPeriods)
    .set({ coveredDeficit: current.coveredDeficit + amount })
    .where(eq(payPeriods.id, id))
    .returning();
  return row;
}
