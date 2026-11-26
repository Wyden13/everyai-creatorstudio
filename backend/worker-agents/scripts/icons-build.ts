/**
 * One-off, deterministic build of the pictogram icon catalog. Downloads the pinned icon sets
 * (sha256-checked), extracts every icon listed in src/vox/icon-manifest.ts into one combined SVG
 * path, and writes assets/icons/icons.json (committed). Run manually:
 *
 *   bun scripts/icons-build.ts
 *
 * The LLM never draws an icon: it may only reference the ids in the manifest.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ICONS, type IconFamily, type IconPath } from '../src/vox/icon-manifest';

const ROOT = resolve(import.meta.dir, '..');
const CACHE = join(ROOT, '.icons-cache');
const OUT = join(ROOT, 'assets/icons/icons.json');
const GAME_ICONS_COMMIT = '82d948812bfe3f269ef8f731dcdb07b08160edc4';

/**
 * Pinned sources, one per family: the archive, its sha256, where an icon's SVG sits inside it,
 * and which of its <path>s are artwork (game-icons draw a black 512² background path first).
 */
const SOURCES: Record<IconFamily, { url: string; sha256: string; dir: string; svg: (file: string) => string; artwork: (attrs: string) => boolean }> = {
  phosphor: {
    url: 'https://registry.npmjs.org/@phosphor-icons/core/-/core-2.1.1.tgz',
    sha256: '313332be6190b724da24107addd781799b48bf76b13963f24501112ffe1baadd',
    dir: 'phosphor',
    svg: (file) => `package/assets/fill/${file}-fill.svg`,
    artwork: () => true,
  },
  'game-icons': {
    url: `https://codeload.github.com/game-icons/icons/tar.gz/${GAME_ICONS_COMMIT}`,
    sha256: '6ede4bfaed3bbe3cbe4b188b46ab2d62a28bcf737cbfcd1f0edcfdf12c124cff',
    dir: 'game-icons',
    svg: (file) => `icons-${GAME_ICONS_COMMIT}/${file}.svg`,
    artwork: (attrs) => !/d="M0 0h512v512H0z"/.test(attrs),
  },
};

/** game-icons author folder → the credit name from the set's license.txt (CC BY 3.0 asks for it). */
const GAME_ICONS_AUTHORS: Record<string, string> = {
  delapouite: 'Delapouite', lorc: 'Lorc', skoll: 'Skoll', cathelineau: 'Cathelineau', sbed: 'Sbed', quoting: 'Quoting',
  'heavenly-dog': 'HeavenlyDog', 'lord-berandas': 'Lord Berandas',
};

async function unpack(family: IconFamily): Promise<string> {
  const src = SOURCES[family];
  const archive = join(CACHE, `${src.dir}.tgz`);
  const dir = join(CACHE, src.dir);
  if (!existsSync(archive)) {
    const res = await fetch(src.url);
    if (!res.ok) throw new Error(`download failed ${res.status}: ${src.url}`);
    writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
  }
  const got = createHash('sha256').update(readFileSync(archive)).digest('hex');
  if (got !== src.sha256) throw new Error(`sha256 mismatch for ${family}: ${got}`);
  mkdirSync(dir, { recursive: true });
  const tar = Bun.spawn(['tar', 'xzf', archive, '-C', dir], { stderr: 'pipe' });
  if ((await tar.exited) !== 0) throw new Error(`tar ${archive}: ${await new Response(tar.stderr).text()}`);
  return dir;
}

/** One icon's artwork as a single path; anything but plain filled paths fails loud (it would not take a tone). */
function extract(svgText: string, family: IconFamily, id: string): Pick<IconPath, 'd' | 'viewBox'> {
  const viewBox = svgText.match(/viewBox="([^"]+)"/)?.[1];
  const shapes = [...svgText.matchAll(/<(\w+)\b([^>]*?)\/?>/g)].filter(([, tag]) => tag !== 'svg' && tag !== 'path');
  if (!viewBox || shapes.length > 0) throw new Error(`${id}: expected <svg viewBox> with only <path>s, got ${shapes.map(([, t]) => t).join(', ')}`);
  const paths = [...svgText.matchAll(/<path\b([^>]*?)\/?>/g)].map(([, attrs]) => attrs!).filter(SOURCES[family].artwork);
  if (paths.length === 0) throw new Error(`${id}: no artwork path`);
  return { viewBox, d: paths.map((a) => a.match(/\bd="([^"]+)"/)![1]).join('') };
}

mkdirSync(join(ROOT, 'assets/icons'), { recursive: true });
mkdirSync(CACHE, { recursive: true });
const dirs = { phosphor: await unpack('phosphor'), 'game-icons': await unpack('game-icons') };
const icons: Record<string, IconPath> = {};
for (const [id, { family, file }] of Object.entries(ICONS)) {
  const path = join(dirs[family], SOURCES[family].svg(file));
  if (!existsSync(path)) throw new Error(`${id}: ${family} has no ${file}`);
  const author = family === 'game-icons' ? GAME_ICONS_AUTHORS[file.split('/')[0]!] : undefined;
  if (family === 'game-icons' && !author) throw new Error(`${id}: no credit name for author folder ${file.split('/')[0]}`);
  icons[id] = { ...extract(readFileSync(path, 'utf8'), family, id), family, ...(author && { author }) };
}
writeFileSync(OUT, `${JSON.stringify(icons)}\n`);
const bytes = readFileSync(OUT).length;
console.log(`wrote ${OUT}: ${Object.keys(icons).length} icons (${(bytes / 1024).toFixed(1)} KB)`);
if (bytes > 600 * 1024) throw new Error('icon pack exceeds 600 KB budget');
