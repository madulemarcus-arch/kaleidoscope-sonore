// WhatsApp reminders: editable message templates, and a "to remind" list (the user taps to send each one).
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const DEFAULT = {
    actif: 'Bonjour {prenom}, votre abonnement Starlink arrive à expiration le {fin} (dans {jours} jour(s)). Écrivez-nous pour le renouveler. Merci ! {entreprise}',
    sursis: "Bonjour {prenom}, votre abonnement Starlink a expiré le {fin}. Vous êtes en période de sursis jusqu'au {sursis}. Pensez à le renouveler. {entreprise}",
    inactif: 'Bonjour {prenom}, votre abonnement Starlink est inactif depuis le {sursis}. Contactez-nous pour le réactiver. {entreprise}',
    impaye: 'Bonjour {prenom}, il reste {solde} à régler sur la facture {numero} du {date}. Merci de passer au règlement. {entreprise}'
  };
  const LABEL = { actif: 'Abonnement bientôt expiré', sursis: 'Période de sursis', inactif: 'Abonnement inactif', impaye: 'Facture impayée' };
  const tpl = k => (App.db.settings.msgs && App.db.settings.msgs[k]) || DEFAULT[k];

  App.reminderText = c => {
    const s = App.sub(c), co = App.db.settings.company, n = c.first || App.cname(c);
    if (!s) return `Bonjour ${n}, ici ${co.name}.`;
    const v = { prenom: n, nom: App.cname(c), fin: App.fdate(s.end), sursis: App.fdate(s.gEnd), jours: Math.max(0, s.status === 'actif' ? s.left : 0), entreprise: co.name, acc: c.acc || '' };
    return tpl(s.status).replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m);
  };

  App.unpaidText = (i, c) => {
    const co = App.db.settings.company, v = { prenom: (c && c.first) || App.cname(c), nom: App.cname(c), solde: App.fmt(App.invDue(i), i.currency), numero: i.number, date: App.fdate(i.date), entreprise: co.name };
    return tpl('impaye').replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m);
  };

  // ---------- List of clients to remind ----------
  const recent = c => c.lastRemind && App.diff(c.lastRemind, App.today()) <= 2;
  App.views.rappels = () => {
    const rank = x => x.s.status === 'actif' ? x.s.left : x.s.status === 'sursis' ? x.s.left - 100 : -200 + x.s.left;
    const l = App.db.clients.map(c => ({ c, s: App.sub(c) })).filter(x => x.s && (x.s.status === 'actif' ? x.s.left <= 7 : x.s.status === 'sursis' || x.s.left >= -30)).sort((a, b) => rank(a) - rank(b));
    const todo = l.filter(x => !recent(x.c)).length;
    return {
      title: 'Rappels', back: 'subs', nav: 'more',
      html: `<p class="mut">Touchez « WhatsApp » : le message s'ouvre déjà écrit, il ne reste qu'à l'envoyer. <b>${todo}</b> client(s) à relancer.</p>
        ${l.length ? `<div class="list">${l.map(({ c, s }) => {
          const done = recent(c), when = s.status === 'actif' ? (s.left === 0 ? "Fin aujourd'hui" : `Fin dans ${s.left} j`) : s.status === 'sursis' ? `Sursis jusqu'au ${App.fdate(s.gEnd)}` : `Inactif depuis le ${App.fdate(s.gEnd)}`;
          return `<div class="item" style="${done ? 'opacity:.6' : ''}"><span class="avatar ${{ actif: 'ok', sursis: 'warn', inactif: 'bad' }[s.status]}">${esc(App.initials(c))}</span><div class="grow"><b>${esc(App.cname(c))}</b><small>${when}${c.lastRemind ? ' · rappelé le ' + App.fdate(c.lastRemind) : ''}</small></div>${c.phone ? `<button class="btn sm${done ? ' sec' : ''}" data-act="remind" data-id="${c.id}">${done ? '✓ ' : ''}💬 WhatsApp</button>` : '<span class="mut">pas de n°</span>'}</div>`;
        }).join('')}</div>` : '<div class="empty">Aucun client à relancer pour le moment.</div>'}
        <div class="bar" style="margin-top:12px"><button class="btn sm sec" data-act="go" data-v="settings">✏️ Modifier les messages (Paramètres)</button></div>`
    };
  };
  App.actions.remind = d => {
    const c = App.client(d.id), url = c && App.waLink(c); if (!url) return App.toast('Pas de numéro de téléphone');
    window.open(url, '_blank', 'noopener');
    c.lastRemind = App.today(); App.log(c.id, 'Rappel WhatsApp ouvert'); App.save(); App.refresh();
  };

  // ---------- Settings card: message templates ----------
  App.remindCard = () => `<h2 class="sec">Messages de rappel WhatsApp</h2><div class="card">
      <p class="mut" style="font-size:13px;margin:0 0 6px">Mots remplacés automatiquement : {prenom} {nom} {fin} {sursis} {jours} {entreprise} {acc} · impayés : {solde} {numero} {date}</p>
      ${Object.keys(DEFAULT).map(k => F.area('m_' + k, LABEL[k], tpl(k), 'rows="3"')).join('')}
      <div class="bar"><button class="btn sm sec" data-act="msgreset">Remettre les messages d'origine</button> <button class="btn sm sec" data-act="go" data-v="rappels">📲 Voir les rappels</button></div></div>`;
  document.addEventListener('change', e => {
    const k = (e.target.id || '').startsWith('m_') && e.target.id.slice(2); if (!k || !(k in DEFAULT)) return;
    const S = App.db.settings; S.msgs = { ...(S.msgs || {}), [k]: e.target.value.trim() || DEFAULT[k] }; App.save(); App.toast('Message enregistré');
  });
  App.actions.msgreset = () => { if (!App.confirm("Remettre les messages d'origine ?")) return; delete App.db.settings.msgs; App.save(); App.refresh(); App.toast('Messages réinitialisés'); };
})();
