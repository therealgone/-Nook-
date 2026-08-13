import { createTestDb } from '../../db/testDb';
import {
  createPiggyBank,
  listPiggyBanks,
  getPiggyBank,
  setPiggyBankStatus,
  setPiggyBankTargetPrice,
} from '../piggyBanks';

test('creates a piggy bank as active with a createdAt timestamp', async () => {
  const db = createTestDb();
  const bank = await createPiggyBank(db, { productName: 'Sony Headphones', photoUri: 'file://photo.jpg', targetPrice: 250, targetDate: '2026-12-01' });
  expect(bank.status).toBe('active');
  expect(bank.createdAt).toBeTruthy();
});

test('lists piggy banks filtered by status', async () => {
  const db = createTestDb();
  const a = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await setPiggyBankStatus(db, a.id, 'cancelled', { cancelledAt: '2026-08-13T00:00:00.000Z' });
  await createPiggyBank(db, { productName: 'Watch', targetPrice: 400 });

  const active = await listPiggyBanks(db, 'active');
  expect(active).toHaveLength(1);
  expect(active[0].productName).toBe('Watch');

  const cancelled = await listPiggyBanks(db, 'cancelled');
  expect(cancelled).toHaveLength(1);
});

test('updates target price', async () => {
  const db = createTestDb();
  const bank = await createPiggyBank(db, { productName: 'Console', targetPrice: 500 });
  const updated = await setPiggyBankTargetPrice(db, bank.id, 600);
  expect(updated.targetPrice).toBe(600);
});

test('getPiggyBank returns undefined for a missing id', async () => {
  const db = createTestDb();
  expect(await getPiggyBank(db, 999)).toBeUndefined();
});
