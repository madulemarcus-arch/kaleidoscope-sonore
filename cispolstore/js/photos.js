// Home decor: the card with the amount can show a built-in scene or your own photos (camera, gallery or Google Drive) behind the animation.
// Photos are shrunk on the phone and kept in their own IndexedDB (never in the main data, which would fill localStorage);
// they stay on this device and are not part of backups.
(() => {
  const App = window.App, $ = id => document.getElementById(id), esc = App.esc, MAX = 8;
  const DECORS = [['def', 'Par défaut'], ['sunset', '🌅 Coucher de soleil'], ['night', '🌌 Nuit'], ['aurora', '💚 Aurore'], ['starlink', '🛰️ Starlink'], ['photos', '🖼️ Mes photos']];
  const BUNDLED = ['photos/starlink-1.jpg', 'photos/starlink-2.jpg', 'photos/starlink-3.jpg', 'photos/starlink-4.jpg']; // Starlink decor shipped with the app (cached by the service worker)
  const open = () => new Promise((ok, ko) => { const o = indexedDB.open('cispolstore-photos', 1); o.onupgradeneeded = () => o.result.createObjectStore('p'); o.onerror = () => ko(o.error); o.onsuccess = () => ok(o.result); });
  const tx = (mode, fn) => open().then(d => new Promise((ok, ko) => { const r = fn(d.transaction('p', mode).objectStore('p')); r.onsuccess = () => { d.close(); ok(r.result); }; r.onerror = () => { d.close(); ko(r.error); }; }));
  const urls = new Map(), revoke = id => { if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); } };
  const ids = () => App.db.settings.bgs || (App.db.settings.bgs = []);
  // JPEG blob whose longest side is at most `max` px (the orientation from the camera is applied)
  const shrink = async (src, max, q) => {
    let bmp; try { bmp = await createImageBitmap(src, { imageOrientation: 'from-image' }); } catch (e) { bmp = await new Promise((ok, ko) => { const i = new Image(), u = URL.createObjectURL(src); i.onload = () => { URL.revokeObjectURL(u); ok(i); }; i.onerror = ko; i.src = u; }); }
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close();
    return new Promise(ok => c.toBlob(ok, 'image/jpeg', q));
  };
  const size = n => n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' Ko' : (n / 1048576).toFixed(1).replace('.', ',') + ' Mo';
  const P = App.photo = {
    get: id => tx('readonly', s => s.get(id)),
    url: async id => { if (urls.has(id)) return urls.get(id); const b = await P.get(id); if (!b) return null; const u = URL.createObjectURL(b); urls.set(id, u); return u; },
    add: async file => { const id = 'bg' + Date.now().toString(36), b = await shrink(file, 1280, .72); await tx('readwrite', s => s.put(b, id)); ids().push(id); return id; },
    del: async id => { revoke(id); await tx('readwrite', s => s.delete(id)); const l = ids(), i = l.indexOf(id); if (i >= 0) l.splice(i, 1); },
    stats: async () => { const all = await tx('readonly', s => s.getAll()); return { n: all.length, bytes: all.reduce((t, b) => t + b.size, 0) }; },
    // re-encodes every photo smaller (800 px, lower quality) and returns the bytes freed
    lighten: async () => { let saved = 0; for (const id of ids().slice()) { const b = await P.get(id); if (!b) continue; const nb = await shrink(b, 800, .6); if (nb.size < b.size) { await tx('readwrite', s => s.put(nb, id)); saved += b.size - nb.size; revoke(id); } } return saved; },
    clear: async () => { await tx('readwrite', s => s.clear()); urls.forEach((u, id) => revoke(id)); App.db.settings.bgs = []; if (App.db.settings.decor === 'photos') App.db.settings.decor = 'def'; },
    // called inside the tap, so that the phone offers the camera, the gallery and Drive
    pick: cam => new Promise(ok => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; if (cam) i.setAttribute('capture', 'environment'); i.onchange = () => ok(i.files[0] || null); i.addEventListener('cancel', () => ok(null)); i.click(); })
  };

  // ---------- the card with the amount: scene class now, photos as soon as they are read ----------
  // Small photo cards pass across the card. Each pass picks a direction at random (never the same twice in a row):
  // left to right, right to left, top to bottom, bottom to top, or flying out from the centre. WAAPI animations run on the compositor, so it stays light.
  const DIRS = ['ltr', 'rtl', 'ttb', 'btt', 'center'], rnd = (a, b) => a + Math.random() * (b - a), reduce = () => window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  P.dirs = []; P.next = null; P.dir = () => P.dirs[P.dirs.length - 1] || '';
  P.hero = () => {
    P.next = null;
    const h = document.querySelector('#view .hero'); if (!h || App.state.view !== 'home') return;
    const S = App.db.settings, d = DECORS.some(x => x[0] === S.decor) ? S.decor : 'def';
    DECORS.forEach(x => h.classList.remove('decor-' + x[0])); if (d !== 'def') h.classList.add('decor-' + d);
    h.querySelectorAll('.hbg').forEach(x => x.remove());
    const items = d === 'starlink' ? BUNDLED.slice() : d === 'photos' ? ids().slice() : [];
    if (!items.length) return;
    const bg = document.createElement('div'); bg.className = 'hbg'; bg.setAttribute('aria-hidden', 'true'); h.prepend(bg);
    Promise.all(items.map(id => id.startsWith('photos/') ? id : P.url(id).catch(() => null))).then(us => {
      if (!bg.isConnected) return;
      const urls = us.filter(Boolean); if (!urls.length) return;
      let anims = [], timer = 0, last = '', seq = 0, pool = [];
      const W = () => h.clientWidth, H = () => h.clientHeight;
      const card = (w, hh) => { if (!pool.length) pool = urls.slice().sort(() => Math.random() - .5); const c = document.createElement('i'); c.className = 'hcard'; c.style.width = w + 'px'; c.style.height = hh + 'px'; c.style.backgroundImage = `url(${pool.pop()})`; bg.appendChild(c); return c; };
      const go = (c, frames, ms, delay) => { const a = c.animate(frames, { duration: ms, delay, easing: 'linear', fill: 'both' }); anims.push(a); return a; };
      const pass = force => {
        if (!bg.isConnected) return; clearTimeout(timer);
        if (document.hidden) { timer = setTimeout(() => pass(), 1000); return; }
        anims.forEach(a => a.cancel()); anims = []; bg.textContent = '';
        let dir = force; if (!dir) { do dir = DIRS[Math.floor(Math.random() * DIRS.length)]; while (dir === last); } last = dir; P.dirs.push(dir); if (P.dirs.length > 30) P.dirs.shift();
        const w = W(), hh = H(), id = ++seq, cw = 140, tilt = () => rnd(-4, 4);
        if (dir === 'ltr' || dir === 'rtl') { // a row of cards, zigzag, crossing the width
          const ch = Math.round(hh * .56), sp = 150, ms = (w + cw) / sp * 1000, n = Math.max(5, Math.ceil(w / (cw + 16)) + 3);
          for (let i = 0; i < n; i++) { const c = card(cw, ch), y = hh * .22 + (i % 2 ? 1 : -1) * hh * .07, r = tilt(), x0 = dir === 'ltr' ? -cw : w, x1 = dir === 'ltr' ? w : -cw;
            go(c, [{ transform: `translate(${x0}px,${y}px) rotate(${r}deg)` }, { transform: `translate(${x1}px,${y}px) rotate(${r}deg)` }], ms, i * (cw + 16) / sp * 1000); }
        } else if (dir === 'ttb' || dir === 'btt') { // columns of cards falling or rising
          const lanes = Math.max(2, Math.min(5, Math.round(w / 170))), ch = Math.round(Math.min(170, hh * .5)), sp = 130, ms = (hh + ch) / sp * 1000;
          for (let i = 0; i < lanes * 2; i++) { const c = card(cw - 20, ch), x = ((i % lanes) + .5) * w / lanes - (cw - 20) / 2 + rnd(-10, 10), r = tilt(), y0 = dir === 'ttb' ? -ch : hh, y1 = dir === 'ttb' ? hh : -ch;
            go(c, [{ transform: `translate(${x}px,${y0}px) rotate(${r}deg)` }, { transform: `translate(${x}px,${y1}px) rotate(${r}deg)` }], ms, (i % lanes) * 450 + Math.floor(i / lanes) * (ms * .55) + rnd(0, 250)); }
        } else { // from the centre: the cards grow and fly out in every direction
          const n = 6, ch = Math.round(hh * .42), cx = w / 2 - cw / 2, cy = hh / 2 - ch / 2, off = rnd(0, 6.28);
          for (let i = 0; i < n; i++) { const c = card(cw, ch), a = off + i / n * 6.283 + rnd(-.3, .3), dx = Math.cos(a) * w * .7, dy = Math.sin(a) * hh * .75, r = rnd(-10, 10);
            go(c, [{ transform: `translate(${cx}px,${cy}px) scale(.15) rotate(0deg)`, opacity: 0 }, { opacity: .95, offset: .3 }, { transform: `translate(${cx + dx}px,${cy + dy}px) scale(1.15) rotate(${r}deg)`, opacity: 0 }], 2800, i * 330); }
        }
        Promise.all(anims.map(a => a.finished.catch(() => null))).then(() => { if (id === seq && bg.isConnected) timer = setTimeout(() => pass(), rnd(300, 900)); });
      };
      if (reduce()) { for (let i = 0; i < 3; i++) { const c = card(120, Math.round(H() * .5)); c.style.transform = `translate(${(i + .5) * W() / 3 - 70}px,${H() * .25}px) rotate(${(i - 1) * 3}deg)`; } return; }
      P.next = dir => pass(dir); pass();
    });
  };

  // ---------- settings ----------
  App.photoCard = () => { const S = App.db.settings, cur = DECORS.some(x => x[0] === S.decor) ? S.decor : 'def', l = ids();
    return `<h2 class="sec">Décor de l'accueil</h2><div class="card"><div class="chips" role="group" aria-label="Décor">${DECORS.map(([k, t]) => `<button class="chip ${cur === k ? 'on' : ''}" data-act="decor_set" data-d="${k}" aria-pressed="${cur === k}">${t}</button>`).join('')}</div>
      <p class="mut" style="margin:6px 0 10px">Le décor s'affiche derrière l'animation, dans la carte du montant. Avec « Starlink » ou « Mes photos », de petites photos défilent les unes derrière les autres.</p>
      ${l.length ? `<div class="phgrid">${l.map(id => `<span class="phth"><img data-phimg="${id}" alt=""><button type="button" data-act="ph_del" data-id="${id}" aria-label="Supprimer cette photo">✕</button></span>`).join('')}</div>` : ''}
      <div class="bar"><button class="btn sm" data-act="ph_add" data-cam="1">📷 Prendre une photo</button><button class="btn sm sec" data-act="ph_add">🖼️ Galerie ou Drive</button></div>
      <div class="spread" style="margin-top:12px"><b>Espace utilisé</b><span class="mut" data-phstats>…</span></div>
      <p class="mut" style="margin:6px 0 10px">Photos réduites automatiquement (${MAX} au maximum), gardées sur cet appareil uniquement : elles ne sont pas dans les sauvegardes.</p>
      <div class="bar"><button class="btn sm" data-act="ph_shrink">🪶 Alléger les photos</button><button class="btn sm del" data-act="ph_clear">Tout supprimer</button></div></div>`; };
  App.actions.decor_set = d => { const S = App.db.settings; if (d.d === 'photos' && !ids().length) return App.toast('Ajoutez d\'abord une photo'); S.decor = d.d; App.save(); App.refresh(); };
  App.actions.ph_add = d => { if (ids().length >= MAX) return App.toast(`${MAX} photos au maximum : supprimez-en une`);
    P.pick(!!d.cam).then(async f => { if (!f) return; const hide = App.busy('Réduction de la photo…');
      try { await P.add(f); App.db.settings.decor = 'photos'; App.save(); App.refresh(); App.toast('Photo ajoutée'); } catch (e) { App.toast('Photo impossible : ' + (e && e.message ? e.message : 'fichier illisible')); } finally { hide(); } }); };
  App.actions.ph_del = d => { if (!App.confirm('Supprimer cette photo ?')) return; P.del(d.id).then(() => { if (!ids().length && App.db.settings.decor === 'photos') App.db.settings.decor = 'def'; App.save(); App.refresh(); }); };
  App.actions.ph_shrink = () => { const hide = App.busy('Allègement des photos…'); P.lighten().then(n => { App.toast(n ? size(n) + ' libérés' : 'Photos déjà légères'); App.refresh(); }).catch(() => App.toast('Allègement impossible')).finally(hide); };
  App.actions.ph_clear = () => { if (!App.confirm('Supprimer toutes les photos de cet appareil ?')) return; P.clear().then(() => { App.save(); App.refresh(); App.toast('Photos supprimées'); }); };

  // fills the thumbnails and the counter once they are on screen
  const paint = async () => {
    for (const im of document.querySelectorAll('[data-phimg]:not([data-pd])')) { im.dataset.pd = '1'; const u = await P.url(im.dataset.phimg).catch(() => null); if (u) im.src = u; }
    const s = document.querySelector('[data-phstats]:not([data-pd])'); if (s) { s.dataset.pd = '1'; const t = await P.stats().catch(() => null); s.textContent = !t ? 'indisponible' : t.n ? `${t.n} photo${t.n > 1 ? 's' : ''} · ${size(t.bytes)}` : 'aucune photo'; }
  };
  let timer; new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(paint, 30); }).observe($('view'), { childList: true, subtree: true });
  P.paint = paint;
})();
