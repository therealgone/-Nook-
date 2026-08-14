import { View, StyleSheet, type ViewProps } from 'react-native';
import { colors, radius, spacing } from '../../constants/theme';

// Dark-ground elevation is an edge, not a shadow.
export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: spacing.md,
  },
});
