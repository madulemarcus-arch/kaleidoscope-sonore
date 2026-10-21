// Backup safety: a visible reminder when the last backup is old, an automatic check of each backup just made,
// and a "test a backup file" tool that reads a file and compares it with the current data without replacing anything.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc;
  const MAIN = ['home', 'clients', 'finance', 'stock', 'more'];
  const DAYS = [[1, 'Tous les jours'], [3, 'Après 3 jours'], [7, 'Après 7 jours'], [14, 'Après 14 jours'], [0, 'Jamais']];
  const thr = () => { const v = App.db.settings.backupDays; return v === undefined ? 3 : +v; };
  const lastDate = () => { const S = App.db.settings; return [S.lastBackup, App.drive && App.drive.lastDate && App.drive.lastDate()].filter(Boolean).sort().pop() || null; };
  App.backupAge = () => { const l = lastDate(); return l ? Math.max(0, App.diff(l, App.today())) : null; };

  // ---------- reminder banner on the main screens ----------
  App.bkBanner = view => {
    const S = App.db.settings, t = thr(), age = App.backupAge();
    if (!MAIN.includes(view) || !t || !App.hasData(App.db) || !App.guard('backup') || S.bkSnooze === App.today()) return '';
    if (age !== null && age < t) return '';
    return `<div class="bkban" role="alert"><span class="bki">💾</span><div class="grow"><b>${age === null ? 'Aucune sauvegarde faite' : age === 0 ? 'Sauvegarde ancienne' : `Sauvegarde : il y a ${age} jour${age > 1 ? 's' : ''}`}</b><small>Vos données ne sont que sur ce téléphone.</small></div><button class="btn sm" data-act="backup">Sauvegarder</button><button class="ib bkx" data-act="bk_snooze" aria-label="Me le rappeler demain">✕</button></div>`;
  };
  App.actions.bk_snooze = () => { App.db.settings.bkSnooze = App.today(); App.save(); App.refresh(); App.toast('Rappel reporté à demain'); };

  // ---------- read and check a backup ----------
  const parse = text => { const o = JSON.parse(text); return o.v === 2 ? o : (Array.isArray(o.products) || Array.isArray(o.clients)) ? App.migrate(o) : null; };
  const LINES = [['clients', 'Clients'], ['invoices', 'Factures'], ['payments', 'Paiements'], ['expenses', 'Dépenses'], ['products', 'Produits'], ['moves', 'Mouvements de stock'], ['purchases', 'Achats'], ['deposits', 'Fonds en attente'], ['quotes', 'Devis'], ['proformas', 'Pro forma'], ['contracts', 'Contrats'], ['cmodels', 'Modèles de contrat'], ['penalties', 'Pénalités'], ['installs', 'Installations']];
  const n = (d, k) => (d && Array.isArray(d[k]) ? d[k].length : 0);
  const billed = d => (d.invoices || []).filter(i => !i.pending).reduce((a, i) => { try { return a + App.usd(App.invAgreed(i), i.currency, i); } catch (e) { return a; } }, 0);
  const newest = (d, k) => (d[k] || []).reduce((m, x) => x && x.date > m ? x.date : m, '');
  // a backup that was just written: read it back and make sure it matches what is on screen
  App.verifyBackup = text => { try { const d = JSON.parse(text), db = App.db, bad = LINES.filter(([k]) => n(d, k) !== n(db, k)); return { ok: !bad.length && n(d, 'clients') === n(db, 'clients'), clients: n(d, 'clients'), invoices: n(d, 'invoices'), bad: bad.map(x => x[1]) }; } catch (e) { return { ok: false, clients: 0, invoices: 0, bad: ['fichier illisible'] }; } };
  App.analyzeBackup = text => {
    let d; try { d = parse(text); } catch (e) { d = null; }
    if (!d) return { error: "Ce fichier n'est pas une sauvegarde CISPOLstore (ou il est abîmé)." };
    const db = App.db, ids = new Set((d.clients || []).map(c => c.id)), inv = new Set((d.invoices || []).map(i => i.id)), warns = [];
    const orphI = (d.invoices || []).filter(i => i.clientId && !ids.has(i.clientId)).length, orphP = (d.payments || []).filter(p => p.invoiceId && !inv.has(p.invoiceId)).length, bad = (d.invoices || []).filter(i => !Array.isArray(i.lines)).length;
    if (orphI) warns.push(`${orphI} facture(s) liée(s) à un client absent du fichier`); if (orphP) warns.push(`${orphP} paiement(s) lié(s) à une facture absente du fichier`); if (bad) warns.push(`${bad} facture(s) sans lignes (incomplètes)`);
    const rows = LINES.map(([k, l]) => ({ l, f: n(d, k), c: n(db, k) })).filter(r => r.f || r.c);
    const missing = rows.filter(r => r.f < r.c).reduce((a, r) => a + (r.c - r.f), 0), fi = newest(d, 'invoices'), ci = newest(db, 'invoices'), fp = newest(d, 'payments'), cp = newest(db, 'payments');
    const older = (ci && fi < ci) || (cp && fp < cp) || missing > 0;
    return { d, rows, warns, billedF: billed(d), billedC: billed(db), fi, ci, fp, cp, older, missing, empty: !App.hasData(d) };
  };
  let pending = '';
  App.actions.bk_test = () => {
    if (!App.guard('restore')) return App.toast("Action réservée à l'administrateur");
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
    i.onchange = () => { const f = i.files[0]; if (!f) return; f.text().then(t => { const a = App.analyzeBackup(t); pending = t; show(a, f.name); }).catch(() => App.toast('Impossible de lire ce fichier')); };
    i.click();
  };
  const show = (a, name) => {
    if (a.error) return App.modal('Test de la sauvegarde', `<div class="card bad">❌ ${esc(a.error)}</div>`, null, 'Fermer');
    const diff = r => r.f === r.c ? '<span class="mut">=</span>' : r.f > r.c ? `<b class="ok">+${r.f - r.c}</b>` : `<b class="bad">${r.f - r.c}</b>`;
    const verdict = a.empty ? ['bad', '⚠ Cette sauvegarde est vide : la restaurer effacerait vos données.'] : a.older ? ['warn', `⚠ Plus ancienne que vos données actuelles${a.missing ? ` : il manque ${a.missing} élément(s)` : ''}.`] : ['ok', '✅ Lisible et à jour : elle contient au moins tout ce que vous avez maintenant.'];
    App.modal('Test de la sauvegarde', `<p class="mut" style="margin-top:0">${esc(name || '')} · rien n'est modifié tant que vous ne restaurez pas.</p>
      <div class="card ${verdict[0]}" style="margin:0 0 10px">${verdict[1]}</div>
      <div class="list"><div class="item"><div class="grow"><b>Total facturé</b><small>Fichier : ${App.fmt(a.billedF)} · Actuel : ${App.fmt(a.billedC)}</small></div></div>
        <div class="item"><div class="grow"><b>Dernière facture</b><small>Fichier : ${a.fi ? App.fdate(a.fi) : '—'} · Actuel : ${a.ci ? App.fdate(a.ci) : '—'}</small></div></div>
        <div class="item"><div class="grow"><b>Dernier paiement</b><small>Fichier : ${a.fp ? App.fdate(a.fp) : '—'} · Actuel : ${a.cp ? App.fdate(a.cp) : '—'}</small></div></div></div>
      <h2 class="sec">Contenu (fichier / actuel)</h2><div class="list">${a.rows.map(r => `<div class="item"><div class="grow"><b>${r.l}</b></div><span>${r.f} / ${r.c}</span><span style="min-width:34px;text-align:right">${diff(r)}</span></div>`).join('')}</div>
      ${a.warns.length ? `<div class="card warn" style="margin-top:10px">${a.warns.map(w => '• ' + esc(w)).join('<br>')}</div>` : ''}`,
      () => { App.restoreData(pending); }, 'Restaurer ce fichier');
  };

  // ---------- settings rows ----------
  App.backupRows = () => { const row = (t, s, b) => `<div class="item"><div class="grow"><b>${t}</b><small style="white-space:normal">${s}</small></div>${b || ''}</div>`;
    return row('Tester une sauvegarde', 'Choisissez un fichier .json : l\'application le lit et le compare à vos données, sans rien remplacer.', '<button class="btn sm sec" data-act="bk_test">Tester…</button>')
      + row('Rappel de sauvegarde', 'Un bandeau vous le rappelle sur les écrans principaux.', `<select id="s_bkdays" style="width:auto">${App.opts(DAYS, thr())}</select>`); };
  document.addEventListener('change', e => { if (e.target.id !== 's_bkdays') return; App.db.settings.backupDays = +e.target.value; delete App.db.settings.bkSnooze; App.save(); App.toast(+e.target.value ? 'Rappel : ' + DAYS.find(x => x[0] === +e.target.value)[1].toLowerCase() : 'Rappel désactivé'); });
})();
