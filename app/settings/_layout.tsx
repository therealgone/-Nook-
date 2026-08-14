import { Stack } from 'expo-router';
import { colors } from '../../constants/theme';

export default function SettingsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.screenBg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[section]" />
      <Stack.Screen name="dev" />
    </Stack>
  );
}
