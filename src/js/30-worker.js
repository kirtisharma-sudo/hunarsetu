'use strict';
/* ============================================================
   Worker side: voice onboarding, profile, skill test, applications,
   work records (Kaam Ka Khata) and payment tracking (Mera Hisaab).
   Recording, assessment form and payments are shared with other roles.
   ============================================================ */

const SAMPLE_TRANSCRIPT = 'Mera naam Ramesh Kumar hai. Main 8 saal se electrician ka kaam kar raha hoon. Main wiring, fan installation aur DB box repair karta hoon. Najafgarh mein rehta hoon.';

function partWorker() {
  return {
    /* ---------- shared audio recorder ---------- */
    recState: { on: false, secs: 0, level: [], target: '', err: '' },
    _rec: null, _stt: null, _recTimer: null,
    async recStart(target) {
      if (this.recState.on) return;
      if (!AudioRec.supported()) { this.recState.err = 'This browser cannot record audio. Use Chrome on Android, or continue without a recording.'; return; }
      this.recState.err = '';
      this._rec = new AudioRec();
      try {
        await this._rec.start((l) => { this.recState.level = l.slice(0, 20); });
      } catch (e) {
        this.recState.err = e && e.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow the microphone in the browser settings, or continue without a recording.' : 'Could not start the microphone on this device.';
        this._rec = null; return;
      }
      this.recState.on = true; this.recState.secs = 0; this.recState.target = target; this.recState.level = [];
      if (target === 'onb') {
        this.onb.liveText = '';
        this._stt = startSTT(this.onb.lang, (t) => { this.onb.liveText = t; });
        this.onb.sttTried = !!this._stt;
      }
      this._recTimer = setInterval(() => {
        this.recState.secs++;
        if (this.recState.secs >= (target === 'onb' ? 60 : 30)) this.recStop();
      }, 1000);
    },
    async recStop() {
      if (!this.recState.on || !this._rec) return;
      clearInterval(this._recTimer); stopSTT(this._stt); this._stt = null;
      const r = await this._rec.stop(); this._rec = null; this.recState.on = false;
      const target = this.recState.target;
      this[target].audio = { blob: r.blob, url: URL.createObjectURL(r.blob), dur: r.durationSec };
      if (target === 'onb') {
        if (this.onb.liveText) { this.onb.transcript = this.onb.liveText; this.onb.transSource = 'browser'; }
        else if (this.settings.sttUrl) await this.transcribeViaApi(r.blob);
      }
    },
    recDiscard() {
      if (this.recState.on && this._rec) {
        clearInterval(this._recTimer); this._rec.cancel(); this._rec = null; stopSTT(this._stt); this._stt = null; this.recState.on = false;
      }
    },
    recDelete(target) {
      const a = this[target].audio;
      if (a && a.url) URL.revokeObjectURL(a.url);
      this[target].audio = null;
      if (target === 'onb' && ['browser', 'api'].includes(this.onb.transSource)) { this.onb.transcript = ''; this.onb.transSource = ''; }
    },
    async transcribeViaApi(blob) {
      try {
        this.busy = 'stt';
        const fd = new FormData(); fd.append('audio', blob, 'voice.webm'); fd.append('lang', this.onb.lang);
        const r = await fetch(this.settings.sttUrl, { method: 'POST', body: fd });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        if (j && j.text) { this.onb.transcript = String(j.text); this.onb.transSource = 'api'; }
        else this.toast('The speech service returned no text', 'err');
      } catch (e) { this.toast('Speech service not reachable. Type or use sample text.', 'err'); }
      this.busy = '';
    },
    recBars() { const l = this.recState.level; return Array.from({ length: 20 }, (_, i) => this.recState.on ? 6 + Math.round(((l[i] || 0) / 255) * 34) : 6); },
    mmss(s) { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); },

    /* ---------- onboarding (worker self-registration and Hunar Mitra assisted) ---------- */
    blankProfile() {
      return { name: '', phone: '', trade: 'Electrician', experienceYears: '', location: '', skills: [], languages: ['Hindi'], availability: 'available', radiusKm: 15, contactPref: 'whatsapp', avatar: '' };
    },
    onb: null,
    onbReset() { this.recDiscard(); this.onb = { step: 1, lang: 'hi-IN', audio: null, liveText: '', sttTried: false, transcript: '', transSource: '', consent: false, f: this.blankProfile(), done: null }; this.errs = {}; },
    onbSample() { this.onb.transcript = SAMPLE_TRANSCRIPT; this.onb.transSource = 'sample'; },
    onbTyped() { this.onb.transSource = this.onb.transSource === 'browser' ? 'browser_edited' : this.onb.transSource === 'api' ? 'api_edited' : 'typed'; },
    transLabel(s) {
      return ({ sample: 'SAMPLE TEXT (demo). This is not from your recording.', typed: 'Typed by you', browser: 'From browser speech recognition. Please check it.', browser_edited: 'Browser speech recognition, edited by you', api: 'From the configured speech service. Please check it.', api_edited: 'Speech service, edited by you' })[s] || '';
    },
    onbFill() {
      const x = extractFromText(this.onb.transcript, LOCALITIES, SKILLS);
      const f = this.onb.f; let n = 0;
      if (x.name) { f.name = x.name; n++; }
      if (x.trade) { f.trade = x.trade; n++; }
      if (x.experience) { f.experienceYears = x.experience; n++; }
      if (x.location) { f.location = x.location; n++; }
      if (x.skills.length) { f.skills = Array.from(new Set(f.skills.concat(x.skills))); n++; }
      this.toast(n ? 'Details filled from the text. Please check each one.' : 'Nothing could be picked from the text. Please fill the details.', n ? 'ok' : 'err');
    },
    onbNext() {
      this.onb.step = 2;
      if (this.onb.transcript && !this.onb.f.name) this.onbFill();
      window.scrollTo({ top: 0 });
    },
    toggleIn(list, v) { const i = list.indexOf(v); if (i >= 0) list.splice(i, 1); else list.push(v); },
    addCustomSkill(f) { const v = (this.customSkill || '').trim(); if (!v) return; const id = 'custom:' + v.slice(0, 40); if (!f.skills.includes(id)) f.skills.push(id); this.customSkill = ''; },
    customSkill: '',
    validateProfile(f) {
      const e = {};
      if (!f.name || f.name.trim().length < 2) e.name = 'Please enter the name';
      if (!TRADES.includes(f.trade)) e.trade = 'Please choose a trade';
      const x = Number(f.experienceYears);
      if (f.experienceYears === '' || isNaN(x) || x < 0 || x > 60) e.experienceYears = 'Enter years of experience (0 to 60)';
      if (!f.location || f.location.trim().length < 2) e.location = 'Please enter the area where you live';
      if (!f.languages.length) e.languages = 'Choose at least one language';
      if (f.phone && !/^\d{10}$/.test(f.phone.replace(/\s/g, ''))) e.phone = 'Phone must be 10 digits (or leave it empty)';
      return e;
    },
    async onbSave() {
      const f = this.onb.f; const e = this.validateProfile(f);
      if (this.role === 'mitra' && !this.onb.consent) e.consent = 'Worker consent is needed before registering them';
      this.errs = e;
      if (Object.keys(e).length) { this.toast('Please fix the highlighted fields', 'err'); return; }
      const w = {
        id: uid('w'), name: f.name.trim(), trade: f.trade, experienceYears: Number(f.experienceYears), location: f.location.trim(),
        languages: f.languages.slice(), skills: f.skills.slice(), availability: f.availability, radiusKm: Number(f.radiusKm) || 15,
        contactPref: f.contactPref, phone: (f.phone || '').replace(/\s/g, ''), avatar: f.avatar || '', voice: null,
        createdBy: this.role === 'mitra' ? 'mitra' : 'self', assistedBy: this.role === 'mitra' ? this.mitra.id : null, isDemo: false, createdAt: iso(),
      };
      if (this.onb.audio) {
        const mid = uid('aud');
        if (await this.storeMedia(mid, this.onb.audio.blob)) w.voice = { audioId: mid, durationSec: this.onb.audio.dur, transcript: this.onb.transcript, source: this.onb.transSource || 'none', lang: this.onb.lang };
      } else if (this.onb.transcript) {
        w.voice = { audioId: null, durationSec: 0, transcript: this.onb.transcript, source: this.onb.transSource || 'typed', lang: this.onb.lang };
      }
      this.db.workers.push(w);
      if (this.role === 'worker') {
        this.session.workerId = w.id;
        if (!this.db.story.workerId) this.db.story.workerId = w.id;
        this.toast('Profile created. Namaste, ' + w.name + '!');
        this.nav(() => { this.onbReset(); this.stack = []; this.view = 'w_home'; this.params = {}; });
      } else {
        this.notify('worker', w.id, 'Anita Verma helped you register. Please check your details.', 'w_home');
        this.onb.done = w; this.toast('Worker registered with consent');
        this.onb.step = 3;
      }
      this.persistNow(); window.scrollTo({ top: 0 });
    },

    /* ---------- profile edit / delete ---------- */
    pf: null,
    openProfile() { this.pf = JSON.parse(JSON.stringify(this.me)); this.errs = {}; this.go('w_profile'); },
    async pfAvatar(ev) {
      const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (!f) return;
      try { this.pf.avatar = await blobToDataURL(await resizeImage(f, 256, 0.7)); } catch (e) { this.toast(e.message, 'err'); }
    },
    async onbAvatar(ev) {
      const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (!f) return;
      try { this.onb.f.avatar = await blobToDataURL(await resizeImage(f, 256, 0.7)); } catch (e) { this.toast(e.message, 'err'); }
    },
    saveProfile() {
      const e = this.validateProfile(this.pf); this.errs = e;
      if (Object.keys(e).length) { this.toast('Please fix the highlighted fields', 'err'); return; }
      const w = this.me; const f = this.pf;
      Object.assign(w, { name: f.name.trim(), trade: f.trade, experienceYears: Number(f.experienceYears), location: f.location.trim(), languages: f.languages.slice(), skills: f.skills.slice(), availability: f.availability, radiusKm: Number(f.radiusKm) || 15, contactPref: f.contactPref, phone: (f.phone || '').replace(/\s/g, ''), avatar: f.avatar || '' });
      this.toast('Profile saved'); this.back(() => { this.pf = null; });
    },
    deleteProfile() {
      const w = this.me; if (!w || w.isDemo) return;
      this.ask({ title: 'Delete my profile?', body: 'This removes your profile, skill tests, applications, work history and payment records from this device. This cannot be undone.', ok: 'Delete everything', danger: true, fn: () => {
        this.cascadeDeleteWorker(w.id); this.session.workerId = null; this.view = 'w_home'; this.params = {}; this.role = 'worker'; this.persistNow(); setTimeout(() => location.reload(), 50);
      } });
    },
    cascadeDeleteWorker(id) {
      const d = this.db; const w = this.wk(id);
      const mids = [];
      if (w && w.voice && w.voice.audioId) mids.push(w.voice.audioId);
      d.skill_assessments.filter((a) => a.workerId === id).forEach((a) => { if (a.videoId) mids.push(a.videoId); });
      d.endorsements.filter((e) => e.workerId === id).forEach((e) => { if (e.audioId) mids.push(e.audioId); });
      const recIds = d.work_records.filter((r) => r.workerId === id).map((r) => r.id);
      d.work_records.filter((r) => r.workerId === id).forEach((r) => (r.evidence || []).forEach((m) => mids.push(m)));
      d.workers = d.workers.filter((x) => x.id !== id);
      d.skill_assessments = d.skill_assessments.filter((a) => a.workerId !== id);
      d.endorsements = d.endorsements.filter((e) => e.workerId !== id);
      d.job_applications = d.job_applications.filter((a) => a.workerId !== id);
      d.work_records = d.work_records.filter((r) => r.workerId !== id);
      d.payment_records = d.payment_records.filter((p) => !recIds.includes(p.recordId));
      d.support_requests = d.support_requests.filter((s) => s.workerId !== id);
      d.mentorships = d.mentorships.filter((m) => m.workerId !== id);
      d.events = d.events.filter((e) => !(e.role === 'worker' && e.to === id));
      if (d.story.workerId === id) d.story = {};
      mids.forEach((m) => this.dropMedia(m));
    },

    /* ---------- skill test (assessment submission). Shared by worker and Hunar Mitra ---------- */
    af: null,
    afInit(wid) {
      const w = this.wk(wid);
      if (this.af && this.af.url) { try { URL.revokeObjectURL(this.af.url); } catch (e) { /* ignore */ } }
      this.af = { workerId: wid || '', trade: w ? w.trade : 'Electrician', skillId: '', fileName: '', blob: null, url: '', metrics: null, checks: null, analyzing: false, submitting: false, err: '' };
    },
    afSkills() { return this.skillsOfTrade(this.af ? this.af.trade : 'Electrician'); },
    afSetTrade(t) { this.af.trade = t; this.af.skillId = ''; },
    async afPick(ev) {
      const f = ev.target.files && ev.target.files[0]; ev.target.value = ''; if (!f) return;
      if (!/^video\//.test(f.type)) { this.af.err = 'Please choose a video file.'; return; }
      if (f.size > 80 * 1048576) { this.af.err = 'This video is too large (over 80 MB). Please record a shorter clip of 15 to 30 seconds.'; return; }
      if (this.af.url) { try { URL.revokeObjectURL(this.af.url); } catch (e) { /* ignore */ } }
      this.af.err = ''; this.af.blob = f; this.af.fileName = f.name; this.af.url = URL.createObjectURL(f); this.af.analyzing = true; this.af.checks = null;
      try { const m = await analyzeVideo(f); this.af.metrics = m; this.af.checks = this.qualityChecks(m); }
      catch (e) { this.af.metrics = null; this.af.checks = [{ label: 'Video details', status: 'warn', detail: 'This phone could not read the video details. You can still submit it.' }]; }
      this.af.analyzing = false;
    },
    afClearVideo() { if (this.af.url) URL.revokeObjectURL(this.af.url); Object.assign(this.af, { blob: null, url: '', fileName: '', metrics: null, checks: null, err: '' }); },
    qualityChecks(m) {
      const c = [];
      const d = m.durationSec;
      c.push({ label: 'Length', status: d >= 8 && d <= 60 ? 'ok' : 'warn', detail: d + ' seconds. ' + (d >= 8 && d <= 60 ? 'Good length.' : 'Aim for 15 to 30 seconds.') });
      const minSide = Math.min(m.width || 0, m.height || 0);
      c.push({ label: 'Picture size', status: minSide >= 480 ? 'ok' : 'warn', detail: (m.width || '?') + ' x ' + (m.height || '?') + '. ' + (minSide >= 480 ? 'Clear enough.' : 'Low quality, try again with the back camera.') });
      if (m.brightness !== null) {
        const b = m.brightness; const ok = b >= 50 && b <= 215;
        c.push({ label: 'Light', status: ok ? 'ok' : 'warn', detail: (b < 50 ? 'Too dark. Move to better light.' : b > 215 ? 'Too bright. Avoid direct sun on the lens.' : 'Light looks fine.') });
      }
      if (m.motion !== null) {
        c.push({ label: 'Camera movement', status: m.motion < 28 ? 'ok' : 'warn', detail: m.motion < 28 ? 'Fairly steady.' : 'A lot of movement. Hold the phone steady or lean it on something.' });
      }
      c.push({ label: 'File size', status: m.sizeMB <= 50 ? 'ok' : 'warn', detail: m.sizeMB + ' MB' });
      return c;
    },
    ustadForTrade(trade) { return this.db.ustads.find((u) => u.trade === trade) || this.db.ustads[0]; },
    async runVision(blob, skillId) {
      if (!this.settings.visionUrl) return null;
      try {
        const fd = new FormData(); fd.append('video', blob, 'task.mp4'); fd.append('skillId', skillId); fd.append('skillName', this.skName(skillId));
        const r = await fetch(this.settings.visionUrl, { method: 'POST', body: fd });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        return (j.observations || []).slice(0, 12).map((o) => ({ label: String(o.label || '').slice(0, 120), status: ['seen', 'not_seen', 'unclear'].includes(o.status) ? o.status : 'unclear', note: String(o.note || '').slice(0, 200) }));
      } catch (e) { return { error: String(e.message || e) }; }
    },
    async afSubmit(assistedBy) {
      const a = this.af; const w = this.wk(a.workerId);
      const e = {};
      if (!w) e.worker = 'Choose a worker first';
      if (!a.skillId) e.skill = 'Choose the skill you will show';
      if (!a.blob) e.video = 'Record or choose a video';
      if (w && a.skillId && this.db.skill_assessments.some((x) => x.workerId === w.id && x.skillId === a.skillId && ['submitted', 'reassessment_requested'].includes(x.status))) e.skill = 'This skill is already waiting for an Ustad';
      this.errs = e;
      if (Object.keys(e).length) { this.toast('Please complete the highlighted steps', 'err'); return; }
      a.submitting = true;
      const vid = uid('vid');
      if (!(await this.storeMedia(vid, a.blob))) { a.submitting = false; return; }
      let observations = [], note = 'No vision service is configured, so only basic video checks were run on this device. Nothing here certifies safety or correct technique.', mode = 'demo';
      if (this.settings.visionUrl) {
        const r = await this.runVision(a.blob, a.skillId);
        if (Array.isArray(r)) { observations = r; mode = 'api'; note = 'Observations came from the configured vision service. They are hints for the Ustad, not a certificate.'; }
        else note = 'The vision service could not be reached (' + (r && r.error) + '). Only basic video checks were run.';
      }
      const u = this.ustadForTrade(w.trade);
      const asm = {
        id: uid('a'), workerId: w.id, skillId: a.skillId, videoId: vid, videoName: a.fileName, sample: false, submittedAt: iso(), status: 'submitted', ustadId: u.id,
        screening: { mode, checks: a.checks || [], metrics: a.metrics, observations, note },
        review: null, assistedBy: assistedBy || null,
        history: [{ at: iso(), text: 'Video submitted' + (assistedBy ? ' with help from Hunar Mitra' : '') }, { at: iso(), text: 'Basic video checks completed' + (mode === 'api' ? ' and vision hints added' : '') }],
      };
      this.db.skill_assessments.push(asm);
      if (!this.db.story.assessmentId && w.id === this.db.story.workerId) this.db.story.assessmentId = asm.id;
      if (!w.skills.includes(a.skillId)) w.skills.push(a.skillId);
      this.notify('ustad', u.id, w.name + ' submitted a ' + this.skName(a.skillId) + ' video', 'u_review', { id: asm.id });
      a.submitting = false;
      this.toast('Submitted to ' + u.name + ' for review');
      this.afInit(assistedBy ? w.id : w.id);
      if (this.role === 'worker') this.go('w_card');
    },
    delAssessment(id) {
      const a = this.asm(id); if (!a) return;
      this.ask({ title: 'Delete this submission?', body: 'The video and its review status will be removed.', ok: 'Delete', danger: true, fn: () => {
        this.dropMedia(a.videoId); this.db.skill_assessments = this.db.skill_assessments.filter((x) => x.id !== id); this.toast('Submission deleted');
      } });
    },
    asmStatusLabel(a) {
      return ({ submitted: 'Waiting for Ustad', approved: 'Approved', rejected: 'Not approved', reassessment_requested: 'Practical test needed' })[a.status] || a.status;
    },
    asmStatusCls(a) {
      return ({ submitted: 'bg-indigo-100 text-indigo-800', approved: 'bg-emerald-100 text-emerald-800', rejected: 'bg-red-100 text-red-700', reassessment_requested: 'bg-amber-100 text-amber-900' })[a.status] || 'bg-slate-100';
    },

    /* ---------- jobs: apply / invitations ---------- */
    jobF: { trade: '', maxKm: '' },
    applyJob(jobId, assistedBy) {
      const w = assistedBy ? this.wk(assistedBy.workerId) : this.me; const j = this.jb(jobId);
      if (!w || !j) return;
      const c = this.workerCanApply(j, w);
      if (!c.ok) { this.toast(c.why, 'err'); return; }
      const ex = this.appFor(jobId, w.id);
      if (ex && ex.status !== 'withdrawn' && ex.status !== 'declined') { this.toast('You have already applied', 'err'); return; }
      if (ex) { ex.status = 'applied'; ex.updatedAt = iso(); ex.origin = 'worker'; }
      else this.db.job_applications.push({ id: uid('ap'), jobId, workerId: w.id, status: 'applied', origin: 'worker', assistedBy: assistedBy ? assistedBy.mitraId : null, createdAt: iso(), updatedAt: iso() });
      this.notify('contractor', j.contractorId, w.name + ' applied for ' + j.title, 'c_apps');
      this.toast('Applied. The contractor will see your Hunar Card.');
    },
    withdrawApp(appId) {
      const a = this.db.job_applications.find((x) => x.id === appId); if (!a || ['assigned'].includes(a.status)) return;
      this.ask({ title: 'Withdraw application?', body: 'The contractor will no longer see your application.', ok: 'Withdraw', danger: true, fn: () => { a.status = 'withdrawn'; a.updatedAt = iso(); this.toast('Application withdrawn'); } });
    },
    answerInvite(appId, accept) {
      const a = this.db.job_applications.find((x) => x.id === appId); if (!a || a.status !== 'invited') return;
      const j = this.jb(a.jobId); const w = this.wk(a.workerId);
      a.status = accept ? 'accepted' : 'declined'; a.updatedAt = iso();
      this.notify('contractor', j.contractorId, w.name + (accept ? ' accepted' : ' declined') + ' your invitation for ' + j.title, 'c_apps');
      this.toast(accept ? 'Invitation accepted' : 'Invitation declined');
    },
    myApps() { return this.me ? this.byDate(this.db.job_applications.filter((a) => a.workerId === this.me.id && a.status !== 'withdrawn'), 'updatedAt') : []; },

    /* ---------- work records (Kaam Ka Khata) ---------- */
    ev: { note: '', photos: [] },
    evReset() { this.ev = { note: '', photos: [] }; },
    async evAddPhotos(e) {
      const files = Array.from(e.target.files || []); e.target.value = '';
      for (const f of files.slice(0, 6 - this.ev.photos.length)) {
        try { const b = await resizeImage(f, 1024, 0.72); const id = uid('ph'); if (await this.storeMedia(id, b)) this.ev.photos.push(id); }
        catch (err) { this.toast(err.message, 'err'); }
      }
    },
    evRemove(i) { const id = this.ev.photos.splice(i, 1)[0]; this.dropMedia(id); },
    startWork(id) { const r = this.rec(id); if (!r || r.status !== 'assigned') return; r.status = 'in_progress'; this.notify('contractor', r.contractorId, this.wk(r.workerId).name + ' started ' + r.title, 'c_record', { id }); this.toast('Marked as started'); },
    submitEvidence(id) {
      const r = this.rec(id); if (!r) return;
      const e = {};
      if (!this.ev.note || this.ev.note.trim().length < 5) e.note = 'Write a short note about the work you finished';
      this.errs = e; if (Object.keys(e).length) { this.toast('Please add a short note', 'err'); return; }
      r.evidence = (r.evidence || []).concat(this.ev.photos); r.workerNote = this.ev.note.trim(); r.status = 'evidence_submitted'; r.endDate = todayStr(); r.correctionNote = '';
      this.notify('contractor', r.contractorId, this.wk(r.workerId).name + ' submitted completion proof for ' + r.title, 'c_record', { id });
      this.evReset(); this.toast('Sent to contractor for confirmation');
    },
    workerConfirm(id) {
      const r = this.rec(id); if (!r || r.status !== 'contractor_confirmed') return;
      this.ask({ title: 'Confirm this record?', body: 'You confirm that this work was completed as described. It will be added to your permanent work history.', ok: 'Yes, confirm', fn: () => {
        r.status = 'completed'; r.workerConfirmedAt = iso();
        this.notify('contractor', r.contractorId, this.wk(r.workerId).name + ' confirmed ' + r.title, 'c_record', { id });
        this.toast('Added to your Kaam Ka Khata');
      } });
    },
    recStatusLabel(r) {
      return ({ assigned: 'Assigned', in_progress: 'Work started', evidence_submitted: 'Waiting for contractor', correction_requested: 'Correction needed', contractor_confirmed: 'Contractor confirmed', completed: 'Verified' })[r.status] || r.status;
    },
    recStatusCls(r) {
      return ({ assigned: 'bg-slate-100 text-slate-700', in_progress: 'bg-indigo-100 text-indigo-800', evidence_submitted: 'bg-amber-100 text-amber-900', correction_requested: 'bg-red-100 text-red-700', contractor_confirmed: 'bg-amber-100 text-amber-900', completed: 'bg-emerald-600 text-white' })[r.status] || 'bg-slate-100';
    },
    recSteps(r) {
      const order = ['assigned', 'in_progress', 'evidence_submitted', 'contractor_confirmed', 'completed'];
      const idx = Math.max(order.indexOf(r.status === 'correction_requested' ? 'in_progress' : r.status), 0);
      return [
        { t: 'Job assigned', d: fdate(r.createdAt), done: true },
        { t: 'Work done and proof sent', d: r.status === 'assigned' || r.status === 'in_progress' || r.status === 'correction_requested' ? '' : fdate(r.endDate), done: idx >= 2 },
        { t: 'Contractor confirmed', d: r.contractorConfirmedAt ? fdate(r.contractorConfirmedAt) : '', done: idx >= 3 },
        { t: 'Worker confirmed', d: r.workerConfirmedAt ? fdate(r.workerConfirmedAt) : '', done: idx >= 4 },
      ];
    },
    reportProblem(recId) {
      const r = this.rec(recId);
      this.ask({ title: 'Ask a Hunar Mitra for help?', body: 'A Hunar Mitra will see that you have a problem with "' + r.title + '" and can help you talk to the contractor. They will not see your payment details.', ok: 'Send request', fn: () => {
        this.db.support_requests.unshift({ id: uid('sr'), workerId: r.workerId, type: 'work_problem', message: 'Problem with work record: ' + r.title, createdBy: 'worker', status: 'open', mitraId: null, createdAt: iso(), notes: [], date: '', place: '', ustadId: null });
        this.toast('Request sent to Hunar Mitra');
      } });
    },

    /* ---------- payments (Mera Hisaab). Shared by worker and contractor ---------- */
    payF: { kind: 'payment', amount: '', date: todayStr(), note: '' },
    payReset() { this.payF = { kind: 'payment', amount: '', date: todayStr(), note: '' }; },
    payOf(recordId) { return this.db.payment_records.find((p) => p.recordId === recordId) || null; },
    entryState(e) {
      if (e.disputed) return 'disputed';
      if (e.confirmedWorker && e.confirmedContractor) return 'confirmed';
      return e.confirmedWorker ? 'waiting_contractor' : 'waiting_worker';
    },
    entryLabel(e) { return ({ disputed: 'Disputed', confirmed: 'Confirmed by both', waiting_worker: 'Waiting for worker', waiting_contractor: 'Waiting for contractor' })[this.entryState(e)]; },
    entryCls(e) { return ({ disputed: 'bg-red-100 text-red-700', confirmed: 'bg-emerald-100 text-emerald-800', waiting_worker: 'bg-amber-100 text-amber-900', waiting_contractor: 'bg-amber-100 text-amber-900' })[this.entryState(e)]; },
    payTotals(recordId) {
      const p = this.payOf(recordId); if (!p) return null;
      const live = p.entries.filter((e) => !e.disputed);
      const advance = live.filter((e) => e.kind === 'advance').reduce((s, e) => s + e.amount, 0);
      const paid = live.filter((e) => e.kind === 'payment').reduce((s, e) => s + e.amount, 0);
      const confirmed = live.filter((e) => e.confirmedWorker && e.confirmedContractor).reduce((s, e) => s + e.amount, 0);
      const outstanding = p.agreed - advance - paid;
      const status = outstanding < 0 ? 'Overpaid, please check' : outstanding === 0 ? 'Fully paid' : advance + paid > 0 ? 'Part paid' : 'Not paid yet';
      const cls = outstanding < 0 ? 'bg-red-100 text-red-700' : outstanding === 0 ? 'bg-emerald-600 text-white' : advance + paid > 0 ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700';
      return { agreed: p.agreed, advance, paid, outstanding, confirmed, unconfirmed: advance + paid - confirmed, status, cls, dueDate: p.dueDate, waitingMe: 0 };
    },
    waitingFor(recordId, by) {
      const p = this.payOf(recordId); if (!p) return 0;
      return p.entries.filter((e) => !e.disputed && (by === 'worker' ? !e.confirmedWorker : !e.confirmedContractor)).length;
    },
    addPay(recordId, by) {
      const p = this.payOf(recordId); const f = this.payF; const e = {};
      const amt = Number(f.amount);
      if (!amt || amt <= 0 || !isFinite(amt)) e.amount = 'Enter an amount greater than zero';
      if (amt > 1000000) e.amount = 'Amount looks too large';
      if (!f.date) e.date = 'Choose the date';
      this.errs = e; if (Object.keys(e).length) { this.toast('Please fix the highlighted fields', 'err'); return; }
      p.entries.push({ id: uid('pe'), kind: f.kind, amount: Math.round(amt), date: f.date, note: (f.note || '').trim().slice(0, 120), by, confirmedWorker: by === 'worker', confirmedContractor: by === 'contractor', disputed: false });
      const r = this.rec(recordId);
      if (by === 'worker') this.notify('contractor', r.contractorId, this.wk(r.workerId).name + ' recorded a payment for ' + r.title + '. Please confirm.', 'c_paydetail', { id: recordId });
      else this.notify('worker', r.workerId, 'Contractor recorded ' + inr(amt) + ' for ' + r.title + '. Please confirm.', 'w_pay', { id: recordId });
      this.payReset(); this.toast('Entry added. It needs the other person to confirm.');
    },
    confirmPay(recordId, entryId, by) {
      const p = this.payOf(recordId); const e = p && p.entries.find((x) => x.id === entryId); if (!e || e.disputed) return;
      if (by === 'worker') e.confirmedWorker = true; else e.confirmedContractor = true;
      const r = this.rec(recordId);
      if (by === 'worker') this.notify('contractor', r.contractorId, this.wk(r.workerId).name + ' confirmed ' + inr(e.amount), 'c_paydetail', { id: recordId });
      else this.notify('worker', r.workerId, 'Contractor confirmed ' + inr(e.amount), 'w_pay', { id: recordId });
      this.toast('Confirmed');
    },
    disputePay(recordId, entryId, by) {
      const p = this.payOf(recordId); const e = p && p.entries.find((x) => x.id === entryId); if (!e) return;
      this.ask({ title: 'Mark this entry as wrong?', body: 'It will not be counted in the totals until it is corrected. Talk to the other person, or ask a Hunar Mitra for help.', ok: 'Mark as wrong', danger: true, fn: () => {
        e.disputed = true; e.disputedBy = by; this.toast('Entry marked as disputed');
      } });
    },
    delPay(recordId, entryId, by) {
      const p = this.payOf(recordId); const e = p && p.entries.find((x) => x.id === entryId); if (!e) return;
      const other = by === 'worker' ? e.confirmedContractor : e.confirmedWorker;
      if (e.by !== by || other) { this.toast('Only your own unconfirmed entries can be deleted', 'err'); return; }
      this.ask({ title: 'Delete this entry?', body: '', ok: 'Delete', danger: true, fn: () => { p.entries = p.entries.filter((x) => x.id !== entryId); this.toast('Entry deleted'); } });
    },
    setDue(recordId, v) { const p = this.payOf(recordId); if (p) p.dueDate = v; },
    myRecordsTodo() { return this.me ? this.recordsOfWorker(this.me.id).filter((r) => ['assigned', 'correction_requested', 'contractor_confirmed'].includes(r.status)) : []; },
    payTodo() { return this.me ? this.myPayRecords().reduce((s, r) => s + this.waitingFor(r.id, 'worker'), 0) : 0; },
    myPayRecords() { return this.me ? this.recordsOfWorker(this.me.id).filter((r) => this.payOf(r.id)) : []; },
    totalOutstanding(recs) { return recs.reduce((s, r) => { const t = this.payTotals(r.id); return s + (t ? Math.max(0, t.outstanding) : 0); }, 0); },

    /* ---------- worker help requests ---------- */
    reqF: { type: 'video_help', message: '' },
    sendHelp() {
      const w = this.me; const f = this.reqF; const e = {};
      if (!f.message || f.message.trim().length < 5) e.message = 'Please write what help you need (a few words)';
      this.errs = e; if (Object.keys(e).length) return;
      this.db.support_requests.unshift({ id: uid('sr'), workerId: w.id, type: f.type, message: f.message.trim(), createdBy: 'worker', status: 'open', mitraId: null, createdAt: iso(), notes: [], date: '', place: '', ustadId: null });
      this.reqF = { type: 'video_help', message: '' }; this.toast('Request sent to your nearest Hunar Mitra');
    },
    reqTypeLabel(t) { return ({ registration: 'Registration help', voice_help: 'Voice recording help', video_help: 'Video upload help', job_help: 'Finding or applying for work', payment_help: 'Payment problem', work_problem: 'Problem with a job', assessment_appointment: 'Skill test appointment', other: 'Other' })[t] || t; },
    reqStatusLabel(s) { return ({ open: 'Waiting for a Hunar Mitra', assigned: 'Hunar Mitra is helping', resolved: 'Done' })[s] || s; },
    requestMentor(ustadId) {
      const w = this.me; const f = this.mentF; const e = {};
      if (!f.topic || f.topic.trim().length < 4) e.topic = 'Write what you want to learn';
      this.errs = e; if (Object.keys(e).length) return;
      this.db.mentorships.unshift({ id: uid('mt'), workerId: w.id, ustadId, topic: f.topic.trim(), message: (f.message || '').trim(), status: 'requested', reply: '', createdAt: iso() });
      this.notify('ustad', ustadId, w.name + ' asked for mentorship', 'u_mentor');
      this.mentF = { topic: '', message: '' }; this.toast('Mentorship request sent');
    },
    mentF: { topic: '', message: '' },
  };
}
