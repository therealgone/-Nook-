import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircleIcon } from 'phosphor-react-native';
import { colors, fonts, radius, spacing } from '../constants/theme';

const ToastContext = createContext<((message: string) => void) | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(msg);
    timer.current = setTimeout(() => setMessage(null), 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {message && (
        <View style={styles.toast} pointerEvents="none">
          <CheckCircleIcon size={16} color={colors.accent400} weight="fill" />
          <Text style={styles.text}>{message}</Text>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): (message: string) => void {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent900,
    borderWidth: 1,
    borderColor: '#4a4370',
    borderRadius: radius.lg,
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
  },
  text: {
    fontFamily: fonts.medium,
    color: '#e7e5fe',
    fontSize: 12.5,
    flexShrink: 1,
  },
});
