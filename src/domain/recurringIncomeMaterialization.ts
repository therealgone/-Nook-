import type { AppDb } from '../db/types';
import type { IncomeEntry } from '../db/schema';
import { listRecurringIncome, updateRecurringIncome } from '../repositories/recurringIncome';
import { logIncome } from '../repositories/income';
import { advanceDate } from './recurrence';

export async function materializeDueIncome(db: AppDb, today: string): Promise<IncomeEntry[]> {
  const schedules = await listRecurringIncome(db);
  const created: IncomeEntry[] = [];

  for (const schedule of schedules) {
    let dueDate = schedule.nextDueDate;
    while (dueDate <= today) {
      const entry = await logIncome(db, {
        amount: schedule.amount,
        type: 'fixed_monthly',
        date: dueDate,
        note: schedule.note,
      });
      created.push(entry);
      dueDate = advanceDate(dueDate, schedule.frequency);
    }
    if (dueDate !== schedule.nextDueDate) {
      await updateRecurringIncome(db, schedule.id, { nextDueDate: dueDate });
    }
  }

  return created;
}
