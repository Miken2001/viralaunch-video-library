/**
 * Builds inspiration/inspiration.json — a searchable index of third-party example videos
 * that do NOT ship code. Each record links to the creator's original post.
 *
 * What we copy and why it is allowed:
 *  - awesome-opus-5.5-video-prompts: titles + descriptions are the curator's work under
 *    CC BY 4.0 (attributed below). Prompts, videos and thumbnails belong to their creators
 *    and are NOT copied: no prompt text, no media URLs. Only the post link + public metrics.
 *  - remotion.dev/prompts: only title, author handle and model name (facts), plus the link.
 *  - awesome-opus5-5-videos (skillry.dev): only facts — author handle, post link, Skillry page
 *    link, category, tech tags and date. The prompt is read locally to infer genres/domains
 *    and is NOT stored; posts already indexed from the first list are skipped.
 *
 * Usage: pnpm inspiration <awesome-opus-5.5-video-prompts checkout> [<awesome-opus5-5-videos checkout>]
 * (the second defaults to .cache/skillry when that exists)
 */
import {existsSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
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

// Second curated list. It has no titles, so the record carries a neutral label; genres come
// from keywords in the creator's brief, falling back to the list's own category.
const skillry = process.argv[3] ?? path.join(root, '.cache', 'skillry');
const SKILLRY_LABEL: Record<string, string> = {explainer: 'Explainer', motion: 'Motion graphics', '3d': '3D scene'};
const SKILLRY_FALLBACK: Record<string, string[]> = {explainer: ['explainer'], motion: ['showreel'], '3d': ['showreel']};
const GENRE_WORDS: Array<[string, RegExp]> = [
  ['timeline', /\b(timeline|chronolog|through the (years|ages|decades)|evolution of|history of|era[s]?\b)/i],
  ['map-journey', /\b(map|route|journey across|fly ?over|globe|countries|itinerary)/i],
  ['data-story', /\b(charts?\b|graphs?\b|data ?vi[sz]|statistic|bar race|infographic|percentages?\b)/i],
  ['listicle', /\b(top \d+|\d+ (things|facts|ways|reasons|tips)|countdown|ranking|listicle)/i],
  ['comparison', /\b(versus|\bvs\b|compare|comparison|side by side|before and after)/i],
  ['news-recap', /\b(news|headline|breaking|recap|roundup|newsletter)/i],
  ['tutorial', /\b(tutorial|how to|step by step|recipe|walkthrough|guide)/i],
  ['documentary', /\b(documentary|archival|museum|vintage|historical|ancient)/i],
  ['story-narrative', /\b(story|narrative|character|scene by scene|short film|cinematic|fable|tale)/i],
  ['quote-kinetic', /\b(quote|kinetic typ|typograph|lyric|manifesto|poem)/i],
  ['explainer', /\b(explain|explainer|how .{0,30} works|diagram|visuali[sz]e|concept)/i],
  ['product-launch', /\b(launch|product|startup|saas|brand|promo|commercial|\bad\b|landing)/i],
];
type SkillryEntry = {slug: string; author: string; post_url: string; category: string; tech_tags?: string[]; prompt?: string; skillry_url: string; added?: string};
const postId = (url: string) => url.match(/status\/(\d+)/)?.[1] ?? url;
let skillryAdded = 0;
if (existsSync(path.join(skillry, 'data', 'videos.json'))) {
  const seen = new Set(records.map(r => postId(String(r.url))));
  for (const e of readJson<SkillryEntry[]>(path.join(skillry, 'data', 'videos.json'))) {
    // Games and playable toys do not turn into narrated templates.
    if (!SKILLRY_LABEL[e.category] || (e.tech_tags ?? []).includes('playable') || seen.has(postId(e.post_url))) continue;
    seen.add(postId(e.post_url));
    const brief = e.prompt ?? '';
    const genres = GENRE_WORDS.filter(([, re]) => re.test(brief)).map(([g]) => g).slice(0, 3);
    records.push({
      id: `sk-${e.slug}`,
      collection: 'awesome-opus5-5-videos',
      category: e.category,
      title: `${SKILLRY_LABEL[e.category]} by @${e.author}`,
      description: '',
      url: e.post_url,
      showcaseUrl: e.skillry_url,
      author: e.author,
      date: e.added,
      genres: genres.length ? genres : SKILLRY_FALLBACK[e.category],
      domains: domainsFor(brief),
      tools: e.tech_tags ?? [],
      inputs: [] as string[],
      hasCode: false,
      libraryEntries: [] as string[],
    });
    skillryAdded++;
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
    'awesome-opus5-5-videos': 'Author handles, post links, categories and tech tags from "Awesome Opus 5.5 Videos" by yihui-dev (https://github.com/yihui-dev/awesome-opus5-5-videos, MIT), shown side by side with remakes at https://skillry.dev/ai-videos/opus-5-5. Prompts, videos and thumbnails belong to their creators and are not reproduced here; follow each url.',
    'remotion-prompts': 'Titles and author handles from https://www.remotion.dev/prompts. Prompts and videos are not reproduced; follow each url.',
  },
  count: records.length,
  records,
};
writeFileSync(path.join(root, 'inspiration', 'inspiration.json'), JSON.stringify(output, null, 1) + '\n');
console.log(`inspiration.json: ${records.length} records (${skillryAdded} from awesome-opus5-5-videos)`);
