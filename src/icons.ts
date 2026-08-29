import { resolve, dirname } from 'path';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { cloudIconIndex } from './cloud-icons-index.js';
import { geistIconIndex } from './geist-icons-index.js';

export type IconType = 'emoji' | 'favicon' | 'cloud' | 'geist' | 'civic' | 'named' | 'none';

export interface ResolveIconOptions {
  /** Emoji and favicon resolution perform outbound network requests. */
  allowRemote?: boolean;
}

type SimpleIcon = { title: string; slug: string; svg: string; hex: string };

let slugMapPromise: Promise<Map<string, SimpleIcon>> | undefined;

// Resolve icon directories relative to this file
const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsRoot = resolve(__dirname, '..', 'downloaded_icons');
const geistIconsRoot = resolve(__dirname, '..', 'icons');
const civicIconsRoot = resolve(__dirname, '..', 'icons', 'civic');

const emojiRegex = /\p{Emoji_Presentation}|\p{Emoji}\uFE0F/u;

export function detectIconType(icon: string | undefined): IconType {
  if (!icon) return 'none';
  if (icon.startsWith('aws:') || icon.startsWith('gcp:')) return 'cloud';
  if (icon.startsWith('geist:')) return 'geist';
  if (icon.startsWith('civic:')) return 'civic';
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

async function simpleIconMap(): Promise<Map<string, SimpleIcon>> {
  if (!slugMapPromise) {
    slugMapPromise = import('simple-icons').then(simpleIcons => {
      const map = new Map<string, SimpleIcon>();
      for (const [key, value] of Object.entries(simpleIcons)) {
        if (key.startsWith('si') && typeof value === 'object' && value !== null && 'slug' in value) {
          map.set((value as SimpleIcon).slug, value as SimpleIcon);
        }
      }
      return map;
    });
  }
  return slugMapPromise;
}

async function resolveSimpleIcon(slug: string): Promise<string> {
  const slugMap = await simpleIconMap();
  const icon = slugMap.get(slug);
  if (!icon) throw new Error(`Simple icon not found: ${slug}`);
  const svg = icon.svg.replace('<svg ', `<svg fill="#${icon.hex}" `);
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

async function resolveCloudIcon(key: string): Promise<string> {
  const relPath = cloudIconIndex[key];
  if (!relPath) throw new Error(`Cloud icon not found: ${key}`);
  const fullPath = resolve(iconsRoot, relPath);
  const svg = await readFile(fullPath, 'utf-8');
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

async function resolveGeistIcon(key: string): Promise<string> {
  const relPath = geistIconIndex[key];
  if (!relPath) throw new Error(`Geist icon not found: ${key}. Use "geist:<name>" — run "diagrams icons geist" to list.`);
  const fullPath = resolve(geistIconsRoot, relPath);
  let svg = await readFile(fullPath, 'utf-8');

  // Replace currentColor with a medium-dark fill
  svg = svg.replace(/currentColor/g, '#555555');

  // Normalize to match AWS icon format for OOXML/PPTX compatibility:
  // 1. Remove stroke-linejoin from root <svg> (unusual attr that confuses OOXML)
  svg = svg.replace(/ stroke-linejoin="[^"]*"/, '');
  // 2. Scale up from 16x16 to 48x48 (matching AWS icon dimensions)
  //    Keep viewBox at 0 0 16 16 — no negative coords (OOXML can choke on them)
  svg = svg.replace(/width="16"/, 'width="48"');
  svg = svg.replace(/height="16"/, 'height="48"');
  // 3. Add version and xlink namespace to <svg> tag
  svg = svg.replace(
    '<svg ',
    '<svg version="1.1" xmlns:xlink="http://www.w3.org/1999/xlink" '
  );
  // 4. Add XML declaration
  if (!svg.startsWith('<?xml')) {
    svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + svg;
  }

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

async function resolveCivicIcon(key: string): Promise<string> {
  if (!/^[a-z0-9-]+$/.test(key)) throw new Error(`Invalid civic icon name: ${key}`);
  const fullPath = resolve(civicIconsRoot, `${key}.svg`);
  let svg = await readFile(fullPath, 'utf-8');
  svg = svg.replace(/currentColor/g, '#555555');
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export async function resolveIcon(icon: string, options: ResolveIconOptions = {}): Promise<string> {
  const type = detectIconType(icon);
  try {
    switch (type) {
      case 'emoji':
        if (options.allowRemote === false) throw new Error('Remote emoji resolution is disabled');
        return await resolveEmoji(icon);
      case 'favicon':
        if (options.allowRemote === false) throw new Error('Remote favicon resolution is disabled');
        return await resolveFavicon(icon.slice('favicon:'.length));
      case 'cloud':
        return await resolveCloudIcon(icon);
      case 'geist':
        return await resolveGeistIcon(icon);
      case 'civic':
        return await resolveCivicIcon(icon.slice('civic:'.length));
      case 'named':
        return await resolveSimpleIcon(icon);
      default:
        return '';
    }
  } catch (err) {
    console.warn(`[icons] Failed to resolve icon "${icon}":`, (err as Error).message);
    return '';
  }
}
