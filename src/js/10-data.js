'use strict';
/* ============================================================
   Static catalogue + seed data. Everything seeded is flagged
   isDemo / sample so it is never presented as real verification.
   ============================================================ */

/* Approximate locality centres (decimal degrees) used only for rough distances. */
const LOCALITIES = [
  { name: 'Najafgarh', lat: 28.6092, lng: 76.9798 },
  { name: 'Dwarka', lat: 28.5921, lng: 77.046 },
  { name: 'Dwarka Mor', lat: 28.619, lng: 77.033 },
  { name: 'Uttam Nagar', lat: 28.619, lng: 77.055 },
  { name: 'Janakpuri', lat: 28.6219, lng: 77.0878 },
  { name: 'Vikaspuri', lat: 28.636, lng: 77.066 },
  { name: 'Tilak Nagar', lat: 28.64, lng: 77.087 },
  { name: 'Rajouri Garden', lat: 28.6492, lng: 77.1177 },
  { name: 'Palam', lat: 28.598, lng: 77.087 },
  { name: 'Mahipalpur', lat: 28.545, lng: 77.125 },
  { name: 'Kapashera', lat: 28.528, lng: 77.077 },
  { name: 'Bijwasan', lat: 28.5428, lng: 77.0397 },
  { name: 'Rohini', lat: 28.7495, lng: 77.0565 },
  { name: 'Laxmi Nagar', lat: 28.63, lng: 77.277 },
  { name: 'Gurugram', lat: 28.4595, lng: 77.0266 },
  { name: 'Noida', lat: 28.5355, lng: 77.391 },
  { name: 'Faridabad', lat: 28.4089, lng: 77.3178 },
  { name: 'Ghaziabad', lat: 28.6692, lng: 77.4538 },
];

const TRADES = ['Electrician', 'Plumber', 'Appliance Repair'];
const TRADE_ICON = { Electrician: 'fa-bolt', Plumber: 'fa-faucet-drip', 'Appliance Repair': 'fa-screwdriver-wrench' };
const LANGS = [
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'en-IN', name: 'English' },
  { code: 'pa-IN', name: 'Punjabi' },
];

const SKILLS = [
  {
    id: 'basic_wiring', trade: 'Electrician', name: 'Basic wiring', hi: 'बेसिक वायरिंग',
    task: 'Switch off and isolate the supply first. Then show how you run and join a wire to a switch or socket point.',
    checklist: ['Supply isolated before work started', 'Correct phase / neutral / earth connections', 'Joints properly insulated', 'Neat wire routing and clipping', 'Insulated tools used'],
  },
  {
    id: 'fan_install', trade: 'Electrician', name: 'Fan installation', hi: 'पंखा लगाना',
    task: 'Show hanging a ceiling fan: hook, downrod, canopy and wiring to the regulator.',
    checklist: ['Supply isolated before work started', 'Hook or box looks secure', 'Canopy and downrod fitted properly', 'Capacitor and regulator wired correctly', 'Blades fitted, no obvious wobble'],
  },
  {
    id: 'db_box', trade: 'Electrician', name: 'Distribution board assembly', hi: 'डीबी बॉक्स लगाना',
    task: 'Show wiring a 3-phase distribution box: incomer, MCBs, bus bars and outgoing cables.',
    checklist: ['Supply isolated before work started', 'Breakers fitted and circuits labelled', 'Phase, neutral and earth bars used correctly', 'Cable dressing neat, lugs or ferrules used', 'Insulated tools used, no exposed conductors'],
  },
  {
    id: 'earthing', trade: 'Electrician', name: 'Earthing demonstration', hi: 'अर्थिंग का काम',
    task: 'Show an earthing connection: electrode, earth wire and the connection to the board or appliance.',
    checklist: ['Electrode connection shown', 'Earth wire size looks suitable', 'Tight, clean joints', 'Continuity checked with a tester', 'Earth reaches all required points'],
  },
  {
    id: 'tap_fitting', trade: 'Plumber', name: 'Tap and pipe fitting', hi: 'नल और पाइप फिटिंग',
    task: 'Show fitting a tap on a pipe with thread tape and checking for leaks.',
    checklist: ['Water supply closed first', 'Thread tape or sealant used correctly', 'Joint tightened without damage', 'Leak test shown', 'Area left clean'],
  },
  {
    id: 'leak_repair', trade: 'Plumber', name: 'Leak repair', hi: 'लीक रिपेयर',
    task: 'Show finding and fixing a leak on a joint or fitting.',
    checklist: ['Source of leak found', 'Supply closed before repair', 'Correct part or sealant used', 'Leak test shown after repair', 'Area left clean'],
  },
  {
    id: 'washing_machine', trade: 'Appliance Repair', name: 'Washing machine repair', hi: 'वॉशिंग मशीन रिपेयर',
    task: 'Show opening a washing machine and fixing or replacing one part (for example drain pump or belt).',
    checklist: ['Plug removed before opening', 'Fault found before parts replaced', 'Part fitted correctly', 'Test run shown', 'Machine closed properly'],
  },
  {
    id: 'fridge_repair', trade: 'Appliance Repair', name: 'Refrigerator repair', hi: 'फ्रिज रिपेयर',
    task: 'Show a basic refrigerator fault check, such as relay, thermostat or door gasket.',
    checklist: ['Plug removed before opening', 'Fault checked step by step', 'Part fitted correctly', 'Cooling test described or shown', 'Back panel closed properly'],
  },
];

const FAQS = [
  { q: 'What is a Hunar Card?', hi: 'हुनर कार्ड क्या है?', a: 'It is your skill identity. It shows your trade, your skills, who has endorsed you and the work you have completed. Anyone can scan its QR code.', ah: 'यह आपकी हुनर की पहचान है। इसमें आपका काम, उस्ताद की सिफारिश और पूरा किया हुआ काम दिखता है। QR कोड स्कैन करके कोई भी देख सकता है।' },
  { q: 'Who is an Ustad?', hi: 'उस्ताद कौन है?', a: 'An Ustad is an experienced master technician. He watches your skill video or tests you in person, then adds his endorsement.', ah: 'उस्ताद एक अनुभवी मिस्त्री है। वह आपकी वीडियो देखकर या आपको पास बुलाकर जाँचता है और सिफारिश लिखता है।' },
  { q: 'Does the app check my work with AI?', hi: 'क्या ऐप AI से मेरा काम जाँचता है?', a: 'The app only runs basic video checks such as length and light. It does not certify that your work is correct or safe. Only an Ustad can endorse your skill.', ah: 'ऐप सिर्फ वीडियो की लंबाई और रोशनी जैसी बेसिक जाँच करता है। काम सही या सुरक्षित है, यह ऐप प्रमाणित नहीं करता। सिफारिश सिर्फ उस्ताद दे सकते हैं।' },
  { q: 'Will I get my money through the app?', hi: 'क्या पैसे ऐप से मिलेंगे?', a: 'No. Mera Hisaab only records what you and the contractor agreed and what has been paid. HunarSetu does not hold or guarantee money.', ah: 'नहीं। मेरा हिसाब सिर्फ यह लिखता है कि आप और ठेकेदार ने क्या तय किया और कितना दिया गया। हुनरसेतु पैसे नहीं रखता और भुगतान की गारंटी नहीं देता।' },
  { q: 'What is Kaam Ka Khata?', hi: 'काम का खाता क्या है?', a: 'It is your work history. A job counts as verified experience only after the contractor and you both confirm it.', ah: 'यह आपका काम का रिकॉर्ड है। काम तभी पक्का अनुभव गिना जाता है जब ठेकेदार और आप दोनों उसे मान लें।' },
  { q: 'Who can see my phone number?', hi: 'मेरा नंबर कौन देख सकता है?', a: 'The public QR page never shows your phone number. A contractor can contact you only after you apply to or accept their job.', ah: 'QR वाले पेज पर आपका नंबर कभी नहीं दिखता। ठेकेदार तभी संपर्क कर सकता है जब आप उसके काम पर अप्लाई करें या उसका नोतिस मानें।' },
  { q: 'I cannot use the app alone. What do I do?', hi: 'मुझे ऐप चलाना नहीं आता, क्या करूँ?', a: 'Ask for a Hunar Mitra. She is a local helper who can register you, record your voice and upload your video with your permission.', ah: 'हुनर मित्र से मदद मांगें। वह आपके इलाके की सहायक है और आपकी इजाज़त से रजिस्ट्रेशन, आवाज़ रिकॉर्डिंग और वीडियो अपलोड में मदद कर सकती है।' },
];

const HELP_AUDIO = [
  { id: 'h1', title: 'How to record your voice', hi: 'आवाज़ कैसे रिकॉर्ड करें', text: 'माइक वाला बड़ा बटन दबाइए। अपना नाम, कितने साल काम किया और कौन सा काम आता है, बोलिए। फिर रोकने का बटन दबाइए।' },
  { id: 'h2', title: 'How to make the skill video', hi: 'वीडियो कैसे बनाएं', text: 'पहले बिजली बंद करें। फिर फोन सीधा रखकर पंद्रह से तीस सेकंड का अपना काम दिखाएं। हाथ और औज़ार साफ दिखने चाहिए।' },
  { id: 'h3', title: 'How to apply for work', hi: 'काम के लिए अप्लाई कैसे करें', text: 'काम ढूँढो पर जाइए। अपना पसंद का काम खोलिए और अप्लाई बटन दबाइए। ठेकेदार के जवाब का इंतज़ार करिए।' },
  { id: 'h4', title: 'How payment records work', hi: 'हिसाब कैसे काम करता है', text: 'मेरा हिसाब में तय रकम, एडवांस और मिला हुआ पैसा दिखता है। हर एंट्री पर हाँ दबाकर मानिए। हुनरसेतु पैसे नहीं रखता।' },
];

/* Verification levels shown everywhere. Only reviewed/practical count as Ustad-verified. */
const LEVELS = {
  practical: { en: 'Practically assessed', hi: 'प्रैक्टिकल जाँच पूरी', icon: 'fa-user-check', cls: 'bg-emerald-100 text-emerald-800 border border-emerald-300', rank: 4 },
  reviewed: { en: 'Ustad reviewed', hi: 'उस्ताद ने देखा', icon: 'fa-circle-check', cls: 'bg-amber-100 text-amber-900 border border-amber-300', rank: 3 },
  submitted: { en: 'Waiting for Ustad', hi: 'उस्ताद का इंतज़ार', icon: 'fa-hourglass-half', cls: 'bg-indigo-50 text-indigo-800 border border-indigo-200', rank: 2 },
  claimed: { en: 'Self-declared', hi: 'अपने आप बताया', icon: 'fa-user', cls: 'bg-slate-100 text-slate-600 border border-slate-200', rank: 1 },
};

/* ---------- Seed data (the start of the demo story) ---------- */
function seedDb() {
  const D = true;
  const db = {
    version: 1,
    seededAt: iso(),
    workers: [
      { id: 'w_imran', name: 'Mohd Imran', trade: 'Plumber', experienceYears: 6, location: 'Janakpuri', languages: ['Hindi', 'Urdu'], skills: ['tap_fitting', 'leak_repair'], availability: 'available', radiusKm: 15, contactPref: 'whatsapp', phone: '', avatar: '', voice: null, createdBy: 'self', assistedBy: null, isDemo: D, createdAt: iso(-60) },
      { id: 'w_deepak', name: 'Deepak Yadav', trade: 'Electrician', experienceYears: 5, location: 'Uttam Nagar', languages: ['Hindi'], skills: ['basic_wiring', 'fan_install'], availability: 'available', radiusKm: 20, contactPref: 'call', phone: '', avatar: '', voice: null, createdBy: 'self', assistedBy: null, isDemo: D, createdAt: iso(-90) },
      { id: 'w_sanjay', name: 'Sanjay Kumar', trade: 'Appliance Repair', experienceYears: 10, location: 'Palam', languages: ['Hindi', 'Punjabi'], skills: ['washing_machine'], availability: 'soon', radiusKm: 12, contactPref: 'via_mitra', phone: '', avatar: '', voice: null, createdBy: 'mitra', assistedBy: 'm_anita', isDemo: D, createdAt: iso(-30) },
      { id: 'w_kamal', name: 'Kamal Singh', trade: 'Electrician', experienceYears: 3, location: 'Vikaspuri', languages: ['Hindi'], skills: ['basic_wiring'], availability: 'available', radiusKm: 10, contactPref: 'whatsapp', phone: '', avatar: '', voice: null, createdBy: 'self', assistedBy: null, isDemo: D, createdAt: iso(-12) },
    ],
    ustads: [
      { id: 'u_suresh', name: 'Suresh Sharma', title: 'Senior Electrician', trade: 'Electrician', experienceYears: 30, location: 'Najafgarh', sample: D },
      { id: 'u_rakesh', name: 'Rakesh Yadav', title: 'Senior Plumber', trade: 'Plumber', experienceYears: 22, location: 'Janakpuri', sample: D },
    ],
    contractors: [
      { id: 'c_amit', name: 'Amit Verma', company: 'Verma Building Services', location: 'Dwarka', phone: '', isDemo: D },
      { id: 'c_ravi', name: 'Ravi Chauhan', company: 'Chauhan Home Services', location: 'Gurugram', phone: '', isDemo: D },
    ],
    hunar_mitras: [{ id: 'm_anita', name: 'Anita Verma', location: 'Najafgarh', isDemo: D }],
    skill_assessments: [
      { id: 'a_dep1', workerId: 'w_deepak', skillId: 'basic_wiring', videoId: null, sample: D, submittedAt: iso(-45), status: 'approved', ustadId: 'u_suresh', screening: { mode: 'demo', checks: [] }, review: { decision: 'approve', level: 'reviewed', comment: 'Clean wiring and good insulation practice. (Sample record)', date: iso(-40).slice(0, 10), audioId: null, checklist: [] }, history: [{ at: iso(-45), text: 'Submitted (sample record)' }, { at: iso(-40), text: 'Approved by Suresh Sharma' }] },
      { id: 'a_dep2', workerId: 'w_deepak', skillId: 'fan_install', videoId: null, sample: D, submittedAt: iso(-35), status: 'approved', ustadId: 'u_suresh', screening: { mode: 'demo', checks: [] }, review: { decision: 'approve', level: 'practical', comment: 'Tested in person at site. Fan fitted correctly. (Sample record)', date: iso(-30).slice(0, 10), audioId: null, checklist: [] }, history: [{ at: iso(-35), text: 'Submitted (sample record)' }, { at: iso(-30), text: 'Approved after practical test' }] },
      { id: 'a_imr1', workerId: 'w_imran', skillId: 'tap_fitting', videoId: null, sample: D, submittedAt: iso(-28), status: 'approved', ustadId: 'u_rakesh', screening: { mode: 'demo', checks: [] }, review: { decision: 'approve', level: 'reviewed', comment: 'Good sealing and leak test. (Sample record)', date: iso(-25).slice(0, 10), audioId: null, checklist: [] }, history: [{ at: iso(-28), text: 'Submitted (sample record)' }, { at: iso(-25), text: 'Approved by Rakesh Yadav' }] },
      { id: 'a_kam1', workerId: 'w_kamal', skillId: 'basic_wiring', videoId: null, sample: D, submittedAt: iso(-1), status: 'submitted', ustadId: 'u_suresh', screening: { mode: 'demo', checks: [] }, review: null, history: [{ at: iso(-1), text: 'Submitted (sample record, no video stored)' }] },
    ],
    endorsements: [
      { id: 'e_dep1', workerId: 'w_deepak', ustadId: 'u_suresh', skillId: 'basic_wiring', assessmentId: 'a_dep1', level: 'reviewed', comment: 'Clean wiring and good insulation practice. (Sample record)', audioId: null, date: iso(-40).slice(0, 10), active: true, sample: D },
      { id: 'e_dep2', workerId: 'w_deepak', ustadId: 'u_suresh', skillId: 'fan_install', assessmentId: 'a_dep2', level: 'practical', comment: 'Tested in person at site. Fan fitted correctly. (Sample record)', audioId: null, date: iso(-30).slice(0, 10), active: true, sample: D },
      { id: 'e_imr1', workerId: 'w_imran', ustadId: 'u_rakesh', skillId: 'tap_fitting', assessmentId: 'a_imr1', level: 'reviewed', comment: 'Good sealing and leak test. (Sample record)', audioId: null, date: iso(-25).slice(0, 10), active: true, sample: D },
    ],
    jobs: [
      { id: 'j_old1', contractorId: 'c_ravi', title: 'Switchboard replacement, 2 flats', trade: 'Electrician', skills: ['basic_wiring'], workersNeeded: 1, location: 'Uttam Nagar', payType: 'fixed', amount: 3200, durationDays: 2, minExperience: 2, requireVerified: false, description: 'Replace old switchboards in two flats.', startDate: iso(-24).slice(0, 10), status: 'filled', createdAt: iso(-26), isDemo: D },
      { id: 'j_old2', contractorId: 'c_ravi', title: 'Fan and light fitting, new flat', trade: 'Electrician', skills: ['fan_install'], workersNeeded: 1, location: 'Dwarka Mor', payType: 'fixed', amount: 2800, durationDays: 2, minExperience: 2, requireVerified: false, description: 'Fit 5 fans and 8 light points.', startDate: iso(-14).slice(0, 10), status: 'filled', createdAt: iso(-16), isDemo: D },
      { id: 'j_fan', contractorId: 'c_ravi', title: 'Fan and light fitting, 3 flats', trade: 'Electrician', skills: ['fan_install', 'basic_wiring'], workersNeeded: 2, location: 'Janakpuri', payType: 'daily', amount: 650, durationDays: 4, minExperience: 2, requireVerified: false, description: 'Fit ceiling fans and light points in three new flats. Tools on site. Lunch provided.', startDate: iso(4).slice(0, 10), status: 'open', createdAt: iso(-2), isDemo: D },
      { id: 'j_plumb', contractorId: 'c_ravi', title: 'Bathroom pipe fitting', trade: 'Plumber', skills: ['tap_fitting', 'leak_repair'], workersNeeded: 1, location: 'Gurugram', payType: 'daily', amount: 700, durationDays: 3, minExperience: 3, requireVerified: false, description: 'Concealed pipe fitting and tap installation in two bathrooms.', startDate: iso(5).slice(0, 10), status: 'open', createdAt: iso(-1), isDemo: D },
      { id: 'j_wash', contractorId: 'c_ravi', title: 'Washing machine service, society camp', trade: 'Appliance Repair', skills: ['washing_machine'], workersNeeded: 1, location: 'Palam', payType: 'fixed', amount: 2500, durationDays: 2, minExperience: 5, requireVerified: false, description: 'Service and minor repair of residents’ washing machines over two days.', startDate: iso(6).slice(0, 10), status: 'open', createdAt: iso(-1), isDemo: D },
    ],
    job_applications: [
      { id: 'ap_old1', jobId: 'j_old1', workerId: 'w_deepak', status: 'assigned', origin: 'worker', createdAt: iso(-26), updatedAt: iso(-25) },
      { id: 'ap_old2', jobId: 'j_old2', workerId: 'w_deepak', status: 'assigned', origin: 'worker', createdAt: iso(-16), updatedAt: iso(-15) },
    ],
    work_records: [
      { id: 'r_old1', jobId: 'j_old1', workerId: 'w_deepak', contractorId: 'c_ravi', title: 'Switchboard replacement, 2 flats', work: 'Replace old switchboards in two flats.', location: 'Uttam Nagar', startDate: iso(-24).slice(0, 10), endDate: iso(-22).slice(0, 10), agreedAmount: 3200, status: 'completed', evidence: [], workerNote: 'Both flats done and tested.', contractorConfirmedAt: iso(-22), workerConfirmedAt: iso(-22), rating: 4, feedback: 'Neat work, on time.', correctionNote: '', isDemo: D, createdAt: iso(-25) },
      { id: 'r_old2', jobId: 'j_old2', workerId: 'w_deepak', contractorId: 'c_ravi', title: 'Fan and light fitting, new flat', work: 'Fit 5 fans and 8 light points.', location: 'Dwarka Mor', startDate: iso(-14).slice(0, 10), endDate: iso(-12).slice(0, 10), agreedAmount: 2800, status: 'completed', evidence: [], workerNote: 'All fans and lights working.', contractorConfirmedAt: iso(-12), workerConfirmedAt: iso(-11), rating: 5, feedback: 'Very reliable.', correctionNote: '', isDemo: D, createdAt: iso(-15) },
    ],
    payment_records: [
      { id: 'p_old1', recordId: 'r_old1', agreed: 3200, dueDate: iso(-20).slice(0, 10), entries: [
        { id: 'pe_a', kind: 'advance', amount: 1000, date: iso(-24).slice(0, 10), note: '', by: 'contractor', confirmedWorker: true, confirmedContractor: true, disputed: false },
        { id: 'pe_b', kind: 'payment', amount: 2200, date: iso(-22).slice(0, 10), note: 'Balance paid by UPI', by: 'contractor', confirmedWorker: true, confirmedContractor: true, disputed: false } ] },
      { id: 'p_old2', recordId: 'r_old2', agreed: 2800, dueDate: iso(-10).slice(0, 10), entries: [
        { id: 'pe_c', kind: 'advance', amount: 800, date: iso(-14).slice(0, 10), note: '', by: 'contractor', confirmedWorker: true, confirmedContractor: true, disputed: false },
        { id: 'pe_d', kind: 'payment', amount: 2000, date: iso(-11).slice(0, 10), note: 'Cash', by: 'worker', confirmedWorker: true, confirmedContractor: true, disputed: false } ] },
    ],
    support_requests: [
      { id: 'sr_1', workerId: 'w_sanjay', type: 'video_help', message: 'Mujhe skill video upload karna nahi aata.', createdBy: 'worker', status: 'open', mitraId: null, createdAt: iso(-2), notes: [], date: '', place: '', ustadId: null },
    ],
    mentorships: [
      { id: 'mt_1', workerId: 'w_kamal', ustadId: 'u_suresh', topic: 'How to prepare for the distribution board test', message: 'I have 3 years of wiring experience and want to learn board assembly.', status: 'requested', reply: '', createdAt: iso(-3) },
    ],
    community: [
      { id: 'cm_1', mitraId: 'm_anita', title: 'Voice profile help day', text: 'Free help recording your voice profile and skill video at the Najafgarh community hall. Bring your phone. (Sample announcement)', date: iso(5).slice(0, 10), createdAt: iso(-1) },
    ],
    events: [],
    story: {},
  };
  return db;
}
