import { Pressable, StyleSheet, Text, type PressableProps, type ViewStyle } from 'react-native';
import { colors, fonts, minTouchTarget, radius, spacing } from '../../constants/theme';

type Variant = 'accent' | 'secondary' | 'outline' | 'dashed' | 'danger';

type Props = PressableProps & {
  label: string;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
};

export function Button({ label, variant = 'accent', disabled = false, style, ...props }: Props) {
  const visual = disabled ? DISABLED : VARIANTS[variant];
  return (
    <Pressable
      {...props}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      style={[
        styles.base,
        {
          backgroundColor: visual.bg,
          borderColor: visual.border,
          borderStyle: variant === 'dashed' && !disabled ? 'dashed' : 'solid',
        },
        style,
      ]}
    >
      <Text style={{ fontFamily: fonts.medium, color: visual.text, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );
}

const VARIANTS: Record<Variant, { bg: string; border: string; text: string }> = {
  accent: { bg: 'rgba(145,132,217,0.14)', border: '#6d61a8', text: colors.accent300 },
  outline: { bg: 'rgba(145,132,217,0.10)', border: colors.accent700, text: colors.accent300 },
  dashed: { bg: 'transparent', border: '#4a4d63', text: colors.accent300 },
  secondary: { bg: colors.surfaceRaised, border: colors.hairlineStrong, text: colors.ink },
  danger: { bg: 'rgba(217,132,138,0.14)', border: '#8d6b76', text: colors.danger },
};

const DISABLED = { bg: '#212433', border: '#2e3143', text: colors.inkFaint };

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
