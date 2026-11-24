'use strict';
/* ============================================================
   App core: state, persistence, navigation, lookups, matching.
   ============================================================ */

const LS_DB = 'hunarsetu.db.v1';
const LS_SESSION = 'hunarsetu.session.v1';
const LS_SETTINGS = 'hunarsetu.settings.v1';

const NAV = {
  worker: [
    { v: 'w_home', icon: 'fa-house', en: 'Home' },
    { v: 'w_jobs', icon: 'fa-briefcase', en: 'Find Work' },
    { v: 'w_card', icon: 'fa-id-card', en: 'My Hunar Card' },
    { v: 'w_khata', icon: 'fa-book', en: 'Kaam Ka Khata' },
    { v: 'w_hisaab', icon: 'fa-indian-rupee-sign', en: 'Mera Hisaab' },
    { v: 'w_help', icon: 'fa-circle-question', en: 'Help' },
  ],
  ustad: [
    { v: 'u_dash', icon: 'fa-gauge', en: 'Dashboard' },
    { v: 'u_pending', icon: 'fa-clipboard-list', en: 'Pending Assessments' },
    { v: 'u_verify', icon: 'fa-stamp', en: 'Verify Skills' },
    { v: 'u_workers', icon: 'fa-users', en: 'My Workers' },
    { v: 'u_mentor', icon: 'fa-handshake-angle', en: 'Mentorship' },
  ],
  contractor: [
    { v: 'c_dash', icon: 'fa-gauge', en: 'Dashboard' },
    { v: 'c_post', icon: 'fa-square-plus', en: 'Post a Job' },
    { v: 'c_find', icon: 'fa-magnifying-glass', en: 'Find Workers' },
    { v: 'c_apps', icon: 'fa-inbox', en: 'Applications' },
    { v: 'c_history', icon: 'fa-clock-rotate-left', en: 'Work History' },
    { v: 'c_pay', icon: 'fa-wallet', en: 'Payments' },
  ],
  mitra: [
    { v: 'm_dash', icon: 'fa-gauge', en: 'Dashboard' },
    { v: 'm_assist', icon: 'fa-user-plus', en: 'Assist Registration' },
    { v: 'm_help', icon: 'fa-hand-holding-heart', en: 'Help Workers' },
    { v: 'm_verify', icon: 'fa-clipboard-check', en: 'Verification Support' },
    { v: 'm_community', icon: 'fa-people-group', en: 'Community' },
  ],
};
const TAB_OF = {
  w_job: 'w_jobs', w_profile: 'w_card', w_assess: 'w_card', w_record: 'w_khata', w_pay: 'w_hisaab',
  u_review: 'u_pending', u_worker: 'u_workers', c_worker: 'c_find', c_record: 'c_history', c_paydetail: 'c_pay',
};
const ROLE_HOME = { worker: 'w_home', ustad: 'u_dash', contractor: 'c_dash', mitra: 'm_dash' };
const ROLE_INFO = {
  worker: { en: 'Worker', hi: 'कारीगर', icon: 'fa-helmet-safety' },
  ustad: { en: 'Ustad', hi: 'उस्ताद', icon: 'fa-user-tie' },
  contractor: { en: 'Contractor', hi: 'ठेकेदार', icon: 'fa-building' },
  mitra: { en: 'Hunar Mitra', hi: 'हुनर मित्र', icon: 'fa-people-group' },
};

function loadState() {
  let db = null, session = null, settings = null;
  try { db = JSON.parse(localStorage.getItem(LS_DB)); } catch (e) { db = null; }
  try { session = JSON.parse(localStorage.getItem(LS_SESSION)); } catch (e) { session = null; }
  try { settings = JSON.parse(localStorage.getItem(LS_SETTINGS)); } catch (e) { settings = null; }
  if (!db || db.version !== 1 || !Array.isArray(db.workers)) db = seedDb();
  if (!session) session = { role: 'worker', view: 'w_home', params: {}, workerId: null, contractorId: 'c_amit', ustadId: 'u_suresh', mitraId: 'm_anita', lang: 'en', bannerOff: false };
  if (!settings) settings = { baseUrl: '', sttUrl: '', visionUrl: '' };
  return { db, session, settings };
}

function partCore() {
  return {
    /* ----- ui state ----- */
    role: 'worker', view: 'w_home', params: {}, stack: [], lang: 'en',
    pub: null, toastMsg: '', toastKind: 'ok', toastTimer: null,
    dlg: null, drawer: false, bannerOff: false, busy: '', errs: {},
    qrFull: false, openFaq: -1, saveWarn: '',
    db: null, session: null, settings: null, urls: {},
    inr, fdate, initials, LOCALITIES, TRADES, TRADE_ICON, LANGS, SKILLS, FAQS, HELP_AUDIO, LEVELS, ROLE_INFO,

    init() {
      const st = loadState();
      this.db = st.db; this.session = st.session; this.settings = st.settings;
      this.role = this.session.role || 'worker';
      this.lang = this.session.lang || 'en';
      this.bannerOff = !!this.session.bannerOff;
      this.view = this.validView(this.role, this.session.view);
      this.params = this.session.params || {};
      this.routeFromHash();
      window.addEventListener('hashchange', () => this.routeFromHash());
      let t = null;
      this.$watch('db', () => { clearTimeout(t); t = setTimeout(() => this.persistNow(), 250); });
      this.$watch('settings', () => { try { localStorage.setItem(LS_SETTINGS, JSON.stringify(this.settings)); } catch (e) { /* ignore */ } });
      window.addEventListener('beforeunload', () => this.persistNow());
      this.preloadMedia();
      if (!localStorage.getItem(LS_DB)) this.persistNow();
    },
    validView(role, v) {
      return (NAV[role] || []).some((n) => n.v === v) || TAB_OF[v] && (NAV[role] || []).some((n) => n.v === TAB_OF[v]) ? v : ROLE_HOME[role];
    },
    _noPersist: false,
    persistNow() {
      if (this._noPersist) return;
      try {
        localStorage.setItem(LS_DB, JSON.stringify(this.db));
        this.session.role = this.role; this.session.view = this.view; this.session.params = this.params; this.session.lang = this.lang; this.session.bannerOff = this.bannerOff;
        localStorage.setItem(LS_SESSION, JSON.stringify(this.session));
        this.saveWarn = '';
      } catch (e) {
        this.saveWarn = 'Could not save to this phone (storage full?). Export your data from Demo & settings.';
      }
    },
    async preloadMedia() {
      try {
        const keys = await MediaDB.keys();
        for (const k of keys) { const b = await MediaDB.get(k); if (b) this.urls[k] = URL.createObjectURL(b); }
      } catch (e) { /* media store unavailable: text-only mode */ }
    },
    async storeMedia(id, blob) {
      try { await MediaDB.put(id, blob); } catch (e) { this.toast('Could not store the file on this device', 'err'); return false; }
      this.urls[id] = URL.createObjectURL(blob);
      return true;
    },
    async dropMedia(id) {
      if (!id) return;
      try { await MediaDB.del(id); } catch (e) { /* ignore */ }
      if (this.urls[id]) { try { URL.revokeObjectURL(this.urls[id]); } catch (e) { /* ignore */ } delete this.urls[id]; }
    },
    media(id) { return (id && this.urls[id]) || ''; },

    sttAvail() { return sttSupported(); },
    todayMax() { return todayStr(); },
    get payBy() { return this.role === 'contractor' ? 'contractor' : 'worker'; },
    appFilter: 'all', mentUstad: '',

    /* ----- language ----- */
    tr(s) { return (this.lang === 'hi' && typeof HI !== 'undefined' && HI[s]) || s; },
    setLang(l) { this.lang = l; this.persistNow(); },
    speak(text, lang) {
      try {
        if (!('speechSynthesis' in window)) { this.toast('This phone has no voice engine', 'err'); return; }
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang || 'hi-IN'; u.rate = 0.95;
        window.speechSynthesis.speak(u);
      } catch (e) { this.toast('Voice could not start', 'err'); }
    },
    stopSpeak() { try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } },

    /* ----- toast + confirm dialog ----- */
    toast(msg, kind) {
      this.toastMsg = msg; this.toastKind = kind || 'ok';
      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => { this.toastMsg = ''; }, 3200);
    },
    ask(o) { this.dlg = Object.assign({ title: 'Are you sure?', body: '', ok: 'Yes', danger: false, fn: null }, o); },
    dlgOk() { const f = this.dlg && this.dlg.fn; this.dlg = null; if (f) f(); },

    /* ----- navigation -----
       Two-phase: first blank the view so mounted screens are removed, then switch.
       This stops screens that are being removed from re-evaluating against data that changed. */
    _navTok: 0, _prev: null,
    navItems() { return NAV[this.role] || []; },
    activeTab() { return TAB_OF[this.view] || this.view; },
    nav(apply) {
      const t = ++this._navTok;
      // 1) let any pending data change finish rendering, 2) blank the view so screens unmount, 3) switch
      setTimeout(() => {
        if (t !== this._navTok) return;
        this.view = '__nav';
        setTimeout(() => { if (t !== this._navTok) return; apply(); this.errs = {}; this.persistNow(); window.scrollTo({ top: 0 }); }, 0);
      }, 0);
    },
    go(v, p) {
      const prev = { view: this.view === '__nav' ? ((this._prev || {}).view || ROLE_HOME[this.role]) : this.view, params: this.view === '__nav' ? ((this._prev || {}).params || {}) : this.params };
      this._prev = prev;
      this.nav(() => { this.stack.push(prev); if (this.stack.length > 30) this.stack.shift(); this.view = v; this.params = p || {}; });
    },
    tab(v) {
      if (v === 'c_post' && !this.jf) this.jfInit(null);
      this.nav(() => { this.stack = []; this.view = v; this.params = {}; });
    },
    back(after) {
      this.nav(() => {
        const s = this.stack.pop();
        if (s) { this.view = s.view; this.params = s.params; } else { this.view = ROLE_HOME[this.role]; this.params = {}; }
        if (after) after();
      });
    },
    setRole(r) {
      this.recDiscard(); this.stopSpeak();
      this.nav(() => { this.role = r; this.stack = []; this.view = ROLE_HOME[r]; this.params = {}; });
    },
    goAs(role, view, params) {
      this.drawer = false;
      this.nav(() => { this.role = role; this.stack = []; this.view = view; this.params = params || {}; });
    },
    routeFromHash() {
      const h = location.hash || '';
      const m = h.match(/^#\/v\/([^?]+)(?:\?d=(.+))?$/);
      if (!m) { this.pub = null; return; }
      const id = decodeURIComponent(m[1]);
      const w = this.db && this.db.workers.find((x) => x.id === id);
      if (w) { this.pub = { snap: this.snapshot(w), live: true }; return; }
      if (m[2]) {
        try { this.pub = { snap: JSON.parse(b64d(m[2])), live: false }; return; } catch (e) { /* fall through */ }
      }
      this.pub = { snap: null, live: false, missing: true };
    },
    closePublic() { history.replaceState(null, '', location.pathname + location.search); this.pub = null; },

    /* ----- current people ----- */
    get me() { return this.db.workers.find((w) => w.id === this.session.workerId) || null; },
    get ustad() { return this.db.ustads.find((u) => u.id === this.session.ustadId) || this.db.ustads[0]; },
    get contractor() { return this.db.contractors.find((c) => c.id === this.session.contractorId) || this.db.contractors[0]; },
    get mitra() { return this.db.hunar_mitras.find((m) => m.id === this.session.mitraId) || this.db.hunar_mitras[0]; },

    /* ----- lookups ----- */
    wk(id) { return this.db.workers.find((w) => w.id === id) || null; },
    ust(id) { return this.db.ustads.find((u) => u.id === id) || null; },
    con(id) { return this.db.contractors.find((c) => c.id === id) || null; },
    jb(id) { return this.db.jobs.find((j) => j.id === id) || null; },
    rec(id) { return this.db.work_records.find((r) => r.id === id) || null; },
    asm(id) { return this.db.skill_assessments.find((a) => a.id === id) || null; },
    sk(id) { return SKILLS.find((s) => s.id === id) || null; },
    skName(id) { const s = this.sk(id); return s ? s.name : String(id || '').replace(/^custom:/, ''); },
    skHi(id) { const s = this.sk(id); return s ? s.hi : this.skName(id); },
    skillsOfTrade(t) { return SKILLS.filter((s) => s.trade === t); },
    loc(name) { return LOCALITIES.find((l) => l.name.toLowerCase() === String(name || '').trim().toLowerCase()) || null; },
    distKm(a, b) { const d = haversineKm(this.loc(a), this.loc(b)); return d === null ? null : Math.round(d); },
    jobTotal(j) { return j.payType === 'daily' ? j.amount * j.durationDays : j.amount; },
    payText(j) { return j.payType === 'daily' ? inr(j.amount) + ' per day x ' + j.durationDays + ' days' : inr(j.amount) + ' fixed'; },
    byDate(arr, key) { return arr.slice().sort((a, b) => String(b[key]).localeCompare(String(a[key]))); },
    timeAgo(d) {
      const mins = Math.round((Date.now() - new Date(d).getTime()) / 60000);
      if (mins < 2) return 'just now'; if (mins < 60) return mins + ' min ago';
      const h = Math.round(mins / 60); if (h < 24) return h + ' hr ago';
      const days = Math.round(h / 24); return days === 1 ? 'yesterday' : days + ' days ago';
    },

    /* ----- events (the "Updates" feed) ----- */
    notify(role, id, text, view, params) {
      this.db.events.unshift({ id: uid('ev'), at: iso(), role, to: id, text, view: view || '', params: params || {} });
      if (this.db.events.length > 120) this.db.events.length = 120;
    },
    eventsFor(role, id) { return this.db.events.filter((e) => e.role === role && e.to === id).slice(0, 8); },

    /* ----- verification levels (Ustad-reviewed vs pre-screened vs self-declared) ----- */
    skillLevel(workerId, skillId) {
      const ends = this.db.endorsements.filter((e) => e.active && e.workerId === workerId && e.skillId === skillId);
      if (ends.length) {
        const best = ends.slice().sort((a, b) => LEVELS[b.level].rank - LEVELS[a.level].rank)[0];
        return { level: best.level, end: best };
      }
      const pend = this.db.skill_assessments.find((a) => a.workerId === workerId && a.skillId === skillId && ['submitted', 'reassessment_requested'].includes(a.status));
      if (pend) return { level: 'submitted', end: null };
      return { level: 'claimed', end: null };
    },
    isVerified(w) { return !!w && this.db.endorsements.some((e) => e.active && e.workerId === w.id); },
    verifiedSkillIds(w) { return Array.from(new Set(this.db.endorsements.filter((e) => e.active && e.workerId === w.id).map((e) => e.skillId))); },
    endorsementsOf(wid) { return this.byDate(this.db.endorsements.filter((e) => e.active && e.workerId === wid), 'date'); },
    assessmentsOf(wid) { return this.byDate(this.db.skill_assessments.filter((a) => a.workerId === wid), 'submittedAt'); },
    recordsOfWorker(wid) { return this.byDate(this.db.work_records.filter((r) => r.workerId === wid), 'createdAt'); },
    completedOf(wid) { return this.recordsOfWorker(wid).filter((r) => r.status === 'completed'); },
    avgRating(wid) {
      const r = this.completedOf(wid).filter((x) => x.rating);
      return r.length ? Math.round((r.reduce((a, b) => a + b.rating, 0) / r.length) * 10) / 10 : null;
    },
    levelChip(l) { return LEVELS[l] || LEVELS.claimed; },
    availLabel(w) { return w.availability === 'available' ? 'Available now' : w.availability === 'soon' ? 'Available soon' : 'Busy'; },
    availCls(w) { return w.availability === 'available' ? 'bg-emerald-100 text-emerald-800' : w.availability === 'soon' ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-700'; },

    /* ----- public snapshot + QR ----- */
    snapshot(w) {
      const ends = this.endorsementsOf(w.id);
      const done = this.completedOf(w.id);
      const L = { claimed: 'c', submitted: 's', reviewed: 'r', practical: 'p' };
      return {
        v: 2, id: w.id, n: w.name, t: w.trade, l: w.location, e: w.experienceYears, d: w.isDemo ? 1 : 0, at: todayStr(),
        s: w.skills.map((id) => [id.replace(/^custom:/, '~'), L[this.skillLevel(w.id, id).level]]),
        u: ends.slice(0, 2).map((e) => [e.ustadId, e.date, e.skillId, L[e.level], e.audioId ? 1 : 0]),
        c: done.length, r: this.avgRating(w.id),
      };
    },
    /* Turn a compact snapshot into display rows. Works for the live profile and for data carried inside a QR link. */
    pubView(snap) {
      const LV = { c: 'claimed', s: 'submitted', r: 'reviewed', p: 'practical' };
      const nm = (id) => (id[0] === '~' ? id.slice(1) : this.skName(id));
      return {
        skills: (snap.s || []).map((x) => ({ name: nm(x[0]), level: LV[x[1]] || 'claimed' })),
        ends: (snap.u || []).map((x) => { const u = this.ust(x[0]); return { ustad: u ? u.name : 'Ustad', sample: u ? !!u.sample : false, date: x[1], skill: nm(x[2]), level: LV[x[3]] || 'reviewed', audio: !!x[4] }; }),
      };
    },
    baseUrl() {
      const b = (this.settings.baseUrl || '').trim();
      if (/^https?:\/\//i.test(b)) { const u = b.replace(/#.*$/, ''); return /^https?:\/\/[^/]+$/i.test(u) ? u + '/' : u; }
      return location.href.replace(/#.*$/, '');
    },
    cardUrl(w) {
      if (!w) return '';
      return this.baseUrl() + '#/v/' + encodeURIComponent(w.id) + '?d=' + b64e(JSON.stringify(this.snapshot(w)));
    },
    qrFor(w) { return w ? qrSvgFor(this.cardUrl(w)) : ''; },
    qrLocalWarn() { return location.protocol === 'file:' && !this.settings.baseUrl; },
    async copyText(t) {
      try { await navigator.clipboard.writeText(t); this.toast('Link copied'); } catch (e) { this.toast('Copy is not available here', 'err'); }
    },
    async shareCard(w) {
      const url = this.cardUrl(w);
      if (navigator.share) { try { await navigator.share({ title: 'HunarSetu card: ' + w.name, text: w.name + ' on HunarSetu', url }); return; } catch (e) { /* cancelled */ } }
      this.copyText(url);
    },
    waLink(text, phone) {
      const p = String(phone || '').replace(/\D/g, '');
      return 'https://wa.me/' + (p.length === 10 ? '91' + p : p) + '?text=' + encodeURIComponent(text);
    },

    /* ----- matching (plain filtering plus a visible points score, no AI) ----- */
    jobFit(job, w) {
      const reasons = [];
      if (!w) return { reasons, ok: true, dist: null, score: 0 };
      const trade = job.trade === w.trade;
      const dist = this.distKm(w.location, job.location);
      const expOk = w.experienceYears >= job.minExperience;
      if (trade) reasons.push('Matches your trade');
      if (dist !== null) reasons.push(dist + ' km from ' + w.location);
      if (expOk) reasons.push('You meet the experience needed'); else reasons.push('Needs ' + job.minExperience + '+ years');
      const inRadius = dist !== null && dist <= (w.radiusKm || 15);
      const score = (trade ? 50 : 0) + (inRadius ? 20 : 0) + (expOk ? 15 : 0) + job.skills.filter((s) => w.skills.includes(s)).length * 5;
      return { reasons, dist, trade, expOk, inRadius, score };
    },
    workerCanApply(job, w) {
      if (!w) return { ok: false, why: 'Create your profile first' };
      if (job.status !== 'open') return { ok: false, why: 'This job is closed' };
      if (job.requireVerified && !this.isVerified(w)) return { ok: false, why: 'This job needs an Ustad-verified skill. Take a skill test first.' };
      return { ok: true, why: '' };
    },
    appFor(jobId, workerId) { return this.db.job_applications.find((a) => a.jobId === jobId && a.workerId === workerId) || null; },
    appLabel(a) {
      return ({ applied: 'Applied', shortlisted: 'Shortlisted', invited: 'Invited you', accepted: 'Accepted', assigned: 'Assigned', rejected: 'Not selected', declined: 'You declined', withdrawn: 'Withdrawn' })[a.status] || a.status;
    },
    appCls(a) {
      return ({ applied: 'bg-slate-100 text-slate-700', shortlisted: 'bg-indigo-100 text-indigo-800', invited: 'bg-amber-100 text-amber-900', accepted: 'bg-emerald-100 text-emerald-800', assigned: 'bg-emerald-600 text-white', rejected: 'bg-red-100 text-red-700', declined: 'bg-slate-200 text-slate-600', withdrawn: 'bg-slate-200 text-slate-600' })[a.status] || 'bg-slate-100 text-slate-700';
    },
    openJobsForWorker() {
      const w = this.me; const f = this.jobF || {};
      return this.db.jobs.filter((j) => j.status === 'open' || (w && this.appFor(j.id, w.id) && this.appFor(j.id, w.id).status !== 'withdrawn'))
        .filter((j) => !f.trade || j.trade === f.trade)
        .filter((j) => {
          if (!f.maxKm || !w) return true; const d = this.distKm(w.location, j.location); return d === null || d <= Number(f.maxKm);
        })
        .map((j) => Object.assign({}, j, { fit: this.jobFit(j, w) }))
        .sort((a, b) => b.fit.score - a.fit.score);
    },
    rankWorkers() {
      const f = this.findF; const job = f.jobId ? this.jb(f.jobId) : null;
      const trade = f.trade || (job && job.trade) || '';
      const loc = f.location || (job && job.location) || '';
      const needSkills = f.skill ? [f.skill] : (job ? job.skills : []);
      const out = [];
      this.db.workers.forEach((w) => {
        if (f.trade && w.trade !== f.trade) return;
        if (f.skill && !w.skills.includes(f.skill)) return;
        if (f.minExp && w.experienceYears < Number(f.minExp)) return;
        if (f.availability === 'available' && w.availability !== 'available') return;
        if (f.verified === 'yes' && !this.isVerified(w)) return;
        if (f.location) {
          const d0 = this.distKm(w.location, f.location);
          if (d0 === null ? w.location.toLowerCase() !== f.location.toLowerCase() : d0 > Number(f.radius || 15)) return;
        }
        let score = 0; const why = [];
        if (trade && w.trade === trade) { score += 30; why.push(['Trade matches', 30]); }
        needSkills.forEach((s) => {
          if (w.skills.includes(s)) {
            score += 10; why.push([this.skName(s) + ' listed', 10]);
            const lv = this.skillLevel(w.id, s).level;
            if (lv === 'reviewed' || lv === 'practical') { score += 10; why.push([this.skName(s) + ' verified by Ustad', 10]); }
          }
        });
        if (this.isVerified(w)) { score += 15; why.push(['Has Ustad endorsement', 15]); }
        if (loc) {
          const d = this.distKm(w.location, loc);
          if (d !== null && d <= (w.radiusKm || 15)) { score += 20; why.push([d + ' km, inside worker radius', 20]); }
          else if (d !== null && d <= (w.radiusKm || 15) * 2) { score += 5; why.push([d + ' km, a bit far', 5]); }
        }
        if (w.availability === 'available') { score += 10; why.push(['Available now', 10]); } else if (w.availability === 'soon') { score += 5; why.push(['Available soon', 5]); }
        const need = job ? job.minExperience : (f.minExp ? Number(f.minExp) : 0);
        if (need && w.experienceYears >= need) { score += 10; why.push(['Experience ' + w.experienceYears + ' yrs meets ' + need + '+', 10]); }
        const c = this.completedOf(w.id).length;
        out.push({ w, score, why, jobsDone: c, rating: this.avgRating(w.id), dist: loc ? this.distKm(w.location, loc) : null });
      });
      return out.sort((a, b) => b.score - a.score || b.w.experienceYears - a.w.experienceYears);
    },
    canSeePhone(w) {
      if (!w || !w.phone) return false;
      if (this.role === 'worker') return this.me && this.me.id === w.id;
      if (this.role === 'mitra') return w.assistedBy === this.mitra.id;
      if (this.role === 'contractor') return this.db.job_applications.some((a) => a.workerId === w.id && ['accepted', 'assigned', 'applied', 'invited', 'shortlisted'].includes(a.status) && this.jb(a.jobId) && this.jb(a.jobId).contractorId === this.contractor.id);
      return false;
    },
  };
}
