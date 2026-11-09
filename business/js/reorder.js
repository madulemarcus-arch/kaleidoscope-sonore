// To reorder: low-stock products grouped by supplier → purchase orders (BC-AAAA-0001) → receiving them feeds the stock.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, S = App.stock, P = App.suppliers, C = App.clients;
  const nextNo = () => { const y = new Date().getFullYear(), q = App.db.settings.seq.order; q[y] = (q[y] || 0) + 1; return 'BC-' + y + '-' + String(q[y]).padStart(4, '0'); };
  const text = o => { const sp = P.get(o.supplierId); return 'Bon de commande ' + o.number + ' — ' + (App.db.settings.name || '') + '\nÀ : ' + (sp ? sp.name : '—') + '\nDate : ' + App.fmtDate(o.date) + '\n\n' + o.lines.map(l => { const p = S.get(l.pid); return '• ' + (p ? p.name : '?') + ' : ' + S.nf(l.qty) + (p && p.unit !== 'pièce' ? ' ' + p.unit : ''); }).join('\n') + '\n\nMerci de confirmer la disponibilité et le prix.'; };
  S.orderTotal = o => o.lines.reduce((a, l) => a + l.qty * (l.cost || 0), 0);
  S.reorder = () => {
    const low = S.low(), groups = {}; low.forEach(p => (groups[p.supplierId || ''] = groups[p.supplierId || ''] || []).push(p));
    const open = App.db.orders.filter(o => o.status === 'open');
    const sh = ui.sheet({ title: 'À commander', wide: true,
      html: (low.length ? Object.entries(groups).map(([sid, ps]) => { const sp = P.get(sid); return '<section class="card"><h3>' + esc(sp ? sp.name : 'Sans fournisseur') + '</h3>' + ps.map(p => '<div class="row2"><span>' + esc(p.name) + '<br><small class="muted">' + S.qty(p) + ' en stock · min ' + S.nf(p.min) + '</small></span>' + ui.stepper('q_' + p.id, Math.max(Math.round(((+p.min || 1) * 2 - p.qty) * 100) / 100, 1), 0) + '</div>').join('') + '<button class="btn primary" data-mk="' + esc(sid) + '">Créer le bon de commande</button></section>'; }).join('') : '<p class="muted">Rien à commander : aucun stock bas. 👍</p>') +
        (open.length ? '<h4>Bons en cours</h4><div class="list">' + open.slice().reverse().map(o => { const sp = P.get(o.supplierId); return '<div class="item"><span class="tx"><b>' + esc(o.number) + '</b><small>' + esc(sp ? sp.name : 'Sans fournisseur') + ' · ' + o.lines.length + ' ligne(s) · ' + App.fmtDate(o.date) + '</small></span><span class="end"><button class="btn sm primary" data-rc="' + o.id + '">Réceptionner</button><button class="btn sm ghost" data-wa="' + o.id + '">💬 Envoyer</button></span></div>'; }).join('') + '</div>' : '') });
    sh.body.onclick = e => {
      const mk = e.target.closest('[data-mk]'), rc = e.target.closest('[data-rc]'), wa = e.target.closest('[data-wa]');
      if (mk) { const sid = mk.dataset.mk, lines = groups[sid].map(p => ({ pid: p.id, qty: parseFloat(String(sh.q('[name=q_' + p.id + ']').value).replace(',', '.')) || 0, cost: p.cost || 0 })).filter(l => l.qty > 0); if (!lines.length) return App.toast('Aucune quantité', 'err'); const o = { id: App.uid(), number: nextNo(), supplierId: sid, date: App.today(), lines, status: 'open' }; App.db.orders.push(o); App.log('order.add', o.number); App.save(); sh.close(); App.toast('Bon ' + o.number + ' créé'); App.render(); setTimeout(S.reorder, 250); }
      if (rc) { const o = App.db.orders.find(x => x.id === rc.dataset.rc); o.lines.forEach(l => S.move({ pid: l.pid, qty: l.qty, type: 'in', cost: l.cost, supplierId: o.supplierId, ref: o.number, note: 'Réception ' + o.number })); o.status = 'received'; o.received = App.today(); App.log('order.receive', o.number); App.save(); sh.close(); App.toast('Stock mis à jour'); App.render(); }
      if (wa) { const o = App.db.orders.find(x => x.id === wa.dataset.wa), sp = P.get(o.supplierId); window.open('https://wa.me/' + (sp && sp.phone ? C.intl(sp.phone) : '') + '?text=' + encodeURIComponent(text(o)), '_blank', 'noopener'); }
    };
  };
  App.stock.orderText = text;
})();
