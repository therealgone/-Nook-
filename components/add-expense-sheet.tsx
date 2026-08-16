import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircleIcon, XIcon } from 'phosphor-react-native';
import { useDb } from './db-provider';
import { useAddExpenseSheet } from './add-expense-sheet-context';
import { usePeriodAlerts } from './period-alerts-context';
import { useToast } from './toast-context';
import { BottomSheet } from './ui/BottomSheet';
import { Chip } from './ui/Chip';
import { AmountDisplay, Keypad, QuickAmountRow, addQuickAmount } from './amount-keypad';
import { listCategories } from '../src/repositories/categories';
import { logExpense } from '../src/repositories/expenses';
import type { Category } from '../src/db/schema';
import { colors, fonts, radius } from '../constants/theme';
import { formatCurrency, todayIso } from '../utils/format';

export function AddExpenseSheet() {
  const db = useDb();
  const { state, close, bumpRefresh } = useAddExpenseSheet();
  const { refresh: refreshPeriodAlerts } = usePeriodAlerts();
  const showToast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [amount, setAmount] = useState('');
  const [catId, setCatId] = useState<number | null>(null);

  useEffect(() => {
    if (!state.visible) return;
    setAmount('');
    setCatId(state.catId);
    listCategories(db).then((cats) => {
      setCategories(cats);
      if (state.catId === null && cats.length > 0) setCatId(cats[0].id);
    });
  }, [db, state.visible, state.catId]);

  const parsed = Number(amount);
  const valid = amount.length > 0 && !Number.isNaN(parsed) && parsed > 0 && catId !== null;

  async function save() {
    if (!valid || catId === null) return;
    const category = categories.find((c) => c.id === catId);
    await logExpense(db, {
      amount: parsed,
      categoryId: catId,
      date: state.day ?? todayIso(),
      note: null,
      isRecurring: false,
    });
    close();
    bumpRefresh();
    await refreshPeriodAlerts();
    showToast(`${formatCurrency(parsed)} logged to ${category?.name ?? 'category'}`);
  }

  return (
    <BottomSheet visible={state.visible} onClose={close}>
      <View style={styles.header}>
        <Text style={styles.title}>New expense</Text>
        <Pressable onPress={close} style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close">
          <XIcon size={16} color={colors.inkMuted} />
        </Pressable>
      </View>

      <AmountDisplay value={amount} />
      <QuickAmountRow onAdd={(n) => setAmount((a) => addQuickAmount(a, n))} />

      <View style={styles.pillRow}>
        {categories.map((cat) => (
          <Chip key={cat.id} label={cat.name} selected={catId === cat.id} onPress={() => setCatId(cat.id)} />
        ))}
      </View>

      <Keypad value={amount} onChange={setAmount} />

      <Pressable
        onPress={save}
        disabled={!valid}
        style={[styles.saveButton, valid ? styles.saveEnabled : styles.saveDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Save expense"
      >
        <CheckCircleIcon size={18} color={valid ? colors.accent300 : colors.inkFaint} weight={valid ? 'fill' : 'regular'} />
        <Text style={[styles.saveText, { color: valid ? colors.accent300 : colors.inkFaint }]}>
          {state.day ? `Save to ${state.day}` : 'Save'}
        </Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#252838',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  saveButton: {
    height: 52,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveEnabled: { backgroundColor: 'rgba(145,132,217,0.14)', borderColor: '#6d61a8' },
  saveDisabled: { backgroundColor: '#212433', borderColor: '#2e3143' },
  saveText: { fontFamily: fonts.medium, fontSize: 14 },
});
