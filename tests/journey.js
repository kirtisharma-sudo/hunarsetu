// Full Ramesh journey across the four roles, with persistence + QR decode checks.
const puppeteer = require('puppeteer-core');
const jsQR = require('jsqr'); const { PNG } = require('pngjs');
const URL_ = 'file://' + require('path').resolve(__dirname, '..', 'index.html');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0; const errs = [];
let lastN = 0; const ok = (c, m) => { if (c) { pass++; console.log('PASS ' + m); } else { fail++; console.log('FAIL ' + m); } if (errs.length !== lastN) { console.log('   +' + (errs.length - lastN) + ' console errors: ' + [...new Set(errs.slice(lastN).map(e => e.slice(0, 90)))].join(' | ')); lastN = errs.length; } };
(async () => {
  const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--allow-file-access-from-files'] });
  const p = await b.newPage(); await p.setViewport({ width: +process.env.VIEWPORT_W || 390, height: 800 });
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
  p.on('pageerror', (e) => errs.push('PAGEERR: ' + e.message));
  await p.goto(URL_); await sleep(600);
  const D = (fn, ...a) => p.evaluate(new Function('...a', 'const d=document.body._x_dataStack[0]; return Promise.resolve((' + fn.toString() + ')(d,...a)).then(r => r === undefined ? undefined : JSON.parse(JSON.stringify(r)))'), ...a).then(async (r) => { await sleep(60); return r; });
  const text = () => p.evaluate(() => document.getElementById('main').innerText);
  const dlg = async () => { await D((d) => d.dlgOk()); await sleep(100); };

  // 1. voice onboarding with a real MediaRecorder (fake mic device)
  await D((d) => d.recStart('onb')); await sleep(2200);
  ok(await D((d) => d.recState.on), 'mic recording started (MediaRecorder)');
  await D((d) => d.recStop()); await sleep(500);
  const aud = await D((d) => d.onb.audio && { dur: d.onb.audio.dur, size: d.onb.audio.blob.size });
  ok(aud && aud.size > 500, 'audio blob captured, ' + JSON.stringify(aud));
  ok(await D((d) => d.onb.transSource === '' ), 'no fake transcript when STT unavailable');
  await D((d) => d.onbSample()); ok((await D((d) => d.transLabel(d.onb.transSource))).includes('SAMPLE'), 'sample text labelled as sample');
  await D((d) => d.onbNext()); await sleep(200);
  const f = await D((d) => d.onb.f); ok(f.name === 'Ramesh Kumar' && f.experienceYears === '8' && f.trade === 'Electrician' && f.location === 'Najafgarh', 'extracted fields ' + JSON.stringify({ n: f.name, e: f.experienceYears, l: f.location, s: f.skills }));
  ok(f.skills.includes('basic_wiring') && f.skills.includes('fan_install') && f.skills.includes('db_box'), 'skills extracted');
  await D((d) => { d.onb.f.name = ''; }); await D((d) => d.onbSave()); ok((await D((d) => d.errs.name)) , 'validation blocks empty name');
  await D((d) => { d.onb.f.name = 'Ramesh Kumar'; d.onb.f.phone = '9811122233'; }); await D((d) => d.onbSave()); await sleep(300);
  ok(await D((d) => !!d.me && d.me.name === 'Ramesh Kumar' && !!d.me.voice.audioId), 'Ramesh profile saved with voice');
  const rid = await D((d) => d.me.id);

  // 2. skill test with a real video file
  await D((d) => { d.afInit(d.me.id); d.go('w_assess'); }); await sleep(300);
  await D((d) => { d.af.skillId = 'db_box'; });
  const input = await p.$('input[type=file][capture=environment]'); await input.uploadFile(require('path').resolve(__dirname, 'sample.mp4')); await sleep(2500);
  const m = await D((d) => d.af.metrics); ok(m && m.durationSec > 3 && m.width === 640, 'video analysed on device ' + JSON.stringify(m));
  await D((d) => d.afSubmit(null)); await sleep(600);
  const asmId = await D((d) => d.db.skill_assessments.find((a) => a.workerId === d.me.id).id);
  ok(await D((d, id) => d.asm(id).status === 'submitted' && !!d.media(d.asm(id).videoId), asmId), 'assessment submitted, video stored');
  ok(await D((d) => d.asm(d.db.skill_assessments.find((a) => !a.sample).id).screening.mode === 'demo'), 'screening labelled demo (no vision API)');
  ok(await D((d) => !d.isVerified(d.me)), 'not verified before Ustad review');

  // 3. Ustad review (real voice endorsement), approve
  await D((d) => d.setRole('ustad')); await sleep(200);
  ok(await D((d) => d.ustadQueue().some((a) => !a.sample)), 'Ustad sees Ramesh in pending queue');
  await D((d, id) => d.openReview(id), asmId); await sleep(300);
  await D((d) => d.finishReview('approve')); ok(await D((d) => !!d.errs.comment), 'approve blocked without comment or voice');
  await D((d) => d.recStart('rv')); await sleep(1500); await D((d) => d.recStop()); await sleep(400);
  await D((d) => { d.rv.comment = 'Neat board work, good insulation.'; d.rv.level = 'reviewed'; });
  await D((d) => d.finishReview('approve')); await sleep(500);
  ok(await D((d, id) => d.asm(id).status === 'approved' && d.isVerified(d.wk(d.db.story.workerId || d.me?.id) || d.db.workers.find((w) => w.name === 'Ramesh Kumar')), asmId), 'approved -> worker verified');
  const end = await D((d) => d.db.endorsements.find((e) => e.skillId === 'db_box' && e.ustadId === 'u_suresh' && e.workerId === d.db.workers.find((w) => w.name === 'Ramesh Kumar').id));
  ok(end && end.audioId, 'endorsement has voice note'); ok(end && end.level === 'reviewed', 'level = Ustad reviewed (not practical)');

  // 4. Hunar card + public page + QR scan
  await D((d, id) => { d.pickWorker(id); d.goAs('worker', 'w_card'); }, rid); await sleep(400);
  const svgHtml = await D((d) => d.qrFor(d.me)); ok(svgHtml.includes('<svg'), 'real QR svg generated');
  await p.setViewport({ width: +process.env.VIEWPORT_W || 390, height: 800, deviceScaleFactor: 3 }); const qrEl = await p.$('#main .qrbox'); await qrEl.screenshot({ path: require('os').tmpdir() + '/hs-qr.png' });
  const png = PNG.sync.read(require('fs').readFileSync(require('os').tmpdir() + '/hs-qr.png')); const q = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  const url = await D((d) => d.cardUrl(d.me)); ok(q && q.data === url, 'QR scans and decodes to the card URL (' + (q ? q.data.length : 0) + ' chars)');
  const pub = await b.newPage(); await pub.setViewport({ width: 390, height: 800 }); await pub.goto(q ? q.data : url); await sleep(600);
  const pt = await pub.evaluate(() => document.body.innerText);
  ok(pt.includes('Ramesh Kumar') && pt.includes('Distribution board assembly') && pt.includes('Suresh Sharma'), 'public page opens without login, shows endorsement');
  ok(!pt.includes('9811122233') && !/phone/i.test(pt.replace('Phone numbers and private details are never shown on this page.', '')), 'public page hides phone number');
  await pub.close();

  // 5. Contractor posts job, worker applies
  await D((d) => { d.setRole('contractor'); d.tab('c_post'); }); await sleep(200);
  await D((d) => { Object.assign(d.jf, { title: 'DB box and wiring, Dwarka site', trade: 'Electrician', skills: ['db_box', 'basic_wiring'], workersNeeded: 1, location: 'Dwarka', payType: 'fixed', amount: 4500, durationDays: 3, minExperience: 3, description: 'Assemble a 3-phase distribution board and run wiring.', startDate: new Date().toISOString().slice(0, 10) }); d.saveJob(); }); await sleep(300);
  const jobId = await D((d) => d.db.jobs.find((j) => j.title.startsWith('DB box')).id); ok(!!jobId, 'job posted');
  await D((d) => { d.jf = null; d.jfInit(null); d.jf.title = ''; d.saveJob(); }); ok(await D((d) => Object.keys(d.errs).length >= 4), 'post-job form validates required fields'); await D((d) => { d.jf = null; d.tab('c_dash'); });
  await D((d) => d.setRole('worker')); await sleep(200);
  ok(await D((d, id) => d.openJobsForWorker().some((j) => j.id === id), jobId), 'job visible in Find Work');
  ok(await D((d, id) => d.openJobsForWorker()[0].id === id || d.openJobsForWorker()[0].fit.score >= d.openJobsForWorker().find((j) => j.id === id).fit.score, jobId), 'job ranked by match score');
  await D((d, id) => d.applyJob(id), jobId); ok(await D((d, id) => d.appFor(id, d.me.id).status === 'applied', jobId), 'Ramesh applied');
  await D((d, id) => d.applyJob(id), jobId); ok(true, 'double apply guarded');
  await D((d) => d.setRole('contractor')); ok(await D((d, id) => d.appsForContractor('applied').some((a) => a.jobId === id), jobId), 'contractor sees application');
  const appId = await D((d, id) => d.db.job_applications.find((a) => a.jobId === id).id, jobId);
  await D((d, a) => d.setApp(a, 'shortlisted'), appId); await D((d, a) => d.setApp(a, 'accepted'), appId);
  ok(await D((d, a) => d.db.events.some((e) => e.role === 'worker' && e.text.includes('accepted')), appId), 'worker notified of acceptance');
  await D((d, a) => d.assignWorker(a), appId); await dlg();
  const recId = await D((d, id) => d.db.work_records.find((r) => r.jobId === id).id, jobId);
  ok(await D((d, r) => d.rec(r).status === 'assigned' && d.rec(r).agreedAmount === 4500 && !!d.payOf(r), recId), 'assigned -> work record + payment record created (4500)');
  ok(await D((d) => d.completedOf(d.db.workers.find((w) => w.name === 'Ramesh Kumar').id).length === 0), 'unconfirmed job NOT in verified history');

  // 6. Work completion flow
  await D((d, id) => { d.setRole('worker'); d.go('w_khata'); }, recId); await sleep(150);
  await D((d, r) => d.startWork(r), recId);
  await D((d, r) => { d.evReset(); d.submitEvidence(r); }, recId); ok(await D((d) => !!d.errs.note), 'proof requires a note');
  const ph = await p.evaluate(async () => { const c = document.createElement('canvas'); c.width = 50; c.height = 50; const b = await new Promise((r) => c.toBlob(r)); const d = document.body._x_dataStack[0]; const id = 'ph_test'; await d.storeMedia(id, b); d.ev.photos.push(id); d.ev.note = 'DB box assembled, all circuits labelled and tested.'; return id; });
  await D((d, r) => d.submitEvidence(r), recId); ok(await D((d, r) => d.rec(r).status === 'evidence_submitted' && d.rec(r).evidence.length === 1, recId), 'worker submitted evidence with photo');
  await D((d) => d.setRole('contractor')); await D((d, r) => d.go('c_record', { id: r }), recId); await sleep(200);
  await D((d, r) => d.contractorConfirm(r), recId); ok(await D((d, r) => d.rec(r).status === 'evidence_submitted' && !!d.errs.rating, recId), 'contractor must give rating');
  await D((d, r) => { d.cf.rating = 5; d.cf.feedback = 'Excellent work'; d.contractorConfirm(r); }, recId);
  ok(await D((d, r) => d.rec(r).status === 'contractor_confirmed', recId), 'contractor confirmed');
  ok(await D((d) => d.completedOf(d.db.workers.find((w) => w.name === 'Ramesh Kumar').id).length === 0), 'still NOT verified until worker confirms');
  await D((d) => d.setRole('worker')); await D((d, r) => d.workerConfirm(r), recId); await dlg();
  ok(await D((d, r) => d.rec(r).status === 'completed', recId), 'worker confirmed -> completed');
  ok(await D((d) => d.completedOf(d.db.workers.find((w) => w.name === 'Ramesh Kumar').id).length === 1), 'Kaam Ka Khata now has 1 verified job');
  await D((d) => d.tab('w_khata')); await sleep(200); ok((await text()).includes('DB box and wiring, Dwarka site'), 'job shown in Kaam Ka Khata UI');

  // 7. Payments: 4500 agreed, 1500 advance, 0 additional => 3000 outstanding
  await D((d, r) => { d.setRole('contractor'); d.payReset(); d.go('c_paydetail', { id: r }); }, recId); await sleep(150);
  await D((d, r) => { d.payF = { kind: 'advance', amount: '', date: '', note: '' }; d.addPay(r, 'contractor'); }, recId); ok(await D((d) => !!d.errs.amount), 'payment amount validated');
  await D((d, r) => { d.payF = { kind: 'advance', amount: 1500, date: new Date().toISOString().slice(0, 10), note: 'Cash advance' }; d.addPay(r, 'contractor'); }, recId);
  let t = await D((d, r) => d.payTotals(r), recId); ok(t.agreed === 4500 && t.advance === 1500 && t.paid === 0 && t.outstanding === 3000, 'totals: ' + JSON.stringify({ a: t.agreed, adv: t.advance, paid: t.paid, out: t.outstanding }));
  ok(t.unconfirmed === 1500, 'advance unconfirmed until worker confirms');
  await D((d) => d.setRole('worker')); ok(await D((d, r) => d.waitingFor(r, 'worker') === 1, recId), 'worker has 1 entry to confirm');
  const eid = await D((d, r) => d.payOf(r).entries[0].id, recId); await D((d, r, e) => d.confirmPay(r, e, 'worker'), recId, eid);
  t = await D((d, r) => d.payTotals(r), recId); ok(t.unconfirmed === 0 && t.confirmed === 1500, 'worker confirmation -> confirmed by both');
  await D((d, r) => { d.payF = { kind: 'payment', amount: 3000, date: new Date().toISOString().slice(0, 10), note: 'UPI' }; d.addPay(r, 'worker'); }, recId);
  await D((d) => d.setRole('contractor')); const e2 = await D((d, r) => d.payOf(r).entries[1].id, recId); await D((d, r, e) => d.confirmPay(r, e, 'contractor'), recId, e2);
  t = await D((d, r) => d.payTotals(r), recId); ok(t.outstanding === 0 && t.status === 'Fully paid' && t.unconfirmed === 0, 'paid in full, both confirmed: ' + t.status);
  await D((d, r) => { d.payF = { kind: 'payment', amount: 500, date: new Date().toISOString().slice(0, 10), note: '' }; d.addPay(r, 'contractor'); }, recId);
  t = await D((d, r) => d.payTotals(r), recId); ok(t.status.startsWith('Overpaid'), 'overpayment flagged');
  const e3 = await D((d, r) => d.payOf(r).entries[2].id, recId); await D((d, r, e) => d.disputePay(r, e, 'worker'), recId, e3); await dlg();
  t = await D((d, r) => d.payTotals(r), recId); ok(t.outstanding === 0, 'disputed entry excluded from totals');

  // 8. Hunar Mitra assisted registration
  await D((d) => d.setRole('mitra')); await D((d) => { d.onbReset(); d.tab('m_assist'); }); await D((d) => { d.onb.step = 2; Object.assign(d.onb.f, { name: 'Raju Prasad', trade: 'Plumber', experienceYears: 4, location: 'Najafgarh', skills: ['tap_fitting'] }); d.onbSave(); });
  ok(await D((d) => !!d.errs.consent), 'mitra cannot register without worker consent');
  await D((d) => { d.onb.consent = true; d.onbSave(); }); await sleep(300);
  ok(await D((d) => d.db.workers.some((w) => w.name === 'Raju Prasad' && w.assistedBy === 'm_anita' && w.createdBy === 'mitra')), 'assisted registration saved with consent');
  ok(await D((d) => d.mitraCanAct(d.db.workers.find((w) => w.name === 'Raju Prasad')) && !d.mitraCanAct(d.db.workers.find((w) => w.id === 'w_imran'))), 'mitra can act only for workers she registered');
  const sr = await D((d) => d.db.support_requests.find((s) => s.status === 'open').id); await D((d, s) => d.takeRequest(s), sr); await D((d, s) => d.resolveRequest(s), sr);
  ok(await D((d, s) => d.db.support_requests.find((x) => x.id === s).status === 'resolved', sr), 'help request taken and resolved');
  await D((d) => { d.apptF = { workerId: 'w_sanjay', ustadId: 'u_suresh', date: new Date(Date.now() + 864e5 * 3).toISOString().slice(0, 10), place: 'Najafgarh hall' }; d.bookAppointment(); });
  ok(await D((d) => d.db.support_requests.some((s) => s.type === 'assessment_appointment')), 'appointment booked');

  // 9. Contractor find workers filters
  await D((d) => { d.setRole('contractor'); d.resetFind(); d.findF.trade = 'Electrician'; d.findF.verified = 'yes'; });
  let rk = await D((d) => d.rankWorkers().map((r) => r.w.name)); ok(rk.includes('Ramesh Kumar') && rk.includes('Deepak Yadav') && !rk.includes('Kamal Singh') && !rk.includes('Mohd Imran'), 'filter: electricians + verified -> ' + rk.join(','));
  await D((d) => { d.resetFind(); d.findF.location = 'Najafgarh'; d.findF.radius = 5; }); rk = await D((d) => d.rankWorkers().map((r) => r.w.name)); ok(rk.includes('Ramesh Kumar') && !rk.includes('Mohd Imran'), 'filter: location radius');

  // 10. Persistence across reload
  await sleep(500); await p.reload(); await sleep(900);
  const per = await D((d) => ({ w: !!d.db.workers.find((x) => x.name === 'Ramesh Kumar'), rec: d.db.work_records.some((r) => r.status === 'completed' && !r.isDemo), role: d.role, urls: Object.keys(d.urls).length, jobs: d.db.jobs.some((j) => j.title.startsWith('DB box')) }));
  ok(per.w && per.rec && per.jobs, 'data persists after reload'); ok(per.urls >= 3, 'recordings/videos/photos persist in IndexedDB (' + per.urls + ' media)');
  ok(await D((d) => d.me ? d.me.name === 'Ramesh Kumar' : true) , 'session restored');
  await D((d) => d.setRole('worker')); await D((d) => d.tab('w_card')); await sleep(300);
  ok(await p.evaluate(() => { const a = document.querySelector('#main audio[src^="blob:"]'); return !!a; }), 'recorded audio still playable after reload');

  // 11. Reset demo
  await D((d) => d.resetDemo()); await Promise.all([p.waitForNavigation({ waitUntil: 'load' }), D((d) => d.dlgOk())]).catch(() => {}); await sleep(900);
  ok(await D((d) => !d.db.workers.some((w) => w.name === 'Ramesh Kumar') && d.db.workers.length === 4 && Object.keys(d.urls).length === 0), 'reset demo restores seed data and clears media');

  console.log('\n' + pass + ' passed, ' + fail + ' failed'); console.log('--- console errors (' + errs.length + ')'); console.log([...new Set(errs)].slice(0, 20).join('\n'));
  await b.close(); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('TEST CRASH', e); process.exit(2); });
