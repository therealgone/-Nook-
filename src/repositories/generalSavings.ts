import { generalSavingsTransactions, type GeneralSavingsTransaction } from '../db/schema';
import type { AppDb } from '../db/types';

export interface RecordGeneralSavingsInput {
  type: GeneralSavingsTransaction['type'];
  source: GeneralSavingsTransaction['source'];
  amount: number;
  note?: string | null;
}

export async function recordGeneralSavingsTransaction(
  db: AppDb,
  input: RecordGeneralSavingsInput,
): Promise<GeneralSavingsTransaction> {
  const [row] = await db
    .insert(generalSavingsTransactions)
    .values({
      type: input.type,
      source: input.source,
      amount: input.amount,
      note: input.note ?? null,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

export async function listGeneralSavingsTransactions(db: AppDb): Promise<GeneralSavingsTransaction[]> {
  return db.select().from(generalSavingsTransactions);
}

export async function getGeneralSavingsBalance(db: AppDb): Promise<number> {
  const rows = await listGeneralSavingsTransactions(db);
  return rows.reduce((sum, tx) => sum + (tx.type === 'deposit' ? tx.amount : -tx.amount), 0);
}
