import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CaretLeftIcon, CaretRightIcon } from 'phosphor-react-native';
import { colors, fonts, heatColorForPercent } from '../constants/theme';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toIso(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function MonthHeatmap({
  year,
  month,
  dayData,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
}: {
  year: number;
  month: number;
  dayData: Record<string, { total: number; percent: number | null }>;
  onSelectDay: (iso: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  const firstOfMonth = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leadingBlanks = firstOfMonth.getUTCDay();
  const todayIso = new Date().toISOString().slice(0, 10);

  const cells: (number | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  return (
    <View style={styles.container}>
      <View style={styles.weekRow}>
        {WEEKDAY_LABELS.map((label, i) => (
          <Text key={i} style={styles.weekLabel}>
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((day, i) => {
          if (day === null) return <View key={i} style={styles.cell} />;
          const iso = toIso(year, month, day);
          const entry = dayData[iso];
          const hasSpend = !!entry && entry.total > 0;
          const heat = !hasSpend ? null : entry.percent !== null ? heatColorForPercent(entry.percent) : colors.accent;
          const strong = !hasSpend ? false : (entry.percent ?? 0) >= 90;
          const isToday = iso === todayIso;
          return (
            <Pressable key={i} style={styles.cell} onPress={() => onSelectDay(iso)}>
              <View
                style={[
                  styles.dayBox,
                  hasSpend
                    ? { backgroundColor: `${heat}${strong ? '3d' : '26'}`, borderColor: `${heat}3a` }
                    : { backgroundColor: '#1a1c2a', borderColor: '#232535' },
                  isToday && styles.dayBoxToday,
                ]}
              >
                <Text style={[styles.dayNumber, hasSpend && { color: '#e4e7f5' }]}>{day}</Text>
                {hasSpend && <View style={[styles.dot, { backgroundColor: heat ?? colors.accent }]} />}
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legendRow}>
        <Text style={styles.legendText}>Calm</Text>
        <View style={[styles.legendSwatch, { backgroundColor: '#1a1c2a' }]} />
        <View style={[styles.legendSwatch, { backgroundColor: '#5d5294' }]} />
        <View style={[styles.legendSwatch, { backgroundColor: '#9184d9' }]} />
        <View style={[styles.legendSwatch, { backgroundColor: '#d9848a' }]} />
        <Text style={styles.legendText}>Over</Text>
      </View>
    </View>
  );
}

export function MonthNav({
  year,
  month,
  spentLabel,
  onPrevMonth,
  onNextMonth,
}: {
  year: number;
  month: number;
  spentLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
}) {
  return (
    <View style={styles.navRow}>
      <Pressable onPress={onPrevMonth} style={styles.navButton} accessibilityRole="button" accessibilityLabel="Previous month">
        <CaretLeftIcon size={15} color={colors.ink} />
      </Pressable>
      <View style={styles.navCenter}>
        <Text style={styles.navTitle}>
          {MONTH_LABELS[month]} {year}
        </Text>
        <Text style={styles.navSubtitle}>{spentLabel}</Text>
      </View>
      <Pressable onPress={onNextMonth} style={styles.navButton} accessibilityRole="button" accessibilityLabel="Next month">
        <CaretRightIcon size={15} color={colors.ink} />
      </Pressable>
    </View>
  );
}

const CELL_SIZE = 40;

const styles = StyleSheet.create({
  container: { gap: 10 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  navButton: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navCenter: { alignItems: 'center', gap: 2 },
  navTitle: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  navSubtitle: { fontFamily: fonts.regular, fontSize: 11, color: colors.inkMuted },
  weekRow: { flexDirection: 'row' },
  weekLabel: { width: CELL_SIZE, textAlign: 'center', fontFamily: fonts.regular, fontSize: 10, color: '#5d6172' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: { width: CELL_SIZE, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center' },
  dayBox: {
    width: CELL_SIZE - 6,
    height: CELL_SIZE - 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayBoxToday: { borderColor: colors.accent, borderWidth: 1 },
  dayNumber: { fontFamily: fonts.regular, fontSize: 11, color: '#4d5162' },
  dot: { width: 3, height: 3, borderRadius: 1.5 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  legendText: { fontFamily: fonts.regular, fontSize: 10, color: colors.inkMuted },
  legendSwatch: { width: 12, height: 5, borderRadius: 2.5 },
});
