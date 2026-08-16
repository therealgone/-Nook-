import 'react-native-reanimated';
import { useCallback, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { DbProvider } from '../components/db-provider';
import { AddExpenseSheetProvider } from '../components/add-expense-sheet-context';
import { AddExpenseSheet } from '../components/add-expense-sheet';
import { ToastProvider } from '../components/toast-context';
import { PeriodAlertsProvider } from '../components/period-alerts-context';
import { PeriodAlertModal } from '../components/period-alert-modal';
import { colors } from '../constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.screenBg }}>
      <StatusBar style="light" />
      <DbProvider>
        <ToastProvider>
          <PeriodAlertsProvider>
            <AddExpenseSheetProvider>
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.screenBg } }}>
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="settings" />
              </Stack>
              <AddExpenseSheet />
              <PeriodAlertModal />
            </AddExpenseSheetProvider>
          </PeriodAlertsProvider>
        </ToastProvider>
      </DbProvider>
    </View>
  );
}
