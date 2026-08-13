import { createTestDb } from '../../db/testDb';
import { createCategory } from '../../repositories/categories';
import { createRecurringPayment, listRecurringPayments } from '../../repositories/recurringPayments';
import { listExpenses } from '../../repositories/expenses';
import { materializeDuePayments } from '../recurringMaterialization';

test('materializes a due monthly payment as a real, editable expense and advances its due date', async () => {
  const db = createTestDb();
  const category = await createCategory(db, { name: 'Housing', icon: 'home', color: '#0ea5e9', budgetAmount: 1500, budgetPeriod: 'monthly' });
  await createRecurringPayment(db, {
    label: 'Rent',
    amount: 1200,
    categoryId: category.id,
    frequency: 'monthly',
    nextDueDate: '2026-08-01',
  });

  const created = await materializeDuePayments(db, '2026-08-13');
  expect(created).toHaveLength(1);
  expect(created[0].amount).toBe(1200);
  expect(created[0].isRecurring).toBe(true);
  expect(created[0].date).toBe('2026-08-01');

  const [payment] = await listRecurringPayments(db);
  expect(payment.nextDueDate).toBe('2026-09-01');
});

test('materializes every missed occurrence when the app has not been opened in a while', async () => {
  const db = createTestDb();
  const category = await createCategory(db, { name: 'Fitness', icon: 'dumbbell', color: '#22c55e', budgetAmount: 200, budgetPeriod: 'monthly' });
  await createRecurringPayment(db, {
    label: 'Gym',
    amount: 40,
    categoryId: category.id,
    frequency: 'weekly',
    nextDueDate: '2026-07-01',
  });

  const created = await materializeDuePayments(db, '2026-07-22');
  expect(created).toHaveLength(4);
  expect(created.map((e) => e.date)).toEqual(['2026-07-01', '2026-07-08', '2026-07-15', '2026-07-22']);
});

test('does not materialize a payment that is not yet due', async () => {
  const db = createTestDb();
  const category = await createCategory(db, { name: 'Insurance', icon: 'shield', color: '#f97316', budgetAmount: 100, budgetPeriod: 'monthly' });
  await createRecurringPayment(db, {
    label: 'Insurance',
    amount: 100,
    categoryId: category.id,
    frequency: 'yearly',
    nextDueDate: '2027-01-01',
  });

  const created = await materializeDuePayments(db, '2026-08-13');
  expect(created).toHaveLength(0);
  expect((await listExpenses(db))).toHaveLength(0);
});
