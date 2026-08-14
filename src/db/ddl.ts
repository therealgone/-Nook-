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
  budget_amount REAL,
  budget_period TEXT
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
  category_id INTEGER REFERENCES categories(id),
  frequency TEXT NOT NULL,
  next_due_date TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recurring_income (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount REAL NOT NULL,
  frequency TEXT NOT NULL,
  next_due_date TEXT NOT NULL,
  note TEXT
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
