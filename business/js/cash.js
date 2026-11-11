// Cash drawer (module « Caisse »): expected cash, counting with gap, daily closing (cash expected, WhatsApp share).
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, A = App.sales, F = App.fin, db = () => App.db;
  const K = App.cash = {};
  const curs = () => [db().settings.currency, db().settings.cur2];
  const lastCount = () => db().cashCounts[db().cashCounts.length - 1];
  // expected cash per currency = last counted + cash payments in − cash expenses out since that count
  K.expected = () => {
    const last = lastCount(), since = last ? last.at : 0, cm = F.cashMode(), o = {}; curs().forEach(c => o[c] = last ? (last.counted[c] || 0) : 0);
    db().payments.filter(p => p.mode === cm && F.at(p) > since).forEach(p => { o[p.currency] = (o[p.currency] || 0) + p.amount; });
    db().expenses.filter(e => e.mode === cm && F.at(e) > since).forEach(e => { o[e.currency] = (o[e.currency] || 0) - e.amount; });
    curs().forEach(c => o[c] = M.round(o[c], c)); return o;
  };
  const fmtMap = o => curs().map(c => M.fmt(o[c] || 0, c)).join(' · ');
  K.count = (note, counted, kind) => { const exp = K.expected(), gap = {}; curs().forEach(c => gap[c] = M.round((counted[c] || 0) - (exp[c] || 0), c)); const rec = { id: App.uid(), at: Date.now(), date: App.today(), counted, expected: exp, gap, note: note || '', kind: kind || 'count' }; db().cashCounts.push(rec); App.log('cash.' + rec.kind, fmtMap(counted)); return rec; };

  // ---------- daily closing ----------
  K.day = date => {
    const r = { from: date, to: date }, inv = db().invoices.filter(i => A.live(i) && i.date === date), pays = db().payments.filter(p => p.date === date), exps = db().expenses.filter(e => e.date === date), cm = F.cashMode();
    const byCur = (l, pick) => { const o = {}; l.forEach(x => { const c = pick(x); o[c] = (o[c] || 0) + x.amount; }); return o; };
    return { date, invoices: inv.length, sales: inv.reduce((a, i) => a + A.main(i, i.total), 0), inByMode: F.byMode(pays.map(p => ({ amount: p.amount, cur: p.currency, rate: p.rate, mode: p.mode }))), inCur: byCur(pays, p => p.currency), cashIn: byCur(pays.filter(p => p.mode === cm), p => p.currency), outCur: byCur(exps, e => e.currency), cashOut: byCur(exps.filter(e => e.mode === cm), e => e.currency), expMain: F.sumMain(exps.map(e => ({ amount: e.amount, cur: e.currency, rate: e.rate }))), inMain: F.sumMain(pays.map(p => ({ amount: p.amount, cur: p.currency, rate: p.rate }))) };
  };
  K.closeText = (c, d) => { const s = db().settings, line = o => Object.entries(o).map(([k, v]) => M.fmt(v, k)).join(' + ') || '0'; return 'Clôture du ' + App.fmtDate(c.date) + ' — ' + s.name + '\n' + '• Ventes : ' + d.invoices + ' facture(s), ' + M.main(d.sales) + '\n• Encaissé : ' + line(d.inCur) + '\n• Dépenses : ' + line(d.outCur) + '\n• Cash attendu : ' + fmtMap(c.expected) + '\n• Cash compté : ' + fmtMap(c.counted) + '\n• Écart : ' + curs().map(k => (c.gap[k] > 0 ? '+' : '') + M.fmt(c.gap[k] || 0, k)).join(' · ') + (c.note ? '\nNote : ' + c.note : ''); };
  K.closeSheet = () => {
    const date = App.today(), d = K.day(date), exp = K.expected(), old = db().closings.find(x => x.date === date);
    ui.sheet({ title: 'Clôture du jour — ' + App.fmtDate(date), wide: true,
      html: (old ? '<div class="warnbox">Une clôture existe déjà pour aujourd\'hui : elle sera remplacée.</div>' : '') + '<div class="stats"><div><b>' + d.invoices + '</b><small>facture(s)</small></div><div><b>' + M.main(d.inMain) + '</b><small>encaissé</small></div><div><b>' + M.main(d.expMain) + '</b><small>dépenses</small></div></div><p class="muted">Cash attendu en caisse : <b>' + esc(fmtMap(exp)) + '</b></p>' + curs().map(c => ui.field('Cash compté (' + c + ')', ui.input('c_' + c, '', { num: 1 }))).join('') + ui.field('Note', ui.input('note', '')) + '<div id="cg" class="muted"></div>',
      onMount: sh => { sh.body.addEventListener('input', () => { const f = ui.read(sh.body); sh.q('#cg').innerHTML = curs().filter(c => f['c_' + c]).map(c => 'Écart ' + c + ' : <b>' + M.fmt(f['c_' + c] - exp[c], c) + '</b>').join(' · '); }); },
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Clôturer', cls: 'primary', fn: sh => {
        const f = ui.read(sh.body), counted = {}; curs().forEach(c => counted[c] = f['c_' + c] || 0);
        if (!curs().some(c => counted[c]) && !sh._ok) { App.toast('Aucun montant compté. Appuyez encore pour clôturer avec 0.', 'err'); sh._ok = true; return false; }
        const rec = K.count(f.note, counted, 'close'), text = K.closeText(rec, d); db().closings = db().closings.filter(x => x.date !== date); db().closings.push({ id: App.uid(), date, at: rec.at, countId: rec.id, text }); App.save(); App.toast('Journée clôturée'); App.render(); setTimeout(() => K.shareSheet(date), 250);
      } }] });
  };
  K.shareSheet = date => {
    const c = db().closings.find(x => x.date === date); if (!c) return;
    ui.sheet({ title: 'Clôture du ' + App.fmtDate(date), html: '<div class="card" style="white-space:pre-wrap">' + esc(c.text) + '</div>', actions: [{ label: 'Copier', cls: 'ghost', fn: () => { (navigator.clipboard ? navigator.clipboard.writeText(c.text) : Promise.reject()).then(() => App.toast('Copié'), () => App.toast('Copie impossible', 'err')); return false; } }, { label: '🖨️ Imprimer', cls: 'ghost', fn: () => { A.printHtml(A.page('Clôture du jour', App.fmtDate(date), '<div class="box" style="white-space:pre-wrap">' + esc(c.text) + '</div>')); return false; } }, { label: '💬 WhatsApp', cls: 'primary', fn: () => { window.open('https://wa.me/?text=' + encodeURIComponent(c.text), '_blank', 'noopener'); return false; } }] });
  };

  // ---------- screen ----------
  App.views.cash = {
    title: 'Caisse',
    render(el) {
      const exp = K.expected(), last = lastCount(), hist = db().cashCounts.slice().reverse().slice(0, 30);
      el.innerHTML = '<div class="page"><section class="hero"><small>Cash estimé en caisse (' + esc(F.cashMode()) + ')</small><div class="amt">' + esc(M.fmt(exp[curs()[0]], curs()[0])) + '</div><div class="sub">' + esc(M.fmt(exp[curs()[1]], curs()[1])) + (last ? ' · depuis le comptage du ' + App.fmtDate(last.date) : ' · aucun comptage encore') + '</div></section>' +
        '<div class="tools"><button class="btn primary" id="cc">Compter la caisse</button><button class="btn ghost" id="cl">🔒 Clôture du jour</button></div>' +
        (hist.length ? '<h4>Historique</h4><div class="list">' + hist.map(h => { const bad = curs().some(c => h.gap[c]); return '<div class="swr" style="--n:0"><div class="item"><span class="av">' + (h.kind === 'close' ? '🔒' : '🧮') + '</span><span class="tx"><b>' + esc(fmtMap(h.counted)) + '</b><small>' + App.fmtDate(h.date) + (h.kind === 'close' ? ' · clôture' : '') + (h.note ? ' · ' + esc(h.note) : '') + '</small></span><span class="end"><span class="pill ' + (bad ? 'warn' : 'ok') + '">' + (bad ? 'écart ' + curs().filter(c => h.gap[c]).map(c => (h.gap[c] > 0 ? '+' : '') + M.fmt(h.gap[c], c)).join(' ') : 'juste') + '</span></span></div></div>'; }).join('') + '</div>' : '') +
        (db().closings.length ? '<h4>Clôtures</h4><div class="list">' + db().closings.slice().reverse().slice(0, 15).map(c => '<div class="swr" style="--n:0"><div class="item" data-cl="' + c.date + '" role="button" tabindex="0"><span class="av">🔒</span><span class="tx"><b>' + App.fmtDate(c.date) + '</b><small>Toucher pour partager</small></span></div></div>').join('') + '</div>' : '') + '</div>';
      el.querySelector('#cl').onclick = K.closeSheet; el.querySelectorAll('[data-cl]').forEach(i => i.onclick = () => K.shareSheet(i.dataset.cl));
      el.querySelector('#cc').onclick = () => { const e2 = K.expected(); ui.sheet({ title: 'Compter la caisse', html: '<p class="muted">Attendu : <b>' + esc(fmtMap(e2)) + '</b></p>' + curs().map(c => ui.field('Compté (' + c + ')', ui.input('c_' + c, '', { num: 1 }))).join('') + ui.field('Note', ui.input('note', '')) + '<div id="cg" class="muted"></div>', onMount: sh => sh.body.addEventListener('input', () => { const f = ui.read(sh.body); sh.q('#cg').innerHTML = curs().filter(c => f['c_' + c]).map(c => 'Écart ' + c + ' : <b>' + M.fmt(f['c_' + c] - e2[c], c) + '</b>').join(' · '); }), actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Enregistrer', cls: 'primary', fn: sh => { const f = ui.read(sh.body), counted = {}; curs().forEach(c => counted[c] = f['c_' + c] || 0); if (!curs().some(c => counted[c])) { App.toast('Saisissez un montant', 'err'); return false; } K.count(f.note, counted); App.save(); App.toast('Comptage enregistré'); App.render(); } }] }); };
    }
  };
})();
