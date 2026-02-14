import type { ThemeConfig } from '../types.js';
import { defaultTheme } from './default.js';
import { darkTheme } from './dark.js';

const themes: Record<string, ThemeConfig> = {
  default: defaultTheme,
  dark: darkTheme,
};

export function getTheme(nameOrConfig: string | ThemeConfig | undefined): ThemeConfig {
  if (!nameOrConfig) return defaultTheme;
  if (typeof nameOrConfig === 'object') return nameOrConfig;
  const theme = themes[nameOrConfig];
  if (!theme) throw new Error(`Unknown theme: "${nameOrConfig}". Available: ${Object.keys(themes).join(', ')}`);
  return theme;
}

export { defaultTheme, darkTheme };
