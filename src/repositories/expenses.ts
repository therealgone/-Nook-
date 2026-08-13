import { and, eq, gte, lte } from 'drizzle-orm';
import { expenses, type Expense, type NewExpense } from '../db/schema';
import type { AppDb } from '../db/testDb';

export interface ExpenseFilter {
  from?: string;
  to?: string;
  categoryId?: number;
}

function buildFilter(filter?: ExpenseFilter) {
  if (!filter) return undefined;
  const conditions = [];
  if (filter.from) conditions.push(gte(expenses.date, filter.from));
  if (filter.to) conditions.push(lte(expenses.date, filter.to));
  if (filter.categoryId !== undefined) conditions.push(eq(expenses.categoryId, filter.categoryId));
  return conditions.length ? and(...conditions) : undefined;
}

export async function logExpense(db: AppDb, input: Omit<NewExpense, 'id'>): Promise<Expense> {
  const [row] = await db.insert(expenses).values(input).returning();
  return row;
}

export async function listExpenses(db: AppDb, filter?: ExpenseFilter): Promise<Expense[]> {
  const where = buildFilter(filter);
  return where ? db.select().from(expenses).where(where) : db.select().from(expenses);
}

export async function getExpense(db: AppDb, id: number): Promise<Expense | undefined> {
  const [row] = await db.select().from(expenses).where(eq(expenses.id, id));
  return row;
}

export async function updateExpense(
  db: AppDb,
  id: number,
  input: Partial<Omit<NewExpense, 'id'>>,
): Promise<Expense> {
  const [row] = await db.update(expenses).set(input).where(eq(expenses.id, id)).returning();
  return row;
}

export async function deleteExpense(db: AppDb, id: number): Promise<void> {
  await db.delete(expenses).where(eq(expenses.id, id));
}

export async function totalExpenses(db: AppDb, filter?: ExpenseFilter): Promise<number> {
  const rows = await listExpenses(db, filter);
  return rows.reduce((sum, row) => sum + row.amount, 0);
}
