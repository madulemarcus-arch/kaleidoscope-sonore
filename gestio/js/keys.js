// Keyboard shortcuts for computers (ignored while typing, in a form or on the lock screen)
(() => {
  const App = window.App;
  const NAV = { h: ['home', 'Accueil'], c: ['clients', 'Clients'], a: ['subs', 'Abonnements'], s: ['stock', 'Stock'], f: ['invoices', 'Factures'], p: ['payments', 'Paiements'], b: ['finance', 'Finance'], i: ['impayes', 'Impayés'] };
  const ACT = { f: ['q_invoice', 'Nouvelle facture'], c: ['q_client', 'Nouveau client'], p: ['newpay', 'Encaisser un paiement'], r: ['q_renew', 'Renouveler un abonnement'], n: ['quick', 'Menu d\'action rapide'] };
  App.shortcutsHelp = () => App.modal('⌨ Raccourcis clavier', `<div class="keys">
    <h3>Partout</h3><div><kbd>/</kbd> ou <kbd>Ctrl</kbd>+<kbd>K</kbd><span>Rechercher</span></div><div><kbd>?</kbd><span>Afficher cette aide</span></div><div><kbd>Échap</kbd><span>Fermer la fenêtre</span></div>
    <h3>Créer</h3>${Object.entries(ACT).filter(([, [a]]) => App.guard(a)).map(([k, [, t]]) => `<div><kbd>${k.toUpperCase()}</kbd><span>${t}</span></div>`).join('')}
    <h3>Aller à : G puis une lettre</h3>${Object.entries(NAV).filter(([, [v]]) => App.canView(v)).map(([k, [, t]]) => `<div><kbd>G</kbd><kbd>${k.toUpperCase()}</kbd><span>${t}</span></div>`).join('')}</div>`, () => {}, 'Fermer');
  // swipe actions show only icons on a computer: give them a tooltip
  document.addEventListener('mouseover', e => { const b = e.target.closest && e.target.closest('.sw:not([title])'); if (b) b.title = b.textContent.trim(); });
  let chord = 0;
  document.addEventListener('keydown', e => {
    const t = e.target, typing = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
    if (typing || document.querySelector('dialog[open]') || !document.getElementById('lock').hidden) return;
    const k = e.key;
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'k') { e.preventDefault(); App.search(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (chord && Date.now() < chord) { chord = 0; const n = NAV[k.toLowerCase()]; if (n && App.canView(n[0])) { e.preventDefault(); App.go(n[0]); } return; }
    if (k === '/') { e.preventDefault(); App.search(); }
    else if (k === '?') { e.preventDefault(); App.shortcutsHelp(); }
    else if (k.toLowerCase() === 'g') chord = Date.now() + 1200;
    else { const a = ACT[k.toLowerCase()]; if (a && App.guard(a[0]) && App.actions[a[0]]) { e.preventDefault(); App.actions[a[0]]({}); } }
  });
})();
