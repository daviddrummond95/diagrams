import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

let fontCache: { name: string; data: ArrayBuffer; weight: number; style: string }[] | null = null;

export async function loadFonts() {
  if (fontCache) return fontCache;

  const fontsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'fonts');

  const [regular, medium, semibold] = await Promise.all([
    readFile(join(fontsDir, 'Inter-Regular.ttf')),
    readFile(join(fontsDir, 'Inter-Medium.ttf')),
    readFile(join(fontsDir, 'Inter-SemiBold.ttf')),
  ]);

  fontCache = [
    { name: 'Inter', data: regular.buffer.slice(0) as ArrayBuffer, weight: 400, style: 'normal' },
    { name: 'Inter', data: medium.buffer.slice(0) as ArrayBuffer, weight: 500, style: 'normal' },
    { name: 'Inter', data: semibold.buffer.slice(0) as ArrayBuffer, weight: 600, style: 'normal' },
  ];

  return fontCache;
}
