import type { Icon, IconWeight } from 'phosphor-react-native';
import {
  ArrowsClockwiseIcon,
  BankIcon,
  BarbellIcon,
  BellSimpleIcon,
  CalendarBlankIcon,
  CarProfileIcon,
  ChartDonutIcon,
  FilmSlateIcon,
  FirstAidKitIcon,
  ForkKnifeIcon,
  GearSixIcon,
  GiftIcon,
  GraduationCapIcon,
  HouseIcon,
  LightningIcon,
  PencilSimpleIcon,
  PiggyBankIcon,
  QuestionIcon,
  ShoppingCartIcon,
  SquaresFourIcon,
  TagIcon,
  TrashIcon,
  WifiHighIcon,
} from 'phosphor-react-native';

// String -> Phosphor icon component. Keys are stored in the database
// (categories.icon) or passed as plain strings through the UI primitives, so
// this registry is the single place old string names resolve to real icons.
export const ICONS: Record<string, Icon> = {
  cart: ShoppingCartIcon,
  restaurant: ForkKnifeIcon,
  car: CarProfileIcon,
  home: HouseIcon,
  flash: LightningIcon,
  medkit: FirstAidKitIcon,
  film: FilmSlateIcon,
  gift: GiftIcon,
  fitness: BarbellIcon,
  school: GraduationCapIcon,
  wifi: WifiHighIcon,
  pricetag: TagIcon,
  'stats-chart': ChartDonutIcon,
  calendar: CalendarBlankIcon,
  wallet: PiggyBankIcon,
  settings: GearSixIcon,
  'trash-outline': TrashIcon,
  repeat: ArrowsClockwiseIcon,
  'pencil-outline': PencilSimpleIcon,
  notifications: BellSimpleIcon,
  cash: BankIcon,
  'help-circle': QuestionIcon,
  squares: SquaresFourIcon,
};

export function resolveIcon(name: string): Icon {
  return ICONS[name] ?? TagIcon;
}

export function DynamicIcon({
  name,
  size = 16,
  color = '#FFFFFF',
  weight = 'fill',
}: {
  name: string;
  size?: number;
  color?: string;
  weight?: IconWeight;
}) {
  const Cmp = resolveIcon(name);
  return <Cmp size={size} color={color} weight={weight} />;
}
