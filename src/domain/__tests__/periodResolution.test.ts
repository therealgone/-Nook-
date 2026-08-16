import { createTestDb } from '../../db/testDb';
import { createPiggyBank } from '../../repositories/piggyBanks';
import { getSavedAmount } from '../../repositories/piggyBankTransactions';
import { createPayPeriod } from '../../repositories/payPeriods';
import { getGeneralSavingsBalance, recordGeneralSavingsTransaction } from '../../repositories/generalSavings';
import {
  allocateSurplus,
  autoWithdrawDeficitFromPiggyBank,
  borrowDeficitFromGoal,
  acknowledgeUncoveredDeficit,
} from '../periodResolution';

test('allocates a surplus fully to the Piggy Bank when no goal is chosen', async () => {
  const db = createTestDb();
  const period = await createPayPeriod(db, '2026-06-06', '2026-07-06');

  await allocateSurplus(db, period.id, 1000);

  expect(await getGeneralSavingsBalance(db)).toBe(1000);
});

test('splits a surplus between a goal and the Piggy Bank, capping the goal at what it needs', async () => {
  const db = createTestDb();
  const period = await createPayPeriod(db, '2026-06-06', '2026-07-06');
  const goal = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 300 });

  await allocateSurplus(db, period.id, 500, { piggyBankId: goal.id, amount: 300 });

  expect(await getSavedAmount(db, goal.id)).toBe(300);
  expect(await getGeneralSavingsBalance(db)).toBe(200);
});

test('auto-withdraws from the Piggy Bank up to what it holds', async () => {
  const db = createTestDb();
  const period = await createPayPeriod(db, '2026-06-06', '2026-07-06');
  await recordGeneralSavingsTransaction(db, { type: 'deposit', source: 'period_surplus', amount: 150 });

  const result = await autoWithdrawDeficitFromPiggyBank(db, period.id, 500);

  expect(result).toEqual({ withdrawn: 150, remaining: 350 });
  expect(await getGeneralSavingsBalance(db)).toBe(0);
});

test('borrowing the deficit remainder from a goal records a withdrawal', async () => {
  const db = createTestDb();
  const period = await createPayPeriod(db, '2026-06-06', '2026-07-06');
  const goal = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 300 });

  await borrowDeficitFromGoal(db, period.id, goal.id, 100);

  expect(await getSavedAmount(db, goal.id)).toBe(-100);
});

test('acknowledging an uncovered deficit updates covered_deficit without moving funds', async () => {
  const db = createTestDb();
  const period = await createPayPeriod(db, '2026-06-06', '2026-07-06');

  await acknowledgeUncoveredDeficit(db, period.id, 75);

  expect(await getGeneralSavingsBalance(db)).toBe(0);
});
