# Engine & Data Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the entire data layer and business logic for the expense tracker — budgeting math, recurring payments, notification-threshold logic, and the full Piggy Bank reconciliation engine — as fully tested TypeScript modules, with zero UI.

**Architecture:** An Expo (React Native + TypeScript) project is scaffolded now since it's the eventual target, but this plan only ever touches `src/` (plain TypeScript, no React/React Native code). All persistence goes through Drizzle ORM's `drizzle-orm/sqlite-core` schema builder, which is driver-agnostic. For this plan, the *only* driver wired up is `better-sqlite3` running in-memory, via `src/db/testDb.ts` — this lets every module run under Jest with a real SQLite engine (real SQL, real constraints), not mocks. **Swapping in the production `expo-sqlite` driver is explicitly out of scope for this plan** — that happens in Plan 2 (bare-minimum UI), which will add `src/db/client.ts` using `drizzle-orm/expo-sqlite`. Because `db.select()/.insert()/.update()/.delete()` chains are awaitable the same way regardless of driver, no repository or domain function written in this plan needs to change for that swap — only a new client file gets added.

Repository modules (`src/repositories/*.ts`) are thin CRUD wrappers per table. Domain modules (`src/domain/*.ts`) contain the actual business rules (Free Balance, budget-period math, recurring materialization, notification-threshold crossing, Piggy Bank reconciliation) and are built on top of the repositories — never touch `db` directly beyond what the repositories expose.

**Tech Stack:** Expo (TypeScript template), `drizzle-orm`, `better-sqlite3` (dev-only, test driver), `jest` + `jest-expo` preset.

**Spec:** `docs/superpowers/specs/2026-08-13-expense-tracker-mvp-design.md`

## Global Constraints

- Single currency, no multi-currency/conversion logic anywhere (per spec §2).
- No app-level PIN/biometric lock (per spec §2).
- All monetary amounts are `real` (floating point) — no currency-subunit integer scaling in this MVP.
- All dates are ISO `YYYY-MM-DD` strings (no time component) unless a field is explicitly a timestamp (`created_at`, `purchased_at`, `cancelled_at`), which are full ISO-8601 datetime strings.
- `expenses.category_id` is **nullable** — Piggy Bank purchases (spec §6) create an expense with no category.
- Every repository/domain function that touches the DB is `async` and returns a `Promise`, even though the test driver (`better-sqlite3`) is synchronous under the hood — this keeps call sites identical after Plan 2 swaps in the genuinely-async `expo-sqlite` driver.

---

## Task 1: Project Scaffolding

**Files:**
- Create: whole Expo project structure (via `create-expo-app`)
- Modify: `package.json` (add `jest` config, deps)

**Interfaces:**
- Produces: a working `npm test` command; `src/` directory ready for Task 2.

- [ ] **Step 1: Scaffold the Expo TypeScript project in the current directory**

```bash
npx create-expo-app@latest . --template blank-typescript
```

If it refuses because the directory isn't empty (it contains `docs/` and `.git/`), scaffold into a temp folder and merge:

```bash
npx create-expo-app@latest money-tmp --template blank-typescript
# then move money-tmp's contents (except .git) up into the project root, and remove money-tmp
```

- [ ] **Step 2: Install data-layer and test dependencies**

```bash
npm install drizzle-orm
npm install -D better-sqlite3 @types/better-sqlite3 jest jest-expo @types/jest
```

- [ ] **Step 3: Configure Jest**

In `package.json`, add:

```json
{
  "scripts": {
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo",
    "testPathIgnorePatterns": ["/node_modules/", "/android/", "/ios/"]
  }
}
```

- [ ] **Step 4: Verify the project compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo project with drizzle-orm and jest-expo"
```

---

## Task 2: Database Schema, DDL, and Test DB Client

**Files:**
- Create: `src/db/schema.ts`
- Create: `src/db/ddl.ts`
- Create: `src/db/testDb.ts`
- Test: `src/db/__tests__/testDb.test.ts`

**Interfaces:**
- Produces: `schema.ts` exports table objects (`settings`, `incomeEntries`, `categories`, `expenses`, `recurringPayments`, `notificationThresholds`, `piggyBanks`, `piggyBankTransactions`) and their inferred `Select`/`Insert` types. `testDb.ts` exports `createTestDb(): AppDb` and `type AppDb`.

- [ ] **Step 1: Write the failing test**

`src/db/__tests__/testDb.test.ts`:

```ts
import { createTestDb } from '../testDb';
import { categories } from '../schema';

test('creates all tables and round-trips a row', async () => {
  const db = createTestDb();
  await db.insert(categories).values({
    name: 'Groceries',
    icon: 'cart',
    color: '#22c55e',
    budgetAmount: 200,
    budgetPeriod: 'monthly',
  });
  const rows = await db.select().from(categories);
  expect(rows).toHaveLength(1);
  expect(rows[0].name).toBe('Groceries');
  expect(rows[0].budgetPeriod).toBe('monthly');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest testDb.test.ts`
Expected: FAIL — `../testDb` (and `../schema`) don't exist yet.

- [ ] **Step 3: Write the schema**

`src/db/schema.ts`:

```ts
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
```

- [ ] **Step 4: Write the DDL**

`src/db/ddl.ts`:

```ts
export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  currency TEXT NOT NULL DEFAULT 'USD',
  onboarding_complete INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS income_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
  type TEXT NOT NULL,
  date TEXT NOT NULL,
  note TEXT
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  budget_amount REAL NOT NULL,
  budget_period TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  date TEXT NOT NULL,
  note TEXT,
  is_recurring INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS recurring_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  amount REAL NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  frequency TEXT NOT NULL,
  next_due_date TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notification_thresholds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER REFERENCES categories(id),
  threshold_pct REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS piggy_banks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_name TEXT NOT NULL,
  photo_uri TEXT,
  target_price REAL NOT NULL,
  target_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  purchased_at TEXT,
  cancelled_at TEXT
);
CREATE TABLE IF NOT EXISTS piggy_bank_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  piggy_bank_id INTEGER NOT NULL REFERENCES piggy_banks(id),
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  amount REAL NOT NULL,
  related_expense_id INTEGER,
  related_income_id INTEGER,
  note TEXT,
  created_at TEXT NOT NULL
);
`;
```

- [ ] **Step 5: Write the test DB client**

`src/db/testDb.ts`:

```ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { CREATE_TABLES_SQL } from './ddl';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.exec(CREATE_TABLES_SQL);
  return drizzle(sqlite, { schema });
}

export type AppDb = ReturnType<typeof createTestDb>;
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest testDb.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/db
git commit -m "feat: add drizzle schema, DDL, and in-memory test DB client"
```

---

## Task 3: Category Repository

**Files:**
- Create: `src/repositories/categories.ts`
- Test: `src/repositories/__tests__/categories.test.ts`

**Interfaces:**
- Consumes: `AppDb` from `../db/testDb`; `categories`, `Category`, `NewCategory` from `../db/schema`.
- Produces: `createCategory(db, input): Promise<Category>`, `listCategories(db): Promise<Category[]>`, `getCategory(db, id): Promise<Category | undefined>`, `updateCategory(db, id, input): Promise<Category>`, `deleteCategory(db, id): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

`src/repositories/__tests__/categories.test.ts`:

```ts
import { createTestDb } from '../../db/testDb';
import {
  createCategory,
  listCategories,
  getCategory,
  updateCategory,
  deleteCategory,
} from '../categories';

test('creates and lists categories', async () => {
  const db = createTestDb();
  await createCategory(db, { name: 'Dining', icon: 'utensils', color: '#f59e0b', budgetAmount: 100, budgetPeriod: 'weekly' });
  const all = await listCategories(db);
  expect(all).toHaveLength(1);
  expect(all[0].name).toBe('Dining');
});

test('gets a category by id', async () => {
  const db = createTestDb();
  const created = await createCategory(db, { name: 'Transport', icon: 'car', color: '#3b82f6', budgetAmount: 50, budgetPeriod: 'weekly' });
  const found = await getCategory(db, created.id);
  expect(found?.name).toBe('Transport');
});

test('updates a category', async () => {
  const db = createTestDb();
  const created = await createCategory(db, { name: 'Utilities', icon: 'bolt', color: '#eab308', budgetAmount: 80, budgetPeriod: 'monthly' });
  const updated = await updateCategory(db, created.id, { budgetAmount: 120 });
  expect(updated.budgetAmount).toBe(120);
});

test('deletes a category', async () => {
  const db = createTestDb();
  const created = await createCategory(db, { name: 'Misc', icon: 'tag', color: '#a855f7', budgetAmount: 30, budgetPeriod: 'weekly' });
  await deleteCategory(db, created.id);
  expect(await getCategory(db, created.id)).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest categories.test.ts`
Expected: FAIL — `../categories` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

`src/repositories/categories.ts`:

```ts
import { eq } from 'drizzle-orm';
import { categories, type Category, type NewCategory } from '../db/schema';
import type { AppDb } from '../db/testDb';

export async function createCategory(db: AppDb, input: Omit<NewCategory, 'id'>): Promise<Category> {
  const [row] = await db.insert(categories).values(input).returning();
  return row;
}

export async function listCategories(db: AppDb): Promise<Category[]> {
  return db.select().from(categories);
}

export async function getCategory(db: AppDb, id: number): Promise<Category | undefined> {
  const [row] = await db.select().from(categories).where(eq(categories.id, id));
  return row;
}

export async function updateCategory(
  db: AppDb,
  id: number,
  input: Partial<Omit<NewCategory, 'id'>>,
): Promise<Category> {
  const [row] = await db.update(categories).set(input).where(eq(categories.id, id)).returning();
  return row;
}

export async function deleteCategory(db: AppDb, id: number): Promise<void> {
  await db.delete(categories).where(eq(categories.id, id));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest categories.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/repositories/categories.ts src/repositories/__tests__/categories.test.ts
git commit -m "feat: add category repository"
```

---

## Task 4: Income Entries Repository

**Files:**
- Create: `src/repositories/income.ts`
- Test: `src/repositories/__tests__/income.test.ts`

**Interfaces:**
- Consumes: `AppDb`; `incomeEntries`, `IncomeEntry`, `NewIncomeEntry` from `../db/schema`.
- Produces: `logIncome(db, input): Promise<IncomeEntry>`, `listIncome(db): Promise<IncomeEntry[]>`, `updateIncome(db, id, input): Promise<IncomeEntry>`, `deleteIncome(db, id): Promise<void>`, `totalIncome(db): Promise<number>`.

- [ ] **Step 1: Write the failing tests**

`src/repositories/__tests__/income.test.ts`:

```ts
import { createTestDb } from '../../db/testDb';
import { logIncome, listIncome, updateIncome, deleteIncome, totalIncome } from '../income';

test('logs and lists income entries', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 4500, type: 'fixed_monthly', date: '2026-08-01', note: null });
  await logIncome(db, { amount: 300, type: 'bonus', date: '2026-08-10', note: 'referral bonus' });
  const all = await listIncome(db);
  expect(all).toHaveLength(2);
});

test('sums total income', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 4500, type: 'fixed_monthly', date: '2026-08-01', note: null });
  await logIncome(db, { amount: 300, type: 'bonus', date: '2026-08-10', note: null });
  expect(await totalIncome(db)).toBe(4800);
});

test('updates and deletes an income entry', async () => {
  const db = createTestDb();
  const entry = await logIncome(db, { amount: 4500, type: 'fixed_monthly', date: '2026-08-01', note: null });
  const updated = await updateIncome(db, entry.id, { amount: 4000 });
  expect(updated.amount).toBe(4000);
  await deleteIncome(db, entry.id);
  expect(await listIncome(db)).toHaveLength(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest income.test.ts`
Expected: FAIL — `../income` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

`src/repositories/income.ts`:

```ts
import { eq } from 'drizzle-orm';
import { incomeEntries, type IncomeEntry, type NewIncomeEntry } from '../db/schema';
import type { AppDb } from '../db/testDb';

export async function logIncome(db: AppDb, input: Omit<NewIncomeEntry, 'id'>): Promise<IncomeEntry> {
  const [row] = await db.insert(incomeEntries).values(input).returning();
  return row;
}

export async function listIncome(db: AppDb): Promise<IncomeEntry[]> {
  return db.select().from(incomeEntries);
}

export async function updateIncome(
  db: AppDb,
  id: number,
  input: Partial<Omit<NewIncomeEntry, 'id'>>,
): Promise<IncomeEntry> {
  const [row] = await db.update(incomeEntries).set(input).where(eq(incomeEntries.id, id)).returning();
  return row;
}

export async function deleteIncome(db: AppDb, id: number): Promise<void> {
  await db.delete(incomeEntries).where(eq(incomeEntries.id, id));
}

export async function totalIncome(db: AppDb): Promise<number> {
  const all = await listIncome(db);
  return all.reduce((sum, entry) => sum + entry.amount, 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest income.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/repositories/income.ts src/repositories/__tests__/income.test.ts
git commit -m "feat: add income entries repository"
```

---

## Task 5: Expense Repository

**Files:**
- Create: `src/repositories/expenses.ts`
- Test: `src/repositories/__tests__/expenses.test.ts`

**Interfaces:**
- Consumes: `AppDb`; `expenses`, `Expense`, `NewExpense` from `../db/schema`.
- Produces: `logExpense(db, input): Promise<Expense>`, `listExpenses(db, filter?: { from?: string; to?: string; categoryId?: number }): Promise<Expense[]>`, `getExpense(db, id): Promise<Expense | undefined>`, `updateExpense(db, id, input): Promise<Expense>`, `deleteExpense(db, id): Promise<void>`, `totalExpenses(db, filter?): Promise<number>`.

- [ ] **Step 1: Write the failing tests**

`src/repositories/__tests__/expenses.test.ts`:

```ts
import { createTestDb } from '../../db/testDb';
import {
  logExpense,
  listExpenses,
  getExpense,
  updateExpense,
  deleteExpense,
  totalExpenses,
} from '../expenses';

test('logs an expense with a category', async () => {
  const db = createTestDb();
  const expense = await logExpense(db, { amount: 25.5, categoryId: 1, date: '2026-08-12', note: 'lunch', isRecurring: false });
  expect(expense.amount).toBe(25.5);
});

test('logs an expense with no category (piggy bank purchase)', async () => {
  const db = createTestDb();
  const expense = await logExpense(db, { amount: 500, categoryId: null, date: '2026-08-12', note: 'Purchased: Headphones', isRecurring: false });
  expect(expense.categoryId).toBeNull();
});

test('filters expenses by date range and category', async () => {
  const db = createTestDb();
  await logExpense(db, { amount: 10, categoryId: 1, date: '2026-08-01', note: null, isRecurring: false });
  await logExpense(db, { amount: 20, categoryId: 1, date: '2026-08-15', note: null, isRecurring: false });
  await logExpense(db, { amount: 30, categoryId: 2, date: '2026-08-15', note: null, isRecurring: false });

  const inRange = await listExpenses(db, { from: '2026-08-10', to: '2026-08-20' });
  expect(inRange).toHaveLength(2);

  const inCategory = await listExpenses(db, { categoryId: 2 });
  expect(inCategory).toHaveLength(1);
});

test('sums total expenses with an optional filter', async () => {
  const db = createTestDb();
  await logExpense(db, { amount: 10, categoryId: 1, date: '2026-08-01', note: null, isRecurring: false });
  await logExpense(db, { amount: 20, categoryId: 1, date: '2026-08-15', note: null, isRecurring: false });
  expect(await totalExpenses(db)).toBe(30);
  expect(await totalExpenses(db, { from: '2026-08-10', to: '2026-08-20' })).toBe(20);
});

test('updates and deletes an expense', async () => {
  const db = createTestDb();
  const expense = await logExpense(db, { amount: 10, categoryId: 1, date: '2026-08-01', note: null, isRecurring: false });
  const updated = await updateExpense(db, expense.id, { amount: 15 });
  expect(updated.amount).toBe(15);
  await deleteExpense(db, expense.id);
  expect(await getExpense(db, expense.id)).toBeUndefined();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest expenses.test.ts`
Expected: FAIL — `../expenses` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

`src/repositories/expenses.ts`:

```ts
import { and, eq, gte, lte } from 'drizzle-orm';
import { expenses, type Expense, type NewExpense } from '../db/schema';
import type { AppDb } from '../db/testDb';

export interface ExpenseFilter {
  from?: string;
  to?: string;
  categoryId?: number;
}

function buildFilter(filter?: ExpenseFilter) {
  if (!filter) return undefined;
  const conditions = [];
  if (filter.from) conditions.push(gte(expenses.date, filter.from));
  if (filter.to) conditions.push(lte(expenses.date, filter.to));
  if (filter.categoryId !== undefined) conditions.push(eq(expenses.categoryId, filter.categoryId));
  return conditions.length ? and(...conditions) : undefined;
}

export async function logExpense(db: AppDb, input: Omit<NewExpense, 'id'>): Promise<Expense> {
  const [row] = await db.insert(expenses).values(input).returning();
  return row;
}

export async function listExpenses(db: AppDb, filter?: ExpenseFilter): Promise<Expense[]> {
  const where = buildFilter(filter);
  return where ? db.select().from(expenses).where(where) : db.select().from(expenses);
}

export async function getExpense(db: AppDb, id: number): Promise<Expense | undefined> {
  const [row] = await db.select().from(expenses).where(eq(expenses.id, id));
  return row;
}

export async function updateExpense(
  db: AppDb,
  id: number,
  input: Partial<Omit<NewExpense, 'id'>>,
): Promise<Expense> {
  const [row] = await db.update(expenses).set(input).where(eq(expenses.id, id)).returning();
  return row;
}

export async function deleteExpense(db: AppDb, id: number): Promise<void> {
  await db.delete(expenses).where(eq(expenses.id, id));
}

export async function totalExpenses(db: AppDb, filter?: ExpenseFilter): Promise<number> {
  const rows = await listExpenses(db, filter);
  return rows.reduce((sum, row) => sum + row.amount, 0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest expenses.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/repositories/expenses.ts src/repositories/__tests__/expenses.test.ts
git commit -m "feat: add expense repository"
```

---

## Task 6: Piggy Bank Repository (Core CRUD)

**Files:**
- Create: `src/repositories/piggyBanks.ts`
- Test: `src/repositories/__tests__/piggyBanks.test.ts`

**Interfaces:**
- Consumes: `AppDb`; `piggyBanks`, `PiggyBank`, `NewPiggyBank` from `../db/schema`.
- Produces: `createPiggyBank(db, input: { productName: string; photoUri?: string | null; targetPrice: number; targetDate?: string | null }): Promise<PiggyBank>`, `listPiggyBanks(db, status?: 'active' | 'purchased' | 'cancelled'): Promise<PiggyBank[]>`, `getPiggyBank(db, id): Promise<PiggyBank | undefined>`, `setPiggyBankStatus(db, id, status, extra?: Partial<PiggyBank>): Promise<PiggyBank>`, `setPiggyBankTargetPrice(db, id, targetPrice): Promise<PiggyBank>`.

- [ ] **Step 1: Write the failing tests**

`src/repositories/__tests__/piggyBanks.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest piggyBanks.test.ts`
Expected: FAIL — `../piggyBanks` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

`src/repositories/piggyBanks.ts`:

```ts
import { eq } from 'drizzle-orm';
import { piggyBanks, type PiggyBank } from '../db/schema';
import type { AppDb } from '../db/testDb';

export interface CreatePiggyBankInput {
  productName: string;
  photoUri?: string | null;
  targetPrice: number;
  targetDate?: string | null;
}

export async function createPiggyBank(db: AppDb, input: CreatePiggyBankInput): Promise<PiggyBank> {
  const [row] = await db
    .insert(piggyBanks)
    .values({
      productName: input.productName,
      photoUri: input.photoUri ?? null,
      targetPrice: input.targetPrice,
      targetDate: input.targetDate ?? null,
      status: 'active',
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

export async function listPiggyBanks(db: AppDb, status?: PiggyBank['status']): Promise<PiggyBank[]> {
  return status ? db.select().from(piggyBanks).where(eq(piggyBanks.status, status)) : db.select().from(piggyBanks);
}

export async function getPiggyBank(db: AppDb, id: number): Promise<PiggyBank | undefined> {
  const [row] = await db.select().from(piggyBanks).where(eq(piggyBanks.id, id));
  return row;
}

export async function setPiggyBankStatus(
  db: AppDb,
  id: number,
  status: PiggyBank['status'],
  extra?: Partial<PiggyBank>,
): Promise<PiggyBank> {
  const [row] = await db
    .update(piggyBanks)
    .set({ status, ...extra })
    .where(eq(piggyBanks.id, id))
    .returning();
  return row;
}

export async function setPiggyBankTargetPrice(db: AppDb, id: number, targetPrice: number): Promise<PiggyBank> {
  const [row] = await db.update(piggyBanks).set({ targetPrice }).where(eq(piggyBanks.id, id)).returning();
  return row;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest piggyBanks.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/repositories/piggyBanks.ts src/repositories/__tests__/piggyBanks.test.ts
git commit -m "feat: add piggy bank core CRUD repository"
```

---

## Task 7: Piggy Bank Transactions Ledger

**Files:**
- Create: `src/repositories/piggyBankTransactions.ts`
- Test: `src/repositories/__tests__/piggyBankTransactions.test.ts`

**Interfaces:**
- Consumes: `AppDb`; `piggyBankTransactions`, `PiggyBankTransaction` from `../db/schema`; `createPiggyBank` from `./piggyBanks` (tests only).
- Produces: `recordTransaction(db, input: { piggyBankId: number; type: 'deposit' | 'withdrawal'; source: PiggyBankTransaction['source']; amount: number; relatedExpenseId?: number | null; relatedIncomeId?: number | null; note?: string | null }): Promise<PiggyBankTransaction>`, `listTransactions(db, piggyBankId): Promise<PiggyBankTransaction[]>`, `getSavedAmount(db, piggyBankId): Promise<number>`, `getTotalActiveSavings(db): Promise<number>`, `getLastTransactionDate(db, piggyBankId): Promise<string | undefined>`.

- [ ] **Step 1: Write the failing tests**

`src/repositories/__tests__/piggyBankTransactions.test.ts`:

```ts
import { createTestDb } from '../../db/testDb';
import { createPiggyBank, setPiggyBankStatus } from '../piggyBanks';
import {
  recordTransaction,
  listTransactions,
  getSavedAmount,
  getTotalActiveSavings,
  getLastTransactionDate,
} from '../piggyBankTransactions';

test('records deposits and withdrawals and computes saved amount', async () => {
  const db = createTestDb();
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'manual', amount: 100 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'sweep', amount: 30 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'withdrawal', source: 'cancel_refund', amount: 20 });

  expect(await getSavedAmount(db, bank.id)).toBe(110);
  expect(await listTransactions(db, bank.id)).toHaveLength(3);
});

test('sums saved amounts across active piggy banks, excluding cancelled ones', async () => {
  const db = createTestDb();
  const active = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  const alsoActive = await createPiggyBank(db, { productName: 'Watch', targetPrice: 400 });
  const cancelled = await createPiggyBank(db, { productName: 'Old Goal', targetPrice: 100 });
  await recordTransaction(db, { piggyBankId: active.id, type: 'deposit', source: 'manual', amount: 100 });
  await recordTransaction(db, { piggyBankId: alsoActive.id, type: 'deposit', source: 'manual', amount: 50 });
  await recordTransaction(db, { piggyBankId: cancelled.id, type: 'deposit', source: 'manual', amount: 999 });
  await setPiggyBankStatus(db, cancelled.id, 'cancelled', { cancelledAt: '2026-08-13T00:00:00.000Z' });

  expect(await getTotalActiveSavings(db)).toBe(150);
});

test('returns the timestamp of the most recent transaction', async () => {
  const db = createTestDb();
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  expect(await getLastTransactionDate(db, bank.id)).toBeUndefined();
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'manual', amount: 10 });
  expect(await getLastTransactionDate(db, bank.id)).toBeTruthy();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest piggyBankTransactions.test.ts`
Expected: FAIL — `../piggyBankTransactions` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

`src/repositories/piggyBankTransactions.ts`:

```ts
import { eq } from 'drizzle-orm';
import { piggyBanks, piggyBankTransactions, type PiggyBankTransaction } from '../db/schema';
import type { AppDb } from '../db/testDb';

export interface RecordTransactionInput {
  piggyBankId: number;
  type: PiggyBankTransaction['type'];
  source: PiggyBankTransaction['source'];
  amount: number;
  relatedExpenseId?: number | null;
  relatedIncomeId?: number | null;
  note?: string | null;
}

export async function recordTransaction(db: AppDb, input: RecordTransactionInput): Promise<PiggyBankTransaction> {
  const [row] = await db
    .insert(piggyBankTransactions)
    .values({
      piggyBankId: input.piggyBankId,
      type: input.type,
      source: input.source,
      amount: input.amount,
      relatedExpenseId: input.relatedExpenseId ?? null,
      relatedIncomeId: input.relatedIncomeId ?? null,
      note: input.note ?? null,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

export async function listTransactions(db: AppDb, piggyBankId: number): Promise<PiggyBankTransaction[]> {
  return db.select().from(piggyBankTransactions).where(eq(piggyBankTransactions.piggyBankId, piggyBankId));
}

export async function getSavedAmount(db: AppDb, piggyBankId: number): Promise<number> {
  const rows = await listTransactions(db, piggyBankId);
  return rows.reduce((sum, tx) => sum + (tx.type === 'deposit' ? tx.amount : -tx.amount), 0);
}

export async function getTotalActiveSavings(db: AppDb): Promise<number> {
  const activeBanks = await db.select().from(piggyBanks).where(eq(piggyBanks.status, 'active'));
  let total = 0;
  for (const bank of activeBanks) {
    total += await getSavedAmount(db, bank.id);
  }
  return total;
}

export async function getLastTransactionDate(db: AppDb, piggyBankId: number): Promise<string | undefined> {
  const rows = await listTransactions(db, piggyBankId);
  if (rows.length === 0) return undefined;
  return rows.map((row) => row.createdAt).sort().at(-1);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest piggyBankTransactions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/repositories/piggyBankTransactions.ts src/repositories/__tests__/piggyBankTransactions.test.ts
git commit -m "feat: add piggy bank transactions ledger"
```

---

## Task 8: Free Balance Calculation

**Files:**
- Create: `src/domain/freeBalance.ts`
- Test: `src/domain/__tests__/freeBalance.test.ts`

**Interfaces:**
- Consumes: `AppDb`; `totalIncome` from `../repositories/income`; `totalExpenses` from `../repositories/expenses`; `getTotalActiveSavings` from `../repositories/piggyBankTransactions`.
- Produces: `calculateFreeBalance(db): Promise<number>`.

- [ ] **Step 1: Write the failing test**

`src/domain/__tests__/freeBalance.test.ts`:

```ts
import { createTestDb } from '../../db/testDb';
import { logIncome } from '../../repositories/income';
import { logExpense } from '../../repositories/expenses';
import { createPiggyBank } from '../../repositories/piggyBanks';
import { recordTransaction } from '../../repositories/piggyBankTransactions';
import { calculateFreeBalance } from '../freeBalance';

test('Free Balance = income - expenses - active piggy bank savings', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 4500, type: 'fixed_monthly', date: '2026-08-01', note: null });
  await logExpense(db, { amount: 800, categoryId: null, date: '2026-08-05', note: null, isRecurring: false });
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'manual', amount: 200 });

  expect(await calculateFreeBalance(db)).toBe(4500 - 800 - 200);
});

test('a cancelled piggy bank does not lock funds out of Free Balance', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 1000, type: 'fixed_monthly', date: '2026-08-01', note: null });
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'manual', amount: 200 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'withdrawal', source: 'cancel_refund', amount: 200 });

  expect(await calculateFreeBalance(db)).toBe(1000);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest freeBalance.test.ts`
Expected: FAIL — `../freeBalance` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

`src/domain/freeBalance.ts`:

```ts
import type { AppDb } from '../db/testDb';
import { totalIncome } from '../repositories/income';
import { totalExpenses } from '../repositories/expenses';
import { getTotalActiveSavings } from '../repositories/piggyBankTransactions';

export async function calculateFreeBalance(db: AppDb): Promise<number> {
  const income = await totalIncome(db);
  const expenses = await totalExpenses(db);
  const lockedSavings = await getTotalActiveSavings(db);
  return income - expenses - lockedSavings;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest freeBalance.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/freeBalance.ts src/domain/__tests__/freeBalance.test.ts
git commit -m "feat: add Free Balance calculation"
```

---

## Task 9: Piggy Bank Lifecycle — Cancel, Price Change, Mark Purchased

**Files:**
- Create: `src/domain/piggyBankLifecycle.ts`
- Test: `src/domain/__tests__/piggyBankLifecycle.test.ts`

**Interfaces:**
- Consumes: `AppDb`; `getPiggyBank`, `setPiggyBankStatus`, `setPiggyBankTargetPrice` from `../repositories/piggyBanks`; `getSavedAmount`, `recordTransaction` from `../repositories/piggyBankTransactions`; `logExpense` from `../repositories/expenses`; `PiggyBank`, `Expense`, `PiggyBankTransaction` from `../db/schema`.
- Produces: `cancelPiggyBank(db, id): Promise<{ piggyBank: PiggyBank; refund: PiggyBankTransaction }>`, `changeTargetPrice(db, id, newTargetPrice): Promise<{ piggyBank: PiggyBank; refund?: PiggyBankTransaction }>`, `markAsPurchased(db, id, date: string): Promise<{ piggyBank: PiggyBank; expense: Expense }>`, `getProgress(db, id): Promise<{ savedAmount: number; targetPrice: number; percent: number; readyToBuy: boolean }>`.

- [ ] **Step 1: Write the failing tests**

`src/domain/__tests__/piggyBankLifecycle.test.ts`:

```ts
import { createTestDb } from '../../db/testDb';
import { createPiggyBank, getPiggyBank } from '../../repositories/piggyBanks';
import { recordTransaction, getSavedAmount } from '../../repositories/piggyBankTransactions';
import { calculateFreeBalance } from '../freeBalance';
import { cancelPiggyBank, changeTargetPrice, markAsPurchased, getProgress } from '../piggyBankLifecycle';

test('cancelling a goal refunds 100% of saved funds and marks it cancelled', async () => {
  const db = createTestDb();
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'manual', amount: 150 });

  const { piggyBank, refund } = await cancelPiggyBank(db, bank.id);
  expect(piggyBank.status).toBe('cancelled');
  expect(refund.amount).toBe(150);
  expect(refund.source).toBe('cancel_refund');
  expect(await getSavedAmount(db, bank.id)).toBe(0);
});

test('raising the target price only changes the percent, not the saved amount', async () => {
  const db = createTestDb();
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'manual', amount: 150 });

  const { piggyBank, refund } = await changeTargetPrice(db, bank.id, 300);
  expect(piggyBank.targetPrice).toBe(300);
  expect(refund).toBeUndefined();
  const progress = await getProgress(db, bank.id);
  expect(progress.percent).toBeCloseTo(50);
});

test('dropping the target price below the saved amount refunds the excess and hits 100%', async () => {
  const db = createTestDb();
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'manual', amount: 150 });

  const { piggyBank, refund } = await changeTargetPrice(db, bank.id, 100);
  expect(refund?.amount).toBe(50);
  expect(refund?.source).toBe('price_decrease_refund');
  const progress = await getProgress(db, piggyBank.id);
  expect(progress.percent).toBe(100);
  expect(progress.readyToBuy).toBe(true);
});

test('marking a fully-funded goal as purchased creates a real expense and zeroes out net Free Balance impact', async () => {
  const db = createTestDb();
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'manual', amount: 250 });
  const freeBalanceBefore = await calculateFreeBalance(db);

  const { piggyBank, expense } = await markAsPurchased(db, bank.id, '2026-08-13');
  expect(piggyBank.status).toBe('purchased');
  expect(expense.amount).toBe(250);
  expect(expense.categoryId).toBeNull();

  const freeBalanceAfter = await calculateFreeBalance(db);
  expect(freeBalanceAfter).toBe(freeBalanceBefore);
});

test('marking an under-funded goal as purchased throws', async () => {
  const db = createTestDb();
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await recordTransaction(db, { piggyBankId: bank.id, type: 'deposit', source: 'manual', amount: 100 });
  await expect(markAsPurchased(db, bank.id, '2026-08-13')).rejects.toThrow();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest piggyBankLifecycle.test.ts`
Expected: FAIL — `../piggyBankLifecycle` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

`src/domain/piggyBankLifecycle.ts`:

```ts
import type { AppDb } from '../db/testDb';
import type { Expense, PiggyBank, PiggyBankTransaction } from '../db/schema';
import { getPiggyBank, setPiggyBankStatus, setPiggyBankTargetPrice } from '../repositories/piggyBanks';
import { getSavedAmount, recordTransaction } from '../repositories/piggyBankTransactions';
import { logExpense } from '../repositories/expenses';

async function requirePiggyBank(db: AppDb, id: number): Promise<PiggyBank> {
  const bank = await getPiggyBank(db, id);
  if (!bank) throw new Error(`Piggy bank ${id} not found`);
  return bank;
}

export async function cancelPiggyBank(
  db: AppDb,
  id: number,
): Promise<{ piggyBank: PiggyBank; refund: PiggyBankTransaction }> {
  await requirePiggyBank(db, id);
  const saved = await getSavedAmount(db, id);
  const refund = await recordTransaction(db, {
    piggyBankId: id,
    type: 'withdrawal',
    source: 'cancel_refund',
    amount: saved,
  });
  const piggyBank = await setPiggyBankStatus(db, id, 'cancelled', {
    cancelledAt: new Date().toISOString(),
  });
  return { piggyBank, refund };
}

export async function changeTargetPrice(
  db: AppDb,
  id: number,
  newTargetPrice: number,
): Promise<{ piggyBank: PiggyBank; refund?: PiggyBankTransaction }> {
  await requirePiggyBank(db, id);
  const saved = await getSavedAmount(db, id);
  const piggyBank = await setPiggyBankTargetPrice(db, id, newTargetPrice);

  if (saved > newTargetPrice) {
    const excess = saved - newTargetPrice;
    const refund = await recordTransaction(db, {
      piggyBankId: id,
      type: 'withdrawal',
      source: 'price_decrease_refund',
      amount: excess,
    });
    return { piggyBank, refund };
  }

  return { piggyBank };
}

export async function markAsPurchased(
  db: AppDb,
  id: number,
  date: string,
): Promise<{ piggyBank: PiggyBank; expense: Expense }> {
  const bank = await requirePiggyBank(db, id);
  const saved = await getSavedAmount(db, id);
  if (saved < bank.targetPrice) {
    throw new Error(`Piggy bank ${id} is not fully funded yet (${saved}/${bank.targetPrice})`);
  }

  const expense = await logExpense(db, {
    amount: bank.targetPrice,
    categoryId: null,
    date,
    note: `Purchased: ${bank.productName}`,
    isRecurring: false,
  });

  const piggyBank = await setPiggyBankStatus(db, id, 'purchased', {
    purchasedAt: new Date().toISOString(),
  });

  return { piggyBank, expense };
}

export async function getProgress(
  db: AppDb,
  id: number,
): Promise<{ savedAmount: number; targetPrice: number; percent: number; readyToBuy: boolean }> {
  const bank = await requirePiggyBank(db, id);
  const savedAmount = await getSavedAmount(db, id);
  const percent = bank.targetPrice === 0 ? 100 : Math.min(100, (savedAmount / bank.targetPrice) * 100);
  return { savedAmount, targetPrice: bank.targetPrice, percent, readyToBuy: savedAmount >= bank.targetPrice };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest piggyBankLifecycle.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/piggyBankLifecycle.ts src/domain/__tests__/piggyBankLifecycle.test.ts
git commit -m "feat: add piggy bank cancel/price-change/purchase lifecycle"
```

---

## Task 10: Budget Period Math and Heatmap Color Thresholds

**Files:**
- Create: `src/domain/budgetPeriods.ts`
- Test: `src/domain/__tests__/budgetPeriods.test.ts`

**Interfaces:**
- Consumes: `AppDb`; `listExpenses` from `../repositories/expenses`.
- Produces: `getPeriodSpend(db, from: string, to: string, targetAmount: number): Promise<{ spentAmount: number; targetAmount: number; percentUsed: number }>`, `heatmapColorForPercent(percentUsed: number): 'green' | 'orange' | 'red' | 'over'`.

- [ ] **Step 1: Write the failing tests**

`src/domain/__tests__/budgetPeriods.test.ts`:

```ts
import { createTestDb } from '../../db/testDb';
import { logExpense } from '../../repositories/expenses';
import { getPeriodSpend, heatmapColorForPercent } from '../budgetPeriods';

test('computes spend and percent used for a period', async () => {
  const db = createTestDb();
  await logExpense(db, { amount: 20, categoryId: 1, date: '2026-08-05', note: null, isRecurring: false });
  await logExpense(db, { amount: 30, categoryId: 1, date: '2026-08-07', note: null, isRecurring: false });
  await logExpense(db, { amount: 999, categoryId: 1, date: '2026-09-01', note: null, isRecurring: false });

  const result = await getPeriodSpend(db, '2026-08-01', '2026-08-31', 100);
  expect(result.spentAmount).toBe(50);
  expect(result.percentUsed).toBe(50);
});

test.each([
  [0, 'green'],
  [49, 'green'],
  [50, 'orange'],
  [89, 'orange'],
  [90, 'red'],
  [100, 'red'],
  [101, 'over'],
  [250, 'over'],
])('heatmapColorForPercent(%i) -> %s', (percent, expected) => {
  expect(heatmapColorForPercent(percent)).toBe(expected);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest budgetPeriods.test.ts`
Expected: FAIL — `../budgetPeriods` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

`src/domain/budgetPeriods.ts`:

```ts
import type { AppDb } from '../db/testDb';
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
): Promise<PeriodSpend> {
  const spentAmount = await totalExpenses(db, { from, to });
  const percentUsed = targetAmount === 0 ? 0 : (spentAmount / targetAmount) * 100;
  return { spentAmount, targetAmount, percentUsed };
}

export function heatmapColorForPercent(percentUsed: number): 'green' | 'orange' | 'red' | 'over' {
  if (percentUsed > 100) return 'over';
  if (percentUsed >= 90) return 'red';
  if (percentUsed >= 50) return 'orange';
  return 'green';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest budgetPeriods.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/budgetPeriods.ts src/domain/__tests__/budgetPeriods.test.ts
git commit -m "feat: add budget period math and heatmap color thresholds"
```

---

## Task 11: Recurring Payments Repository and Materialization Engine

**Files:**
- Create: `src/repositories/recurringPayments.ts`
- Create: `src/domain/recurringMaterialization.ts`
- Test: `src/repositories/__tests__/recurringPayments.test.ts`
- Test: `src/domain/__tests__/recurringMaterialization.test.ts`

**Interfaces:**
- Consumes: `AppDb`; `recurringPayments`, `RecurringPayment`, `NewRecurringPayment` from `../db/schema`; `logExpense` from `../repositories/expenses`.
- Produces: `createRecurringPayment(db, input): Promise<RecurringPayment>`, `listRecurringPayments(db): Promise<RecurringPayment[]>`, `updateRecurringPayment(db, id, input): Promise<RecurringPayment>`, `deleteRecurringPayment(db, id): Promise<void>`, `materializeDuePayments(db, today: string): Promise<Expense[]>`.

- [ ] **Step 1: Write the failing repository tests**

`src/repositories/__tests__/recurringPayments.test.ts`:

```ts
import { createTestDb } from '../../db/testDb';
import {
  createRecurringPayment,
  listRecurringPayments,
  updateRecurringPayment,
  deleteRecurringPayment,
} from '../recurringPayments';

test('creates, lists, updates, and deletes recurring payments', async () => {
  const db = createTestDb();
  const payment = await createRecurringPayment(db, {
    label: 'Netflix',
    amount: 15.99,
    categoryId: 1,
    frequency: 'monthly',
    nextDueDate: '2026-09-01',
  });
  expect((await listRecurringPayments(db))).toHaveLength(1);

  const updated = await updateRecurringPayment(db, payment.id, { amount: 17.99 });
  expect(updated.amount).toBe(17.99);

  await deleteRecurringPayment(db, payment.id);
  expect((await listRecurringPayments(db))).toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest recurringPayments.test.ts`
Expected: FAIL — `../recurringPayments` doesn't exist yet.

- [ ] **Step 3: Write the repository implementation**

`src/repositories/recurringPayments.ts`:

```ts
import { eq } from 'drizzle-orm';
import { recurringPayments, type RecurringPayment, type NewRecurringPayment } from '../db/schema';
import type { AppDb } from '../db/testDb';

export async function createRecurringPayment(
  db: AppDb,
  input: Omit<NewRecurringPayment, 'id'>,
): Promise<RecurringPayment> {
  const [row] = await db.insert(recurringPayments).values(input).returning();
  return row;
}

export async function listRecurringPayments(db: AppDb): Promise<RecurringPayment[]> {
  return db.select().from(recurringPayments);
}

export async function updateRecurringPayment(
  db: AppDb,
  id: number,
  input: Partial<Omit<NewRecurringPayment, 'id'>>,
): Promise<RecurringPayment> {
  const [row] = await db.update(recurringPayments).set(input).where(eq(recurringPayments.id, id)).returning();
  return row;
}

export async function deleteRecurringPayment(db: AppDb, id: number): Promise<void> {
  await db.delete(recurringPayments).where(eq(recurringPayments.id, id));
}
```

- [ ] **Step 4: Run repository test to verify it passes**

Run: `npx jest recurringPayments.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing materialization test**

`src/domain/__tests__/recurringMaterialization.test.ts`:

```ts
import { createTestDb } from '../../db/testDb';
import { createRecurringPayment, listRecurringPayments } from '../../repositories/recurringPayments';
import { listExpenses } from '../../repositories/expenses';
import { materializeDuePayments } from '../recurringMaterialization';

test('materializes a due monthly payment as a real, editable expense and advances its due date', async () => {
  const db = createTestDb();
  await createRecurringPayment(db, {
    label: 'Rent',
    amount: 1200,
    categoryId: 1,
    frequency: 'monthly',
    nextDueDate: '2026-08-01',
  });

  const created = await materializeDuePayments(db, '2026-08-13');
  expect(created).toHaveLength(1);
  expect(created[0].amount).toBe(1200);
  expect(created[0].isRecurring).toBe(true);
  expect(created[0].date).toBe('2026-08-01');

  const [payment] = await listRecurringPayments(db);
  expect(payment.nextDueDate).toBe('2026-09-01');
});

test('materializes every missed occurrence when the app has not been opened in a while', async () => {
  const db = createTestDb();
  await createRecurringPayment(db, {
    label: 'Gym',
    amount: 40,
    categoryId: 1,
    frequency: 'weekly',
    nextDueDate: '2026-07-01',
  });

  const created = await materializeDuePayments(db, '2026-07-22');
  expect(created).toHaveLength(4);
  expect(created.map((e) => e.date)).toEqual(['2026-07-01', '2026-07-08', '2026-07-15', '2026-07-22']);
});

test('does not materialize a payment that is not yet due', async () => {
  const db = createTestDb();
  await createRecurringPayment(db, {
    label: 'Insurance',
    amount: 100,
    categoryId: 1,
    frequency: 'yearly',
    nextDueDate: '2027-01-01',
  });

  const created = await materializeDuePayments(db, '2026-08-13');
  expect(created).toHaveLength(0);
  expect((await listExpenses(db))).toHaveLength(0);
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest recurringMaterialization.test.ts`
Expected: FAIL — `../recurringMaterialization` doesn't exist yet.

- [ ] **Step 7: Write the materialization implementation**

`src/domain/recurringMaterialization.ts`:

```ts
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
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest recurringMaterialization.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/repositories/recurringPayments.ts src/repositories/__tests__/recurringPayments.test.ts src/domain/recurringMaterialization.ts src/domain/__tests__/recurringMaterialization.test.ts
git commit -m "feat: add recurring payments repository and materialization engine"
```

---

## Task 12: Notification Threshold Repository and Crossing Logic

**Files:**
- Create: `src/repositories/notificationThresholds.ts`
- Create: `src/domain/thresholdCrossing.ts`
- Test: `src/repositories/__tests__/notificationThresholds.test.ts`
- Test: `src/domain/__tests__/thresholdCrossing.test.ts`

**Interfaces:**
- Consumes: `AppDb`; `notificationThresholds`, `NotificationThreshold`, `NewNotificationThreshold` from `../db/schema`.
- Produces: `createThreshold(db, input): Promise<NotificationThreshold>`, `listThresholdsFor(db, categoryId: number | null): Promise<NotificationThreshold[]>`, `deleteThreshold(db, id): Promise<void>`, `findNewlyCrossedThresholds(thresholds: NotificationThreshold[], previousPercent: number, newPercent: number): NotificationThreshold[]`.

- [ ] **Step 1: Write the failing repository test**

`src/repositories/__tests__/notificationThresholds.test.ts`:

```ts
import { createTestDb } from '../../db/testDb';
import { createThreshold, listThresholdsFor, deleteThreshold } from '../notificationThresholds';

test('creates and lists thresholds scoped to a category, or overall when categoryId is null', async () => {
  const db = createTestDb();
  await createThreshold(db, { categoryId: 1, thresholdPct: 80 });
  await createThreshold(db, { categoryId: null, thresholdPct: 90 });

  expect(await listThresholdsFor(db, 1)).toHaveLength(1);
  expect(await listThresholdsFor(db, null)).toHaveLength(1);
});

test('deletes a threshold', async () => {
  const db = createTestDb();
  const t = await createThreshold(db, { categoryId: null, thresholdPct: 90 });
  await deleteThreshold(db, t.id);
  expect(await listThresholdsFor(db, null)).toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest notificationThresholds.test.ts`
Expected: FAIL — `../notificationThresholds` doesn't exist yet.

- [ ] **Step 3: Write the repository implementation**

`src/repositories/notificationThresholds.ts`:

```ts
import { and, eq, isNull } from 'drizzle-orm';
import { notificationThresholds, type NotificationThreshold, type NewNotificationThreshold } from '../db/schema';
import type { AppDb } from '../db/testDb';

export async function createThreshold(
  db: AppDb,
  input: Omit<NewNotificationThreshold, 'id'>,
): Promise<NotificationThreshold> {
  const [row] = await db.insert(notificationThresholds).values(input).returning();
  return row;
}

export async function listThresholdsFor(db: AppDb, categoryId: number | null): Promise<NotificationThreshold[]> {
  const condition =
    categoryId === null
      ? isNull(notificationThresholds.categoryId)
      : eq(notificationThresholds.categoryId, categoryId);
  return db.select().from(notificationThresholds).where(condition);
}

export async function deleteThreshold(db: AppDb, id: number): Promise<void> {
  await db.delete(notificationThresholds).where(eq(notificationThresholds.id, id));
}
```

- [ ] **Step 4: Run repository test to verify it passes**

Run: `npx jest notificationThresholds.test.ts`
Expected: PASS

- [ ] **Step 5: Write the failing crossing-logic test**

`src/domain/__tests__/thresholdCrossing.test.ts`:

```ts
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
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest thresholdCrossing.test.ts`
Expected: FAIL — `../thresholdCrossing` doesn't exist yet.

- [ ] **Step 7: Write the crossing-logic implementation**

`src/domain/thresholdCrossing.ts`:

```ts
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
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest thresholdCrossing.test.ts`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/repositories/notificationThresholds.ts src/repositories/__tests__/notificationThresholds.test.ts src/domain/thresholdCrossing.ts src/domain/__tests__/thresholdCrossing.test.ts
git commit -m "feat: add notification thresholds repository and crossing logic"
```

---

## Task 13: Reconciliation — Expense Amount Changes (Deficit and Sweep)

**Files:**
- Create: `src/domain/reconciliation.ts`
- Test: `src/domain/__tests__/reconciliation.test.ts`

**Interfaces:**
- Consumes: `AppDb`; `updateExpense` from `../repositories/expenses`; `calculateFreeBalance` from `./freeBalance`; `recordTransaction` from `../repositories/piggyBankTransactions`; `Expense`, `PiggyBankTransaction` from `../db/schema`.
- Produces: `handleExpenseAmountChanged(db, expenseId, newAmount): Promise<{ expense: Expense; deficit: number; sweepAvailable: number }>`, `borrowFromPiggyBank(db, piggyBankId, amount, relatedExpenseId): Promise<PiggyBankTransaction>`, `sweepToPiggyBank(db, piggyBankId, amount, relatedExpenseId?): Promise<PiggyBankTransaction>`.

- [ ] **Step 1: Write the failing tests**

`src/domain/__tests__/reconciliation.test.ts`:

```ts
import { createTestDb } from '../../db/testDb';
import { logIncome } from '../../repositories/income';
import { logExpense } from '../../repositories/expenses';
import { createPiggyBank } from '../../repositories/piggyBanks';
import { getSavedAmount } from '../../repositories/piggyBankTransactions';
import {
  handleExpenseAmountChanged,
  borrowFromPiggyBank,
  sweepToPiggyBank,
} from '../reconciliation';

test('increasing an expense within available funds reports no deficit and no sweep', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 1000, type: 'fixed_monthly', date: '2026-08-01', note: null });
  const expense = await logExpense(db, { amount: 100, categoryId: null, date: '2026-08-05', note: null, isRecurring: false });

  const result = await handleExpenseAmountChanged(db, expense.id, 150);
  expect(result.deficit).toBe(0);
  expect(result.sweepAvailable).toBe(0);
  expect(result.expense.amount).toBe(150);
});

test('increasing an expense past available funds reports the deficit', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 100, type: 'fixed_monthly', date: '2026-08-01', note: null });
  const expense = await logExpense(db, { amount: 50, categoryId: null, date: '2026-08-05', note: null, isRecurring: false });

  const result = await handleExpenseAmountChanged(db, expense.id, 130);
  expect(result.deficit).toBe(30);
});

test('decreasing an expense reports the newly freed amount as sweepAvailable', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 1000, type: 'fixed_monthly', date: '2026-08-01', note: null });
  const expense = await logExpense(db, { amount: 100, categoryId: null, date: '2026-08-05', note: null, isRecurring: false });

  const result = await handleExpenseAmountChanged(db, expense.id, 70);
  expect(result.sweepAvailable).toBe(30);
  expect(result.deficit).toBe(0);
});

test('borrowing from a piggy bank records a deficit_borrow withdrawal', async () => {
  const db = createTestDb();
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await sweepToPiggyBank(db, bank.id, 100);
  expect(await getSavedAmount(db, bank.id)).toBe(100);

  const tx = await borrowFromPiggyBank(db, bank.id, 40, 999);
  expect(tx.source).toBe('deficit_borrow');
  expect(tx.relatedExpenseId).toBe(999);
  expect(await getSavedAmount(db, bank.id)).toBe(60);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest reconciliation.test.ts`
Expected: FAIL — `../reconciliation` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

`src/domain/reconciliation.ts`:

```ts
import type { AppDb } from '../db/testDb';
import type { Expense, PiggyBankTransaction } from '../db/schema';
import { getExpense, updateExpense } from '../repositories/expenses';
import { recordTransaction } from '../repositories/piggyBankTransactions';
import { calculateFreeBalance } from './freeBalance';

export async function handleExpenseAmountChanged(
  db: AppDb,
  expenseId: number,
  newAmount: number,
): Promise<{ expense: Expense; deficit: number; sweepAvailable: number }> {
  const before = await getExpense(db, expenseId);
  if (!before) throw new Error(`Expense ${expenseId} not found`);

  const freeBalanceBefore = await calculateFreeBalance(db);
  const expense = await updateExpense(db, expenseId, { amount: newAmount });
  const freeBalanceAfter = await calculateFreeBalance(db);

  const deficit = freeBalanceAfter < 0 ? -freeBalanceAfter : 0;
  const sweepAvailable = freeBalanceAfter > freeBalanceBefore ? freeBalanceAfter - freeBalanceBefore : 0;

  return { expense, deficit, sweepAvailable };
}

export async function borrowFromPiggyBank(
  db: AppDb,
  piggyBankId: number,
  amount: number,
  relatedExpenseId: number,
): Promise<PiggyBankTransaction> {
  return recordTransaction(db, {
    piggyBankId,
    type: 'withdrawal',
    source: 'deficit_borrow',
    amount,
    relatedExpenseId,
  });
}

export async function sweepToPiggyBank(
  db: AppDb,
  piggyBankId: number,
  amount: number,
  relatedExpenseId?: number,
): Promise<PiggyBankTransaction> {
  return recordTransaction(db, {
    piggyBankId,
    type: 'deposit',
    source: 'sweep',
    amount,
    relatedExpenseId: relatedExpenseId ?? null,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest reconciliation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/domain/reconciliation.ts src/domain/__tests__/reconciliation.test.ts
git commit -m "feat: add expense-edit reconciliation (deficit detection and sweep)"
```

---

## Task 14: Reconciliation — Past Income Correction Cascade

**Files:**
- Modify: `src/domain/reconciliation.ts`
- Modify: `src/domain/__tests__/reconciliation.test.ts`

**Interfaces:**
- Consumes: `AppDb`; `updateIncome` from `../repositories/income`; `calculateFreeBalance` from `./freeBalance`; `listPiggyBanks` from `../repositories/piggyBanks`; `getSavedAmount`, `getLastTransactionDate`, `recordTransaction` from `../repositories/piggyBankTransactions`.
- Produces (added to `reconciliation.ts`): `handleIncomeAmountChanged(db, incomeId, newAmount): Promise<{ income: IncomeEntry; adjustments: PiggyBankTransaction[] }>`.

- [ ] **Step 1: Add the failing tests**

Append to `src/domain/__tests__/reconciliation.test.ts`. `logIncome`, `createPiggyBank`, and `getSavedAmount` are already imported at the top of this file from Task 13 — only add the one new import:

```ts
import { handleIncomeAmountChanged } from '../reconciliation';

test('reducing past income with enough free balance elsewhere makes no piggy bank adjustment', async () => {
  const db = createTestDb();
  const income = await logIncome(db, { amount: 1000, type: 'fixed_monthly', date: '2026-07-01', note: null });
  const bank = await createPiggyBank(db, { productName: 'Headphones', targetPrice: 250 });
  await sweepToPiggyBank(db, bank.id, 100);

  const result = await handleIncomeAmountChanged(db, income.id, 900);
  expect(result.adjustments).toHaveLength(0);
  expect(await getSavedAmount(db, bank.id)).toBe(100);
});

test('reducing past income below what was allocated pulls the deficit from the most-recently-funded piggy bank first', async () => {
  const db = createTestDb();
  const income = await logIncome(db, { amount: 500, type: 'fixed_monthly', date: '2026-07-01', note: null });
  const older = await createPiggyBank(db, { productName: 'Older Goal', targetPrice: 500 });
  await sweepToPiggyBank(db, older.id, 200);
  const newer = await createPiggyBank(db, { productName: 'Newer Goal', targetPrice: 500 });
  await sweepToPiggyBank(db, newer.id, 200);

  // Free Balance is currently 500 - 400 = 100. Reducing income to 350 creates a 50 deficit.
  const result = await handleIncomeAmountChanged(db, income.id, 350);
  expect(result.adjustments).toHaveLength(1);
  expect(result.adjustments[0].piggyBankId).toBe(newer.id);
  expect(result.adjustments[0].source).toBe('income_correction');
  expect(result.adjustments[0].amount).toBe(50);
  expect(await getSavedAmount(db, newer.id)).toBe(150);
  expect(await getSavedAmount(db, older.id)).toBe(200);
});

test('a deficit larger than the most-recent bank spills over into the next most-recent bank', async () => {
  const db = createTestDb();
  const income = await logIncome(db, { amount: 500, type: 'fixed_monthly', date: '2026-07-01', note: null });
  const older = await createPiggyBank(db, { productName: 'Older Goal', targetPrice: 500 });
  await sweepToPiggyBank(db, older.id, 200);
  const newer = await createPiggyBank(db, { productName: 'Newer Goal', targetPrice: 500 });
  await sweepToPiggyBank(db, newer.id, 50);

  // Free Balance is 500 - 250 = 250. Reducing income to 100 creates a 150 deficit.
  const result = await handleIncomeAmountChanged(db, income.id, 100);
  expect(await getSavedAmount(db, newer.id)).toBe(0);
  expect(await getSavedAmount(db, older.id)).toBe(100);
  expect(result.adjustments.map((a) => a.piggyBankId)).toEqual([newer.id, older.id]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest reconciliation.test.ts`
Expected: FAIL — `handleIncomeAmountChanged` doesn't exist yet.

- [ ] **Step 3: Add the implementation**

Append to `src/domain/reconciliation.ts` (add these imports to the top of the file alongside the existing ones, and the function at the bottom):

```ts
import type { IncomeEntry } from '../db/schema';
import { updateIncome } from '../repositories/income';
import { listPiggyBanks } from '../repositories/piggyBanks';
import { getSavedAmount, getLastTransactionDate } from '../repositories/piggyBankTransactions';
```

```ts
export async function handleIncomeAmountChanged(
  db: AppDb,
  incomeId: number,
  newAmount: number,
): Promise<{ income: IncomeEntry; adjustments: PiggyBankTransaction[] }> {
  const income = await updateIncome(db, incomeId, { amount: newAmount });
  const adjustments: PiggyBankTransaction[] = [];

  let deficit = -(await calculateFreeBalance(db));
  if (deficit <= 0) return { income, adjustments };

  const activeBanks = await listPiggyBanks(db, 'active');
  const banksByRecency = await Promise.all(
    activeBanks.map(async (bank) => ({ bank, lastActivity: (await getLastTransactionDate(db, bank.id)) ?? '' })),
  );
  banksByRecency.sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

  for (const { bank } of banksByRecency) {
    if (deficit <= 0) break;
    const saved = await getSavedAmount(db, bank.id);
    const take = Math.min(saved, deficit);
    if (take <= 0) continue;
    const tx = await recordTransaction(db, {
      piggyBankId: bank.id,
      type: 'withdrawal',
      source: 'income_correction',
      amount: take,
      relatedIncomeId: incomeId,
      note: 'Adjusted due to income correction',
    });
    adjustments.push(tx);
    deficit -= take;
  }

  return { income, adjustments };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest reconciliation.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full test suite**

Run: `npx jest`
Expected: all tests across every module pass.

- [ ] **Step 6: Commit**

```bash
git add src/domain/reconciliation.ts src/domain/__tests__/reconciliation.test.ts
git commit -m "feat: add income-correction reconciliation cascade"
```

---

## Post-Plan Checklist

- [ ] `npx jest` — full suite passes
- [ ] `npx tsc --noEmit` — no type errors
- [ ] Every spec §3–§6 rule has a corresponding test (Free Balance formula, both `expenses.category_id` cases, all three allocation sources are reachable via `recordTransaction`'s `source` enum, all six reconciliation scenarios, heatmap thresholds, recurring materialization including the "missed several periods" case)

**Next:** Plan 2 will scaffold `app/` routes with `expo-router`, add `src/db/client.ts` using `drizzle-orm/expo-sqlite`, wire `expo-notifications` for real threshold/end-of-month alerts, and build bare-minimum (unstyled) screens for onboarding and all five tabs on top of the modules built here.
