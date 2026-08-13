import { eq } from 'drizzle-orm';
import { categories, type Category, type NewCategory } from '../db/schema';
import type { AppDb } from '../db/testDb';

export async function createCategory(db: AppDb, input: Omit<NewCategory, 'id'>): Promise<Category> {
  const [row] = await db.insert(categories).values(input).returning();
  return row;
}

export async function listCategories(db: AppDb): Promise<Category[]> {
  return db.select().from(categories);
}

export async function getCategory(db: AppDb, id: number): Promise<Category | undefined> {
  const [row] = await db.select().from(categories).where(eq(categories.id, id));
  return row;
}

export async function updateCategory(
  db: AppDb,
  id: number,
  input: Partial<Omit<NewCategory, 'id'>>,
): Promise<Category> {
  const [row] = await db.update(categories).set(input).where(eq(categories.id, id)).returning();
  return row;
}

export async function deleteCategory(db: AppDb, id: number): Promise<void> {
  await db.delete(categories).where(eq(categories.id, id));
}
