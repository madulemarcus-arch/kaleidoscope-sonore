// Static checks (no browser): syntax of every script, and the things that must stay in sync when a file is added or a release is made.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', 'cispolstore'); let fails = 0;
const ok = (n, c, x = '') => { console.log((c ? 'PASS ' : 'FAIL ') + n + (x ? ' ' + x : '')); if (!c) fails++; };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html'), sw = read('sw.js'), core = read('js/core.js');
const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
ok('index.html loads scripts', scripts.length > 20, String(scripts.length));
scripts.forEach(s => ok('script exists: ' + s, fs.existsSync(path.join(ROOT, s))));
const files = [...sw.match(/const FILES = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map(m => m[1].replace(/^\.\//, ''));
files.filter(f => f && f !== './').forEach(f => ok('sw.js caches an existing file: ' + f, fs.existsSync(path.join(ROOT, f))));
scripts.forEach(s => ok('sw.js caches ' + s, files.includes(s)));
fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).forEach(f => ok('js/' + f + ' is loaded by index.html', scripts.includes('js/' + f)));
const cache = (sw.match(/const CACHE = '([^']+)'/) || [])[1], build = (core.match(/App\.BUILD = '([^']+)'/) || [])[1];
ok('sw.js CACHE equals cispolstore-<BUILD>', cache === 'cispolstore-' + build, `${cache} / ${build}`);
[...scripts.filter(s => s.startsWith('js/')), 'sw.js'].forEach(s => { try { execFileSync(process.execPath, ['--check', path.join(ROOT, s)], { stdio: 'pipe' }); ok('syntax OK: ' + s, true); } catch (e) { ok('syntax OK: ' + s, false, String(e.stderr || e).split('\n').slice(0, 3).join(' ')); } });
// Android / Play Store packaging (Trusted Web Activity) needs a complete, installable manifest
const man = JSON.parse(read('manifest.webmanifest'));
ok('manifest: name, id, start_url, scope, standalone, language', !!(man.name && man.short_name && man.id && man.start_url && man.scope) && man.display === 'standalone' && man.lang === 'fr');
ok('manifest: 192 and 512 icons plus a maskable 512 icon, all present on disk', ['192x192', '512x512'].every(z => man.icons.some(i => i.sizes === z && i.purpose === 'any')) && man.icons.some(i => i.purpose === 'maskable' && i.sizes === '512x512') && man.icons.every(i => fs.existsSync(path.join(ROOT, i.src))));
ok('manifest: shortcuts point to existing views', (man.shortcuts || []).length >= 3 && man.shortcuts.every(x => /[?&]go=[a-z]+/.test(x.url)));
ok('manifest: description and categories for the store', !!man.description && (man.categories || []).length > 0);
const pv = read('privacy.html');
ok('privacy policy page exists (required by Google Play) and mentions data and contact', /Politique de confidentialité/.test(pv) && /contact@cispolstore\.com/.test(pv) && /sur votre appareil/.test(pv));
ok('privacy policy is cached by sw.js and linked from Settings', files.includes('privacy.html') && /privacy\.html/.test(read('js/settings.js')));
ok('manifest is valid JSON with icons', (() => { try { const m = JSON.parse(read('manifest.webmanifest')); return m.name && m.icons && m.icons.length; } catch (e) { return false; } })());
process.exit(fails ? 1 : 0);
