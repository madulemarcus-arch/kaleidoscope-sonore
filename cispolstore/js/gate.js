// Local data encryption gate. MUST be the first script: when the data of this phone is encrypted (optional, Réglages > Sécurité),
// it stops the page, asks for the passphrase, decrypts in memory and then starts the application normally.
// What is encrypted (AES-GCM, key from PBKDF2-SHA256): the whole data set AND the three settings that hold secrets
// (synchronisation key, Drive and Gmail configuration), which are served to the application from memory (Storage shim below).
// Nothing readable is left in localStorage or in the IndexedDB mirror. The key lives in memory only.
(() => {
  'use strict';
  if (window.__gateReady) return;           // second pass: the page was rewritten after the unlock
  window.__gateReady = true;
  const ENC = 'cispolstore-enc', KEY = 'cispolstore-v2', OLD = 'cispolstore-v1', FAIL = 'cispol.encfail', WIPE = 'cispol.encwipe', MARK = 'cispolstore-local-enc1', ITER = 210000;
  const PROT = ['cispolstore-sync', 'cispolstore-drive', 'cispolstore-gmail'];
  const proto = Storage.prototype, g = proto.getItem, s = proto.setItem, r = proto.removeItem, te = new TextEncoder(), td = new TextDecoder();
  const E = window.__enc = { on: false, fresh: false, ls: {}, db: '', key: null, salt: '', iter: ITER, err: '' };
  const b64 = u => { let t = ''; u = new Uint8Array(u); for (let i = 0; i < u.length; i += 8192) t += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(t); };
  const unb64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
  const derive = async (pass, salt, iter) => crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']), { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const open = async (blobTxt, pass) => {     // -> { key, salt, iter, payload } or throws
    const o = JSON.parse(blobTxt); if (o.format !== MARK) throw new Error('format');
    const salt = unb64(o.salt), key = await derive(pass, salt, o.iter || ITER);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv) }, key, unb64(o.ct));
    return { key, salt: o.salt, iter: o.iter || ITER, payload: JSON.parse(td.decode(pt)) };
  };

  // ---- the settings that hold secrets are served from memory while the data is encrypted ----
  proto.getItem = function (k) { if (E.on && this === localStorage && PROT.includes(k)) return Object.prototype.hasOwnProperty.call(E.ls, k) ? E.ls[k] : null; return g.call(this, k); };
  proto.setItem = function (k, v) { if (E.on && this === localStorage && PROT.includes(k)) { E.ls[k] = String(v); persist(); return; } return s.call(this, k, v); };
  proto.removeItem = function (k) { if (E.on && this === localStorage && PROT.includes(k)) { delete E.ls[k]; persist(); return; } return r.call(this, k); };

  // ---- writing: always the latest state, one write at a time ----
  const doWrite = async () => {
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12)), ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, E.key, te.encode(JSON.stringify({ db: E.db, ls: E.ls })));
      s.call(localStorage, ENC, JSON.stringify({ format: MARK, salt: E.salt, iter: E.iter, iv: b64(iv), ct: b64(ct) })); E.err = '';
    } catch (e) { E.err = String((e && e.message) || e); }
  };
  let running = null, dirty = false;
  const persist = () => { if (!E.on) return Promise.resolve(); dirty = true; if (!running) running = (async () => { while (dirty) { dirty = false; await doWrite(); } running = null; })(); return running; };
  E.write = txt => { E.db = txt; return persist(); };    // the data, called by App.save
  E.flush = () => persist();
  window.addEventListener('pagehide', () => { if (E.on && dirty) persist(); });

  const idbDrop = () => new Promise(ok => { try { const o = indexedDB.open('cispolstore', 1); o.onupgradeneeded = () => o.result.createObjectStore('kv'); o.onerror = () => ok(); o.onsuccess = () => { try { const t = o.result.transaction('kv', 'readwrite'); t.objectStore('kv').delete('db2'); t.oncomplete = t.onerror = t.onabort = () => ok(); } catch (e) { ok(); } }; } catch (e) { ok(); } });
  const readBlob = () => g.call(localStorage, ENC);

  // ---- switching on / off / changing the passphrase (called from Réglages) ----
  E.enable = async (pass, dbTxt) => {
    if (E.on) throw new Error('already');
    const salt = crypto.getRandomValues(new Uint8Array(16)); E.salt = b64(salt); E.iter = ITER; E.key = await derive(pass, salt, ITER);
    E.db = dbTxt; E.ls = {}; PROT.forEach(k => { const v = g.call(localStorage, k); if (v !== null) E.ls[k] = v; });
    E.on = true; await persist();
    let good = false; try { const o = await open(readBlob() || '', pass); good = o.payload.db === dbTxt; } catch (e) {}
    if (!good) { E.on = false; E.key = null; r.call(localStorage, ENC); throw new Error('verify'); }   // nothing was removed yet: the data is untouched
    r.call(localStorage, KEY); r.call(localStorage, OLD); PROT.forEach(k => r.call(localStorage, k)); await idbDrop();
    r.call(localStorage, FAIL);
  };
  E.check = async pass => { try { await open(readBlob() || '', pass); return true; } catch (e) { return false; } };
  E.change = async (pass, dbTxt) => {
    const salt = crypto.getRandomValues(new Uint8Array(16)), key = await derive(pass, salt, ITER), old = { salt: E.salt, iter: E.iter, key: E.key };
    E.salt = b64(salt); E.iter = ITER; E.key = key; E.db = dbTxt; await persist();
    let good = false; try { good = (await open(readBlob() || '', pass)).payload.db === dbTxt; } catch (e) {}
    if (!good) { Object.assign(E, { salt: old.salt, iter: old.iter, key: old.key }); await persist(); throw new Error('verify'); }
  };
  E.disable = async dbTxt => {
    s.call(localStorage, KEY, dbTxt); Object.keys(E.ls).forEach(k => s.call(localStorage, k, E.ls[k]));
    r.call(localStorage, ENC); E.on = false; E.key = null; E.ls = {}; E.db = ''; E.fresh = false;
  };
  E.wipe = async () => { r.call(localStorage, ENC); r.call(localStorage, KEY); r.call(localStorage, OLD); PROT.forEach(k => r.call(localStorage, k)); r.call(localStorage, FAIL); await idbDrop(); };
  E.wipeOpt = () => g.call(localStorage, WIPE) === '1';
  E.setWipeOpt = on => { if (on) s.call(localStorage, WIPE, '1'); else r.call(localStorage, WIPE); };

  // ---- cold start with encrypted data: ask for the passphrase before anything else ----
  const blob0 = (() => { try { return readBlob(); } catch (e) { return null; } })();
  if (!blob0) return;
  const fails = () => { try { return JSON.parse(g.call(localStorage, FAIL)) || { n: 0, until: 0 }; } catch (e) { return { n: 0, until: 0 }; } };
  const lockHTML = `<div id="lock" style="display:flex">
    <img src="logo.png" alt=""><h1>Données protégées</h1><p>Entrez le mot de passe de l'application pour déchiffrer les données de ce téléphone.</p>
    <input id="gp" type="password" autocomplete="current-password" placeholder="Mot de passe" style="width:100%;max-width:300px"><p class="warn" id="gm"></p>
    <button class="btn" id="gb">Déverrouiller</button><button class="lnk" id="gf">Mot de passe oublié ?</button><p id="gh" style="display:none;font-size:13px;max-width:320px">Sans ce mot de passe, les données de ce téléphone ne peuvent pas être lues. Elles ne sont pas perdues pour autant : restaurez une sauvegarde, ou reconnectez la synchronisation après avoir effacé les données de ce téléphone.<br><button class="btn sec sm" id="gw" style="margin-top:8px">Effacer les données de ce téléphone</button></p></div>`;
  window.__gateLocked = true;                 // belt and braces: core.js refuses to start while this is set
  try { window.stop(); } catch (e) {}          // the scripts after this one must NOT run (the application would start with empty data)
  { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'style.css'; document.head.appendChild(l); }
  document.body.innerHTML = lockHTML; document.body.style.background = '#0c2542';
  const $ = id => document.getElementById(id), msg = t => { $('gm').textContent = t; };
  let wait = null;
  const tick = () => { const f = fails(), left = Math.ceil((f.until - Date.now()) / 1000); if (left > 0) { msg(`Trop d'essais : patientez ${left} s`); $('gb').disabled = true; wait = setTimeout(tick, 1000); } else { $('gb').disabled = false; if ($('gm').textContent.startsWith('Trop')) msg(''); } };
  const go = async () => {
    const pass = $('gp').value; if (!pass) return; const f = fails(); if (f.until > Date.now()) return tick();
    $('gb').disabled = true; msg('Vérification…');
    let o = null; try { o = await open(blob0, pass); } catch (e) {}
    if (!o) {
      const n = f.n + 1; s.call(localStorage, FAIL, JSON.stringify({ n, until: n >= 3 ? Date.now() + Math.min(3600, 30 * 2 ** (n - 3)) * 1000 : 0 }));
      if (n >= 10 && E.wipeOpt()) { await E.wipe(); msg('Trop d\'essais : les données de ce téléphone ont été effacées.'); setTimeout(() => location.reload(), 1500); return; }
      $('gp').value = ''; $('gb').disabled = false; msg('Mot de passe incorrect' + (E.wipeOpt() && n >= 5 ? ` (${10 - n} essai(s) avant l'effacement des données de ce téléphone)` : '')); tick(); return;
    }
    r.call(localStorage, FAIL);
    Object.assign(E, { on: true, fresh: true, key: o.key, salt: o.salt, iter: o.iter, db: o.payload.db || '', ls: o.payload.ls || {} });
    msg('Ouverture…');
    let html = ''; for (const u of [location.href.split('#')[0], 'index.html']) { try { const rs = await fetch(u); if (rs.ok && /<script/i.test(html = await rs.text())) break; html = ''; } catch (e) { html = ''; } }
    if (!html) { E.on = false; E.key = null; msg('Impossible de démarrer : rechargez la page.'); $('gb').disabled = false; return; }
    const doc = new DOMParser().parseFromString(html, 'text/html'), srcs = [...doc.querySelectorAll('script[src]')].map(x => x.getAttribute('src')).filter(x => !/gate\.js/.test(x));
    doc.querySelectorAll('script').forEach(x => x.remove());
    document.body.className = doc.body.className; document.body.removeAttribute('style'); document.body.innerHTML = doc.body.innerHTML;
    window.__gateLocked = false;
    for (const src of srcs) await new Promise(ok => { const el = document.createElement('script'); el.src = src; el.onload = el.onerror = ok; document.body.appendChild(el); });   // sequential: same order as index.html
    window.__gateDone = true;
  };
  $('gb').onclick = go; $('gp').onkeydown = e => { if (e.key === 'Enter') go(); }; $('gf').onclick = () => { $('gh').style.display = 'block'; };
  $('gw').onclick = async () => { if (confirm('Effacer toutes les données de ce téléphone ? Elles ne pourront être récupérées que par une sauvegarde ou la synchronisation.')) { await E.wipe(); location.reload(); } };
  $('gp').focus(); tick();
})();
