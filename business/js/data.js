// « Données et sécurité » screen: backup / restore (JSON), export Excel (.xlsx) and CSV, security (profiles), sync card.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, A = App.sales, S = App.stock, db = () => App.db;
  const D = App.data = {};
  const stamp = () => App.today() + '-' + new Date().toTimeString().slice(0, 5).replace(':', 'h');
  const slug = () => (db().settings.name || 'entreprise').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'entreprise';

  // ---------- backup / restore ----------
  D.backup = () => { const payload = JSON.stringify({ app: 'cispolstore-business', v: db().v, at: new Date().toISOString(), db: db() }); App.saveFile('sauvegarde-' + slug() + '-' + stamp() + '.json', payload, 'application/json'); db().settings.lastBackup = Date.now(); App.log('backup', ''); App.save(); App.toast('Sauvegarde téléchargée'); App.render(); };
  D.restoreText = async (text, name) => {
    let p; try { p = JSON.parse(text); } catch (e) { throw new Error('Ce fichier n\'est pas une sauvegarde lisible'); }
    if (!p || p.app !== 'cispolstore-business' || !p.db || !Array.isArray(p.db.clients)) throw new Error('Ce fichier n\'est pas une sauvegarde de CISPOLstore Business');
    const n = p.db.clients.length + ' client(s), ' + (p.db.invoices || []).length + ' facture(s)';
    if (!(await ui.confirm('Remplacer toutes les données de cet appareil par la sauvegarde « ' + (name || '') + ' » (' + n + ') ? Vous pourrez annuler juste après.', 'Restaurer', true))) return false;
    const prev = JSON.stringify(db()); try { localStorage.setItem('biz.prev', prev); } catch (e) { /* too big: no undo */ }
    App.db = App.migrate(p.db); App.flush(); App.log('restore', name || ''); App.save();
    App.toast('Sauvegarde restaurée', '', { label: 'Annuler', fn: () => { App.db = App.migrate(JSON.parse(prev)); App.flush(); App.render(); App.toast('Restauration annulée'); } }); App.render(); return true;
  };

  // ---------- exports ----------
  const num = (v, c) => typeof v === 'number' ? M.round(v, c || db().settings.currency) : v;
  D.tables = () => {
    const s = db().settings, cf = k => s.fields[k] || [], cn = id => { const c = App.clients.get(id); return c ? c.name : ''; }, sup = id => { const x = S.supplier(id); return x ? x.name : ''; };
    const T = [
      { name: 'Clients', rows: [['Code', 'Nom', 'Type', 'Téléphone', 'Courriel', 'Adresse', 'Note', 'Créé le', ...cf('clients').map(f => f.label)], ...db().clients.map(c => [c.code, c.name, c.type, c.phone, c.email, c.address, c.note, c.created, ...cf('clients').map(f => (c.fields || {})[f.id] || '')])] },
      { name: 'Produits', rows: [['Code', 'Nom', 'Catégorie', 'Référence', 'Unité', 'Suivi stock', 'Stock', 'Minimum', 'Prix d\'achat', 'Prix de vente', 'Fournisseur', ...cf('products').map(f => f.label)], ...db().products.map(p => [p.code, p.name, p.cat, p.ref, p.unit, p.track === false ? 'non' : 'oui', p.qty, p.min, p.cost, p.price, sup(p.supplierId), ...cf('products').map(f => (p.fields || {})[f.id] || '')])] },
      { name: 'Factures', rows: [['Numéro', 'Date', 'Client', 'Devise', 'Taux', 'Sous-total', 'Remise', 'Total', 'Payé', 'Reste', 'Statut', 'Note'], ...db().invoices.map(i => [i.number, i.date, A.cname(i), i.currency, i.rate, i.sub, i.discAmt || 0, i.total, A.paid(i), A.due(i), A.status(i)[0], i.note || ''])] },
      { name: 'Lignes de facture', rows: [['Facture', 'Date', 'Désignation', 'Quantité', 'Prix unitaire', 'Total', 'Devise'], ...db().invoices.flatMap(i => i.lines.map(l => [i.number, i.date, l.desc, l.qty, l.price, M.round(l.qty * l.price, i.currency), i.currency]))] },
      { name: 'Paiements', rows: [['Reçu', 'Date', 'Facture', 'Client', 'Montant', 'Devise', 'Taux', 'Mode', 'Note'], ...db().payments.map(p => { const i = A.get(p.invoiceId); return [p.no, p.date, i ? i.number : '', i ? A.cname(i) : '', p.amount, p.currency, p.rate, p.mode, p.note]; })] },
      { name: 'Dépenses', rows: [['Date', 'Catégorie', 'Montant', 'Devise', 'Taux', 'Mode', 'Fournisseur', 'Note'], ...db().expenses.map(e => [e.date, e.category, e.amount, e.currency, e.rate, e.mode, sup(e.supplierId), e.note])] },
      { name: 'Mouvements de stock', rows: [['Date', 'Produit', 'Quantité', 'Type', 'Prix d\'achat', 'Fournisseur', 'Référence', 'Note'], ...db().movements.map(m => { const p = S.get(m.pid); return [m.date, p ? p.name : '', m.qty, m.type, m.cost, sup(m.supplierId), m.ref, m.note]; })] },
      ...(App.subs ? [{ name: 'Abonnements', rows: [['Client', 'Libellé', 'Prix', 'Devise', 'Durée (j)', 'Fin', 'Statut', 'Fournisseur', 'Coût reversé'], ...db().subs.map(x => [cn(x.clientId), x.name, x.price, x.currency, x.days, App.subs.end(x), App.subs.status(x)[0], sup(x.supplierId), x.cost || 0])] }, { name: 'Interventions', rows: [['Numéro', 'Date', 'Client', 'Objet', 'Employé', 'Statut', 'Prix', 'Commission', 'Commission payée'], ...db().jobs.map(j => [j.number, j.date, cn(j.clientId), j.title, (App.staff.get(j.employeeId) || {}).name || '', j.status, j.price, App.jobs.commission(j), j.commissionPaid ? 'oui' : 'non'])] }, { name: 'Locations', rows: [['Numéro', 'Client', 'Bien', 'Début', 'Retour prévu', 'Retour', 'Prix', 'Caution', 'Caution rendue'], ...db().rentals.map(r => [r.number, cn(r.clientId), r.item, r.start, r.end, r.returned, r.price, r.deposit, r.depositBack == null ? '' : r.depositBack])] }, { name: 'Livraisons', rows: [['Numéro', 'Date', 'Client', 'Adresse', 'Livreur', 'Statut', 'À encaisser', 'Encaissé'], ...db().deliveries.map(x => [x.number, x.date, cn(x.clientId), x.address, (App.staff.get(x.driverId) || {}).name || '', x.status, x.collect, x.collected ? 'oui' : 'non'])] }] : []),
      { name: 'Fournisseurs', rows: [['Code', 'Nom', 'Contact', 'Téléphone', 'Courriel', 'Adresse'], ...db().suppliers.map(x => [x.code, x.name, x.contact, x.phone, x.email, x.address])] }
    ];
    return T;
  };
  D.exportXlsx = () => { if (!App.can('export')) return App.toast('Action non autorisée pour votre profil', 'err'); App.saveFile('export-' + slug() + '-' + stamp() + '.xlsx', App.xlsx(D.tables())); App.log('export.xlsx', ''); App.save(); App.toast('Fichier Excel généré'); };
  D.exportCsv = name => { if (!App.can('export')) return App.toast('Action non autorisée pour votre profil', 'err'); const t = D.tables().find(x => x.name === name); if (!t) return; App.saveFile(name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + stamp() + '.csv', App.csv(t.rows), 'text/csv;charset=utf-8'); App.log('export.csv', name); App.save(); };

  // ---------- screen ----------
  App.views.data = {
    title: 'Données et sécurité',
    render(el) {
      const s = db().settings, lb = s.lastBackup ? new Date(s.lastBackup).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'jamais';
      el.innerHTML = '<div class="page"><section class="card"><h3>Sauvegarde</h3><p class="muted">Dernière sauvegarde : <b>' + lb + '</b>. Gardez le fichier hors du téléphone (courriel, Drive, ordinateur).</p><div class="tools"><button class="btn primary" id="dbk">💾 Sauvegarder</button><label class="btn ghost" style="cursor:pointer">Restaurer<input type="file" id="drs" accept=".json,application/json" hidden></label></div></section>' +
        '<section class="card"><h3>Exports</h3><div class="tools"><button class="btn primary" id="dxl">📊 Excel (.xlsx)</button></div><div class="chips">' + D.tables().map(t => '<button data-csv="' + esc(t.name) + '">CSV · ' + esc(t.name) + '</button>').join('') + '</div></section>' +
        App.team.securityHtml() + '<div id="syncbox"></div></div>';
      el.querySelector('#dbk').onclick = D.backup; el.querySelector('#dxl').onclick = D.exportXlsx; el.querySelectorAll('[data-csv]').forEach(b => b.onclick = () => D.exportCsv(b.dataset.csv));
      el.querySelector('#drs').onchange = async e => { const f = e.target.files[0]; if (!f) return; if (!App.can('settings')) return App.toast('Réservé à l\'administrateur', 'err'); try { await D.restoreText(await f.text(), f.name); } catch (err) { App.toast(err.message, 'err'); } e.target.value = ''; };
      App.team.bindSecurity(el, () => App.views.data.render(el)); if (App.syncCard) App.syncCard(el.querySelector('#syncbox'));
    }
  };
})();
