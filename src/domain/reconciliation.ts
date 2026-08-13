import type { AppDb } from '../db/testDb';
import type { Expense, PiggyBankTransaction } from '../db/schema';
import { getExpense, updateExpense } from '../repositories/expenses';
import { recordTransaction } from '../repositories/piggyBankTransactions';
import { calculateFreeBalance } from './freeBalance';

export async function handleExpenseAmountChanged(
  db: AppDb,
  expenseId: number,
  newAmount: number,
): Promise<{ expense: Expense; deficit: number; sweepAvailable: number }> {
  const before = await getExpense(db, expenseId);
  if (!before) throw new Error(`Expense ${expenseId} not found`);

  const freeBalanceBefore = await calculateFreeBalance(db);
  const expense = await updateExpense(db, expenseId, { amount: newAmount });
  const freeBalanceAfter = await calculateFreeBalance(db);

  const deficit = freeBalanceAfter < 0 ? -freeBalanceAfter : 0;
  const sweepAvailable = freeBalanceAfter > freeBalanceBefore ? freeBalanceAfter - freeBalanceBefore : 0;

  return { expense, deficit, sweepAvailable };
}

export async function borrowFromPiggyBank(
  db: AppDb,
  piggyBankId: number,
  amount: number,
  relatedExpenseId: number,
): Promise<PiggyBankTransaction> {
  return recordTransaction(db, {
    piggyBankId,
    type: 'withdrawal',
    source: 'deficit_borrow',
    amount,
    relatedExpenseId,
  });
}

export async function sweepToPiggyBank(
  db: AppDb,
  piggyBankId: number,
  amount: number,
  relatedExpenseId?: number,
): Promise<PiggyBankTransaction> {
  return recordTransaction(db, {
    piggyBankId,
    type: 'deposit',
    source: 'sweep',
    amount,
    relatedExpenseId: relatedExpenseId ?? null,
  });
}
