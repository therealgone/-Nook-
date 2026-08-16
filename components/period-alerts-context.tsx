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
