// Client photos: taken with the camera or picked from the gallery / Google Drive, shrunk on the phone and kept in their own
// IndexedDB (never in the main data, which would fill localStorage). They stay on this device and are not part of backups.
(() => {
  const App = window.App, $ = id => document.getElementById(id), esc = App.esc;
  const open = () => new Promise((ok, ko) => { const o = indexedDB.open('cispolstore-photos', 1); o.onupgradeneeded = () => o.result.createObjectStore('p'); o.onerror = () => ko(o.error); o.onsuccess = () => ok(o.result); });
  const tx = (mode, fn) => open().then(d => new Promise((ok, ko) => { const r = fn(d.transaction('p', mode).objectStore('p')); r.onsuccess = () => { d.close(); ok(r.result); }; r.onerror = () => { d.close(); ko(r.error); }; }));
  const urls = new Map(), revoke = id => { if (urls.has(id)) { URL.revokeObjectURL(urls.get(id)); urls.delete(id); } };
  // JPEG blob whose longest side is at most `max` px (orientation from the camera is applied)
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
    set: async (id, file) => { const b = await shrink(file, 800, .75); await tx('readwrite', s => s.put(b, id)); revoke(id); return b.size; },
    del: id => { revoke(id); return tx('readwrite', s => s.delete(id)); },
    stats: async () => { const all = await tx('readonly', s => s.getAll()); return { n: all.length, bytes: all.reduce((t, b) => t + b.size, 0) }; },
    // re-encodes every photo smaller (480 px, lower quality) and returns the bytes freed
    lighten: async () => { const keys = await tx('readonly', s => s.getAllKeys()); let saved = 0;
      for (const id of keys) { const b = await P.get(id), nb = await shrink(b, 480, .6); if (nb.size < b.size) { await tx('readwrite', s => s.put(nb, id)); saved += b.size - nb.size; revoke(id); } } return saved; },
    clear: async () => { await tx('readwrite', s => s.clear()); urls.forEach((u, id) => revoke(id)); App.db.clients.forEach(c => { delete c.ph; }); },
    // called inside the tap, so that the phone offers the camera, the gallery and Drive
    pick: cam => new Promise(ok => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; if (cam) i.setAttribute('capture', 'environment'); i.onchange = () => ok(i.files[0] || null); i.addEventListener('cancel', () => ok(null)); i.click(); })
  };

  App.actions.ph_open = d => { const c = App.client(d.id); if (!c) return;
    App.modal('Photo · ' + App.cname(c), `${c.ph ? `<div style="text-align:center;margin-bottom:12px"><img data-phimg="${c.id}" alt="" style="max-width:100%;max-height:260px;border-radius:14px"></div>` : '<p class="mut" style="margin-top:0">Aucune photo pour ce client.</p>'}
      <div class="bar"><button type="button" class="btn sm" data-act="ph_pick" data-id="${c.id}" data-cam="1">📷 Prendre une photo</button><button type="button" class="btn sm sec" data-act="ph_pick" data-id="${c.id}">🖼️ Galerie ou Drive</button>${c.ph ? `<button type="button" class="btn sm del" data-act="ph_rm" data-id="${c.id}">Supprimer</button>` : ''}</div>
      <p class="mut" style="margin-bottom:0">La photo est réduite automatiquement (environ 60 Ko) et reste sur cet appareil.</p>`); };
  App.actions.ph_pick = d => { const c = App.client(d.id); if (!c) return;
    P.pick(!!d.cam).then(async f => { if (!f) return; const hide = App.busy('Réduction de la photo…');
      try { await P.set(c.id, f); c.ph = 1; App.save(); App.close(); App.refresh(); App.toast('Photo enregistrée'); } catch (e) { App.toast('Photo impossible : ' + (e && e.message ? e.message : 'fichier illisible')); } finally { hide(); } }); };
  App.actions.ph_rm = d => { const c = App.client(d.id); if (!c || !App.confirm('Supprimer la photo de ' + App.cname(c) + ' ?')) return; P.del(c.id).then(() => { delete c.ph; App.save(); App.close(); App.refresh(); App.toast('Photo supprimée'); }); };
  App.actions.ph_shrink = () => { const hide = App.busy('Allègement des photos…'); P.lighten().then(n => { App.toast(n ? size(n) + ' libérés' : 'Photos déjà légères'); App.refresh(); }).catch(() => App.toast('Allègement impossible')).finally(hide); };
  App.actions.ph_clear = () => { if (!App.confirm('Supprimer toutes les photos de cet appareil ?')) return; P.clear().then(() => { App.save(); App.refresh(); App.toast('Photos supprimées'); }); };
  // deleting a client deletes the photo too
  const del = App.actions.delclient; App.actions.delclient = d => { const had = (App.client(d.id) || {}).ph; del(d); if (had && !App.client(d.id)) P.del(d.id).catch(() => {}); };

  App.photoCard = () => `<h2 class="sec">Photos des clients</h2><div class="card"><div class="spread"><b>📷 Espace utilisé</b><span class="mut" data-phstats>…</span></div>
    <p class="mut" style="margin:6px 0 10px">Les photos sont réduites automatiquement et gardées sur cet appareil uniquement : elles ne sont pas dans les sauvegardes.</p>
    <div class="bar"><button class="btn sm" data-act="ph_shrink">🪶 Alléger les photos</button><button class="btn sm del" data-act="ph_clear">Tout supprimer</button></div></div>`;

  // fills the avatars, the preview and the counter once they are on screen
  const paint = async () => {
    for (const el of document.querySelectorAll('[data-ph]:not([data-pd])')) { el.dataset.pd = '1'; const u = await P.url(el.dataset.ph).catch(() => null); if (u) { el.style.backgroundImage = `url(${u})`; el.classList.add('hasph'); } }
    for (const im of document.querySelectorAll('[data-phimg]:not([data-pd])')) { im.dataset.pd = '1'; const u = await P.url(im.dataset.phimg).catch(() => null); if (u) im.src = u; }
    const s = document.querySelector('[data-phstats]:not([data-pd])'); if (s) { s.dataset.pd = '1'; const t = await P.stats().catch(() => null); s.textContent = !t ? 'indisponible' : t.n ? `${t.n} photo${t.n > 1 ? 's' : ''} · ${size(t.bytes)}` : 'aucune photo'; }
  };
  let timer; const obs = new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(paint, 30); });
  obs.observe($('view'), { childList: true, subtree: true }); obs.observe($('dlg'), { childList: true, subtree: true });
  App.photo.paint = paint;
})();
