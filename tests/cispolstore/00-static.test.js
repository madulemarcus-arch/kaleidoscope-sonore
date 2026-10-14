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
ok('manifest is valid JSON with icons', (() => { try { const m = JSON.parse(read('manifest.webmanifest')); return m.name && m.icons && m.icons.length; } catch (e) { return false; } })());
process.exit(fails ? 1 : 0);
