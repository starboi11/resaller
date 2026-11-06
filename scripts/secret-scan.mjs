import { readFileSync } from 'node:fs';
import { sourceFiles } from './source-files.mjs';

// Works in the source ZIP too, without a .git directory or Git executable.
const files = sourceFiles();
const rules = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/u],
  ['GitHub token', /\bgh[opsu]_[A-Za-z0-9]{30,}\b/u],
  ['OpenAI-style secret', /\bsk-[A-Za-z0-9_-]{20,}\b/u],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/u],
  ['Cloudflare API token', /\bcfat_[A-Za-z0-9_-]{30,}\b/u],
  ['Telegram bot token', /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/u],
  ['S3 secret assignment', /(?:S3_SECRET_ACCESS_KEY|AWS_SECRET_ACCESS_KEY|BACKUP_S3_SECRET_ACCESS_KEY)\s*=\s*(?:[a-f0-9]{32,}|[A-Za-z0-9+/]{32,}={0,2})\b/u],
];
const findings = [];
for (const file of files) {
  if (file === 'scripts/secret-scan.mjs') continue;
  let content;
  try { content = readFileSync(file, 'utf8'); } catch { continue; }
  if (content.includes('\0')) continue;
  for (const [name, pattern] of rules) if (pattern.test(content)) findings.push(`${file}: ${name}`);
}
if (findings.length) {
  console.error(`Secret scan failed:\n${findings.join('\n')}`);
  process.exit(1);
}
console.log(`Secret scan passed (${files.length} release source files).`);
