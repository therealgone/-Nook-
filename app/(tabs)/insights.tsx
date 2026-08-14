import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { DynamicIcon } from '../../constants/icons';
import { useDb } from '../../components/db-provider';
import { Card } from '../../components/ui/Card';
import { Body } from '../../components/ui/Text';
import { listCategories } from '../../src/repositories/categories';
import { totalExpenses } from '../../src/repositories/expenses';
import { getPeriodSpend } from '../../src/domain/budgetPeriods';
import type { Category } from '../../src/db/schema';
import { colors, fonts, heatColorForPercent, spacing } from '../../constants/theme';
import { currentMonthRange, currentWeekRange, formatCurrency } from '../../utils/format';

type Period = 'week' | 'month';
type CategorySpend = { spentAmount: number; percentUsed: number | null; scaledTarget: number | null };

const WEEK_TO_MONTH = 31 / 7;
const MONTH_TO_WEEK = 7 / 31;

export default function InsightsScreen() {
  const db = useDb();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<Period>('month');
  const [categories, setCategories] = useState<Category[]>([]);
  const [spendByCategory, setSpendByCategory] = useState<Record<number, CategorySpend>>({});

  const load = useCallback(async () => {
    const cats = await listCategories(db);
    setCategories(cats);
    const range = period === 'week' ? currentWeekRange() : currentMonthRange();
    const entries = await Promise.all(
      cats.map(async (cat): Promise<readonly [number, CategorySpend]> => {
        if (cat.budgetAmount === null) {
          const spentAmount = await totalExpenses(db, { from: range.from, to: range.to, categoryId: cat.id });
          return [cat.id, { spentAmount, percentUsed: null, scaledTarget: null }];
        }
        const matchesPeriod = (period === 'week' && cat.budgetPeriod === 'weekly') || (period === 'month' && cat.budgetPeriod === 'monthly');
        const scale = matchesPeriod ? 1 : cat.budgetPeriod === 'monthly' ? MONTH_TO_WEEK : WEEK_TO_MONTH;
        const scaledTarget = cat.budgetAmount * scale;
        const spend = await getPeriodSpend(db, range.from, range.to, scaledTarget, cat.id);
        return [cat.id, { spentAmount: spend.spentAmount, percentUsed: spend.percentUsed, scaledTarget }];
      }),
    );
    setSpendByCategory(Object.fromEntries(entries));
  }, [db, period]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const totalSpend = categories.reduce((sum, cat) => sum + (spendByCategory[cat.id]?.spentAmount ?? 0), 0);
  const totalBudgeted = categories.reduce((sum, cat) => sum + (spendByCategory[cat.id]?.scaledTarget ?? 0), 0);

  const topCategories = [...categories]
    .filter((c) => (spendByCategory[c.id]?.spentAmount ?? 0) > 0)
    .sort((a, b) => (spendByCategory[b.id]?.spentAmount ?? 0) - (spendByCategory[a.id]?.spentAmount ?? 0))
    .slice(0, 5);
  const topSpendSum = topCategories.reduce((sum, c) => sum + (spendByCategory[c.id]?.spentAmount ?? 0), 0);

  const sortedCategories = [...categories].sort(
    (a, b) => (spendByCategory[b.id]?.spentAmount ?? 0) - (spendByCategory[a.id]?.spentAmount ?? 0),
  );

  return (
    <View style={styles.container}>
      <View style={[styles.titleRow, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.screenTitle}>Insights</Text>
        <View style={styles.segment}>
          <Pressable style={[styles.segmentOpt, period === 'week' && styles.segmentOptSelected]} onPress={() => setPeriod('week')}>
            <Text style={[styles.segmentText, period === 'week' && styles.segmentTextSelected]}>Week</Text>
          </Pressable>
          <Pressable style={[styles.segmentOpt, period === 'month' && styles.segmentOptSelected]} onPress={() => setPeriod('month')}>
            <Text style={[styles.segmentText, period === 'month' && styles.segmentTextSelected]}>Month</Text>
          </Pressable>
        </View>
      </View>

      <FlatList
        data={sortedCategories}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <LinearGradient colors={['#232532', '#1c1e2c']} style={styles.periodCard}>
            <Text style={styles.kicker}>{period === 'month' ? 'THIS MONTH SPEND' : 'THIS WEEK SPEND'}</Text>
            <Text style={styles.periodFigure}>{formatCurrency(totalSpend)}</Text>
            <Text style={styles.periodSubtitle}>of {formatCurrency(totalBudgeted)} budgeted</Text>

            {topCategories.length > 0 && (
              <>
                <View style={styles.compositionBar}>
                  {topCategories.map((cat) => {
                    const spent = spendByCategory[cat.id]?.spentAmount ?? 0;
                    const flex = topSpendSum === 0 ? 0 : spent / topSpendSum;
                    return <View key={cat.id} style={{ flex, backgroundColor: cat.color, borderRadius: 3 }} />;
                  })}
                </View>
                <View style={styles.legendWrap}>
                  {topCategories.map((cat) => (
                    <View key={cat.id} style={styles.legendItem}>
                      <View style={[styles.legendSwatch, { backgroundColor: cat.color }]} />
                      <Text style={styles.legendText}>{cat.name}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </LinearGradient>
        }
        ListEmptyComponent={<Body muted style={{ paddingHorizontal: spacing.lg }}>No categories yet — add some in Settings.</Body>}
        renderItem={({ item }) => {
          const spend = spendByCategory[item.id];
          const hasLimit = item.budgetAmount !== null;
          const rawPercent = spend?.percentUsed ?? 0;
          const percent = Math.min(100, rawPercent);
          const a11yLabel = hasLimit
            ? `${item.name}, ${formatCurrency(spend?.spentAmount ?? 0)} of ${formatCurrency(spend?.scaledTarget ?? 0)}, ${Math.round(rawPercent)} percent used`
            : `${item.name}, ${formatCurrency(spend?.spentAmount ?? 0)}, no limit set`;
          return (
            <View style={{ paddingHorizontal: spacing.lg, marginBottom: 10 }}>
              <Card style={styles.categoryCard} accessibilityLabel={a11yLabel}>
                <View style={styles.categoryHeader}>
                  <View style={styles.categoryTitleRow}>
                    <View style={[styles.avatar, { backgroundColor: `${item.color}22` }]}>
                      <DynamicIcon name={item.icon} size={14} color={item.color} />
                    </View>
                    <Text style={styles.categoryName}>{item.name}</Text>
                  </View>
                  <Text style={styles.categoryAmount}>
                    {formatCurrency(spend?.spentAmount ?? 0)}
                    {hasLimit ? (
                      <Text style={styles.categoryLimit}> / {formatCurrency(spend?.scaledTarget ?? 0)}</Text>
                    ) : (
                      <Text style={styles.categoryLimit}> · no limit</Text>
                    )}
                  </Text>
                </View>
                <View style={styles.barRow}>
                  <View style={styles.barTrack}>
                    {hasLimit && (
                      <View style={[styles.barFill, { width: `${percent}%`, backgroundColor: heatColorForPercent(rawPercent) }]} />
                    )}
                  </View>
                  <Text style={[styles.percentText, rawPercent >= 90 && hasLimit ? { color: colors.danger } : null]}>
                    {hasLimit ? `${Math.round(rawPercent)}%` : '—'}
                  </Text>
                </View>
              </Card>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg },
  screenTitle: { fontFamily: fonts.medium, fontSize: 20, letterSpacing: -0.4, color: colors.ink },
  segment: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 999, borderWidth: 1, borderColor: colors.hairline, padding: 3 },
  segmentOpt: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999 },
  segmentOptSelected: { backgroundColor: colors.accent900 },
  segmentText: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.inkMuted },
  segmentTextSelected: { color: colors.accent300 },
  periodCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    gap: 4,
  },
  kicker: { fontFamily: fonts.medium, fontSize: 10, letterSpacing: 1.6, color: colors.accent },
  periodFigure: { fontFamily: fonts.medium, fontSize: 34, color: colors.inkStrong, fontVariant: ['tabular-nums'], marginTop: 2 },
  periodSubtitle: { fontFamily: fonts.regular, fontSize: 12, color: colors.inkMuted, marginBottom: 10 },
  compositionBar: { flexDirection: 'row', height: 9, borderRadius: 3, overflow: 'hidden', gap: 3 },
  legendWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 7, height: 7, borderRadius: 2 },
  legendText: { fontFamily: fonts.regular, fontSize: 11, color: '#9397ab' },
  categoryCard: { gap: 11 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  categoryTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  avatar: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  categoryName: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink },
  categoryAmount: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, fontVariant: ['tabular-nums'] },
  categoryLimit: { fontFamily: fonts.regular, color: '#5d6172' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceSunken, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  percentText: { width: 38, textAlign: 'right', fontFamily: fonts.regular, fontSize: 11, color: colors.inkMuted },
});
