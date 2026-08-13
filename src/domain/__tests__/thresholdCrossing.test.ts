import { findNewlyCrossedThresholds } from '../thresholdCrossing';
import type { NotificationThreshold } from '../../db/schema';

const thresholds: NotificationThreshold[] = [
  { id: 1, categoryId: null, thresholdPct: 80 },
  { id: 2, categoryId: null, thresholdPct: 100 },
];

test('returns thresholds newly crossed between two percent readings', () => {
  const crossed = findNewlyCrossedThresholds(thresholds, 70, 85);
  expect(crossed.map((t) => t.id)).toEqual([1]);
});

test('returns multiple thresholds if a single expense jumps past more than one', () => {
  const crossed = findNewlyCrossedThresholds(thresholds, 70, 120);
  expect(crossed.map((t) => t.id)).toEqual([1, 2]);
});

test('returns nothing if no threshold boundary was crossed', () => {
  const crossed = findNewlyCrossedThresholds(thresholds, 81, 85);
  expect(crossed).toEqual([]);
});
