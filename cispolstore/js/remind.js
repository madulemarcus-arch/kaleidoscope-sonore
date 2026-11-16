// WhatsApp reminders: editable message templates, and a "to remind" list (the user taps to send each one).
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, F = App.f;
  const DEFAULT = {
    actif: 'Bonjour {prenom}, votre abonnement Starlink arrive à expiration le {fin} (dans {jours} jour(s)). Écrivez-nous pour le renouveler. Merci ! {entreprise}',
    sursis: "Bonjour {prenom}, votre abonnement Starlink a expiré le {fin}. Vous êtes en période de sursis jusqu'au {sursis}. Pensez à le renouveler. {entreprise}",
    inactif: 'Bonjour {prenom}, votre abonnement Starlink est inactif depuis le {sursis}. Contactez-nous pour le réactiver. {entreprise}',
    penalite: 'Bonjour {prenom}, une pénalité de {montant} ({motif}) est à régler pour votre abonnement Starlink. Merci de passer la régler. {entreprise}',
    impaye: 'Bonjour {prenom}, il reste {solde} à régler sur la facture {numero} du {date}. Merci de passer au règlement. {entreprise}',
    merci: "Bonjour {prenom} 😊 Merci d'avoir choisi {entreprise} ! Votre service est en place : profitez-en pleinement. Et si vous avez la moindre question ou le moindre souci, écrivez-nous, nous sommes là pour vous. À très bientôt ! {entreprise}"
  };
  const LABEL = { actif: 'Abonnement bientôt expiré', sursis: 'Période de sursis', inactif: 'Abonnement inactif', penalite: 'Pénalité à payer', impaye: 'Facture impayée', merci: 'Remerciement de fin de service' };
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

  // end-of-service thank-you: the client's latest finished service (installation done, delivery done, invoice fully paid) not yet followed by a thank-you
  // social networks: one field per network (Paramètres), filled in by hand; empty ones are left out
  const NETS = [['facebook', 'Facebook', 'https://facebook.com/votrepage'], ['instagram', 'Instagram', 'https://instagram.com/votrecompte'], ['tiktok', 'TikTok', 'https://tiktok.com/@votrecompte'], ['youtube', 'YouTube', 'https://youtube.com/@votrechaine'], ['whatsapp', 'WhatsApp (lien ou numéro)', '+243 8xx xxx xxx'], ['linkedin', 'LinkedIn', 'https://linkedin.com/company/votrepage'], ['x', 'X (Twitter)', 'https://x.com/votrecompte'], ['site', 'Site web', 'https://votresite.com']];
  const netUrl = (k, v) => { v = String(v || '').trim(); if (!v) return ''; if (/^https?:\/\//i.test(v)) return v; if (k === 'whatsapp' && /^[+\d][\d\s().-]{6,}$/.test(v)) return 'https://wa.me/' + v.replace(/\D/g, ''); return 'https://' + v.replace(/^\/+/, ''); };
  App.socialLinks = () => { const s = App.db.settings.company.socials || {}; return NETS.map(([k, label]) => [label.replace(/ \(.*\)$/, ''), netUrl(k, s[k])]).filter(x => x[1]); };
  App.thanksText = c => { const co = App.db.settings.company, v = { prenom: c.first || App.cname(c), nom: App.cname(c), entreprise: co.name }, links = App.socialLinks();
    return tpl('merci').replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m) + (links.length ? '\n\nFaites un tour sur nos réseaux :\n' + links.map(([n, u]) => `${n} : ${u}`).join('\n') : ''); };
  const THX_DAYS = 14;
  App.thanksDue = () => {
    const db = App.db, ev = {}, add = (cid, date, why) => { if (cid && date && (!ev[cid] || date > ev[cid].date)) ev[cid] = { date, why }; };
    (db.installs || []).forEach(x => add(x.clientId, x.date, x.kind || 'Installation'));
    (db.deliveries || []).filter(x => x.status === 'done').forEach(x => add(x.clientId, x.doneAt || x.date, 'Livraison faite'));
    db.invoices.filter(i => !i.pending && App.invStatus(i) === 'paid').forEach(i => { const last = db.payments.filter(p => p.invoiceId === i.id).map(p => p.date).sort().pop(); add(i.clientId, last || i.date, 'Facture ' + i.number + ' payée'); });
    return Object.keys(ev).map(id => ({ c: App.client(id), ...ev[id] })).filter(x => x.c && (!x.c.thanksAt || x.date > x.c.thanksAt) && App.diff(x.date, App.today()) <= THX_DAYS).sort((a, b) => b.date.localeCompare(a.date));
  };
  App.thanksCount = () => App.thanksDue().length;
  App.thanksMark = c => { c.thanksAt = App.today(); App.log(c.id, 'Message de fin de service envoyé'); };
  App.actions.thx_skip = d => { const c = App.client(d.id); if (!c) return; c.thanksAt = App.today(); App.log(c.id, 'Pas de message de fin de service'); App.save(); App.refresh(); App.toast('Marqué : pas de message'); };
  // the same thank-you as a printable / PDF document in the receipt model: letterhead, client box, text, social links, stamp
  const EMO = '[\\u{1F000}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\uFE0F]+', noEmoji = t => String(t).replace(new RegExp('(\\p{L})\\s*' + EMO + '\\s*(?=\\p{Lu})', 'gu'), '$1,\n\n').replace(new RegExp('\\s*' + EMO, 'gu'), '');
  App.thanksDoc = (c, logo, stamp) => { const K = App.docKit, e = esc, co = App.db.settings.company, links = App.socialLinks();
    const body = noEmoji(tpl('merci').replace(/\{(\w+)\}/g, (m, k) => ({ prenom: c.first || App.cname(c), nom: App.cname(c), entreprise: co.name })[k] ?? m));
    return `<div class="paper">${K.head(co, logo)}
      ${K.boxes('REMERCIEMENT', [['Date', App.fdate(App.today())], ['Objet', 'Fin de service']], 'CLIENT', [['Nom', `<b>${e(App.cname(c))}</b>`], ['Code Client', e(c.code || '—')], c.phone && ['Téléphone', e(c.phone)]])}
      <div class="rc" style="text-align:justify;line-height:1.6;white-space:pre-line">${e(body)}</div>
      ${links.length ? `<div class="rc" style="margin-top:6px"><b>Faites un tour sur nos réseaux :</b><br>${links.map(([n, u]) => `${e(n)} : ${e(u)}`).join('<br>')}</div>` : ''}
      <table class="sg"><tr><td></td><td class="gp"></td><td class="s2"><img src="${e(stamp || 'stamp.png')}" alt=""></td></tr><tr><td></td><td class="gp"></td><td class="ln">${e(co.name)}</td></tr></table>${K.foot(stamp, true)}</div>`; };
  const thxName = c => App.docName(App.cname(c), 'Remerciement');
  App.actions.thx_print = async d => { const c = App.client(d.id); if (!c) return; App.thanksMark(c); App.save(); App.close(); App.docKit.print(thxName(c), App.thanksDoc(c, await App.docKit.logoData(), await App.docKit.stampData())); App.refresh(); };
  App.actions.thx_pdf = async d => { const c = App.client(d.id); if (!c) return; App.thanksMark(c); App.save(); App.close(); await App.sharePdf(thxName(c) + '.pdf', App.thanksDoc(c, await App.docKit.logoData(), await App.docKit.stampData())); App.refresh(); };

  // preview of the message with the client's name, then send
  App.thanksPreview = c => App.modal('Message de fin de service', `<div class="card"><div class="spread"><b>${esc(App.cname(c))}</b><span class="pill">💛 Remerciement</span></div><div class="mut">${esc(c.phone || 'sans numéro')}</div>
      <div style="white-space:pre-wrap;background:var(--card2,#f3f5f8);border-radius:12px;padding:12px;margin-top:8px">${esc(App.thanksText(c))}</div></div>
      <div class="bar" style="margin-top:10px"><button type="button" class="btn" id="tsend"${c.phone ? '' : ' disabled'}>💬 Envoyer sur WhatsApp</button></div>
      <div class="bar"><button type="button" class="btn sec" data-act="thx_pdf" data-id="${c.id}">📤 Remerciement en PDF (avec entête et sceau)</button><button type="button" class="btn sec" data-act="thx_print" data-id="${c.id}">🖨️ Imprimer</button></div>${c.phone ? '' : '<p class="warn">Ce client n\'a pas de numéro de téléphone.</p>'}`);
  App.actions.thx_send = d => { const c = App.client(d.id); if (!c) return; if (!c.phone) return App.toast('Pas de numéro de téléphone'); App.thanksPreview(c);
    $('tsend').onclick = () => { window.open(App.waUrl(c.phone, App.thanksText(c)), '_blank', 'noopener'); App.thanksMark(c); App.save(); App.close(); App.refresh(); App.toast('Message de remerciement ouvert dans WhatsApp'); }; };

  App.penaltyText = (p, c) => {
    const co = App.db.settings.company, v = { prenom: (c && c.first) || App.cname(c), nom: App.cname(c), montant: App.fmt(p.amount, p.currency), motif: p.reason, date: App.fdate(p.date), entreprise: co.name };
    return tpl('penalite').replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m);
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

  // ---------- "Relances du jour": subscriptions, unpaid invoices and penalties in one place, with a guided series ----------
  const rst = { f: 'all' };
  const subDue = () => App.db.clients.map(c => ({ c, s: App.sub(c) })).filter(x => x.s && (x.s.status === 'actif' ? x.s.left <= 7 : x.s.status === 'sursis' || x.s.left >= -30));
  const dayOld = d => Math.max(0, App.diff(d, App.today()));
  // every thing to chase: { kind, key, c, title, sub, amount, tone, text(), mark(), last }
  App.relanceItems = () => {
    const out = [], db = App.db;
    subDue().forEach(({ c, s }) => out.push({ kind: 'sub', icon: '📡', label: 'Abonnement', c, last: c.lastRemind, tone: { actif: 'ok', sursis: 'warn', inactif: 'bad' }[s.status], rank: s.status === 'actif' ? s.left : s.status === 'sursis' ? s.left - 100 : -200 + s.left,
      sub: s.status === 'actif' ? (s.left === 0 ? "Fin aujourd'hui" : `Fin dans ${s.left} j`) : s.status === 'sursis' ? `En sursis jusqu'au ${App.fdate(s.gEnd)}` : `Inactif depuis le ${App.fdate(s.gEnd)}`, text: () => App.reminderText(c), mark: () => { c.lastRemind = App.today(); App.log(c.id, 'Rappel WhatsApp ouvert'); } }));
    db.invoices.filter(i => App.invDue(i) > 0.004).forEach(i => { const c = App.client(i.clientId); if (!c) return; const d = dayOld(i.date);
      out.push({ kind: 'inv', icon: '🧾', label: 'Impayé', c, last: i.lastRemind, tone: d > 60 ? 'bad' : d > 30 ? 'warn' : '', rank: -300 - d, sub: `${i.number} · ${d} j`, amount: App.fmt(App.invDue(i), i.currency), text: () => App.unpaidText(i, c), mark: () => { i.lastRemind = App.today(); App.log(c.id, 'Relance impayé ' + i.number); } }); });
    (db.penalties || []).filter(p => !p.paid).forEach(p => { const c = App.client(p.clientId); if (!c) return;
      out.push({ kind: 'pen', icon: '⚠️', label: 'Pénalité', c, last: p.lastRemind, tone: 'warn', rank: -250, sub: p.reason || 'Pénalité', amount: App.fmt(p.amount, p.currency), text: () => App.penaltyText(p, c), mark: () => { p.lastRemind = App.today(); App.log(c.id, 'Relance pénalité'); } }); });
    App.thanksDue().forEach(x => out.push({ kind: 'thx', icon: '💛', label: 'Fin de service', c: x.c, last: '', tone: 'ok', rank: 50, sub: x.why + ' · ' + App.fdate(x.date), text: () => App.thanksText(x.c), mark: () => App.thanksMark(x.c) }));
    return out.sort((a, b) => a.rank - b.rank);
  };
  const isRecent = it => it.last && App.diff(it.last, App.today()) <= 2;
  App.relanceCount = () => App.relanceItems().filter(it => it.kind !== 'thx' && it.c.phone && !isRecent(it)).length;
  let cache = [];
  const send = (it) => { window.open(App.waUrl(it.c.phone, it.text()), '_blank', 'noopener'); it.mark(); App.save(); };
  App.views.relances = () => {
    cache = App.relanceItems();
    const shown = cache.filter(it => rst.f === 'all' || it.kind === rst.f), todo = cache.filter(it => it.c.phone && !isRecent(it)), done = cache.filter(isRecent).length, nophone = cache.filter(it => !it.c.phone).length;
    const cnt = k => cache.filter(it => (k === 'all' || it.kind === k) && it.c.phone && !isRecent(it)).length;
    return {
      title: 'Relances du jour', sub: `${todo.length} à faire`, back: 'more', nav: 'more',
      html: `<section class="hero dhero"><div class="hero-top"><div><small>💬 À relancer aujourd'hui</small><div class="hero-num" data-count="${todo.length}" data-int="1">${todo.length}</div></div></div>
          <div class="cstats"><div><b>${done}</b><small>déjà relancé(s)</small></div><div class="${nophone ? 'bad' : ''}"><b>${nophone}</b><small>sans téléphone</small></div><div><b>${cache.length}</b><small>au total</small></div></div></section>
        ${todo.length ? `<div class="bar"><button class="btn" data-act="rel_series">💬 Tout relancer en série (${todo.length})</button></div>` : ''}
        <div class="chips">${[['all', 'Tout'], ['sub', '📡 Abonnements'], ['inv', '🧾 Impayés'], ['pen', '⚠️ Pénalités'], ['thx', '💛 Remerciements']].map(([k, t]) => `<button class="chip ${rst.f === k ? 'on' : ''}" data-act="rel_f" data-f="${k}">${t} (${cnt(k)})</button>`).join('')}</div>
        <p class="mut" style="font-size:13px;margin:0 0 10px">Un message prêt s'ouvre dans WhatsApp : il ne reste qu'à l'envoyer. Les clients relancés depuis moins de 2 jours sont mis de côté.</p>
        ${shown.length ? `<div class="list">${shown.map((it, i) => { const k = cache.indexOf(it), rec = isRecent(it);
          return `<div class="item" style="${rec ? 'opacity:.6' : ''}"><span class="avatar ${it.tone || ''}">${it.icon}</span><div class="grow" data-act="go" data-v="client" data-id="${it.c.id}" style="cursor:pointer"><b>${esc(App.cname(it.c))}</b><small>${esc(it.label)} · ${esc(it.sub)}${it.last ? ' · relancé le ' + App.fdate(it.last) : ''}</small></div>${it.amount ? `<div class="end"><b>${it.amount}</b></div>` : ''}${it.c.phone ? `<button class="btn sm" data-act="rel_one" data-k="${k}" aria-label="WhatsApp">💬</button>` : '<span class="mut" style="font-size:12px">sans n°</span>'}${it.kind === 'thx' ? `<button class="btn sm sec" data-act="thx_skip" data-id="${it.c.id}" aria-label="Pas de message" title="Pas de message pour ce client">✖</button>` : ''}</div>`; }).join('')}</div>` : '<div class="empty big"><div class="ei">🎉</div><b>Rien à relancer</b><p class="mut">Tous vos clients sont à jour.</p></div>'}`
    };
  };
  App.actions.rel_f = d => { rst.f = d.f; App.refresh(); };
  App.actions.thx_go = () => { rst.f = 'thx'; App.go('relances'); };
  App.actions.rel_one = d => { const it = cache[+d.k]; if (!it || !it.c.phone) return App.toast('Pas de numéro de téléphone'); if (it.kind === 'thx') return App.actions.thx_send({ id: it.c.id }); send(it); App.refresh(); };
  App.actions.rel_series = () => {
    const q = (cache.length ? cache : App.relanceItems()).filter(it => it.c.phone && !isRecent(it) && (rst.f === 'all' || it.kind === rst.f)); if (!q.length) return App.toast('Personne à relancer');
    let k = 0, sent = 0;
    const show = () => {
      if (k >= q.length) { App.modal('Relances terminées', `<p>✅ ${sent} relance(s) envoyée(s) sur ${q.length}.</p>`); App.refresh(); if (sent && App.celebrate) App.celebrate(); return; }
      const it = q[k], msg = it.text();
      App.modal(`Relance ${k + 1} / ${q.length}`, `<div class="card"><div class="spread"><b>${esc(App.cname(it.c))}</b><span class="pill">${it.icon} ${esc(it.label)}</span></div><div class="mut">${esc(it.c.phone)} · ${esc(it.sub)}</div>${it.amount ? `<div style="font-size:20px;font-weight:800;margin:6px 0">${it.amount}</div>` : ''}<pre style="white-space:pre-wrap;font:inherit;font-size:13px;margin:8px 0 0">${esc(msg)}</pre></div>
        <div class="bar" style="margin-top:10px"><button type="button" class="btn" id="rsend">💬 Envoyer sur WhatsApp</button><button type="button" class="btn sec" id="rskip">Passer</button></div>`);
      $('rsend').onclick = () => { send(it); sent++; k++; show(); };
      $('rskip').onclick = () => { k++; show(); };
    };
    show();
  };

  // ---------- Settings card: message templates ----------
  App.remindCard = () => App.fold('msgs', 'Messages de rappel WhatsApp', `<div class="card">
      <p class="mut" style="font-size:13px;margin:0 0 6px">Mots remplacés automatiquement : {prenom} {nom} {fin} {sursis} {jours} {entreprise} {acc} (le remerciement utilise {prenom} {nom} {entreprise}) · impayés : {solde} {numero} {date} · pénalités : {montant} {motif}</p>
      ${Object.keys(DEFAULT).map(k => F.area('m_' + k, LABEL[k], tpl(k), 'rows="3"')).join('')}
      <h3 style="margin:12px 0 2px;font-size:15px">Vos réseaux sociaux</h3><p class="mut" style="font-size:13px;margin:0 0 6px">Remplissez seulement ceux que vous avez : ils sont ajoutés à la fin du message de remerciement. Laissez vide pour ne pas l'afficher.</p>
      ${NETS.map(([k, label, ph]) => F.text('soc_' + k, label, (App.db.settings.company.socials || {})[k] || '', `placeholder="${ph}" autocapitalize="off" autocomplete="off" inputmode="url"`)).join('')}
      <h3 style="margin:12px 0 4px;font-size:15px">Aperçu du remerciement</h3><div id="thx_prev" class="card" style="white-space:pre-wrap;margin:0 0 8px"></div>
      <div class="bar"><button class="btn sm sec" data-act="msgreset">Remettre les messages d'origine</button> <button class="btn sm sec" data-act="go" data-v="rappels">📲 Voir les rappels</button></div></div>`);
  // live preview of the thank-you with a real client's name (first client with a phone, else a sample)
  const prev = () => { const el = $('thx_prev'); if (!el) return; const real = App.db.clients.find(c => c.phone) || App.db.clients[0], c = real || { first: 'Awa', last: 'Diallo', name: 'Awa Diallo' };
    el.innerHTML = `<small class="mut">Aperçu avec ${esc(App.cname(c))}${real ? '' : ' (exemple)'}</small><br>${esc(App.thanksText(c))}`; };
  const socSet = (e, save) => { const k = String(e.target.id || '').slice(4), C = App.db.settings.company; C.socials = { ...(C.socials || {}), [k]: e.target.value.trim() }; if (save) { App.save(); App.toast('Lien enregistré'); } prev(); };
  document.addEventListener('input', e => { const id = e.target.id || ''; if (id.startsWith('soc_')) socSet(e, false); else if (id === 'm_merci') { const S = App.db.settings; S.msgs = { ...(S.msgs || {}), merci: e.target.value }; prev(); } });
  new MutationObserver(() => { if ($('thx_prev') && !$('thx_prev').dataset.ok) { $('thx_prev').dataset.ok = '1'; prev(); } }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('change', e => {
    if (String(e.target.id || '').startsWith('soc_')) return socSet(e, true);
    const k = (e.target.id || '').startsWith('m_') && e.target.id.slice(2); if (!k || !(k in DEFAULT)) return;
    const S = App.db.settings; S.msgs = { ...(S.msgs || {}), [k]: e.target.value.trim() || DEFAULT[k] }; App.save(); App.toast('Message enregistré');
  });
  App.actions.msgreset = () => { if (!App.confirm("Remettre les messages d'origine ?")) return; delete App.db.settings.msgs; App.save(); App.refresh(); App.toast('Messages réinitialisés'); };
})();
