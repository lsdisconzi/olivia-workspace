const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto('http://127.0.0.1:8901/index.html', { waitUntil: 'load', timeout: 20000 });
  await new Promise(r => setTimeout(r, 800));

  // Scroll to carousel
  await page.evaluate(() => {
    document.getElementById('quoteCarousel').scrollIntoView({ behavior: 'instant', block: 'center' });
  });
  await new Promise(r => setTimeout(r, 500));

  // screenshot of the carousel area
  const el = await page.$('#quoteCarousel');
  await el.screenshot({ path: '/tmp/gh_carousel.png' });

  // Check computed visibility of active slide
  const vis = await page.evaluate(() => {
    const s = document.querySelector('.carousel-slide.active');
    const cs = getComputedStyle(s);
    const stage = document.getElementById('quoteCarousel');
    const stageCS = getComputedStyle(stage);
    return {
      activeDisplay: cs.display,
      activeOpacity: cs.opacity,
      stageDisplay: stageCS.display,
      stageVisibility: stageCS.visibility,
      stageRect: stage.getBoundingClientRect().toJSON()
    };
  });
  console.log('VIS=' + JSON.stringify(vis));
  await browser.close();
})();
