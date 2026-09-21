# Nook

A minimalist, offline-first expense tracker built with Expo + React Native. All data stays on-device — no cloud sync, no accounts, no bank linking.

## Core idea

Instead of showing raw "income minus expenses," Nook tracks a **Free Balance**:

```
Free Balance = Σ income − Σ expenses − Σ (saved amounts in active Piggy Banks)
```

Money set aside for a savings goal (a "Piggy Bank") is treated as spent-for-budgeting-purposes even though it hasn't left your account, so the number you see is what's actually safe to spend.

## Features

- **Home** — daily/weekly budget gauges, quick expense entry, category shortcuts
- **History** — GitHub-style heatmap of daily spending vs. budget, with retroactive edit/delete
- **Insights** — per-category spend breakdown and budget health bars
- **Piggy Bank** — savings goals with progress tracking, funded via manual transfer, leftover-budget sweeps, or a % of logged bonus income
- **Recurring payments & income** — automatically materialized into real ledger entries on their due dates
- **Local notifications** — budget threshold alerts and an end-of-month summary
- **Reconciliation engine** — if an edited/deleted past expense creates a deficit, it's pulled from Piggy Banks (most-recently-funded first) rather than silently breaking the budget

## Tech stack

- [Expo](https://docs.expo.dev/versions/v57.0.0/) (SDK 57) + React Native + TypeScript
- `expo-router` — file-based navigation, 5-tab layout
- `expo-sqlite` + `drizzle-orm` — local relational storage, source of truth
- `react-native-svg` — hand-drawn gauges and heatmap (no third-party chart libs)
- Jest — unit tests for budget math, recurrence, and reconciliation logic

## Getting started

```bash
npm install
npm start        # then choose a platform, or:
npm run android
npm run ios
npm run web
```

## Testing

```bash
npm test
```

## Project structure

```
app/            expo-router screens (tabs: home, history, insights, piggy-bank, settings)
components/     shared UI (expense sheet, keypad, budget bar, heatmap, etc.)
src/db/         SQLite client, schema, and DDL (drizzle-orm)
src/domain/     pure business logic — budget periods, recurrence, reconciliation, etc.
src/repositories/  data access layer over the SQLite tables
docs/           design specs and implementation plans
```

## Design docs

Full product design and data model live in `docs/superpowers/specs/`, with implementation plans in `docs/superpowers/plans/`.
