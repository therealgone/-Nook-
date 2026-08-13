import { createTestDb } from '../../db/testDb';
import { createCategory } from '../categories';
import { createThreshold, listThresholdsFor, deleteThreshold } from '../notificationThresholds';

test('creates and lists thresholds scoped to a category, or overall when categoryId is null', async () => {
  const db = createTestDb();
  const category = await createCategory(db, { name: 'Dining', icon: 'utensils', color: '#f59e0b', budgetAmount: 100, budgetPeriod: 'weekly' });
  await createThreshold(db, { categoryId: category.id, thresholdPct: 80 });
  await createThreshold(db, { categoryId: null, thresholdPct: 90 });

  expect(await listThresholdsFor(db, category.id)).toHaveLength(1);
  expect(await listThresholdsFor(db, null)).toHaveLength(1);
});

test('deletes a threshold', async () => {
  const db = createTestDb();
  const t = await createThreshold(db, { categoryId: null, thresholdPct: 90 });
  await deleteThreshold(db, t.id);
  expect(await listThresholdsFor(db, null)).toHaveLength(0);
});
