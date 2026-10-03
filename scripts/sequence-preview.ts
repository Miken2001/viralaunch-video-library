/**
 * Renders a multi-template sequence spec (examples/sequences/*.json) to out/sequences/<name>.mp4:
 * each segment renders silently through its own template, then the clips are cross-faded and a
 * single audio track is muxed — the same stitching ViraLaunch's renderer uses (kit/node/sequence).
 * Templates are looked up in this repo's entries/ and in CORE_DIR (default: the CLI's bundled
 * templates in ../viralaunch-local/packages/remotion/library/entries).
 * Usage: pnpm sequence-preview examples/sequences/malaria.json [--aspect 16:9]
 */
import {bundle} from '@remotion/bundler';
import {openBrowser, renderMedia, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import {copyFileSync, existsSync, mkdirSync, readFileSync, rmSync} from 'node:fs';
import path from 'node:path';
import {exampleMedia, kitAliases, root, writeEntryRoot, type Example} from './lib';
import {TRANSITION_SECONDS, muxArgs, segmentMedia, segmentSeconds, sequenceLook, stitchArgs, type SegmentSpec, type SequenceLook, type SequenceMedia, type Transition} from '../kit/node/sequence';

type Spec = Example & {accent?: string; look?: SequenceLook; transition?: Transition; segments: SegmentSpec[]};
const args = process.argv.slice(2);
const specFile = path.resolve(args[0] ?? '');
if (!existsSync(specFile)) throw new Error('Usage: pnpm sequence-preview <spec.json> [--aspect 16:9]');
const aspect = args.includes('--aspect') ? args[args.indexOf('--aspect') + 1] : undefined;
const spec = JSON.parse(readFileSync(specFile, 'utf8')) as Spec;
const name = path.basename(specFile, '.json') + (aspect ? `-${aspect.replace(':', 'x')}` : '');
const transition = spec.transition ?? 'light-leak-dissolve';
const dirs = [path.join(root, 'entries'), path.resolve(process.env.CORE_DIR ?? path.join(root, '..', 'viralaunch-local', 'packages', 'remotion', 'library', 'entries'))];
const entryDir = (id: string) => {
  const dir = dirs.map(d => path.join(d, id)).find(d => existsSync(path.join(d, 'meta.json')));
  if (!dir) throw new Error(`Template ${id} not found in ${dirs.join(', ')}`);
  return dir;
};

const work = path.join(root, '.cache', 'sequences', name);
rmSync(work, {recursive: true, force: true});
mkdirSync(path.join(work, 'public'), {recursive: true});
for (const s of spec.scenes) if (s.asset) copyFileSync(path.join(root, s.asset), path.join(work, 'public', path.basename(s.asset)));
const presetOf = (id: string) => (JSON.parse(readFileSync(path.join(entryDir(id), 'meta.json'), 'utf8')) as {lookPreset?: string}).lookPreset;
const look = sequenceLook(spec.segments, presetOf, spec.look);
console.log(`look: ${JSON.stringify(look)}`);
const media = {...exampleMedia(spec, aspect), ...(spec.accent ? {accent: spec.accent} : {}), look} as unknown as SequenceMedia;

const chromiumOptions = {gl: 'swiftshader' as const};
const browser = await openBrowser('chrome', {chromiumOptions});
const clips: string[] = [];
try {
  for (const [i, seg] of spec.segments.entries()) {
    const started = Date.now();
    const serveUrl = await bundle({outDir: path.join(work, `bundle-${i}`), entryPoint: writeEntryRoot(entryDir(seg.templateId), path.join(work, `root-${i}`)), publicDir: path.join(work, 'public'), ignoreRegisterRootWarning: true, onProgress: () => {}, webpackOverride: c => ({...c, resolve: {...c.resolve, alias: {...(c.resolve?.alias as object), ...kitAliases()}, modules: [path.join(root, 'node_modules'), 'node_modules']}})});
    const inputProps = {media: segmentMedia(media, seg, i, spec.segments.length, transition), props: seg.props};
    const composition = await selectComposition({serveUrl, id: seg.templateId, inputProps, chromiumOptions, puppeteerInstance: browser, timeoutInMilliseconds: 180000});
    const clip = path.join(work, `seg-${i}.mp4`);
    await renderMedia({composition, serveUrl, codec: 'h264', muted: true, outputLocation: clip, inputProps, chromiumOptions, puppeteerInstance: browser, concurrency: Number(process.env.PREVIEW_CONCURRENCY ?? 3), timeoutInMilliseconds: 180000});
    clips.push(clip);
    console.log(`segment ${i + 1}/${spec.segments.length} ${seg.templateId} (${seg.role}) in ${((Date.now() - started) / 1000).toFixed(0)}s`);
  }
} finally {
  await browser.close({silent: true});
}
const lengths = segmentSeconds(media, spec.segments);
const total = lengths.reduce((a, b) => a + b, 0);
const video = path.join(work, 'video.mp4');
execFileSync('ffmpeg', ['-loglevel', 'error', ...stitchArgs(clips, lengths, transition, video)]);
mkdirSync(path.join(root, 'out', 'sequences'), {recursive: true});
const out = path.join(root, 'out', 'sequences', `${name}.mp4`);
execFileSync('ffmpeg', ['-loglevel', 'error', ...muxArgs(video, [], undefined, 0, total, out)]);
console.log(`wrote ${path.relative(root, out)} (${total.toFixed(1)}s, ${spec.segments.length} segments)`);
if (args.includes('--cuts')) {
  // Continuity QA: frames just before and after every cut, side by side, one row per cut.
  let at = 0;
  const times = lengths.slice(0, -1).flatMap(l => {
    at += l;
    return [at - 0.35, at + TRANSITION_SECONDS[transition] + 0.35];
  });
  const frames = times.map((t, i) => {
    const f = path.join(work, `cut-${i}.png`);
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', t.toFixed(2), '-i', out, '-frames:v', '1', '-vf', 'scale=360:-2', f]);
    return f;
  });
  const sheet = path.join(root, 'out', 'sequences', `${name}-cuts.png`);
  const rows = frames.length / 2;
  const filter = Array.from({length: rows}, (_, r) => `[${2 * r}][${2 * r + 1}]hstack=inputs=2[r${r}]`).join(';') + (rows > 1 ? `;${Array.from({length: rows}, (_, r) => `[r${r}]`).join('')}vstack=inputs=${rows}[out]` : ';[r0]null[out]');
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...frames.flatMap(f => ['-i', f]), '-filter_complex', filter, '-map', '[out]', '-frames:v', '1', sheet]);
  console.log(`wrote ${path.relative(root, sheet)} (before | after, one row per cut)`);
}
