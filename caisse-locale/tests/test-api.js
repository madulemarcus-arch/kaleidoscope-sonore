// Test de bout en bout : demarre le faux MikroTik + la caisse, puis verifie les parcours principaux.
// Lancement : node tests/test-api.js
"use strict";
const { spawn } = require("child_process");
const path = require("path"); const fs = require("fs"); const os = require("os");
const BASE = "http://127.0.0.1:18090";
const donnees = fs.mkdtempSync(path.join(os.tmpdir(), "caisse-test-"));
const fake = spawn(process.execPath, [path.join(__dirname, "fake-mikrotik.js")], { stdio: "ignore" });
const srv = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], { env: { ...process.env, CAISSE_CONFIG: path.join(__dirname, "config.test.json"), CAISSE_DONNEES: donnees }, stdio: "ignore" });
const attendre = (ms) => new Promise(r => setTimeout(r, ms));
let echecs = 0; const ok = (cond, msg) => { console.log((cond ? "OK   " : "ECHEC") + " " + msg); if (!cond) echecs++; };
async function appel(cookie, chemin, corps) {
  const r = await fetch(BASE + chemin, { method: corps ? "POST" : "GET", headers: { "Content-Type": "application/json", Cookie: cookie || "" }, body: corps ? JSON.stringify(corps) : undefined });
  const c = r.headers.get("set-cookie"); let j = null; try { j = await r.json(); } catch (e) {}
  return { status: r.status, json: j, cookie: c ? c.split(";")[0] : cookie };
}
(async () => {
  await attendre(1200);
  try {
    ok((await appel("", "/api/connexion", { pin: "0000" })).status === 401, "PIN faux refuse");
    const g = (await appel("", "/api/connexion", { pin: "1234" })).cookie;
    const v = (await appel("", "/api/connexion", { pin: "5678" })).cookie;
    const vente = await appel(v, "/api/vendre", { forfait: "J", client: "Test" });
    ok(vente.status === 200 && /^J[A-Z0-9]{5}$/.test(vente.json.vente.code), "vente directe cree un code J");
    ok((await appel(v, "/api/lots", { forfait: "V", nombre: 3 })).status === 403, "lot refuse au vendeur");
    const lot = await appel(g, "/api/lots", { forfait: "V", nombre: 5 });
    ok(lot.json && lot.json.crees === 5, "lot de 5 tickets cree");
    const codes = (await appel(g, "/api/lot?id=" + lot.json.lot)).json.codes;
    ok((await appel(v, "/api/vendre-imprime", { code: codes[0] })).status === 200, "vente d'un ticket imprime");
    ok((await appel(v, "/api/vendre-imprime", { code: codes[0] })).status === 409, "double vente refusee");
    const etat = (await appel(g, "/api/etat")).json;
    ok(etat.stock.V === 4 && etat.ventesDuJour.length === 2, "stock et ventes du jour coherents");
    ok((await appel(g, "/api/annuler", { code: vente.json.vente.code })).status === 200, "annulation vente directe (code supprime du routeur)");
    ok((await appel(g, "/api/clients")).json.clients.length >= 1, "liste des clients connectes");
    ok((await appel(v, "/api/rapport?periode=jour")).status === 403, "rapport refuse au vendeur");
  } catch (e) { console.error(e); echecs++; }
  fake.kill(); srv.kill();
  console.log(echecs ? `\n${echecs} test(s) en echec` : "\nTous les tests sont passes.");
  process.exit(echecs ? 1 : 0);
})();
