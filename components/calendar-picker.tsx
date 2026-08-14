import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../constants/theme';
import { Caption, Label, SheetTitle } from './ui/Text';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toIso(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function CalendarPicker({
  visible,
  initialDate,
  onSelect,
  onClose,
}: {
  visible: boolean;
  initialDate?: string;
  onSelect: (dateIso: string) => void;
  onClose: () => void;
}) {
  const seed = initialDate ? new Date(`${initialDate}T00:00:00.000Z`) : new Date();
  const [viewYear, setViewYear] = useState(seed.getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(seed.getUTCMonth());

  const firstOfMonth = new Date(Date.UTC(viewYear, viewMonth, 1));
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
  const leadingBlanks = firstOfMonth.getUTCDay();
  const todayIso = new Date().toISOString().slice(0, 10);

  const cells: (number | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function changeMonth(delta: number) {
    let newMonth = viewMonth + delta;
    let newYear = viewYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setViewMonth(newMonth);
    setViewYear(newYear);
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Pressable onPress={() => changeMonth(-1)} style={styles.navButton}>
              <Label style={styles.navText}>‹</Label>
            </Pressable>
            <SheetTitle>
              {MONTH_LABELS[viewMonth]} {viewYear}
            </SheetTitle>
            <Pressable onPress={() => changeMonth(1)} style={styles.navButton}>
              <Label style={styles.navText}>›</Label>
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAY_LABELS.map((label, i) => (
              <Caption key={i} style={styles.weekLabel}>
                {label}
              </Caption>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((day, i) => {
              if (day === null) return <View key={i} style={styles.cell} />;
              const iso = toIso(viewYear, viewMonth, day);
              const isToday = iso === todayIso;
              const isSelected = iso === initialDate;
              return (
                <Pressable
                  key={i}
                  style={[styles.cell, styles.dayCell, isSelected && styles.dayCellSelected, isToday && !isSelected && styles.dayCellToday]}
                  onPress={() => onSelect(iso)}
                >
                  <Caption style={isSelected ? styles.dayTextSelected : styles.dayText}>{day}</Caption>
                </Pressable>
              );
            })}
          </View>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Label style={{ color: colors.inkMuted }}>Close</Label>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const CELL_SIZE = 40;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,17,21,0.4)', alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    padding: 16,
    width: 320,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.hairlineStrong,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navButton: { paddingHorizontal: 12, paddingVertical: 4 },
  navText: { fontSize: 22, lineHeight: 26, color: colors.accent },
  weekRow: { flexDirection: 'row' },
  weekLabel: { width: CELL_SIZE, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL_SIZE, height: CELL_SIZE, alignItems: 'center', justifyContent: 'center' },
  dayCell: { borderRadius: CELL_SIZE / 2 },
  dayCellSelected: { backgroundColor: colors.accent },
  dayCellToday: { borderWidth: 1, borderColor: colors.accent },
  dayText: { color: colors.inkMuted },
  dayTextSelected: { color: colors.inkStrong },
  closeButton: { alignItems: 'center', paddingVertical: 10, marginTop: 4 },
});
