import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CaretRightIcon, PiggyBankIcon, PlusIcon } from 'phosphor-react-native';
import { useDb } from '../../components/db-provider';
import { useToast } from '../../components/toast-context';
import { ProgressRing } from '../../components/progress-ring';
import { AmountDisplay, Keypad, QuickAmountRow, addQuickAmount } from '../../components/amount-keypad';
import { BottomSheet } from '../../components/ui/BottomSheet';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog, type DialogAction } from '../../components/ui/ConfirmDialog';
import { TextField } from '../../components/ui/TextField';
import { Body, SheetTitle } from '../../components/ui/Text';
import { createPiggyBank, listPiggyBanks } from '../../src/repositories/piggyBanks';
import { getGeneralSavingsBalance } from '../../src/repositories/generalSavings';
import { cancelPiggyBank, fundGoal, getProgress, markAsPurchased } from '../../src/domain/piggyBankLifecycle';
import type { PiggyBank } from '../../src/db/schema';
import { colors, fonts, radius, spacing } from '../../constants/theme';
import { formatCurrency, todayIso } from '../../utils/format';

type Progress = Awaited<ReturnType<typeof getProgress>>;

export default function PiggyBankScreen() {
  const db = useDb();
  const insets = useSafeAreaInsets();
  const showToast = useToast();
  const [banks, setBanks] = useState<PiggyBank[]>([]);
  const [progress, setProgress] = useState<Record<number, Progress>>({});
  const [generalBalance, setGeneralBalance] = useState(0);
  const [createVisible, setCreateVisible] = useState(false);
  const [productName, setProductName] = useState('');
  const [targetPrice, setTargetPrice] = useState('');
  const [fundNowAmount, setFundNowAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fundingBank, setFundingBank] = useState<PiggyBank | null>(null);
  const [fundAmount, setFundAmount] = useState('');
  const [actionSheet, setActionSheet] = useState<{ bank: PiggyBank; actions: DialogAction[] } | null>(null);
  const [fundConfirm, setFundConfirm] = useState<{ message: string; actions: DialogAction[] } | null>(null);

  const load = useCallback(async () => {
    const active = await listPiggyBanks(db, 'active');
    setBanks(active);
    const entries = await Promise.all(active.map(async (b) => [b.id, await getProgress(db, b.id)] as const));
    setProgress(Object.fromEntries(entries));
    setGeneralBalance(await getGeneralSavingsBalance(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const totalSaved = banks.reduce((sum, b) => sum + (progress[b.id]?.savedAmount ?? 0), 0);

  function openCreate() {
    setProductName('');
    setTargetPrice('');
    setFundNowAmount('');
    setError(null);
    setCreateVisible(true);
  }

  async function saveCreate() {
    const price = Number(targetPrice);
    if (!productName.trim()) {
      setError('Enter a product name');
      return;
    }
    if (!targetPrice || Number.isNaN(price) || price <= 0) {
      setError('Enter a valid target price');
      return;
    }
    const bank = await createPiggyBank(db, { productName: productName.trim(), targetPrice: price });
    setCreateVisible(false);
    await load();
    const fundNow = Number(fundNowAmount);
    if (fundNowAmount && !Number.isNaN(fundNow) && fundNow > 0) {
      await requestFunding(bank, fundNow);
    }
  }

  function openFunding(bank: PiggyBank) {
    setFundAmount('');
    setFundingBank(bank);
  }

  async function commitFunding(bank: PiggyBank, amount: number) {
    const { fromPiggyBank, fromMainBalance } = await fundGoal(db, bank.id, amount);
    await load();
    if (fromPiggyBank > 0 && fromMainBalance > 0) {
      showToast(`${formatCurrency(fromPiggyBank)} from Piggy Bank, ${formatCurrency(fromMainBalance)} from main balance`);
    } else if (fromPiggyBank > 0) {
      showToast(`${formatCurrency(fromPiggyBank)} moved from Piggy Bank to ${bank.productName}`);
    } else {
      showToast(`${formatCurrency(fromMainBalance)} added to ${bank.productName}`);
    }
  }

  async function requestFunding(bank: PiggyBank, amount: number) {
    const piggyBankBalance = await getGeneralSavingsBalance(db);
    if (amount > piggyBankBalance) {
      const shortfall = amount - piggyBankBalance;
      const message =
        piggyBankBalance > 0
          ? `Your Piggy Bank has ${formatCurrency(piggyBankBalance)} saved. ${formatCurrency(shortfall)} will come from your main balance instead. Continue?`
          : `Your Piggy Bank is empty. ${formatCurrency(shortfall)} will come from your main balance instead. Continue?`;
      setFundConfirm({
        message,
        actions: [
          {
            label: 'Continue',
            variant: 'accent',
            onPress: () => commitFunding(bank, amount),
          },
        ],
      });
      return;
    }
    await commitFunding(bank, amount);
  }

  async function saveFunds() {
    if (!fundingBank) return;
    const amount = Number(fundAmount);
    if (!amount || Number.isNaN(amount) || amount <= 0) return;
    const bank = fundingBank;
    setFundingBank(null);
    await requestFunding(bank, amount);
  }

  function onLongPressBank(bank: PiggyBank) {
    const p = progress[bank.id];
    const actions: DialogAction[] = [];
    if (p?.readyToBuy) {
      actions.push({
        label: 'Mark as purchased',
        variant: 'accent',
        onPress: async () => {
          await markAsPurchased(db, bank.id, todayIso());
          await load();
          showToast(`${bank.productName} marked as purchased`);
        },
      });
    }
    actions.push({
      label: 'Cancel goal',
      variant: 'danger',
      onPress: async () => {
        await cancelPiggyBank(db, bank.id);
        await load();
      },
    });
    setActionSheet({ bank, actions });
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={styles.title}>Piggy banks</Text>
          <Text style={styles.subtitle}>
            {formatCurrency(totalSaved)} saved across {banks.length} goal{banks.length === 1 ? '' : 's'}
          </Text>
        </View>
        <Button label="New" variant="outline" onPress={openCreate} />
      </View>

      <FlatList
        data={banks}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ gap: spacing.md, padding: spacing.lg, paddingBottom: 120 }}
        ListHeaderComponent={
          <Card style={styles.generalCard}>
            <Text style={styles.generalLabel}>Piggy Bank</Text>
            <Text style={styles.generalAmount}>{formatCurrency(generalBalance)}</Text>
          </Card>
        }
        ListEmptyComponent={<Body muted>No savings goals yet.</Body>}
        renderItem={({ item }) => {
          const p = progress[item.id];
          const percent = p ? Math.min(100, p.percent) : 0;
          const complete = !!p?.readyToBuy;
          const remaining = Math.max(0, item.targetPrice - (p?.savedAmount ?? 0));
          const a11yLabel = `${item.productName}, ${formatCurrency(p?.savedAmount ?? 0)} of ${formatCurrency(item.targetPrice)}, ${Math.round(percent)} percent saved${complete ? ', ready to buy' : ''}`;
          const cardContent = (
            <>
              <ProgressRing percent={percent} color={complete ? colors.positive : colors.accent} />
              <View style={styles.cardBody}>
                <Text style={styles.goalName} numberOfLines={1}>{item.productName}</Text>
                <Text style={styles.goalAmount}>
                  {formatCurrency(p?.savedAmount ?? 0)} <Text style={styles.goalAmountMuted}>of {formatCurrency(item.targetPrice)}</Text>
                </Text>
                <Text style={[styles.goalStatus, complete && { color: colors.positive }]}>
                  {complete ? 'Ready to buy' : `${formatCurrency(remaining)} to go`}
                </Text>
              </View>
              <CaretRightIcon size={15} color="#4d5162" />
            </>
          );
          return (
            <Pressable
              onPress={() => openFunding(item)}
              onLongPress={() => onLongPressBank(item)}
              accessibilityRole="button"
              accessibilityLabel={a11yLabel}
            >
              {complete ? (
                <LinearGradient colors={['#1f2a2b', '#1b1d2b']} style={[styles.card, styles.cardComplete]}>
                  {cardContent}
                </LinearGradient>
              ) : (
                <View style={styles.card}>{cardContent}</View>
              )}
            </Pressable>
          );
        }}
      />

      <BottomSheet visible={createVisible} onClose={() => setCreateVisible(false)}>
        <SheetTitle>New goal</SheetTitle>
        <TextField placeholder="Product name" value={productName} onChangeText={setProductName} />
        <TextField placeholder="Target price" keyboardType="decimal-pad" value={targetPrice} onChangeText={setTargetPrice} />
        <TextField placeholder="Fund now (optional)" keyboardType="decimal-pad" value={fundNowAmount} onChangeText={setFundNowAmount} />
        {error && <Body style={{ color: colors.danger }}>{error}</Body>}
        <View style={styles.sheetActions}>
          <Button label="Cancel" variant="secondary" onPress={() => setCreateVisible(false)} />
          <Button label="Save" onPress={saveCreate} />
        </View>
      </BottomSheet>

      <BottomSheet visible={!!fundingBank} onClose={() => setFundingBank(null)}>
        <SheetTitle>Add funds — {fundingBank?.productName}</SheetTitle>
        <AmountDisplay value={fundAmount} />
        <QuickAmountRow onAdd={(n) => setFundAmount((a) => addQuickAmount(a, n))} />
        <Keypad value={fundAmount} onChange={setFundAmount} keyHeight={44} />
        <Pressable
          onPress={saveFunds}
          disabled={!fundAmount || Number(fundAmount) <= 0}
          style={[styles.confirmButton, !fundAmount || Number(fundAmount) <= 0 ? styles.confirmDisabled : styles.confirmEnabled]}
        >
          <PiggyBankIcon size={18} color={!fundAmount || Number(fundAmount) <= 0 ? colors.inkFaint : colors.accent300} weight="fill" />
          <Text style={[styles.confirmText, { color: !fundAmount || Number(fundAmount) <= 0 ? colors.inkFaint : colors.accent300 }]}>
            Move to goal
          </Text>
        </Pressable>
      </BottomSheet>

      <ConfirmDialog
        visible={!!actionSheet}
        title={actionSheet?.bank.productName ?? ''}
        actions={actionSheet?.actions ?? []}
        onDismiss={() => setActionSheet(null)}
      />

      <ConfirmDialog
        visible={!!fundConfirm}
        title="Going over your Piggy Bank"
        message={fundConfirm?.message}
        actions={fundConfirm?.actions ?? []}
        onDismiss={() => setFundConfirm(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.screenBg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: { fontFamily: fonts.medium, fontSize: 20, letterSpacing: -0.4, color: colors.ink },
  subtitle: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.inkMuted, marginTop: 2 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  cardComplete: { borderColor: '#33564d' },
  generalCard: { marginBottom: spacing.md },
  generalLabel: { fontFamily: fonts.regular, fontSize: 11.5, color: colors.inkMuted },
  generalAmount: { fontFamily: fonts.medium, fontSize: 20, letterSpacing: -0.4, color: colors.ink, fontVariant: ['tabular-nums'], marginTop: 2 },
  cardBody: { flex: 1, gap: 2 },
  goalName: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.ink },
  goalAmount: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink, fontVariant: ['tabular-nums'] },
  goalAmountMuted: { fontFamily: fonts.regular, color: '#5d6172' },
  goalStatus: { fontFamily: fonts.regular, fontSize: 11, color: '#5d6172' },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  confirmButton: {
    height: 52,
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmEnabled: { backgroundColor: 'rgba(145,132,217,0.14)', borderColor: '#6d61a8' },
  confirmDisabled: { backgroundColor: '#212433', borderColor: '#2e3143' },
  confirmText: { fontFamily: fonts.medium, fontSize: 14 },
});
