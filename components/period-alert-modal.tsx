import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useDb } from './db-provider';
import { useToast } from './toast-context';
import { usePeriodAlerts } from './period-alerts-context';
import { BottomSheet } from './ui/BottomSheet';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { ConfirmDialog, type DialogAction } from './ui/ConfirmDialog';
import { TextField } from './ui/TextField';
import { Body, SheetTitle } from './ui/Text';
import { listPiggyBanks } from '../src/repositories/piggyBanks';
import { getSavedAmount } from '../src/repositories/piggyBankTransactions';
import {
  allocateSurplus,
  autoWithdrawDeficitFromPiggyBank,
  borrowDeficitFromGoal,
  acknowledgeUncoveredDeficit,
} from '../src/domain/periodResolution';
import type { PiggyBank } from '../src/db/schema';
import { colors, fonts } from '../constants/theme';
import { formatCurrency } from '../utils/format';

type GoalOption = { bank: PiggyBank; saved: number; remaining: number };

function formatPeriodRange(start: string, end: string): string {
  return `${start} – ${end}`;
}

export function PeriodAlertModal() {
  const db = useDb();
  const showToast = useToast();
  const { current, refresh, dismiss } = usePeriodAlerts();

  const [goals, setGoals] = useState<GoalOption[]>([]);
  const [selectedGoalId, setSelectedGoalId] = useState<number | null>(null);
  const [goalAmountText, setGoalAmountText] = useState('');
  const [deficitDialog, setDeficitDialog] = useState<{ remaining: number; actions: DialogAction[] } | null>(null);
  // Set synchronously by any deficit-dialog action (borrow / mark over-budget) before its own
  // await, so the deferred check in onDismiss below can tell "an action resolved this" apart
  // from a plain Cancel/backdrop dismissal. ConfirmDialog calls onDismiss() for every action
  // press too (see components/ui/ConfirmDialog.tsx), so onDismiss can't assume it means Cancel.
  const deficitResolvedRef = useRef(false);

  const isSurplus = !!current && current.delta > 0;
  const isDeficit = !!current && current.delta < 0;

  useEffect(() => {
    if (!isSurplus) return;
    setSelectedGoalId(null);
    setGoalAmountText('');
    listPiggyBanks(db, 'active').then(async (banks) => {
      const withRemaining = await Promise.all(
        banks.map(async (bank) => {
          const saved = await getSavedAmount(db, bank.id);
          return { bank, saved, remaining: Math.max(0, bank.targetPrice - saved) };
        }),
      );
      setGoals(withRemaining.filter((g) => g.remaining > 0));
    });
  }, [db, isSurplus, current?.periodId]);

  useEffect(() => {
    if (!isDeficit || !current) return;
    let cancelled = false;
    const periodId = current.periodId;
    const amount = -current.delta;

    (async () => {
      const { remaining } = await autoWithdrawDeficitFromPiggyBank(db, periodId, amount);
      if (cancelled) return;

      if (remaining <= 0.01) {
        showToast('Overspend covered from your Piggy Bank');
        await refresh();
        return;
      }

      const banks = await listPiggyBanks(db, 'active');
      if (cancelled) return;
      const borrowActions: DialogAction[] = banks.map((bank) => ({
        label: `Borrow ${formatCurrency(remaining)} from ${bank.productName}`,
        variant: 'accent',
        onPress: async () => {
          deficitResolvedRef.current = true;
          await borrowDeficitFromGoal(db, periodId, bank.id, remaining);
          await refresh();
        },
      }));

      deficitResolvedRef.current = false;
      setDeficitDialog({
        remaining,
        actions: [
          ...borrowActions,
          {
            label: 'Mark this period over-budget',
            variant: 'danger',
            onPress: async () => {
              deficitResolvedRef.current = true;
              await acknowledgeUncoveredDeficit(db, periodId, remaining);
              await refresh();
            },
          },
        ],
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [db, isDeficit, current?.periodId]);

  if (!current) return null;

  const selectedGoal = goals.find((g) => g.bank.id === selectedGoalId);
  const goalAmount = selectedGoal ? Math.max(0, Math.min(Number(goalAmountText) || 0, current.delta, selectedGoal.remaining)) : 0;
  const piggyBankAmount = isSurplus ? current.delta - goalAmount : 0;

  async function confirmSurplus() {
    if (!current) return;
    await allocateSurplus(
      db,
      current.periodId,
      current.delta,
      selectedGoal ? { piggyBankId: selectedGoal.bank.id, amount: goalAmount } : undefined,
    );
    showToast(`${formatCurrency(current.delta)} allocated`);
    await refresh();
  }

  function notNowSurplus() {
    if (current) dismiss(current);
  }

  return (
    <>
      <BottomSheet visible={isSurplus} onClose={notNowSurplus}>
        <SheetTitle>{`🎉 You saved ${formatCurrency(current.delta)}`}</SheetTitle>
        <Body muted>{`Between ${formatPeriodRange(current.start, current.end)} you spent less than you earned.`}</Body>

        {goals.length > 0 && (
          <View style={styles.chipRow}>
            <Chip
              label="Just Piggy Bank"
              selected={selectedGoalId === null}
              onPress={() => {
                setSelectedGoalId(null);
                setGoalAmountText('');
              }}
            />
            {goals.map((g) => (
              <Chip
                key={g.bank.id}
                label={g.bank.productName}
                selected={selectedGoalId === g.bank.id}
                onPress={() => {
                  setSelectedGoalId(g.bank.id);
                  setGoalAmountText('');
                }}
              />
            ))}
          </View>
        )}

        {selectedGoal && (
          <>
            <TextField
              placeholder={`Amount for ${selectedGoal.bank.productName}`}
              keyboardType="decimal-pad"
              value={goalAmountText}
              onChangeText={setGoalAmountText}
            />
            <Pressable
              onPress={() => setGoalAmountText(String(Math.min(current.delta, selectedGoal.remaining)))}
              accessibilityRole="button"
              accessibilityLabel={`Fill ${selectedGoal.bank.productName}`}
            >
              <Text style={styles.fillLink}>
                {`Fill goal (${formatCurrency(Math.min(current.delta, selectedGoal.remaining))})`}
              </Text>
            </Pressable>
          </>
        )}

        <Body muted>{`→ ${formatCurrency(piggyBankAmount)} to Piggy Bank`}</Body>

        <View style={styles.actions}>
          <Button label="Not now" variant="secondary" onPress={notNowSurplus} />
          <Button label="Confirm" onPress={confirmSurplus} />
        </View>
      </BottomSheet>

      <ConfirmDialog
        visible={!!deficitDialog}
        title="You went over budget"
        message={
          deficitDialog
            ? `You spent ${formatCurrency(-current.delta)} more than you earned between ${formatPeriodRange(current.start, current.end)}. ${formatCurrency(deficitDialog.remaining)} is left to cover.`
            : undefined
        }
        actions={deficitDialog?.actions ?? []}
        onDismiss={() => {
          if (current) dismiss(current);
          const periodId = current?.periodId;
          const remaining = deficitDialog?.remaining;
          setDeficitDialog(null);
          // ConfirmDialog invokes onDismiss for action presses too (see ConfirmDialog.tsx),
          // ahead of the action's own onPress. Defer to a macrotask so any action's
          // synchronous deficitResolvedRef.current = true (set before its own await) has
          // already landed by the time we decide whether this was a genuine dismissal.
          setTimeout(() => {
            if (deficitResolvedRef.current || periodId == null || remaining == null) return;
            acknowledgeUncoveredDeficit(db, periodId, remaining).then(() => refresh());
          }, 0);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fillLink: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.accent400 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
});
