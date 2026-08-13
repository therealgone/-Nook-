import { eq } from 'drizzle-orm';
import { piggyBanks, piggyBankTransactions, type PiggyBankTransaction } from '../db/schema';
import type { AppDb } from '../db/testDb';

export interface RecordTransactionInput {
  piggyBankId: number;
  type: PiggyBankTransaction['type'];
  source: PiggyBankTransaction['source'];
  amount: number;
  relatedExpenseId?: number | null;
  relatedIncomeId?: number | null;
  note?: string | null;
}

export async function recordTransaction(db: AppDb, input: RecordTransactionInput): Promise<PiggyBankTransaction> {
  const [row] = await db
    .insert(piggyBankTransactions)
    .values({
      piggyBankId: input.piggyBankId,
      type: input.type,
      source: input.source,
      amount: input.amount,
      relatedExpenseId: input.relatedExpenseId ?? null,
      relatedIncomeId: input.relatedIncomeId ?? null,
      note: input.note ?? null,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

export async function listTransactions(db: AppDb, piggyBankId: number): Promise<PiggyBankTransaction[]> {
  return db.select().from(piggyBankTransactions).where(eq(piggyBankTransactions.piggyBankId, piggyBankId));
}

export async function getSavedAmount(db: AppDb, piggyBankId: number): Promise<number> {
  const rows = await listTransactions(db, piggyBankId);
  return rows.reduce((sum, tx) => sum + (tx.type === 'deposit' ? tx.amount : -tx.amount), 0);
}

export async function getTotalActiveSavings(db: AppDb): Promise<number> {
  const activeBanks = await db.select().from(piggyBanks).where(eq(piggyBanks.status, 'active'));
  let total = 0;
  for (const bank of activeBanks) {
    total += await getSavedAmount(db, bank.id);
  }
  return total;
}

export async function getLastTransactionDate(db: AppDb, piggyBankId: number): Promise<string | undefined> {
  const rows = await listTransactions(db, piggyBankId);
  if (rows.length === 0) return undefined;
  return rows.map((row) => row.createdAt).sort().at(-1);
}
