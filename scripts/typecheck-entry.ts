/**
 * Typechecks the kit plus ONE entry, so parallel make-entry sessions are not failed by a
 * sibling's half-written draft (the repo-wide `pnpm typecheck` stays the CI gate).
 * Usage: pnpm typecheck-entry <id>
 */
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {root} from './lib';

const id = process.argv[2];
if (!id || !existsSync(path.join(root, 'entries', id, 'src'))) throw new Error('Usage: pnpm typecheck-entry <id> (entries/<id>/src must exist)');
const dir = path.join(root, '.cache');
mkdirSync(dir, {recursive: true});
const config = path.join(dir, `tsconfig.${id}.json`);
writeFileSync(config, JSON.stringify({extends: '../tsconfig.json', compilerOptions: {baseUrl: '..'}, include: ['../kit/src', '../kit/node', `../entries/${id}/src`]}, null, 2));
const result = spawnSync('npx', ['tsc', '-p', config], {cwd: root, stdio: 'inherit'});
process.exit(result.status ?? 1);
