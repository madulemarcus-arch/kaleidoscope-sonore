// Subscription plans: price charged to the customer and cost paid to Starlink, so each subscription invoice carries its margin.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc;
  const plans = () => App.db.settings.plans || {};
  const norm = s => String(s || '').trim().toLowerCase();
  App.planInfo = name => { const n = norm(name), k = Object.keys(plans()).find(x => norm(x) === n); return k ? plans()[k] : null; };
  // cost (USD) of the plan named in an invoice line, falling back to the client's plan
  App.planCost = (desc, client) => {
    const d = norm(desc), k = Object.keys(plans()).filter(x => d.includes(norm(x))).sort((a, b) => b.length - a.length)[0];
    const p = k ? plans()[k] : client && App.planInfo(client.plan);
    return (p && +p.cost) || 0;
  };
  App.subMargin = c => { const p = c && App.planInfo(c.plan); if (!p || !(+p.cost > 0) || !(c.price > 0)) return null; return { cost: +p.cost, margin: c.price - p.cost }; };
  // fills in the Starlink cost on subscription lines (called by createInvoice, and by the "recalculate" button)
  App.costSubLines = (inv, dry) => {
    let n = 0;
    inv.lines.forEach(l => { if (!l.pid && !l.cost && /^abonnement/i.test(l.desc)) { const c = App.planCost(l.desc, App.client(inv.clientId)); if (c > 0) { if (!dry) l.cost = App.conv(c, 'USD', inv.currency, App.rateOf(inv)); n++; } } });
    return n;
  };

  App.plansCard = () => {
    const names = [...new Set([...App.PLANS, ...Object.keys(plans())])];
    const line = (n, i) => { const p = plans()[n] || {}, m = (+p.price || 0) - (+p.cost || 0);
      return `<div class="item" style="flex-wrap:wrap"><div class="grow"><b>${esc(n)}</b><small id="pl_m${i}" class="${m > 0 ? 'ok' : ''}">${p.cost > 0 && p.price > 0 ? 'Marge : ' + App.fmt(m) : 'À renseigner'}</small></div><input id="pl_p${i}" data-plan="${esc(n)}" type="number" inputmode="decimal" step="any" min="0" placeholder="Prix client" value="${esc(p.price || '')}" style="width:96px"><input id="pl_c${i}" data-plan="${esc(n)}" type="number" inputmode="decimal" step="any" min="0" placeholder="Coût Starlink" value="${esc(p.cost || '')}" style="width:96px;margin-left:6px"></div>`; };
    return App.fold('plans', "Tarifs d'abonnement", `<div class="list">${names.map(line).join('')}
      <div class="item"><div class="grow"><b>Anciennes factures</b><small style="white-space:normal">Applique le coût Starlink aux factures d'abonnement déjà créées sans coût, pour corriger les marges et bénéfices passés.</small></div><button class="btn sm sec" data-act="plansfix">Recalculer</button></div></div>
      <p class="mut" style="font-size:13px">Prix client : proposé quand on choisit ce type d'abonnement. Coût Starlink : ce que CISPOLstore reverse à Starlink ; la marge (prix − coût) est comptée dans les bénéfices.</p>`);
  };
  document.addEventListener('change', e => {
    const el = e.target, n = el.dataset && el.dataset.plan; if (!n || !/^pl_[pc]\d+$/.test(el.id)) return;
    const i = el.id.slice(4), S = App.db.settings; S.plans = { ...(S.plans || {}) };
    const price = +$('pl_p' + i).value || 0, cost = +$('pl_c' + i).value || 0;
    if (price < 0 || cost < 0) return;
    S.plans[n] = { price, cost }; App.save();
    const m = price - cost; $('pl_m' + i).textContent = cost > 0 && price > 0 ? 'Marge : ' + App.fmt(m) : 'À renseigner'; $('pl_m' + i).className = m > 0 ? 'ok' : '';
    App.toast('Tarif enregistré');
  });
  App.actions.plansfix = () => {
    const n = App.db.invoices.reduce((a, i) => a + App.costSubLines(i, true), 0);
    if (!n) return App.toast("Rien à corriger (renseignez d'abord les coûts)");
    if (!App.confirm(`${n} ligne(s) d'abonnement vont recevoir leur coût Starlink. Continuer ?`)) return;
    App.db.invoices.forEach(i => App.costSubLines(i)); App.save(); App.toast(n + ' ligne(s) corrigée(s)'); App.refresh();
  };
  // choosing a plan fills the price when it is still empty
  document.addEventListener('change', e => {
    const id = e.target.id, map = { f_plan: 'f_price', qc_plan: 'qc_price' }; if (!map[id]) return;
    const pr = $(map[id]), p = App.planInfo(e.target.value); if (pr && p && +p.price > 0 && !pr.value) pr.value = p.price;
  });
})();
