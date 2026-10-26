import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const html = fs.readFileSync('public/index.html', 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
if (ids.length !== new Set(ids).size) throw new Error('Duplicate HTML IDs.');
const sources = fs.readdirSync('public/src').filter(file => file.endsWith('.js')).map(file => `public/src/${file}`);
for (const file of [...sources, 'scripts/check.mjs']) {
  const syntax = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (syntax.status !== 0) throw new Error(`${file}: ${syntax.stderr}`);
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/\b(?:byId|document\.getElementById)\(['"]([^'"]+)['"]\)/g)) {
    if (!ids.includes(match[1])) throw new Error(`Missing DOM ID ${match[1]} in ${file}`);
  }
  for (const match of source.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)) {
    if (!fs.existsSync(path.resolve(path.dirname(file), match[1]))) throw new Error(`Missing import ${match[1]} in ${file}`);
  }
}
for (const match of html.matchAll(/\b(?:src|href)="(\/[^"?#]*)[^\"]*"/g)) {
  if (match[1] !== '/' && !fs.existsSync(path.join('public', match[1]))) throw new Error(`Missing public asset ${match[1]}`);
}
for (const file of ['package.json', 'vercel.json']) JSON.parse(fs.readFileSync(file, 'utf8'));
if (sources.length !== 5) throw new Error('Expected ride, renderer, game, records and audio modules.');
console.log(`PASS: ${sources.length} native modules, syntax/imports, ${ids.length} unique DOM IDs and public assets.`);
