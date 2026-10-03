/**
 * Scaffolds entries/<id>/ with meta.json (status draft, location remote), a schema, a component
 * skeleton wired to the kit, an example and a brief outline. Usage: pnpm new-entry <id> "<Name>"
 */
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {entriesDir} from './lib';

const [id, name = id] = process.argv.slice(2);
if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error('Usage: pnpm new-entry <kebab-id> "<Name>"');
const dir = path.join(entriesDir, id);
if (existsSync(dir)) throw new Error(`${id} already exists`);
mkdirSync(path.join(dir, 'src'), {recursive: true});
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
writeFileSync(path.join(dir, 'meta.json'), json({schemaVersion: 1, id, name, version: '0.1.0', summary: 'TODO: one sentence an agent reads to decide whether this fits.', genres: ['explainer'], domains: ['generic'], adWeave: ['end-card', 'sponsor-mention', 'none-pure-brand'], techniques: ['kinetic-type'], aspects: ['9:16'], durationSeconds: {min: 8, max: 90}, tiers: ['fill', 'fork'], minModel: 'small', renderCost: 'low', requires: [], location: 'remote', source: 'original', inspiredBy: [], license: 'MIT', status: 'draft'}));
writeFileSync(path.join(dir, 'src', 'schema.ts'), `import {z} from 'zod';\n\nexport const Props = z.object({\n  title: z.string().min(1).max(80),\n});\n\nexport type Props = z.infer<typeof Props>;\n`);
writeFileSync(path.join(dir, 'src', 'index.tsx'), `import React from 'react';\nimport {AbsoluteFill, Sequence} from 'remotion';\nimport {AdWeave, Captions, NarrationTrack, defineEntry, useSceneTimeline, type EntryProps} from '@viralaunch/kit';\nimport {Props} from './schema';\n\nconst Entry: React.FC<EntryProps<Props>> = ({media, props}) => {\n  const timeline = useSceneTimeline(media);\n  return (\n    <AbsoluteFill style={{background: '#111'}}>\n      {timeline.map(t => (\n        <Sequence key={t.index} from={t.from} durationInFrames={t.durationInFrames}>\n          <AbsoluteFill style={{justifyContent: 'flex-end', padding: '0 7% 14%'}}>\n            <Captions scene={t.scene} />\n          </AbsoluteFill>\n        </Sequence>\n      ))}\n      <NarrationTrack media={media} />\n      <AdWeave media={media} />\n    </AbsoluteFill>\n  );\n};\n\nexport default defineEntry({id: '${id}', schema: Props, component: Entry});\n`);
writeFileSync(path.join(dir, 'props.example.json'), json({media: {adWeave: 'end-card', brand: {name: 'Example Co'}}, scenes: [{text: 'TODO narration scene one.', durationSeconds: 4}, {text: 'TODO narration scene two.', durationSeconds: 4}], props: {title: 'TODO'}}));
writeFileSync(path.join(dir, 'brief.md'), `# ${name}\n\n**Use it for:** TODO\n\n**Do not use it for:** TODO\n\n## How it looks\nTODO\n\n## Filling the props (fill tier)\nTODO\n\n## Product placement\nTODO\n\n## Forking ideas\nTODO\n`);
console.log(`created entries/${id} — edit it, then: pnpm validate ${id} && pnpm preview ${id}`);
