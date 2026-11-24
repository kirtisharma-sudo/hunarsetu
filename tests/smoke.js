// Smoke test: load page, visit every nav item in every role, report console/page errors.
const puppeteer = require('puppeteer-core');
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  const p = await b.newPage(); await p.setViewport({ width: +process.env.VIEWPORT_W || 390, height: 800 });
  const errs = [];
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'index.html')); await new Promise((r) => setTimeout(r, 1500));
  const roles = { worker: 6, ustad: 5, contractor: 6, mitra: 5 };
  const res = [];
  for (const role of Object.keys(roles)) {
    await p.evaluate((r) => { const d = document.body._x_dataStack[0]; d.setRole(r); }, role);
    for (let i = 0; i < roles[role]; i++) {
      await p.evaluate((i) => { const d = document.body._x_dataStack[0]; d.tab(d.navItems()[i].v); }, i);
      await new Promise((r) => setTimeout(r, 150));
      const info = await p.evaluate(() => { const d = document.body._x_dataStack[0]; const m = document.getElementById('main'); return { v: d.view, h: m.innerText.trim().length }; });
      res.push(role + ':' + info.v + ' textLen=' + info.h);
    }
  }
  console.log(res.join('\n')); console.log('--- errors (' + errs.length + ')'); console.log([...new Set(errs)].slice(0, 30).join('\n'));
  await b.close();
})();
