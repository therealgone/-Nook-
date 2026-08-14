import { Pressable, StyleSheet } from 'react-native';
import { DynamicIcon } from '../../constants/icons';
import { colors } from '../../constants/theme';

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = 'default',
}: {
  icon: string;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: 'default' | 'accent' | 'danger';
}) {
  const color = tone === 'accent' ? colors.accent400 : tone === 'danger' ? '#8d6b76' : colors.inkMuted;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={styles.button} hitSlop={6}>
      <DynamicIcon name={icon} size={14} color={color} weight="regular" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: '#242636',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
