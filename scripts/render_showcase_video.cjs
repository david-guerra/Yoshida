/** Render the silent dashboard showcase from deterministic browser frames. */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MEDIA = path.join(ROOT, 'docs', 'media');
const STAGE = path.join(__dirname, 'showcase-video', 'index.html');
const VIDEO = path.join(MEDIA, 'yoshida-silent-demo.mp4');
const VTT = path.join(MEDIA, 'yoshida-silent-demo.vtt');
const FPS = 30;

function stamp(seconds) {
  const whole = Math.floor(seconds);
  return `00:${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}.000`;
}

function writeCaptions(captions) {
  const cues = captions.map(([start, end, value]) => `${stamp(start)} --> ${stamp(end)}\n${value}`).join('\n\n');
  fs.writeFileSync(VTT, `WEBVTT\n\n${cues}\n`);
}

async function main() {
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await page.goto(pathToFileURL(STAGE).href);
    await page.waitForFunction(() => document.fonts.status === 'loaded');
    const duration = await page.evaluate(() => window.DURATION);
    const previewIndex = process.argv.indexOf('--preview');
    if (previewIndex >= 0) {
      const times = process.argv[previewIndex + 1].split(',').map(Number);
      if (times.some(time => !Number.isFinite(time) || time < 0 || time >= duration)) throw new Error('Preview seconds must be within the video duration');
      for (const time of times) {
        const output = `/tmp/yoshida-showcase-preview-${time}.png`;
        await page.evaluate(second => window.render(second), time);
        await page.screenshot({ path: output, animations: 'disabled' });
        console.log(output);
      }
      return;
    }
    const captions = await page.evaluate(() => window.CAPTIONS);
    writeCaptions(captions);
    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS),
      '-vcodec', 'png', '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'medium',
      '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', VIDEO,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let number = 0; number < FPS * duration; number++) {
      await page.evaluate(time => window.render(time), number / FPS);
      const png = await page.screenshot({ type: 'png', animations: 'disabled' });
      if (!ffmpeg.stdin.write(png)) await once(ffmpeg.stdin, 'drain');
      if (number && number % (FPS * 10) === 0) console.log(`Rendered ${Math.floor(number / FPS)} of ${duration} seconds`);
    }
    ffmpeg.stdin.end();
    const [code] = await once(ffmpeg, 'close');
    if (code !== 0) throw new Error(`ffmpeg exited with ${code}`);
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
