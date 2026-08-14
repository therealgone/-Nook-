export type Frequency = 'weekly' | 'monthly' | 'yearly';

export function advanceDate(date: string, frequency: Frequency): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  if (frequency === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else if (frequency === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}
