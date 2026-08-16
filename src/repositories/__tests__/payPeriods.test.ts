import { createTestDb } from '../../db/testDb';
import {
  listPayPeriods,
  findPayPeriod,
  createPayPeriod,
  addAllocatedSurplus,
  addCoveredDeficit,
} from '../payPeriods';

test('creates and finds a pay period', async () => {
  const db = createTestDb();
  const created = await createPayPeriod(db, '2026-06-06', '2026-07-06');
  expect(created.allocatedSurplus).toBe(0);
  expect(created.coveredDeficit).toBe(0);

  const found = await findPayPeriod(db, '2026-06-06', '2026-07-06');
  expect(found?.id).toBe(created.id);
  expect(await listPayPeriods(db)).toHaveLength(1);
});

test('finding a period that does not exist returns undefined', async () => {
  const db = createTestDb();
  expect(await findPayPeriod(db, '2026-06-06', '2026-07-06')).toBeUndefined();
});

test('increments allocated surplus and covered deficit independently', async () => {
  const db = createTestDb();
  const period = await createPayPeriod(db, '2026-06-06', '2026-07-06');
  await addAllocatedSurplus(db, period.id, 1000);
  const afterDeficit = await addCoveredDeficit(db, period.id, 250);
  expect(afterDeficit.allocatedSurplus).toBe(1000);
  expect(afterDeficit.coveredDeficit).toBe(250);
});
