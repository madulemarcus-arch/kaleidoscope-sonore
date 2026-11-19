// Transport (module « Transport »): vehicle movements (departure, arrival, stopover time), cargo per trip (client, goods category, freight),
// fuel stock and consumption, suppliers, maintenance and breakdown assistance. Fuel purchases and maintenance costs become expenses, the freight is revenue.
// Fuel stock is never stored: litres received − litres issued. Fictitious data only in the tests.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, A = App.sales, C = App.clients, F = App.fin, norm = C.norm, db = () => App.db;
  const T = App.transport = {};
  T.CATS = { cash: ['Espèces', '💵'], carton: ['Cartons', '📦'], bag: ['Sacs', '🛍️'], can: ['Bidons', '🛢️'], food: ['Vivres', '🌾'], fragile: ['Cassable', '🍾'], perish: ['Périssable', '🥬'], drink: ['Boisson', '🥤'] };
  T.KINDS = ['Camion', 'Remorque', 'Pick-up', 'Minibus', 'Moto', 'Autre'];
  T.MKINDS = ['Vidange', 'Pneus', 'Freins', 'Révision', 'Réparation', 'Dépannage', 'Contrôle', 'Autre'];
  const vehs = () => db().trVehicles, trips = () => db().trTrips, fuel = () => db().trFuel, maint = () => db().trMaint, num = v => parseFloat(String(v).replace(',', '.')) || 0;
  T.veh = id => vehs().find(v => v.id === id); T.get = id => trips().find(t => t.id === id);
  const vname = id => { const v = T.veh(id); return v ? v.plate + (v.name ? ' · ' + v.name : '') : '—'; };
  T.status = t => t.cancelled ? 'Annulé' : t.arr ? 'Arrivé' : t.dep ? 'En route' : 'Prévu';
  const live = t => !t.cancelled, tone = s => ({ 'Arrivé': 'ok', 'En route': 'warn', 'Prévu': '', 'Annulé': 'bad' })[s];
  const nowLocal = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes()); };
  const hm = m => m == null ? '—' : Math.floor(m / 60) + ' h ' + String(Math.round(m % 60)).padStart(2, '0');
  const clock = s => s ? s.slice(11, 16) : '—';
  T.minutes = t => t.dep && t.arr ? Math.max(0, Math.round((new Date(t.arr) - new Date(t.dep)) / 60000)) : null; // total time, stopover included
  T.driving = t => { const m = T.minutes(t); return m == null ? null : Math.max(0, m - (t.stop || 0)); };
  T.inRange = r => trips().filter(t => F.inR(t.date, r));
  T.freight = (t, line) => F.toMain(line ? line.freight || 0 : (t.lines || []).reduce((s, l) => s + (l.freight || 0), 0), t.currency, t.rate);
  // ---------- billing: freight lines become invoices (Ventes), paid through the usual payments ----------
  const invOf = l => { const i = l.invoiceId && A.get(l.invoiceId); return i && A.live(i) ? i : null; }; // live invoice of a cargo line
  T.billable = t => t.cancelled ? [] : (t.lines || []).filter(l => l.freight > 0 && !invOf(l));
  T.invoices = t => { const m = {}; (t.lines || []).forEach(l => { const i = invOf(l); if (i) m[i.id] = i; }); return Object.values(m); };
  T.groups = t => { const g = {}; T.billable(t).forEach(l => { const k = l.clientId || norm(l.client || '') || '_'; (g[k] = g[k] || { clientId: l.clientId || '', name: l.client || 'Client de passage', lines: [] }).lines.push(l); }); return Object.values(g); };
  T.bill = (t, mode) => { // one invoice per client; mode = payment mode when the money was collected at once
    const route = (t.from || '?') + ' → ' + (t.to || '?');
    const made = T.groups(t).map(x => {
      const sum = x.lines.reduce((a, l) => a + l.freight, 0), inv = A.createInvoice({ clientId: x.clientId, currency: t.currency, rate: t.rate, date: t.date, source: 'Transport', note: t.number + ' · ' + route, paid: mode ? sum : 0, mode, lines: x.lines.map(l => ({ desc: 'Transport ' + t.number + ' · ' + route + ' — ' + T.CATS[l.cat][0] + (l.cat === 'cash' ? '' : ' × ' + l.qty), qty: 1, price: l.freight })) });
      if (!x.clientId) inv.clientName = x.name; x.lines.forEach(l => { l.invoiceId = inv.id; }); return inv;
    });
    if (made.length) { App.log('tr.bill', t.number + ' · ' + made.map(i => i.number).join(', ')); App.save(); } return made;
  };
  // freight not yet invoiced is revenue by itself; once invoiced, the invoice carries the revenue (no double count)
  T.revenue = r => T.inRange(r).filter(live).reduce((s, t) => s + (t.lines || []).filter(l => !invOf(l)).reduce((a, l) => a + T.freight(t, l), 0), 0);
  T.billing = r => { const b = { billed: 0, paid: 0, due: 0, unbilled: 0 }; T.inRange(r).filter(live).forEach(t => { (t.lines || []).forEach(l => { if (!invOf(l)) b.unbilled += T.freight(t, l); }); T.invoices(t).forEach(i => { b.billed += A.main(i, i.total); b.paid += A.main(i, A.paid(i)); b.due += A.main(i, A.due(i)); }); }); return b; };

  // ---------- fuel: stock and consumption ----------
  T.stock = () => fuel().reduce((s, f) => s + (f.type === 'in' ? f.liters : -f.liters), 0);
  T.consumption = (vid, r) => { // litres per 100 km from the odometer readings of the fuel issued to a vehicle
    const l = fuel().filter(f => f.type === 'out' && f.vehicleId === vid && f.km > 0 && (!r || F.inR(f.date, r))).sort((a, b) => a.km - b.km); if (l.length < 2) return null;
    const dist = l[l.length - 1].km - l[0].km, lit = l.slice(1).reduce((s, f) => s + f.liters, 0); return dist > 0 ? lit / dist * 100 : null;
  };
  const expense = (cat, amount, cur, rate, date, supplierId, note) => { // cost → expense, so the journal and the profit stay right
    if (!(amount > 0)) return ''; const e = { id: App.uid(), at: Date.now(), amount, currency: cur, rate, category: cat, mode: F.cashMode(), supplierId: supplierId || '', date, note }; if (!F.cats().includes(cat)) F.cats().push(cat); db().expenses.push(e); return e.id;
  };
  const dropExpense = id => { if (id) db().expenses = db().expenses.filter(e => e.id !== id); };

  // ---------- vehicles ----------
  T.vehicleForm = id => {
    const v = id ? T.veh(id) : null, src = v || { kind: 'Camion' };
    ui.sheet({ title: v ? 'Modifier ' + v.plate : 'Nouveau chariot', wide: true, html: '<div class="row2">' + ui.field('Immatriculation *', ui.input('plate', src.plate, { ph: 'Ex. 1234AB01' })) + ui.field('Type', ui.select('kind', T.KINDS, src.kind)) + '</div>' + ui.field('Nom', ui.input('name', src.name, { ph: 'Ex. Camion 1' })) + '<div class="row2">' + ui.field('Capacité', ui.input('capacity', src.capacity, { ph: 'Ex. 10 t' })) + ui.field('Conducteur habituel', ui.input('driver', src.driver)) + '</div>' + ui.field('Note', ui.input('note', src.note)),
      actions: [...(v ? [{ label: 'Supprimer', cls: 'danger', fn: async x => { if (trips().some(t => t.vehicleId === v.id) || fuel().some(f => f.vehicleId === v.id) || maint().some(m => m.vehicleId === v.id)) { App.toast('Ce chariot a un historique : il ne peut pas être supprimé', 'err'); return false; } if (await ui.confirm('Supprimer ' + v.plate + ' ?', 'Supprimer', true)) { db().trVehicles = vehs().filter(y => y.id !== v.id); App.save(); x.close(); App.render(); } return false; } }] : []), { label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: x => {
        const f = ui.read(x.body); if (!f.plate) { App.toast('Indiquez l\'immatriculation', 'err'); return false; }
        if (v) Object.assign(v, f); else vehs().push({ id: App.uid(), ...f }); App.log(v ? 'tr.veh.edit' : 'tr.veh.add', f.plate); App.save(); App.toast('Chariot enregistré'); App.render();
      } }] });
  };

  // ---------- trips (movements) and their cargo ----------
  const lineRow = l => { l = l || {}; const lock = invOf(l) ? ' readonly' : ''; return '<div class="tl" data-inv="' + esc(l.invoiceId || '') + '" style="display:grid;grid-template-columns:1fr 1fr 1fr 36px;gap:6px;margin:6px 0"><input data-k="client" list="trcl" placeholder="Client" value="' + esc(l.client || '') + '" style="grid-column:1/4"' + lock + '>' + (lock ? '<span title="Facturé" style="align-self:center;text-align:center">🧾</span>' : '<button type="button" class="btn ghost" data-del aria-label="Supprimer la ligne">×</button>') + '<select data-k="cat"' + (lock ? ' disabled' : '') + '>' + Object.entries(T.CATS).map(([k, c]) => '<option value="' + k + '"' + (l.cat === k ? ' selected' : '') + '>' + esc(c[1] + ' ' + c[0]) + '</option>').join('') + '</select><input data-k="qty" inputmode="decimal" placeholder="Qté / montant" value="' + esc(l.qty || '') + '"' + lock + '><input data-k="freight" inputmode="decimal" placeholder="Fret" value="' + esc(l.freight || '') + '"' + lock + '></div>'; };
  const readLines = root => [...root.querySelectorAll('.tl')].map(r => { const g = k => r.querySelector('[data-k=' + k + ']').value, name = g('client').trim(), c = db().clients.find(x => norm(x.name) === norm(name)); return { client: name, clientId: c ? c.id : '', cat: g('cat'), qty: num(g('qty')), freight: num(g('freight')), invoiceId: r.dataset.inv || '' }; }).filter(l => l.client || l.qty || l.freight);
  T.form = id => {
    if (!vehs().length) { App.toast('Ajoutez d\'abord un chariot', 'err'); return T.vehicleForm(); }
    const t = id ? T.get(id) : null, s = db().settings, src = t || { date: App.today(), currency: s.currency, lines: [], vehicleId: vehs()[0].id };
    const sh = ui.sheet({ title: t ? 'Modifier ' + t.number : 'Nouveau mouvement', wide: true,
      html: ui.field('Chariot', ui.select('vehicleId', vehs().map(v => [v.id, vname(v.id)]), src.vehicleId)) + '<div class="row2">' + ui.field('Conducteur', ui.input('driver', src.driver != null ? src.driver : (vehs()[0].driver || ''))) + ui.field('Date', ui.dateField('date', src.date)) + '</div><div class="row2">' + ui.field('Origine', ui.input('from', src.from)) + ui.field('Destination', ui.input('to', src.to)) + '</div>' +
        ui.field('Heure de départ', '<input type="datetime-local" name="dep" value="' + esc(src.dep || '') + '">') + ui.field('Heure d\'arrivée', '<input type="datetime-local" name="arr" value="' + esc(src.arr || '') + '">') + '<div class="row2">' + ui.field('Temps de scale (minutes)', ui.input('stop', src.stop || '', { num: 1 }), 'Arrêts en route') + ui.field('Distance (km)', ui.input('km', src.km || '', { num: 1 })) + '</div>' +
        '<h4>Chargement</h4><datalist id="trcl">' + db().clients.map(c => '<option value="' + esc(c.name) + '">').join('') + '</datalist><div id="tls">' + (src.lines || []).map(lineRow).join('') + '</div><button type="button" class="btn ghost" id="tla">+ Ligne de chargement</button>' + ui.field('Devise du fret et des espèces', ui.select('currency', [s.currency, s.cur2], src.currency)) + ui.field('Note', ui.input('note', src.note)),
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: x => {
        const f = ui.read(x.body), lines = readLines(x.body);
        if (f.dep && f.arr && f.arr < f.dep) { App.toast('L\'arrivée est avant le départ', 'err'); return false; }
        const rec = { vehicleId: f.vehicleId, driver: f.driver, date: f.date, from: f.from, to: f.to, dep: f.dep, arr: f.arr, stop: f.stop, km: f.km, lines, currency: f.currency, note: f.note };
        if (t) Object.assign(t, rec, { rate: f.currency === t.currency ? t.rate : s.rate }); else trips().push({ id: App.uid(), number: A.nextNo('TR', 'tr', () => trips()), at: Date.now(), rate: s.rate, by: App.user ? App.user.name : '', ...rec });
        App.log(t ? 'tr.trip.edit' : 'tr.trip.add', (t || trips()[trips().length - 1]).number); App.save(); App.toast('Mouvement enregistré'); App.render();
      } }] });
    sh.q('#tla').onclick = () => sh.q('#tls').insertAdjacentHTML('beforeend', lineRow());
    sh.body.addEventListener('click', e => { const d = e.target.closest('[data-del]'); if (d) d.closest('.tl').remove(); });
    sh.q('[name=vehicleId]').onchange = e => { const v = T.veh(e.target.value); if (v && v.driver && !sh.q('[name=driver]').value) sh.q('[name=driver]').value = v.driver; };
    return sh;
  };
  const tripText = t => { const by = {}; (t.lines || []).forEach(l => { by[l.cat] = (by[l.cat] || 0) + l.qty; }); return t.number + ' — ' + vname(t.vehicleId) + '\n' + (t.from || '?') + ' → ' + (t.to || '?') + '\nDépart ' + clock(t.dep) + ' · arrivée ' + clock(t.arr) + (t.stop ? ' · scale ' + hm(t.stop) : '') + (T.minutes(t) != null ? ' · route ' + hm(T.driving(t)) : '') + '\nChargement : ' + (Object.entries(by).map(([k, v]) => v + ' ' + T.CATS[k][0].toLowerCase()).join(', ') || 'aucun') + '\nFret : ' + M.fmt(T.freight(t) * 1, db().settings.currency); };
  T.billSheet = id => {
    const t = T.get(id), g = t ? T.groups(t) : [], s = db().settings; if (!g.length) return App.toast('Rien à facturer sur ce mouvement');
    ui.sheet({ title: 'Facturer le fret — ' + t.number, html: '<p class="muted">Une facture est créée par client ; elles apparaissent dans Ventes, où vous suivez les impayés et les encaissements.</p><div class="list">' + g.map(x => '<div class="item"><span class="av">🧾</span><span class="tx"><b>' + esc(x.name) + '</b><small>' + x.lines.length + ' ligne(s)' + (x.clientId ? '' : ' · client de passage') + '</small></span><span class="end"><b>' + esc(M.fmt(x.lines.reduce((a, l) => a + l.freight, 0), t.currency)) + '</b></span></div>').join('') + '</div>' + ui.field('Paiement', ui.select('mode', [['', 'Pas encore payé'], ...s.modes.map(m => [m, 'Tout encaissé : ' + m])], '')),
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Créer les factures', cls: 'primary', fn: x => { const f = ui.read(x.body), made = T.bill(t, f.mode); App.toast(made.length + ' facture(s) créée(s)'); App.render(); } }] });
  };
  T.profile = id => {
    const t = T.get(id); if (!t) return; const s = T.status(t), lines = t.lines || [];
    const sh = ui.sheet({ title: t.number + ' · ' + vname(t.vehicleId), wide: true, html: '<p><span class="pill ' + tone(s) + '">' + esc(s) + '</span> ' + esc((t.from || '?') + ' → ' + (t.to || '?')) + '</p><dl class="kv"><dt>Date</dt><dd>' + App.fmtDate(t.date) + '</dd><dt>Départ</dt><dd>' + esc(clock(t.dep)) + '</dd><dt>Arrivée</dt><dd>' + esc(clock(t.arr)) + '</dd><dt>Temps de scale</dt><dd>' + esc(t.stop ? hm(t.stop) : '—') + '</dd><dt>Temps de route</dt><dd>' + esc(hm(T.driving(t))) + '</dd>' + (t.driver ? '<dt>Conducteur</dt><dd>' + esc(t.driver) + '</dd>' : '') + (t.km ? '<dt>Distance</dt><dd>' + t.km + ' km</dd>' : '') + '</dl><h4>Chargement</h4>' + (lines.length ? '<div class="list">' + lines.map(l => '<div class="item"><span class="av">' + T.CATS[l.cat][1] + '</span><span class="tx"><b>' + esc(l.client || 'Sans nom') + '</b><small>' + esc(T.CATS[l.cat][0]) + ' · ' + (l.cat === 'cash' ? esc(M.fmt(l.qty, t.currency)) : l.qty) + '</small></span><span class="end"><b>' + esc(M.fmt(l.freight || 0, t.currency)) + '</b></span></div>').join('') + '</div>' : '<p class="muted">Aucune ligne de chargement.</p>') + (t.note ? '<p class="muted">' + esc(t.note) + '</p>' : '') + (T.invoices(t).length ? '<h4>Factures et encaissements</h4><div class="list">' + T.invoices(t).map(i => '<div class="item" data-inv="' + i.id + '" role="button" tabindex="0"><span class="av">🧾</span><span class="tx"><b>' + esc(i.number) + ' · ' + esc(A.cname(i)) + '</b><small>' + esc(A.status(i)[0]) + (A.due(i) > 0 ? ' · reste ' + esc(A.fmt(i, A.due(i))) : '') + '</small></span><span class="end"><b>' + esc(A.fmt(i, i.total)) + '</b></span></div>').join('') + '</div>' : ''),
      actions: [...(App.mod('sales') && App.can('sell') && T.billable(t).length ? [{ label: '🧾 Facturer le fret', cls: 'primary', fn: x => { x.close(); setTimeout(() => T.billSheet(id), 220); return false; } }] : []), ...(!t.cancelled && !t.dep ? [{ label: '▶ Départ maintenant', cls: 'primary', fn: x => { t.dep = nowLocal(); App.log('tr.dep', t.number); App.save(); x.close(); App.render(); return false; } }] : []), ...(!t.cancelled && t.dep && !t.arr ? [{ label: '⏹ Arrivée maintenant', cls: 'primary', fn: x => { t.arr = nowLocal(); App.log('tr.arr', t.number); App.save(); x.close(); App.render(); return false; } }] : []),
        ...(!t.cancelled ? [{ label: 'Modifier', cls: 'ghost', fn: x => { x.close(); setTimeout(() => T.form(id), 220); return false; } }] : []), { label: '💬 WhatsApp', cls: 'ghost', fn: () => { window.open('https://wa.me/?text=' + encodeURIComponent(tripText(t)), '_blank'); return false; } },
        ...(!t.cancelled && App.can('delete') ? [{ label: 'Annuler le mouvement', cls: 'danger', fn: async x => { if (await ui.confirm('Annuler ' + t.number + ' ?' + (T.invoices(t).length ? ' Ses factures (' + T.invoices(t).map(i => i.number).join(', ') + ') restent à annuler dans Ventes.' : ''), 'Annuler le mouvement', true)) { t.cancelled = true; App.log('tr.cancel', t.number); App.save(); x.close(); App.render(); } return false; } }] : [])] });
    sh.body.addEventListener('click', e => { const b = e.target.closest('[data-inv]'); if (b) { sh.close(); setTimeout(() => A.profile(b.dataset.inv), 220); } });
    return sh;
  };

  // ---------- fuel ----------
  T.fuelForm = type => {
    const s = db().settings, sup = [['', '— Aucun —'], ...db().suppliers.map(x => [x.id, x.name])], isIn = type === 'in';
    if (!isIn && !vehs().length) { App.toast('Ajoutez d\'abord un chariot', 'err'); return T.vehicleForm(); }
    ui.sheet({ title: isIn ? 'Réception de carburant' : 'Sortie de carburant', wide: true,
      html: '<div class="row2">' + ui.field('Litres *', ui.input('liters', '', { num: 1 }), isIn ? '' : 'Stock : ' + Math.round(T.stock() * 10) / 10 + ' L') + ui.field('Date', ui.dateField('date')) + '</div>' + (isIn ? '<div class="row2">' + ui.field('Prix par litre', ui.input('price', '', { num: 1 })) + ui.field('Devise', ui.select('currency', [s.currency, s.cur2], s.currency)) + '</div>' + ui.field('Fournisseur', ui.select('supplierId', sup, '')) : ui.field('Chariot', ui.select('vehicleId', vehs().map(v => [v.id, vname(v.id)]), vehs()[0].id)) + '<div class="row2">' + ui.field('Compteur (km)', ui.input('km', '', { num: 1 }), 'Pour calculer la consommation') + ui.field('Mouvement', ui.select('tripId', [['', '— Aucun —'], ...trips().filter(live).slice(-30).reverse().map(t => [t.id, t.number + ' · ' + (t.to || '')])], ''))  + '</div>') + ui.field('Note', ui.input('note', '')),
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: x => {
        const f = ui.read(x.body); if (!(f.liters > 0)) { App.toast('Indiquez les litres', 'err'); return false; } if (!isIn && f.liters > T.stock() + 1e-9) { App.toast('Stock insuffisant : ' + Math.round(T.stock() * 10) / 10 + ' L', 'err'); return false; }
        const rec = { id: App.uid(), at: Date.now(), type, date: f.date, liters: f.liters, note: f.note, supplierId: f.supplierId || '', vehicleId: f.vehicleId || '', tripId: f.tripId || '', km: f.km || 0, price: f.price || 0, currency: f.currency || s.currency, rate: s.rate };
        if (isIn) rec.expenseId = expense('Carburant', M.round(f.liters * f.price, rec.currency), rec.currency, rec.rate, f.date, rec.supplierId, 'Carburant ' + f.liters + ' L'); fuel().push(rec);
        App.log('tr.fuel.' + type, f.liters + ' L'); App.save(); App.toast(isIn ? 'Réception enregistrée' : 'Sortie enregistrée'); App.render();
      } }] });
  };
  T.fuelDelete = async id => { const f = fuel().find(x => x.id === id); if (f && await ui.confirm('Supprimer ce mouvement de carburant ?' + (f.expenseId ? ' La dépense liée est supprimée aussi.' : ''), 'Supprimer', true)) { dropExpense(f.expenseId); db().trFuel = fuel().filter(x => x.id !== id); App.save(); App.render(); } };

  // ---------- maintenance and breakdown assistance ----------
  T.maintForm = id => {
    const m = id ? maint().find(x => x.id === id) : null, s = db().settings, src = m || { kind: 'Vidange', currency: s.currency };
    if (!vehs().length) { App.toast('Ajoutez d\'abord un chariot', 'err'); return T.vehicleForm(); }
    ui.sheet({ title: m ? 'Modifier l\'entretien' : 'Nouvel entretien', wide: true,
      html: '<div class="row2">' + ui.field('Chariot', ui.select('vehicleId', vehs().map(v => [v.id, vname(v.id)]), src.vehicleId || vehs()[0].id)) + ui.field('Nature', ui.select('kind', T.MKINDS, src.kind)) + '</div><div class="row2">' + ui.field('Date', ui.dateField('date', src.date)) + ui.field('Compteur (km)', ui.input('km', src.km || '', { num: 1 })) + '</div><div class="row2">' + ui.field('Coût', ui.input('cost', src.cost || '', { num: 1 })) + ui.field('Devise', ui.select('currency', [s.currency, s.cur2], src.currency)) + '</div>' +
        ui.field('Siège de dépannage', ui.input('place', src.place, { ph: 'Garage, atelier ou lieu de la panne' })) + ui.field('Téléphone du dépanneur', ui.input('phone', src.phone, { tel: 1 })) + '<div class="row2">' + ui.field('Prochain entretien (date)', '<input type="date" name="nextDate" value="' + esc(src.nextDate || '') + '">') + ui.field('Prochain entretien (km)', ui.input('nextKm', src.nextKm || '', { num: 1 })) + '</div>' + ui.field('Note', ui.input('note', src.note)),
      actions: [...(m && App.can('delete') ? [{ label: 'Supprimer', cls: 'danger', fn: async x => { if (await ui.confirm('Supprimer cet entretien ?' + (m.expenseId ? ' La dépense liée est supprimée aussi.' : ''), 'Supprimer', true)) { dropExpense(m.expenseId); db().trMaint = maint().filter(y => y.id !== m.id); App.save(); x.close(); App.render(); } return false; } }] : []), { label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: x => {
        const f = ui.read(x.body), rec = { vehicleId: f.vehicleId, kind: f.kind, date: f.date, km: f.km, cost: f.cost, currency: f.currency, place: f.place, phone: f.phone, nextDate: f.nextDate, nextKm: f.nextKm, note: f.note };
        if (m) { dropExpense(m.expenseId); Object.assign(m, rec); } else maint().push(Object.assign({ id: App.uid(), at: Date.now() }, rec)); const r = m || maint()[maint().length - 1];
        r.rate = s.rate; r.expenseId = expense('Entretien', f.cost, f.currency, s.rate, f.date, '', f.kind + ' · ' + vname(f.vehicleId)); App.log(m ? 'tr.maint.edit' : 'tr.maint.add', f.kind + ' ' + vname(f.vehicleId)); App.save(); App.toast('Entretien enregistré'); App.render();
      } }] });
  };
  // maintenance due: next date within a week, or next km reached by the latest known odometer
  T.due = () => vehs().flatMap(v => { const l = maint().filter(m => m.vehicleId === v.id).sort((a, b) => b.date.localeCompare(a.date))[0]; if (!l) return []; const odo = Math.max(0, ...fuel().filter(f => f.vehicleId === v.id).map(f => f.km), ...maint().filter(m => m.vehicleId === v.id).map(m => m.km || 0)), soon = App.addDays(App.today(), 7); return (l.nextDate && l.nextDate <= soon) || (l.nextKm && odo >= l.nextKm - 500) ? [{ v, m: l, late: l.nextDate && l.nextDate < App.today() }] : []; });

  // ---------- report ----------
  T.report = r => {
    const l = T.inRange(r).filter(live), byCat = {}, byCl = {}, byV = {}; let freight = 0, minutes = 0, n = 0, stop = 0;
    l.forEach(t => { const f = T.freight(t); freight += f; stop += t.stop || 0; const d = T.driving(t); if (d != null) { minutes += d; n++; } const v = byV[t.vehicleId] = byV[t.vehicleId] || { n: 0, km: 0, f: 0 }; v.n++; v.km += t.km || 0; v.f += f;
      (t.lines || []).forEach(x => { const c = byCat[x.cat] = byCat[x.cat] || { qty: 0, n: 0, cash: 0 }; c.n++; if (x.cat === 'cash') c.cash += F.toMain(x.qty, t.currency, t.rate); else c.qty += x.qty; const k = x.clientId || norm(x.client || '') || '_', cl = byCl[k] = byCl[k] || { name: x.client || 'Sans nom', n: 0, f: 0 }; cl.n++; cl.f += T.freight(t, x); }); });
    const out = fuel().filter(f => f.type === 'out' && F.inR(f.date, r)), inn = fuel().filter(f => f.type === 'in' && F.inR(f.date, r)), mc = maint().filter(m => F.inR(m.date, r));
    return { l, freight, minutes, n, stop, byCat, byCl: Object.values(byCl).sort((a, b) => b.f - a.f), byV, litersOut: out.reduce((s, f) => s + f.liters, 0), litersIn: inn.reduce((s, f) => s + f.liters, 0), fuelCost: F.sumMain(inn.filter(f => f.price).map(f => ({ amount: f.liters * f.price, cur: f.currency, rate: f.rate }))), maintCost: F.sumMain(mc.map(m => ({ amount: m.cost || 0, cur: m.currency, rate: m.rate }))) };
  };
  T.reportText = r => { const c = T.report(r), s = db().settings; return 'Rapport transport — ' + s.name + ' · ' + r.label + '\n• ' + c.l.length + ' mouvement(s) · fret ' + M.main(c.freight) + '\n• Chargement :' + (Object.entries(c.byCat).map(([k, v]) => '\n   – ' + T.CATS[k][0] + ' : ' + (k === 'cash' ? M.main(v.cash) : v.qty)).join('') || ' aucun') + '\n• Clients :' + (c.byCl.slice(0, 8).map(x => '\n   – ' + x.name + ' : ' + x.n + ' ligne(s) · ' + M.main(x.f)).join('') || ' aucun') + (App.mod('sales') ? (b => '\n• Fret : à facturer ' + M.main(b.unbilled) + ' · facturé ' + M.main(b.billed) + ' · encaissé ' + M.main(b.paid) + ' · reste ' + M.main(b.due))(T.billing(r)) : '') + '\n• Carburant : ' + Math.round(c.litersOut * 10) / 10 + ' L sortis · stock ' + Math.round(T.stock() * 10) / 10 + ' L\n• Entretien : ' + M.main(c.maintCost); };

  // ---------- screen ----------
  const st = { tab: 'trips', f: 'today', q: '' };
  const bars = (items, fmt) => items.length ? '<div>' + items.map(([l, v, max]) => '<div class="rbar"><span>' + esc(l) + '</span><i style="width:' + Math.max(3, Math.round(v / (max || 1) * 100)) + '%"></i><b>' + fmt(v) + '</b></div>').join('') + '</div>' : '<p class="muted">Aucune donnée.</p>';
  const rowTrip = t => { const s = T.status(t); return '<div class="swr" style="--n:0"><div class="item" data-id="' + t.id + '" role="button" tabindex="0"><span class="av">🚛</span><span class="tx"><b>' + esc(vname(t.vehicleId)) + ' · ' + esc((t.from || '?') + ' → ' + (t.to || '?')) + '</b><small>' + App.fmtDate(t.date) + ' · ' + esc(clock(t.dep)) + ' → ' + esc(clock(t.arr)) + (t.stop ? ' · scale ' + esc(hm(t.stop)) : '') + ' · ' + esc(t.number) + '</small></span><span class="end"><span class="pill ' + tone(s) + '">' + esc(s) + '</span>' + (T.freight(t) ? '<small>' + esc(M.main(T.freight(t))) + (t.cancelled ? '' : T.billable(t).length ? ' · à facturer' : T.invoices(t).some(i => A.due(i) > 0) ? ' · à encaisser' : T.invoices(t).length ? ' · encaissé' : '') + '</small>' : '') + '</span></div></div>'; };
  const tabTrips = (tab, el) => {
    const t0 = App.today(), RG = { today: ['Aujourd\'hui', { from: t0, to: t0 }], week: ['7 jours', F.range('week')], month: ['Ce mois', F.range('month')], all: ['Tout', { from: '0000-00-00', to: '9999-99-99' }] }, q = norm(st.q);
    const l = T.inRange(RG[st.f][1]).filter(t => !q || norm([t.number, t.from, t.to, t.driver, vname(t.vehicleId), (t.lines || []).map(x => x.client).join(' ')].join(' ')).includes(q)).sort((a, b) => (b.at || 0) - (a.at || 0)), td = trips().filter(t => t.date === t0 && live(t));
    tab.innerHTML = '<section class="hero"><small>Mouvements du jour</small><div class="amt">' + td.length + '</div><div class="sub">' + td.filter(t => T.status(t) === 'En route').length + ' en route · ' + td.filter(t => T.status(t) === 'Arrivé').length + ' arrivé(s) · ' + vehs().length + ' chariot(s)</div></section>' + (T.due().length ? '<section class="card"><h3>⚠ Entretien à prévoir</h3>' + T.due().map(d => '<p>' + esc(vname(d.v.id)) + ' — ' + esc(d.m.kind) + (d.m.nextDate ? ' avant le ' + App.fmtDate(d.m.nextDate) : '') + (d.m.nextKm ? ' / ' + d.m.nextKm + ' km' : '') + (d.late ? ' <span class="pill bad">en retard</span>' : '') + '</p>').join('') + '</section>' : '') +
      '<div class="tools"><button class="btn primary" id="tn">+ Mouvement</button><input type="search" id="tq" placeholder="Chariot, ville, client…" value="' + esc(st.q) + '"></div><div class="chips">' + Object.entries(RG).map(([k, v]) => '<button data-f="' + k + '" class="' + (st.f === k ? 'on' : '') + '">' + v[0] + '</button>').join('') + '</div>' +
      (l.length ? '<div class="list">' + l.slice(0, 150).map(rowTrip).join('') + '</div>' : (trips().length ? '<p class="muted center">Aucun mouvement sur cette période.</p>' : ui.empty('🚛', 'Aucun mouvement', vehs().length ? 'Enregistrez le départ d\'un chariot : heure, chargement, clients et fret.' : 'Commencez par ajouter vos chariots (onglet Chariots), puis enregistrez leurs mouvements.', { label: vehs().length ? '+ Mouvement' : '+ Chariot', to: vehs().length ? '#tn' : '#tv' })));
    tab.querySelector('#tn').onclick = () => T.form(); const tv = tab.querySelector('[data-cta="#tv"]'); if (tv) tv.onclick = () => T.vehicleForm();
    const tq = tab.querySelector('#tq'); tq.oninput = () => { st.q = tq.value; const p = tq.selectionStart; tabTrips(tab, el); const n = tab.querySelector('#tq'); n.focus(); n.setSelectionRange(p, p); };
    tab.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { st.f = b.dataset.f; tabTrips(tab, el); }); tab.querySelectorAll('.item[data-id]').forEach(i => i.onclick = () => T.profile(i.dataset.id));
  };
  const tabRep = (tab, el) => {
    const r = F.range(F.state.r), c = T.report(r), catMax = Math.max(1, ...Object.values(c.byCat).map(v => v.qty)), clMax = Math.max(1, ...c.byCl.map(x => x.f));
    tab.innerHTML = F.rangeChips() + '<section class="hero"><small>Fret · ' + esc(r.label) + '</small><div class="amt">' + M.main(c.freight) + '</div><div class="sub">' + c.l.length + ' mouvement(s) · route moyenne ' + esc(hm(c.n ? c.minutes / c.n : null)) + ' · scale ' + esc(hm(c.stop)) + '</div></section>' +
      '<section class="card"><h3>Chargement par marchandise</h3>' + (Object.keys(c.byCat).length ? Object.entries(T.CATS).filter(([k]) => c.byCat[k]).map(([k, cat]) => '<div class="rbar"><span>' + esc(cat[1] + ' ' + cat[0]) + '</span><i style="width:' + Math.max(3, Math.round((k === 'cash' ? 100 : c.byCat[k].qty / catMax * 100))) + '%"></i><b>' + (k === 'cash' ? esc(M.main(c.byCat[k].cash)) : c.byCat[k].qty) + '</b></div>').join('') : '<p class="muted">Aucune donnée.</p>') + '</section>' +
      '<section class="card"><h3>Clients</h3>' + bars(c.byCl.slice(0, 10).map(x => [x.name + ' (' + x.n + ')', x.f, clMax]), M.main) + '</section>' +
      '<section class="card"><h3>Par chariot</h3>' + (Object.keys(c.byV).length ? Object.entries(c.byV).map(([id, v]) => { const cs = T.consumption(id, r); return '<p><b>' + esc(vname(id)) + '</b> — ' + v.n + ' mouvement(s)' + (v.km ? ' · ' + v.km + ' km' : '') + ' · fret ' + esc(M.main(v.f)) + (cs ? ' · ' + (Math.round(cs * 10) / 10) + ' L/100 km' : '') + '</p>'; }).join('') : '<p class="muted">Aucune donnée.</p>') + '</section>' +
      (App.mod('sales') ? (b => '<section class="card"><h3>Fret · facturation</h3><div class="stats"><div><b>' + M.main(b.unbilled) + '</b><small>à facturer</small></div><div><b>' + M.main(b.billed) + '</b><small>facturé</small></div><div><b>' + M.main(b.paid) + '</b><small>encaissé</small></div><div class="' + (b.due > 0 ? 'bad' : '') + '"><b>' + M.main(b.due) + '</b><small>reste à encaisser</small></div></div></section>')(T.billing(r)) : '') + '<div class="stats card"><div><b>' + Math.round(c.litersOut * 10) / 10 + ' L</b><small>carburant sorti</small></div><div><b>' + M.main(c.fuelCost) + '</b><small>carburant acheté</small></div><div><b>' + M.main(c.maintCost) + '</b><small>entretien</small></div></div><div class="tools"><button class="btn ghost" id="rc">Copier</button><button class="btn primary" id="rw">💬 WhatsApp</button></div>';
    tab.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { F.state.r = b.dataset.r; tabRep(tab, el); });
    tab.querySelector('#rc').onclick = () => (navigator.clipboard ? navigator.clipboard.writeText(T.reportText(r)) : Promise.reject()).then(() => App.toast('Copié'), () => App.toast('Copie impossible', 'err')); tab.querySelector('#rw').onclick = () => window.open('https://wa.me/?text=' + encodeURIComponent(T.reportText(r)), '_blank');
  };
  const tabFuel = (tab, el) => {
    const sup = db().suppliers, l = fuel().slice().sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 40);
    tab.innerHTML = '<section class="hero"><small>Stock de carburant</small><div class="amt">' + Math.round(T.stock() * 10) / 10 + ' L</div><div class="sub">' + fuel().filter(f => f.type === 'in').length + ' réception(s) · ' + sup.length + ' fournisseur(s)</div></section><div class="tools"><button class="btn primary" id="fi">+ Réception</button><button class="btn ghost" id="fo">⛽ Sortie</button><button class="btn ghost" id="fs">🏭 Fournisseurs</button></div>' +
      '<section class="card"><h3>Consommation</h3>' + (vehs().length ? vehs().map(v => { const cs = T.consumption(v.id), lit = fuel().filter(f => f.type === 'out' && f.vehicleId === v.id).reduce((s, f) => s + f.liters, 0); return '<p><b>' + esc(vname(v.id)) + '</b> — ' + Math.round(lit * 10) / 10 + ' L' + (cs ? ' · <b>' + Math.round(cs * 10) / 10 + ' L/100 km</b>' : ' · <span class="muted">2 relevés de compteur nécessaires</span>') + '</p>'; }).join('') : '<p class="muted">Ajoutez vos chariots.</p>') + '</section>' +
      (l.length ? '<h4>Mouvements de carburant</h4><div class="list">' + l.map(f => '<div class="swr" style="--n:0"><div class="item" data-fd="' + f.id + '" role="button" tabindex="0"><span class="av">' + (f.type === 'in' ? '⛽' : '🚛') + '</span><span class="tx"><b>' + (f.type === 'in' ? 'Réception' : 'Sortie · ' + esc(vname(f.vehicleId))) + '</b><small>' + App.fmtDate(f.date) + (f.supplierId ? ' · ' + esc((sup.find(x => x.id === f.supplierId) || {}).name || '') : '') + (f.km ? ' · ' + f.km + ' km' : '') + '</small></span><span class="end"><b>' + (f.type === 'in' ? '+' : '−') + ' ' + Math.round(f.liters * 10) / 10 + ' L</b></span></div></div>').join('') + '</div>' : ui.empty('⛽', 'Aucun mouvement de carburant', 'Enregistrez vos réceptions auprès des fournisseurs et les sorties vers chaque chariot : stock et consommation se calculent tout seuls.'));
    tab.querySelector('#fi').onclick = () => T.fuelForm('in'); tab.querySelector('#fo').onclick = () => T.fuelForm('out'); tab.querySelector('#fs').onclick = () => App.go('suppliers');
    tab.querySelectorAll('[data-fd]').forEach(i => i.onclick = () => { if (App.can('delete')) T.fuelDelete(i.dataset.fd); });
  };
  const tabMaint = (tab, el) => {
    const l = maint().slice().sort((a, b) => b.date.localeCompare(a.date));
    tab.innerHTML = '<div class="tools"><button class="btn primary" id="mn2">+ Entretien / dépannage</button></div>' + (l.length ? '<div class="list">' + l.map(m => '<div class="swr" style="--n:0"><div class="item" data-m="' + m.id + '" role="button" tabindex="0"><span class="av">🔧</span><span class="tx"><b>' + esc(m.kind) + ' · ' + esc(vname(m.vehicleId)) + '</b><small>' + App.fmtDate(m.date) + (m.place ? ' · ' + esc(m.place) : '') + (m.phone ? ' · ' + esc(m.phone) : '') + (m.nextDate ? ' · prochain ' + App.fmtDate(m.nextDate) : '') + '</small></span><span class="end"><b>' + (m.cost ? esc(M.fmt(m.cost, m.currency)) : '') + '</b></span></div></div>').join('') + '</div>' : ui.empty('🔧', 'Aucun entretien', 'Notez les vidanges, réparations et dépannages : le coût entre dans vos dépenses et le prochain entretien est rappelé.', { label: '+ Entretien', to: '#mn2' }));
    tab.querySelector('#mn2').onclick = () => T.maintForm(); const cta = tab.querySelector('[data-cta]'); if (cta) cta.onclick = () => T.maintForm(); tab.querySelectorAll('[data-m]').forEach(i => i.onclick = () => T.maintForm(i.dataset.m));
  };
  const tabVeh = (tab, el) => {
    tab.innerHTML = '<div class="tools"><button class="btn primary" id="tv2">+ Chariot</button></div>' + (vehs().length ? '<div class="list">' + vehs().map(v => '<div class="swr" style="--n:0"><div class="item" data-v="' + v.id + '" role="button" tabindex="0"><span class="av">🚛</span><span class="tx"><b>' + esc(v.plate) + (v.name ? ' · ' + esc(v.name) : '') + '</b><small>' + esc(v.kind) + (v.capacity ? ' · ' + esc(v.capacity) : '') + (v.driver ? ' · ' + esc(v.driver) : '') + '</small></span><span class="end"><small>' + trips().filter(t => t.vehicleId === v.id && live(t)).length + ' mouvement(s)</small></span></div></div>').join('') + '</div>' : ui.empty('🚛', 'Aucun chariot', 'Ajoutez vos camions, remorques et pick-up pour suivre leurs mouvements, leur carburant et leur entretien.', { label: '+ Chariot', to: '#tv2' }));
    tab.querySelector('#tv2').onclick = () => T.vehicleForm(); const cta = tab.querySelector('[data-cta]'); if (cta) cta.onclick = () => T.vehicleForm(); tab.querySelectorAll('[data-v]').forEach(i => i.onclick = () => T.vehicleForm(i.dataset.v));
  };
  App.views.transport = { title: 'Transport', render(el, params) {
    if (params && params.tab) st.tab = params.tab;
    const tabs = [['trips', 'Mouvements'], ...(App.can('reports') ? [['rep', 'Rapport']] : []), ['fuel', 'Carburant'], ['maint', 'Entretien'], ['veh', 'Flotte']]; if (!tabs.some(t => t[0] === st.tab)) st.tab = 'trips';
    el.innerHTML = '<div class="page"><div class="seg" id="ttabs" style="overflow-x:auto">' + tabs.map(t => '<button data-t="' + t[0] + '" style="flex:0 0 auto;font-size:13px;padding-inline:10px" class="' + (st.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div><div id="ttab" class="page" style="padding:0"></div></div>';
    el.querySelectorAll('#ttabs button').forEach(b => b.onclick = () => { st.tab = b.dataset.t; App.views.transport.render(el); });
    ({ trips: tabTrips, rep: tabRep, fuel: tabFuel, maint: tabMaint, veh: tabVeh })[st.tab](el.querySelector('#ttab'), el);
    if (params && params.add) T.form();
  } };
  App.quick.push({ label: () => 'Nouveau mouvement', mod: 'transport', to: 'transport', qc: '#1f9d55', ic: '🚛', short: () => 'Mouvement', run: () => { App.go('transport', { tab: 'trips' }); setTimeout(() => T.form(), 30); } });
})();
