import { createTestDb } from '../../db/testDb';
import { logExpense } from '../../repositories/expenses';
import { createCategory } from '../../repositories/categories';
import { getPeriodSpend, heatmapColorForPercent } from '../budgetPeriods';

test('computes spend and percent used for a period', async () => {
  const db = createTestDb();
  const category = await createCategory(db, { name: 'Dining', icon: 'utensils', color: '#f59e0b', budgetAmount: 100, budgetPeriod: 'weekly' });
  await logExpense(db, { amount: 20, categoryId: category.id, date: '2026-08-05', note: null, isRecurring: false });
  await logExpense(db, { amount: 30, categoryId: category.id, date: '2026-08-07', note: null, isRecurring: false });
  await logExpense(db, { amount: 999, categoryId: category.id, date: '2026-09-01', note: null, isRecurring: false });

  const result = await getPeriodSpend(db, '2026-08-01', '2026-08-31', 100);
  expect(result.spentAmount).toBe(50);
  expect(result.percentUsed).toBe(50);
});

test.each([
  [0, 'green'],
  [49, 'green'],
  [50, 'orange'],
  [89, 'orange'],
  [90, 'red'],
  [100, 'red'],
  [101, 'over'],
  [250, 'over'],
])('heatmapColorForPercent(%i) -> %s', (percent, expected) => {
  expect(heatmapColorForPercent(percent)).toBe(expected);
});
