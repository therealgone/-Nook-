import type { AppDb } from '../db/types';
import type { Expense, PiggyBank, PiggyBankTransaction } from '../db/schema';
import { getPiggyBank, setPiggyBankStatus, setPiggyBankTargetPrice } from '../repositories/piggyBanks';
import { getSavedAmount, recordTransaction } from '../repositories/piggyBankTransactions';
import { logExpense } from '../repositories/expenses';

async function requirePiggyBank(db: AppDb, id: number): Promise<PiggyBank> {
  const bank = await getPiggyBank(db, id);
  if (!bank) throw new Error(`Piggy bank ${id} not found`);
  return bank;
}

export async function cancelPiggyBank(
  db: AppDb,
  id: number,
): Promise<{ piggyBank: PiggyBank; refund: PiggyBankTransaction }> {
  await requirePiggyBank(db, id);
  const saved = await getSavedAmount(db, id);
  const refund = await recordTransaction(db, {
    piggyBankId: id,
    type: 'withdrawal',
    source: 'cancel_refund',
    amount: saved,
  });
  const piggyBank = await setPiggyBankStatus(db, id, 'cancelled', {
    cancelledAt: new Date().toISOString(),
  });
  return { piggyBank, refund };
}

export async function changeTargetPrice(
  db: AppDb,
  id: number,
  newTargetPrice: number,
): Promise<{ piggyBank: PiggyBank; refund?: PiggyBankTransaction }> {
  await requirePiggyBank(db, id);
  const saved = await getSavedAmount(db, id);
  const piggyBank = await setPiggyBankTargetPrice(db, id, newTargetPrice);

  if (saved > newTargetPrice) {
    const excess = saved - newTargetPrice;
    const refund = await recordTransaction(db, {
      piggyBankId: id,
      type: 'withdrawal',
      source: 'price_decrease_refund',
      amount: excess,
    });
    return { piggyBank, refund };
  }

  return { piggyBank };
}

export async function markAsPurchased(
  db: AppDb,
  id: number,
  date: string,
): Promise<{ piggyBank: PiggyBank; expense: Expense }> {
  const bank = await requirePiggyBank(db, id);
  const saved = await getSavedAmount(db, id);
  if (saved < bank.targetPrice) {
    throw new Error(`Piggy bank ${id} is not fully funded yet (${saved}/${bank.targetPrice})`);
  }

  const expense = await logExpense(db, {
    amount: bank.targetPrice,
    categoryId: null,
    date,
    note: `Purchased: ${bank.productName}`,
    isRecurring: false,
  });

  const piggyBank = await setPiggyBankStatus(db, id, 'purchased', {
    purchasedAt: new Date().toISOString(),
  });

  return { piggyBank, expense };
}

export async function getProgress(
  db: AppDb,
  id: number,
): Promise<{ savedAmount: number; targetPrice: number; percent: number; readyToBuy: boolean }> {
  const bank = await requirePiggyBank(db, id);
  const savedAmount = await getSavedAmount(db, id);
  const percent = bank.targetPrice === 0 ? 100 : Math.min(100, (savedAmount / bank.targetPrice) * 100);
  return { savedAmount, targetPrice: bank.targetPrice, percent, readyToBuy: savedAmount >= bank.targetPrice };
}
