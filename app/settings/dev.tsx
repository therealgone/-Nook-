import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDb } from '../../components/db-provider';
import { SettingsHeader } from '../../components/settings-header';
import { CalendarPicker } from '../../components/calendar-picker';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { materializeDuePayments } from '../../src/domain/recurringMaterialization';
import { materializeDueIncome } from '../../src/domain/recurringIncomeMaterialization';
import { colors, fonts, spacing } from '../../constants/theme';
import { todayIso } from '../../utils/format';
import { getDevDate, setDevDate } from '../../utils/devClock';

export default function DevToolsScreen() {
  const db = useDb();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [effectiveDate, setEffectiveDate] = useState(todayIso());
  const [message, setMessage] = useState<string | null>(null);

  function selectDate(iso: string) {
    setDevDate(iso);
    setEffectiveDate(todayIso());
    setMessage(`App clock set to ${todayIso()}`);
    setCalendarOpen(false);
  }

  function resetDate() {
    setDevDate(null);
    setEffectiveDate(todayIso());
    setMessage('App clock reset to the real date');
  }

  async function runRecurringCheck() {
    const createdExpenses = await materializeDuePayments(db, todayIso());
    const createdIncome = await materializeDueIncome(db, todayIso());
    setMessage(
      `Materialized ${createdExpenses.length} expense${createdExpenses.length === 1 ? '' : 's'} and ${createdIncome.length} income entr${createdIncome.length === 1 ? 'y' : 'ies'} as of ${todayIso()}`,
    );
  }

  return (
    <ScrollView style={styles.container}>
      <SettingsHeader title="Developer tools" />
      <Text style={styles.blurb}>Move the app's clock to test recurring payments and income, or trigger the recurring check manually.</Text>

      <View style={styles.body}>
        <Card style={styles.card}>
          <Text style={styles.clockLabel}>App clock: {effectiveDate}</Text>
          <View style={styles.row}>
            <Button label="Reset" variant="secondary" onPress={resetDate} />
            <Button label="Pick date" variant="secondary" onPress={() => setCalendarOpen(true)} />
          </View>
          <Button label="Run recurring check" onPress={runRecurringCheck} />
          {message && <Text style={styles.message}>{message}</Text>}
        </Card>
      </View>

      <CalendarPicker visible={calendarOpen} initialDate={getDevDate() ?? undefined} onSelect={selectDate} onClose={() => setCalendarOpen(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  blurb: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.inkMuted, maxWidth: 300, marginHorizontal: spacing.lg, marginBottom: spacing.md },
  body: { paddingHorizontal: spacing.lg, paddingBottom: 60 },
  card: { gap: spacing.sm },
  clockLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', gap: 12 },
  message: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.inkMuted },
});
