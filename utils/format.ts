import { now as clockNow } from './devClock';

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function splitCurrency(amount: number): { sign: string; whole: string; cents: string } {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const whole = Math.floor(abs).toLocaleString('en-US');
  const cents = Math.round((abs % 1) * 100)
    .toString()
    .padStart(2, '0');
  return { sign, whole, cents };
}

export function daysLeftInMonth(): number {
  const now = clockNow();
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  return daysInMonth - now.getUTCDate();
}

export function todayIso(): string {
  return clockNow().toISOString().slice(0, 10);
}

export function currentMonthRange(): { from: string; to: string } {
  const now = clockNow();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function currentWeekRange(): { from: string; to: string } {
  const now = clockNow();
  const diffToMonday = (now.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday));
  const sunday = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate() + 6));
  return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
}
