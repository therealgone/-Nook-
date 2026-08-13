import { createTestDb } from '../../db/testDb';
import { logIncome } from '../../repositories/income';
import { logExpense } from '../../repositories/expenses';
import { createPiggyBank } from '../../repositories/piggyBanks';
import { recordTransaction } from '../../repositories/piggyBankTransactions';
import { calculateFreeBalance } from '../freeBalance';

test('Free Balance = income - expenses - active piggy bank savings', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 4500, type: 'fixed_monthly', date: '2026-08-01', note: null });
  await logExpense(db, { amount: 800, categoryId: null, date: '2026-08-05', note: null, isRecurring: false });
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'manual', amount: 200 });

  expect(await calculateFreeBalance(db)).toBe(4500 - 800 - 200);
});

test('a cancelled piggy bank does not lock funds out of Free Balance', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 1000, type: 'fixed_monthly', date: '2026-08-01', note: null });
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'manual', amount: 200 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'withdrawal', source: 'cancel_refund', amount: 200 });

  expect(await calculateFreeBalance(db)).toBe(1000);
});
