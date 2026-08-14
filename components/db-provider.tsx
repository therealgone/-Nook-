import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getDb, seedDefaultsIfNeeded } from '../src/db/client';
import type { AppDb } from '../src/db/types';
import { materializeDuePayments } from '../src/domain/recurringMaterialization';
import { materializeDueIncome } from '../src/domain/recurringIncomeMaterialization';
import { todayIso } from '../utils/format';
import { colors } from '../constants/theme';

const DbContext = createContext<AppDb | undefined>(undefined);

export function DbProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const db = getDb();

  useEffect(() => {
    seedDefaultsIfNeeded(db)
      .then(() => materializeDuePayments(db, todayIso()))
      .then(() => materializeDueIncome(db, todayIso()))
      .then(() => setReady(true));
  }, [db]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.screenBg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return <DbContext.Provider value={db}>{children}</DbContext.Provider>;
}

export function useDb(): AppDb {
  const db = useContext(DbContext);
  if (!db) throw new Error('useDb must be used within a DbProvider');
  return db;
}
