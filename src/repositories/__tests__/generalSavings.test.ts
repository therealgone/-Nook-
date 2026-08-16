import { createTestDb } from '../../db/testDb';
import {
  recordGeneralSavingsTransaction,
  listGeneralSavingsTransactions,
  getGeneralSavingsBalance,
} from '../generalSavings';

test('records deposits and withdrawals and computes the balance', async () => {
  const db = createTestDb();
  await recordGeneralSavingsTransaction(db, { type: 'deposit', source: 'period_surplus', amount: 100 });
  await recordGeneralSavingsTransaction(db, { type: 'deposit', source: 'period_surplus_overflow', amount: 30 });
  await recordGeneralSavingsTransaction(db, { type: 'withdrawal', source: 'period_deficit', amount: 20 });

  expect(await getGeneralSavingsBalance(db)).toBe(110);
  expect(await listGeneralSavingsTransactions(db)).toHaveLength(3);
});

test('balance is zero with no transactions', async () => {
  const db = createTestDb();
  expect(await getGeneralSavingsBalance(db)).toBe(0);
});
