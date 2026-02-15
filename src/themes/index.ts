import type { ThemeConfig } from '../types.js';
import { defaultTheme } from './default.js';
import { darkTheme } from './dark.js';
import {
  oceanTheme, sunsetTheme, forestTheme, lavenderTheme, roseTheme,
  corporateTheme, midnightTheme, nordTheme, solarizedLightTheme, solarizedDarkTheme,
  neonTheme, cyberpunkTheme, draculaTheme, monokaiTheme,
  monochromeTheme, blueprintTheme, inkTheme, pastelTheme,
  highContrastTheme, highContrastLightTheme,
} from './all.js';

export const themes: Record<string, ThemeConfig> = {
  // Built-in
  'default': defaultTheme,
  'dark': darkTheme,
  // Earthy / Warm
  'ocean': oceanTheme,
  'sunset': sunsetTheme,
  'forest': forestTheme,
  'lavender': lavenderTheme,
  'rose': roseTheme,
  // Professional / Corporate
  'corporate': corporateTheme,
  'midnight': midnightTheme,
  'nord': nordTheme,
  'solarized-light': solarizedLightTheme,
  'solarized-dark': solarizedDarkTheme,
  // Vibrant / Bold
  'neon': neonTheme,
  'cyberpunk': cyberpunkTheme,
  'dracula': draculaTheme,
  'monokai': monokaiTheme,
  // Minimal / Clean
  'monochrome': monochromeTheme,
  'blueprint': blueprintTheme,
  'ink': inkTheme,
  'pastel': pastelTheme,
  // High Contrast
  'high-contrast': highContrastTheme,
  'high-contrast-light': highContrastLightTheme,
};

export function getTheme(nameOrConfig: string | ThemeConfig | undefined): ThemeConfig {
  if (!nameOrConfig) return defaultTheme;
  if (typeof nameOrConfig === 'object') return nameOrConfig;
  const theme = themes[nameOrConfig];
  if (!theme) throw new Error(`Unknown theme: "${nameOrConfig}". Available: ${Object.keys(themes).join(', ')}`);
  return theme;
}

export { defaultTheme, darkTheme };
