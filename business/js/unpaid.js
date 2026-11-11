// Unpaid invoices: who owes what, how old, WhatsApp reminders (one by one or « relances du jour »), shortcut to collect.
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money, A = App.sales, C = App.clients, db = () => App.db;
  const recent = i => i.lastRemind && App.diff(i.lastRemind, App.today()) <= 2;
  const tone = d => d > 60 ? 'bad' : d > 30 ? 'warn' : '';
  const queue = () => A.unpaidList().filter(i => { const c = A.client(i); return c && c.phone && !recent(i); });
  A.remindText = i => { const c = A.client(i); return A.msg(db().settings.msgs.remind, { nom: A.cname(i), numero: i.number, montant: A.fmt(i, i.total), reste: A.fmt(i, A.due(i)), jours: A.age(i), entreprise: db().settings.name }); };
  A.remind = i => { const c = A.client(i); window.open('https://wa.me/' + (c && c.phone ? C.intl(c.phone) : '') + '?text=' + encodeURIComponent(A.remindText(i)), '_blank', 'noopener'); i.lastRemind = App.today(); App.log('invoice.remind', i.number); App.save(); };
  // series: one reminder per invoice, oldest debts first; clients without a phone or reminded in the last 2 days are skipped
  A.remindSeries = () => {
    const ids = queue().map(i => i.id); if (!ids.length) return App.toast('Personne à relancer aujourd\'hui');
    let k = 0, sh; const show = () => { const i = A.get(ids[k]); if (!i) return sh.close(); sh.body.innerHTML = '<p class="muted">' + (k + 1) + ' sur ' + ids.length + '</p><h3>' + esc(A.cname(i)) + '</h3><p>' + esc(i.number) + ' · reste <b>' + A.fmt(i, A.due(i)) + '</b> · ' + A.age(i) + ' jour(s)</p><div class="card" style="white-space:pre-wrap">' + esc(A.remindText(i)) + '</div><div class="tools"><button class="btn primary" id="rs-go">💬 Ouvrir WhatsApp</button><button class="btn ghost" id="rs-skip">Passer</button></div>'; sh.body.querySelector('#rs-go').onclick = () => { A.remind(i); next(); }; sh.body.querySelector('#rs-skip').onclick = next; };
    const next = () => { k++; if (k >= ids.length) { sh.close(); App.toast('Relances terminées'); App.render(); } else show(); };
    sh = ui.sheet({ title: 'Relances du jour', wide: true, html: '' }); show();
  };
  A.tabs.unpaid = {
    label: 'Impayés',
    render(tab, el) {
      const l = A.unpaidList(), tot = A.unpaidTotal(), old = l.filter(i => A.age(i) > 30).reduce((a, i) => a + A.main(i, A.due(i)), 0), q = queue().length;
      tab.innerHTML = '<div class="stats card"><div><b>' + M.main(tot) + '</b><small>à encaisser</small></div><div><b>' + l.length + '</b><small>facture(s)</small></div><div class="' + (old ? 'bad' : '') + '"><b>' + M.main(old) + '</b><small>de plus de 30 j</small></div></div>' + (q ? '<button class="btn primary" id="rs">💬 Relances du jour (' + q + ')</button>' : '') +
        (l.length ? '<div class="list">' + l.map(i => { const d = A.age(i), c = A.client(i); return '<div class="swr" style="--n:0"><div class="item" data-id="' + i.id + '" role="button" tabindex="0"><span class="av">' + esc(App.letterOf(A.cname(i))) + '</span><span class="tx"><b>' + esc(A.cname(i)) + '</b><small>' + esc(i.number) + ' · <span class="pill ' + tone(d) + '">' + d + ' j</span>' + (recent(i) ? ' · relancé' : '') + '</small></span><span class="end"><b>' + A.fmt(i, A.due(i)) + '</b><span><button class="btn sm primary" data-pay="' + i.id + '">💰</button> ' + (c && c.phone ? '<button class="btn sm ghost" data-wa="' + i.id + '">💬</button>' : '') + '</span></span></div></div>'; }).join('') + '</div>' : '<div class="empty"><div class="big">🎉</div><h2>Aucune facture impayée</h2></div>');
      const rs = tab.querySelector('#rs'); rs && (rs.onclick = A.remindSeries);
      tab.querySelectorAll('[data-pay]').forEach(b => b.onclick = e => { e.stopPropagation(); A.payForm(b.dataset.pay); });
      tab.querySelectorAll('[data-wa]').forEach(b => b.onclick = e => { e.stopPropagation(); A.remind(A.get(b.dataset.wa)); App.render(); });
      tab.querySelectorAll('.item[data-id]').forEach(i => i.onclick = () => A.profile(i.dataset.id));
    }
  };
})();
