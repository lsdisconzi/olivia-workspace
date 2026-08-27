const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });
  page.on('pageerror', err => errors.push('pageerror: ' + err.message));

  await page.goto('http://127.0.0.1:8901/index.html', { waitUntil: 'load', timeout: 20000 });
  await new Promise(r => setTimeout(r, 1200));

  const result = await page.evaluate(() => {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.carousel-dot');
    const activeSlide = document.querySelector('.carousel-slide.active');
    const counter = document.getElementById('carouselCounter');
    const track = document.getElementById('carouselTrack');
    return {
      slideCount: slides.length,
      dotCount: dots.length,
      activeSlideIndex: activeSlide ? activeSlide.dataset.index : null,
      counterText: counter ? counter.textContent : null,
      trackChildren: track ? track.children.length : 0,
      hasCarouselControl: typeof window.__carousel === 'object' && window.__carousel !== null,
      navButtons: {
        prev: !!document.getElementById('carouselPrev'),
        next: !!document.getElementById('carouselNext'),
        toggle: !!document.getElementById('carouselToggle')
      }
    };
  });

  const nextInfo = await page.evaluate(() => {
    const before = document.querySelector('.carousel-slide.active').dataset.index;
    window.__carousel.next();
    const after = document.querySelector('.carousel-slide.active').dataset.index;
    return { before, after };
  });

  // autoplay: wait for next interval (4500ms)
  await new Promise(r => setTimeout(r, 4600));
  const autoplayInfo = await page.evaluate(() => ({
    autoIndex: document.querySelector('.carousel-slide.active').dataset.index
  }));

  console.log('CAROUSEL_STATE=' + JSON.stringify(result));
  console.log('NEXT_TEST=' + JSON.stringify(nextInfo));
  console.log('AUTOPLAY_TEST=' + JSON.stringify(autoplayInfo));
  console.log('JS_ERRORS=' + JSON.stringify(errors));

  await browser.close();
})();
