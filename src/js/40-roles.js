'use strict';
/* ============================================================
   Ustad review workflow, contractor hiring workflow, Hunar Mitra
   support, demo story helper, export/reset.
   ============================================================ */

function partRoles() {
  return {
    /* ---------- Ustad: review an assessment ---------- */
    rv: null,
    rvInit(a) {
      if (this.rv && this.rv.audio && this.rv.audio.url) { try { URL.revokeObjectURL(this.rv.audio.url); } catch (e) { /* ignore */ } }
      this.rv = { id: a.id, skillId: a.skillId, level: 'reviewed', comment: '', date: todayStr(), audio: null, checklist: this.sk(a.skillId) ? this.sk(a.skillId).checklist.map((c) => ({ t: c, v: null })) : [] };
      this.errs = {};
    },
    openReview(id) { const a = this.asm(id); if (!a) return; this.rvInit(a); this.go('u_review', { id }); },
    ustadQueue() { return this.byDate(this.db.skill_assessments.filter((a) => a.ustadId === this.ustad.id && ['submitted', 'reassessment_requested'].includes(a.status)), 'submittedAt'); },
    ustadDone(status) { return this.byDate(this.db.skill_assessments.filter((a) => a.ustadId === this.ustad.id && a.status === status), 'submittedAt'); },
    ustadWorkerIds() {
      const s = new Set();
      this.db.skill_assessments.forEach((a) => { if (a.ustadId === this.ustad.id) s.add(a.workerId); });
      this.db.endorsements.forEach((e) => { if (e.ustadId === this.ustad.id) s.add(e.workerId); });
      this.db.mentorships.forEach((m) => { if (m.ustadId === this.ustad.id) s.add(m.workerId); });
      return Array.from(s);
    },
    async finishReview(decision) {
      const a = this.asm(this.rv.id); const r = this.rv; const w = this.wk(a.workerId);
      const e = {};
      if (decision === 'approve') {
        if (!r.skillId) e.skillId = 'Choose the exact skill being endorsed';
        if (!r.date) e.date = 'Enter the assessment date';
        if (!r.comment.trim() && !r.audio) e.comment = 'Add a written comment or record a voice note';
        if (r.date && r.date > todayStr()) e.date = 'Date cannot be in the future';
      } else if (!r.comment.trim() && !r.audio) e.comment = 'Please say why (a written note or a voice note)';
      this.errs = e; if (Object.keys(e).length) { this.toast('Please complete the highlighted fields', 'err'); return; }
      let audioId = null;
      if (r.audio) { audioId = uid('aud'); if (!(await this.storeMedia(audioId, r.audio.blob))) return; }
      const reviewed = { decision, level: r.level, comment: r.comment.trim(), date: r.date, audioId, audioDur: r.audio ? r.audio.dur : 0, checklist: r.checklist.filter((c) => c.v !== null) };
      a.review = reviewed; a.ustadId = this.ustad.id;
      const hist = a.history || (a.history = []);
      if (decision === 'approve') {
        a.status = 'approved'; a.skillId = r.skillId;
        if (!w.skills.includes(r.skillId)) w.skills.push(r.skillId);
        this.db.endorsements.forEach((x) => { if (x.workerId === w.id && x.skillId === r.skillId && x.ustadId === this.ustad.id) x.active = false; });
        this.db.endorsements.push({ id: uid('e'), workerId: w.id, ustadId: this.ustad.id, skillId: r.skillId, assessmentId: a.id, level: r.level, comment: reviewed.comment, audioId, date: r.date, active: true, sample: !!this.ustad.sample });
        hist.push({ at: iso(), text: 'Approved by ' + this.ustad.name + (r.level === 'practical' ? ' after a practical test' : ' after watching the video') });
        this.notify('worker', w.id, this.ustad.name + ' endorsed your ' + this.skName(r.skillId) + ' skill', 'w_card');
        this.toast('Skill approved. ' + w.name + '’s Hunar Card is updated.');
      } else if (decision === 'reassess') {
        a.status = 'reassessment_requested';
        hist.push({ at: iso(), text: 'Practical reassessment requested by ' + this.ustad.name });
        this.notify('worker', w.id, this.ustad.name + ' wants to see your ' + this.skName(a.skillId) + ' work in person', 'w_card');
        this.toast('Reassessment requested');
      } else {
        a.status = 'rejected';
        hist.push({ at: iso(), text: 'Not approved by ' + this.ustad.name });
        this.notify('worker', w.id, this.ustad.name + ' did not approve your ' + this.skName(a.skillId) + ' video. You can try again.', 'w_card');
        this.toast('Skill not approved. The worker is told why.');
      }
      this.back(() => { this.rv = null; });
    },
    revokeEndorsement(id) {
      const e = this.db.endorsements.find((x) => x.id === id); if (!e || e.ustadId !== this.ustad.id) return;
      this.ask({ title: 'Withdraw this endorsement?', body: 'The worker will lose this verified badge. Use this only if you made a mistake.', ok: 'Withdraw', danger: true, fn: () => {
        e.active = false; this.notify('worker', e.workerId, this.ustad.name + ' withdrew an endorsement for ' + this.skName(e.skillId), 'w_card'); this.toast('Endorsement withdrawn');
      } });
    },
    replyMentor(id, accept) {
      const m = this.db.mentorships.find((x) => x.id === id); if (!m) return;
      const reply = (this.mentReply[id] || '').trim();
      if (accept && reply.length < 3) { this.errs = { ['mr' + id]: 'Write a short reply for the worker' }; return; }
      m.status = accept ? 'accepted' : 'declined'; m.reply = reply;
      this.notify('worker', m.workerId, this.ustad.name + (accept ? ' accepted your mentorship request' : ' cannot take mentorship right now'), 'w_help');
      this.toast(accept ? 'Mentorship accepted' : 'Request declined');
    },
    mentReply: {},

    /* ---------- Contractor: post / edit jobs ---------- */
    jf: null,
    jfInit(j) {
      this.jf = j ? JSON.parse(JSON.stringify(j)) : { id: '', title: '', trade: 'Electrician', skills: [], workersNeeded: 1, location: 'Dwarka', payType: 'daily', amount: '', durationDays: 1, minExperience: 0, requireVerified: false, description: '', startDate: todayStr() };
      this.errs = {};
    },
    jfTrade(t) { this.jf.trade = t; this.jf.skills = []; },
    saveJob() {
      const f = this.jf; const e = {};
      if (!f.title || f.title.trim().length < 4) e.title = 'Write a job title (at least 4 letters)';
      if (!f.skills.length) e.skills = 'Choose at least one skill needed';
      if (!(Number(f.workersNeeded) >= 1 && Number(f.workersNeeded) <= 50)) e.workersNeeded = 'Enter 1 to 50 workers';
      if (!f.location || f.location.trim().length < 2) e.location = 'Enter the work location';
      if (!(Number(f.amount) > 0)) e.amount = 'Enter the payment amount';
      if (!(Number(f.durationDays) >= 1 && Number(f.durationDays) <= 365)) e.durationDays = 'Enter 1 to 365 days';
      if (f.minExperience === '' || Number(f.minExperience) < 0 || Number(f.minExperience) > 50) e.minExperience = 'Enter minimum years (0 or more)';
      if (!f.description || f.description.trim().length < 10) e.description = 'Describe the work (at least 10 letters)';
      if (!f.startDate) e.startDate = 'Choose the start date';
      this.errs = e; if (Object.keys(e).length) { this.toast('Please fix the highlighted fields', 'err'); return; }
      const rec = { title: f.title.trim(), trade: f.trade, skills: f.skills.slice(), workersNeeded: Number(f.workersNeeded), location: f.location.trim(), payType: f.payType, amount: Number(f.amount), durationDays: Number(f.durationDays), minExperience: Number(f.minExperience), requireVerified: !!f.requireVerified, description: f.description.trim(), startDate: f.startDate };
      if (f.id) { Object.assign(this.jb(f.id), rec); this.toast('Job updated'); }
      else {
        const j = Object.assign({ id: uid('j'), contractorId: this.contractor.id, status: 'open', createdAt: iso(), isDemo: false }, rec);
        this.db.jobs.push(j);
        const hits = this.db.workers.filter((w) => w.trade === j.trade && w.availability !== 'busy').length;
        this.toast('Job posted. ' + hits + ' ' + j.trade.toLowerCase() + (hits === 1 ? '' : 's') + ' nearby can see it.');
      }
      this.jfInit(null); this.tab('c_dash');
    },
    myJobs() { return this.byDate(this.db.jobs.filter((j) => j.contractorId === this.contractor.id), 'createdAt'); },
    jobApps(jobId) { return this.db.job_applications.filter((a) => a.jobId === jobId && a.status !== 'withdrawn'); },
    appsForContractor(filter) {
      const jids = this.myJobs().map((j) => j.id);
      return this.byDate(this.db.job_applications.filter((a) => jids.includes(a.jobId) && a.status !== 'withdrawn'), 'updatedAt').filter((a) => !filter || filter === 'all' || a.status === filter);
    },
    toggleJobStatus(id) {
      const j = this.jb(id); if (!j) return;
      j.status = j.status === 'open' ? 'closed' : 'open'; this.toast(j.status === 'open' ? 'Job reopened' : 'Job closed');
    },
    deleteJob(id) {
      const j = this.jb(id); if (!j) return;
      const used = this.db.work_records.some((r) => r.jobId === id);
      if (used) { this.toast('This job has work records. Close it instead of deleting.', 'err'); return; }
      this.ask({ title: 'Delete this job?', body: 'Applications to it will be removed.', ok: 'Delete', danger: true, fn: () => {
        this.db.jobs = this.db.jobs.filter((x) => x.id !== id); this.db.job_applications = this.db.job_applications.filter((a) => a.jobId !== id); this.toast('Job deleted');
      } });
    },

    /* ---------- Contractor: hiring workflow ---------- */
    setApp(appId, status) {
      const a = this.db.job_applications.find((x) => x.id === appId); if (!a) return;
      const j = this.jb(a.jobId); const w = this.wk(a.workerId);
      a.status = status; a.updatedAt = iso();
      const msg = { shortlisted: ' shortlisted you for ', accepted: ' accepted your application for ', rejected: ' did not select you for ' }[status];
      if (msg) this.notify('worker', w.id, this.contractor.name + msg + j.title, 'w_jobs');
      this.toast({ shortlisted: 'Shortlisted', accepted: 'Application accepted', rejected: 'Application rejected' }[status] || 'Updated');
    },
    assignWorker(appId) {
      const a = this.db.job_applications.find((x) => x.id === appId); if (!a) return;
      const j = this.jb(a.jobId); const w = this.wk(a.workerId);
      if (!['accepted', 'shortlisted', 'applied'].includes(a.status)) { this.toast('This worker cannot be assigned from here', 'err'); return; }
      const assigned = this.db.job_applications.filter((x) => x.jobId === j.id && x.status === 'assigned').length;
      if (assigned >= j.workersNeeded) { this.toast('All ' + j.workersNeeded + ' places for this job are filled', 'err'); return; }
      this.ask({ title: 'Assign ' + w.name + '?', body: 'A work record will start for "' + j.title + '" at ' + this.payText(j) + ' (total ' + inr(this.jobTotal(j)) + '). ' + w.name + ' and you will both see the same record.', ok: 'Assign job', fn: () => {
        a.status = 'assigned'; a.updatedAt = iso();
        const rid = uid('r');
        this.db.work_records.push({ id: rid, jobId: j.id, workerId: w.id, contractorId: j.contractorId, title: j.title, work: j.description, location: j.location, startDate: j.startDate, endDate: '', agreedAmount: this.jobTotal(j), status: 'assigned', evidence: [], workerNote: '', contractorConfirmedAt: null, workerConfirmedAt: null, rating: null, feedback: '', correctionNote: '', isDemo: false, createdAt: iso() });
        this.db.payment_records.push({ id: uid('p'), recordId: rid, agreed: this.jobTotal(j), dueDate: '', entries: [] });
        if (assigned + 1 >= j.workersNeeded) j.status = 'filled';
        if (this.db.story.workerId === w.id && !this.db.story.recordId) this.db.story.recordId = rid;
        this.notify('worker', w.id, 'You are assigned: ' + j.title + ' (' + inr(this.jobTotal(j)) + ')', 'w_record', { id: rid });
        this.toast(w.name + ' is assigned. Work record started.');
      } });
    },
    invite(workerId, jobId) {
      const j = this.jb(jobId); const w = this.wk(workerId);
      if (!j || !w) { this.toast('Choose a job to invite for', 'err'); return; }
      if (j.status !== 'open') { this.toast('This job is not open', 'err'); return; }
      const ex = this.appFor(jobId, workerId);
      if (ex && !['withdrawn', 'declined', 'rejected'].includes(ex.status)) { this.toast(w.name + ' already has an application or invite for this job', 'err'); return; }
      if (ex) { ex.status = 'invited'; ex.origin = 'contractor'; ex.updatedAt = iso(); }
      else this.db.job_applications.push({ id: uid('ap'), jobId, workerId, status: 'invited', origin: 'contractor', createdAt: iso(), updatedAt: iso() });
      this.notify('worker', workerId, this.contractor.name + ' invited you for ' + j.title, 'w_jobs');
      this.toast('Invitation sent to ' + w.name);
    },
    myRecords() { return this.byDate(this.db.work_records.filter((r) => r.contractorId === this.contractor.id), 'createdAt'); },
    contractorConfirm(id) {
      const r = this.rec(id); const f = this.cf; const e = {};
      if (!(Number(f.rating) >= 1 && Number(f.rating) <= 5)) e.rating = 'Choose a rating from 1 to 5';
      this.errs = e; if (Object.keys(e).length) return;
      r.status = 'contractor_confirmed'; r.contractorConfirmedAt = iso(); r.rating = Number(f.rating); r.feedback = (f.feedback || '').trim(); r.correctionNote = '';
      this.notify('worker', r.workerId, this.contractor.name + ' confirmed your work on ' + r.title + '. Please confirm the record.', 'w_record', { id });
      this.cf = { rating: 0, feedback: '', correction: '' }; this.toast('Work confirmed. Waiting for the worker to confirm.');
    },
    requestCorrection(id) {
      const r = this.rec(id); const f = this.cf; const e = {};
      if (!f.correction || f.correction.trim().length < 5) e.correction = 'Tell the worker what to correct';
      this.errs = e; if (Object.keys(e).length) return;
      r.status = 'correction_requested'; r.correctionNote = f.correction.trim();
      this.notify('worker', r.workerId, this.contractor.name + ' asked for a correction on ' + r.title, 'w_record', { id });
      this.cf = { rating: 0, feedback: '', correction: '' }; this.toast('Correction requested');
    },
    cf: { rating: 0, feedback: '', correction: '' },
    contractorPayRecords() { return this.myRecords().filter((r) => this.payOf(r.id)); },

    /* ---------- Contractor: find workers ---------- */
    findF: { trade: '', skill: '', location: '', radius: 15, minExp: '', availability: '', verified: '', jobId: '' },
    resetFind() { this.findF = { trade: '', skill: '', location: '', radius: 15, minExp: '', availability: '', verified: '', jobId: '' }; },
    findFromJob(id) {
      this.resetFind(); this.findF.jobId = id;
      const j = this.jb(id); if (j) { this.findF.trade = j.trade; this.findF.location = j.location; this.findF.minExp = j.minExperience || ''; }
    },
    inviteJobId: '',

    /* ---------- Hunar Mitra ---------- */
    mitraWorkers() { return this.db.workers.filter((w) => w.assistedBy === this.mitra.id || this.db.support_requests.some((s) => s.workerId === w.id && s.mitraId === this.mitra.id)); },
    nearbyWorkers() { return this.db.workers.filter((w) => this.distKm(w.location, this.mitra.location) !== null && this.distKm(w.location, this.mitra.location) <= 25); },
    openRequests() { return this.byDate(this.db.support_requests.filter((s) => s.status === 'open'), 'createdAt'); },
    myRequests() { return this.byDate(this.db.support_requests.filter((s) => s.mitraId === this.mitra.id && s.status !== 'resolved'), 'createdAt'); },
    doneRequests() { return this.byDate(this.db.support_requests.filter((s) => s.mitraId === this.mitra.id && s.status === 'resolved'), 'createdAt'); },
    takeRequest(id) { const s = this.db.support_requests.find((x) => x.id === id); if (!s) return; s.status = 'assigned'; s.mitraId = this.mitra.id; this.notify('worker', s.workerId, 'Anita Verma will help you with your request', 'w_help'); this.toast('You are now helping with this request'); },
    resolveRequest(id) {
      const s = this.db.support_requests.find((x) => x.id === id); if (!s) return;
      const n = (this.noteF[id] || '').trim();
      if (n) s.notes.push({ at: iso(), text: n });
      s.status = 'resolved'; this.noteF[id] = ''; this.notify('worker', s.workerId, 'Your help request was marked done', 'w_help'); this.toast('Marked as done');
    },
    addNote(id) { const s = this.db.support_requests.find((x) => x.id === id); const n = (this.noteF[id] || '').trim(); if (!s || n.length < 2) return; s.notes.push({ at: iso(), text: n }); this.noteF[id] = ''; this.toast('Note added'); },
    noteF: {},
    apptF: { workerId: '', ustadId: '', date: '', place: 'Najafgarh community hall' },
    bookAppointment() {
      const f = this.apptF; const e = {};
      if (!f.workerId) e.workerId = 'Choose a worker';
      if (!f.ustadId) e.ustadId = 'Choose an Ustad';
      if (!f.date) e.date = 'Choose a date'; else if (f.date < todayStr()) e.date = 'Date cannot be in the past';
      if (!f.place || f.place.trim().length < 3) e.place = 'Enter the place';
      this.errs = e; if (Object.keys(e).length) return;
      const w = this.wk(f.workerId); const u = this.ust(f.ustadId);
      this.db.support_requests.unshift({ id: uid('sr'), workerId: w.id, type: 'assessment_appointment', message: 'Practical skill test with ' + u.name, createdBy: 'mitra', status: 'assigned', mitraId: this.mitra.id, createdAt: iso(), notes: [], date: f.date, place: f.place.trim(), ustadId: u.id });
      this.notify('worker', w.id, 'Skill test booked on ' + fdate(f.date) + ' at ' + f.place.trim() + ' with ' + u.name, 'w_help');
      this.notify('ustad', u.id, 'Practical test booked with ' + w.name + ' on ' + fdate(f.date), 'u_pending');
      this.apptF = { workerId: '', ustadId: '', date: '', place: 'Najafgarh community hall' }; this.toast('Appointment booked. Worker and Ustad are told.');
    },
    postF: { title: '', text: '', date: '' },
    postAnnouncement() {
      const f = this.postF; const e = {};
      if (!f.title || f.title.trim().length < 4) e.title = 'Write a title';
      if (!f.text || f.text.trim().length < 10) e.text = 'Write what is happening (at least 10 letters)';
      this.errs = e; if (Object.keys(e).length) return;
      this.db.community.unshift({ id: uid('cm'), mitraId: this.mitra.id, title: f.title.trim(), text: f.text.trim(), date: f.date || '', createdAt: iso() });
      this.postF = { title: '', text: '', date: '' }; this.toast('Announcement posted');
    },
    delAnnouncement(id) { this.ask({ title: 'Delete announcement?', body: '', ok: 'Delete', danger: true, fn: () => { this.db.community = this.db.community.filter((c) => c.id !== id); this.toast('Deleted'); } }); },
    /* Mitra can start an assessment on a worker's behalf, only if that worker was registered through her with consent. */
    mitraCanAct(w) { return !!w && w.assistedBy === this.mitra.id; },

    /* ---------- Demo story: who is "Ramesh" ---------- */
    demoLinkedWorker() { return this.session.workerId ? this.wk(this.session.workerId) : null; },
    storyChecklist() {
      const s = this.db.story; const w = this.me;
      const asm = s.assessmentId ? this.asm(s.assessmentId) : (w ? this.db.skill_assessments.find((a) => a.workerId === w.id && !a.sample) : null);
      const rec = s.recordId ? this.rec(s.recordId) : (w ? this.db.work_records.find((r) => r.workerId === w.id && !r.isDemo) : null);
      const pay = rec ? this.payTotals(rec.id) : null;
      const posted = this.db.jobs.some((j) => !j.isDemo);
      const app = w ? this.db.job_applications.find((a) => a.workerId === w.id && this.jb(a.jobId) && !this.jb(a.jobId).isDemo) : null;
      return [
        { n: 1, t: 'Worker creates a voice profile', who: 'worker', view: 'w_home', done: !!w },
        { n: 2, t: 'Worker submits a skill video', who: 'worker', view: 'w_card', done: !!asm },
        { n: 3, t: 'Ustad reviews and endorses', who: 'ustad', view: 'u_pending', done: !!(w && this.isVerified(w)) },
        { n: 4, t: 'Contractor posts a job', who: 'contractor', view: 'c_post', done: posted },
        { n: 5, t: 'Worker applies', who: 'worker', view: 'w_jobs', done: !!app },
        { n: 6, t: 'Contractor accepts and assigns', who: 'contractor', view: 'c_apps', done: !!rec },
        { n: 7, t: 'Worker sends proof; contractor confirms', who: 'worker', view: 'w_khata', done: !!(rec && ['contractor_confirmed', 'completed'].includes(rec.status)) },
        { n: 8, t: 'Worker confirms; Kaam Ka Khata updates', who: 'worker', view: 'w_khata', done: !!(rec && rec.status === 'completed') },
        { n: 9, t: 'Both record and confirm payment', who: 'contractor', view: 'c_pay', done: !!(rec && pay && pay.paid + pay.advance > 0 && pay.unconfirmed === 0) },
      ];
    },
    storyNextIdx() { return this.storyChecklist().findIndex((s) => !s.done); },
    jumpStory(s) { this.drawer = false; this.goAs(s.who, s.view); },

    /* ---------- settings: export, import, reset ---------- */
    exportData() {
      const blob = new Blob([JSON.stringify(this.db, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hunarsetu-data-' + todayStr() + '.json'; document.body.appendChild(a); a.click(); a.remove();
      this.toast('Data file downloaded (recordings and videos stay on this device)');
    },
    resetDemo() {
      this.ask({ title: 'Reset the demo?', body: 'All data you created in this browser (profiles, recordings, videos, jobs, records, payments) will be erased and the sample data restored.', ok: 'Reset everything', danger: true, fn: async () => {
        this.recDiscard(); this.drawer = false;
        try { await MediaDB.clear(); } catch (e) { /* ignore */ }
        try { localStorage.removeItem(LS_DB); localStorage.removeItem(LS_SESSION); } catch (e) { /* ignore */ }
        // Reload so every screen starts clean from the sample data
        this._noPersist = true; location.hash = ''; location.reload();
      } });
    },
    startRamesh() {
      this.session.workerId = null; this.onbReset(); this.onb.f = Object.assign(this.onb.f, { name: '', trade: 'Electrician' });
      this.role = 'worker'; this.view = 'w_home'; this.drawer = false; this.toast('Create Ramesh’s profile using the voice steps');
    },
    pickWorker(id) { this.session.workerId = id; this.toast('Now using ' + this.wk(id).name + '’s account (demo)'); this.persistNow(); },
    logoutWorker() { this.nav(() => { this.session.workerId = null; this.onbReset(); this.stack = []; this.view = 'w_home'; this.params = {}; }); },
  };
}
