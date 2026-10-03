/**
 * Copies the shared runtime of the library into a viralaunch-local checkout so the CLI renders
 * free library entries exactly like this repo does:
 *   kit/src (incl. the premium fx layer), kit/node (sequence stitching), taxonomy.json, the free catalog (index/index.json →
 *   remote-index.json), inspiration.json and the entry meta schema.
 * The CLI's own bundled templates live in viralaunch-local (packages/remotion/library/entries)
 * and are never touched here.
 * Usage: pnpm sync-kit [path-to-viralaunch-local]   (default ../viralaunch-local)
 */
import {cpSync, existsSync, mkdirSync, rmSync} from 'node:fs';
import path from 'node:path';
import {root} from './lib';

const target = path.resolve(process.argv[2] ?? path.join(root, '..', 'viralaunch-local'));
if (!existsSync(path.join(target, 'packages', 'remotion'))) throw new Error(`${target} is not a viralaunch-local checkout`);
const library = path.join(target, 'packages', 'remotion', 'library');
mkdirSync(library, {recursive: true});
rmSync(path.join(library, 'kit'), {recursive: true, force: true});
cpSync(path.join(root, 'kit', 'src'), path.join(library, 'kit', 'src'), {recursive: true});
cpSync(path.join(root, 'kit', 'node'), path.join(library, 'kit', 'node'), {recursive: true});
for (const [from, to] of [
  ['taxonomy.json', 'taxonomy.json'],
  ['index/index.json', 'remote-index.json'],
  ['inspiration/inspiration.json', 'inspiration.json'],
  ['schema/entry-meta.schema.json', 'entry-meta.schema.json'],
]) cpSync(path.join(root, from), path.join(library, to));
console.log(`synced kit + catalog into ${path.relative(process.cwd(), library)}`);
console.log('Next: in viralaunch-local run `npx tsx scripts/export-domain-contracts.ts` and `pnpm renderer:pack`.');
