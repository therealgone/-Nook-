import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PlusIcon } from 'phosphor-react-native';
import { useDb } from '../../components/db-provider';
import { useAddExpenseSheet } from '../../components/add-expense-sheet-context';
import { usePeriodAlerts } from '../../components/period-alerts-context';
import { useToast } from '../../components/toast-context';
import { MonthHeatmap, MonthNav } from '../../components/month-heatmap';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog, type DialogAction } from '../../components/ui/ConfirmDialog';
import { ListRow } from '../../components/ui/ListRow';
import { TextField } from '../../components/ui/TextField';
import { Button } from '../../components/ui/Button';
import { Body, SheetTitle } from '../../components/ui/Text';
import { listExpenses, updateExpense } from '../../src/repositories/expenses';
import { listCategories } from '../../src/repositories/categories';
import { listPiggyBanks } from '../../src/repositories/piggyBanks';
import { getDailyBudgetTarget } from '../../src/domain/dailyBudget';
import { borrowFromPiggyBank, handleExpenseAmountChanged, handleExpenseDeleted, sweepToPiggyBank } from '../../src/domain/reconciliation';
import type { Category, Expense } from '../../src/db/schema';
import { colors, fonts, heatColorForPercent, spacing } from '../../constants/theme';
import { formatCurrency } from '../../utils/format';

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function monthRangeFor(year: number, month: number) {
  const from = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  return { from, to, daysInMonth: new Date(Date.UTC(year, month + 1, 0)).getUTCDate() };
}

export default function HistoryScreen() {
  const db = useDb();
  const insets = useSafeAreaInsets();
  const { open: openAddSheet, refreshKey } = useAddExpenseSheet();
  const showToast = useToast();
  const { refresh: refreshPeriodAlerts } = usePeriodAlerts();

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dailyTarget, setDailyTarget] = useState(0);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ expense: Expense; actions: DialogAction[] } | null>(null);
  const [dialog, setDialog] = useState<{ title: string; message?: string; actions: DialogAction[] } | null>(null);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editError, setEditError] = useState<string | null>(null);

  const range = monthRangeFor(viewYear, viewMonth);

  const load = useCallback(async () => {
    const [exp, cats, target] = await Promise.all([
      listExpenses(db, { from: range.from, to: range.to }),
      listCategories(db),
      getDailyBudgetTarget(db),
    ]);
    setExpenses(exp);
    setCategories(cats);
    setDailyTarget(target);
  }, [db, range.from, range.to]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [refreshKey, load]);

  const dayData = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of expenses) totals.set(e.date, (totals.get(e.date) ?? 0) + e.amount);
    const data: Record<string, { total: number; percent: number | null }> = {};
    for (const [date, total] of totals) {
      data[date] = { total, percent: dailyTarget === 0 ? null : (total / dailyTarget) * 100 };
    }
    return data;
  }, [expenses, dailyTarget]);

  const monthSpent = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);
  const avgPerDay = range.daysInMonth === 0 ? 0 : monthSpent / range.daysInMonth;
  const overDays = useMemo(() => Object.values(dayData).filter((d) => (d.percent ?? 0) > 100).length, [dayData]);

  const monthList = useMemo(() => [...expenses].sort((a, b) => (b.date === a.date ? b.id - a.id : b.date.localeCompare(a.date))), [expenses]);

  const dayExpenses = useMemo(() => {
    if (!selectedDay) return [];
    return expenses.filter((e) => e.date === selectedDay).sort((a, b) => b.id - a.id);
  }, [expenses, selectedDay]);

  const dayTotal = selectedDay ? (dayData[selectedDay]?.total ?? 0) : 0;
  const dayHeatColor = selectedDay ? heatColorForPercent(dayData[selectedDay]?.percent ?? 0) : colors.accent;

  function categoryOf(id: number | null) {
    return categories.find((c) => c.id === id);
  }

  function primaryLabel(expense: Expense) {
    return categoryOf(expense.categoryId)?.name ?? expense.note ?? 'Uncategorized';
  }

  function changeMonth(delta: number) {
    let newMonth = viewMonth + delta;
    let newYear = viewYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setViewMonth(newMonth);
    setViewYear(newYear);
  }

  async function resolveDeficitOrSweep(deficit: number, sweepAvailable: number, relatedExpenseId?: number) {
    if (deficit > 0) {
      const banks = await listPiggyBanks(db, 'active');
      if (banks.length === 0 || relatedExpenseId === undefined) {
        setDialog({ title: 'Over budget', message: `This puts you ${formatCurrency(deficit)} over budget.`, actions: [] });
        return;
      }
      setDialog({
        title: 'Over budget',
        message: `You're ${formatCurrency(deficit)} over budget. Borrow from a piggy bank, or mark the month over-budget?`,
        actions: banks.map((bank) => ({
          label: `Borrow from ${bank.productName}`,
          variant: 'accent',
          onPress: async () => {
            await borrowFromPiggyBank(db, bank.id, deficit, relatedExpenseId);
            load();
          },
        })),
      });
      return;
    }
    if (sweepAvailable > 0) {
      const banks = await listPiggyBanks(db, 'active');
      if (banks.length === 0) return;
      setDialog({
        title: 'Extra funds freed up',
        message: `You freed up ${formatCurrency(sweepAvailable)}. Add it to a piggy bank?`,
        actions: banks.map((bank) => ({
          label: bank.productName,
          variant: 'accent',
          onPress: async () => {
            await sweepToPiggyBank(db, bank.id, sweepAvailable, relatedExpenseId);
            showToast(`${formatCurrency(sweepAvailable)} moved to ${bank.productName}`);
            load();
          },
        })),
      });
    }
  }

  function onPressExpense(expense: Expense) {
    setPicker({
      expense,
      actions: [
        {
          label: 'Edit',
          variant: 'accent',
          onPress: () => {
            setEditing(expense);
            setEditAmount(String(expense.amount));
            setEditNote(expense.note ?? '');
            setEditError(null);
          },
        },
        {
          label: 'Delete',
          variant: 'danger',
          onPress: async () => {
            const { deficit, sweepAvailable } = await handleExpenseDeleted(db, expense.id);
            await load();
            await refreshPeriodAlerts();
            await resolveDeficitOrSweep(deficit, sweepAvailable);
          },
        },
      ],
    });
  }

  async function saveEdit() {
    if (!editing) return;
    const parsed = Number(editAmount);
    if (!editAmount || Number.isNaN(parsed) || parsed <= 0) {
      setEditError('Enter a valid amount');
      return;
    }
    const noteChanged = editNote !== (editing.note ?? '');
    if (parsed !== editing.amount) {
      const { deficit, sweepAvailable } = await handleExpenseAmountChanged(db, editing.id, parsed);
      if (noteChanged) await updateExpense(db, editing.id, { note: editNote || null });
      const expenseId = editing.id;
      setEditing(null);
      await load();
      await refreshPeriodAlerts();
      await resolveDeficitOrSweep(deficit, sweepAvailable, expenseId);
    } else {
      if (noteChanged) await updateExpense(db, editing.id, { note: editNote || null });
      setEditing(null);
      await load();
      await refreshPeriodAlerts();
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={monthList}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 120, paddingTop: insets.top + 8 }}
        ListHeaderComponent={
          <>
            <MonthNav
              year={viewYear}
              month={viewMonth}
              spentLabel={`${formatCurrency(monthSpent)} spent`}
              onPrevMonth={() => changeMonth(-1)}
              onNextMonth={() => changeMonth(1)}
            />

            <Card style={styles.heatmapCard}>
              <MonthHeatmap
                year={viewYear}
                month={viewMonth}
                dayData={dayData}
                onSelectDay={setSelectedDay}
                onPrevMonth={() => changeMonth(-1)}
                onNextMonth={() => changeMonth(1)}
              />
            </Card>

            <View style={styles.statRow}>
              <StatCard kicker="Spent" value={formatCurrency(monthSpent)} />
              <StatCard kicker="Avg / day" value={formatCurrency(avgPerDay)} />
              <StatCard kicker="Over days" value={String(overDays)} tone={overDays > 0 ? 'danger' : 'default'} />
            </View>

            <Text style={styles.listTitle}>This month</Text>
          </>
        }
        ListEmptyComponent={<Body muted style={{ paddingHorizontal: spacing.lg }}>No expenses this month.</Body>}
        renderItem={({ item }) => {
          const category = categoryOf(item.categoryId);
          return (
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ListRow
                icon={category?.icon ?? 'help-circle'}
                swatchColor={category?.color}
                title={primaryLabel(item)}
                subtitle={category && item.note ? item.note : item.date}
                trailing={<Text style={styles.amount}>-{formatCurrency(item.amount)}</Text>}
                onPress={() => setSelectedDay(item.date)}
              />
            </View>
          );
        }}
      />

      <BottomSheet visible={!!selectedDay} onClose={() => setSelectedDay(null)}>
        <View style={styles.dayHeader}>
          <View>
            <Text style={styles.dayTitle}>{formatDayTitle(selectedDay)}</Text>
            <Text style={styles.daySubtitle}>{dayExpenses.length} expense{dayExpenses.length === 1 ? '' : 's'}</Text>
          </View>
          <Text style={[styles.dayTotal, { color: dayHeatColor }]}>{formatCurrency(dayTotal)}</Text>
        </View>

        <FlatList
          data={dayExpenses}
          keyExtractor={(item) => String(item.id)}
          style={{ maxHeight: 280 }}
          ListEmptyComponent={<Body muted>No expenses this day.</Body>}
          renderItem={({ item }) => {
            const category = categoryOf(item.categoryId);
            return (
              <ListRow
                avatarSize={36}
                icon={category?.icon ?? 'help-circle'}
                swatchColor={category?.color}
                title={primaryLabel(item)}
                subtitle={category && item.note ? item.note : undefined}
                trailing={<Text style={styles.amount}>{formatCurrency(item.amount)}</Text>}
                onPress={() => onPressExpense(item)}
              />
            );
          }}
        />

        <Pressable
          style={styles.addToDayButton}
          onPress={() => {
            if (selectedDay) openAddSheet({ day: selectedDay });
          }}
          accessibilityRole="button"
          accessibilityLabel="Add to this day"
        >
          <PlusIcon size={16} color={colors.accent300} />
          <Text style={styles.addToDayText}>Add to this day</Text>
        </Pressable>
      </BottomSheet>

      <BottomSheet visible={!!editing} onClose={() => setEditing(null)}>
        <SheetTitle>Edit expense</SheetTitle>
        <TextField placeholder="Amount" keyboardType="decimal-pad" value={editAmount} onChangeText={setEditAmount} />
        <TextField placeholder="Note" value={editNote} onChangeText={setEditNote} />
        {editError && <Body style={{ color: colors.danger }}>{editError}</Body>}
        <View style={styles.editActions}>
          <Button label="Cancel" variant="secondary" onPress={() => setEditing(null)} />
          <Button label="Save" onPress={saveEdit} />
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={!!picker}
        title={picker ? primaryLabel(picker.expense) : ''}
        message={picker ? formatCurrency(picker.expense.amount) : undefined}
        actions={picker?.actions ?? []}
        onDismiss={() => setPicker(null)}
      />

      <ConfirmDialog
        visible={!!dialog}
        title={dialog?.title ?? ''}
        message={dialog?.message}
        actions={dialog?.actions ?? []}
        onDismiss={() => setDialog(null)}
      />
    </View>
  );
}

function formatDayTitle(iso: string | null): string {
  if (!iso) return '';
  const [year, month, day] = iso.split('-').map(Number);
  return `${day} ${MONTH_LABELS[month - 1]} ${year}`;
}

function StatCard({ kicker, value, tone = 'default' }: { kicker: string; value: string; tone?: 'default' | 'danger' }) {
  return (
    <Card style={styles.statCard}>
      <Text style={styles.statKicker}>{kicker}</Text>
      <Text style={[styles.statValue, tone === 'danger' && { color: colors.danger }]}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  heatmapCard: { marginHorizontal: spacing.md, marginTop: spacing.md, padding: 14 },
  statRow: { flexDirection: 'row', gap: 10, marginHorizontal: spacing.lg, marginTop: spacing.md },
  statCard: { flex: 1, padding: 13, gap: 4, alignItems: 'flex-start' },
  statKicker: { fontFamily: fonts.medium, fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase', color: '#5d6172' },
  statValue: { fontFamily: fonts.medium, fontSize: 17, color: colors.ink, fontVariant: ['tabular-nums'] },
  listTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink, marginHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: 4 },
  amount: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dayTitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  daySubtitle: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.inkMuted, marginTop: 2 },
  dayTotal: { fontFamily: fonts.medium, fontSize: 20, fontVariant: ['tabular-nums'] },
  addToDayButton: {
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.accent700,
    backgroundColor: 'rgba(145,132,217,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addToDayText: { fontFamily: fonts.medium, fontSize: 14, color: colors.accent300 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
});
