/**
 * Production pipeline for one entry: prepares visual reference frames from the original post
 * (local only, never committed), then runs a headless Claude Code session with
 * prompts/make-entry.md to write, validate and preview the entry.
 *
 * Usage: pnpm make-entry <inspiration-id> <new-entry-id> [--awesome <checkout>] [--dry-run]
 * The awesome-list checkout is only used to look up the source video for reference frames.
 */
import {execFileSync, spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import {parse} from 'yaml';
import {readJson, root} from './lib';

const args = process.argv.slice(2);
const [inspirationId, entryId] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--awesome' && args[i - 1] !== '--direction');
const direction = args.includes('--direction') ? args[args.indexOf('--direction') + 1] : 'Follow the inspiration\'s genres and domains.';
const awesome = args.includes('--awesome') ? args[args.indexOf('--awesome') + 1] : undefined;
const dryRun = args.includes('--dry-run');
if (!inspirationId || !entryId) throw new Error('Usage: pnpm make-entry <inspiration-id> <new-entry-id> [--awesome <checkout>] [--dry-run]');
if (existsSync(path.join(root, 'entries', entryId))) throw new Error(`entries/${entryId} already exists`);

const record = readJson<{records: Array<Record<string, unknown>>}>(path.join(root, 'inspiration', 'inspiration.json')).records.find(r => r.id === inspirationId);
if (!record) throw new Error(`No inspiration record ${inspirationId}`);

// Reference frames: download the creator's video to .cache (gitignored) and grab 6 frames.
const refDir = path.join(root, '.cache', 'reference', entryId);
if (awesome && String(record.id).startsWith('ao-')) {
  const sourceId = String(record.id).slice(3);
  for (const file of readdirSync(path.join(awesome, 'data')).filter(f => f.endsWith('.yaml'))) {
    const doc = parse(readFileSync(path.join(awesome, 'data', file), 'utf8')) as {entries?: Array<{id: string; media?: {video?: string; duration?: number}}>};
    const hit = doc.entries?.find(e => e.id === sourceId);
    if (hit?.media?.video) {
      mkdirSync(refDir, {recursive: true});
      const video = path.join(refDir, 'source.mp4');
      if (!existsSync(video)) execFileSync('curl', ['-sSL', '-o', video, hit.media.video]);
      const duration = hit.media.duration ?? 10;
      for (let i = 0; i < 6; i++) execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(((i + 0.5) * duration) / 6), '-i', video, '-frames:v', '1', '-vf', 'scale=480:-1', path.join(refDir, `frame-${i}.jpg`)]);
      break;
    }
  }
}

const prompt = `${readFileSync(path.join(root, 'prompts', 'make-entry.md'), 'utf8')}\n\nENTRY_ID: ${entryId}\nINSPIRATION: ${JSON.stringify(record, null, 2)}\nREFERENCE FRAMES: ${existsSync(refDir) ? path.relative(root, refDir) : 'none'}\nDIRECTION: ${direction}\n`;
if (dryRun) {
  console.log(prompt);
  process.exit(0);
}
// The core entries in a sibling viralaunch-local checkout are the quality bar (read-only).
const core = path.join(root, '..', 'viralaunch-local', 'packages', 'remotion', 'library', 'entries');
const result = spawnSync('claude', ['-p', prompt, '--permission-mode', 'acceptEdits', ...(existsSync(core) ? ['--add-dir', core] : []), '--allowedTools', 'Read,Write,Edit,Glob,Grep,Bash(pnpm:*),Bash(npx:*),Bash(ffmpeg:*),Bash(ls:*)'], {cwd: root, stdio: 'inherit'});
process.exit(result.status ?? 1);
