import type { AppDb } from '../db/types';
import { totalIncome } from '../repositories/income';
import { totalExpenses } from '../repositories/expenses';
import { getTotalActiveSavings } from '../repositories/piggyBankTransactions';

export async function calculateFreeBalance(db: AppDb): Promise<number> {
  const income = await totalIncome(db);
  const expenses = await totalExpenses(db);
  const lockedSavings = await getTotalActiveSavings(db);
  return income - expenses - lockedSavings;
}
