import type { AppDb } from '../db/types';
import { listCategories } from '../repositories/categories';

export async function getDailyBudgetTarget(db: AppDb): Promise<number> {
  const categories = await listCategories(db);
  let daily = 0;
  for (const category of categories) {
    if (category.budgetAmount === null) continue;
    if (category.budgetPeriod === 'monthly') daily += category.budgetAmount / 30;
    else if (category.budgetPeriod === 'weekly') daily += category.budgetAmount / 7;
  }
  return daily;
}
