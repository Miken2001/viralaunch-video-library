/**
 * Builds index/index.json (+ by-genre / by-domain buckets) from every entry.
 * Each record = authored meta + generated fields: propsSchema (JSON Schema of the entry's
 * zod Props), content hash + file list (what ViraLaunch verifies after fetching), and
 * preview info. No timestamps, so `--check` can prove the committed index is current.
 * Also rewrites the README preview gallery (posters and videos are release assets, so the
 * repository itself stays free of media).
 * INDEX_EXCLUDE=id,id leaves out drafts that other batch sessions are still writing.
 * Usage: pnpm index [--check]
 */
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
import {entriesDir, entryIds, readJson, readMeta, readPreviewManifest, root, sha256, treeHash} from './lib';

const previews = readPreviewManifest();

const config = readJson<{repo: string; ref: string; previewRelease: string; rawBase: string; previewBase: string}>(path.join(root, 'library.config.json'));
const taxonomy = readJson<{version: number; genre: Record<string, string>; domain: Record<string, string>}>(path.join(root, 'taxonomy.json'));

const excluded = new Set((process.env.INDEX_EXCLUDE ?? '').split(',').filter(Boolean));
const entries: Array<Record<string, unknown> & {id: string}> = [];
for (const id of entryIds().filter(i => !excluded.has(i))) {
  const meta = readMeta(id);
  if (meta.status !== 'approved') continue;
  const dir = path.join(entriesDir, id);
  const {sha256: hash, files} = treeHash(dir);
  let propsSchema: unknown = null;
  const schemaFile = path.join(dir, 'src', 'schema.ts');
  if (existsSync(schemaFile) && meta.portable !== false) {
    const {Props} = await import(pathToFileURL(schemaFile).href);
    propsSchema = z.toJSONSchema(Props, {target: 'draft-7', io: 'input', unrepresentable: 'any'});
  } else if (existsSync(path.join(dir, 'props.schema.json'))) {
    propsSchema = readJson(path.join(dir, 'props.schema.json'));
  }
  const record = previews[id];
  const localFile = path.join(root, 'previews', `${id}.mp4`);
  if (record && existsSync(localFile) && sha256(readFileSync(localFile)) !== record.sha256) console.warn(`warn: previews/${id}.mp4 differs from previews/manifest.json (run \`pnpm preview ${id}\` to record it)`);
  const preview = record ? {...record, url: config.previewBase.replace('{repo}', config.repo).replace('{release}', config.previewRelease).replace('{file}', record.file)} : null;
  entries.push({...meta, sha256: hash, files, propsSchema, preview});
}

const bucket = (key: 'genres' | 'domains', names: string[]) =>
  Object.fromEntries(names.map(n => [n, entries.filter(e => (e[key] as string[]).includes(n)).map(e => e.id)]));

const outputs: Record<string, unknown> = {
  'index.json': {version: 1, taxonomyVersion: taxonomy.version, repo: config.repo, ref: config.ref, rawBase: config.rawBase, count: entries.length, entries},
  'index.by-genre.json': bucket('genres', Object.keys(taxonomy.genre)),
  'index.by-domain.json': bucket('domains', Object.keys(taxonomy.domain)),
};

const check = process.argv.includes('--check');
mkdirSync(path.join(root, 'index'), {recursive: true});
let stale = 0;

// README gallery: one poster per previewed entry, linking to its MP4.
const GALLERY = /(<!-- gallery:start -->)[\s\S]*?(<!-- gallery:end -->)/;
const COLUMNS = 4;
const assetUrl = (file: string) => config.previewBase.replace('{repo}', config.repo).replace('{release}', config.previewRelease).replace('{file}', file);
const shown = entries.filter(e => e.preview) as Array<{id: string; preview: {file: string; poster: string}}>;
const cell = (e: (typeof shown)[number]) => `<td width="${100 / COLUMNS}%" align="center" valign="top"><a href="${assetUrl(e.preview.file)}"><img src="${assetUrl(e.preview.poster)}" alt="${e.id} preview" width="100%"></a><br><a href="entries/${e.id}"><code>${e.id}</code></a></td>`;
const rows = Array.from({length: Math.ceil(shown.length / COLUMNS)}, (_, r) => `<tr>${shown.slice(r * COLUMNS, (r + 1) * COLUMNS).map(cell).join('')}</tr>`);
const readmeFile = path.join(root, 'README.md');
const readme = readFileSync(readmeFile, 'utf8');
if (GALLERY.test(readme)) {
  const next = readme.replace(GALLERY, (_, a, b) => `${a}\n<table>\n${rows.join('\n')}\n</table>\n${b}`);
  if (next !== readme) {
    if (check) {
      stale++;
      console.error('stale: README.md gallery');
    } else writeFileSync(readmeFile, next);
  }
}
for (const [file, value] of Object.entries(outputs)) {
  const target = path.join(root, 'index', file);
  const text = JSON.stringify(value, null, 1) + '\n';
  if (check) {
    if (!existsSync(target) || readFileSync(target, 'utf8') !== text) {
      stale++;
      console.error(`stale: index/${file}`);
    }
  } else writeFileSync(target, text);
}
if (check && stale) {
  console.error('Run `pnpm index` and commit the result.');
  process.exit(1);
}
console.log(`${check ? 'checked' : 'wrote'} index: ${entries.length} entries`);
