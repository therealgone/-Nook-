import { createTestDb } from '../../db/testDb';
import { logIncome, listIncome, updateIncome, deleteIncome, totalIncome } from '../income';

test('logs and lists income entries', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 4500, type: 'fixed_monthly', date: '2026-08-01', note: null });
  await logIncome(db, { amount: 300, type: 'bonus', date: '2026-08-10', note: 'referral bonus' });
  const all = await listIncome(db);
  expect(all).toHaveLength(2);
});

test('sums total income', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 4500, type: 'fixed_monthly', date: '2026-08-01', note: null });
  await logIncome(db, { amount: 300, type: 'bonus', date: '2026-08-10', note: null });
  expect(await totalIncome(db)).toBe(4800);
});

test('updates and deletes an income entry', async () => {
  const db = createTestDb();
  const entry = await logIncome(db, { amount: 4500, type: 'fixed_monthly', date: '2026-08-01', note: null });
  const updated = await updateIncome(db, entry.id, { amount: 4000 });
  expect(updated.amount).toBe(4000);
  await deleteIncome(db, entry.id);
  expect(await listIncome(db)).toHaveLength(0);
});
