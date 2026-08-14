// Nocturne — dark neobank theme (design handoff: design_handoff_money_ui_refresh)
export const colors = {
  screenBg: '#161826',
  surface: '#1e2030',
  surfaceRaised: '#232532',
  surfaceSunken: '#171927',
  ink: '#e9e9ed',
  inkStrong: '#f3f5fe',
  inkMuted: '#75798c',
  inkFaint: '#5d6172',
  hairline: '#2b2e3d',
  hairlineStrong: '#2f3243',
  accent: '#9184d9',
  accent300: '#d2cefd',
  accent400: '#b5abfc',
  accent700: '#5d5294',
  accent900: '#2b2741',
  positive: '#5FC49E',
  danger: '#d9848a',
} as const;

// Budget "heat" scale — spend intensity against a target.
export type HeatLevel = 'calm' | 'building' | 'hot' | 'over';

export function heatLevelForPercent(percentUsed: number): HeatLevel {
  if (percentUsed > 100) return 'over';
  if (percentUsed >= 90) return 'hot';
  if (percentUsed >= 50) return 'building';
  return 'calm';
}

export function heatColorForPercent(percentUsed: number): string {
  return heatColors[heatLevelForPercent(percentUsed)];
}

export const heatColors: Record<HeatLevel, string> = {
  calm: '#5d5294',
  building: '#9184d9',
  hot: '#d6b26a',
  over: '#d9848a',
};

export const radius = {
  sm: 10,
  md: 12,
  lg: 14,
  xl: 16,
  card: 16,
  sheet: 26,
  navBar: 22,
  pill: 999,
} as const;

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 26,
  xxl: 40,
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

// Never bolder than 500 (fonts.medium) per the Nocturne system — hierarchy is
// size and space, not weight.
export const type = {
  balanceHero: { fontSize: 58, lineHeight: 58, letterSpacing: -2 },
  balanceDecimals: { fontSize: 24, lineHeight: 28, letterSpacing: 0 },
  screenTitle: { fontSize: 20, lineHeight: 25, letterSpacing: -0.4 },
  sheetTitle: { fontSize: 16, lineHeight: 20, letterSpacing: -0.16 },
  sectionHeader: { fontSize: 15, lineHeight: 19, letterSpacing: -0.15 },
  rowTitle: { fontSize: 13.5, lineHeight: 18, letterSpacing: 0 },
  body: { fontSize: 14, lineHeight: 19, letterSpacing: 0 },
  caption: { fontSize: 11.5, lineHeight: 15, letterSpacing: 0 },
  kicker: { fontSize: 10, lineHeight: 13, letterSpacing: 1.6 },
  tabLabel: { fontSize: 9.5, lineHeight: 12, letterSpacing: 0.28 },
} as const;

export const minTouchTarget = 44;

// Category colors, desaturated for the Nocturne dark ground. Avatars use the
// color at ~13% opacity as the fill (`color + '22'`) with the glyph in the
// full color — never a solid saturated circle.
export const categoryIconChoices: { icon: string; color: string }[] = [
  { icon: 'cart', color: '#5FC49E' }, // Groceries
  { icon: 'restaurant', color: '#E0A15C' }, // Dining
  { icon: 'car', color: '#8391F5' }, // Transport
  { icon: 'home', color: '#A78BFA' }, // Home
  { icon: 'flash', color: '#D6C070' }, // Utilities
  { icon: 'medkit', color: '#E0787C' }, // Health
  { icon: 'film', color: '#5FC2CE' }, // Fun
  { icon: 'gift', color: '#E07BB0' }, // Shopping
  { icon: 'fitness', color: '#5FC49E' },
  { icon: 'school', color: '#8391F5' },
  { icon: 'wifi', color: '#D6C070' },
  { icon: 'pricetag', color: '#75798c' },
];

export function tint(hex: string, alphaHex: string): string {
  return `${hex}${alphaHex}`;
}
