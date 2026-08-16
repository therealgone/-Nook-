import { and, eq, gte, lt } from 'drizzle-orm';
import type { AppDb } from '../db/types';
import { incomeEntries, expenses } from '../db/schema';
import { createPayPeriod, findPayPeriod } from '../repositories/payPeriods';

const EPSILON = 0.01;

export interface PeriodBoundary {
  start: string;
  end: string;
}

export interface PendingPeriodAction {
  periodId: number;
  start: string;
  end: string;
  delta: number;
}

export async function getClosedPeriodBoundaries(db: AppDb): Promise<PeriodBoundary[]> {
  const salaries = await db.select().from(incomeEntries).where(eq(incomeEntries.type, 'fixed_monthly'));
  const dates = [...new Set(salaries.map((s) => s.date))].sort();
  const boundaries: PeriodBoundary[] = [];
  for (let i = 0; i < dates.length - 1; i++) {
    boundaries.push({ start: dates[i], end: dates[i + 1] });
  }
  return boundaries;
}

async function sumIncomeInRange(db: AppDb, start: string, end: string): Promise<number> {
  const rows = await db
    .select()
    .from(incomeEntries)
    .where(and(gte(incomeEntries.date, start), lt(incomeEntries.date, end)));
  return rows.reduce((sum, r) => sum + r.amount, 0);
}

async function sumExpensesInRange(db: AppDb, start: string, end: string): Promise<number> {
  const rows = await db
    .select()
    .from(expenses)
    .where(and(gte(expenses.date, start), lt(expenses.date, end)));
  return rows.reduce((sum, r) => sum + r.amount, 0);
}

export async function reconcilePayPeriods(db: AppDb): Promise<PendingPeriodAction[]> {
  const boundaries = await getClosedPeriodBoundaries(db);
  const pending: PendingPeriodAction[] = [];

  for (const { start, end } of boundaries) {
    let period = await findPayPeriod(db, start, end);
    if (!period) period = await createPayPeriod(db, start, end);

    const periodIncome = await sumIncomeInRange(db, start, end);
    const periodExpenses = await sumExpensesInRange(db, start, end);
    const rawOutcome = periodIncome - periodExpenses;
    const handled = period.allocatedSurplus - period.coveredDeficit;
    const delta = rawOutcome - handled;

    if (Math.abs(delta) > EPSILON) {
      pending.push({ periodId: period.id, start, end, delta });
    }
  }

  return pending;
}
