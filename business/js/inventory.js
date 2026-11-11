// Inventory: count every tracked product, see the gaps (quantity and value), then adjust the stock in one go.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, S = App.stock, norm = App.clients.norm;
  S.inventory = () => {
    const prods = App.db.products.filter(S.tracked).sort((a, b) => norm(a.name).localeCompare(norm(b.name))), last = App.db.inventories[App.db.inventories.length - 1];
    if (!prods.length) return App.toast('Aucun produit suivi en stock', 'err');
    const rows = prods.map(p => '<tr data-p="' + p.id + '"><td>' + esc(p.name) + '<br><small class="muted">attendu ' + S.qty(p) + '</small></td><td><input inputmode="decimal" data-exp="' + p.qty + '" placeholder="' + S.nf(p.qty) + '" aria-label="Compté : ' + esc(p.name) + '"></td><td class="gap"></td></tr>').join('');
    const sh = ui.sheet({ title: 'Inventaire', wide: true, html: '<p class="muted">Saisissez la quantité comptée. Laissez vide ce que vous n\'avez pas compté : le stock ne bouge pas.' + (last ? ' Dernier inventaire : ' + App.fmtDate(last.date) + '.' : '') + '</p><table class="tbl"><tr><th>' + esc(App.cap(App.vocab('product'))) + '</th><th>Compté</th><th>Écart</th></tr>' + rows + '</table><p id="invsum" class="muted"></p>',
      actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Valider l\'inventaire', cls: 'primary', fn: sh => {
        const lines = []; sh.body.querySelectorAll('tr[data-p]').forEach(tr => { const i = tr.querySelector('input'), v = i.value.trim(); if (v === '') return; const c = parseFloat(v.replace(',', '.')); if (!Number.isFinite(c) || c < 0) return; lines.push({ pid: tr.dataset.p, expected: +i.dataset.exp, counted: c }); });
        if (!lines.length) { App.toast('Aucune quantité saisie', 'err'); return false; }
        let n = 0; lines.forEach(l => { const d = Math.round((l.counted - l.expected) * 1000) / 1000; if (d) { S.move({ pid: l.pid, qty: d, type: 'count', note: 'Inventaire' }); n++; } });
        App.db.inventories.push({ id: App.uid(), date: App.today(), lines }); App.log('inventory', lines.length + ' lignes, ' + n + ' écarts'); App.save(); App.toast(lines.length + ' compté(s), ' + n + ' écart(s) corrigé(s)'); App.render();
      } }] });
    sh.body.addEventListener('input', () => { let tot = 0, nb = 0; sh.body.querySelectorAll('tr[data-p]').forEach(tr => { const i = tr.querySelector('input'), g = tr.querySelector('.gap'); if (i.value.trim() === '') { g.textContent = ''; return; } const d = (parseFloat(i.value.replace(',', '.')) || 0) - +i.dataset.exp; g.textContent = d ? (d > 0 ? '+' : '') + S.nf(d) : '✔'; g.style.color = d < 0 ? 'var(--bad)' : d > 0 ? 'var(--ok)' : ''; if (d) { nb++; tot += d * (+S.get(tr.dataset.p).cost || 0); } }); sh.q('#invsum').textContent = nb ? nb + ' écart(s) · valeur ' + M.main(tot) : ''; });
  };
})();
