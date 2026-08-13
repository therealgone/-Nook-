import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  currency: text('currency').notNull().default('USD'),
  onboardingComplete: integer('onboarding_complete', { mode: 'boolean' }).notNull().default(false),
});
export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;

export const incomeEntries = sqliteTable('income_entries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  amount: real('amount').notNull(),
  type: text('type', { enum: ['fixed_monthly', 'bonus', 'adjustment'] }).notNull(),
  date: text('date').notNull(),
  note: text('note'),
});
export type IncomeEntry = typeof incomeEntries.$inferSelect;
export type NewIncomeEntry = typeof incomeEntries.$inferInsert;

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  budgetAmount: real('budget_amount').notNull(),
  budgetPeriod: text('budget_period', { enum: ['weekly', 'monthly'] }).notNull(),
});
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export const expenses = sqliteTable('expenses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  amount: real('amount').notNull(),
  categoryId: integer('category_id').references(() => categories.id),
  date: text('date').notNull(),
  note: text('note'),
  isRecurring: integer('is_recurring', { mode: 'boolean' }).notNull().default(false),
});
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;

export const recurringPayments = sqliteTable('recurring_payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  label: text('label').notNull(),
  amount: real('amount').notNull(),
  categoryId: integer('category_id').notNull().references(() => categories.id),
  frequency: text('frequency', { enum: ['weekly', 'monthly', 'yearly'] }).notNull(),
  nextDueDate: text('next_due_date').notNull(),
});
export type RecurringPayment = typeof recurringPayments.$inferSelect;
export type NewRecurringPayment = typeof recurringPayments.$inferInsert;

export const notificationThresholds = sqliteTable('notification_thresholds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  categoryId: integer('category_id').references(() => categories.id),
  thresholdPct: real('threshold_pct').notNull(),
});
export type NotificationThreshold = typeof notificationThresholds.$inferSelect;
export type NewNotificationThreshold = typeof notificationThresholds.$inferInsert;

export const piggyBanks = sqliteTable('piggy_banks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productName: text('product_name').notNull(),
  photoUri: text('photo_uri'),
  targetPrice: real('target_price').notNull(),
  targetDate: text('target_date'),
  status: text('status', { enum: ['active', 'purchased', 'cancelled'] }).notNull().default('active'),
  createdAt: text('created_at').notNull(),
  purchasedAt: text('purchased_at'),
  cancelledAt: text('cancelled_at'),
});
export type PiggyBank = typeof piggyBanks.$inferSelect;
export type NewPiggyBank = typeof piggyBanks.$inferInsert;

export const piggyBankTransactions = sqliteTable('piggy_bank_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  piggyBankId: integer('piggy_bank_id').notNull().references(() => piggyBanks.id),
  type: text('type', { enum: ['deposit', 'withdrawal'] }).notNull(),
  source: text('source', {
    enum: [
      'manual',
      'sweep',
      'bonus',
      'deficit_borrow',
      'income_correction',
      'price_decrease_refund',
      'cancel_refund',
    ],
  }).notNull(),
  amount: real('amount').notNull(),
  relatedExpenseId: integer('related_expense_id'),
  relatedIncomeId: integer('related_income_id'),
  note: text('note'),
  createdAt: text('created_at').notNull(),
});
export type PiggyBankTransaction = typeof piggyBankTransactions.$inferSelect;
export type NewPiggyBankTransaction = typeof piggyBankTransactions.$inferInsert;
