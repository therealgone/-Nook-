import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CaretRightIcon, UserIcon, WrenchIcon } from 'phosphor-react-native';
import { DynamicIcon } from '../../constants/icons';
import { useDb } from '../../components/db-provider';
import { SettingsHeader } from '../../components/settings-header';
import { listIncome } from '../../src/repositories/income';
import { listCategories } from '../../src/repositories/categories';
import { listRecurringPayments } from '../../src/repositories/recurringPayments';
import { listAllThresholds } from '../../src/repositories/notificationThresholds';
import { colors, fonts, radius, spacing } from '../../constants/theme';
import { currentMonthRange, formatCurrency } from '../../utils/format';

const CARDS: { key: 'income' | 'categories' | 'recurring' | 'alerts'; title: string; subtitle: string; icon: string; color: string }[] = [
  { key: 'income', title: 'Income', subtitle: 'Salary, bonuses, repeats', icon: 'cash', color: '#5FC49E' },
  { key: 'categories', title: 'Categories', subtitle: 'Limits, icons and colours', icon: 'squares', color: '#A78BFA' },
  { key: 'recurring', title: 'Recurring payments', subtitle: 'Rent, subscriptions, bills', icon: 'repeat', color: '#8391F5' },
  { key: 'alerts', title: 'Alerts', subtitle: 'Threshold nudges per category', icon: 'notifications', color: '#E0A15C' },
];

export default function SettingsHub() {
  const db = useDb();
  const router = useRouter();
  const [monthIncome, setMonthIncome] = useState(0);
  const [fixedTotal, setFixedTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const month = currentMonthRange();
    const [income, cats, recurring, thresholds] = await Promise.all([
      listIncome(db),
      listCategories(db),
      listRecurringPayments(db),
      listAllThresholds(db),
    ]);
    const incomeThisMonth = income
      .filter((e) => e.date >= month.from && e.date <= month.to)
      .reduce((sum, e) => sum + e.amount, 0);
    setMonthIncome(incomeThisMonth);
    setFixedTotal(recurring.reduce((sum, r) => sum + r.amount, 0));
    setCounts({
      income: income.length,
      categories: cats.length,
      recurring: recurring.length,
      alerts: thresholds.length,
    });
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <ScrollView style={styles.container}>
      <SettingsHeader title="Settings" />

      <View style={styles.body}>
        <LinearGradient colors={['#2b2741', '#1e2030']} style={styles.planCard}>
          <View style={styles.planAvatar}>
            <UserIcon size={20} color={colors.accent300} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.planTitle}>Monthly plan</Text>
            <Text style={styles.planSubtitle}>
              {formatCurrency(monthIncome)} income · {formatCurrency(fixedTotal)} fixed
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.cards}>
          {CARDS.map((card) => (
            <Pressable
              key={card.key}
              style={styles.card}
              onPress={() => router.push(`/settings/${card.key}`)}
              accessibilityRole="button"
              accessibilityLabel={card.title}
            >
              <View style={[styles.cardAvatar, { backgroundColor: `${card.color}22` }]}>
                <DynamicIcon name={card.icon} size={17} color={card.color} weight="regular" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{card.title}</Text>
                <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
              </View>
              <Text style={styles.cardCount}>{counts[card.key] ?? 0}</Text>
              <CaretRightIcon size={15} color="#4d5162" />
            </Pressable>
          ))}

          <Pressable
            style={styles.card}
            onPress={() => router.push('/settings/dev')}
            accessibilityRole="button"
            accessibilityLabel="Developer tools"
          >
            <View style={[styles.cardAvatar, { backgroundColor: `${colors.inkMuted}22` }]}>
              <WrenchIcon size={17} color={colors.inkMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Developer tools</Text>
              <Text style={styles.cardSubtitle}>App clock, recurring check</Text>
            </View>
            <CaretRightIcon size={15} color="#4d5162" />
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  body: { padding: spacing.lg, gap: spacing.md, paddingBottom: 60 },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: '#3a3556',
  },
  planAvatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: 'rgba(145,132,217,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitle: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink },
  planSubtitle: { fontFamily: fonts.regular, fontSize: 11.5, color: '#9397ab', marginTop: 2 },
  cards: { gap: spacing.sm + 1 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: 15,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  cardAvatar: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink },
  cardSubtitle: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.inkMuted, marginTop: 2 },
  cardCount: { fontFamily: fonts.regular, fontSize: 11, color: '#5d6172' },
});
