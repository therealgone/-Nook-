import { createTestDb } from '../../db/testDb';
import { createCategory } from '../../repositories/categories';
import { getDailyBudgetTarget } from '../dailyBudget';

test('sums monthly budgets as /30 and weekly budgets as /7', async () => {
  const db = createTestDb();
  await createCategory(db, { name: 'Rent', icon: 'home', color: '#000', budgetAmount: 300, budgetPeriod: 'monthly' });
  await createCategory(db, { name: 'Dining', icon: 'utensils', color: '#111', budgetAmount: 70, budgetPeriod: 'weekly' });

  const daily = await getDailyBudgetTarget(db);
  expect(daily).toBeCloseTo(300 / 30 + 70 / 7);
});

test('ignores categories with no budget limit', async () => {
  const db = createTestDb();
  await createCategory(db, { name: 'Misc', icon: 'tag', color: '#222', budgetAmount: null, budgetPeriod: null });

  const daily = await getDailyBudgetTarget(db);
  expect(daily).toBe(0);
});
