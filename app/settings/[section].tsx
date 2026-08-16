import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDb } from '../../components/db-provider';
import { CalendarPicker } from '../../components/calendar-picker';
import { SettingsHeader } from '../../components/settings-header';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Chip } from '../../components/ui/Chip';
import { IconButton } from '../../components/ui/IconButton';
import { IconSwatchPicker } from '../../components/ui/IconSwatchPicker';
import { ListRow } from '../../components/ui/ListRow';
import { TextField } from '../../components/ui/TextField';
import { Body, SheetTitle } from '../../components/ui/Text';
import { deleteIncome, listIncome, logIncome } from '../../src/repositories/income';
import { createRecurringIncome, deleteRecurringIncome, listRecurringIncome } from '../../src/repositories/recurringIncome';
import { createCategory, deleteCategory, listCategories } from '../../src/repositories/categories';
import { createRecurringPayment, deleteRecurringPayment, listRecurringPayments, updateRecurringPayment } from '../../src/repositories/recurringPayments';
import { createThreshold, deleteThreshold, listAllThresholds } from '../../src/repositories/notificationThresholds';
import { advanceDate } from '../../src/domain/recurrence';
import type { Category, IncomeEntry, NotificationThreshold, RecurringIncome, RecurringPayment } from '../../src/db/schema';
import { colors, fonts, radius, spacing } from '../../constants/theme';
import { formatCurrency, todayIso } from '../../utils/format';

const SECTION_META: Record<string, { title: string; blurb: string }> = {
  income: { title: 'Income', blurb: 'Log your salary, bonuses and one-off adjustments. Fixed monthly income repeats automatically.' },
  categories: { title: 'Categories', blurb: 'Set a weekly or monthly limit per category, or leave it unlimited for occasional spending.' },
  recurring: { title: 'Recurring payments', blurb: 'Rent, subscriptions and bills that repeat on a schedule — logged automatically when due.' },
  alerts: { title: 'Alerts', blurb: 'Get nudged when a category or your overall spend crosses a threshold you set.' },
};

export default function SettingsSection() {
  const { section } = useLocalSearchParams<{ section: string }>();
  const meta = SECTION_META[section] ?? { title: 'Settings', blurb: '' };

  return (
    <ScrollView style={styles.container}>
      <SettingsHeader title={meta.title} />
      <Text style={styles.blurb}>{meta.blurb}</Text>
      <View style={styles.body}>
        {section === 'income' && <IncomeSection />}
        {section === 'categories' && <CategoriesSection />}
        {section === 'recurring' && <RecurringSection />}
        {section === 'alerts' && <AlertsSection />}
      </View>
    </ScrollView>
  );
}

function Row({
  icon,
  swatchColor,
  title,
  subtitle,
  value,
  onDelete,
}: {
  icon: string;
  swatchColor?: string;
  title: string;
  subtitle?: string;
  value: string;
  onDelete: () => void;
}) {
  return (
    <ListRow
      icon={icon}
      swatchColor={swatchColor}
      title={title}
      subtitle={subtitle}
      avatarSize={36}
      radius={14}
      trailing={
        <View style={styles.rowTrailing}>
          <Text style={styles.rowValue}>{value}</Text>
          <IconButton icon="trash-outline" tone="danger" accessibilityLabel={`Delete ${title}`} onPress={onDelete} />
        </View>
      }
    />
  );
}

function AddButton({ label, onPress }: { label: string; onPress: () => void }) {
  return <Button label={`+ ${label}`} variant="dashed" onPress={onPress} />;
}

function DateField({ date, onPress }: { date: string; onPress: () => void }) {
  return (
    <Pressable style={styles.dateField} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Date: ${date}`}>
      <Text style={styles.dateFieldLabel}>Date</Text>
      <Text style={styles.dateFieldValue}>{date}</Text>
    </Pressable>
  );
}

function IncomeSection() {
  const db = useDb();
  const [income, setIncome] = useState<IncomeEntry[]>([]);
  const [schedules, setSchedules] = useState<RecurringIncome[]>([]);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');
  const [type, setType] = useState<IncomeEntry['type']>('fixed_monthly');
  const [date, setDate] = useState(todayIso());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [inc, sched] = await Promise.all([listIncome(db), listRecurringIncome(db)]);
    setIncome(inc);
    setSchedules(sched);
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openSheet() {
    setAmount('');
    setLabel('');
    setType('fixed_monthly');
    setDate(todayIso());
    setError(null);
    setOpen(true);
  }

  async function save() {
    const parsed = Number(amount);
    if (!amount || Number.isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid amount');
      return;
    }
    const note = label.trim() || null;
    await logIncome(db, { amount: parsed, type, date, note });
    if (type === 'fixed_monthly') {
      await createRecurringIncome(db, { amount: parsed, frequency: 'monthly', nextDueDate: advanceDate(date, 'monthly'), note });
    }
    setOpen(false);
    load();
  }

  return (
    <>
      {income.map((entry) => (
        <Row
          key={entry.id}
          icon="cash"
          swatchColor={colors.positive}
          title={entry.note || entry.type.replace('_', ' ')}
          subtitle={entry.note ? `${entry.type.replace('_', ' ')} • ${entry.date}` : entry.date}
          value={formatCurrency(entry.amount)}
          onDelete={() => deleteIncome(db, entry.id).then(load)}
        />
      ))}
      {schedules.map((s) => (
        <Row
          key={`r${s.id}`}
          icon="repeat"
          swatchColor={colors.positive}
          title={`${formatCurrency(s.amount)} monthly`}
          subtitle={`Next: ${s.nextDueDate}`}
          value=""
          onDelete={() => deleteRecurringIncome(db, s.id).then(load)}
        />
      ))}
      {income.length === 0 && schedules.length === 0 && <Body muted>No income logged yet.</Body>}

      <AddButton label="Add income" onPress={openSheet} />

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <SheetTitle>Add income</SheetTitle>
        <TextField placeholder="Label (e.g. Salary)" value={label} onChangeText={setLabel} autoFocus />
        <TextField placeholder="Amount" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
        <View style={styles.chipRow}>
          {(['fixed_monthly', 'bonus', 'adjustment'] as const).map((t) => (
            <Chip key={t} label={t.replace('_', ' ')} selected={type === t} onPress={() => setType(t)} />
          ))}
        </View>
        <DateField date={date} onPress={() => setCalendarOpen(true)} />
        {error && <Body style={{ color: colors.danger }}>{error}</Body>}
        <View style={styles.sheetActions}>
          <Button label="Cancel" variant="secondary" onPress={() => setOpen(false)} />
          <Button label="Save" onPress={save} />
        </View>
      </BottomSheet>
      <CalendarPicker
        visible={calendarOpen}
        initialDate={date}
        onSelect={(iso) => {
          setDate(iso);
          setCalendarOpen(false);
        }}
        onClose={() => setCalendarOpen(false)}
      />
    </>
  );
}

function CategoriesSection() {
  const db = useDb();
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetChoice, setBudgetChoice] = useState<'weekly' | 'monthly' | 'no_limit'>('monthly');
  const [choice, setChoice] = useState({ icon: 'cart', color: '#5FC49E' });
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => setCategories(await listCategories(db)), [db]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openSheet() {
    setName('');
    setBudgetAmount('');
    setBudgetChoice('monthly');
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      setError('Enter a category name');
      return;
    }
    if (budgetChoice === 'no_limit') {
      await createCategory(db, { name: name.trim(), icon: choice.icon, color: choice.color, budgetAmount: null, budgetPeriod: null });
    } else {
      const parsed = Number(budgetAmount);
      if (!budgetAmount || Number.isNaN(parsed) || parsed <= 0) {
        setError('Enter a valid budget amount');
        return;
      }
      await createCategory(db, { name: name.trim(), icon: choice.icon, color: choice.color, budgetAmount: parsed, budgetPeriod: budgetChoice });
    }
    setOpen(false);
    load();
  }

  return (
    <>
      {categories.map((cat) => (
        <Row
          key={cat.id}
          icon={cat.icon}
          swatchColor={cat.color}
          title={cat.name}
          subtitle={cat.budgetAmount === null ? 'No limit' : `Per ${cat.budgetPeriod}`}
          value={cat.budgetAmount === null ? '—' : formatCurrency(cat.budgetAmount)}
          onDelete={() => deleteCategory(db, cat.id).then(load)}
        />
      ))}
      {categories.length === 0 && <Body muted>No categories yet.</Body>}

      <AddButton label="New category" onPress={openSheet} />

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <SheetTitle>New category</SheetTitle>
        <TextField placeholder="Name" value={name} onChangeText={setName} autoFocus />
        <IconSwatchPicker value={choice} onChange={setChoice} />
        <View style={styles.chipRow}>
          {(['weekly', 'monthly', 'no_limit'] as const).map((p) => (
            <Chip key={p} label={p === 'no_limit' ? 'No limit' : p} selected={budgetChoice === p} onPress={() => setBudgetChoice(p)} />
          ))}
        </View>
        {budgetChoice !== 'no_limit' && (
          <TextField placeholder="Budget amount" keyboardType="decimal-pad" value={budgetAmount} onChangeText={setBudgetAmount} />
        )}
        {error && <Body style={{ color: colors.danger }}>{error}</Body>}
        <View style={styles.sheetActions}>
          <Button label="Cancel" variant="secondary" onPress={() => setOpen(false)} />
          <Button label="Save" onPress={save} />
        </View>
      </BottomSheet>
    </>
  );
}

function RecurringSection() {
  const db = useDb();
  const [recurring, setRecurring] = useState<RecurringPayment[]>([]);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<RecurringPayment['frequency']>('monthly');
  const [nextDueDate, setNextDueDate] = useState(todayIso());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RecurringPayment | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editFrequency, setEditFrequency] = useState<RecurringPayment['frequency']>('monthly');
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => setRecurring(await listRecurringPayments(db)), [db]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function openSheet() {
    setLabel('');
    setAmount('');
    setFrequency('monthly');
    setNextDueDate(todayIso());
    setError(null);
    setOpen(true);
  }

  async function save() {
    const parsed = Number(amount);
    if (!label.trim()) {
      setError('Enter a label');
      return;
    }
    if (!amount || Number.isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid amount');
      return;
    }
    await createRecurringPayment(db, { label: label.trim(), amount: parsed, categoryId: null, frequency, nextDueDate });
    setOpen(false);
    load();
  }

  function startEdit(r: RecurringPayment) {
    setEditing(r);
    setEditAmount(String(r.amount));
    setEditFrequency(r.frequency);
    setEditError(null);
  }

  async function saveEdit() {
    if (!editing) return;
    const parsed = Number(editAmount);
    if (!editAmount || Number.isNaN(parsed) || parsed <= 0) {
      setEditError('Enter a valid amount');
      return;
    }
    await updateRecurringPayment(db, editing.id, { amount: parsed, frequency: editFrequency });
    setEditing(null);
    load();
  }

  return (
    <>
      {recurring.map((r) => (
        <ListRow
          key={r.id}
          icon="repeat"
          swatchColor={colors.accent}
          title={r.label}
          subtitle={r.frequency}
          avatarSize={36}
          radius={14}
          onPress={() => startEdit(r)}
          trailing={
            <View style={styles.rowTrailing}>
              <Text style={styles.rowValue}>{formatCurrency(r.amount)}</Text>
              <IconButton icon="trash-outline" tone="danger" accessibilityLabel={`Delete ${r.label}`} onPress={() => deleteRecurringPayment(db, r.id).then(load)} />
            </View>
          }
        />
      ))}
      {recurring.length === 0 && <Body muted>No recurring payments yet.</Body>}

      <AddButton label="Add recurring payment" onPress={openSheet} />

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <SheetTitle>New recurring payment</SheetTitle>
        <TextField placeholder="Label" value={label} onChangeText={setLabel} autoFocus />
        <TextField placeholder="Amount" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
        <View style={styles.chipRow}>
          {(['weekly', 'monthly', 'yearly'] as const).map((f) => (
            <Chip key={f} label={f} selected={frequency === f} onPress={() => setFrequency(f)} />
          ))}
        </View>
        <DateField date={nextDueDate} onPress={() => setCalendarOpen(true)} />
        {error && <Body style={{ color: colors.danger }}>{error}</Body>}
        <View style={styles.sheetActions}>
          <Button label="Cancel" variant="secondary" onPress={() => setOpen(false)} />
          <Button label="Save" onPress={save} />
        </View>
      </BottomSheet>
      <CalendarPicker
        visible={calendarOpen}
        initialDate={nextDueDate}
        onSelect={(iso) => {
          setNextDueDate(iso);
          setCalendarOpen(false);
        }}
        onClose={() => setCalendarOpen(false)}
      />

      <BottomSheet visible={!!editing} onClose={() => setEditing(null)}>
        <SheetTitle>Edit {editing?.label}</SheetTitle>
        <TextField placeholder="Amount" keyboardType="decimal-pad" value={editAmount} onChangeText={setEditAmount} />
        <View style={styles.chipRow}>
          {(['weekly', 'monthly', 'yearly'] as const).map((f) => (
            <Chip key={f} label={f} selected={editFrequency === f} onPress={() => setEditFrequency(f)} />
          ))}
        </View>
        {editError && <Body style={{ color: colors.danger }}>{editError}</Body>}
        <View style={styles.sheetActions}>
          <Button label="Cancel" variant="secondary" onPress={() => setEditing(null)} />
          <Button label="Save" onPress={saveEdit} />
        </View>
      </BottomSheet>
    </>
  );
}

function AlertsSection() {
  const db = useDb();
  const [thresholds, setThresholds] = useState<NotificationThreshold[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [thresholdPct, setThresholdPct] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [thr, cats] = await Promise.all([listAllThresholds(db), listCategories(db)]);
    setThresholds(thr);
    setCategories(cats);
  }, [db]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  function categoryOf(id: number | null) {
    if (id === null) return undefined;
    return categories.find((c) => c.id === id);
  }

  function openSheet() {
    setCategoryId(null);
    setThresholdPct('');
    setError(null);
    setOpen(true);
  }

  async function save() {
    const parsed = Number(thresholdPct);
    if (!thresholdPct || Number.isNaN(parsed) || parsed <= 0) {
      setError('Enter a valid percentage');
      return;
    }
    await createThreshold(db, { categoryId, thresholdPct: parsed });
    setOpen(false);
    load();
  }

  return (
    <>
      {thresholds.map((t) => {
        const cat = categoryOf(t.categoryId);
        return (
          <Row
            key={t.id}
            icon={cat?.icon ?? 'notifications'}
            swatchColor={cat?.color ?? colors.inkMuted}
            title={cat?.name ?? 'Overall'}
            value={`${t.thresholdPct}%`}
            onDelete={() => deleteThreshold(db, t.id).then(load)}
          />
        );
      })}
      {thresholds.length === 0 && <Body muted>No alerts set.</Body>}

      <AddButton label="New alert" onPress={openSheet} />

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <SheetTitle>New alert</SheetTitle>
        <View style={styles.chipRow}>
          <Chip label="Overall" selected={categoryId === null} onPress={() => setCategoryId(null)} />
          {categories.map((cat) => (
            <Chip key={cat.id} label={cat.name} icon={cat.icon} swatchColor={cat.color} selected={categoryId === cat.id} onPress={() => setCategoryId(cat.id)} />
          ))}
        </View>
        <TextField placeholder="Threshold % (e.g. 80)" keyboardType="decimal-pad" value={thresholdPct} onChangeText={setThresholdPct} />
        {error && <Body style={{ color: colors.danger }}>{error}</Body>}
        <View style={styles.sheetActions}>
          <Button label="Cancel" variant="secondary" onPress={() => setOpen(false)} />
          <Button label="Save" onPress={save} />
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  blurb: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.inkMuted, maxWidth: 300, marginHorizontal: spacing.lg, marginBottom: spacing.md },
  body: { paddingHorizontal: spacing.lg, paddingBottom: 60, gap: 10 },
  rowTrailing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowValue: { fontFamily: fonts.regular, fontSize: 13, color: '#cfd3e5', fontVariant: ['tabular-nums'] },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dateFieldLabel: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.inkMuted },
  dateFieldValue: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, fontVariant: ['tabular-nums'] },
});
