import { and, eq, isNull } from 'drizzle-orm';
import { notificationThresholds, type NotificationThreshold, type NewNotificationThreshold } from '../db/schema';
import type { AppDb } from '../db/testDb';

export async function createThreshold(
  db: AppDb,
  input: Omit<NewNotificationThreshold, 'id'>,
): Promise<NotificationThreshold> {
  const [row] = await db.insert(notificationThresholds).values(input).returning();
  return row;
}

export async function listThresholdsFor(db: AppDb, categoryId: number | null): Promise<NotificationThreshold[]> {
  const condition =
    categoryId === null
      ? isNull(notificationThresholds.categoryId)
      : eq(notificationThresholds.categoryId, categoryId);
  return db.select().from(notificationThresholds).where(condition);
}

export async function deleteThreshold(db: AppDb, id: number): Promise<void> {
  await db.delete(notificationThresholds).where(eq(notificationThresholds.id, id));
}
