/**
 * Fast design QA: renders N evenly spaced stills of an entry (from props.example.json) into
 * one contact strip, out/sheets/<id>[-aspect].jpg. Much faster than a full preview.
 * Usage: pnpm still-sheet <id> [--aspect 16:9] [--frames 6]
 */
import {bundle} from '@remotion/bundler';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import {copyFileSync, mkdirSync, rmSync} from 'node:fs';
import path from 'node:path';
import {entriesDir, exampleMedia, kitAliases, readExample, readMeta, root, writeEntryRoot} from './lib';

const args = process.argv.slice(2);
const id = args[0];
const aspect = args.includes('--aspect') ? args[args.indexOf('--aspect') + 1] : undefined;
const count = args.includes('--frames') ? Number(args[args.indexOf('--frames') + 1]) : 6;
// --look <preset>: render as a segment of a multi-template sequence (shared look, kit captions).
const look = args.includes('--look') ? args[args.indexOf('--look') + 1] : undefined;
const meta = readMeta(id);
const example = readExample(id);
const publicDir = path.join(root, '.cache', 'public', id);
rmSync(publicDir, {recursive: true, force: true});
mkdirSync(publicDir, {recursive: true});
for (const s of example.scenes) if (s.asset) copyFileSync(path.join(root, s.asset), path.join(publicDir, path.basename(s.asset)));
const serveUrl = await bundle({entryPoint: writeEntryRoot(path.join(entriesDir, id), path.join(root, '.cache', 'roots', id)), publicDir, ignoreRegisterRootWarning: true, onProgress: () => {}, webpackOverride: c => ({...c, resolve: {...c.resolve, alias: {...(c.resolve?.alias as object), ...kitAliases()}, modules: [path.join(root, 'node_modules'), 'node_modules']}})});
const inputProps = {media: {...exampleMedia(example, aspect ?? meta.aspects[0]), ...(look ? {look: {preset: look}} : {})}, props: example.props};
const chromiumOptions = {gl: 'swiftshader' as const};
const browser = await openBrowser('chrome', {chromiumOptions});
const composition = await selectComposition({serveUrl, id, inputProps, chromiumOptions, puppeteerInstance: browser, timeoutInMilliseconds: 180000});
const out = path.join(root, 'out', 'sheets');
mkdirSync(out, {recursive: true});
const files: string[] = [];
for (let i = 0; i < count; i++) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(((i + 0.5) / count) * composition.durationInFrames));
  const file = path.join(out, `${id}-f${frame}.jpg`);
  await renderStill({composition, serveUrl, frame, output: file, imageFormat: 'jpeg', inputProps, chromiumOptions, puppeteerInstance: browser, timeoutInMilliseconds: 180000});
  files.push(file);
}
await browser.close({silent: true});
const h = composition.width > composition.height ? 360 : 640;
const target = path.join(out, `${id}${aspect ? '-' + aspect.replace(':', 'x') : ''}${look ? '-look-' + look : ''}.jpg`);
execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...files.flatMap(f => ['-i', f]), '-filter_complex', `${files.map((_, i) => `[${i}]scale=-1:${h}[v${i}]`).join(';')};${files.map((_, i) => `[v${i}]`).join('')}hstack=${files.length}`, target]);
for (const f of files) rmSync(f);
console.log(`wrote ${path.relative(root, target)} (${composition.width}x${composition.height}, ${(composition.durationInFrames / composition.fps).toFixed(1)}s)`);
