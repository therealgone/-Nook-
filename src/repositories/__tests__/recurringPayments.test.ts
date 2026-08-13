import { createTestDb } from '../../db/testDb';
import { createCategory } from '../categories';
import {
  createRecurringPayment,
  listRecurringPayments,
  updateRecurringPayment,
  deleteRecurringPayment,
} from '../recurringPayments';

test('creates, lists, updates, and deletes recurring payments', async () => {
  const db = createTestDb();
  const category = await createCategory(db, { name: 'Subscriptions', icon: 'tv', color: '#8b5cf6', budgetAmount: 50, budgetPeriod: 'monthly' });
  const payment = await createRecurringPayment(db, {
    label: 'Netflix',
    amount: 15.99,
    categoryId: category.id,
    frequency: 'monthly',
    nextDueDate: '2026-09-01',
  });
  expect((await listRecurringPayments(db))).toHaveLength(1);

  const updated = await updateRecurringPayment(db, payment.id, { amount: 17.99 });
  expect(updated.amount).toBe(17.99);

  await deleteRecurringPayment(db, payment.id);
  expect((await listRecurringPayments(db))).toHaveLength(0);
});
