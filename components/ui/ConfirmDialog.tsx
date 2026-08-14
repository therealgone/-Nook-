import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../../constants/theme';
import { Button } from './Button';

export type DialogAction = {
  label: string;
  onPress: () => void;
  variant?: 'accent' | 'secondary' | 'danger';
};

export function ConfirmDialog({
  visible,
  title,
  message,
  actions,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  message?: string;
  actions: DialogAction[];
  onDismiss: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityElementsHidden>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()} accessibilityViewIsModal>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <View style={styles.actions}>
            {actions.map((action, i) => (
              <Button
                key={i}
                label={action.label}
                variant={action.variant ?? 'secondary'}
                onPress={() => {
                  onDismiss();
                  action.onPress();
                }}
              />
            ))}
            <Button label="Cancel" variant="secondary" onPress={onDismiss} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(9,10,17,0.62)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.hairline,
    padding: 18,
    gap: spacing.sm,
  },
  title: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  message: { fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, color: colors.inkMuted },
  actions: { gap: 8, marginTop: 4 },
});
