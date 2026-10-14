// Synthetic test data (no real customers): a client list in the column layout of the owner's spreadsheet.
const pad = (n, w) => String(n).padStart(w, '0');
const iso = d => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 864e5);
const FIRST = ['Alice', 'Bernard', 'Chantal', 'David', 'Esther', 'Fabrice', 'Gisèle', 'Hervé', 'Irène', 'Jules', 'Kevin', 'Lydie', 'Michel', 'Nadine', 'Olivier', 'Pascaline', 'Quentin', 'Rachel', 'Samuel', 'Tania', 'Urbain', 'Viviane', 'Willy', 'Xavier', 'Yvette', 'Zacharie'];
const PLANS = ['illimité', '250 Go', 'illimité ', '50 Go'];
// n clients named from A to Z in turn, with expiry dates spread around today (some active, some late)
exports.clientsCsv = (n = 60) => {
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z'), rows = ["N°;Colonne1;Numéro ACC;Téléphone;Solde Dû;Abonnement ;Date de paiement;Date d'expiration;Jours restants;Statut;Observation;Reference "];
  for (let i = 0; i < n; i++) {
    const exp = addDays(today, (i % 40) - 12), paid = addDays(exp, -30), first = FIRST[i % 26], last = 'Test' + pad(i + 1, 3);
    rows.push([i + 1, `${first} ${last}`, `ACC-TEST-${pad(i + 1, 5)}`, '08' + pad(10000000 + i * 37, 8), i % 7 === 0 ? '87 000,00 CDF' : '0,00 CDF', PLANS[i % PLANS.length], iso(paid), iso(exp), '', '', 'active', `${first} ${last}`].join(';'));
  }
  return rows.join('\n');
};
exports.csvFile = (n, name = 'clients-test.csv') => ({ name, mimeType: 'text/csv', buffer: Buffer.from(exports.clientsCsv(n)) });
