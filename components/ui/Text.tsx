import { Text as RNText, type TextProps } from 'react-native';
import { colors, fonts, type } from '../../constants/theme';

// Screen title, e.g. "Insights", "Settings" — 20/500
export function Heading({ style, ...props }: TextProps) {
  return <RNText {...props} style={[{ fontFamily: fonts.medium, color: colors.ink }, type.screenTitle, style]} />;
}

// Sheet title — 16/500
export function SheetTitle({ style, ...props }: TextProps) {
  return <RNText {...props} style={[{ fontFamily: fonts.medium, color: colors.ink }, type.sheetTitle, style]} />;
}

// Section header — 15/500
export function SectionHeader({ style, ...props }: TextProps) {
  return <RNText {...props} style={[{ fontFamily: fonts.medium, color: colors.ink }, type.sectionHeader, style]} />;
}

// Row title — 13.5/500
export function Label({ style, ...props }: TextProps) {
  return <RNText {...props} style={[{ fontFamily: fonts.medium, color: colors.ink }, type.rowTitle, style]} />;
}

// Body / amount text — 14/500 by default, regular for longer prose via `muted`
export function Body({ style, muted, ...props }: TextProps & { muted?: boolean }) {
  return (
    <RNText
      {...props}
      style={[{ fontFamily: fonts.medium, color: muted ? colors.inkMuted : colors.ink }, type.body, style]}
    />
  );
}

// Money and dates — tabular numerals so amounts align in columns.
export function Mono({ style, muted, ...props }: TextProps & { muted?: boolean }) {
  return (
    <RNText
      {...props}
      style={[
        { fontFamily: fonts.medium, color: muted ? colors.inkMuted : colors.ink, fontVariant: ['tabular-nums'] },
        type.body,
        style,
      ]}
    />
  );
}

// Caption — 11.5/400
export function Caption({ style, tone = 'muted', ...props }: TextProps & { tone?: 'muted' | 'accent' | 'danger' | 'faint' }) {
  const color = tone === 'accent' ? colors.accent300 : tone === 'danger' ? colors.danger : tone === 'faint' ? colors.inkFaint : colors.inkMuted;
  return <RNText {...props} style={[{ fontFamily: fonts.regular, color }, type.caption, style]} />;
}

// Kicker — small uppercase eyebrow label, 10/500, wide tracking
export function Kicker({ style, tone = 'accent', ...props }: TextProps & { tone?: 'accent' | 'muted' }) {
  const color = tone === 'accent' ? colors.accent : colors.inkMuted;
  return (
    <RNText {...props} style={[{ fontFamily: fonts.medium, color, textTransform: 'uppercase' }, type.kicker, style]} />
  );
}
