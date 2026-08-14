import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DynamicIcon } from '../../constants/icons';
import { colors, fonts, minTouchTarget, radius } from '../../constants/theme';

export function Chip({
  label,
  selected,
  onPress,
  dashed,
  icon,
  swatchColor,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  dashed?: boolean;
  icon?: string;
  swatchColor?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      style={[
        styles.chip,
        icon ? styles.chipWithAvatar : null,
        selected ? styles.chipSelected : null,
        dashed ? styles.chipDashed : null,
      ]}
      hitSlop={4}
    >
      {icon && (
        <View style={[styles.avatar, { backgroundColor: `${swatchColor ?? colors.inkMuted}22` }]}>
          <DynamicIcon name={icon} size={13} color={swatchColor ?? colors.inkMuted} />
        </View>
      )}
      <Text style={[styles.label, { color: selected ? '#e7e5fe' : dashed ? colors.accent300 : '#9397ab' }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#232532',
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 13,
    minHeight: minTouchTarget - 8,
  },
  chipWithAvatar: { paddingLeft: 8 },
  chipSelected: {
    backgroundColor: colors.accent900,
    borderColor: colors.accent700,
  },
  chipDashed: {
    borderColor: colors.accent700,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 12.5,
  },
});
