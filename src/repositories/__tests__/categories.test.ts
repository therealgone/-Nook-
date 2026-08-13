import { createTestDb } from '../../db/testDb';
import {
  createCategory,
  listCategories,
  getCategory,
  updateCategory,
  deleteCategory,
} from '../categories';

test('creates and lists categories', async () => {
  const db = createTestDb();
  await createCategory(db, { name: 'Dining', icon: 'utensils', color: '#f59e0b', budgetAmount: 100, budgetPeriod: 'weekly' });
  const all = await listCategories(db);
  expect(all).toHaveLength(1);
  expect(all[0].name).toBe('Dining');
});

test('gets a category by id', async () => {
  const db = createTestDb();
  const created = await createCategory(db, { name: 'Transport', icon: 'car', color: '#3b82f6', budgetAmount: 50, budgetPeriod: 'weekly' });
  const found = await getCategory(db, created.id);
  expect(found?.name).toBe('Transport');
});

test('updates a category', async () => {
  const db = createTestDb();
  const created = await createCategory(db, { name: 'Utilities', icon: 'bolt', color: '#eab308', budgetAmount: 80, budgetPeriod: 'monthly' });
  const updated = await updateCategory(db, created.id, { budgetAmount: 120 });
  expect(updated.budgetAmount).toBe(120);
});

test('deletes a category', async () => {
  const db = createTestDb();
  const created = await createCategory(db, { name: 'Misc', icon: 'tag', color: '#a855f7', budgetAmount: 30, budgetPeriod: 'weekly' });
  await deleteCategory(db, created.id);
  expect(await getCategory(db, created.id)).toBeUndefined();
});
