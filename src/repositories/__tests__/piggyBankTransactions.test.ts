import { createTestDb } from '../../db/testDb';
import { createPiggyBank, setPiggyBankStatus } from '../piggyBanks';
import {
  recordTransaction,
  listTransactions,
  getSavedAmount,
  getTotalActiveSavings,
  getLastTransactionDate,
} from '../piggyBankTransactions';

test('records deposits and withdrawals and computes saved amount', async () => {
  const db = createTestDb();
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'manual', amount: 100 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'sweep', amount: 30 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'withdrawal', source: 'cancel_refund', amount: 20 });

  expect(await getSavedAmount(db, bank.id)).toBe(110);
  expect(await listTransactions(db, bank.id)).toHaveLength(3);
});

test('sums saved amounts across active piggy banks, excluding cancelled ones', async () => {
  const db = createTestDb();
  const active = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  const alsoActive = await createPiggyBank(db, { productName: 'Watch', targetPrice: 400 });
  const cancelled = await createPiggyBank(db, { productName: 'Old Goal', targetPrice: 100 });
  await recordTransaction(db, { piggyBankId: active.id, type: 'deposit', source: 'manual', amount: 100 });
  await recordTransaction(db, { piggyBankId: alsoActive.id, type: 'deposit', source: 'manual', amount: 50 });
  await recordTransaction(db, { piggyBankId: cancelled.id, type: 'deposit', source: 'manual', amount: 999 });
  await setPiggyBankStatus(db, cancelled.id, 'cancelled', { cancelledAt: '2026-08-13T00:00:00.000Z' });

  expect(await getTotalActiveSavings(db)).toBe(150);
});

test('returns the timestamp of the most recent transaction', async () => {
  const db = createTestDb();
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  expect(await getLastTransactionDate(db, bank.id)).toBeUndefined();
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'manual', amount: 10 });
  expect(await getLastTransactionDate(db, bank.id)).toBeTruthy();
});
