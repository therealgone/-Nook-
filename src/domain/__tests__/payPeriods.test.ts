import { createTestDb } from '../../db/testDb';
import { logIncome } from '../../repositories/income';
import { logExpense, deleteExpense } from '../../repositories/expenses';
import { addAllocatedSurplus, addCoveredDeficit } from '../../repositories/payPeriods';
import { reconcilePayPeriods, getClosedPeriodBoundaries } from '../payPeriods';

test('no pending actions when fewer than two salary entries exist', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-06-06', note: null });
  expect(await getClosedPeriodBoundaries(db)).toHaveLength(0);
  expect(await reconcilePayPeriods(db)).toHaveLength(0);
});

test('reports a surplus for a closed period where income exceeded spend', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-06-06', note: null });
  await logExpense(db, { amount: 4000, categoryId: null, date: '2026-06-20', note: null, isRecurring: false });
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-07-06', note: null });

  const pending = await reconcilePayPeriods(db);
  expect(pending).toHaveLength(1);
  expect(pending[0]).toMatchObject({ start: '2026-06-06', end: '2026-07-06', delta: 1000 });
});

test('reports a deficit for a closed period where spend exceeded income', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 3000, type: 'fixed_monthly', date: '2026-06-06', note: null });
  await logExpense(db, { amount: 3500, categoryId: null, date: '2026-06-20', note: null, isRecurring: false });
  await logIncome(db, { amount: 3000, type: 'fixed_monthly', date: '2026-07-06', note: null });

  const pending = await reconcilePayPeriods(db);
  expect(pending).toHaveLength(1);
  expect(pending[0].delta).toBe(-500);
});

test('a fully-resolved period reports no pending action', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-06-06', note: null });
  await logExpense(db, { amount: 4000, categoryId: null, date: '2026-06-20', note: null, isRecurring: false });
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-07-06', note: null });

  const [first] = await reconcilePayPeriods(db);
  await addAllocatedSurplus(db, first.periodId, first.delta);

  expect(await reconcilePayPeriods(db)).toHaveLength(0);
});

test('a retroactive delete of an expense inside a resolved period surfaces the new surplus', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-06-06', note: null });
  const oldExpense = await logExpense(db, { amount: 4000, categoryId: null, date: '2026-06-20', note: null, isRecurring: false });
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-07-06', note: null });

  const [first] = await reconcilePayPeriods(db);
  await addAllocatedSurplus(db, first.periodId, first.delta); // resolved with the original $1000 surplus

  await deleteExpense(db, oldExpense.id); // period now has a $5000 surplus, only $1000 was ever allocated

  const pending = await reconcilePayPeriods(db);
  expect(pending).toHaveLength(1);
  expect(pending[0].delta).toBe(4000);
});

test('a retroactive addition of an expense inside a resolved period surfaces the new deficit', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 3000, type: 'fixed_monthly', date: '2026-06-06', note: null });
  await logExpense(db, { amount: 3500, categoryId: null, date: '2026-06-20', note: null, isRecurring: false });
  await logIncome(db, { amount: 3000, type: 'fixed_monthly', date: '2026-07-06', note: null });

  const [first] = await reconcilePayPeriods(db);
  expect(first.delta).toBe(-500);
  await addCoveredDeficit(db, first.periodId, -first.delta); // fully acknowledged the original $500 deficit

  expect(await reconcilePayPeriods(db)).toHaveLength(0);

  await logExpense(db, { amount: 200, categoryId: null, date: '2026-06-25', note: null, isRecurring: false }); // period now has a $700 deficit, only $500 was ever covered

  const pending = await reconcilePayPeriods(db);
  expect(pending).toHaveLength(1);
  expect(pending[0].delta).toBe(-200);
});

test('income and expenses on the boundary date count toward the period that starts there, not the one that ends there', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-06-06', note: null });
  await logExpense(db, { amount: 100, categoryId: null, date: '2026-07-06', note: null, isRecurring: false });
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-07-06', note: null });
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-08-06', note: null });

  const pending = await reconcilePayPeriods(db);
  const juneToJuly = pending.find((p) => p.start === '2026-06-06');
  expect(juneToJuly?.delta).toBe(5000); // the Jul 6 expense/income belong to the next period
});
