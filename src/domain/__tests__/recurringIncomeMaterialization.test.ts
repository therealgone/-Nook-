import { createTestDb } from '../../db/testDb';
import { createRecurringIncome, listRecurringIncome } from '../../repositories/recurringIncome';
import { listIncome } from '../../repositories/income';
import { materializeDueIncome } from '../recurringIncomeMaterialization';

test('materializes a due monthly salary as a real income entry and advances its due date', async () => {
  const db = createTestDb();
  await createRecurringIncome(db, { amount: 4000, frequency: 'monthly', nextDueDate: '2026-06-10', note: 'Salary' });

  const created = await materializeDueIncome(db, '2026-07-15');
  expect(created).toHaveLength(2);
  expect(created.map((e) => e.date)).toEqual(['2026-06-10', '2026-07-10']);
  expect(created.every((e) => e.amount === 4000 && e.type === 'fixed_monthly')).toBe(true);

  const [schedule] = await listRecurringIncome(db);
  expect(schedule.nextDueDate).toBe('2026-08-10');
});

test('does not materialize income that is not yet due', async () => {
  const db = createTestDb();
  await createRecurringIncome(db, { amount: 500, frequency: 'monthly', nextDueDate: '2026-09-01', note: null });

  const created = await materializeDueIncome(db, '2026-08-13');
  expect(created).toHaveLength(0);
  expect((await listIncome(db))).toHaveLength(0);
});
