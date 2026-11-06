import { existsSync, lstatSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const directories = ['.github', 'apps', 'docs', 'e2e', 'infrastructure', 'marketing', 'packages', 'scripts'];
const rootFiles = ['.dockerignore', '.editorconfig', '.env.example', '.env.production.example', '.env.staging.example', '.gitattributes', '.gitignore', '.nvmrc', '.prettierignore', '.prettierrc.json', 'compose.production.yml', 'compose.staging.yml', 'docker-compose.yml', 'package.json', 'playwright.config.ts', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'README.md', 'turbo.json'];
const excluded = new Set(['node_modules', '.git', '.next', 'dist', '.turbo', '.e2e-data', '.secrets', 'data', 'uploads', 'coverage', 'test-results', 'playwright-report', 'artifacts']);
export function sourceFiles(directory = process.cwd()) {
  const files = [];
  function walk(relative) {
    const path = join(directory, relative);
    if (!existsSync(path)) return;
    const name = relative.split('/').at(-1);
    if (excluded.has(name) || name.startsWith('.tmp-') || name.startsWith('.env') && !name.endsWith('.example')) return;
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      for (const entry of readdirSync(path).sort()) walk(`${relative}/${entry}`);
    } else if (stat.isFile() && !/\.(log|tsbuildinfo|zip|enc|dump|bak)$/i.test(name)) files.push(relative);
  }
  for (const relative of [...directories, ...rootFiles]) walk(relative);
  return files.sort();
}
