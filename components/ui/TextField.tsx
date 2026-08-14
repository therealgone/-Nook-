import { TextInput, StyleSheet, type TextInputProps } from 'react-native';
import { colors, fonts, radius, spacing, type } from '../../constants/theme';

export function TextField({ style, ...props }: TextInputProps) {
  return <TextInput {...props} placeholderTextColor={colors.inkFaint} style={[styles.input, style]} />;
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    color: colors.ink,
    fontFamily: fonts.regular,
    ...type.body,
  },
});
