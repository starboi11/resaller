import { readFile, copyFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const posterPath = resolve('apps/web/public/brand/resaller-handoff-poster.png');
const outputPath = resolve('apps/web/public/ads/resaller-handoff-loop.webm');
const poster = (await readFile(posterPath)).toString('base64');
const tempDir = await mkdtemp(join(tmpdir(), 'resaller-handoff-'));
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    recordVideo: { dir: tempDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  await page.setContent(`<!doctype html>
    <html><head><style>
      * { box-sizing: border-box; }
      html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #08090b; }
      .frame { position: absolute; inset: 0; overflow: hidden; }
      .photo {
        position: absolute; inset: -3%;
        background: url('data:image/png;base64,${poster}') center / cover no-repeat;
        animation: camera 5.6s ease-in-out infinite;
        will-change: transform;
      }
      .light {
        position: absolute; inset: 0;
        background: radial-gradient(circle at 78% 54%, rgba(209, 29, 51, .16), transparent 28%);
        mix-blend-mode: screen;
        animation: light 5.6s ease-in-out infinite;
      }
      .shade {
        position: absolute; inset: 0;
        background: linear-gradient(90deg, rgba(3, 4, 6, .22), transparent 64%),
          linear-gradient(0deg, rgba(3, 4, 6, .19), transparent 30%);
      }
      @keyframes camera {
        0%, 100% { transform: scale(1) translateX(0); }
        50% { transform: scale(1.045) translateX(-.8%); }
      }
      @keyframes light {
        0%, 100% { opacity: .35; }
        50% { opacity: .85; }
      }
    </style></head><body>
      <div class="frame"><div class="photo"></div><div class="light"></div><div class="shade"></div></div>
    </body></html>`);
  await page.waitForTimeout(6100);
  const video = page.video();
  await context.close();
  if (!video) throw new Error('Browser did not record the video');
  await copyFile(await video.path(), outputPath);
  const info = await stat(outputPath);
  console.log(`Rendered ${outputPath} (${(info.size / 1024 / 1024).toFixed(2)} MiB)`);
} finally {
  await browser.close();
  await rm(tempDir, { recursive: true, force: true });
}
