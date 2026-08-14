import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { ArrowDownRightIcon, BellSimpleIcon, GearSixIcon, WalletIcon } from 'phosphor-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDb } from '../../components/db-provider';
import { useAddExpenseSheet } from '../../components/add-expense-sheet-context';
import { BudgetBar } from '../../components/budget-bar';
import { Chip } from '../../components/ui/Chip';
import { ListRow } from '../../components/ui/ListRow';
import { Body } from '../../components/ui/Text';
import { calculateFreeBalance } from '../../src/domain/freeBalance';
import { getDailyBudgetTarget } from '../../src/domain/dailyBudget';
import { listExpenses, totalExpenses } from '../../src/repositories/expenses';
import { listCategories } from '../../src/repositories/categories';
import type { Category, Expense } from '../../src/db/schema';
import { colors, fonts, spacing } from '../../constants/theme';
import { currentMonthRange, currentWeekRange, daysLeftInMonth, formatCurrency, splitCurrency, todayIso } from '../../utils/format';

export default function HomeScreen() {
  const db = useDb();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { open, refreshKey } = useAddExpenseSheet();
  const [freeBalance, setFreeBalance] = useState(0);
  const [monthSpend, setMonthSpend] = useState(0);
  const [dailySpent, setDailySpent] = useState(0);
  const [dailyTarget, setDailyTarget] = useState(0);
  const [weekSpent, setWeekSpent] = useState(0);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const load = useCallback(async () => {
    const today = todayIso();
    const week = currentWeekRange();
    const month = currentMonthRange();
    const [balance, expenses, cats, target, todaySpend, weekTotal, monthTotal] = await Promise.all([
      calculateFreeBalance(db),
      listExpenses(db),
      listCategories(db),
      getDailyBudgetTarget(db),
      totalExpenses(db, { from: today, to: today }),
      totalExpenses(db, { from: week.from, to: week.to }),
      totalExpenses(db, { from: month.from, to: month.to }),
    ]);
    setFreeBalance(balance);
    setRecentExpenses([...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6));
    setCategories(cats);
    setDailyTarget(target);
    setDailySpent(todaySpend);
    setWeekSpent(weekTotal);
    setMonthSpend(monthTotal);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [refreshKey, load]);

  const balance = splitCurrency(freeBalance);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.brandRow}>
          <LinearGradient colors={['#9184d9', '#5d5294']} style={styles.brandTile}>
            <WalletIcon size={14} color="#171826" weight="fill" />
          </LinearGradient>
          <Text style={styles.brandLabel}>Money</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Alerts">
            <BellSimpleIcon size={17} color={colors.ink} />
          </Pressable>
          <Pressable
            style={styles.headerButton}
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            accessibilityLabel="Settings"
          >
            <GearSixIcon size={17} color={colors.ink} />
          </Pressable>
        </View>
      </View>

      <FlatList
        data={recentExpenses}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <>
            <BalanceHero balance={balance} monthSpend={monthSpend} />

            <LinearGradient colors={['#232532', '#1e2030']} style={styles.budgetCard}>
              <BudgetBar label="Today" spent={dailySpent} target={dailyTarget} />
              <BudgetBar label="This week" spent={weekSpent} target={dailyTarget * 7} />
            </LinearGradient>

            <FlatList
              horizontal
              data={categories}
              keyExtractor={(item) => String(item.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRail}
              renderItem={({ item }) => (
                <Chip label={item.name} icon={item.icon} swatchColor={item.color} onPress={() => open({ catId: item.id })} />
              )}
            />

            <View style={styles.recentHeader}>
              <Text style={styles.recentTitle}>Recent</Text>
              <Pressable onPress={() => router.push('/history')}>
                <Text style={styles.allActivity}>All activity</Text>
              </Pressable>
            </View>
          </>
        }
        ListEmptyComponent={<Body muted style={{ paddingHorizontal: spacing.lg }}>No expenses logged yet.</Body>}
        renderItem={({ item }) => {
          const category = categories.find((c) => c.id === item.categoryId);
          const primaryLabel = category?.name ?? item.note ?? 'Uncategorized';
          const secondaryLabel = category && item.note ? item.note : item.date;
          return (
            <View style={{ paddingHorizontal: spacing.lg }}>
              <ListRow
                icon={category?.icon ?? 'help-circle'}
                swatchColor={category?.color}
                title={primaryLabel}
                subtitle={secondaryLabel}
                trailing={<Text style={styles.amount}>-{formatCurrency(item.amount)}</Text>}
              />
            </View>
          );
        }}
      />
    </View>
  );
}

function BalanceHero({ balance, monthSpend }: { balance: ReturnType<typeof splitCurrency>; monthSpend: number }) {
  const opacity = useSharedValue(0.55);
  const scale = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(withSequence(withTiming(0.85, { duration: 3000 }), withTiming(0.55, { duration: 3000 })), -1, true);
    scale.value = withRepeat(withSequence(withTiming(1.08, { duration: 3000 }), withTiming(1, { duration: 3000 })), -1, true);
  }, [opacity, scale]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.hero} accessibilityRole="summary" accessibilityLabel={`Free balance ${balance.sign}$${balance.whole}.${balance.cents}`}>
      <Animated.View style={[styles.glow, glowStyle]} />
      <Text style={styles.kicker}>Free balance</Text>
      <View style={styles.amountRow}>
        <Text style={styles.amountSymbol}>{balance.sign}$</Text>
        <Text style={styles.amountWhole}>{balance.whole}</Text>
        <Text style={styles.amountCents}>.{balance.cents}</Text>
      </View>
      <View style={styles.metaRow}>
        <View style={styles.metaPill}>
          <ArrowDownRightIcon size={11} color={colors.accent300} weight="fill" />
          <Text style={styles.metaPillText}>{formatCurrency(monthSpend)} this month</Text>
        </View>
        <Text style={styles.daysLeft}>{daysLeftInMonth()} days left</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandTile: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  brandLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: { paddingTop: 30, paddingHorizontal: spacing.lg, paddingBottom: 26, overflow: 'hidden' },
  glow: {
    position: 'absolute',
    top: -70,
    left: '50%',
    marginLeft: -160,
    width: 320,
    height: 220,
    borderRadius: 160,
    backgroundColor: 'rgba(145,132,217,0.30)',
  },
  kicker: { fontFamily: fonts.medium, fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: colors.accent },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 6 },
  amountSymbol: { fontFamily: fonts.regular, fontSize: 30, color: '#9397ab' },
  amountWhole: { fontFamily: fonts.medium, fontSize: 58, lineHeight: 58, letterSpacing: -2, color: colors.inkStrong, fontVariant: ['tabular-nums'] },
  amountCents: { fontFamily: fonts.regular, fontSize: 24, color: colors.inkMuted, fontVariant: ['tabular-nums'] },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent900,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  metaPillText: { fontFamily: fonts.medium, fontSize: 11, color: colors.accent300 },
  daysLeft: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.inkMuted },
  budgetCard: {
    marginHorizontal: spacing.lg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 14,
    marginBottom: spacing.lg,
  },
  chipRail: { paddingHorizontal: spacing.lg, gap: 8, paddingBottom: spacing.lg },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: 4,
  },
  recentTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.ink },
  allActivity: { fontFamily: fonts.medium, fontSize: 12, color: colors.accent400 },
  amount: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink, fontVariant: ['tabular-nums'] },
});
