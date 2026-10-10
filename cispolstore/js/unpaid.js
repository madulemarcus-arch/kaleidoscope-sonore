// Unpaid invoices: who owes what, how old, with a WhatsApp reminder and a shortcut to record the payment.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc;
  const open = () => App.db.invoices.filter(i => App.invDue(i) > 0.004).sort((a, b) => a.date.localeCompare(b.date));
  App.unpaidTotal = () => open().reduce((a, i) => a + App.usd(App.invDue(i), i.currency, i), 0) + App.penaltyDueTotal();
  const recent = i => i.lastRemind && App.diff(i.lastRemind, App.today()) <= 2;
  const age = i => Math.max(0, App.diff(i.date, App.today()));
  const ageTone = d => d > 60 ? 'bad' : d > 30 ? 'warn' : '';

  App.views.impayes = () => {
    const l = open(), tot = App.unpaidTotal(), old = l.filter(i => age(i) > 30).reduce((a, i) => a + App.usd(App.invDue(i), i.currency, i), 0);
    return {
      title: 'Impayés', back: 'more', nav: 'more',
      html: `<div class="grid two"><div class="stat"><small>Total à encaisser</small><b class="${tot ? 'warn' : 'ok'}">${App.fmt(tot)}</b><small>${l.length} facture(s)${App.db.penalties.some(p => !p.paid) ? ' + pénalités' : ''}</small></div><div class="stat"><small>Plus de 30 jours</small><b class="${old ? 'bad' : ''}">${App.fmt(old)}</b></div></div>
        ${queue().length ? `<div class="card" style="margin-bottom:10px;border:2px solid var(--acc)"><b>💬 Relance en série</b><p class="mut" style="margin:4px 0 8px">${queue().length} client(s) à relancer (téléphone connu, pas relancés ces 2 derniers jours). Un message prêt s'ouvre dans WhatsApp, vous n'avez qu'à envoyer, puis le suivant s'affiche.</p><button class="btn full" data-act="dun_all">▶ Commencer les relances</button></div>` : ''}
        ${App.penaltySection()}
        ${l.length ? `<h2 class="sec">Factures impayées</h2><div class="list">${l.map(i => {
          const c = App.client(i.clientId), d = age(i), done = recent(i);
          return `<div class="item" style="${done ? 'opacity:.7' : ''}"><div class="grow" data-act="go" data-v="invoice" data-id="${i.id}" style="cursor:pointer"><b>${esc(App.cname(c))}</b><small>${esc(i.number)} · ${App.fdate(i.date)} · <span class="${ageTone(d)}">${d} j</span>${i.lastRemind ? ' · relancé le ' + App.fdate(i.lastRemind) : ''}</small></div><div class="end"><b class="${ageTone(d)}">${App.fmt(App.invDue(i), i.currency)}</b><span><button class="btn sm" data-act="newpay" data-iid="${i.id}">💰</button>${c && c.phone ? ` <button class="btn sm${done ? ' sec' : ''}" data-act="dun" data-id="${i.id}">💬</button>` : ''}</span></div></div>`;
        }).join('')}</div>` : (App.db.penalties.some(p => !p.paid) ? '' : '<div class="empty">Aucune facture impayée. 🎉</div>')}
        <p class="mut" style="font-size:13px;margin-top:12px">💰 enregistre un paiement · 💬 ouvre WhatsApp avec le message de relance (modifiable dans Paramètres).</p>`
    };
  };
  // one reminder per invoice, oldest debts first; clients without a phone or already reminded in the last 2 days are skipped
  const queue = () => open().filter(i => { const c = App.client(i.clientId); return c && c.phone && !recent(i); });
  App.actions.dun_all = () => {
    const ids = queue().map(i => i.id); if (!ids.length) return App.toast('Personne à relancer');
    let k = 0, sent = 0;
    const show = () => {
      while (k < ids.length && !(App.invoice(ids[k]) && App.invDue(App.invoice(ids[k])) > 0.004)) k++;
      if (k >= ids.length) { App.modal('Relances terminées', `<p>✅ ${sent} relance(s) envoyée(s).</p>`); App.refresh(); return; }
      const i = App.invoice(ids[k]), c = App.client(i.clientId), msg = App.unpaidText(i, c);
      App.modal(`Relance ${k + 1} / ${ids.length}`, `<div class="card"><b>${esc(App.cname(c))}</b><div class="mut">${esc(c.phone)} · ${esc(i.number)} · ${age(i)} j</div><div style="font-size:20px;font-weight:800;margin:6px 0">${App.fmt(App.invDue(i), i.currency)}</div><pre style="white-space:pre-wrap;font:inherit;font-size:13px;background:var(--bg2,#0001);padding:8px;border-radius:8px;margin:0">${esc(msg)}</pre></div>
        <div class="bar" style="margin-top:10px"><button type="button" class="btn" id="qsend">💬 Envoyer sur WhatsApp</button><button type="button" class="btn sec" id="qskip">Passer</button></div>`);
      $('qsend').onclick = () => { window.open(App.waUrl(c.phone, msg), '_blank', 'noopener'); i.lastRemind = App.today(); App.log(c.id, 'Relance impayé ' + i.number); App.save(); sent++; k++; show(); };
      $('qskip').onclick = () => { k++; show(); };
    };
    show();
  };
  App.actions.dun = d => {
    const i = App.invoice(d.id), c = i && App.client(i.clientId); if (!c || !c.phone) return App.toast('Pas de numéro de téléphone');
    const url = App.waUrl(c.phone, App.unpaidText(i, c)); window.open(url, '_blank', 'noopener');
    i.lastRemind = App.today(); App.log(c.id, 'Relance impayé ' + i.number); App.save(); App.refresh();
  };
})();
