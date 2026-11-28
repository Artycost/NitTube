import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://localhost:5173/watch/242e7e45-e421-40f3-9a6f-80283e64e884');
await page.waitForTimeout(3000);
const read = () => page.evaluate(() => {
  const v = [...document.querySelectorAll('video')][1];
  return v ? { w: v.videoWidth, h: v.videoHeight, paused: v.paused, stream: !!v.srcObject } : null;
});
console.log('start:', JSON.stringify(await read()));
await page.locator('button[aria-label="Настройки плеера"]').click();
await page.locator('button:has-text("Качество")').last().click();
await page.locator('button:has-text("1080p HD")').last().click();
await page.waitForTimeout(1500);
console.log('1080:', JSON.stringify(await read()));
await browser.close();
