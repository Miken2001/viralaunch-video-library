import {createHash} from 'node:crypto';
import {existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/**
 * Where entries live. Defaults to this repo's entries/; point ENTRIES_DIR at another folder (e.g.
 * viralaunch-local/packages/remotion/library/entries for the CLI's bundled templates) to run
 * the same validate / preview / still-sheet tooling on it.
 */
export const entriesDir = process.env.ENTRIES_DIR ? path.resolve(process.env.ENTRIES_DIR) : path.join(root, 'entries');
export const kitDir = path.join(root, 'kit', 'src');

export type Meta = {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  summary: string;
  genres: string[];
  domains: string[];
  adWeave: string[];
  techniques: string[];
  aspects: Array<'9:16' | '1:1' | '16:9'>;
  durationSeconds: {min: number; max: number};
  tiers: Array<'fill' | 'fork'>;
  minModel: 'small' | 'mid' | 'frontier';
  renderCost: 'low' | 'med' | 'high';
  requires: string[];
  location: 'core' | 'remote';
  source: 'original' | 'legacy' | 'recreation' | 'seed';
  inspiredBy?: Array<{url: string; author?: string; collection: string; inspirationId?: string}>;
  license: 'MIT';
  status: 'draft' | 'approved';
  authoredBy?: string;
  remotionPackages?: string[];
  portable?: boolean;
  roles: Array<'hook' | 'context' | 'evidence' | 'explanation' | 'payoff' | 'closer'>;
  segmentable: boolean;
  look: 'dark' | 'light' | 'adaptive';
  lookPreset: 'cinematic' | 'documentary' | 'midnight' | 'paper' | 'broadcast';
  themeable: boolean;
};

export type Example = {
  media?: Record<string, unknown> & {aspectRatio?: '9:16' | '1:1' | '16:9'};
  /** `asset` names a file in samples/ used as the scene's image in previews. */
  scenes: Array<{text: string; durationSeconds: number; asset?: string}>;
  props: Record<string, unknown>;
};

export function entryIds(): string[] {
  return readdirSync(entriesDir, {withFileTypes: true})
    .filter(d => d.isDirectory() && existsSync(path.join(entriesDir, d.name, 'meta.json')))
    .map(d => d.name)
    .sort();
}

export const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf8')) as T;
export const readMeta = (id: string) => readJson<Meta>(path.join(entriesDir, id, 'meta.json'));
export const readExample = (id: string) => readJson<Example>(path.join(entriesDir, id, 'props.example.json'));

/** Every file that belongs to an entry's distributable content (sorted, posix paths). */
export function entryFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (rel: string) => {
    for (const d of readdirSync(path.join(dir, rel), {withFileTypes: true})) {
      const child = rel ? `${rel}/${d.name}` : d.name;
      if (d.name.startsWith('.') || d.name === 'node_modules') continue;
      if (d.isDirectory()) walk(child);
      else out.push(child);
    }
  };
  walk('');
  return out.sort();
}

export const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');

/**
 * Content hash of an entry directory. ViraLaunch recomputes exactly this before rendering a
 * fetched entry: sha256 over "<path>\0<file sha256>\n" for every file, sorted by path.
 */
export function treeHash(dir: string): {sha256: string; files: Array<{path: string; sha256: string; bytes: number}>} {
  const files = entryFiles(dir).map(p => {
    const bytes = readFileSync(path.join(dir, p));
    return {path: p, sha256: sha256(bytes), bytes: bytes.length};
  });
  return {sha256: sha256(files.map(f => `${f.path}\0${f.sha256}\n`).join('')), files};
}

export const dimensions = (aspect: string | undefined): [number, number] =>
  aspect === '16:9' ? [1920, 1080] : aspect === '1:1' ? [1080, 1080] : [1080, 1920];

/** Media props for a preview render: silent narration, evenly spread word captions, no assets. */
export function exampleMedia(example: Example, aspect?: string) {
  const [width, height] = dimensions(aspect ?? example.media?.aspectRatio);
  const {aspectRatio: _aspect, ...rest} = example.media ?? {};
  const scenes = example.scenes.map(s => {
    const words = s.text.split(/\s+/).filter(Boolean);
    const ms = s.durationSeconds * 1000;
    return {
      text: s.text,
      video: s.asset ? path.basename(s.asset) : '',
      isStaticImage: true,
      audio: {url: '', duration: s.durationSeconds},
      captions: words.map((w, i) => ({text: ' ' + w, startMs: (i * ms) / words.length, endMs: ((i + 1) * ms) / words.length})),
    };
  });
  return {
    fps: 30,
    narration: false,
    captions: true,
    ...rest,
    width,
    height,
    scenes,
    durationMs: example.scenes.reduce((n, s) => n + s.durationSeconds * 1000, 0),
  };
}

/** Webpack aliases that make `@viralaunch/kit` resolve to this repo's kit. */
export function kitAliases(kit = kitDir) {
  return {'@viralaunch/kit/root': path.join(kit, 'root.tsx'), '@viralaunch/kit/fx': path.join(kit, 'fx.tsx'), '@viralaunch/kit$': path.join(kit, 'index.tsx')};
}

/** Writes the two-line Remotion root for one entry and returns its path. */
export function writeEntryRoot(entryDir: string, outDir: string): string {
  mkdirSync(outDir, {recursive: true});
  const file = path.join(outDir, 'root.tsx');
  const target = path.join(entryDir, 'src', 'index').split(path.sep).join('/');
  writeFileSync(file, `import entry from ${JSON.stringify(target)};\nimport {registerEntry} from '@viralaunch/kit/root';\nregisterEntry(entry);\n`);
  return file;
}

export const isDir = (p: string) => existsSync(p) && statSync(p).isDirectory();

/**
 * previews/manifest.json — committed record of each entry's published preview (the MP4s and
 * posters themselves are release assets, gitignored here). The index reads this, so
 * `pnpm index --check` gives the same answer on any machine, CI included.
 */
export type PreviewRecord = {file: string; poster: string; sha256: string};
const manifestFile = () => path.join(root, 'previews', 'manifest.json');
export function readPreviewManifest(): Record<string, PreviewRecord> {
  return existsSync(manifestFile()) ? (JSON.parse(readFileSync(manifestFile(), 'utf8')) as Record<string, PreviewRecord>) : {};
}
/** Records (or refreshes) an entry's preview from previews/<id>.mp4 after it is rendered. */
export function recordPreview(id: string) {
  const file = path.join(root, 'previews', `${id}.mp4`);
  if (!existsSync(file)) return;
  const manifest = readPreviewManifest();
  manifest[id] = {file: `${id}.mp4`, poster: `${id}.jpg`, sha256: sha256(readFileSync(file))};
  const sorted = Object.fromEntries(Object.keys(manifest).sort().map(k => [k, manifest[k]]));
  writeFileSync(manifestFile(), JSON.stringify(sorted, null, 2) + '\n');
}
