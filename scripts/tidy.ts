/**
 * Frees local disk space: removes render leftovers that are all gitignored, so the
 * repository and its GitHub release are never affected.
 * Preview MP4s/posters are removed only once they are published in the preview release;
 * unpublished ones are kept and listed.
 * Usage: pnpm tidy [--dry-run]
 */
import {spawnSync} from 'node:child_process';
import {existsSync, readdirSync, rmSync, statSync} from 'node:fs';
import path from 'node:path';
import {readJson, root} from './lib';

const dryRun = process.argv.includes('--dry-run');
// Small checkouts and data the pipeline reads again (not worth re-downloading), plus batch
// logs/reports and parked failed drafts (text only, kept for review).
const KEEP_IN_CACHE = new Set(['awesome', 'skillry', 'ne_110m_land.geojson', 'batches', 'failed']);

const size = (p: string): number => {
  const s = statSync(p, {throwIfNoEntry: false});
  if (!s) return 0;
  return s.isDirectory() ? readdirSync(p).reduce((n, f) => n + size(path.join(p, f)), 0) : s.size;
};

const targets = [path.join(root, 'node_modules', '.cache'), path.join(root, 'out')];
const cache = path.join(root, '.cache');
if (existsSync(cache)) targets.push(...readdirSync(cache).filter(f => !KEEP_IN_CACHE.has(f)).map(f => path.join(cache, f)));

const config = readJson<{repo: string; previewRelease: string}>(path.join(root, 'library.config.json'));
const previews = path.join(root, 'previews');
const local = existsSync(previews) ? readdirSync(previews).filter(f => /\.(mp4|jpg)$/.test(f)) : [];
const kept: string[] = [];
if (local.length) {
  const gh = spawnSync('gh', ['release', 'view', config.previewRelease, '-R', config.repo, '--json', 'assets', '--jq', '.assets[].name'], {encoding: 'utf8'});
  const published = gh.status === 0 ? new Set(gh.stdout.split('\n').filter(Boolean)) : null;
  if (!published) console.warn(`Could not read release ${config.previewRelease} (is gh logged in?); keeping every local preview.`);
  for (const f of local) (published?.has(f) ? targets : kept).push(path.join(previews, f));
}

let freed = 0;
for (const t of targets) {
  const bytes = size(t);
  if (!bytes && !existsSync(t)) continue;
  freed += bytes;
  if (dryRun) console.log(`${(bytes / 1048576).toFixed(1).padStart(8)} MB  ${path.relative(root, t)}`);
  else rmSync(t, {recursive: true, force: true});
}
console.log(`${dryRun ? 'would free' : 'freed'} ${(freed / 1048576).toFixed(0)} MB`);
if (kept.length) console.log(`kept ${kept.length} unpublished preview file(s); publish them first:\n  gh release upload ${config.previewRelease} ${kept.map(k => path.relative(root, k)).join(' ')}`);
