let overrideDate: string | null = null;

export function setDevDate(date: string | null): void {
  overrideDate = date;
}

export function getDevDate(): string | null {
  return overrideDate;
}

export function now(): Date {
  if (overrideDate) return new Date(`${overrideDate}T00:00:00.000Z`);
  return new Date();
}
