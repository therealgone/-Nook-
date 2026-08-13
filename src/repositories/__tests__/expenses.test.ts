import { createTestDb } from '../../db/testDb';
import { createCategory } from '../categories';
import {
  logExpense,
  listExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
  totalExpenses,
} from '../expenses';

test('logs an expense with a category', async () => {
  const db = createTestDb();
  const category = await createCategory(db, { name: 'Dining', icon: 'utensils', color: '#f59e0b', budgetAmount: 100, budgetPeriod: 'weekly' });
  const expense = await logExpense(db, { amount: 25.5, categoryId: category.id, date: '2026-08-12', note: 'lunch', isRecurring: false });
  expect(expense.amount).toBe(25.5);
});

test('logs an expense with no category (piggy bank purchase)', async () => {
  const db = createTestDb();
  const expense = await logExpense(db, { amount: 500, categoryId: null, date: '2026-08-12', note: 'Purchased: Headphones', isRecurring: false });
  expect(expense.categoryId).toBeNull();
});

test('filters expenses by date range and category', async () => {
  const db = createTestDb();
  const cat1 = await createCategory(db, { name: 'Dining', icon: 'utensils', color: '#f59e0b', budgetAmount: 100, budgetPeriod: 'weekly' });
  const cat2 = await createCategory(db, { name: 'Transport', icon: 'car', color: '#3b82f6', budgetAmount: 50, budgetPeriod: 'weekly' });

  await logExpense(db, { amount: 10, categoryId: cat1.id, date: '2026-08-01', note: null, isRecurring: false });
  await logExpense(db, { amount: 20, categoryId: cat1.id, date: '2026-08-15', note: null, isRecurring: false });
  await logExpense(db, { amount: 30, categoryId: cat2.id, date: '2026-08-15', note: null, isRecurring: false });

  const inRange = await listExpenses(db, { from: '2026-08-10', to: '2026-08-20' });
  expect(inRange).toHaveLength(2);

  const inCategory = await listExpenses(db, { categoryId: cat2.id });
  expect(inCategory).toHaveLength(1);
});

test('sums total expenses with an optional filter', async () => {
  const db = createTestDb();
  const category = await createCategory(db, { name: 'Dining', icon: 'utensils', color: '#f59e0b', budgetAmount: 100, budgetPeriod: 'weekly' });

  await logExpense(db, { amount: 10, categoryId: category.id, date: '2026-08-01', note: null, isRecurring: false });
  await logExpense(db, { amount: 20, categoryId: category.id, date: '2026-08-15', note: null, isRecurring: false });
  expect(await totalExpenses(db)).toBe(30);
  expect(await totalExpenses(db, { from: '2026-08-10', to: '2026-08-20' })).toBe(20);
});

test('updates and deletes an expense', async () => {
  const db = createTestDb();
  const category = await createCategory(db, { name: 'Dining', icon: 'utensils', color: '#f59e0b', budgetAmount: 100, budgetPeriod: 'weekly' });

  const expense = await logExpense(db, { amount: 10, categoryId: category.id, date: '2026-08-01', note: null, isRecurring: false });
  const updated = await updateExpense(db, expense.id, { amount: 15 });
  expect(updated.amount).toBe(15);
  await deleteExpense(db, expense.id);
  expect(await getExpense(db, expense.id)).toBeUndefined();
});
