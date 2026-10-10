// Settings: company, application, security, data (backup / restore / export).
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const ACC = [['orange', '#d5522f', 'Orange'], ['blue', '#2f7de1', 'Bleu'], ['green', '#169c5b', 'Vert'], ['violet', '#7c5cff', 'Violet'], ['pink', '#e0457b', 'Rose'], ['gold', '#c98a0a', 'Or']];
  // header of the Plus and Settings screens: company, who is signed in, and three status badges (PIN, backup, synchronisation)
  App.profileHero = (withVersion) => {
    const S = App.db.settings, co = S.company, me = App.me(), lastB = [S.lastBackup, App.drive && App.drive.lastDate()].filter(Boolean).sort().pop(), age = lastB ? -App.diff(lastB, App.today()) : null;
    const b = (cls, ico, txt, act) => `<${act && App.guard(act) ? `button data-act="${act}"` : 'span'} class="sbadge ${cls}"><i>${ico}</i>${txt}</${act && App.guard(act) ? 'button' : 'span'}>`;
    const sy = App.sync && App.sync.status !== 'off';
    return `<section class="hero phero"><div class="chead"><img src="${esc(co.logo || 'logo.png')}" alt=""><div><h2>${esc(co.name)}</h2><small>${me.name && me.name !== App.role().label ? esc(me.name) + ' · ' : ''}${esc(App.role().label)}${withVersion ? ' · version 2.0' : ''}</small></div></div>
      <div class="sbadges">${b(App.hasPin() ? 'ok' : 'warn', '🔐', App.hasPin() ? 'Protégé par PIN' : 'Sans PIN', App.hasPin() ? '' : 'pinset')}${b(age !== null && age <= 7 ? 'ok' : 'warn', '💾', age === null ? 'Aucune sauvegarde' : age === 0 ? 'Sauvegardé aujourd\'hui' : `Sauvegarde il y a ${age} j`, 'backup')}${b(sy ? 'ok' : '', '🔄', sy ? 'Synchronisé' : 'Hors synchronisation')}</div></section>`;
  };
  App.persisted = null;

  const row = (t, s, btn) => `<div class="item"><div class="grow"><b>${t}</b><small style="white-space:normal">${s}</small></div>${btn || ''}</div>`;
  const LOCKS = [[0, 'Jamais'], [1, '1 minute'], [2, '2 minutes'], [5, '5 minutes'], [15, '15 minutes']];
  App.views.settings = () => {
    const S = App.db.settings, co = S.company, lastB = [S.lastBackup, App.drive && App.drive.lastDate()].filter(Boolean).sort().pop(), age = lastB ? -App.diff(lastB, App.today()) : null;
    const warn = App.hasData(App.db) && (age === null || age > 7);
    return {
      title: 'Paramètres', back: 'more', nav: 'more',
      html: `${App.profileHero()}<h2 class="sec">Entreprise</h2><div class="list">
          <div class="item"><img src="${esc(co.logo || 'logo.png')}" alt="" style="height:48px;background:#fff;border-radius:8px;padding:2px"><div class="grow"><b>${esc(co.name)}</b><small>${esc(co.address)}</small><small>${esc(co.phone)} · ${esc(co.email)}</small><small>RCCM : ${esc(co.rccm || '—')} · ID. Nat. : ${esc(co.idnat || '—')} · N° Impôt : ${esc(co.impot || '—')}</small></div><button class="btn sm sec" data-act="setco">Modifier</button></div></div>
        <h2 class="sec">Application</h2><div class="list">
          ${row('Taux USD / CDF', `1 $ = ${App.nf(S.rate, 0)} CDF (taux actuel : chaque facture et chaque paiement garde son propre taux)`, '<button class="btn sm sec" data-act="setapp">Modifier</button>')}
          ${row('Abonnements', `Durée par défaut : ${S.period} jours · Sursis par défaut : ${S.grace} jours`)}
          ${row('Thème', ({ auto: 'Automatique (suit le téléphone)', light: 'Clair', dark: 'Sombre', black: 'Noir' }[S.theme] || 'Automatique') + ' · couleur ' + (ACC.find(a => a[0] === (S.accent || 'orange')) || ACC[0])[2].toLowerCase() + ' · bouton ☀️/🌙 en haut de l\'écran')}
          ${row('Notifications', 'Les alertes d\'expiration (7, 3, 1 jour avant et le jour même) s\'affichent sur l\'écran d\'accueil.')}</div>
        ${App.fold('share', 'Partager', `<div class="list">
          ${row("Partager l'application", `Lien à envoyer : <b style="word-break:break-all">${esc(new URL('./', location.href).href)}</b><br>Chaque personne installe l'application depuis ce lien ; ses données restent sur son appareil, sauf si elle active la synchronisation avec les mêmes réglages.`, '<button class="btn sm" data-act="shareapp">Partager</button>')}</div>`)}
        <h2 class="sec">Sécurité</h2><div class="list">
          ${App.multi() ? '' : row('Code PIN', S.pin ? 'Activé (4 chiffres)' : 'Non défini : tout le monde peut ouvrir l\'application', S.pin ? '<button class="btn sm sec" data-act="pinchange">Modifier</button>' : '<button class="btn sm" data-act="pinset">Définir</button>')}
          ${!App.multi() && S.pin ? row('Désactiver le PIN', 'Retire le verrouillage', '<button class="btn sm del" data-act="pinremove">Désactiver</button>') : ''}
          <div class="item"><div class="grow"><b>Verrouillage auto</b><small>Après inactivité</small></div><select id="s_lock" style="width:auto">${App.opts(LOCKS, S.lockMin)}</select></div>
          ${App.usersRow()}</div>
        <p class="mut" style="font-size:13px">Le PIN verrouille l'écran de l'application ; il ne chiffre pas les données stockées dans le téléphone.</p>
        ${App.plansCard()}
        ${App.remindCard()}
        ${App.fold('sync', 'Synchronisation entre appareils', App.syncCard().replace(/^<h2 class="sec">.*?<\/h2>/, ''))}
        ${App.driveCard ? App.fold('drive', 'Sauvegarde Google Drive', App.driveCard().replace(/^<h2 class="sec">.*?<\/h2>/, '')) : ''}
        ${App.fold('data', 'Données, sauvegarde et exports', `<div class="list">
          ${row('Stockage interne', `Les données sont enregistrées dans la mémoire de cet appareil, même sans internet. Protection contre l'effacement : <b class="${App.persisted ? 'ok' : 'warn'}">${App.persisted ? 'activée' : App.persisted === false ? 'non garantie (installez l\'application)' : 'en cours…'}</b>`)}
          ${row('Sauvegarde', `Dernière sauvegarde : <b class="${warn ? 'warn' : ''}">${lastB ? App.fdate(lastB) : 'jamais'}</b>${warn ? ' — pensez à en faire une.' : ''}`, '<button class="btn sm" data-act="backup">Sauvegarder</button>')}
          ${row('Restaurer / importer', 'Recharger un fichier de sauvegarde (.json), y compris de l\'ancienne version.', '<label class="btn sm sec" style="cursor:pointer">Restaurer<input type="file" id="s_restore" accept=".json,application/json" hidden></label>')}
          ${row('Importer des clients', 'Ajouter d\'un coup les clients d\'un fichier Excel (.xlsx) ou CSV.', '<button class="btn sm sec" data-act="go" data-v="importc">Importer</button>')}
          ${row('Importer des factures', 'Ajouter d\'anciennes factures depuis des fichiers Word (.docx) : aperçu, client trouvé ou créé, payée ou non.', '<button class="btn sm sec" data-act="go" data-v="importf">Importer</button>')}
          ${row('Exporter en CSV', 'Un tableau à la fois (Excel, Google Sheets).', '<button class="btn sm sec" data-act="exportcsv">Choisir…</button>')}
          ${row('Exporter en Excel', 'Un classeur .xlsx avec une feuille par thème.', '<button class="btn sm sec" data-act="xlsx">Excel</button>')}</div>`)}
        <div class="bar" style="margin-top:16px"><button class="btn blue" data-act="lockNow">🔒 Verrouiller maintenant</button></div>`,
      after: () => {
        $('s_lock').onchange = () => { S.lockMin = +$('s_lock').value; App.save(); App.toast('Enregistré'); };
        $('s_restore').onchange = e => restore(e.target.files[0], e.target);
      }
    };
  };

  // Share the app link (Android share sheet, otherwise copy to clipboard)
  App.actions.shareapp = async () => {
    const url = new URL('./', location.href).href, data = { title: 'CISPOLstore Manager', text: 'Application de gestion CISPOLstore : installez-la depuis ce lien.', url };
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(url); App.toast('Lien copié'); } }
    catch (e) { if (e.name === 'AbortError') return; try { await navigator.clipboard.writeText(url); App.toast('Lien copié'); } catch (e2) { window.prompt('Copiez ce lien :', url); } }
  };
  App.actions.setco = () => {
    const co = App.db.settings.company;
    App.modal("Informations de l'entreprise",
      `<div class="item" style="padding-left:0"><img id="s_prev" src="${esc(co.logo || 'logo.png')}" style="height:56px;background:#fff;border-radius:8px;padding:2px"><label class="btn sm sec" style="cursor:pointer;margin-left:auto">Changer le logo<input type="file" id="s_logo" accept="image/*" hidden></label></div>
       ${F.text('f_name', 'Nom', co.name)}${F.text('f_addr', 'Adresse', co.address)}<div class="row">${F.text('f_phone', 'Téléphone', co.phone, 'type="tel"')}${F.text('f_mail', 'E-mail', co.email, 'type="email"')}</div>
       ${F.text('f_tag', 'Sous-titre (facture)', co.tagline)}<div class="row">${F.text('f_city', 'Ville (facture)', co.city)}${F.text('f_terms', 'Mode de règlement (facture)', co.payTerms)}</div>${F.text('f_rccm', 'RCCM', co.rccm)}<div class="row">${F.text('f_idnat', 'ID. Nat.', co.idnat)}${F.text('f_impot', 'N° Impôt', co.impot)}</div>`,
      () => { Object.assign(co, { name: App.v('f_name') || 'CISPOLstore', address: App.v('f_addr'), phone: App.v('f_phone'), email: App.v('f_mail'), tagline: App.v('f_tag'), city: App.v('f_city'), payTerms: App.v('f_terms'), rccm: App.v('f_rccm'), idnat: App.v('f_idnat'), impot: App.v('f_impot') }); App.save(); App.applyTheme(); App.refresh(); });
    $('s_logo').onchange = e => {
      const f = e.target.files[0]; if (!f) return; const fr = new FileReader();
      fr.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 320 / img.width), c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); co.logo = c.toDataURL('image/png'); $('s_prev').src = co.logo; App.save(); App.applyTheme(); }; img.src = fr.result; };
      fr.readAsDataURL(f);
    };
  };
  App.actions.setapp = () => {
    const S = App.db.settings;
    App.modal("Paramètres de l'application", `${F.num('f_rate', 'Taux : 1 $ = … CDF', S.rate, 'min="1"')}${F.num('f_period', "Durée d'abonnement par défaut (jours)", S.period, 'min="1"')}${F.num('f_grace', 'Sursis par défaut (jours)', S.grace)}${F.sel('f_theme', 'Thème', [['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre'], ['black', 'Noir (écrans OLED)']], S.theme)}<div class="fld"><label class="l">Couleur de l'application</label><input type="hidden" id="f_accent" value="${S.accent || 'orange'}"><div class="swatches">${ACC.map(([k, c, n]) => `<button type="button" data-ac="${k}" style="--c:${c}" aria-label="${n}" aria-pressed="${(S.accent || 'orange') === k}"></button>`).join('')}</div></div>`,
      () => { App.setRate(App.n('f_rate') || 2400); S.period = Math.max(1, Math.round(App.n('f_period')) || 30); S.grace = Math.max(0, Math.round(App.n('f_grace'))); S.theme = App.v('f_theme'); S.accent = App.v('f_accent'); App.save(); App.applyTheme(); App.refresh(); });
    const dl = document.querySelector('dialog[open]'); if (!dl) return;
    dl.querySelectorAll('.swatches button').forEach(b => b.onclick = () => { dl.querySelectorAll('.swatches button').forEach(x => x.setAttribute('aria-pressed', x === b)); $('f_accent').value = b.dataset.ac; if (b.dataset.ac === 'orange') delete document.documentElement.dataset.accent; else document.documentElement.dataset.accent = b.dataset.ac; });
    dl.addEventListener('close', () => App.applyTheme(), { once: true });
  };
  App.actions.pinset = () => App.showLock('new1', 'setup');
  App.actions.pinchange = () => App.showLock('enter', 'change');
  App.actions.pinremove = () => { if (App.confirm('Désactiver le code PIN ?')) App.showLock('enter', 'remove'); };
  App.actions.lockNow = () => $('lockBtn').click();

  // ---------- Backup / restore ----------
  App.actions.backup = async () => {
    const name = `cispolstore-sauvegarde-${App.today()}.json`, txt = JSON.stringify(App.exportData(), null, 1);
    try {
      const f = new File([txt], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: 'Sauvegarde CISPOLstore' });
      else App.download(name, txt, 'application/json');
    } catch (e) { if (e.name === 'AbortError') return; App.download(name, txt, 'application/json'); }
    App.db.settings.lastBackup = App.today(); App.save(); App.toast('Sauvegarde créée'); App.refresh();
  };
  // Restore from backup text (file or Google Drive)
  App.restoreData = text => {
    try {
      const o = JSON.parse(text);
      const d = o.v === 2 ? o : (Array.isArray(o.products) || Array.isArray(o.clients)) ? App.migrate(o) : null;
      if (!d) throw 0;
      if (!Array.isArray(d.technicians)) d.technicians = [];
      if (!Array.isArray(d.penalties)) d.penalties = [];
      if (!Array.isArray(d.deliveries)) d.deliveries = [];
      if (!Array.isArray(d.closings)) d.closings = [];
      if (!App.confirm('Remplacer toutes les données actuelles par cette sauvegarde ?' + (App.syncConfigured() ? ' Attention : la synchronisation enverra ce remplacement aux autres appareils.' : ''))) return false;
      const keep = App.db.settings; // PIN, theme and auto-lock belong to this device
      d.settings = { ...(d.settings || {}), pin: keep.pin, users: keep.users, pinAsked: keep.pinAsked, theme: keep.theme, accent: keep.accent, lockMin: keep.lockMin };
      App.db = d; App.save(); App.applyTheme(); App.toast('Données restaurées'); App.refresh(); return true;
    } catch (e) { App.toast('Fichier de sauvegarde invalide'); return false; }
  };
  const restore = (file, input) => {
    if (!file) return;
    file.text().then(t => App.restoreData(t)).finally(() => { input.value = ''; });
  };
  // quick change of the day's rate (it changes often): kept in a history, every document keeps its own rate
  App.actions.rate_edit = () => {
    const h = (App.db.settings.rates || []).slice(-6).reverse();
    App.modal('Taux du jour', `${App.f.num('f_rate', '1 $ = … CDF', App.rate(), 'min="1" step="1"')}<p class="mut" style="font-size:13px">Les factures et paiements déjà enregistrés gardent leur propre taux. Le nouveau taux sert pour les prochains.</p>${h.length ? `<div class="list">${h.map(x => `<div class="item"><div class="grow">${App.fdate(x.date)}</div><b>${App.nf(x.rate, 0)} CDF</b></div>`).join('')}</div>` : ''}`,
      () => { const r = Math.round(App.n('f_rate')); if (r < 1) { App.toast('Taux invalide'); return false; } if (App.setRate(r)) { App.save(); App.toast('Taux mis à jour : ' + App.nf(r, 0) + ' CDF'); } App.refresh(); });
  };
  App.actions.exportcsv = () => {
    const db = App.db, one = (t, k) => `<button class="opt" data-act="csvdo" data-k="${k}"><span><b>${t}</b></span></button>`;
    App.modal('Exporter en CSV', one('Clients', 'clients') + one('Factures', 'factures') + one('Paiements', 'paiements') + one('Dépenses', 'depenses') + one('Stock', 'stock'));
  };
  App.actions.csvdo = d => {
    const S = App.tables();
    App.download(`cispolstore-${d.k}-${App.today()}.csv`, App.csv(S[d.k].rows), 'text/csv'); App.close();
  };
  App.actions.xlsx = () => { App.download(`cispolstore-${App.today()}.xlsx`, App.makeXlsx(App.reportSheets()), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); App.toast('Fichier Excel créé'); };
})();
