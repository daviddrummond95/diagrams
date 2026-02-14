import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as simpleIcons from 'simple-icons';
import { cloudIconIndex } from './cloud-icons-index.js';

type IconType = 'emoji' | 'favicon' | 'cloud' | 'named' | 'none';

type SimpleIcon = { title: string; slug: string; svg: string; hex: string };

// Build a slug → icon lookup once for simple-icons
const slugMap = new Map<string, SimpleIcon>();
for (const [key, value] of Object.entries(simpleIcons)) {
  if (key.startsWith('si') && typeof value === 'object' && value !== null && 'slug' in value) {
    slugMap.set((value as SimpleIcon).slug, value as SimpleIcon);
  }
}

// Resolve downloaded_icons directory relative to this file
const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsRoot = resolve(__dirname, '..', 'downloaded_icons');

const emojiRegex = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/u;

export function detectIconType(icon: string | undefined): IconType {
  if (!icon) return 'none';
  if (icon.startsWith('aws:') || icon.startsWith('gcp:')) return 'cloud';
  if (icon.startsWith('favicon:')) return 'favicon';
  if (emojiRegex.test(icon)) return 'emoji';
  return 'named';
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

async function resolveEmoji(icon: string): Promise<string> {
  const codepoints = [...icon]
    .map(c => c.codePointAt(0)!.toString(16))
    .filter(cp => cp !== 'fe0f')
    .join('-');
  const url = `https://cdn.jsdelivr.net/gh/twitter/twemoji@latest/assets/svg/${codepoints}.svg`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Twemoji fetch failed: ${res.status}`);
  const svg = await res.text();
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

async function resolveFavicon(domain: string): Promise<string> {
  const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Favicon fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return `data:image/png;base64,${toBase64(buf)}`;
}

function resolveSimpleIcon(slug: string): string {
  const icon = slugMap.get(slug);
  if (!icon) throw new Error(`Simple icon not found: ${slug}`);
  const svg = icon.svg.replace('<svg ', `<svg fill="#${icon.hex}" `);
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

async function resolveCloudIcon(key: string): Promise<string> {
  const relPath = cloudIconIndex[key];
  if (!relPath) throw new Error(`Cloud icon not found: ${key}`);
  const fullPath = resolve(iconsRoot, relPath);
  const file = Bun.file(fullPath);
  const svg = await file.text();
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export async function resolveIcon(icon: string): Promise<string> {
  const type = detectIconType(icon);
  try {
    switch (type) {
      case 'emoji':
        return await resolveEmoji(icon);
      case 'favicon':
        return await resolveFavicon(icon.slice('favicon:'.length));
      case 'cloud':
        return await resolveCloudIcon(icon);
      case 'named':
        return resolveSimpleIcon(icon);
      default:
        return '';
    }
  } catch (err) {
    console.warn(`[icons] Failed to resolve icon "${icon}":`, (err as Error).message);
    return '';
  }
}
