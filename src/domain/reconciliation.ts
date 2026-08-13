import type { AppDb } from '../db/testDb';
import type { Expense, PiggyBankTransaction, IncomeEntry } from '../db/schema';
import { getExpense, updateExpense } from '../repositories/expenses';
import { recordTransaction, getSavedAmount, getLastTransactionDate } from '../repositories/piggyBankTransactions';
import { updateIncome } from '../repositories/income';
import { listPiggyBanks } from '../repositories/piggyBanks';
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

export async function handleIncomeAmountChanged(
  db: AppDb,
  incomeId: number,
  newAmount: number,
): Promise<{ income: IncomeEntry; adjustments: PiggyBankTransaction[] }> {
  const income = await updateIncome(db, incomeId, { amount: newAmount });
  const adjustments: PiggyBankTransaction[] = [];

  let deficit = -(await calculateFreeBalance(db));
  if (deficit <= 0) return { income, adjustments };

  const activeBanks = await listPiggyBanks(db, 'active');
  const banksByRecency = await Promise.all(
    activeBanks.map(async (bank) => ({ bank, lastActivity: (await getLastTransactionDate(db, bank.id)) ?? '' })),
  );
  banksByRecency.sort((a, b) => {
    const dateCompare = b.lastActivity.localeCompare(a.lastActivity);
    if (dateCompare !== 0) return dateCompare;
    // Tiebreaker: prefer more recently created banks (higher id)
    return b.bank.id - a.bank.id;
  });

  for (const { bank } of banksByRecency) {
    if (deficit <= 0) break;
    const saved = await getSavedAmount(db, bank.id);
    const take = Math.min(saved, deficit);
    if (take <= 0) continue;
    const tx = await recordTransaction(db, {
      piggyBankId: bank.id,
      type: 'withdrawal',
      source: 'income_correction',
      amount: take,
      relatedIncomeId: incomeId,
      note: 'Adjusted due to income correction',
    });
    adjustments.push(tx);
    deficit -= take;
  }

  return { income, adjustments };
}
