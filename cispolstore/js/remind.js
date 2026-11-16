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
    merci: "Bonjour {prenom} 😊 Merci d'avoir choisi {entreprise} ! Votre service est en place : profitez-en pleinement. Et si vous avez la moindre question ou le moindre souci, écrivez-nous, nous sommes là pour vous. À très bientôt ! {entreprise}",
    merci_achat: "Bonjour {prenom} 😊 Merci pour votre achat chez {entreprise} ! Nous espérons que votre matériel vous donnera entière satisfaction. Si vous avez la moindre question ou le moindre souci, écrivez-nous : nous sommes là pour vous. À très bientôt ! {entreprise}",
    merci_install: "Bonjour {prenom} 😊 Merci d'avoir confié votre installation à {entreprise} ! Elle est terminée : profitez-en pleinement. Pour tout réglage ou toute question, écrivez-nous, nous sommes là pour vous. À très bientôt ! {entreprise}"
  };
  const LABEL = { actif: 'Abonnement bientôt expiré', sursis: 'Période de sursis', inactif: 'Abonnement inactif', penalite: 'Pénalité à payer', impaye: 'Facture impayée', merci: 'Remerciement · service complet (kit + installation + abonnement)', merci_achat: 'Remerciement · achat de matériel', merci_install: 'Remerciement · installation' };
  const tpl = k => (App.db.settings.msgs && App.db.settings.msgs[k]) || DEFAULT[k];
  // the thank-you depends on what the client got: a purchase (matériel), an installation, or the complete service (managed client)
  const KINDS = { achat: ['merci_achat', '🛒 Achat', 'Merci pour votre achat'], install: ['merci_install', '🔧 Installation', 'Installation terminée'], complet: ['merci', '📡 Service complet', 'Fin de service'] };
  App.thanksKind = c => c.type === 'mat' ? 'achat' : c.type === 'install' ? 'install' : 'complet';
  App.thanksKindName = c => KINDS[App.thanksKind(c)][1];

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
  // brand logos (simple-icons, CC0) for the settings and the printed document; WhatsApp texts use the matching emoji instead (a text message holds no image)
  const ICON = {
    facebook: ['0866FF', 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z'],
    instagram: ['E4405F', 'M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077'],
    tiktok: ['000000', 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z'],
    youtube: ['FF0000', 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z'],
    whatsapp: ['25D366', 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z'],
    linkedin: ['0A66C2', 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'],
    x: ['000000', 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z'],
    site: ['1F6FB5', 'M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.92 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2 0 .68.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.987 7.987 0 0 1 5.08 16zm2.95-8H5.08a7.987 7.987 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2 0-.68.07-1.35.16-2h4.68c.09.65.16 1.32.16 2 0 .68-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2 0-.68-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z']
  };
  const EMOJI = { facebook: '📘', instagram: '📸', tiktok: '🎵', youtube: '▶️', whatsapp: '💬', linkedin: '💼', x: '✖️', site: '🌐' };
  const netLogo = (k, px = 16) => ICON[k] ? `<svg viewBox="0 0 24 24" width="${px}" height="${px}" fill="#${ICON[k][0]}" aria-hidden="true" style="vertical-align:-3px;margin-right:6px;flex:none"><path d="${ICON[k][1]}"/></svg>` : '';
  const netUrl = (k, v) => { v = String(v || '').trim(); if (!v) return ''; if (/^https?:\/\//i.test(v)) return v; if (k === 'whatsapp' && /^[+\d][\d\s().-]{6,}$/.test(v)) return 'https://wa.me/' + v.replace(/\D/g, ''); return 'https://' + v.replace(/^\/+/, ''); };
  App.socialLinks = () => { const s = App.db.settings.company.socials || {}; return NETS.map(([k, label]) => [label.replace(/ \(.*\)$/, ''), netUrl(k, s[k]), k]).filter(x => x[1]); };
  App.thanksText = (c, kind) => { const co = App.db.settings.company, v = { prenom: '*_' + App.cname(c) + '_*', nom: '*_' + App.cname(c) + '_*', entreprise: co.name }, links = App.socialLinks();
    return tpl(KINDS[kind || App.thanksKind(c)][0]).replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m) + (links.length ? '\n\nFaites un tour sur nos réseaux :\n' + links.map(([n, u, k]) => `${EMOJI[k]} ${n} : ${u}`).join('\n') : ''); };
  // the message as HTML for the previews: the WhatsApp *_name_* markup shown as bold italic
  App.thanksHtml = (c, kind) => esc(App.thanksText(c, kind)).replace(/\*_(.+?)_\*/g, '<b><i>$1</i></b>');
  const THX_DAYS = 30;
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
  App.thanksDoc = (c, logo, stamp) => { const K = App.docKit, e = esc, co = App.db.settings.company, links = App.socialLinks(), nm = App.cname(c);
    const NAVY = '#12365d', ORG = '#d5522f', GOLD = '#e5b044', big = `<b><i style="font-size:17pt;color:${NAVY};letter-spacing:.3px">${e(nm)}</i></b>`;
    const body = noEmoji(tpl(KINDS[App.thanksKind(c)][0]).replace(/\{(\w+)\}/g, (m, k) => ({ prenom: nm, nom: nm, entreprise: co.name })[k] ?? m));
    const corner = pos => `<span style="position:absolute;font-size:22px;color:${GOLD};${pos}">❦</span>`;
    return `<div class="paper" data-fit="1" style="position:relative;background:#fffdf8;border:2px solid ${GOLD};outline:6px solid #fffdf8;outline-offset:-12px;padding:20px 32px;box-sizing:border-box">
      ${corner('top:6px;left:10px')}${corner('top:6px;right:10px')}${corner('bottom:6px;left:10px')}${corner('bottom:6px;right:10px')}
      <img class="wm" src="${e(logo || 'logo.png')}" alt="" style="position:absolute;left:50%;top:54%;transform:translate(-50%,-50%);width:62%;max-width:480px;opacity:.07">
      ${K.head(co, logo, true)}
      ${K.boxes('REMERCIEMENT', [['Date', App.fdate(App.today())], ['Objet', KINDS[App.thanksKind(c)][2]]], 'CLIENT', [['Nom', `<b><i>${e(nm)}</i></b>`], ['Code Client', e(c.code || '—')], c.phone && ['Téléphone', e(c.phone)]])}
      <div style="text-align:center;margin:0;color:${GOLD};letter-spacing:10px;font-size:12px;line-height:1.4">✦ ✦ ✦</div>
      <div style="text-align:center;font:italic 700 38px/1.1 'Brush Script MT','Segoe Script','Snell Roundhand',cursive,Georgia,serif;color:${ORG}">Merci&nbsp;!</div>
      <div style="margin:4px auto 8px;width:62%;height:2px;background:linear-gradient(90deg,transparent,${GOLD},${ORG},${GOLD},transparent)"></div>
      <div class="rc" style="text-align:justify;line-height:1.6;white-space:pre-line;font-size:12pt;border-left:none;background:transparent;padding:2px 8px;margin:0 0 6px;position:relative">${e(body).split(e(nm)).join(big)}</div>
      <div style="text-align:center;color:${GOLD};font-size:15px;line-height:1.2;margin:0 0 6px">❧ ❦ ☙</div>
      ${links.length ? `<div class="rc" style="margin:0 0 8px;padding:8px 12px;font-size:10.5pt;line-height:1.4;position:relative"><b>Faites un tour sur nos réseaux :</b><div style="display:flex;flex-wrap:wrap;margin-top:4px">${links.map(([n, u, k]) => `<div style="width:50%;box-sizing:border-box;padding:2px 6px 2px 0;word-break:break-all">${netLogo(k, 15)}<b>${e(n)}</b> : ${e(u.replace(/^https?:\/\//, ''))}</div>`).join('')}</div></div>` : ''}
      <table class="sg"><tr><td></td><td class="gp"></td><td class="s2"><img src="${e(stamp || 'stamp.png')}" alt=""></td></tr><tr><td></td><td class="gp"></td><td class="ln">${e(co.name)}</td></tr></table>${K.foot(stamp, true)}</div>`; };
  const thxName = c => App.docName(App.cname(c), 'Remerciement');
  App.actions.thx_print = async d => { const c = App.client(d.id); if (!c) return; App.thanksMark(c); App.save(); App.close(); App.docKit.print(thxName(c), App.thanksDoc(c, await App.docKit.logoData(), await App.docKit.stampData())); App.refresh(); };
  App.actions.thx_pdf = async d => { const c = App.client(d.id); if (!c) return; App.thanksMark(c); App.save(); App.close(); await App.sharePdf(thxName(c) + '.pdf', App.thanksDoc(c, await App.docKit.logoData(), await App.docKit.stampData())); App.refresh(); };

  // preview of the message with the client's name, then send
  App.thanksPreview = c => App.modal('Message de fin de service', `<div class="card"><div class="spread"><b>${esc(App.cname(c))}</b><span class="pill">💛 ${esc(App.thanksKindName(c))}</span></div><div class="mut">${esc(c.phone || 'sans numéro')}</div>
      <div style="white-space:pre-wrap;background:var(--card2,#f3f5f8);border-radius:12px;padding:12px;margin-top:8px">${App.thanksHtml(c)}</div></div>
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
    App.thanksDue().forEach(x => out.push({ kind: 'thx', icon: '💛', label: 'Remerciement · ' + App.thanksKindName(x.c).replace(/^\S+ /, ''), c: x.c, last: '', tone: 'ok', rank: 50, sub: x.why + ' · ' + App.fdate(x.date), text: () => App.thanksText(x.c), mark: () => App.thanksMark(x.c) }));
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
        ${rst.f === 'thx' ? '<div class="bar" style="margin:0 0 10px"><button class="btn" data-act="thx_pick">💛 Remercier un autre client…</button></div>' : ''}
        <p class="mut" style="font-size:13px;margin:0 0 10px">Un message prêt s'ouvre dans WhatsApp : il ne reste qu'à l'envoyer. Les clients relancés depuis moins de 2 jours sont mis de côté.</p>
        ${shown.length ? `<div class="list">${shown.map((it, i) => { const k = cache.indexOf(it), rec = isRecent(it);
          return `<div class="item" style="${rec ? 'opacity:.6' : ''}"><span class="avatar ${it.tone || ''}">${it.icon}</span><div class="grow" data-act="go" data-v="client" data-id="${it.c.id}" style="cursor:pointer"><b>${esc(App.cname(it.c))}</b><small>${esc(it.label)} · ${esc(it.sub)}${it.last ? ' · relancé le ' + App.fdate(it.last) : ''}</small></div>${it.amount ? `<div class="end"><b>${it.amount}</b></div>` : ''}${it.c.phone ? `<button class="btn sm" data-act="rel_one" data-k="${k}" aria-label="WhatsApp">💬</button>` : '<span class="mut" style="font-size:12px">sans n°</span>'}${it.kind === 'thx' ? `<button class="btn sm sec" data-act="thx_skip" data-id="${it.c.id}" aria-label="Pas de message" title="Pas de message pour ce client">✖</button>` : ''}</div>`; }).join('')}</div>` : '<div class="empty big"><div class="ei">🎉</div><b>Rien à relancer</b><p class="mut">Tous vos clients sont à jour.</p></div>'}`
    };
  };
  App.actions.rel_f = d => { rst.f = d.f; App.refresh(); };
  App.actions.thx_go = () => { rst.f = 'thx'; App.go('relances'); };
  // choose any client (with a phone) to send the end-of-service message to, whenever the user wants
  App.actions.thx_pick = () => {
    const l = App.db.clients.filter(c => c.phone).sort((a, b) => App.cname(a).localeCompare(App.cname(b)));
    App.modal('Remercier un client', `<input id="thx_q" placeholder="Chercher un client…" autocomplete="off" style="margin-bottom:8px"><div class="list" id="thx_l" style="max-height:50vh;overflow:auto">${l.length ? l.map(c => `<button type="button" class="item" data-act="thx_send" data-id="${c.id}" data-n="${esc(App.cname(c).toLowerCase())}"><span class="avatar">${esc(App.initials(c))}</span><div class="grow"><b>${esc(App.cname(c))}</b><small>${esc(c.phone)}${c.thanksAt ? ' · remercié le ' + App.fdate(c.thanksAt) : ''}</small></div><span class="mut">💛</span></button>`).join('') : '<div class="empty">Aucun client avec un numéro de téléphone.</div>'}</div>`);
    const q = $('thx_q'); if (q) q.oninput = () => { const v = q.value.trim().toLowerCase(); document.querySelectorAll('#thx_l [data-n]').forEach(b => { b.hidden = !!v && !b.dataset.n.includes(v); }); };
  };
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
      ${NETS.map(([k, label, ph]) => F.text('soc_' + k, netLogo(k, 18) + label, (App.db.settings.company.socials || {})[k] || '', `placeholder="${ph}" autocapitalize="off" autocomplete="off" inputmode="url"`)).join('')}
      <h3 style="margin:12px 0 4px;font-size:15px">Aperçu des remerciements</h3><div id="thx_prev" class="card" style="white-space:pre-wrap;margin:0 0 8px"></div>
      <div class="bar"><button class="btn sm sec" data-act="msgreset">Remettre les messages d'origine</button> <button class="btn sm sec" data-act="go" data-v="rappels">📲 Voir les rappels</button></div></div>`);
  // live preview of the thank-you with a real client's name (first client with a phone, else a sample)
  const prev = () => { const el = $('thx_prev'); if (!el) return; const real = App.db.clients.find(c => c.phone) || App.db.clients[0], c = real || { first: 'Awa', last: 'Diallo', name: 'Awa Diallo' };
    el.innerHTML = `<small class="mut">Aperçu avec ${esc(App.cname(c))}${real ? '' : ' (exemple)'}</small>` + Object.keys(KINDS).map(k => `<div style="margin-top:8px"><b>${KINDS[k][1]}</b><br>${App.thanksHtml(c, k)}</div>`).join(''); };
  const socSet = (e, save) => { const k = String(e.target.id || '').slice(4), C = App.db.settings.company; C.socials = { ...(C.socials || {}), [k]: e.target.value.trim() }; if (save) { App.save(); App.toast('Lien enregistré'); } prev(); };
  document.addEventListener('input', e => { const id = e.target.id || ''; if (id.startsWith('soc_')) socSet(e, false); else if (/^m_merci/.test(id)) { const S = App.db.settings; S.msgs = { ...(S.msgs || {}), [id.slice(2)]: e.target.value }; prev(); } });
  new MutationObserver(() => { if ($('thx_prev') && !$('thx_prev').dataset.ok) { $('thx_prev').dataset.ok = '1'; prev(); } }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('change', e => {
    if (String(e.target.id || '').startsWith('soc_')) return socSet(e, true);
    const k = (e.target.id || '').startsWith('m_') && e.target.id.slice(2); if (!k || !(k in DEFAULT)) return;
    const S = App.db.settings; S.msgs = { ...(S.msgs || {}), [k]: e.target.value.trim() || DEFAULT[k] }; App.save(); App.toast('Message enregistré');
  });
  App.actions.msgreset = () => { if (!App.confirm("Remettre les messages d'origine ?")) return; delete App.db.settings.msgs; App.save(); App.refresh(); App.toast('Messages réinitialisés'); };
})();
