import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type SheetState = { visible: boolean; catId: number | null; day: string | null };

type Ctx = {
  state: SheetState;
  open: (opts?: { catId?: number; day?: string }) => void;
  close: () => void;
  refreshKey: number;
  bumpRefresh: () => void;
};

const AddExpenseSheetContext = createContext<Ctx | undefined>(undefined);

export function AddExpenseSheetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SheetState>({ visible: false, catId: null, day: null });
  const [refreshKey, setRefreshKey] = useState(0);

  const open = useCallback((opts?: { catId?: number; day?: string }) => {
    setState({ visible: true, catId: opts?.catId ?? null, day: opts?.day ?? null });
  }, []);
  const close = useCallback(() => setState((s) => ({ ...s, visible: false })), []);
  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <AddExpenseSheetContext.Provider value={{ state, open, close, refreshKey, bumpRefresh }}>
      {children}
    </AddExpenseSheetContext.Provider>
  );
}

export function useAddExpenseSheet(): Ctx {
  const ctx = useContext(AddExpenseSheetContext);
  if (!ctx) throw new Error('useAddExpenseSheet must be used within an AddExpenseSheetProvider');
  return ctx;
}
