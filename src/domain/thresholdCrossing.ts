import type { NotificationThreshold } from '../db/schema';

export function findNewlyCrossedThresholds(
  thresholds: NotificationThreshold[],
  previousPercent: number,
  newPercent: number,
): NotificationThreshold[] {
  return thresholds
    .filter((t) => previousPercent < t.thresholdPct && t.thresholdPct <= newPercent)
    .sort((a, b) => a.thresholdPct - b.thresholdPct);
}
