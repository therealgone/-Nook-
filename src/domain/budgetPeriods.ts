import type { AppDb } from '../db/types';
import { totalExpenses } from '../repositories/expenses';

export interface PeriodSpend {
  spentAmount: number;
  targetAmount: number;
  percentUsed: number;
}

export async function getPeriodSpend(
  db: AppDb,
  from: string,
  to: string,
  targetAmount: number,
  categoryId?: number,
): Promise<PeriodSpend> {
  const spentAmount = await totalExpenses(db, { from, to, categoryId });
  const percentUsed = targetAmount === 0 ? 0 : (spentAmount / targetAmount) * 100;
  return { spentAmount, targetAmount, percentUsed };
}

export function heatmapColorForPercent(percentUsed: number): 'green' | 'orange' | 'red' | 'over' {
  if (percentUsed > 100) return 'over';
  if (percentUsed >= 90) return 'red';
  if (percentUsed >= 50) return 'orange';
  return 'green';
}
