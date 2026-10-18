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
  let slide = 0;
  P.hero = () => {
    const h = document.querySelector('#view .hero'); if (!h || App.state.view !== 'home') return;
    const S = App.db.settings, d = DECORS.some(x => x[0] === S.decor) ? S.decor : 'def';
    DECORS.forEach(x => h.classList.remove('decor-' + x[0])); if (d !== 'def') h.classList.add('decor-' + d);
    h.querySelectorAll('.hbg').forEach(x => x.remove());
    if (d !== 'starlink' && !(d === 'photos' && ids().length)) return;
    const bg = document.createElement('div'); bg.className = 'hbg'; bg.setAttribute('aria-hidden', 'true'); bg.innerHTML = '<i></i><i></i>'; h.prepend(bg);
    const [a, b] = bg.children, list = d === 'starlink' ? BUNDLED.slice() : ids().slice(); let cur = d === 'starlink' ? Math.floor(Math.random() * list.length) : 0, front = a;
    const show = async () => { if (!bg.isConnected) return; const id = list[cur % list.length], u = id.startsWith('photos/') ? id : await P.url(id).catch(() => null); if (!u || !bg.isConnected) return;
      const next = front === a ? b : a; next.style.backgroundImage = `url(${u})`; next.classList.add('on'); front.classList.remove('on'); front = next; cur++; };
    show();
    if (list.length > 1) { const t = setInterval(() => { if (!bg.isConnected) return clearInterval(t); if (!document.hidden) show(); }, 7000); }
  };

  // ---------- settings ----------
  App.photoCard = () => { const S = App.db.settings, cur = DECORS.some(x => x[0] === S.decor) ? S.decor : 'def', l = ids();
    return `<h2 class="sec">Décor de l'accueil</h2><div class="card"><div class="chips" role="group" aria-label="Décor">${DECORS.map(([k, t]) => `<button class="chip ${cur === k ? 'on' : ''}" data-act="decor_set" data-d="${k}" aria-pressed="${cur === k}">${t}</button>`).join('')}</div>
      <p class="mut" style="margin:6px 0 10px">Le décor s'affiche derrière l'animation, dans la carte du montant. Avec « Starlink » ou « Mes photos », les photos défilent doucement.</p>
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
