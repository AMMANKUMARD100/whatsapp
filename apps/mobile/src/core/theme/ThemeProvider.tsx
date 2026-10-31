import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import { darkColors, lightColors, radius, spacing, typography, type ColorTokens } from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeStore {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeStore>((set) => ({
  mode: 'system',
  setMode: (mode) => set({ mode }),
}));

interface ThemeContextValue {
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: lightColors,
  spacing,
  radius,
  typography,
  isDark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const { mode } = useThemeStore();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (mode === 'system') {
      setIsDark(systemScheme === 'dark');
    } else {
      setIsDark(mode === 'dark');
    }
  }, [mode, systemScheme]);

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors, spacing, radius, typography, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
