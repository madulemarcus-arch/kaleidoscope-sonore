// Profile limits (administrator sets them in Profils): hidden client phone numbers, and a ceiling per invoice / payment above which the manager's PIN is asked.
// Like the profiles themselves, this controls the interface: it is not encryption of the data.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc;
  const me = () => (App.multi && App.multi() ? App.user : null);
  const limited = () => { const u = me(); return !!u && u.role !== 'admin'; };

  // ---------- hidden phone numbers ----------
  App.hidePhones = () => limited() && !!me().hidePhone;
  const MASK = '••• ••• •••', PHS = '(\\+\\d[\\d .\\-()]{7,}\\d|\\b0\\d[\\d .\\-]{7,}\\d)', PT = new RegExp(PHS), PH = new RegExp(PHS, 'g');
  const wa0 = App.waUrl; if (wa0) App.waUrl = (phone, msg) => wa0(App.hidePhones() ? '' : phone, msg);   // the message opens in WhatsApp without the number
  let busy = false;
  const mask = root => {
    if (!App.hidePhones() || busy || !root || root.nodeType !== 1) return; busy = true;
    try {
      root.querySelectorAll('a[href^="tel:"]').forEach(a => { if (/\d{6,}/.test(a.textContent.replace(/\D/g, '')) && !/appeler/i.test(a.textContent)) { const s = document.createElement('span'); s.className = 'mut'; s.textContent = MASK; a.replaceWith(s); } else a.remove(); });
      root.querySelectorAll('a[href*="wa.me/"]').forEach(a => { if (/wa\.me\/\d/.test(a.getAttribute('href') || '')) a.remove(); });
      root.querySelectorAll('input[type=tel]').forEach(inp => { if (!/phone|tel|whats/i.test(inp.id) || inp.dataset.orig !== undefined || !PT.test(inp.value)) return; inp.dataset.orig = inp.value; inp.value = ''; inp.placeholder = 'Numéro masqué : laisser vide = inchangé'; });
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => /^(SCRIPT|STYLE|TEXTAREA|INPUT)$/.test(n.parentNode.nodeName) ? NodeFilter.FILTER_REJECT : PT.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT }), hits = [];
      while (w.nextNode()) hits.push(w.currentNode); hits.forEach(n => { n.nodeValue = n.nodeValue.replace(PH, MASK); });
    } finally { busy = false; }
  };
  // a hidden number that was left empty in a form keeps its value (the field is restored just before the form runs)
  const dlg = $('dlg'); if (dlg) dlg.addEventListener('submit', () => { dlg.querySelectorAll('input[data-orig]').forEach(i => { if (i.value === '') i.value = i.dataset.orig; }); }, true);
  let pend = false;
  const sweep = () => { if (pend || !App.hidePhones()) return; pend = true; requestAnimationFrame(() => { pend = false; mask(document.body); }); };
  new MutationObserver(sweep).observe(document.body, { childList: true, subtree: true, characterData: true });

  // ---------- ceiling per invoice / payment: the manager's PIN is the approval ----------
  const FAILK = 'cispol.apfail', tm = s => s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`;
  const fGet = () => { try { return JSON.parse(localStorage.getItem(FAILK)) || { n: 0, until: 0 }; } catch (e) { return { n: 0, until: 0 }; } };
  const fSet = o => { try { if (o) localStorage.setItem(FAILK, JSON.stringify(o)); else localStorage.removeItem(FAILK); } catch (e) {} };
  const cap = () => limited() && +me().cap > 0 ? +me().cap : 0;
  let okUntil = 0;
  App.capGate = (usd, what, retry) => {
    const c = cap(); if (!c || !(usd > c + 0.004)) return true;
    if (Date.now() < okUntil) { okUntil = 0; return true; }       // one approval covers one operation (valid 2 minutes)
    ask(what, usd, c, retry); return false;
  };
  const ask = (what, usd, c, retry) => {
    let d = $('apdlg'); if (!d) { d = document.createElement('dialog'); d.id = 'apdlg'; document.body.appendChild(d); }
    d.innerHTML = `<form method="dialog"><h3>Accord du gérant</h3><p>${esc(what.charAt(0).toUpperCase() + what.slice(1))} de <b>${esc(App.fmt(usd))}</b> : votre plafond est de <b>${esc(App.fmt(c))}</b>. Le gérant (administrateur) doit saisir son code PIN pour autoriser.</p>
      <div class="fld"><label class="l" for="ap_pin">Code PIN du gérant</label><input id="ap_pin" type="password" inputmode="numeric" maxlength="6" autocomplete="off"></div><p class="warn" id="ap_msg"></p>
      <div class="end"><button type="button" class="btn sec" id="ap_no">Annuler</button><button class="btn" id="ap_ok">Autoriser</button></div></form>`;
    const msg = t => { $('ap_msg').textContent = t; };
    $('ap_no').onclick = () => d.close();
    d.querySelector('form').onsubmit = async e => { e.preventDefault();
      const f = fGet(), left = Math.ceil((f.until - Date.now()) / 1000); if (left > 0) return msg(`Trop d'essais : patientez ${tm(left)}`);
      const pin = $('ap_pin').value; if (!pin) return; let who = null;
      for (const u of App.users()) if (u.role === 'admin' && u.active !== false && u.pin && await App.hash(u.pin.salt + pin) === u.pin.hash) { who = u; break; }
      if (!who) { const n = f.n + 1; fSet({ n, until: n >= 3 ? Date.now() + Math.min(3600, 30 * 2 ** (n - 3)) * 1000 : 0 }); if (App.secLog) App.secLog(`Code du gérant incorrect lors d'un accord de plafond (essai ${n})`, { fail: 1 }); $('ap_pin').value = ''; return msg(n < 3 ? `Code incorrect (${3 - n} essai(s) avant blocage)` : 'Code incorrect : blocage temporaire'); }
      fSet(null); okUntil = Date.now() + 120000; if (App.secLog) App.secLog(`a obtenu l'accord de ${who.name} pour ${what} de ${App.fmt(usd)} (plafond ${App.fmt(c)})`);
      d.close(); retry(); };
    d.showModal(); setTimeout(() => $('ap_pin') && $('ap_pin').focus(), 50);
  };
})();
