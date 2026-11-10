import {chromium} from 'playwright';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const jobs = [
  ['avatar-voce-decide.html', 1080, 1080, 'avatar-voce-decide.png'],
  ['avatar-ninguem.html', 1080, 1080, 'avatar-ninguem.png'],
  ['banner-voce-decide.html', 2560, 1440, 'banner-voce-decide.png'],
  ['banner-ninguem.html', 2560, 1440, 'banner-ninguem.png'],
];
const browser = await chromium.launch({executablePath: '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', args: ['--no-sandbox']});
for (const [html, w, h, out] of jobs) {
  const page = await browser.newPage({viewport: {width: w, height: h}});
  await page.goto('file://' + path.join(dir, html));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({path: path.join(dir, out)});
  await page.close();
  console.log(out);
}
await browser.close();
