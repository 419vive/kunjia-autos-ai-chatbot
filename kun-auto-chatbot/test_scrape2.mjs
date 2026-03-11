import puppeteer from 'puppeteer-core';

async function scrapeVehicle(carId) {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    const apiCalls = [];
    
    page.on('response', async (response) => {
      const url = response.url();
      const ct = response.headers()['content-type'] || '';
      if (ct.includes('json') && !url.includes('manifest')) {
        try {
          const data = await response.text();
          apiCalls.push({ url, data: data.substring(0, 3000) });
        } catch (e) {}
      }
    });

    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Try the new auto.8891.com.tw individual car page
    const url = `https://auto.8891.com.tw/usedauto-infos-${carId}.html`;
    console.log(`Trying: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 3000));
    
    console.log('Title:', await page.title());
    console.log('URL:', page.url());
    
    await page.screenshot({ path: '/tmp/8891_car_detail.png', fullPage: true });
    
    console.log('\n=== JSON API calls ===');
    apiCalls.forEach((c, i) => {
      console.log(`\n${i}: ${c.url}`);
      console.log(c.data);
    });
    
  } finally {
    await browser.close();
  }
}

scrapeVehicle('4075406').catch(console.error);
