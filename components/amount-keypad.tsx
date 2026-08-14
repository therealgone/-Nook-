import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BackspaceIcon } from 'phosphor-react-native';
import { colors, fonts, radius, spacing } from '../constants/theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];
const QUICK_AMOUNTS = [5, 10, 20, 50];

export function AmountDisplay({ value, symbol = '$' }: { value: string; symbol?: string }) {
  return (
    <View style={styles.amountRow}>
      <Text style={styles.symbol}>{symbol}</Text>
      <Text style={[styles.amount, { color: value ? colors.inkStrong : colors.inkFaint }]}>{value || '0'}</Text>
      <View style={styles.caret} />
    </View>
  );
}

export function QuickAmountRow({ onAdd }: { onAdd: (n: number) => void }) {
  return (
    <View style={styles.quickRow}>
      {QUICK_AMOUNTS.map((n) => (
        <Pressable key={n} onPress={() => onAdd(n)} style={styles.quickChip}>
          <Text style={styles.quickChipText}>+{n}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Keypad({ value, onChange, keyHeight = 46 }: { value: string; onChange: (next: string) => void; keyHeight?: number }) {
  function press(key: string) {
    if (key === '⌫') {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === '.' && value.includes('.')) return;
    if (value.includes('.') && value.split('.')[1]?.length >= 2) return;
    if (value.replace('.', '').length >= 7) return;
    onChange(value + key);
  }

  return (
    <View style={styles.keypad}>
      {KEYS.map((key) => (
        <Pressable key={key} onPress={() => press(key)} style={[styles.key, { height: keyHeight }]}>
          {key === '⌫' ? (
            <BackspaceIcon size={19} color={colors.ink} />
          ) : (
            <Text style={styles.keyText}>{key}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

export function addQuickAmount(current: string, n: number): string {
  const parsed = Number(current) || 0;
  return String(parsed + n);
}

const styles = StyleSheet.create({
  amountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', paddingVertical: 6, gap: 2 },
  symbol: { fontFamily: fonts.regular, fontSize: 24, color: colors.inkMuted },
  amount: { fontFamily: fonts.medium, fontSize: 52, fontVariant: ['tabular-nums'] },
  caret: { width: 2, height: 40, backgroundColor: colors.accent, marginLeft: 4, borderRadius: 1 },
  quickRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  quickChip: {
    paddingVertical: 6,
    paddingHorizontal: 13,
    borderRadius: radius.pill,
    backgroundColor: '#252838',
    borderWidth: 1,
    borderColor: '#33364a',
  },
  quickChipText: { fontFamily: fonts.medium, fontSize: 12, color: '#cfd3e5' },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  key: {
    width: '31%',
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: '#2e3143',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontFamily: fonts.regular, fontSize: 19, color: colors.ink },
});
