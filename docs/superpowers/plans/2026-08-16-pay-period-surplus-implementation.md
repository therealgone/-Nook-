# Pay-Period Surplus/Deficit & Generic Piggy Bank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect, at the close of each pay-period (salary to salary), whether the user
under- or over-spent relative to that period's income, let them allocate any surplus
between a savings goal and a new generic "Piggy Bank" balance (with automatic overflow),
automatically/manually cover any deficit from savings, and re-surface the delta whenever
a retroactive edit changes an already-closed period's outcome.

**Architecture:** A `pay_periods` ledger table tracks how much of each closed period's
outcome has already been resolved (`allocatedSurplus` / `coveredDeficit`). A pure domain
function recomputes each closed period's true income-minus-expenses outcome live from
`income_entries`/`expenses` on every relevant app event and diffs it against what's
already resolved — any non-zero delta (surplus or deficit) is surfaced through a React
context to a single modal. A new `general_savings_transactions` ledger table (mirroring
the existing `piggy_bank_transactions` pattern) backs the new generic Piggy Bank balance.

**Tech Stack:** Expo Router, TypeScript, drizzle-orm + expo-sqlite/better-sqlite3, Jest
(`jest-expo` preset).

**Spec:** `docs/superpowers/specs/2026-08-16-pay-period-surplus-design.md`

## Global Constraints

- Treat any `|delta| <= 0.01` as resolved/zero (floating point tolerance) — this
  threshold is used everywhere a period's outcome is compared to what's been handled.
- No push notifications — in-app modal only (no `expo-notifications` dependency exists
  in this app; don't add one).
- No mid-period running total / live indicator — detection only happens for **closed**
  periods (a period whose end salary date is already known).
- Periods are bounded only by `income_entries` rows where `type = 'fixed_monthly'`.
  Bonuses and adjustments contribute to a period's income total but never start a new
  period.
- Piggy-bank-ledger movements (`piggy_bank_transactions`, `general_savings_transactions`)
  are never counted as `expenses` or `income_entries` — a period's raw outcome is
  unaffected by ad-hoc sweeps/borrows that happened during it (existing
  `reconciliation.ts` flow is untouched by this plan).

---

## Task 1: Schema and DDL additions

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/ddl.ts`

**Interfaces:**
- Produces: `payPeriods` table + `PayPeriod`/`NewPayPeriod` types; `generalSavingsTransactions`
  table + `GeneralSavingsTransaction`/`NewGeneralSavingsTransaction` types; two new
  `piggyBankTransactions.source` enum values (`'period_surplus'`, `'period_deficit'`).

- [ ] **Step 1: Add the two new tables to the Drizzle schema**

In `src/db/schema.ts`, append after the `piggyBankTransactions` block:

```ts
export const payPeriods = sqliteTable('pay_periods', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  allocatedSurplus: real('allocated_surplus').notNull().default(0),
  coveredDeficit: real('covered_deficit').notNull().default(0),
  createdAt: text('created_at').notNull(),
});
export type PayPeriod = typeof payPeriods.$inferSelect;
export type NewPayPeriod = typeof payPeriods.$inferInsert;

export const generalSavingsTransactions = sqliteTable('general_savings_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type', { enum: ['deposit', 'withdrawal'] }).notNull(),
  source: text('source', {
    enum: ['period_surplus', 'period_surplus_overflow', 'period_deficit'],
  }).notNull(),
  amount: real('amount').notNull(),
  note: text('note'),
  createdAt: text('created_at').notNull(),
});
export type GeneralSavingsTransaction = typeof generalSavingsTransactions.$inferSelect;
export type NewGeneralSavingsTransaction = typeof generalSavingsTransactions.$inferInsert;
```

- [ ] **Step 2: Extend the `piggy_bank_transactions.source` enum**

In `src/db/schema.ts`, find the `piggyBankTransactions` table's `source` column and add
the two new values to the existing enum array:

```ts
  source: text('source', {
    enum: [
      'manual',
      'sweep',
      'bonus',
      'deficit_borrow',
      'income_correction',
      'price_decrease_refund',
      'cancel_refund',
      'period_surplus',
      'period_deficit',
    ],
  }).notNull(),
```

- [ ] **Step 3: Add the CREATE TABLE statements to the DDL**

In `src/db/ddl.ts`, append inside the `CREATE_TABLES_SQL` template string, after the
`piggy_bank_transactions` table definition and before the closing backtick:

```sql
CREATE TABLE IF NOT EXISTS pay_periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  allocated_surplus REAL NOT NULL DEFAULT 0,
  covered_deficit REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS general_savings_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
```

- [ ] **Step 4: Verify the schema compiles and existing tests still pass**

Run: `npx tsc --noEmit -p .`
Expected: no new errors attributable to `src/db/schema.ts` or `src/db/ddl.ts`.

Run: `npx jest`
Expected: all existing suites still PASS (these two tables are additive and unused so
far — `CREATE TABLE IF NOT EXISTS` is idempotent, nothing else changed).

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/db/ddl.ts
git commit -m "feat: add pay_periods and general_savings_transactions tables"
```

---

## Task 2: General savings repository

**Files:**
- Create: `src/repositories/generalSavings.ts`
- Test: `src/repositories/__tests__/generalSavings.test.ts`

**Interfaces:**
- Consumes: `generalSavingsTransactions`, `GeneralSavingsTransaction` from
  `src/db/schema.ts` (Task 1); `AppDb` from `src/db/types.ts`.
- Produces: `recordGeneralSavingsTransaction(db, input): Promise<GeneralSavingsTransaction>`,
  `listGeneralSavingsTransactions(db): Promise<GeneralSavingsTransaction[]>`,
  `getGeneralSavingsBalance(db): Promise<number>`.

- [ ] **Step 1: Write the failing tests**

Create `src/repositories/__tests__/generalSavings.test.ts`:

```ts
import { createTestDb } from '../../db/testDb';
import {
  recordGeneralSavingsTransaction,
  listGeneralSavingsTransactions,
  getGeneralSavingsBalance,
} from '../generalSavings';

test('records deposits and withdrawals and computes the balance', async () => {
  const db = createTestDb();
  await recordGeneralSavingsTransaction(db, { type: 'deposit', source: 'period_surplus', amount: 100 });
  await recordGeneralSavingsTransaction(db, { type: 'deposit', source: 'period_surplus_overflow', amount: 30 });
  await recordGeneralSavingsTransaction(db, { type: 'withdrawal', source: 'period_deficit', amount: 20 });

  expect(await getGeneralSavingsBalance(db)).toBe(110);
  expect(await listGeneralSavingsTransactions(db)).toHaveLength(3);
});

test('balance is zero with no transactions', async () => {
  const db = createTestDb();
  expect(await getGeneralSavingsBalance(db)).toBe(0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/repositories/__tests__/generalSavings.test.ts`
Expected: FAIL with "Cannot find module '../generalSavings'".

- [ ] **Step 3: Implement the repository**

Create `src/repositories/generalSavings.ts`:

```ts
import { generalSavingsTransactions, type GeneralSavingsTransaction } from '../db/schema';
import type { AppDb } from '../db/types';

export interface RecordGeneralSavingsInput {
  type: GeneralSavingsTransaction['type'];
  source: GeneralSavingsTransaction['source'];
  amount: number;
  note?: string | null;
}

export async function recordGeneralSavingsTransaction(
  db: AppDb,
  input: RecordGeneralSavingsInput,
): Promise<GeneralSavingsTransaction> {
  const [row] = await db
    .insert(generalSavingsTransactions)
    .values({
      type: input.type,
      source: input.source,
      amount: input.amount,
      note: input.note ?? null,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return row;
}

export async function listGeneralSavingsTransactions(db: AppDb): Promise<GeneralSavingsTransaction[]> {
  return db.select().from(generalSavingsTransactions);
}

export async function getGeneralSavingsBalance(db: AppDb): Promise<number> {
  const rows = await listGeneralSavingsTransactions(db);
  return rows.reduce((sum, tx) => sum + (tx.type === 'deposit' ? tx.amount : -tx.amount), 0);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/repositories/__tests__/generalSavings.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/repositories/generalSavings.ts src/repositories/__tests__/generalSavings.test.ts
git commit -m "feat: add general savings ledger repository"
```

---

## Task 3: Pay periods repository

**Files:**
- Create: `src/repositories/payPeriods.ts`
- Test: `src/repositories/__tests__/payPeriods.test.ts`

**Interfaces:**
- Consumes: `payPeriods`, `PayPeriod` from `src/db/schema.ts` (Task 1).
- Produces: `listPayPeriods(db): Promise<PayPeriod[]>`,
  `findPayPeriod(db, startDate, endDate): Promise<PayPeriod | undefined>`,
  `createPayPeriod(db, startDate, endDate): Promise<PayPeriod>`,
  `addAllocatedSurplus(db, id, amount): Promise<PayPeriod>`,
  `addCoveredDeficit(db, id, amount): Promise<PayPeriod>`.

- [ ] **Step 1: Write the failing tests**

Create `src/repositories/__tests__/payPeriods.test.ts`:

```ts
import { createTestDb } from '../../db/testDb';
import {
  listPayPeriods,
  findPayPeriod,
  createPayPeriod,
  addAllocatedSurplus,
  addCoveredDeficit,
} from '../payPeriods';

test('creates and finds a pay period', async () => {
  const db = createTestDb();
  const created = await createPayPeriod(db, '2026-06-06', '2026-07-06');
  expect(created.allocatedSurplus).toBe(0);
  expect(created.coveredDeficit).toBe(0);

  const found = await findPayPeriod(db, '2026-06-06', '2026-07-06');
  expect(found?.id).toBe(created.id);
  expect(await listPayPeriods(db)).toHaveLength(1);
});

test('finding a period that does not exist returns undefined', async () => {
  const db = createTestDb();
  expect(await findPayPeriod(db, '2026-06-06', '2026-07-06')).toBeUndefined();
});

test('increments allocated surplus and covered deficit independently', async () => {
  const db = createTestDb();
  const period = await createPayPeriod(db, '2026-06-06', '2026-07-06');
  await addAllocatedSurplus(db, period.id, 1000);
  const afterDeficit = await addCoveredDeficit(db, period.id, 250);
  expect(afterDeficit.allocatedSurplus).toBe(1000);
  expect(afterDeficit.coveredDeficit).toBe(250);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/repositories/__tests__/payPeriods.test.ts`
Expected: FAIL with "Cannot find module '../payPeriods'".

- [ ] **Step 3: Implement the repository**

Create `src/repositories/payPeriods.ts`:

```ts
import { and, eq } from 'drizzle-orm';
import { payPeriods, type PayPeriod } from '../db/schema';
import type { AppDb } from '../db/types';

export async function listPayPeriods(db: AppDb): Promise<PayPeriod[]> {
  return db.select().from(payPeriods);
}

export async function findPayPeriod(db: AppDb, startDate: string, endDate: string): Promise<PayPeriod | undefined> {
  const [row] = await db
    .select()
    .from(payPeriods)
    .where(and(eq(payPeriods.startDate, startDate), eq(payPeriods.endDate, endDate)));
  return row;
}

export async function createPayPeriod(db: AppDb, startDate: string, endDate: string): Promise<PayPeriod> {
  const [row] = await db
    .insert(payPeriods)
    .values({ startDate, endDate, allocatedSurplus: 0, coveredDeficit: 0, createdAt: new Date().toISOString() })
    .returning();
  return row;
}

export async function addAllocatedSurplus(db: AppDb, id: number, amount: number): Promise<PayPeriod> {
  const [current] = await db.select().from(payPeriods).where(eq(payPeriods.id, id));
  const [row] = await db
    .update(payPeriods)
    .set({ allocatedSurplus: current.allocatedSurplus + amount })
    .where(eq(payPeriods.id, id))
    .returning();
  return row;
}

export async function addCoveredDeficit(db: AppDb, id: number, amount: number): Promise<PayPeriod> {
  const [current] = await db.select().from(payPeriods).where(eq(payPeriods.id, id));
  const [row] = await db
    .update(payPeriods)
    .set({ coveredDeficit: current.coveredDeficit + amount })
    .where(eq(payPeriods.id, id))
    .returning();
  return row;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/repositories/__tests__/payPeriods.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/repositories/payPeriods.ts src/repositories/__tests__/payPeriods.test.ts
git commit -m "feat: add pay periods repository"
```

---

## Task 4: Period boundary detection and delta reconciliation

**Files:**
- Create: `src/domain/payPeriods.ts`
- Test: `src/domain/__tests__/payPeriods.test.ts`

**Interfaces:**
- Consumes: `findPayPeriod`, `createPayPeriod`, `addAllocatedSurplus` from
  `src/repositories/payPeriods.ts` (Task 3); `incomeEntries`, `expenses` tables from
  `src/db/schema.ts`; `AppDb` from `src/db/types.ts`.
- Produces: `PeriodBoundary { start: string; end: string }`,
  `PendingPeriodAction { periodId: number; start: string; end: string; delta: number }`,
  `getClosedPeriodBoundaries(db): Promise<PeriodBoundary[]>`,
  `reconcilePayPeriods(db): Promise<PendingPeriodAction[]>`.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/__tests__/payPeriods.test.ts`:

```ts
import { createTestDb } from '../../db/testDb';
import { logIncome } from '../../repositories/income';
import { logExpense, deleteExpense } from '../../repositories/expenses';
import { addAllocatedSurplus } from '../../repositories/payPeriods';
import { reconcilePayPeriods, getClosedPeriodBoundaries } from '../payPeriods';

test('no pending actions when fewer than two salary entries exist', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-06-06', note: null });
  expect(await getClosedPeriodBoundaries(db)).toHaveLength(0);
  expect(await reconcilePayPeriods(db)).toHaveLength(0);
});

test('reports a surplus for a closed period where income exceeded spend', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-06-06', note: null });
  await logExpense(db, { amount: 4000, categoryId: null, date: '2026-06-20', note: null, isRecurring: false });
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-07-06', note: null });

  const pending = await reconcilePayPeriods(db);
  expect(pending).toHaveLength(1);
  expect(pending[0]).toMatchObject({ start: '2026-06-06', end: '2026-07-06', delta: 1000 });
});

test('reports a deficit for a closed period where spend exceeded income', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 3000, type: 'fixed_monthly', date: '2026-06-06', note: null });
  await logExpense(db, { amount: 3500, categoryId: null, date: '2026-06-20', note: null, isRecurring: false });
  await logIncome(db, { amount: 3000, type: 'fixed_monthly', date: '2026-07-06', note: null });

  const pending = await reconcilePayPeriods(db);
  expect(pending).toHaveLength(1);
  expect(pending[0].delta).toBe(-500);
});

test('a fully-resolved period reports no pending action', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-06-06', note: null });
  await logExpense(db, { amount: 4000, categoryId: null, date: '2026-06-20', note: null, isRecurring: false });
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-07-06', note: null });

  const [first] = await reconcilePayPeriods(db);
  await addAllocatedSurplus(db, first.periodId, first.delta);

  expect(await reconcilePayPeriods(db)).toHaveLength(0);
});

test('a retroactive delete of an expense inside a resolved period surfaces the new surplus', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-06-06', note: null });
  const oldExpense = await logExpense(db, { amount: 4000, categoryId: null, date: '2026-06-20', note: null, isRecurring: false });
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-07-06', note: null });

  const [first] = await reconcilePayPeriods(db);
  await addAllocatedSurplus(db, first.periodId, first.delta); // resolved with the original $1000 surplus

  await deleteExpense(db, oldExpense.id); // period now has a $5000 surplus, only $1000 was ever allocated

  const pending = await reconcilePayPeriods(db);
  expect(pending).toHaveLength(1);
  expect(pending[0].delta).toBe(4000);
});

test('income and expenses on the boundary date count toward the period that starts there, not the one that ends there', async () => {
  const db = createTestDb();
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-06-06', note: null });
  await logExpense(db, { amount: 100, categoryId: null, date: '2026-07-06', note: null, isRecurring: false });
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-07-06', note: null });
  await logIncome(db, { amount: 5000, type: 'fixed_monthly', date: '2026-08-06', note: null });

  const pending = await reconcilePayPeriods(db);
  const juneToJuly = pending.find((p) => p.start === '2026-06-06');
  expect(juneToJuly?.delta).toBe(5000); // the Jul 6 expense/income belong to the next period
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/domain/__tests__/payPeriods.test.ts`
Expected: FAIL with "Cannot find module '../payPeriods'".

- [ ] **Step 3: Implement the domain module**

Create `src/domain/payPeriods.ts`:

```ts
import { and, eq, gte, lt } from 'drizzle-orm';
import type { AppDb } from '../db/types';
import { incomeEntries, expenses } from '../db/schema';
import { createPayPeriod, findPayPeriod } from '../repositories/payPeriods';

const EPSILON = 0.01;

export interface PeriodBoundary {
  start: string;
  end: string;
}

export interface PendingPeriodAction {
  periodId: number;
  start: string;
  end: string;
  delta: number;
}

export async function getClosedPeriodBoundaries(db: AppDb): Promise<PeriodBoundary[]> {
  const salaries = await db.select().from(incomeEntries).where(eq(incomeEntries.type, 'fixed_monthly'));
  const dates = [...new Set(salaries.map((s) => s.date))].sort();
  const boundaries: PeriodBoundary[] = [];
  for (let i = 0; i < dates.length - 1; i++) {
    boundaries.push({ start: dates[i], end: dates[i + 1] });
  }
  return boundaries;
}

async function sumIncomeInRange(db: AppDb, start: string, end: string): Promise<number> {
  const rows = await db
    .select()
    .from(incomeEntries)
    .where(and(gte(incomeEntries.date, start), lt(incomeEntries.date, end)));
  return rows.reduce((sum, r) => sum + r.amount, 0);
}

async function sumExpensesInRange(db: AppDb, start: string, end: string): Promise<number> {
  const rows = await db
    .select()
    .from(expenses)
    .where(and(gte(expenses.date, start), lt(expenses.date, end)));
  return rows.reduce((sum, r) => sum + r.amount, 0);
}

export async function reconcilePayPeriods(db: AppDb): Promise<PendingPeriodAction[]> {
  const boundaries = await getClosedPeriodBoundaries(db);
  const pending: PendingPeriodAction[] = [];

  for (const { start, end } of boundaries) {
    let period = await findPayPeriod(db, start, end);
    if (!period) period = await createPayPeriod(db, start, end);

    const periodIncome = await sumIncomeInRange(db, start, end);
    const periodExpenses = await sumExpensesInRange(db, start, end);
    const rawOutcome = periodIncome - periodExpenses;
    const handled = period.allocatedSurplus - period.coveredDeficit;
    const delta = rawOutcome - handled;

    if (Math.abs(delta) > EPSILON) {
      pending.push({ periodId: period.id, start, end, delta });
    }
  }

  return pending;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/domain/__tests__/payPeriods.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/payPeriods.ts src/domain/__tests__/payPeriods.test.ts
git commit -m "feat: detect closed pay-period surplus/deficit deltas"
```

---

## Task 5: Period resolution actions

**Files:**
- Create: `src/domain/periodResolution.ts`
- Test: `src/domain/__tests__/periodResolution.test.ts`

**Interfaces:**
- Consumes: `recordTransaction` from `src/repositories/piggyBankTransactions.ts`;
  `recordGeneralSavingsTransaction`, `getGeneralSavingsBalance` from
  `src/repositories/generalSavings.ts` (Task 2); `addAllocatedSurplus`,
  `addCoveredDeficit` from `src/repositories/payPeriods.ts` (Task 3).
- Produces: `allocateSurplus(db, periodId, delta, goal?): Promise<void>` where
  `goal` is `{ piggyBankId: number; amount: number } | undefined`;
  `autoWithdrawDeficitFromPiggyBank(db, periodId, amount): Promise<{ withdrawn: number; remaining: number }>`;
  `borrowDeficitFromGoal(db, periodId, piggyBankId, amount): Promise<void>`;
  `acknowledgeUncoveredDeficit(db, periodId, amount): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Create `src/domain/__tests__/periodResolution.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/domain/__tests__/periodResolution.test.ts`
Expected: FAIL with "Cannot find module '../periodResolution'".

- [ ] **Step 3: Implement the domain module**

Create `src/domain/periodResolution.ts`:

```ts
import type { AppDb } from '../db/types';
import { recordTransaction as recordPiggyBankTransaction } from '../repositories/piggyBankTransactions';
import { recordGeneralSavingsTransaction, getGeneralSavingsBalance } from '../repositories/generalSavings';
import { addAllocatedSurplus, addCoveredDeficit } from '../repositories/payPeriods';

export async function allocateSurplus(
  db: AppDb,
  periodId: number,
  delta: number,
  goal?: { piggyBankId: number; amount: number },
): Promise<void> {
  const goalAmount = goal?.amount ?? 0;
  const remainder = delta - goalAmount;
  const note = `Surplus allocation for period #${periodId}`;

  if (goalAmount > 0 && goal) {
    await recordPiggyBankTransaction(db, {
      piggyBankId: goal.piggyBankId,
      type: 'deposit',
      source: 'period_surplus',
      amount: goalAmount,
      note,
    });
  }
  if (remainder > 0) {
    await recordGeneralSavingsTransaction(db, {
      type: 'deposit',
      source: goalAmount > 0 ? 'period_surplus_overflow' : 'period_surplus',
      amount: remainder,
      note,
    });
  }
  await addAllocatedSurplus(db, periodId, delta);
}

export async function autoWithdrawDeficitFromPiggyBank(
  db: AppDb,
  periodId: number,
  amount: number,
): Promise<{ withdrawn: number; remaining: number }> {
  const balance = await getGeneralSavingsBalance(db);
  const withdrawn = Math.min(balance, amount);
  if (withdrawn > 0) {
    await recordGeneralSavingsTransaction(db, {
      type: 'withdrawal',
      source: 'period_deficit',
      amount: withdrawn,
      note: `Deficit cover for period #${periodId}`,
    });
    await addCoveredDeficit(db, periodId, withdrawn);
  }
  return { withdrawn, remaining: amount - withdrawn };
}

export async function borrowDeficitFromGoal(
  db: AppDb,
  periodId: number,
  piggyBankId: number,
  amount: number,
): Promise<void> {
  await recordPiggyBankTransaction(db, {
    piggyBankId,
    type: 'withdrawal',
    source: 'period_deficit',
    amount,
    note: `Deficit cover for period #${periodId}`,
  });
  await addCoveredDeficit(db, periodId, amount);
}

export async function acknowledgeUncoveredDeficit(db: AppDb, periodId: number, amount: number): Promise<void> {
  await addCoveredDeficit(db, periodId, amount);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/domain/__tests__/periodResolution.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/periodResolution.ts src/domain/__tests__/periodResolution.test.ts
git commit -m "feat: add surplus allocation and deficit coverage actions"
```

---

## Task 6: Period alerts context

**Files:**
- Create: `components/period-alerts-context.tsx`

**Interfaces:**
- Consumes: `useDb` from `components/db-provider.tsx`; `reconcilePayPeriods`,
  `PendingPeriodAction` from `src/domain/payPeriods.ts` (Task 4).
- Produces: `PeriodAlertsProvider` (component), `usePeriodAlerts(): { current:
  PendingPeriodAction | undefined; refresh: () => Promise<void>; dismiss: (action:
  PendingPeriodAction) => void }`.

There is no existing pattern for testing React context/providers in this codebase (no
component-level tests exist — only repository and domain unit tests). This task is
verified manually in Task 9 once it's wired into the app and exercised end-to-end; skip
straight to implementation.

- [ ] **Step 1: Implement the provider**

Create `components/period-alerts-context.tsx`:

```tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useDb } from './db-provider';
import { reconcilePayPeriods, type PendingPeriodAction } from '../src/domain/payPeriods';

type Ctx = {
  current: PendingPeriodAction | undefined;
  refresh: () => Promise<void>;
  dismiss: (action: PendingPeriodAction) => void;
};

const PeriodAlertsContext = createContext<Ctx | undefined>(undefined);

function dismissKey(action: PendingPeriodAction): string {
  return `${action.periodId}:${action.delta.toFixed(2)}`;
}

export function PeriodAlertsProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const [pending, setPending] = useState<PendingPeriodAction[]>([]);
  const dismissed = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const actions = await reconcilePayPeriods(db);
    setPending(actions);
  }, [db]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const dismiss = useCallback((action: PendingPeriodAction) => {
    dismissed.current.add(dismissKey(action));
    setPending((prev) => prev.filter((a) => a !== action));
  }, []);

  const current = pending.find((a) => !dismissed.current.has(dismissKey(a)));

  return <PeriodAlertsContext.Provider value={{ current, refresh, dismiss }}>{children}</PeriodAlertsContext.Provider>;
}

export function usePeriodAlerts(): Ctx {
  const ctx = useContext(PeriodAlertsContext);
  if (!ctx) throw new Error('usePeriodAlerts must be used within a PeriodAlertsProvider');
  return ctx;
}
```

- [ ] **Step 2: Verify the app still typechecks**

Run: `npx tsc --noEmit -p .`
Expected: no new errors attributable to `components/period-alerts-context.tsx` (it isn't
mounted anywhere yet, so this only checks the file compiles standalone).

- [ ] **Step 3: Commit**

```bash
git add components/period-alerts-context.tsx
git commit -m "feat: add period alerts context"
```

---

## Task 7: Period alert modal (surplus + deficit UX)

**Files:**
- Create: `components/period-alert-modal.tsx`

**Interfaces:**
- Consumes: `useDb` from `components/db-provider.tsx`; `useToast` from
  `components/toast-context.tsx`; `usePeriodAlerts` from
  `components/period-alerts-context.tsx` (Task 6); `listPiggyBanks` from
  `src/repositories/piggyBanks.ts`; `getSavedAmount` from
  `src/repositories/piggyBankTransactions.ts`; `allocateSurplus`,
  `autoWithdrawDeficitFromPiggyBank`, `borrowDeficitFromGoal`,
  `acknowledgeUncoveredDeficit` from `src/domain/periodResolution.ts` (Task 5);
  `BottomSheet`, `Button`, `Chip`, `ConfirmDialog`/`DialogAction`, `TextField`,
  `SheetTitle`/`Body` from `components/ui/*`.
- Produces: `PeriodAlertModal` (component, no props — reads everything from context).

This is a UI-only component with no automated test (matches the codebase's existing
convention of not unit-testing screens/components). It's verified manually in Task 9.

- [ ] **Step 1: Implement the modal**

Create `components/period-alert-modal.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDb } from './db-provider';
import { useToast } from './toast-context';
import { usePeriodAlerts } from './period-alerts-context';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { ConfirmDialog, type DialogAction } from './ui/ConfirmDialog';
import { TextField } from './ui/TextField';
import { Body, SheetTitle } from './ui/Text';
import { listPiggyBanks } from '../src/repositories/piggyBanks';
import { getSavedAmount } from '../src/repositories/piggyBankTransactions';
import {
  allocateSurplus,
  autoWithdrawDeficitFromPiggyBank,
  borrowDeficitFromGoal,
  acknowledgeUncoveredDeficit,
} from '../src/domain/periodResolution';
import type { PiggyBank } from '../src/db/schema';
import { colors, fonts, spacing } from '../constants/theme';
import { formatCurrency } from '../utils/format';

type GoalOption = { bank: PiggyBank; saved: number; remaining: number };

function formatPeriodRange(start: string, end: string): string {
  return `${start} – ${end}`;
}

export function PeriodAlertModal() {
  const db = useDb();
  const showToast = useToast();
  const { current, refresh, dismiss } = usePeriodAlerts();

  const [goals, setGoals] = useState<GoalOption[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [goalAmountText, setGoalAmountText] = useState('');
  const [deficitDialog, setDeficitDialog] = useState<{ remaining: number; actions: DialogAction[] } | null>(null);

  const isSurplus = !!current && current.delta > 0;
  const isDeficit = !!current && current.delta < 0;

  useEffect(() => {
    if (!isSurplus) return;
    setSelectedGoalId(null);
    setGoalAmountText('');
    listPiggyBanks(db, 'active').then(async (banks) => {
      const withRemaining = await Promise.all(
        banks.map(async (bank) => {
          const saved = await getSavedAmount(db, bank.id);
          return { bank, saved, remaining: Math.max(0, bank.targetPrice - saved) };
        }),
      );
      setGoals(withRemaining.filter((g) => g.remaining > 0));
    });
  }, [db, isSurplus, current?.periodId]);

  useEffect(() => {
    if (!isDeficit || !current) return;
    let cancelled = false;
    const periodId = current.periodId;
    const amount = -current.delta;

    (async () => {
      const { remaining } = await autoWithdrawDeficitFromPiggyBank(db, periodId, amount);
      if (cancelled) return;

      if (remaining <= 0.01) {
        showToast('Overspend covered from your Piggy Bank');
        await refresh();
        return;
      }

      const banks = await listPiggyBanks(db, 'active');
      const borrowActions: DialogAction[] = banks.map((bank) => ({
        label: `Borrow ${formatCurrency(remaining)} from ${bank.productName}`,
        variant: 'accent',
        onPress: async () => {
          await borrowDeficitFromGoal(db, periodId, bank.id, remaining);
          await refresh();
        },
      }));

      setDeficitDialog({
        remaining,
        actions: [
          ...borrowActions,
          {
            label: 'Mark this period over-budget',
            variant: 'danger',
            onPress: async () => {
              await acknowledgeUncoveredDeficit(db, periodId, remaining);
              await refresh();
            },
          },
        ],
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [db, isDeficit, current?.periodId]);

  if (!current) return null;

  const selectedGoal = goals.find((g) => g.bank.id === selectedGoalId);
  const goalAmount = selectedGoal ? Math.min(Number(goalAmountText) || 0, current.delta, selectedGoal.remaining) : 0;
  const piggyBankAmount = isSurplus ? current.delta - goalAmount : 0;

  async function confirmSurplus() {
    if (!current) return;
    await allocateSurplus(
      db,
      current.periodId,
      current.delta,
      selectedGoal ? { piggyBankId: selectedGoal.bank.id, amount: goalAmount } : undefined,
    );
    showToast(`${formatCurrency(current.delta)} allocated`);
    await refresh();
  }

  function notNowSurplus() {
    if (current) dismiss(current);
  }

  return (
    <>
      <BottomSheet visible={isSurplus} onClose={notNowSurplus}>
        <SheetTitle>{`🎉 You saved ${formatCurrency(current.delta)}`}</SheetTitle>
        <Body muted>{`Between ${formatPeriodRange(current.start, current.end)} you spent less than you earned.`}</Body>

        {goals.length > 0 && (
          <View style={styles.chipRow}>
            <Chip
              label="Just Piggy Bank"
              selected={selectedGoalId === null}
              onPress={() => {
                setSelectedGoalId(null);
                setGoalAmountText('');
              }}
            />
            {goals.map((g) => (
              <Chip
                key={g.bank.id}
                label={g.bank.productName}
                selected={selectedGoalId === g.bank.id}
                onPress={() => {
                  setSelectedGoalId(g.bank.id);
                  setGoalAmountText('');
                }}
              />
            ))}
          </View>
        )}

        {selectedGoal && (
          <>
            <TextField
              placeholder={`Amount for ${selectedGoal.bank.productName}`}
              keyboardType="decimal-pad"
              value={goalAmountText}
              onChangeText={setGoalAmountText}
            />
            <Pressable
              onPress={() => setGoalAmountText(String(Math.min(current.delta, selectedGoal.remaining)))}
              accessibilityRole="button"
              accessibilityLabel={`Fill ${selectedGoal.bank.productName}`}
            >
              <Text style={styles.fillLink}>
                {`Fill goal (${formatCurrency(Math.min(current.delta, selectedGoal.remaining))})`}
              </Text>
            </Pressable>
          </>
        )}

        <Body muted>{`→ ${formatCurrency(piggyBankAmount)} to Piggy Bank`}</Body>

        <View style={styles.actions}>
          <Button label="Not now" variant="secondary" onPress={notNowSurplus} />
          <Button label="Confirm" onPress={confirmSurplus} />
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={!!deficitDialog}
        title="You went over budget"
        message={
          deficitDialog
            ? `You spent ${formatCurrency(-current.delta)} more than you earned between ${formatPeriodRange(current.start, current.end)}. ${formatCurrency(deficitDialog.remaining)} is left to cover.`
            : undefined
        }
        actions={deficitDialog?.actions ?? []}
        onDismiss={() => {
          if (current) dismiss(current);
          setDeficitDialog(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fillLink: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.accent400 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
});
```

- [ ] **Step 2: Verify the app still typechecks**

Run: `npx tsc --noEmit -p .`
Expected: no new errors attributable to `components/period-alert-modal.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/period-alert-modal.tsx
git commit -m "feat: add period alert modal for surplus/deficit resolution"
```

---

## Task 8: Wire the provider and modal into the app root

**Files:**
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: `PeriodAlertsProvider` from `components/period-alerts-context.tsx` (Task 6);
  `PeriodAlertModal` from `components/period-alert-modal.tsx` (Task 7).

- [ ] **Step 1: Mount the provider and modal**

In `app/_layout.tsx`, add the two imports:

```ts
import { PeriodAlertsProvider } from '../components/period-alerts-context';
import { PeriodAlertModal } from '../components/period-alert-modal';
```

Then wrap `AddExpenseSheetProvider` with `PeriodAlertsProvider` (nested inside
`ToastProvider` so the modal can use `useToast`), and mount `<PeriodAlertModal />`
alongside the existing `<AddExpenseSheet />`:

```tsx
      <DbProvider>
        <ToastProvider>
          <PeriodAlertsProvider>
            <AddExpenseSheetProvider>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.screenBg } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="settings" />
              </Stack>
              <AddExpenseSheet />
              <PeriodAlertModal />
            </AddExpenseSheetProvider>
          </PeriodAlertsProvider>
        </ToastProvider>
      </DbProvider>
```

- [ ] **Step 2: Verify the app still typechecks and existing tests pass**

Run: `npx tsc --noEmit -p .`
Expected: no new errors.

Run: `npx jest`
Expected: all existing suites still PASS.

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat: mount period alerts provider and modal"
```

---

## Task 9: Wire reconcile triggers into expense/income mutations

**Files:**
- Modify: `app/(tabs)/history.tsx`
- Modify: `components/add-expense-sheet.tsx`
- Modify: `app/settings/[section].tsx`

**Interfaces:**
- Consumes: `usePeriodAlerts` from `components/period-alerts-context.tsx` (Task 6).

- [ ] **Step 1: Trigger a recheck after expense delete/edit in History**

In `app/(tabs)/history.tsx`, add the import:

```ts
import { usePeriodAlerts } from '../../components/period-alerts-context';
```

Inside `HistoryScreen`, alongside the other hooks near the top:

```ts
  const { refresh: refreshPeriodAlerts } = usePeriodAlerts();
```

In the delete action inside `onPressExpense` (currently `await load(); await
resolveDeficitOrSweep(deficit, sweepAvailable);`), add a call after `load()`:

```ts
        {
          label: 'Delete',
          variant: 'danger',
          onPress: async () => {
            const { deficit, sweepAvailable } = await handleExpenseDeleted(db, expense.id);
            await load();
            await refreshPeriodAlerts();
            await resolveDeficitOrSweep(deficit, sweepAvailable);
          },
        },
```

And in `saveEdit`, add the same call in both branches, right after `await load();`:

```ts
  async function saveEdit() {
    if (!editing) return;
    const parsed = Number(editAmount);
    if (!editAmount || Number.isNaN(parsed) || parsed <= 0) {
      setEditError('Enter a valid amount');
      return;
    }
    const noteChanged = editNote !== (editing.note ?? '');
    if (parsed !== editing.amount) {
      const { deficit, sweepAvailable } = await handleExpenseAmountChanged(db, editing.id, parsed);
      if (noteChanged) await updateExpense(db, editing.id, { note: editNote || null });
      const expenseId = editing.id;
      setEditing(null);
      await load();
      await refreshPeriodAlerts();
      await resolveDeficitOrSweep(deficit, sweepAvailable, expenseId);
    } else {
      if (noteChanged) await updateExpense(db, editing.id, { note: editNote || null });
      setEditing(null);
      await load();
      await refreshPeriodAlerts();
    }
  }
```

- [ ] **Step 2: Trigger a recheck after logging a new expense**

In `components/add-expense-sheet.tsx`, add the import:

```ts
import { usePeriodAlerts } from './period-alerts-context';
```

Inside `AddExpenseSheet`, alongside the other hooks:

```ts
  const { refresh: refreshPeriodAlerts } = usePeriodAlerts();
```

In `save()`, call it after `logExpense`:

```ts
  async function save() {
    if (!valid || catId === null) return;
    const category = categories.find((c) => c.id === catId);
    await logExpense(db, {
      amount: parsed,
      categoryId: catId,
      date: state.day ?? todayIso(),
      note: null,
      isRecurring: false,
    });
    await refreshPeriodAlerts();
    close();
    bumpRefresh();
    showToast(`${formatCurrency(parsed)} logged to ${category?.name ?? 'category'}`);
  }
```

- [ ] **Step 3: Trigger a recheck after logging or deleting income**

In `app/settings/[section].tsx`, add the import:

```ts
import { usePeriodAlerts } from '../../components/period-alerts-context';
```

Inside `IncomeSection`, alongside the other hooks:

```ts
  const { refresh: refreshPeriodAlerts } = usePeriodAlerts();
```

In `save()`, call it after the income (and any recurring schedule) is created:

```ts
  async function save() {
    const parsed = Number(amount);
    if (!amount || Number.isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid amount');
      return;
    }
    const note = label.trim() || null;
    await logIncome(db, { amount: parsed, type, date, note });
    if (type === 'fixed_monthly') {
      await createRecurringIncome(db, { amount: parsed, frequency: 'monthly', nextDueDate: advanceDate(date, 'monthly'), note });
    }
    await refreshPeriodAlerts();
    setOpen(false);
    load();
  }
```

And on the delete button for each income row, chain the refresh after the existing
`.then(load)`:

```tsx
          onDelete={() => deleteIncome(db, entry.id).then(load).then(refreshPeriodAlerts)}
```

- [ ] **Step 4: Verify everything still typechecks and existing tests pass**

Run: `npx tsc --noEmit -p .`
Expected: no new errors attributable to the three modified files.

Run: `npx jest`
Expected: all existing suites still PASS (no repository/domain behavior changed in this
task, only UI wiring).

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/history.tsx components/add-expense-sheet.tsx app/settings/\[section\].tsx
git commit -m "feat: trigger pay-period reconcile after expense/income mutations"
```

---

## Task 10: Manual end-to-end verification

**Files:** none (verification only, using the existing `app/settings/dev.tsx` clock
tool).

- [ ] **Step 1: Verify a surplus flow end-to-end**

Run the app (`npm run start` / `npm run ios` / `npm run android`). In Settings →
Income, add a "Salary" income of 5000 dated today with type `fixed_monthly`. In
History, log an expense of 4000 dated today. Go to Settings → Developer tools, set the
app clock forward one month, then tap "Run recurring check" (this materializes the next
`fixed_monthly` income entry, closing the period). Navigate back to the Home tab.
Expected: the surplus modal appears ("🎉 You saved $1,000.00 ..."). Pick an active goal
(create one first in the Piggy Bank tab if none exist, e.g. target $300), tap "Fill
goal", confirm the $700 remainder line reads "→ $700.00 to Piggy Bank", and tap
Confirm. Expected: a toast confirms the allocation; the goal's saved amount increases by
$300; re-opening the app (or navigating away and back) shows no further popup for that
period.

- [ ] **Step 2: Verify a deficit flow end-to-end**

Repeat similarly but log expenses totaling more than the period's income before
advancing the clock and running the recurring check. Expected: if you have Piggy Bank
funds from Step 1, the deficit is silently covered up to that balance and a toast
appears; if a remainder is left, a dialog appears offering to borrow from a goal or
"Mark this period over-budget" — verify both paths update state (goal's saved amount
decreases, or the period stops re-prompting).

- [ ] **Step 3: Verify retroactive re-detection**

After a period has been fully resolved (Step 1), go to History, navigate to a day inside
that already-closed period, and delete an expense that was logged there. Expected:
returning to Home (or any screen that triggers a refresh) shows the surplus modal again,
this time for the additional amount freed up by the deletion — not the full original
period amount.

- [ ] **Step 4: Confirm no regressions in the existing single-expense reconciliation flow**

In History, edit or delete an expense in the *current, still-open* period. Expected: the
existing "Extra funds freed up" / "Over budget" dialog (from `reconciliation.ts`) still
behaves exactly as before — this plan doesn't touch that flow.
