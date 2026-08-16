# Pay-Period Surplus/Deficit & Generic Piggy Bank — Design

Status: Approved (pending final spec review)
Date: 2026-08-16

## 1. Problem

Today the app only reconciles savings at the level of a single expense/income edit
(`src/domain/reconciliation.ts`, wired into `history.tsx`). It has no concept of a
pay-period as a whole: it can't tell the user "you earned $5,000 between your Jun 6 and
Jul 6 salary and only spent $4,000, so $1,000 is left over," it can't offer to bank that
surplus, it can't automatically draw an overspend from savings at the period level, and
it can't notice that a retroactive edit (e.g. deleting an old expense) changed a
past period's outcome after the fact.

There is also currently no generic, un-earmarked savings balance — `piggy_banks` are
all per-product goals (photo, target price). Surplus that isn't assigned to a goal needs
somewhere to live.

## 2. Data Model Additions

| Table | Purpose | Key fields |
|---|---|---|
| `pay_periods` | one row per **closed** pay-period (a period whose end salary date is known) | `start_date`, `end_date`, `allocated_surplus` (real, default 0), `covered_deficit` (real, default 0), `created_at` |
| `general_savings_transactions` | ledger for the new generic Piggy Bank balance | `type` (deposit/withdrawal), `source`, `amount`, `note`, `created_at` |

`general_savings_transactions.source` enum: `period_surplus`, `period_surplus_overflow`,
`period_deficit`.

`piggy_bank_transactions.source` enum gains two values: `period_surplus`, `period_deficit`
(alongside the existing `manual`, `sweep`, `bonus`, `deficit_borrow`, `income_correction`,
`price_decrease_refund`, `cancel_refund`).

The general Piggy Bank balance is derived exactly like a goal's `saved_amount` today
(`getSavedAmount` in `piggyBankTransactions.ts`): sum of deposits minus withdrawals.

No foreign key ties a ledger row back to a `pay_periods` row — that link is informational
only and goes in the existing free-text `note` column (e.g. "Surplus from Jun 6 – Jul 5").
The actual bookkeeping of what's been resolved for a period lives entirely in
`pay_periods.allocated_surplus` / `covered_deficit`.

## 3. Period Detection

`getPayPeriods(db)` (new, `src/domain/payPeriods.ts`): reads all `income_entries` where
`type = 'fixed_monthly'`, sorted by `date`. Consecutive dates define closed periods
`[date_i, date_{i+1})`. The span after the last salary date is the **current open
period** and is never checked or persisted.

`reconcilePayPeriods(db)` (same module):

1. For every closed period, ensure a `pay_periods` row exists (insert with zeros if
   missing).
2. For each row, compute:
   - `periodIncome` = sum of **all** `income_entries` (any type) dated in `[start, end)`
   - `periodExpenses` = sum of `expenses` dated in `[start, end)`
   - `rawOutcome = periodIncome − periodExpenses`
   - `handled = allocated_surplus − covered_deficit`
   - `delta = rawOutcome − handled`
3. Return every period where `|delta| > 0.01` as a `PendingPeriodAction { periodId, start,
   end, delta }` (positive = unresolved surplus, negative = unresolved deficit).

Because `rawOutcome` is always recomputed live from `income_entries`/`expenses`, a
retroactive edit to a date inside an already-closed period is handled by the same
function on its next run — there is no separate "retroactive" code path. This is also
why deleting a past expense that turns a previously-resolved period into a bigger
surplus (or a still-open deficit into a bigger one) surfaces correctly: `rawOutcome`
changes, `handled` doesn't, so `delta` becomes non-zero again.

## 4. Triggers

`reconcilePayPeriods` runs from:

- `DbProvider`, immediately after the existing `materializeDueIncome` call — that's what
  creates new `fixed_monthly` entries, which is what closes a period.
- The existing `load()` callbacks in `history.tsx` (expense add/edit/delete) and the
  income section of `app/settings/[section].tsx` (income add/edit/delete).

A new `PeriodAlertsProvider` (mounted in `app/_layout.tsx`, alongside the other root
providers) owns the resulting `pendingActions` list and exposes it through a
`usePeriodAlerts()` hook. A single modal component renders whichever pending action is
first in the list; resolving or dismissing it re-runs `reconcilePayPeriods` to refresh
the list.

## 5. Resolution UX

### Surplus

Modal: "🎉 You saved {amount} between {start} and {end}."

- Chip row of active goals that still have unmet need (`target_price − saved_amount >
  0`), optional (none selected = Piggy Bank only).
- If a goal is selected: an amount field for it, capped at
  `min(delta, target_price − saved_amount)` for that goal. A "Fill goal" quick action
  sets it to that cap in one tap.
- The remainder (`delta − goalAmount`) is shown read-only as "→ {remainder} to Piggy
  Bank" and always accounted for — nothing is left unresolved. E.g. goal needs $300,
  delta is $500 → $300 fills the goal, $200 auto-flows to the Piggy Bank.
- "All to Piggy Bank" quick action (goal amount forced to 0).
- Confirm: records a `piggy_bank_transactions` deposit (source `period_surplus`) for the
  goal portion if > 0, a `general_savings_transactions` deposit for the remainder
  (source `period_surplus` if no goal was picked, `period_surplus_overflow` if it's
  overflow from a goal fill), then sets `allocated_surplus += delta` on the period row.
- "Not now" closes without writing anything to `pay_periods`. It won't reopen again
  this app session for the same `(periodId, delta)` pair (tracked in-memory in
  `PeriodAlertsProvider`, not persisted) — a fresh launch, or the delta actually
  changing via a later retroactive edit, will resurface it.

### Deficit

Modal: "You spent {amount} more than you earned between {start} and {end}."

1. Automatically (no prompt) withdraw `min(generalPiggyBankBalance, |delta|)` from the
   general Piggy Bank (`general_savings_transactions` withdrawal, source
   `period_deficit`).
2. If that doesn't fully cover it, prompt with the same "pick a goal to borrow from"
   dialog pattern `history.tsx` already uses for single-expense overspend
   (`borrowFromPiggyBank`, reusing source `period_deficit` on the goal's ledger).
3. If nothing is available (no Piggy Bank balance, no goals, or user doesn't pick one),
   show an informational message that the period is over-budget — no forced action.
4. In every case, `covered_deficit` is set to fully acknowledge `|delta|` once shown, so
   the same shortfall won't re-prompt on every subsequent reconcile — it only resurfaces
   if a later retroactive edit makes the deficit strictly larger than what was already
   acknowledged.

## 6. Non-Goals

- No push notifications — in-app modal only, consistent with the rest of the app (no
  `expo-notifications` usage exists yet).
- No mid-period running total / live indicator — detection only fires at period close
  (and on retroactive recheck), not continuously while a period is in progress.
- Periods are only ever bounded by `fixed_monthly` income dates. Bonuses and adjustments
  contribute to a period's income total but never start a new period.
- No change to the existing single-expense-edit reconciliation flow in
  `reconciliation.ts` / `history.tsx` — it continues to operate on the all-time free
  balance exactly as it does today. The two systems are additive, not merged: a sweep
  or borrow from that flow moves money in/out of a goal (or now the Piggy Bank), but
  piggy-bank-ledger rows are neither `expenses` nor `income_entries`, so they never
  affect `periodIncome`/`periodExpenses`. This is intentional — a period's raw
  surplus/deficit is unaffected by ad-hoc sweeps/borrows that already happened during
  it.

## 7. Testing

- `src/domain/__tests__/payPeriods.test.ts`: period boundary derivation from income
  dates; `reconcilePayPeriods` delta math for a fresh close, a partially-resolved
  period, and a retroactive edit that changes a resolved period's outcome (both
  surplus-grows and deficit-grows cases).
- Repository tests for `general_savings_transactions` mirroring the existing
  `piggyBankTransactions` repo tests.
- Update `db/schema.ts` / `db/ddl.ts` and their existing tests for the two new
  tables/enum values.
