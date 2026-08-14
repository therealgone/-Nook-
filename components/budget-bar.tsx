import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { colors, fonts, heatColorForPercent } from '../constants/theme';
import { formatCurrency } from '../utils/format';

export function BudgetBar({ label, spent, target }: { label: string; spent: number; target: number }) {
  const percent = target === 0 ? 0 : (spent / target) * 100;
  const clamped = Math.min(100, Math.max(0, percent));
  const color = heatColorForPercent(percent);
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(clamped, { duration: 700, easing: Easing.bezier(0.2, 0.8, 0.25, 1) });
  }, [clamped, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value}%` }));

  return (
    <View style={styles.row} accessibilityLabel={`${label}, ${formatCurrency(spent)} of ${formatCurrency(target)}, ${Math.round(percent)} percent`}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.amountText}>
          <Text style={styles.spentText}>{formatCurrency(spent)}</Text>
          <Text style={styles.targetText}> / {formatCurrency(target)}</Text>
        </Text>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle, { backgroundColor: color, shadowColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontFamily: fonts.medium, fontSize: 12.5, color: '#cfd3e5' },
  amountText: { fontSize: 12, fontVariant: ['tabular-nums'] },
  spentText: { fontFamily: fonts.medium, color: colors.inkMuted },
  targetText: { fontFamily: fonts.regular, color: '#4d5162' },
  track: { height: 7, borderRadius: 999, backgroundColor: colors.surfaceSunken, overflow: 'hidden' },
  fill: {
    height: 7,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 4,
  },
});
