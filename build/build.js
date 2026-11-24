'use strict';
// Bundles src/ into one offline index.html. Run: node build/build.js
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..');
const NM = process.env.HS_NODE_MODULES || path.join(root, 'node_modules');            // where alpinejs, tailwindcss, fontawesome, qrcode-generator are installed
const rd = (p) => fs.readFileSync(p, 'utf8');
const decode = (s) => s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

// 1. views -> template (includes {{>name}}, \uXXXX -> real Devanagari)
const view = (n) => decode(rd(path.join(root, 'src/views', n + '.html')));
const inc = (s) => s.replace(/\{\{>([a-z_0-9]+)\}\}/g, (_, n) => inc(view(n)));
let html = inc(rd(path.join(root, 'src/template.html')));

// 2. JS bundle (app code only; libs are separate)
const jsFiles = fs.readdirSync(path.join(root, 'src/js')).sort();
const appjs = jsFiles.map((f) => rd(path.join(root, 'src/js', f))).join('\n');

// 3. Tailwind: compile only the classes used
const tmp = path.join(root, 'build/.tmp'); fs.mkdirSync(tmp, { recursive: true });
fs.writeFileSync(path.join(tmp, 'content.html'), html + '\n' + appjs);
fs.writeFileSync(path.join(tmp, 'tailwind.config.js'), `module.exports={content:[${JSON.stringify(path.join(tmp, 'content.html'))}],theme:{extend:{}},plugins:[]}`);
cp.execFileSync('node', [path.join(NM, 'tailwindcss/lib/cli.js'), '-c', path.join(tmp, 'tailwind.config.js'), '-i', path.join(root, 'src/app.css'), '-o', path.join(tmp, 'out.css'), '--minify'], { stdio: 'inherit' });
let css = rd(path.join(tmp, 'out.css'));

// 4. Font Awesome: only the icons that are used, fonts embedded as base64
const used = new Set(); (html + appjs).replace(/fa-(?:solid|brands|regular)|\bfa-([a-z0-9-]+)/g, (m, n) => { if (n) used.add(n); return m; });
const faCss = rd(path.join(NM, '@fortawesome/fontawesome-free/css/all.css'));
const rules = faCss.match(/\.fa-[a-z0-9-]+(?:::before|:before)\s*\{[^}]*\}/g) || [];
const keep = rules.filter((r) => { const n = r.match(/^\.fa-([a-z0-9-]+)/)[1]; return used.has(n); }).join('\n');
const b64 = (f) => fs.readFileSync(path.join(NM, '@fortawesome/fontawesome-free/webfonts', f)).toString('base64');
const faBase = `.fa-solid,.fa-brands{-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;display:inline-block;font-style:normal;font-variant:normal;line-height:1;text-rendering:auto}
.fa-solid{font-family:"FA Solid";font-weight:900}.fa-brands{font-family:"FA Brands";font-weight:400}
.fa-spin{animation:fa-spin 1s linear infinite}@keyframes fa-spin{to{transform:rotate(360deg)}}
@font-face{font-family:"FA Solid";font-weight:900;font-display:block;src:url(data:font/woff2;base64,${b64('fa-solid-900.woff2')}) format("woff2")}
@font-face{font-family:"FA Brands";font-weight:400;font-display:block;src:url(data:font/woff2;base64,${b64('fa-brands-400.woff2')}) format("woff2")}`;
css = faBase + '\n' + keep.replace(/::before|:before/g, '::before') + '\n' + css;

// 4b. Subset FA fonts is skipped on purpose: keeps the build simple; size reported below.

// 5. Libraries
const libs = rd(path.join(NM, 'qrcode-generator/qrcode.js'));
const alpine = rd(path.join(NM, 'alpinejs/dist/cdn.min.js'));

// 6. Assemble. Use function replacers so $ patterns in code are never interpreted.
const escScript = (s) => s.replace(/<\/script/gi, '<\\/script');
html = html.replace('{{CSS}}', () => css).replace('{{LIBS}}', () => escScript(libs)).replace('{{APPJS}}', () => escScript(appjs)).replace('{{ALPINE}}', () => escScript(alpine));
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('index.html', Math.round(html.length / 1024) + ' KB;', 'icons used:', used.size, 'matched rules:', rules.filter((r) => used.has(r.match(/^\.fa-([a-z0-9-]+)/)[1])).length);
