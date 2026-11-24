'use strict';
/* ============================================================
   HunarSetu utilities: ids, dates, media storage (IndexedDB),
   real audio recording, browser speech recognition, video
   quality analysis, image resizing, QR + public snapshot.
   ============================================================ */

const uid = (p) => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const iso = (offsetDays = 0) => new Date(Date.now() + offsetDays * 864e5).toISOString();
const todayStr = () => new Date().toISOString().slice(0, 10);
const inr = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
const fdate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const initials = (name) => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const b64e = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64d = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));

/* ---------- Media store: audio / video / photos live in IndexedDB ---------- */
const MediaDB = {
  _db: null,
  open() {
    return new Promise((resolve, reject) => {
      if (this._db) return resolve(this._db);
      if (!window.indexedDB) return reject(new Error('IndexedDB not available'));
      const r = indexedDB.open('hunarsetu-media', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('blobs');
      r.onsuccess = () => { this._db = r.result; resolve(this._db); };
      r.onerror = () => reject(r.error);
    });
  },
  async _tx(mode, fn) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('blobs', mode);
      const req = fn(tx.objectStore('blobs'));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
    });
  },
  put(id, blob) { return this._tx('readwrite', (s) => s.put(blob, id)); },
  get(id) { return this._tx('readonly', (s) => s.get(id)); },
  del(id) { return this._tx('readwrite', (s) => s.delete(id)); },
  keys() { return this._tx('readonly', (s) => s.getAllKeys()); },
  clear() { return this._tx('readwrite', (s) => s.clear()); },
};

/* ---------- Real audio recording (MediaRecorder) with live level bars ---------- */
class AudioRec {
  static supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }
  async start(onLevel) {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    this.mime = types.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    this.mr = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime } : undefined);
    this.chunks = [];
    this.mr.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ac = new AC();
      const src = this.ac.createMediaStreamSource(this.stream);
      this.an = this.ac.createAnalyser();
      this.an.fftSize = 64;
      src.connect(this.an);
      const buf = new Uint8Array(this.an.frequencyBinCount);
      this.tick = setInterval(() => { this.an.getByteFrequencyData(buf); if (onLevel) onLevel(Array.from(buf)); }, 120);
    } catch (e) { /* level meter is optional */ }
    this.mr.start(250);
    this.t0 = Date.now();
  }
  stop() {
    return new Promise((resolve) => {
      const done = () => {
        clearInterval(this.tick);
        if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
        try { if (this.ac) this.ac.close(); } catch (e) { /* ignore */ }
        resolve({
          blob: new Blob(this.chunks, { type: this.mime || 'audio/webm' }),
          durationSec: Math.max(1, Math.round((Date.now() - this.t0) / 1000)),
        });
      };
      this.mr.onstop = done;
      if (this.mr.state !== 'inactive') this.mr.stop(); else done();
    });
  }
  cancel() {
    clearInterval(this.tick);
    try { if (this.mr && this.mr.state !== 'inactive') { this.mr.onstop = null; this.mr.stop(); } } catch (e) { /* ignore */ }
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    try { if (this.ac) this.ac.close(); } catch (e) { /* ignore */ }
  }
}

/* ---------- Browser speech recognition (only if the browser provides it) ---------- */
function sttSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
function startSTT(lang, onText) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang = lang; r.continuous = true; r.interimResults = true;
  let finalText = '';
  r.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalText += t + ' '; else interim += t;
    }
    onText((finalText + interim).trim());
  };
  r.onerror = () => {};
  r._keep = true;
  r.onend = () => { if (r._keep) { try { r.start(); } catch (e) { /* ignore */ } } };
  try { r.start(); } catch (e) { return null; }
  return r;
}
function stopSTT(r) { if (!r) return; r._keep = false; try { r.stop(); } catch (e) { /* ignore */ } }

/* ---------- Image resize (keeps photos small for low-end phones) ---------- */
function resizeImage(file, max = 1024, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * s));
      c.height = Math.max(1, Math.round(img.height * s));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => { URL.revokeObjectURL(url); b ? resolve(b) : reject(new Error('Could not process the photo')); }, 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file is not a picture')); };
    img.src = url;
  });
}
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/* ---------- Real, on-device video quality analysis ---------- */
async function analyzeVideo(blob) {
  const url = URL.createObjectURL(blob);
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
  const once = (ev, ms = 8000) => new Promise((resolve, reject) => {
    const ok = () => { clean(); resolve(); };
    const bad = () => { clean(); reject(new Error('video ' + ev)); };
    const t = setTimeout(bad, ms);
    const clean = () => { clearTimeout(t); v.removeEventListener(ev, ok); v.removeEventListener('error', bad); };
    v.addEventListener(ev, ok); v.addEventListener('error', bad);
  });
  try {
    await once('loadedmetadata');
    let dur = v.duration;
    if (!isFinite(dur) || dur <= 0) {
      // some recorders omit duration; force the browser to compute it
      v.currentTime = 1e7; await once('seeked').catch(() => {}); dur = v.duration;
    }
    const out = {
      durationSec: isFinite(dur) ? Math.round(dur * 10) / 10 : 0,
      width: v.videoWidth, height: v.videoHeight,
      sizeMB: Math.round((blob.size / 1048576) * 10) / 10,
      brightness: null, motion: null,
    };
    if (out.durationSec > 0 && out.width > 0) {
      const c = document.createElement('canvas'); c.width = 64; c.height = 36;
      const g = c.getContext('2d', { willReadFrequently: true });
      const lum = []; let prev = null; const diffs = [];
      for (const f of [0.1, 0.3, 0.5, 0.7, 0.9]) {
        v.currentTime = out.durationSec * f;
        await once('seeked', 4000).catch(() => {});
        g.drawImage(v, 0, 0, 64, 36);
        const d = g.getImageData(0, 0, 64, 36).data;
        let sum = 0; const cur = new Uint8Array(64 * 36);
        for (let i = 0, p = 0; i < d.length; i += 4, p++) { const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; cur[p] = y; sum += y; }
        lum.push(sum / (64 * 36));
        if (prev) { let df = 0; for (let i = 0; i < cur.length; i++) df += Math.abs(cur[i] - prev[i]); diffs.push(df / cur.length); }
        prev = cur;
      }
      out.brightness = Math.round(lum.reduce((a, b) => a + b, 0) / lum.length);
      out.motion = diffs.length ? Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10 : null;
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* ---------- QR code (real, scannable; library inlined at build) ---------- */
function qrSvgFor(text) {
  try {
    const qr = qrcode(0, 'L');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  } catch (e) {
    return '';
  }
}

/* ---------- Rule-based extraction from transcript text ---------- */
function extractFromText(text, localities, skillCatalog) {
  const t = (text || '').trim();
  const out = { name: '', trade: '', experience: '', location: '', skills: [] };
  if (!t) return out;
  const stop = ['hai', 'hoon', 'hu', 'aur', 'main', 'me', 'mein', 'ka', 'ki', 'ke', 'from', 'and', 'is', 'am', 'है', 'हूँ', 'हूं', 'और', 'मैं'];
  const nm = t.match(/(?:mera naam|my name is|मेरा नाम|naam)\s+([^\s.,]+)(?:\s+([^\s.,]+))?/i);
  if (nm) {
    const parts = [nm[1]];
    if (nm[2] && !stop.includes(nm[2].toLowerCase())) parts.push(nm[2]);
    out.name = parts.join(' ').replace(/[^A-Za-zऀ-ॿ ]/g, '').trim();
  }
  const ex = t.match(/(\d{1,2})\s*(?:saal|sal|years?|yrs?|वर्ष|साल)/i);
  if (ex) out.experience = String(clamp(parseInt(ex[1], 10), 0, 60));
  const low = t.toLowerCase();
  if (/electrician|bijli|बिजली|इलेक्ट्रीशियन/.test(low) || /बिजली/.test(t)) out.trade = 'Electrician';
  else if (/plumber|plumbing|\bnal\b|pipe|प्लंबर|नल/.test(low)) out.trade = 'Plumber';
  else if (/appliance|washing|fridge|refrigerator|\bac\b|cooler|geyser|mixer/.test(low)) out.trade = 'Appliance Repair';
  const kw = { basic_wiring: /wiring|वायरिंग/, fan_install: /\bfan\b|पंखा/, db_box: /db box|\bdb\b|distribution|\bmcb\b|डीबी/, earthing: /earthing|earth\b|अर्थिंग/, tap_fitting: /\btap\b|nal fitting|pipe fitting/, leak_repair: /leak|लीक/, washing_machine: /washing/, fridge_repair: /fridge|refrigerator/ };
  Object.keys(kw).forEach((id) => { if (skillCatalog.some((s) => s.id === id) && kw[id].test(low)) out.skills.push(id); });
  const loc = localities.find((l) => low.includes(l.name.toLowerCase()));
  if (loc) out.location = loc.name;
  return out;
}
