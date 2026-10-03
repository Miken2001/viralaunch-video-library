/**
 * Builds inspiration/inspiration.json — a searchable index of third-party example videos
 * that do NOT ship code. Each record links to the creator's original post.
 *
 * What we copy and why it is allowed:
 *  - awesome-opus-5.5-video-prompts: titles + descriptions are the curator's work under
 *    CC BY 4.0 (attributed below). Prompts, videos and thumbnails belong to their creators
 *    and are NOT copied: no prompt text, no media URLs. Only the post link + public metrics.
 *  - remotion.dev/prompts: only title, author handle and model name (facts), plus the link.
 *
 * Usage: pnpm inspiration <path-to-awesome-opus-5.5-video-prompts checkout>
 */
import {readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {parse} from 'yaml';
import {readJson, root} from './lib';

const checkout = process.argv[2];
if (!checkout) throw new Error('Pass the path to a checkout of github.com/Li-Evan/awesome-opus-5.5-video-prompts');

const CATEGORY_GENRES: Record<string, string[]> = {
  launch: ['product-launch', 'product-demo'],
  showreel: ['showreel'],
  story: ['story-narrative'],
  explainer: ['explainer'],
  history: ['documentary', 'timeline'],
  music: ['music-visual'],
  self: ['showreel', 'quote-kinetic'],
  worlds: ['showreel'],
  remix: ['meme-reaction', 'showreel'],
};

// Keyword → domain. Order matters only for readability; every match is kept.
const DOMAIN_WORDS: Array<[string, RegExp]> = [
  ['history', /\b(histor|ancient|empire|war|battle|dynasty|medieval|civiliz|revolution|century|pharaoh|roman|napoleon|ww[12i]|archae)/i],
  ['geography', /\b(map|country|countries|city|cities|border|geograph|travel|route|continent|population|flight|island)/i],
  ['space', /\b(space|planet|galax|cosmo|orbit|solar|nasa|rocket|astronom|universe|black hole|star\b|moon|mars)/i],
  ['science', /\b(physic|chemi|biolog|science|quantum|atom|molecul|cell|evolution|neuro|math|equation|fourier|entropy)/i],
  ['tech', /\b(ai\b|app\b|software|code|coding|startup|saas|api|llm|agent|gpu|chip|robot|claude|gpt|model|developer|terminal|browser|web)/i],
  ['finance', /\b(stock|financ|crypto|bitcoin|market|invest|econom|money|price|inflation|bank|trading)/i],
  ['sports', /\b(sport|football|soccer|nba|basketball|tennis|f1\b|formula 1|olympic|match|athlet|run\b|running|marathon)/i],
  ['religion-myth', /\b(religio|myth|god|gods|bible|buddh|islam|church|temple|legend)/i],
  ['culture-entertainment', /\b(film|movie|music|song|album|game|gaming|anime|celebrit|tv\b|series|meme|lyric)/i],
  ['nature', /\b(animal|nature|ocean|forest|climate|weather|bird|wildlife|plant|earthquake|volcano)/i],
  ['health', /\b(health|fitness|nutrition|medic|sleep|workout|mental)/i],
  ['education', /\b(learn|teach|lesson|explain|tutorial|how to|course|student)/i],
  ['business', /\b(brand|marketing|business|company|sales|pitch|ceo|product hunt|launch)/i],
];

function domainsFor(text: string): string[] {
  const hits = DOMAIN_WORDS.filter(([, re]) => re.test(text)).map(([d]) => d);
  return hits.length ? hits.slice(0, 4) : ['generic'];
}

type AwesomeEntry = {
  id: string; title: string; url: string; author: string; author_name?: string; date?: string; description?: string;
  kind?: string; tools?: string[]; inputs?: string[]; metrics?: {bookmarks?: number; likes?: number; views?: number};
  media?: {duration?: number; width?: number; height?: number};
};

const records: Array<Record<string, unknown>> = [];
for (const file of readdirSync(path.join(checkout, 'data')).filter(f => f.endsWith('.yaml')).sort()) {
  const category = file.replace(/\.yaml$/, '');
  if (!CATEGORY_GENRES[category]) continue;
  const doc = parse(readFileSync(path.join(checkout, 'data', file), 'utf8')) as {entries?: AwesomeEntry[]};
  for (const e of doc.entries ?? []) {
    const text = `${e.title} ${e.description ?? ''}`;
    const aspect = e.media?.width && e.media?.height ? (e.media.width > e.media.height ? '16:9' : e.media.width < e.media.height ? '9:16' : '1:1') : undefined;
    records.push({
      id: `ao-${e.id}`,
      collection: 'awesome-opus-5.5-video-prompts',
      category,
      title: e.title,
      description: e.description ?? '',
      url: e.url,
      author: e.author,
      date: e.date,
      genres: CATEGORY_GENRES[category],
      domains: domainsFor(text),
      kind: e.kind,
      tools: e.tools ?? [],
      inputs: e.inputs ?? [],
      durationSeconds: e.media?.duration ? Math.round(e.media.duration) : undefined,
      aspect,
      metrics: {views: e.metrics?.views ?? 0, likes: e.metrics?.likes ?? 0, bookmarks: e.metrics?.bookmarks ?? 0},
      hasCode: false,
      libraryEntries: [] as string[],
    });
  }
}

const remotion = readJson<{entries: Array<{slug: string; title: string; author: string | null; model: string | null}>}>(path.join(root, 'inspiration', 'sources', 'remotion-prompts.json'));
for (const e of remotion.entries) {
  records.push({
    id: `rp-${e.slug}`,
    collection: 'remotion-prompts',
    category: 'remotion-showcase',
    title: e.title,
    description: '',
    url: `https://www.remotion.dev/prompts/${e.slug}`,
    author: e.author ?? undefined,
    genres: [],
    domains: domainsFor(e.title),
    tools: ['remotion'],
    model: e.model ?? undefined,
    hasCode: false,
    libraryEntries: [] as string[],
  });
}

// Link inspiration records to library entries recreated from them.
const libraryIndex = readJson<{entries: Array<{id: string; inspiredBy?: Array<{inspirationId?: string}>}>}>(path.join(root, 'index', 'index.json'));
for (const entry of libraryIndex.entries) {
  for (const ref of entry.inspiredBy ?? []) {
    const record = records.find(r => r.id === ref.inspirationId);
    if (record) {
      (record.libraryEntries as string[]).push(entry.id);
      record.hasCode = true;
    }
  }
}

records.sort((a, b) => ((b.metrics as {views?: number})?.views ?? 0) - ((a.metrics as {views?: number})?.views ?? 0));
const output = {
  version: 1,
  attribution: {
    'awesome-opus-5.5-video-prompts': 'Titles and descriptions from "Awesome Opus 5.5 Video Prompts" by Li-Evan (https://github.com/Li-Evan/awesome-opus-5.5-video-prompts), CC BY 4.0. Prompts, videos and thumbnails belong to their creators and are not reproduced here; follow each url.',
    'remotion-prompts': 'Titles and author handles from https://www.remotion.dev/prompts. Prompts and videos are not reproduced; follow each url.',
  },
  count: records.length,
  records,
};
writeFileSync(path.join(root, 'inspiration', 'inspiration.json'), JSON.stringify(output, null, 1) + '\n');
console.log(`inspiration.json: ${records.length} records`);
