import type { ComponentProps } from 'react';
import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarBlankIcon, ChartDonutIcon, HouseIcon, PiggyBankIcon, PlusIcon } from 'phosphor-react-native';
import { useAddExpenseSheet } from '../../components/add-expense-sheet-context';
import { colors, fonts } from '../../constants/theme';

type TabBarProps = ComponentProps<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>;

const TAB_ICONS = {
  index: HouseIcon,
  history: CalendarBlankIcon,
  insights: ChartDonutIcon,
  'piggy-bank': PiggyBankIcon,
} as const;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="piggy-bank" options={{ title: 'Goals' }} />
    </Tabs>
  );
}

function CustomTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const { open } = useAddExpenseSheet();
  const leftRoutes = state.routes.slice(0, 2);
  const rightRoutes = state.routes.slice(2);

  function renderTab(route: (typeof state.routes)[number]) {
    const index = state.routes.indexOf(route);
    const isFocused = state.index === index;
    const options = descriptors[route.key].options;
    const label = options.title ?? route.name;
    const Icon = TAB_ICONS[route.name as keyof typeof TAB_ICONS];

    function onPress() {
      Haptics.selectionAsync();
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
    }

    return (
      <Pressable key={route.key} onPress={onPress} style={styles.tabItem} accessibilityRole="button" accessibilityLabel={label}>
        {Icon && <Icon size={22} color={isFocused ? colors.accent300 : '#6b6f82'} weight={isFocused ? 'fill' : 'regular'} />}
        <Text style={[styles.tabLabel, { color: isFocused ? colors.accent300 : '#6b6f82' }]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.wrapper, { bottom: insets.bottom + 12 }]}>
      <BlurView intensity={18} tint="dark" style={styles.bar}>
        <View style={styles.barInner}>
          {leftRoutes.map(renderTab)}
          <View style={styles.spacer} />
          {rightRoutes.map(renderTab)}
        </View>
      </BlurView>

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          open();
        }}
        style={styles.fab}
        accessibilityRole="button"
        accessibilityLabel="Add expense"
      >
        <LinearGradient
          colors={['#a396ec', '#6f61b8']}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={styles.fabGradient}
        >
          <PlusIcon size={24} color="#171826" weight="bold" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', left: 14, right: 14 },
  bar: {
    height: 62,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(30,32,48,0.92)',
    borderWidth: 1,
    borderColor: '#2f3243',
  },
  barInner: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  spacer: { width: 74 },
  tabLabel: { fontFamily: fonts.regular, fontSize: 9.5, letterSpacing: 0.28 },
  fab: {
    position: 'absolute',
    left: '50%',
    top: -22,
    marginLeft: -30,
    width: 60,
    height: 60,
    borderRadius: 22,
    shadowColor: '#5d5294',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 26,
    elevation: 10,
  },
  fabGradient: {
    flex: 1,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
});
