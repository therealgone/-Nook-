import { createTestDb } from '../../db/testDb';
import { logIncome } from '../../repositories/income';
import { logExpense } from '../../repositories/expenses';
import { createPiggyBank } from '../../repositories/piggyBanks';
import { getSavedAmount } from '../../repositories/piggyBankTransactions';
import {
  handleExpenseAmountChanged,
  borrowFromPiggyBank,
  sweepToPiggyBank,
  handleIncomeAmountChanged,
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

test('reducing past income with enough free balance elsewhere makes no piggy bank adjustment', async () => {
  const db = createTestDb();
  const income = await logIncome(db, { amount: 1000, type: 'fixed_monthly', date: '2026-07-01', note: null });
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await sweepToPiggyBank(db, bank.id, 100);

  const result = await handleIncomeAmountChanged(db, income.id, 900);
  expect(result.adjustments).toHaveLength(0);
  expect(await getSavedAmount(db, bank.id)).toBe(100);
});

test('reducing past income below what was allocated pulls the deficit from the most-recently-funded piggy bank first', async () => {
  const db = createTestDb();
  const income = await logIncome(db, { amount: 500, type: 'fixed_monthly', date: '2026-07-01', note: null });
  const older = await createPiggyBank(db, { productName: 'Older Goal', targetPrice: 500 });
  await sweepToPiggyBank(db, older.id, 200);
  const newer = await createPiggyBank(db, { productName: 'Newer Goal', targetPrice: 500 });
  await sweepToPiggyBank(db, newer.id, 200);

  // Free Balance is currently 500 - 400 = 100. Reducing income to 350 creates a 50 deficit.
  const result = await handleIncomeAmountChanged(db, income.id, 350);
  expect(result.adjustments).toHaveLength(1);
  expect(result.adjustments[0].piggyBankId).toBe(newer.id);
  expect(result.adjustments[0].source).toBe('income_correction');
  expect(result.adjustments[0].amount).toBe(50);
  expect(await getSavedAmount(db, newer.id)).toBe(150);
  expect(await getSavedAmount(db, older.id)).toBe(200);
});

test('a deficit larger than the most-recent bank spills over into the next most-recent bank', async () => {
  const db = createTestDb();
  const income = await logIncome(db, { amount: 500, type: 'fixed_monthly', date: '2026-07-01', note: null });
  const older = await createPiggyBank(db, { productName: 'Older Goal', targetPrice: 500 });
  await sweepToPiggyBank(db, older.id, 200);
  const newer = await createPiggyBank(db, { productName: 'Newer Goal', targetPrice: 500 });
  await sweepToPiggyBank(db, newer.id, 50);

  // Free Balance is 500 - 250 = 250. Reducing income to 100 creates a 150 deficit.
  const result = await handleIncomeAmountChanged(db, income.id, 100);
  expect(await getSavedAmount(db, newer.id)).toBe(0);
  expect(await getSavedAmount(db, older.id)).toBe(100);
  expect(result.adjustments.map((a) => a.piggyBankId)).toEqual([newer.id, older.id]);
});
