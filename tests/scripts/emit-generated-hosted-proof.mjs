import { readdir, readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
const root = process.env.FALLLINE_OUTPUT;
if (!root) throw Error('Owned output required');
const allowed = new Set(['runner.json', 'source-before.json', 'source-after.json', 'tools-lock.json', 'hosted-browser.json', 'hosted-320.png']);
let total = 0;
for (const name of (await readdir(root)).sort()) {
  if (!allowed.has(name) && !/^(?:node-version|browser-tools|chromium|hosted-browser)\.(?:stdout|stderr)\.txt$/.test(name)) throw Error('Unexpected proof file');
  const full = path.join(root, name), stat = await lstat(full);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024**2 || (total += stat.size) > 16 * 1024**2) throw Error('Evidence budget');
  const value = await readFile(full), encoded = gzipSync(value, { mtime: 0 }).toString('base64');
  const parts = encoded.match(/.{1,12000}/g) || [''];
  console.log('FALLLINE_HOSTED_FILE ' + JSON.stringify({ path: name, bytes: value.length, sha256: createHash('sha256').update(value).digest('hex'), chunks: parts.length }));
  for (const [index, data] of parts.entries()) console.log('FALLLINE_HOSTED_CHUNK ' + JSON.stringify({ path: name, index, data }));
}
