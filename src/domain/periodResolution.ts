import type { AppDb } from '../db/types';
import { recordTransaction as recordPiggyBankTransaction } from '../repositories/piggyBankTransactions';
import { recordGeneralSavingsTransaction, getGeneralSavingsBalance } from '../repositories/generalSavings';
import { addAllocatedSurplus, addCoveredDeficit } from '../repositories/payPeriods';

export async function allocateSurplus(
  db: AppDb,
  periodId: number,
  delta: number,
  goal?: { piggyBankId: number; amount: number },
): Promise<void> {
  if (delta <= 0) {
    throw new Error('allocateSurplus requires a positive delta');
  }
  const goalAmount = goal?.amount ?? 0;
  const remainder = delta - goalAmount;
  const note = `Surplus allocation for period #${periodId}`;

  if (goalAmount > 0 && goal) {
    await recordPiggyBankTransaction(db, {
      piggyBankId: goal.piggyBankId,
      type: 'deposit',
      source: 'period_surplus',
      amount: goalAmount,
      note,
    });
  }
  if (remainder > 0) {
    await recordGeneralSavingsTransaction(db, {
      type: 'deposit',
      source: goalAmount > 0 ? 'period_surplus_overflow' : 'period_surplus',
      amount: remainder,
      note,
    });
  }
  await addAllocatedSurplus(db, periodId, delta);
}

export async function autoWithdrawDeficitFromPiggyBank(
  db: AppDb,
  periodId: number,
  amount: number,
): Promise<{ withdrawn: number; remaining: number }> {
  const balance = await getGeneralSavingsBalance(db);
  const withdrawn = Math.min(balance, amount);
  if (withdrawn > 0) {
    await recordGeneralSavingsTransaction(db, {
      type: 'withdrawal',
      source: 'period_deficit',
      amount: withdrawn,
      note: `Deficit cover for period #${periodId}`,
    });
    await addCoveredDeficit(db, periodId, withdrawn);
  }
  return { withdrawn, remaining: amount - withdrawn };
}

export async function borrowDeficitFromGoal(
  db: AppDb,
  periodId: number,
  piggyBankId: number,
  amount: number,
): Promise<void> {
  await recordPiggyBankTransaction(db, {
    piggyBankId,
    type: 'withdrawal',
    source: 'period_deficit',
    amount,
    note: `Deficit cover for period #${periodId}`,
  });
  await addCoveredDeficit(db, periodId, amount);
}

export async function acknowledgeUncoveredDeficit(db: AppDb, periodId: number, amount: number): Promise<void> {
  await addCoveredDeficit(db, periodId, amount);
}
