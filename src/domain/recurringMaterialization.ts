import type { AppDb } from '../db/types';
import type { Expense } from '../db/schema';
import { listRecurringPayments, updateRecurringPayment } from '../repositories/recurringPayments';
import { logExpense } from '../repositories/expenses';
import { advanceDate } from './recurrence';

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
