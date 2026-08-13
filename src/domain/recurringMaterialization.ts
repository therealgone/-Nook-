import type { AppDb } from '../db/testDb';
import type { Expense, RecurringPayment } from '../db/schema';
import { listRecurringPayments, updateRecurringPayment } from '../repositories/recurringPayments';
import { logExpense } from '../repositories/expenses';

function advanceDate(date: string, frequency: RecurringPayment['frequency']): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  if (frequency === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else if (frequency === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

export async function materializeDuePayments(db: AppDb, today: string): Promise<Expense[]> {
  const payments = await listRecurringPayments(db);
  const created: Expense[] = [];

  for (const payment of payments) {
    let dueDate = payment.nextDueDate;
    while (dueDate <= today) {
      const expense = await logExpense(db, {
        amount: payment.amount,
        categoryId: payment.categoryId,
        date: dueDate,
        note: payment.label,
        isRecurring: true,
      });
      created.push(expense);
      dueDate = advanceDate(dueDate, payment.frequency);
    }
    if (dueDate !== payment.nextDueDate) {
      await updateRecurringPayment(db, payment.id, { nextDueDate: dueDate });
    }
  }

  return created;
}
