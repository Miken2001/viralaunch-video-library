/**
 * The gate every entry passes — ours and community PRs alike.
 * Usage: pnpm validate [<id>...]
 *
 * Checks: meta.json schema; required files; id/dir/defineEntry agreement; import allow-list;
 * no network, no nondeterminism; example props validate against the entry's own schema;
 * size budget; brief.md structure.
 */
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {existsSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {MediaSchema} from '../kit/src/index';
import {entriesDir, entryFiles, entryIds, exampleMedia, readExample, readJson, readMeta, root, type Meta} from './lib';

const ajv = new Ajv({allErrors: true});
addFormats(ajv);
const validateMeta = ajv.compile(readJson(path.join(root, 'schema', 'entry-meta.schema.json')));

const BASE_IMPORTS = new Set(['react', 'remotion', 'zod', '@viralaunch/kit']);
const MAX_ENTRY_BYTES = 2 * 1024 * 1024;
const FORBIDDEN: Array<[RegExp, string]> = [
  [/['"`]https?:\/\//, 'remote URL literal (entries must render offline; assets come in through media)'],
  [/\bfetch\s*\(/, 'fetch() — entries may not do network I/O'],
  [/\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b/, 'network API'],
  [/\bimport\s*\(/, 'dynamic import()'],
  [/\bMath\.random\s*\(/, "Math.random() — use remotion's random(seed) so renders are deterministic"],
  [/\bDate\.now\s*\(|new Date\(\s*\)/, 'wall-clock time — renders must be deterministic'],
  [/@remotion\/google-fonts/, '@remotion/google-fonts downloads at render time; bundle a local font instead'],
  [/\beval\s*\(|new Function\s*\(/, 'eval / new Function'],
  [/\bprocess\.env\b|\brequire\s*\(/, 'node APIs in browser code'],
];

export async function validateEntry(id: string): Promise<string[]> {
  const errors: string[] = [];
  const dir = path.join(entriesDir, id);
  const meta = readMeta(id) as Meta;
  if (!validateMeta(meta)) errors.push(...(validateMeta.errors ?? []).map(e => `meta.json${e.instancePath} ${e.message}`));
  if (meta.id !== id) errors.push(`meta.id "${meta.id}" must equal the directory name`);
  if (meta.durationSeconds.min > meta.durationSeconds.max) errors.push('durationSeconds.min > max');
  for (const f of ['brief.md', 'props.example.json', 'src/schema.ts']) if (!existsSync(path.join(dir, f))) errors.push(`missing ${f}`);
  const indexFile = ['src/index.tsx', 'src/index.ts'].find(f => existsSync(path.join(dir, f)));
  if (!indexFile) errors.push('missing src/index.tsx');

  const brief = existsSync(path.join(dir, 'brief.md')) ? readFileSync(path.join(dir, 'brief.md'), 'utf8') : '';
  for (const heading of ['**Use it for:**', '## Filling the props']) if (!brief.includes(heading)) errors.push(`brief.md must contain "${heading}"`);
  if (meta.adWeave.some(m => m !== 'native-integrated') && !/AdWeave/.test(readSources(dir).map(s => s.code).join('\n')) && meta.portable !== false) {
    errors.push('entry supports non-native adWeave modes but never renders <AdWeave>');
  }

  const bytes = entryFiles(dir).reduce((n, f) => n + statSync(path.join(dir, f)).size, 0);
  if (bytes > MAX_ENTRY_BYTES) errors.push(`entry is ${(bytes / 1048576).toFixed(1)} MB; the budget is 2 MB (previews are released separately)`);

  if (meta.portable !== false) {
    const allowed = new Set([...BASE_IMPORTS, ...(meta.remotionPackages ?? [])]);
    for (const {file, code} of readSources(dir)) {
      for (const m of code.matchAll(/\bfrom\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm)) {
        const spec = m[1] ?? m[2];
        if (spec.startsWith('./') || spec.startsWith('../')) {
          const resolved = path.resolve(path.dirname(path.join(dir, file)), spec);
          if (!resolved.startsWith(dir + path.sep)) errors.push(`${file}: import "${spec}" leaves the entry directory`);
          continue;
        }
        const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
        if (!allowed.has(pkg) && !(pkg === '@viralaunch/kit' || spec === '@viralaunch/kit/fx')) errors.push(`${file}: import "${spec}" is not allowed (declare @remotion/* packages in meta.remotionPackages)`);
      }
      const stripped = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      for (const [re, why] of FORBIDDEN) if (re.test(stripped)) errors.push(`${file}: ${why}`);
    }
    if (indexFile) {
      const source = readFileSync(path.join(dir, indexFile), 'utf8');
      if (!new RegExp(`defineEntry\\(\\{\\s*id:\\s*['"]${id}['"]`).test(source)) errors.push(`${indexFile} must end with defineEntry({id: '${id}', ...})`);
    }
    try {
      const {Props} = (await import(pathToFileURL(path.join(dir, 'src', 'schema.ts')).href)) as {Props?: {safeParse: (v: unknown) => {success: boolean; error?: {message: string}}}};
      if (!Props) errors.push('src/schema.ts must export `Props` (a zod schema)');
      else {
        const example = readExample(id);
        // ViraLaunch's offline guard rejects any non-empty field whose key ends in "url".
        const urlKeys: string[] = [];
        const walk = (v: unknown, at: string) => {
          if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}[${i}]`));
          else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (k.toLowerCase().endsWith('url')) urlKeys.push(`${at}.${k}`); walk(x, `${at}.${k}`); }
        };
        walk(example.props, 'props');
        if (urlKeys.length) errors.push(`prop keys must not end in "url" (rejected at render time): ${urlKeys.join(', ')}`);
        const parsed = Props.safeParse(example.props);
        if (!parsed.success) errors.push(`props.example.json does not match Props: ${parsed.error?.message}`);
        for (const aspect of meta.aspects) {
          const media = MediaSchema.safeParse(exampleMedia(example, aspect));
          if (!media.success) errors.push(`example media invalid for ${aspect}: ${media.error.message}`);
        }
        for (const sc of example.scenes) if (sc.asset && !existsSync(path.join(root, sc.asset))) errors.push(`props.example.json: missing sample asset ${sc.asset}`);
        const seconds = example.scenes.reduce((n, s) => n + s.durationSeconds, 0);
        if (seconds < meta.durationSeconds.min || seconds > meta.durationSeconds.max) errors.push(`example runs ${seconds}s, outside durationSeconds ${meta.durationSeconds.min}-${meta.durationSeconds.max}`);
      }
    } catch (e) {
      errors.push(`src/schema.ts failed to load: ${(e as Error).message}`);
    }
  }
  return errors;
}

function readSources(dir: string) {
  return entryFiles(dir)
    .filter(f => f.startsWith('src/') && /\.(tsx?|jsx?)$/.test(f))
    .map(file => ({file, code: readFileSync(path.join(dir, file), 'utf8')}));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : entryIds();
  let failed = 0;
  for (const id of ids) {
    const errors = await validateEntry(id);
    if (errors.length) {
      failed++;
      console.error(`FAIL ${id}\n  - ${errors.join('\n  - ')}`);
    } else console.log(`ok   ${id}`);
  }
  console.log(`${ids.length - failed}/${ids.length} entries valid`);
  process.exit(failed ? 1 : 0);
}
