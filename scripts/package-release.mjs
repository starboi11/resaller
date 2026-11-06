import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { sourceFiles } from './source-files.mjs';

const output = resolve(process.argv[2] ?? '../resaller-server-2026-10-02.zip');
if (existsSync(output)) throw new Error('Archive already exists; choose a new output name to preserve it');
execFileSync(process.execPath, ['scripts/secret-scan.mjs'], { stdio: 'inherit' });
const files = sourceFiles();
const directory = mkdtempSync(join(tmpdir(), 'resaller-release-'));
try {
  const manifest = { createdAt: new Date().toISOString(), migrationCount: readdirSync('apps/api/prisma/migrations', { withFileTypes: true }).filter((item) => item.isDirectory()).length, files: {} };
  for (const file of files) {
    const target = join(directory, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(file, target);
    manifest.files[file] = createHash('sha256').update(readFileSync(target)).digest('hex');
  }
  writeFileSync(join(directory, 'SOURCE_MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
  mkdirSync(dirname(output), { recursive: true });
  if (process.platform === 'win32') {
    // Windows tar.exe does not consistently create a ZIP when invoked with -a.
    // Use the Windows ZIP implementation so Explorer can extract the release.
    const quotePowerShell = (value) => `'${value.replaceAll("'", "''")}'`;
    const command = [
      '$ErrorActionPreference = "Stop"',
      'Add-Type -AssemblyName System.IO.Compression.FileSystem',
      `[System.IO.Compression.ZipFile]::CreateFromDirectory(${quotePowerShell(directory)}, ${quotePowerShell(output)}, [System.IO.Compression.CompressionLevel]::Optimal, $false)`,
    ].join('; ');
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { stdio: 'inherit' });
  } else {
    execFileSync('tar', ['-a', '-cf', output, '-C', directory, '.'], { stdio: 'inherit' });
  }
  const digest = createHash('sha256').update(readFileSync(output)).digest('hex');
  writeFileSync(`${output}.sha256`, `${digest}  ${output.split(/[\\/]/).at(-1)}\n`);
  console.log(`Archive: ${output}; ${files.length} source files; ${manifest.migrationCount} migrations; SHA-256: ${digest}`);
} finally {
  rmSync(directory, { recursive: true });
}
