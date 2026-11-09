// Money: multi-currency formatting, quick rate, French amount in words.
(function () {
  const App = window.App;
  const CUR = { // code: [symbol, singular, plural, minor singular, minor plural, decimals]
    USD: ['$', 'dollar américain', 'dollars américains', 'cent', 'cents', 2], CDF: ['FC', 'franc congolais', 'francs congolais', 'centime', 'centimes', 0],
    EUR: ['€', 'euro', 'euros', 'centime', 'centimes', 2], XOF: ['F CFA', 'franc CFA', 'francs CFA', 'centime', 'centimes', 0],
    XAF: ['F CFA', 'franc CFA', 'francs CFA', 'centime', 'centimes', 0], MAD: ['DH', 'dirham', 'dirhams', 'centime', 'centimes', 2],
    GBP: ['£', 'livre sterling', 'livres sterling', 'penny', 'pence', 2], CAD: ['$ CA', 'dollar canadien', 'dollars canadiens', 'cent', 'cents', 2],
    RWF: ['FRw', 'franc rwandais', 'francs rwandais', 'centime', 'centimes', 0], BIF: ['FBu', 'franc burundais', 'francs burundais', 'centime', 'centimes', 0]
  };
  const M = App.money = {};
  M.CODES = Object.keys(CUR);
  M.info = c => CUR[c] || [c, c, c, 'centime', 'centimes', 2];
  M.decimals = c => M.info(c)[5];
  M.round = (n, c) => { const f = Math.pow(10, M.decimals(c)); return Math.round((+n || 0) * f + (n < 0 ? -1e-9 : 1e-9)) / f; };
  // "1 234,50 $" — a non-breaking space groups thousands (stays on one line in print)
  M.fmt = (n, c) => {
    c = c || App.db.settings.currency; const d = M.decimals(c), v = M.round(n, c), s = Math.abs(v).toFixed(d), [i, f] = s.split('.');
    return (v < 0 ? '-' : '') + i.replace(/\B(?=(\d{3})+$)/g, ' ') + (f ? ',' + f : '') + ' ' + M.info(c)[0];
  };
  // Rate is "1 main = rate × secondary". Each document stores its own rate (rate field).
  M.rate = () => +App.db.settings.rate || 1;
  M.convert = (n, from, to, rate) => {
    const s = App.db.settings, r = rate || M.rate();
    if (from === to) return n;
    if (from === s.currency && to === s.cur2) return M.round(n * r, to);
    if (from === s.cur2 && to === s.currency) return M.round(n / r, to);
    return n;
  };
  M.main = n => M.fmt(n, App.db.settings.currency);
  M.second = (n, rate) => M.fmt(M.convert(n, App.db.settings.currency, App.db.settings.cur2, rate), App.db.settings.cur2);
  M.setRate = r => { r = +r; if (!(r > 0)) return false; App.db.settings.rate = r; App.save(); App.emit('rate'); return true; };

  // ----- French number to words -----
  const U = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
  const T = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'septante', 'quatre-vingt', 'nonante'];
  // Belgian / Congolese forms by default (septante 70, nonante 90, quatre-vingts 80); settings.words = 'fr' gives soixante-dix / quatre-vingt-dix
  const below100 = (n, final) => {
    if (n < 20) return U[n];
    const t = Math.floor(n / 10), u = n % 10, fr = App.db.settings.words === 'fr';
    if (fr && (t === 7 || t === 9)) { const b = t === 7 ? 'soixante' : 'quatre-vingt', r = 10 + u; return b + (t === 7 && r === 11 ? ' et ' : '-') + U[r]; }
    if (t === 8) return u ? 'quatre-vingt-' + U[u] : 'quatre-vingt' + (final ? 's' : '');
    return T[t] + (u === 1 ? ' et un' : u ? '-' + U[u] : '');
  };
  const below1000 = (n, final) => {
    const h = Math.floor(n / 100), r = n % 100; let s = '';
    if (h) s = (h === 1 ? 'cent' : U[h] + ' cent') + (!r && h > 1 && final ? 's' : '');
    if (r) s += (s ? ' ' : '') + below100(r, final);
    return s;
  };
  M.words = n => {
    n = Math.floor(Math.abs(+n) || 0); if (n === 0) return 'zéro';
    const scales = [[1e9, 'milliard'], [1e6, 'million'], [1e3, 'mille']]; let s = '';
    for (const [v, name] of scales) {
      const q = Math.floor(n / v); if (!q) continue; n %= v;
      if (v === 1e3) s += (s ? ' ' : '') + (q === 1 ? 'mille' : below1000(q, false) + ' mille');
      else s += (s ? ' ' : '') + below1000(q, true).replace(/^un$/, 'un') + ' ' + name + (q > 1 ? 's' : '');
    }
    if (n) s += (s ? ' ' : '') + below1000(n, true);
    return s;
  };
  // "Cent vingt dollars américains et cinquante cents"
  M.inWords = (amount, c) => {
    c = c || App.db.settings.currency; const i = M.info(c), v = M.round(Math.abs(amount), c), whole = Math.floor(v), minor = Math.round((v - whole) * 100);
    const name = w => (w === 1 || w === 0 ? i[1] : i[2]);
    let s = M.words(whole) + (/(?:ion|iard)s?$/.test(M.words(whole)) ? ' de ' : ' ') + name(whole);
    if (M.decimals(c) && minor) s += ' et ' + M.words(minor) + ' ' + (minor === 1 ? i[3] : i[4]);
    return App.cap(s);
  };
})();
