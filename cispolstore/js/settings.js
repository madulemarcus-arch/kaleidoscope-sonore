// Settings: company, application, security, data (backup / restore / export).
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  App.persisted = null;

  const row = (t, s, btn) => `<div class="item"><div class="grow"><b>${t}</b><small style="white-space:normal">${s}</small></div>${btn || ''}</div>`;
  const LOCKS = [[0, 'Jamais'], [1, '1 minute'], [2, '2 minutes'], [5, '5 minutes'], [15, '15 minutes']];
  App.views.settings = () => {
    const S = App.db.settings, co = S.company, lastB = [S.lastBackup, App.drive && App.drive.lastDate()].filter(Boolean).sort().pop(), age = lastB ? -App.diff(lastB, App.today()) : null;
    const warn = App.hasData(App.db) && (age === null || age > 7);
    return {
      title: 'Paramètres', back: 'more', nav: 'more',
      html: `<h2 class="sec">Entreprise</h2><div class="list">
          <div class="item"><img src="${esc(co.logo || 'logo.png')}" alt="" style="height:48px;background:#fff;border-radius:8px;padding:2px"><div class="grow"><b>${esc(co.name)}</b><small>${esc(co.address)}</small><small>${esc(co.phone)} · ${esc(co.email)}</small><small>RCCM : ${esc(co.rccm || '—')} · ID. Nat. : ${esc(co.idnat || '—')} · N° Impôt : ${esc(co.impot || '—')}</small></div><button class="btn sm sec" data-act="setco">Modifier</button></div></div>
        <h2 class="sec">Application</h2><div class="list">
          ${row('Taux USD / CDF', `1 $ = ${App.nf(S.rate, 0)} CDF (utilisé sur les factures et les rapports)`, '<button class="btn sm sec" data-act="setapp">Modifier</button>')}
          ${row('Abonnements', `Durée par défaut : ${S.period} jours · Sursis par défaut : ${S.grace} jours`)}
          ${row('Thème', { auto: 'Automatique (suit le téléphone)', light: 'Clair', dark: 'Sombre' }[S.theme] + ' · bouton ☀️/🌙 en haut de l\'écran')}
          ${row('Notifications', 'Les alertes d\'expiration (7, 3, 1 jour avant et le jour même) s\'affichent sur l\'écran d\'accueil.')}</div>
        <h2 class="sec">Partager</h2><div class="list">
          ${row("Partager l'application", `Lien à envoyer : <b style="word-break:break-all">${esc(new URL('./', location.href).href)}</b><br>Chaque personne installe l'application depuis ce lien ; ses données restent sur son appareil, sauf si elle active la synchronisation avec les mêmes réglages.`, '<button class="btn sm" data-act="shareapp">Partager</button>')}</div>
        <h2 class="sec">Sécurité</h2><div class="list">
          ${row('Code PIN', S.pin ? 'Activé (4 chiffres)' : 'Non défini : tout le monde peut ouvrir l\'application', S.pin ? '<button class="btn sm sec" data-act="pinchange">Modifier</button>' : '<button class="btn sm" data-act="pinset">Définir</button>')}
          ${S.pin ? row('Désactiver le PIN', 'Retire le verrouillage', '<button class="btn sm del" data-act="pinremove">Désactiver</button>') : ''}
          <div class="item"><div class="grow"><b>Verrouillage automatique</b><small>Après inactivité</small></div><select id="s_lock" style="width:auto">${App.opts(LOCKS, S.lockMin)}</select></div>
          ${row('Utilisateurs', 'Un seul administrateur pour l\'instant. Les profils Comptable, Technicien et Vendeur pourront être ajoutés plus tard.')}</div>
        <p class="mut" style="font-size:13px">Le PIN verrouille l'écran de l'application ; il ne chiffre pas les données stockées dans le téléphone.</p>
        ${App.plansCard()}
        ${App.remindCard()}
        ${App.syncCard()}
        ${App.driveCard ? App.driveCard() : ''}
        <h2 class="sec">Données</h2><div class="list">
          ${row('Stockage interne', `Les données sont enregistrées dans la mémoire de cet appareil, même sans internet. Protection contre l'effacement : <b class="${App.persisted ? 'ok' : 'warn'}">${App.persisted ? 'activée' : App.persisted === false ? 'non garantie (installez l\'application)' : 'en cours…'}</b>.`)}
          ${row('Sauvegarde', `Dernière sauvegarde : <b class="${warn ? 'warn' : ''}">${lastB ? App.fdate(lastB) : 'jamais'}</b>${warn ? ' — pensez à en faire une.' : ''}`, '<button class="btn sm" data-act="backup">Sauvegarder</button>')}
          ${row('Restaurer / importer', 'Recharger un fichier de sauvegarde (.json), y compris de l\'ancienne version.', '<label class="btn sm sec" style="cursor:pointer">Restaurer<input type="file" id="s_restore" accept=".json,application/json" hidden></label>')}
          ${row('Exporter en CSV', 'Un tableau à la fois (Excel, Google Sheets).', '<button class="btn sm sec" data-act="exportcsv">Choisir…</button>')}
          ${row('Exporter en Excel', 'Un classeur .xlsx avec une feuille par thème.', '<button class="btn sm sec" data-act="xlsx">Excel</button>')}</div>
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
       ${F.text('f_rccm', 'RCCM', co.rccm)}<div class="row">${F.text('f_idnat', 'ID. Nat.', co.idnat)}${F.text('f_impot', 'N° Impôt', co.impot)}</div>`,
      () => { Object.assign(co, { name: App.v('f_name') || 'CISPOLstore', address: App.v('f_addr'), phone: App.v('f_phone'), email: App.v('f_mail'), rccm: App.v('f_rccm'), idnat: App.v('f_idnat'), impot: App.v('f_impot') }); App.save(); App.applyTheme(); App.refresh(); });
    $('s_logo').onchange = e => {
      const f = e.target.files[0]; if (!f) return; const fr = new FileReader();
      fr.onload = () => { const img = new Image(); img.onload = () => { const k = Math.min(1, 320 / img.width), c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); co.logo = c.toDataURL('image/png'); $('s_prev').src = co.logo; App.save(); App.applyTheme(); }; img.src = fr.result; };
      fr.readAsDataURL(f);
    };
  };
  App.actions.setapp = () => {
    const S = App.db.settings;
    App.modal("Paramètres de l'application", `${F.num('f_rate', 'Taux : 1 $ = … CDF', S.rate, 'min="1"')}${F.num('f_period', "Durée d'abonnement par défaut (jours)", S.period, 'min="1"')}${F.num('f_grace', 'Sursis par défaut (jours)', S.grace)}${F.sel('f_theme', 'Thème', [['auto', 'Automatique'], ['light', 'Clair'], ['dark', 'Sombre']], S.theme)}`,
      () => { S.rate = App.n('f_rate') || 2400; S.period = Math.max(1, Math.round(App.n('f_period')) || 30); S.grace = Math.max(0, Math.round(App.n('f_grace'))); S.theme = App.v('f_theme'); App.save(); App.applyTheme(); App.refresh(); });
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
      if (!App.confirm('Remplacer toutes les données actuelles par cette sauvegarde ?' + (App.syncConfigured() ? ' Attention : la synchronisation enverra ce remplacement aux autres appareils.' : ''))) return false;
      const keep = App.db.settings; // PIN, theme and auto-lock belong to this device
      d.settings = { ...(d.settings || {}), pin: keep.pin, pinAsked: keep.pinAsked, theme: keep.theme, lockMin: keep.lockMin };
      App.db = d; App.save(); App.applyTheme(); App.toast('Données restaurées'); App.refresh(); return true;
    } catch (e) { App.toast('Fichier de sauvegarde invalide'); return false; }
  };
  const restore = (file, input) => {
    if (!file) return;
    file.text().then(t => App.restoreData(t)).finally(() => { input.value = ''; });
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
