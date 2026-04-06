const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER CONSOLE ERROR:', msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log('BROWSER PAGE ERROR:', err.toString());
  });

  await page.goto('http://localhost:3001');

  await page.waitForSelector('input[type="email"]');
  
  await page.type('input[type="email"]', 'admin@admin.com');
  await page.type('input[type="password"]', 'password');
  
  await page.click('button[type="submit"]');
  
  await new Promise(r => setTimeout(r, 3000));
  console.log('Logged in. Current URL:', page.url());

  await page.goto('http://localhost:3001/admin/dashboard-closer', { waitUntil: 'networkidle0' });
  console.log('Navigated to Closer Dashboard. Current URL:', page.url());
  
  await new Promise(r => setTimeout(r, 3000));
  
  // Take screenshot to confirm
  await page.screenshot({ path: 'debug-screenshot-2.png' });
  console.log('Screenshot saved to debug-screenshot-2.png');
  
  await browser.close();
})();
