export const palette = {
  teal600: '#0E8A7D',
  teal500: '#14A394',
  teal100: '#D6F3EE',
  ink900: '#0B141A',
  ink800: '#111B21',
  ink700: '#202C33',
  ink500: '#667781',
  ink200: '#D1D7DB',
  ink100: '#F0F2F5',
  white: '#FFFFFF',
  red500: '#E5484D',
  blue500: '#34B7F1',
} as const;

export interface ColorTokens {
  background: string;
  surface: string;
  surfaceAlt: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
  onPrimary: string;
  border: string;
  bubbleOut: string;
  bubbleIn: string;
  tickRead: string;
  danger: string;
}

export const lightColors: ColorTokens = {
  background: palette.white,
  surface: palette.white,
  surfaceAlt: palette.ink100,
  textPrimary: palette.ink900,
  textSecondary: palette.ink500,
  primary: palette.teal600,
  onPrimary: palette.white,
  border: palette.ink200,
  bubbleOut: palette.teal100,
  bubbleIn: palette.white,
  tickRead: palette.blue500,
  danger: palette.red500,
};

export const darkColors: ColorTokens = {
  background: palette.ink900,
  surface: palette.ink800,
  surfaceAlt: palette.ink700,
  textPrimary: '#E9EDEF',
  textSecondary: '#8696A0',
  primary: palette.teal500,
  onPrimary: palette.ink900,
  border: palette.ink700,
  bubbleOut: '#005C4B',
  bubbleIn: palette.ink700,
  tickRead: palette.blue500,
  danger: palette.red500,
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 12, lg: 18, pill: 999 } as const;

export const typography = {
  title: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30 },
  heading: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 20 },
  bodyBold: { fontSize: 15, fontWeight: '600' as const, lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
} as const;
