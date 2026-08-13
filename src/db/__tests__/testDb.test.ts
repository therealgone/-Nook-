import { createTestDb } from '../testDb';
import { categories } from '../schema';

test('creates all tables and round-trips a row', async () => {
  const db = createTestDb();
  await db.insert(categories).values({
    name: 'Groceries',
    icon: 'cart',
    color: '#22c55e',
    budgetAmount: 200,
    budgetPeriod: 'monthly',
  });
  const rows = await db.select().from(categories);
  expect(rows).toHaveLength(1);
  expect(rows[0].name).toBe('Groceries');
  expect(rows[0].budgetPeriod).toBe('monthly');
});
