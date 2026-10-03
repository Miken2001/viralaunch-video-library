/**
 * QA gate: builds out/contact-sheet.html — every entry with 4 frames from its preview, its
 * metadata, validation status and inspiration link — for a human to approve a batch.
 * Usage: pnpm contact-sheet [<id>...]
 */
import {execFileSync} from 'node:child_process';
import {existsSync, mkdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {entryIds, readMeta, root} from './lib';
import {validateEntry} from './validate';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : entryIds();
const out = path.join(root, 'out');
mkdirSync(path.join(out, 'frames'), {recursive: true});
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cards: string[] = [];
for (const id of ids) {
  const meta = readMeta(id);
  const errors = await validateEntry(id);
  const video = path.join(root, 'previews', `${id}.mp4`);
  const frames: string[] = [];
  if (existsSync(video)) {
    const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video]).toString()) || 4;
    for (const f of [0.1, 0.35, 0.65, 0.95]) {
      const file = path.join(out, 'frames', `${id}-${f}.jpg`);
      execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(duration * f), '-i', video, '-frames:v', '1', '-vf', 'scale=270:-1', file]);
      frames.push(`frames/${id}-${f}.jpg`);
    }
  }
  const status = errors.length ? `<b class="bad">${errors.length} issue(s)</b><ul>${errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul>` : '<b class="ok">valid</b>';
  const inspired = (meta.inspiredBy ?? []).map(i => `<a href="${esc(i.url)}">${esc(i.collection)}</a>`).join(', ');
  cards.push(`<section><h2>${esc(meta.name)} <small>${esc(id)} · v${esc(meta.version)} · ${esc(meta.location)} · ${esc(meta.status)}</small></h2><p>${esc(meta.summary)}</p><p class="tags">${[...meta.genres, ...meta.domains].map(t => `<span>${esc(t)}</span>`).join('')}</p><div class="frames">${frames.map(f => `<img src="${f}" alt="">`).join('') || '<i>no preview — run pnpm preview ' + esc(id) + '</i>'}</div><p>${status} ${inspired ? '· inspired by ' + inspired : ''}</p></section>`);
}
writeFileSync(path.join(out, 'contact-sheet.html'), `<!doctype html><meta charset="utf-8"><title>Library contact sheet</title><style>body{font-family:system-ui,sans-serif;margin:24px;background:#111;color:#eee}section{border-bottom:1px solid #333;padding:16px 0}h2{margin:0 0 6px}small{color:#999;font-weight:400;font-size:14px}.frames{display:flex;gap:8px;flex-wrap:wrap}.frames img{width:180px;border-radius:6px}.tags span{display:inline-block;background:#262626;border-radius:99px;padding:2px 10px;margin:0 6px 6px 0;font-size:12px}.ok{color:#4ade80}.bad{color:#f87171}a{color:#93c5fd}</style><h1>Library contact sheet — ${ids.length} entries</h1>${cards.join('')}`);
console.log(`wrote ${path.relative(process.cwd(), path.join(out, 'contact-sheet.html'))}`);
