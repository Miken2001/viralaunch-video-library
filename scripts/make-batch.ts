/**
 * Runs `make-entry` for every pick in batches/batch-NN.json, a few headless sessions at a time,
 * built to run unattended overnight:
 * - each finished entry is published on its own: preview uploaded to the release, manifest +
 *   index updated, committed and pushed, then its local leftovers deleted (disk stays flat);
 * - a Claude session limit pauses the whole batch (probing every 20 min) instead of failing
 *   entries; a real failure gets one retry, then its draft moves to .cache/failed/<id>;
 * - Remotion temp frames go to .cache/tmp/<id> on disk (/tmp is a RAM tmpfs here);
 * - a new session starts only when enough memory is free.
 * Resumable: entries that already validate and are committed are skipped.
 * Logs: .cache/batches/NN/<id>.log; outcome: batches/batch-NN.result.json + .cache/batches/NN/report.md
 * Usage: pnpm make-batch NN   (BATCH_CONCURRENCY=2, BATCH_LIMIT=n, BATCH_PUBLISH=0 to skip git/release)
 */
import {spawn, spawnSync} from 'node:child_process';
import {createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {entryIds, readJson, readPreviewManifest, root, sha256, type PreviewRecord} from './lib';

type Pick = {inspirationId: string; entryId: string; direction: string};
type Result = {status: 'ok' | 'failed' | 'skipped' | 'unpublished'; reason?: string; minutes?: number; attempts?: number};
const nn = String(process.argv[2] ?? '').padStart(2, '0');
const file = path.join(root, 'batches', `batch-${nn}.json`);
if (!existsSync(file)) throw new Error('Usage: pnpm make-batch NN (run pnpm plan-batch first)');
const picks = readJson<Pick[]>(file).slice(0, Number(process.env.BATCH_LIMIT ?? Infinity));
const logs = path.join(root, '.cache', 'batches', nn);
mkdirSync(logs, {recursive: true});
const concurrency = Number(process.env.BATCH_CONCURRENCY ?? 2);
const publishing = process.env.BATCH_PUBLISH !== '0';
const awesome = path.join(root, '.cache', 'awesome');
const config = readJson<{repo: string; previewRelease: string}>(path.join(root, 'library.config.json'));
const MIN_FREE_MB = 2048;
const MAX_ATTEMPTS = 2;

const stamp = () => new Date().toTimeString().slice(0, 8);
const say = (line: string) => console.log(`${stamp()} ${line}`);
const run = (cmd: string, args: string[], env?: Record<string, string>) => spawnSync(cmd, args, {cwd: root, encoding: 'utf8', env: {...process.env, ...env}});
const tracked = (id: string) => run('git', ['ls-files', '--error-unmatch', `entries/${id}/meta.json`]).status === 0;
const published = (id: string) => id in readPreviewManifest() && tracked(id) && run('git', ['status', '--porcelain', `entries/${id}`]).stdout.trim() === '';
const valid = (id: string) => existsSync(path.join(root, 'entries', id, 'meta.json')) && run('npx', ['tsx', 'scripts/validate.ts', id]).status === 0;
const freeMb = () => Number(readFileSync('/proc/meminfo', 'utf8').match(/MemAvailable:\s+(\d+)/)?.[1] ?? 0) / 1024;
const LIMIT = /hit your (session|usage|weekly) limit|usage limit reached|rate limit|limit will reset|resets \d/i;

const results: Record<string, Result> = {};
const attempts: Record<string, number> = {};
const records: Record<string, PreviewRecord> = {};
const running = new Set<string>();

// One pause shared by every worker: sessions stop starting until a probe gets through.
let pause: Promise<void> | null = null;
function limitHit() {
  pause ??= (async () => {
    say('session limit hit: pausing new entries, probing every 20 min');
    for (;;) {
      await sleep(20 * 60 * 1000);
      const probe = run('claude', ['-p', 'Reply with the single word ok.']);
      if (probe.status === 0 && !LIMIT.test(probe.stdout + probe.stderr)) break;
      say('still limited');
    }
    say('limit cleared: resuming');
    pause = null;
  })();
}

/** Deletes everything an entry's run left on disk except its committed source. */
function cleanup(id: string, keepPreview = false) {
  const cache = path.join(root, '.cache');
  const targets = [path.join(cache, 'reference', id), path.join(cache, 'public', id), path.join(cache, 'roots', id), path.join(cache, 'tmp', id), path.join(cache, `tsconfig.${id}.json`)];
  if (existsSync(path.join(cache, 'bundles'))) targets.push(...readdirSync(path.join(cache, 'bundles')).filter(b => b.endsWith(`-${id}`)).map(b => path.join(cache, 'bundles', b)));
  const sheets = path.join(root, 'out', 'sheets');
  if (existsSync(sheets)) targets.push(...readdirSync(sheets).filter(s => s.startsWith(`${id}-`) || s === `${id}.jpg`).map(s => path.join(sheets, s)));
  if (!keepPreview) targets.push(...readdirSync(path.join(root, 'previews')).filter(f => f.startsWith(id) && /\.(mp4|jpg)$/.test(f)).map(f => path.join(root, 'previews', f)));
  for (const t of targets) rmSync(t, {recursive: true, force: true});
}

// Publishing is serialized: one entry at a time touches git, the manifest and the index.
let publishChain: Promise<unknown> = Promise.resolve();
function publish(id: string): Promise<boolean> {
  const step = publishChain.then(async () => {
    const mp4 = path.join(root, 'previews', `${id}.mp4`);
    const jpg = path.join(root, 'previews', `${id}.jpg`);
    if (!existsSync(mp4) || !existsSync(jpg)) {
      if (id in readPreviewManifest() && tracked(id)) return true;
      say(`publish ${id}: no local preview`);
      return false;
    }
    records[id] = {file: `${id}.mp4`, poster: `${id}.jpg`, sha256: sha256(readFileSync(mp4))};
    for (let i = 0; ; i++) {
      const up = run('gh', ['release', 'upload', config.previewRelease, mp4, jpg, '--clobber', '-R', config.repo]);
      if (up.status === 0) break;
      if (i === 2) {
        say(`publish ${id}: release upload failed: ${up.stderr.trim().split('\n')[0]}`);
        return false;
      }
      await sleep(60_000);
    }
    // Child renders rewrite the manifest too; re-apply every record this batch owns.
    const manifestFile = path.join(root, 'previews', 'manifest.json');
    const manifest = {...readPreviewManifest(), ...records};
    writeFileSync(manifestFile, JSON.stringify(Object.fromEntries(Object.keys(manifest).sort().map(k => [k, manifest[k]])), null, 2) + '\n');
    // The index lists committed entries + this one, never a sibling's unfinished draft.
    const exclude = entryIds().filter(e => e !== id && !tracked(e));
    const index = run('npx', ['tsx', 'scripts/build-index.ts'], {INDEX_EXCLUDE: exclude.join(',')});
    if (index.status !== 0) {
      say(`publish ${id}: pnpm index failed: ${index.stderr.trim().split('\n').pop()}`);
      return false;
    }
    run('git', ['add', `entries/${id}`, 'previews/manifest.json', 'index', 'README.md', file]);
    const commit = run('git', ['commit', '-m', `Add ${id} template`, '-m', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>']);
    if (commit.status !== 0) say(`publish ${id}: commit: ${(commit.stdout + commit.stderr).trim().split('\n')[0]}`);
    let push = run('git', ['push', 'origin', 'HEAD:main']);
    if (push.status !== 0) {
      run('git', ['pull', '--rebase', 'origin', 'main']);
      push = run('git', ['push', 'origin', 'HEAD:main']);
    }
    if (push.status !== 0) say(`publish ${id}: push failed (committed locally, will go with the next push): ${push.stderr.trim().split('\n').pop()}`);
    cleanup(id);
    return true;
  });
  publishChain = step.catch(() => false);
  return step;
}

async function make(p: Pick): Promise<'done' | 'retry'> {
  const id = p.entryId;
  if (published(id)) {
    results[id] = {status: 'skipped', reason: 'already published'};
    return 'done';
  }
  if (valid(id) && existsSync(path.join(root, 'previews', `${id}.mp4`))) {
    const ok = !publishing || (await publish(id));
    results[id] = ok ? {status: 'ok', reason: 'finished earlier, published now'} : {status: 'unpublished'};
    return 'done';
  }
  while (pause) await pause;
  while (freeMb() < MIN_FREE_MB) await sleep(30_000);
  running.add(id);
  const started = Date.now();
  const logFile = path.join(logs, `${id}.log`);
  const log = createWriteStream(logFile, {flags: 'a'});
  const tmp = path.join(root, '.cache', 'tmp', id);
  mkdirSync(tmp, {recursive: true});
  const args = ['tsx', 'scripts/make-entry.ts', p.inspirationId, id, '--direction', p.direction, ...(existsSync(awesome) ? ['--awesome', awesome] : [])];
  say(`start ${id} (attempt ${(attempts[id] ?? 0) + 1}, ${freeMb().toFixed(0)} MB free)`);
  const code = await new Promise<number>(resolve => {
    const child = spawn('npx', args, {cwd: root, env: {...process.env, TMPDIR: tmp, PREVIEW_CONCURRENCY: process.env.PREVIEW_CONCURRENCY ?? '2'}});
    child.stdout.pipe(log, {end: false});
    child.stderr.pipe(log, {end: false});
    child.on('close', c => resolve(c ?? 1));
  });
  log.end();
  running.delete(id);
  const minutes = Math.round((Date.now() - started) / 60000);
  const text = readFileSync(logFile, 'utf8');
  const tail = [...text.matchAll(/RESULT \S+ (ok|failed[^\n]*)/g)].pop()?.[1];
  const ok = code === 0 && tail !== undefined && tail.startsWith('ok') && valid(id) && existsSync(path.join(root, 'previews', `${id}.mp4`));
  if (!ok && LIMIT.test(text.slice(-4000))) {
    say(`limit ${id} after ${minutes} min (draft kept, will resume)`);
    limitHit();
    return 'retry';
  }
  attempts[id] = (attempts[id] ?? 0) + 1;
  if (ok) {
    const done = !publishing || (await publish(id));
    results[id] = {status: done ? 'ok' : 'unpublished', minutes, attempts: attempts[id]};
    say(`${done ? 'ok  ' : 'UNPUBLISHED'} ${id} (${minutes} min)`);
    return 'done';
  }
  const reason = tail ?? `exit ${code}`;
  if (attempts[id] < MAX_ATTEMPTS) {
    say(`FAIL ${id} (${minutes} min) — ${reason}; will retry`);
    return 'retry';
  }
  results[id] = {status: 'failed', reason, minutes, attempts: attempts[id]};
  say(`FAIL ${id} (${minutes} min) — ${reason}; giving up`);
  // Park the draft outside entries/ so the repo, the index and CI stay clean.
  const draft = path.join(root, 'entries', id);
  if (existsSync(draft) && run('git', ['ls-files', `entries/${id}`]).stdout.trim() === '') {
    const parked = path.join(root, '.cache', 'failed', id);
    rmSync(parked, {recursive: true, force: true});
    mkdirSync(path.dirname(parked), {recursive: true});
    renameSync(draft, parked);
  }
  cleanup(id);
  return 'done';
}

const diskBefore = run('du', ['-sm', root]).stdout.split('\t')[0];
const queue = [...picks];
let active = 0;
await Promise.all(Array.from({length: Math.min(concurrency, queue.length)}, async (_, w) => {
  // Stagger starts so two sessions do not bundle at the same moment.
  await sleep(w * 90_000);
  for (;;) {
    const p = queue.shift();
    if (!p) {
      if (active === 0) return;
      await sleep(30_000);
      continue;
    }
    active++;
    try {
      if ((await make(p)) === 'retry') queue.push(p);
    } catch (e) {
      say(`error ${p.entryId}: ${(e as Error).message}`);
      results[p.entryId] = {status: 'failed', reason: (e as Error).message};
    } finally {
      active--;
    }
  }
}));
await publishChain;

writeFileSync(path.join(root, 'batches', `batch-${nn}.result.json`), JSON.stringify(results, null, 2) + '\n');
if (publishing) {
  run('git', ['add', path.join('batches', `batch-${nn}.result.json`)]);
  run('git', ['commit', '-m', `Batch ${nn} results`, '-m', 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>']);
  run('git', ['push', 'origin', 'HEAD:main']);
}
run('npx', ['tsx', 'scripts/tidy.ts']);
const diskAfter = run('du', ['-sm', root]).stdout.split('\t')[0];
const by = (s: Result['status']) => Object.entries(results).filter(([, r]) => r.status === s);
const report = [
  `# Batch ${nn} report (${new Date().toISOString()})`,
  '',
  `ok: ${by('ok').length} · skipped: ${by('skipped').length} · failed: ${by('failed').length} · unpublished: ${by('unpublished').length} · of ${picks.length}`,
  `library folder: ${diskBefore} MB before, ${diskAfter} MB after`,
  '',
  ...Object.entries(results).map(([id, r]) => `- ${r.status.padEnd(11)} ${id}${r.minutes !== undefined ? ` (${r.minutes} min, ${r.attempts ?? 1} attempt(s))` : ''}${r.reason ? ` — ${r.reason}` : ''}`),
].join('\n');
writeFileSync(path.join(logs, 'report.md'), report + '\n');
console.log(report);
