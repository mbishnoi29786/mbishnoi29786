// Rebuilds the "Writing" list in README.md from the site's RSS feed.
// Usage: node .github/scripts/update-writing.mjs   (FEED_URL overrides the feed, for local testing)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const FEED = process.env.FEED_URL ?? 'https://mbishnoi29786.com/rss.xml';
const README = fileURLToPath(new URL('../../README.md', import.meta.url));
const START = '<!-- writing:start -->';
const END = '<!-- writing:end -->';
const MAX_POSTS = 5;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

const decode = (s) =>
  s
    .replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
const tag = (xml, name) => decode(xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] ?? '');
const md = (s) => s.replace(/([\[\]*_`])/g, '\\$1');

const res = await fetch(FEED, { headers: { 'user-agent': 'mbishnoi29786-profile-readme' } });
if (!res.ok) throw new Error(`Feed request failed: ${res.status} ${FEED}`);
const xml = await res.text();

const posts = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
  .map(([, item]) => ({
    title: tag(item, 'title'),
    link: tag(item, 'link'),
    date: new Date(tag(item, 'pubDate')),
    lede: tag(item, 'description'),
    category: tag(item, 'category'),
  }))
  .filter((p) => p.title && p.link && !Number.isNaN(p.date.valueOf()))
  .sort((a, b) => b.date - a.date)
  .slice(0, MAX_POSTS);

// Never wipe the list because of a bad or empty feed.
if (posts.length === 0) throw new Error(`No posts found in ${FEED}`);

const list = posts
  .map((p) => {
    const when = `${MONTHS[p.date.getUTCMonth()]} ${p.date.getUTCFullYear()}`;
    const meta = [when, p.category.toUpperCase()].filter(Boolean).join(' · ');
    return `- [**${md(p.title)}**](${p.link}) <sub>&nbsp;${meta}</sub><br>${md(p.lede)}`;
  })
  .join('\n\n');

const readme = readFileSync(README, 'utf8');
const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);
if (!pattern.test(readme)) throw new Error(`README.md is missing the ${START} … ${END} markers`);
const next = readme.replace(pattern, `${START}\n${list}\n${END}`);

if (next === readme) console.log('Writing list already up to date.');
else {
  writeFileSync(README, next);
  console.log(`Writing list updated with ${posts.length} posts.`);
}
