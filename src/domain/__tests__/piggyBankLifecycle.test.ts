import { createTestDb } from '../../db/testDb';
import { createPiggyBank, getPiggyBank } from '../../repositories/piggyBanks';
import { recordTransaction, getSavedAmount } from '../../repositories/piggyBankTransactions';
import { calculateFreeBalance } from '../freeBalance';
import { cancelPiggyBank, changeTargetPrice, markAsPurchased, getProgress } from '../piggyBankLifecycle';

test('cancelling a goal refunds 100% of saved funds and marks it cancelled', async () => {
  const db = createTestDb();
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'manual', amount: 150 });

  const { piggyBank, refund } = await cancelPiggyBank(db, bank.id);
  expect(piggyBank.status).toBe('cancelled');
  expect(refund.amount).toBe(150);
  expect(refund.source).toBe('cancel_refund');
  expect(await getSavedAmount(db, bank.id)).toBe(0);
});

test('raising the target price only changes the percent, not the saved amount', async () => {
  const db = createTestDb();
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'manual', amount: 150 });

  const { piggyBank, refund } = await changeTargetPrice(db, bank.id, 300);
  expect(piggyBank.targetPrice).toBe(300);
  expect(refund).toBeUndefined();
  const progress = await getProgress(db, bank.id);
  expect(progress.percent).toBeCloseTo(50);
});

test('dropping the target price below the saved amount refunds the excess and hits 100%', async () => {
  const db = createTestDb();
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'manual', amount: 150 });

  const { piggyBank, refund } = await changeTargetPrice(db, bank.id, 100);
  expect(refund?.amount).toBe(50);
  expect(refund?.source).toBe('price_decrease_refund');
  const progress = await getProgress(db, piggyBank.id);
  expect(progress.percent).toBe(100);
  expect(progress.readyToBuy).toBe(true);
});

test('marking a fully-funded goal as purchased creates a real expense and zeroes out net Free Balance impact', async () => {
  const db = createTestDb();
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'manual', amount: 250 });
  const freeBalanceBefore = await calculateFreeBalance(db);

  const { piggyBank, expense } = await markAsPurchased(db, bank.id, '2026-08-13');
  expect(piggyBank.status).toBe('purchased');
  expect(expense.amount).toBe(250);
  expect(expense.categoryId).toBeNull();

  const freeBalanceAfter = await calculateFreeBalance(db);
  expect(freeBalanceAfter).toBe(freeBalanceBefore);
});

test('marking an under-funded goal as purchased throws', async () => {
  const db = createTestDb();
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'manual', amount: 100 });
  await expect(markAsPurchased(db, bank.id, '2026-08-13')).rejects.toThrow();
});
