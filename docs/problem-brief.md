# Problem Brief: HunarSetu

**Track:** Build for Bharat, Track 6: Education, Skills and Employment
**Status:** Working prototype. See the [README](../README.md) for setup and limitations.

## The problem
Many skilled workers in India's informal economy (electricians, plumbers, appliance repair technicians) have years of practical experience but no certificate, no written resume and no record of past jobs. Work comes mostly by word of mouth, and when a worker changes contractors their reputation does not travel with them. Typical job portals expect a typed, usually English, profile. A video on its own does not tell a hirer whether a trustworthy person has checked the skill.

## Who is affected
- **Workers** who cannot prove what they can do or show a work history.
- **Contractors** who hire on personal recommendation or guesswork.
- **Experienced technicians** whose judgement is trusted locally but recorded nowhere.

## Approach
Technology supports human trust; it does not replace it.

1. **Voice-first identity.** A worker introduces themselves by speaking. Details are editable before saving.
2. **Show, don't write.** A short practical video for a specific skill.
3. **Human verification.** An Ustad reviews the video, can add a voice endorsement, and decides. Automatic checks are hints and never count as verification.
4. **Portable proof.** A Hunar Card with a QR code that opens a public page without login and without the phone number.
5. **Kaam Ka Khata.** A job is verified only after contractor and worker both confirm it.
6. **Mera Hisaab.** Shared, both-side-confirmed records of agreed pay, advances and payments.
7. **Hunar Mitra.** A local helper, acting with the worker's consent, for people who cannot use the app alone.

## Value the prototype demonstrates
- A worker with no resume can create a usable profile by voice.
- A skill can be endorsed by a named person rather than by an algorithm.
- Both parties hold the same confirmed record of work and payment.
- Contractors can filter workers using a transparent points score with no hidden AI.

## Scope and honesty
- Data is stored in the browser. There is no shared database or production authentication.
- Role switching is a demo mechanism, not secure access control.
- Speech-to-text and vision screening are optional and not connected.
- Video checks are not safety certification. Ustad verification is human-led.
- The payment ledger records agreements and confirmations. It guarantees nothing and is not escrow.
- Cross-device QR verification needs a deployed HTTPS URL and has not yet been tested on one.
- No field research, partnerships, user numbers or measured impact are claimed.
