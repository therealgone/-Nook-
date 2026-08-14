import { Pressable, StyleSheet, View } from 'react-native';
import { DynamicIcon } from '../../constants/icons';
import { categoryIconChoices, minTouchTarget } from '../../constants/theme';

export function IconSwatchPicker({
  value,
  onChange,
}: {
  value: { icon: string; color: string };
  onChange: (choice: { icon: string; color: string }) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {categoryIconChoices.map((choice) => {
        const selected = choice.icon === value.icon;
        return (
          <Pressable
            key={choice.icon}
            onPress={() => onChange(choice)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${choice.icon} icon`}
            style={[styles.swatch, { backgroundColor: `${choice.color}22` }, selected && { borderColor: choice.color }]}
          >
            <DynamicIcon name={choice.icon} size={18} color={choice.color} />
          </Pressable>
        );
      })}
    </View>
  );
}

const SWATCH_SIZE = minTouchTarget;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: SWATCH_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
});
