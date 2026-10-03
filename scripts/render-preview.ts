/**
 * Renders previews/<id>.mp4 + previews/<id>.jpg from an entry's props.example.json.
 * Usage: pnpm preview <id> [<id>...] | --all [--aspect 16:9] [--changed]
 */
import {bundle} from '@remotion/bundler';
import {renderMedia, renderStill, selectComposition} from '@remotion/renderer';
import {copyFileSync, mkdirSync, existsSync, rmSync, statSync} from 'node:fs';
import path from 'node:path';
import {entryIds, entriesDir, exampleMedia, kitAliases, readExample, readMeta, root, writeEntryRoot, entryFiles, recordPreview} from './lib';

const args = process.argv.slice(2);
const aspectFlag = args.indexOf('--aspect');
const aspect = aspectFlag >= 0 ? args[aspectFlag + 1] : undefined;
const changedOnly = args.includes('--changed');
let ids = args.includes('--all') ? entryIds() : args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--aspect');
const out = path.join(root, 'previews');
mkdirSync(out, {recursive: true});

if (changedOnly) {
  ids = ids.filter(id => {
    const video = path.join(out, `${id}.mp4`);
    if (!existsSync(video)) return true;
    const newest = Math.max(...entryFiles(path.join(entriesDir, id)).map(f => statSync(path.join(entriesDir, id, f)).mtimeMs));
    return newest > statSync(video).mtimeMs;
  });
}

const browserExecutable = process.env.REMOTION_CHROMIUM ?? null;
let failures = 0;
for (const id of ids) {
  const meta = readMeta(id);
  if (meta.portable === false) {
    console.log(`skip ${id}: legacy entry renders only inside viralaunch-local`);
    continue;
  }
  const started = Date.now();
  try {
    const entryDir = path.join(entriesDir, id);
    const entryPoint = writeEntryRoot(entryDir, path.join(root, '.cache', 'roots', id));
    // Stage sample images referenced by the example into this entry's public dir.
    const publicDir = path.join(root, '.cache', 'public', id);
    rmSync(publicDir, {recursive: true, force: true});
    mkdirSync(publicDir, {recursive: true});
    for (const scene of readExample(id).scenes) if (scene.asset) copyFileSync(path.join(root, scene.asset), path.join(publicDir, path.basename(scene.asset)));
    const serveUrl = await bundle({
      entryPoint,
      publicDir,
      webpackOverride: config => ({
        ...config,
        resolve: {...config.resolve, alias: {...(config.resolve?.alias as object), ...kitAliases()}, modules: [path.join(root, 'node_modules'), 'node_modules']},
      }),
      onProgress: () => {},
      ignoreRegisterRootWarning: true,
    });
    const example = readExample(id);
    const inputProps = {media: exampleMedia(example, aspect ?? meta.aspects[0]), props: example.props};
    const composition = await selectComposition({serveUrl, id, inputProps, browserExecutable, chromiumOptions: {gl: 'swiftshader'}, timeoutInMilliseconds: 180000});
    const suffix = aspect ? `-${aspect.replace(':', 'x')}` : '';
    await renderMedia({composition, serveUrl, codec: 'h264', outputLocation: path.join(out, `${id}${suffix}.mp4`), inputProps, browserExecutable, chromiumOptions: {gl: 'swiftshader'}, timeoutInMilliseconds: 180000, concurrency: Number(process.env.PREVIEW_CONCURRENCY ?? 4), onBrowserLog: l => l.type === 'error' && console.error(`[${id}] ${l.text}`)});
    await renderStill({composition, serveUrl, frame: Math.floor(composition.durationInFrames * 0.4), output: path.join(out, `${id}${suffix}.jpg`), imageFormat: 'jpeg', inputProps, browserExecutable, chromiumOptions: {gl: 'swiftshader'}, timeoutInMilliseconds: 180000});
    if (!suffix) recordPreview(id);
    console.log(`ok   ${id}${suffix} (${composition.width}x${composition.height}, ${(composition.durationInFrames / composition.fps).toFixed(1)}s) in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } catch (e) {
    failures++;
    console.error(`FAIL ${id}: ${(e as Error).message}`);
  }
}
process.exit(failures ? 1 : 0);
