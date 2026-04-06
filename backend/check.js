const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text(), msg.location().url, msg.location().lineNumber));
        page.on('pageerror', err => console.log('BROWSER ERROR STACK:', err.stack));
        page.on('response', response => {
            if (!response.ok()) console.log('HTTP ERROR:', response.status(), response.url());
        });
        
        console.log('Navegando para http://localhost:3001 ...');
        await page.goto('http://localhost:3001', { waitUntil: 'networkidle0', timeout: 10000 });
        
        console.log('Captura completa.');
        await browser.close();
    } catch (e) {
        console.error('Erro na automação:', e);
    }
})();
