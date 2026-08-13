# Minimalist Expense Tracker — MVP Design

Status: Approved (pending final spec review)
Date: 2026-08-13

## 1. Core Philosophy

- **Offline-first**: all data stays on-device; no cloud dependency, signup flow, or bank sync.
- **Scannable & visual**: colors, gauges, and grids instead of dense tables of numbers.
- **Zero friction**: logging an expense takes under three seconds.

## 2. Platform & Tech Stack

- **Platform**: Mobile app (iOS/Android) via **Expo** + React Native + TypeScript.
- **Navigation**: `expo-router`, file-based, 5-tab bottom nav — Home, History, Insights, Piggy Bank, Settings.
- **Storage**: `expo-sqlite` + `drizzle-orm` for local relational storage with type-safe schema/migrations. No app-level PIN/biometric lock in MVP (device passcode is the only gate).
- **Icons**: `@expo/vector-icons`, a curated minimalist subset offered as the category icon picker.
- **Gauges/heatmap**: hand-drawn with `react-native-svg` (no third-party gauge library) for full visual control over the speedometer needles and heatmap grid.
- **State**: Zustand as a thin reactive cache over SQLite — the DB is the source of truth; the store holds current-period aggregates so the UI isn't re-querying on every render.
- **Notifications**: `expo-notifications`, local-only — threshold alerts and an end-of-month summary. No push server.
- **Currency**: single currency, chosen once during onboarding; used everywhere (no multi-currency/conversion).
- **Photos**: `expo-image-picker` for Piggy Bank product photos.

## 3. Data Model

| Table | Purpose | Key fields |
|---|---|---|
| `settings` | app-wide config | currency, onboarding_complete |
| `income_entries` | discrete income events | amount, type (fixed_monthly / bonus / adjustment), date, note |
| `categories` | spending categories | name, icon, color, budget_amount, budget_period (weekly/monthly) |
| `expenses` | logged spending | amount, category_id, date, note, is_recurring |
| `recurring_payments` | recurring bill definitions | label, amount, category_id, frequency, next_due_date |
| `notification_thresholds` | alert config | category_id (nullable = overall), threshold_pct |
| `piggy_banks` | savings goals | product_name, photo_uri, target_price, target_date, status (active/purchased/cancelled) |
| `piggy_bank_transactions` | savings ledger | piggy_bank_id, type (deposit/withdrawal), source (manual/sweep/bonus/deficit_borrow/income_correction/price_decrease_refund/cancel_refund), amount, related_expense_id, related_income_id, note |

**Free Balance** is the core derived number driving the dashboard:

```
Free Balance = Σ income_entries − Σ expenses − Σ (saved_amount of active piggy banks)
```

The Home header's "remaining budget" is Free Balance, not a plain income-minus-expenses figure.

## 4. Screens

### Home
Dynamic header (spent vs. Free Balance, color gradient teal→amber→red), daily speedometer, weekly speedometer, quick-entry `+`, category shortcuts. Tapping `+` or a shortcut opens the Add Expense sheet: amount → category → optional note → save.

### History
GitHub-style month heatmap. Color thresholds: 🟩 <50% of daily budget, 🟧 60–80%, 🟥 90–100%, ❌ over 100%. Tapping a day opens a slide-up panel listing that day's expenses with edit/delete/add-retroactively actions — this is the entry point into the reconciliation engine (§6).

### Insights
Category % breakdown (current week/month toggle) and per-category health bars (spend vs. cap).

### Piggy Bank
List of goal cards (photo, fill-progress visual, saved/target, %), with a "Ready to Buy!" banner on any goal at 100%. `+` opens Create Goal (photo, product name, target price, optional target date).

**Piggy Bank Detail**: photo, progress, that goal's transaction history (from `piggy_bank_transactions`), and actions: Add Funds, Cancel Goal, Mark as Purchased (enabled at 100%).

### Settings
Income setup (fixed/variable, log a bonus with optional % allocation straight to a piggy bank), recurring payments CRUD, category CRUD (name/icon/budget), notification thresholds, currency (view-only after onboarding).

### Onboarding (first launch)
Currency → income → confirm default categories (Groceries, Utilities, Transport, Dining, editable).

## 5. Recurring Payments Engine

On app foreground, check each `recurring_payments.next_due_date`. If due, materialize it as a real `expenses` row (`is_recurring = true`) so it's editable/deletable like any manual entry and counts correctly in the heatmap and Insights.

## 6. Piggy Bank Reconciliation Engine

Runs whenever a past `expense` or `income_entries` row is edited or deleted:

- **Expense amount increased** → recompute Free Balance. If it goes negative, show a **Deficit Resolution** modal: "Mark month over-budget" or "Borrow from [pick piggy bank]" → creates a `deficit_borrow` withdrawal on the chosen bank.
- **Expense decreased/deleted** → Free Balance rises automatically (it's derived, not stored). Show a dismissible sweep prompt: "You have $X unallocated. Add to [piggy bank]?" → on accept, creates a `sweep` deposit.
- **Past income reduced** → if total active-bank allocations now exceed available funds, pull the deficit from piggy banks **most-recently-funded first**, capping each bank at 0 before moving to the next, logging an `income_correction` transaction (with alert) per bank touched. If the deficit still isn't covered after zeroing all active banks, fall back to marking the month over-budget.
- **Target price changed** → `saved_amount` is untouched; % progress is re-derived on read (`saved_amount / target_price`). If the new price drops below `saved_amount`, cap the bank's effective total at the new price and refund the excess to Free Balance (`price_decrease_refund`), which can push the goal to 100% ("Ready to Buy!").
- **Cancel goal** → full `saved_amount` released via a `cancel_refund` transaction; status → cancelled; history retained, not deleted.
- **100% reached** → user taps "Mark as Purchased": creates a real `expenses` row for `target_price`, status → purchased. Net effect on Free Balance is zero — the amount simply moves from "locked allocation" to "spent."

Allocation into a piggy bank happens three ways: manual transfer, leftover-budget sweep, or a % of a logged bonus income entry allocated at log time. The sweep prompt itself fires in two situations: (a) a past-expense edit/delete increases Free Balance, per above, and (b) a day or week ends under its budget cap — the app proactively surfaces "You saved $X this [day/week] — add it to [piggy bank]?" Both are dismissible; declining leaves the surplus simply sitting in Free Balance.

## 7. Notifications

Threshold checks run in-app immediately after an expense is saved (fires a local notification if a category or overall threshold is crossed). An end-of-month summary notification is scheduled locally for the last day of each month, comparing spend to prior months.

## 8. Testing

Jest for calculation logic — budget math, heatmap color thresholds, recurring-payment materialization, and the Piggy Bank reconciliation rules (deficit borrow, income-correction cascades, price-change recalculation, cancel refund) given these are the highest-risk, hardest-to-eyeball logic in the app. UI flows verified manually via Expo Go / dev client.
