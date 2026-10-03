/**
 * Builds index/index.json (+ by-genre / by-domain buckets) from every entry.
 * Each record = authored meta + generated fields: propsSchema (JSON Schema of the entry's
 * zod Props), content hash + file list (what ViraLaunch verifies after fetching), and
 * preview info. No timestamps, so `--check` can prove the committed index is current.
 * Usage: pnpm index [--check]
 */
import {existsSync, readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
import {entriesDir, entryIds, readJson, readMeta, root, sha256, treeHash} from './lib';

const config = readJson<{repo: string; ref: string; previewRelease: string; rawBase: string; previewBase: string}>(path.join(root, 'library.config.json'));
const taxonomy = readJson<{version: number; genre: Record<string, string>; domain: Record<string, string>}>(path.join(root, 'taxonomy.json'));

const entries: Array<Record<string, unknown> & {id: string}> = [];
for (const id of entryIds()) {
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
  const previewFile = path.join(root, 'previews', `${id}.mp4`);
  const preview = existsSync(previewFile)
    ? {
        file: `${id}.mp4`,
        poster: `${id}.jpg`,
        sha256: sha256(readFileSync(previewFile)),
        url: config.previewBase.replace('{repo}', config.repo).replace('{release}', config.previewRelease).replace('{file}', `${id}.mp4`),
      }
    : null;
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
