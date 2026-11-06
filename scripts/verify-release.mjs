import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, relative, isAbsolute, sep } from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(readFileSync('SOURCE_MANIFEST.json', 'utf8'));
let checked = 0;
for (const [path, expected] of Object.entries(manifest.files)) {
  const full = resolve(root, path);
  const child = relative(root, full);
  if (isAbsolute(child) || child === '..' || child.startsWith(`..${sep}`)) throw new Error('Manifest path escapes release directory');
  const actual = createHash('sha256').update(readFileSync(full)).digest('hex');
  if (actual !== expected) throw new Error(`Release file differs from manifest: ${path}`);
  checked += 1;
}
console.log(`PASS: ${checked} release source files match; ${manifest.migrationCount} migrations in manifest`);
