/**
 * Runs `make-entry` for every pick in batches/batch-NN.json, a few headless sessions at a time.
 * Resumable: entries that already validate are skipped. Logs go to .cache/batches/NN/<id>.log;
 * the outcome is written to batches/batch-NN.result.json. Previews are re-recorded in
 * previews/manifest.json at the end (parallel renders can race on that file).
 * Usage: pnpm make-batch NN   (BATCH_CONCURRENCY=3)
 */
import {spawn, spawnSync} from 'node:child_process';
import {createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {readJson, recordPreview, root} from './lib';

type Pick = {inspirationId: string; entryId: string; direction: string};
const nn = String(process.argv[2] ?? '').padStart(2, '0');
const file = path.join(root, 'batches', `batch-${nn}.json`);
if (!existsSync(file)) throw new Error('Usage: pnpm make-batch NN (run pnpm plan-batch first)');
const picks = readJson<Pick[]>(file);
const logs = path.join(root, '.cache', 'batches', nn);
mkdirSync(logs, {recursive: true});
const concurrency = Number(process.env.BATCH_CONCURRENCY ?? 3);
const awesome = path.join(root, '.cache', 'awesome');

const valid = (id: string) => existsSync(path.join(root, 'entries', id, 'meta.json')) && spawnSync('npx', ['tsx', 'scripts/validate.ts', id], {cwd: root}).status === 0 && existsSync(path.join(root, 'previews', `${id}.mp4`));
const results: Record<string, {status: 'ok' | 'failed' | 'skipped'; reason?: string; minutes?: number}> = {};

async function run(p: Pick) {
  if (valid(p.entryId)) return (results[p.entryId] = {status: 'skipped', reason: 'already valid'});
  const started = Date.now();
  const log = createWriteStream(path.join(logs, `${p.entryId}.log`));
  const args = ['tsx', 'scripts/make-entry.ts', p.inspirationId, p.entryId, '--direction', p.direction, ...(existsSync(awesome) ? ['--awesome', awesome] : [])];
  const code = await new Promise<number>(resolve => {
    const child = spawn('npx', args, {cwd: root});
    child.stdout.pipe(log);
    child.stderr.pipe(log);
    child.on('close', c => resolve(c ?? 1));
  });
  const tail = readFileSync(path.join(logs, `${p.entryId}.log`), 'utf8').match(/RESULT \S+ (ok|failed[^\n]*)/)?.[1];
  const ok = code === 0 && valid(p.entryId);
  results[p.entryId] = {status: ok ? 'ok' : 'failed', reason: ok ? undefined : tail ?? `exit ${code}`, minutes: Math.round((Date.now() - started) / 60000)};
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${p.entryId} (${results[p.entryId].minutes} min)${ok ? '' : ` — ${results[p.entryId].reason}`}`);
}

const queue = [...picks];
await Promise.all(Array.from({length: Math.min(concurrency, queue.length)}, async () => {
  for (let p = queue.shift(); p; p = queue.shift()) await run(p);
}));
for (const p of picks) recordPreview(p.entryId);
writeFileSync(path.join(root, 'batches', `batch-${nn}.result.json`), JSON.stringify(results, null, 2) + '\n');
const ok = Object.values(results).filter(r => r.status !== 'failed').length;
console.log(`batch ${nn}: ${ok}/${picks.length} ok`);
