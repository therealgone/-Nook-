import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { DynamicIcon } from '../../constants/icons';
import { colors, minTouchTarget, spacing } from '../../constants/theme';
import { Caption, Label } from './Text';

export function ListRow({
  icon,
  swatchColor,
  title,
  subtitle,
  trailing,
  onPress,
  accessibilityLabel,
  style,
  avatarSize = 38,
  radius = 12,
}: {
  icon?: string;
  swatchColor?: string;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: ViewStyle;
  avatarSize?: number;
  radius?: number;
}) {
  const avatarRadius = avatarSize <= 32 ? 11 : avatarSize <= 36 ? 12 : 13;
  const content = (pressed: boolean) => (
    <View style={[styles.row, { borderRadius: radius }, pressed && styles.rowPressed, style]}>
      {icon && (
        <View
          style={[
            styles.iconCircle,
            { width: avatarSize, height: avatarSize, borderRadius: avatarRadius, backgroundColor: `${swatchColor ?? colors.inkMuted}22` },
          ]}
        >
          <DynamicIcon name={icon} size={avatarSize * 0.42} color={swatchColor ?? colors.inkMuted} />
        </View>
      )}
      <View style={styles.textBlock}>
        <Label numberOfLines={1}>{title}</Label>
        {subtitle ? (
          <Caption style={{ marginTop: 2 }} numberOfLines={1}>
            {subtitle}
          </Caption>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );

  if (!onPress) return content(false);

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title}>
      {({ pressed }) => content(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: minTouchTarget + 8,
    paddingVertical: 11,
    paddingHorizontal: 10,
  },
  rowPressed: { backgroundColor: 'rgba(145,132,217,0.10)' },
  iconCircle: { alignItems: 'center', justifyContent: 'center' },
  textBlock: { flex: 1, gap: 2 },
  trailing: { alignItems: 'flex-end', gap: 2 },
});
