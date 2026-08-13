import { eq } from 'drizzle-orm';
import { piggyBanks, type PiggyBank } from '../db/schema';
import type { AppDb } from '../db/testDb';

export interface CreatePiggyBankInput {
  productName: string;
  photoUri?: string | null;
  targetPrice: number;
  targetDate?: string | null;
}

export async function createPiggyBank(db: AppDb, input: CreatePiggyBankInput): Promise<PiggyBank> {
  const [row] = await db
    .insert(piggyBanks)
    .values({
      productName: input.productName,
      photoUri: input.photoUri ?? null,
      targetPrice: input.targetPrice,
      targetDate: input.targetDate ?? null,
      status: 'active',
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

export async function listPiggyBanks(db: AppDb, status?: PiggyBank['status']): Promise<PiggyBank[]> {
  return status ? db.select().from(piggyBanks).where(eq(piggyBanks.status, status)) : db.select().from(piggyBanks);
}

export async function getPiggyBank(db: AppDb, id: number): Promise<PiggyBank | undefined> {
  const [row] = await db.select().from(piggyBanks).where(eq(piggyBanks.id, id));
  return row;
}

export async function setPiggyBankStatus(
  db: AppDb,
  id: number,
  status: PiggyBank['status'],
  extra?: Partial<PiggyBank>,
): Promise<PiggyBank> {
  const [row] = await db
    .update(piggyBanks)
    .set({ status, ...extra })
    .where(eq(piggyBanks.id, id))
    .returning();
  return row;
}

export async function setPiggyBankTargetPrice(db: AppDb, id: number, targetPrice: number): Promise<PiggyBank> {
  const [row] = await db.update(piggyBanks).set({ targetPrice }).where(eq(piggyBanks.id, id)).returning();
  return row;
}
