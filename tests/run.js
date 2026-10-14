#!/usr/bin/env node
// Runs the CISPOLstore test suite: static checks first, then every browser test in tests/cispolstore/ against a local server.
//   node tests/run.js              all tests
//   node tests/run.js roles pay    only the tests whose name contains one of the words
// Browser tests need Playwright (npm install in tests/) and Chromium (npx playwright install chromium, or CHROMIUM_PATH=/path/to/chromium).
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..', 'cispolstore'), DIR = path.join(__dirname, 'cispolstore');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
const only = process.argv.slice(2), PAR = +process.env.TEST_PARALLEL || 3, TIMEOUT = +process.env.TEST_TIMEOUT || 120000;
const run = (file, env) => new Promise(ok => {
  const t0 = Date.now(), cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cispol-test-')); let out = '', done = false;
  const c = spawn(process.execPath, [file], { cwd, env: { ...process.env, ...env, NODE_PATH: [path.join(__dirname, 'node_modules'), process.env.NODE_PATH || ''].join(path.delimiter) } });
  const finish = code => { if (done) return; done = true; clearTimeout(tm); fs.rmSync(cwd, { recursive: true, force: true }); ok({ file, code, out, ms: Date.now() - t0 }); };
  const tm = setTimeout(() => { out += '\nFAIL timeout\n'; c.kill('SIGKILL'); finish(1); }, TIMEOUT);
  c.stdout.on('data', d => out += d); c.stderr.on('data', d => out += d); c.on('close', finish);
});
(async () => {
  const files = fs.readdirSync(DIR).filter(f => /\.test\.js$/.test(f)).sort().filter(f => !only.length || only.some(w => f.includes(w)));
  if (!files.length) { console.log('Aucun test trouvé.'); process.exit(1); }
  await new Promise(r => server.listen(0, r));
  const env = { BASE_URL: 'http://localhost:' + server.address().port }, results = [];
  const queue = files.slice(), worker = async () => { while (queue.length) { const f = queue.shift(), r = await run(path.join(DIR, f), env); results.push(r);
    const fails = (r.out.match(/^FAIL/gm) || []).length, pass = (r.out.match(/^PASS/gm) || []).length, bad = r.code !== 0 || fails > 0;
    console.log(`${bad ? '✗' : '✓'} ${f.replace('.test.js', '').padEnd(14)} ${String(pass).padStart(3)} ok${fails ? ', ' + fails + ' échec(s)' : ''}  (${(r.ms / 1000).toFixed(1)} s)`);
    if (bad) console.log((process.env.VERBOSE ? r.out.split('\n') : r.out.split('\n').filter(l => /^FAIL|Error|error/.test(l)).slice(0, 12)).map(l => '    ' + l.slice(0, 220)).join('\n')); } };
  await Promise.all(Array.from({ length: Math.min(PAR, files.length) }, worker));
  server.close();
  const bad = results.filter(r => r.code !== 0 || /^FAIL/m.test(r.out)), total = results.reduce((a, r) => a + (r.out.match(/^PASS/gm) || []).length, 0);
  console.log(`\n${results.length - bad.length}/${results.length} fichiers de test réussis · ${total} vérifications réussies` + (bad.length ? ` · ÉCHEC : ${bad.map(r => path.basename(r.file, '.test.js')).join(', ')}` : ''));
  process.exit(bad.length ? 1 : 0);
})();
