// Static checks: BUILD == CACHE, every js file is loaded by index.html and cached by sw.js, manifest stability.
const fs = require('fs'), path = require('path'), { check } = require('./helper');
const R = path.resolve(__dirname, '..', '..', 'business'), rd = f => fs.readFileSync(path.join(R, f), 'utf8');
const cache = rd('sw.js').match(/const CACHE = '([^']+)'/)[1], build = rd('js/core.js').match(/BUILD: '([^']+)'/)[1];
check('BUILD égal à CACHE', cache === build, cache + ' ≠ ' + build);
const files = fs.readdirSync(path.join(R, 'js')).filter(f => f.endsWith('.js')), idx = rd('index.html'), sw = rd('sw.js');
files.forEach(f => { check('js/' + f + ' dans index.html', idx.includes('js/' + f)); check('js/' + f + ' dans sw.js', sw.includes('./js/' + f)); });
const m = JSON.parse(rd('manifest.webmanifest'));
check('manifest id stable', m.id === 'cispolstore-business'); check('manifest start_url stable', m.start_url === './index.html?source=pwa');
m.icons.forEach(i => check('icône ' + i.src, fs.existsSync(path.join(R, i.src))));
check('aucun texte Starlink', !/starlink/i.test(files.map(f => rd('js/' + f)).join('') + idx + rd('css/app.css')));
check('aucune clé secrète', !/(sk_live|service_role|eyJhbGci)/.test(files.map(f => rd('js/' + f)).join('')));
// sync script: one table only, closed to the public, access only through the three token-protected functions
const sql = rd('sync/supabase.sql');
check('supabase.sql : une seule table', (sql.match(/create table/gi) || []).length === 1);
check('supabase.sql : table fermée au public', /enable row level security/i.test(sql) && /revoke all on public\.business_sync from anon, authenticated/i.test(sql));
check('supabase.sql : trois fonctions protégées', ['biz_pull', 'biz_head', 'biz_push'].every(f => new RegExp('create or replace function public\\.' + f).test(sql) && new RegExp('grant execute on function public\\.' + f).test(sql)));
check('sw.js met en cache le script SQL', sw.includes('./sync/supabase.sql'));
