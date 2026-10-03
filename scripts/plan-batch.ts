/**
 * Picks the next batch of inspiration records to turn into entries, for COVERAGE: each pick
 * goes to the thinnest (domain, genre) area of the library (free + core), so the library grows
 * toward "a good template for any subject" instead of more product launches.
 *
 * Writes batches/batch-NN.json: [{inspirationId, entryId, direction}], for review before
 * `pnpm make-batch NN`.
 * Usage: pnpm plan-batch [--size 10] [--core <entries dir>]
 */
import {existsSync, mkdirSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {entryIds, readJson, readMeta, root} from './lib';

type Rec = {id: string; collection: string; category: string; title: string; description: string; genres: string[]; domains: string[]; inputs: string[] | null; metrics: {views?: number} | null; libraryEntries: string[]};
type Pick = {inspirationId: string; entryId: string; direction: string; target: {domain: string; genre: string}};

const args = process.argv.slice(2);
const size = args.includes('--size') ? Number(args[args.indexOf('--size') + 1]) : 10;
const coreDir = args.includes('--core') ? args[args.indexOf('--core') + 1] : path.join(root, '..', 'viralaunch-local', 'packages', 'remotion', 'library', 'entries');
const batchesDir = path.join(root, 'batches');
mkdirSync(batchesDir, {recursive: true});

// What the library already covers (free + core + earlier planned batches).
const metas = [
  ...entryIds().map(id => readMeta(id)),
  ...(existsSync(coreDir) ? readdirSync(coreDir).filter(d => existsSync(path.join(coreDir, d, 'meta.json'))).map(d => readJson<{genres: string[]; domains: string[]}>(path.join(coreDir, d, 'meta.json'))) : []),
];
const planned = readdirSync(batchesDir).filter(f => /^batch-\d+\.json$/.test(f)).flatMap(f => readJson<Pick[]>(path.join(batchesDir, f)));
const count = new Map<string, number>();
const bump = (k: string) => count.set(k, (count.get(k) ?? 0) + 1);
for (const m of metas) for (const d of m.domains) for (const g of m.genres) bump(`${d}|${g}`), bump(`d:${d}`), bump(`g:${g}`);
for (const p of planned) bump(`${p.target.domain}|${p.target.genre}`), bump(`d:${p.target.domain}`), bump(`g:${p.target.genre}`);

// Subjects a general-purpose library must serve (marketing is only one of them).
const DOMAINS = ['history', 'science', 'geography', 'space', 'nature', 'health', 'finance', 'sports', 'education', 'culture-entertainment', 'religion-myth', 'tech', 'business'];
// How useful each genre is to a narrated-video library (music-driven formats need a pipeline
// we do not have; marketing is covered by the core templates).
const GENRE_WEIGHT: Record<string, number> = {documentary: 1, timeline: 1, 'map-journey': 1, 'data-story': 1, explainer: 1, listicle: 0.95, comparison: 0.95, 'news-recap': 0.9, tutorial: 0.85, 'quote-kinetic': 0.7, 'story-narrative': 0.7, 'meme-reaction': 0.45, showreel: 0.4, 'product-demo': 0.4, 'product-launch': 0.35, 'music-visual': 0.15};
// Titles naming real people, songs or brands make poor generic templates (and IP trouble).
const RISKY = /\b(rick astley|taylor|disney|pokemon|marvel|nintendo|apple|tesla|nike|spotify|netflix|mrbeast|elon|trump|biden)\b/i;
const KEYWORDS: Record<string, RegExp> = {
  history: /\b(history|historic|century|ancient|empire|war|dynasty|era|period|1[0-9]{3}|independence|civilization)\b/i,
  geography: /\b(map|country|countries|city|cities|border|travel|region|continent|morocco|colombia|japan|france|world)\b/i,
  science: /\b(physics|chemistry|biology|cell|atom|experiment|science|scientific|simulation|evolution|dinosaur)\b/i,
  space: /\b(space|planet|galaxy|star|orbit|moon|mars|nasa|rocket|cosmos|meteor)\b/i,
  nature: /\b(animal|ocean|forest|climate|weather|rain|plant|wildlife|earth)\b/i,
  finance: /\b(money|stock|market|price|bitcoin|crypto|economy|finance|invest)\b/i,
  sports: /\b(match|football|soccer|nba|team|player|olympic|sport|race)\b/i,
  health: /\b(health|medical|medicine|disease|fitness|nutrition|brain|body)\b/i,
  education: /\b(learn|lesson|course|explain|tutorial|study|school|math)\b/i,
  'culture-entertainment': /\b(film|movie|music|game|gaming|anime|art|culture|celebrity|news)\b/i,
};
const guessDomains = (text: string) => Object.entries(KEYWORDS).filter(([, re]) => re.test(text)).map(([d]) => d);
const MARKETING = new Set(['product-launch', 'product-demo', 'showreel']);

const records = readJson<{records: Rec[]}>(path.join(root, 'inspiration', 'inspiration.json')).records;
const used = new Set([...records.filter(r => r.libraryEntries.length).map(r => r.id), ...planned.map(p => p.inspirationId)]);
const words = (t: string) => new Set(t.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 3));
const similar = (a: string, b: string) => {
  const [x, y] = [words(a), words(b)];
  const inter = [...x].filter(w => y.has(w)).length;
  return inter / Math.max(1, Math.min(x.size, y.size)) > 0.6;
};
// Visual ideas that need a pipeline we do not have (live footage, generated video, music
// production) are poor template sources.
const usable = (r: Rec) => !(r.inputs ?? []).some(i => ['reference-video', 'footage', 'music'].includes(i)) && r.title.length > 0 && !RISKY.test(`${r.title} ${r.description}`);

const picks: Pick[] = [];
const takenTitles = planned.map(p => records.find(r => r.id === p.inspirationId)?.title ?? '');
const existingIds = new Set([...entryIds(), ...planned.map(p => p.entryId)]);
for (let n = 0; n < size; n++) {
  // The thinnest target cell: favour uncovered domains, then uncovered genres.
  let best: {score: number; rec: Rec; domain: string; genre: string} | undefined;
  for (const rec of records) {
    if (used.has(rec.id) || !usable(rec) || takenTitles.some(t => similar(t, rec.title))) continue;
    const recDomains = [...new Set([...guessDomains(`${rec.title} ${rec.description}`), ...rec.domains.filter(d => d !== 'generic')])];
    // A marketing record can be re-aimed at any subject (its visual idea is what we reuse);
    // anything else stays on what it is actually about.
    const marketing = rec.genres.length > 0 && rec.genres.every(g => MARKETING.has(g));
    const domains = marketing ? DOMAINS : recDomains.length ? recDomains : ['generic'];
    const genres = rec.genres.length ? rec.genres : ['explainer'];
    for (const domain of domains) {
      for (const genre of genres) {
        const thin = 1 / (1 + (count.get(`${domain}|${genre}`) ?? 0)) + 0.6 / (1 + (count.get(`d:${domain}`) ?? 0)) + 0.4 / (1 + (count.get(`g:${genre}`) ?? 0));
        const native = recDomains.includes(domain) ? 0.25 : 0;
        const popularity = Math.log10(1 + (rec.metrics?.views ?? 0)) / 40;
        const score = (thin + native + popularity) * (GENRE_WEIGHT[genre] ?? 0.5);
        if (!best || score > best.score) best = {score, rec, domain, genre};
      }
    }
  }
  if (!best) break;
  const {rec, domain, genre} = best;
  used.add(rec.id);
  takenTitles.push(rec.title);
  bump(`${domain}|${genre}`), bump(`d:${domain}`), bump(`g:${genre}`);
  let entryId = `${genre.replace(/-(narrative|kinetic|recap|story|journey)$/, '')}-${rec.title.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(w => w.length > 2 && !['the', 'and', 'with', 'for', 'video', 'claude', 'opus'].includes(w)).slice(0, 2).join('-')}`.replace(/-+$/, '').slice(0, 40);
  for (let i = 2; existingIds.has(entryId); i++) entryId = `${entryId.replace(/-\d+$/, '')}-${i}`;
  existingIds.add(entryId);
  const direction = `Primary subject domain: ${domain}. Genre: ${genre}. ${MARKETING.has(genre) ? 'A product/brand video template (native placement).' : `Make it a template for ${domain} ${genre} content; reuse the inspiration's visual idea, not its product subject.`} Must work with narration and as one segment of a multi-template video.`;
  picks.push({inspirationId: rec.id, entryId, direction, target: {domain, genre}});
}

const nn = String(readdirSync(batchesDir).filter(f => /^batch-\d+\.json$/.test(f)).length + 1).padStart(2, '0');
const file = path.join(batchesDir, `batch-${nn}.json`);
writeFileSync(file, JSON.stringify(picks, null, 2) + '\n');
console.log(`wrote ${path.relative(root, file)} (${picks.length} picks)`);
for (const p of picks) console.log(`  ${p.entryId.padEnd(36)} ${(p.target.domain + '/' + p.target.genre).padEnd(30)} ← ${records.find(r => r.id === p.inspirationId)?.title}`);
