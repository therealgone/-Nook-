import type { AppDb } from '../db/types';
import { totalIncome } from '../repositories/income';
import { totalExpenses } from '../repositories/expenses';
import { getTotalActiveSavings } from '../repositories/piggyBankTransactions';
import { getGeneralSavingsBalance } from '../repositories/generalSavings';

export async function calculateFreeBalance(db: AppDb): Promise<number> {
  const income = await totalIncome(db);
  const expenses = await totalExpenses(db);
  const lockedSavings = await getTotalActiveSavings(db);
  const generalSavings = await getGeneralSavingsBalance(db);
  return income - expenses - lockedSavings - generalSavings;
}
