// Static checks: BUILD == CACHE, every js file is loaded by index.html and cached by sw.js, manifest stability.
const fs = require('fs'), path = require('path'), { check } = require('./helper');
const R = path.resolve(__dirname, '..', '..', 'archi'), rd = f => fs.readFileSync(path.join(R, f), 'utf8');
const cache = rd('sw.js').match(/const CACHE = '([^']+)'/)[1], build = rd('js/core.js').match(/BUILD: '([^']+)'/)[1];
check('BUILD égal à CACHE', cache === build, cache + ' ≠ ' + build);
const files = fs.readdirSync(path.join(R, 'js')).filter(f => f.endsWith('.js')), idx = rd('index.html'), sw = rd('sw.js');
files.forEach(f => { check('js/' + f + ' dans index.html', idx.includes('js/' + f)); check('js/' + f + ' dans sw.js', sw.includes('./js/' + f)); });
['css/app.css', 'icons/logo.svg', 'manifest.webmanifest'].forEach(f => check(f + ' dans sw.js', sw.includes('./' + f)));
const m = JSON.parse(rd('manifest.webmanifest'));
check('manifest id stable', m.id === 'archi-2d'); check('manifest start_url stable', m.start_url === './index.html?source=pwa');
m.icons.forEach(i => { check('icône ' + i.src, fs.existsSync(path.join(R, i.src))); check(i.src + ' dans sw.js', sw.includes('./' + i.src)); });
check('aucune dépendance externe', !/https?:\/\/(?!www\.w3\.org)/.test(files.map(f => rd('js/' + f)).join('') + idx + rd('css/app.css')));
