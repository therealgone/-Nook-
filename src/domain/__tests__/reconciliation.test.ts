import { createTestDb } from '../../db/testDb';
import { logIncome } from '../../repositories/income';
import { logExpense } from '../../repositories/expenses';
import { createPiggyBank } from '../../repositories/piggyBanks';
import { getSavedAmount } from '../../repositories/piggyBankTransactions';
import {
  handleExpenseAmountChanged,
  borrowFromPiggyBank,
  sweepToPiggyBank,
} from '../reconciliation';

test('increasing an expense within available funds reports no deficit and no sweep', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 1000, type: 'fixed_monthly', date: '2026-08-01', note: null });
  const expense = await logExpense(db, { amount: 100, categoryId: null, date: '2026-08-05', note: null, isRecurring: false });

  const result = await handleExpenseAmountChanged(db, expense.id, 150);
  expect(result.deficit).toBe(0);
  expect(result.sweepAvailable).toBe(0);
  expect(result.expense.amount).toBe(150);
});

test('increasing an expense past available funds reports the deficit', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 100, type: 'fixed_monthly', date: '2026-08-01', note: null });
  const expense = await logExpense(db, { amount: 50, categoryId: null, date: '2026-08-05', note: null, isRecurring: false });

  const result = await handleExpenseAmountChanged(db, expense.id, 130);
  expect(result.deficit).toBe(30);
});

test('decreasing an expense reports the newly freed amount as sweepAvailable', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 1000, type: 'fixed_monthly', date: '2026-08-01', note: null });
  const expense = await logExpense(db, { amount: 100, categoryId: null, date: '2026-08-05', note: null, isRecurring: false });

  const result = await handleExpenseAmountChanged(db, expense.id, 70);
  expect(result.sweepAvailable).toBe(30);
  expect(result.deficit).toBe(0);
});

test('borrowing from a piggy bank records a deficit_borrow withdrawal', async () => {
  const db = createTestDb();
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await sweepToPiggyBank(db, bank.id, 100);
  expect(await getSavedAmount(db, bank.id)).toBe(100);

  const tx = await borrowFromPiggyBank(db, bank.id, 40, 999);
  expect(tx.source).toBe('deficit_borrow');
  expect(tx.relatedExpenseId).toBe(999);
  expect(await getSavedAmount(db, bank.id)).toBe(60);
});
