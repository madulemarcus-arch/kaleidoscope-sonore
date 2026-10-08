// Caisse locale CISPOLstore - serveur sans dependance (Node.js 18 ou plus recent)
// Lancement : node server.js
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const CONFIG_FILE = process.env.CAISSE_CONFIG ? path.resolve(process.env.CAISSE_CONFIG) : path.join(ROOT, "config.json");
const DATA_DIR = process.env.CAISSE_DONNEES ? path.resolve(process.env.CAISSE_DONNEES) : path.join(ROOT, "donnees");
const DATA_FILE = path.join(DATA_DIR, "caisse.json");
const PUBLIC_DIR = path.join(ROOT, "public");

/* ------------------------------------------------------------------ config */
if (!fs.existsSync(CONFIG_FILE)) {
  fs.copyFileSync(path.join(ROOT, "config.exemple.json"), CONFIG_FILE);
  console.log("config.json cree a partir de config.exemple.json : pensez a changer les codes PIN et le mot de passe du routeur.");
}
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
const PORT = Number(process.env.PORT || CONFIG.port || 8080);
const R = CONFIG.routeur || {};

/* ---------------------------------------------------------------- donnees */
fs.mkdirSync(DATA_DIR, { recursive: true });
let DATA = { tickets: {}, lots: [], prix: {} };
if (fs.existsSync(DATA_FILE)) {
  try { DATA = { ...DATA, ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) }; }
  catch (e) { console.error("Fichier de donnees illisible, une copie est gardee :", e.message); fs.copyFileSync(DATA_FILE, DATA_FILE + ".illisible-" + Date.now()); }
}
let saveTimer = null;
function sauver() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DATA_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(DATA));
    fs.renameSync(tmp, DATA_FILE);
    const jour = new Date().toISOString().slice(0, 10);
    const sauvegarde = path.join(DATA_DIR, "sauvegarde-" + jour + ".json");
    if (!fs.existsSync(sauvegarde)) fs.copyFileSync(DATA_FILE, sauvegarde);
  }, 300);
}
function sauverMaintenant() { clearTimeout(saveTimer); const tmp = DATA_FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(DATA)); fs.renameSync(tmp, DATA_FILE); }

function forfaits() {
  return (CONFIG.forfaits || []).map(f => ({ ...f, prix: DATA.prix[f.id] != null ? DATA.prix[f.id] : f.prix }));
}
function forfait(id) { return forfaits().find(f => f.id === id); }

/* ---------------------------------------------------------------- sessions */
const SESSIONS = new Map();
const ESSAIS = new Map(); // anti force brute : ip -> {n, jusqua}
function nouvelleSession(u) {
  const t = crypto.randomBytes(24).toString("hex");
  SESSIONS.set(t, { nom: u.nom, role: u.role, exp: Date.now() + 14 * 24 * 3600e3 });
  return t;
}
function session(req) {
  const m = /(?:^|;\s*)caisse_sid=([a-f0-9]+)/.exec(req.headers.cookie || "");
  const s = m && SESSIONS.get(m[1]);
  if (!s || s.exp < Date.now()) return null;
  return { ...s, token: m[1] };
}

/* ---------------------------------------------------------------- MikroTik */
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function nouveauCode(prefixe) {
  const b = crypto.randomBytes(5);
  return prefixe + [...b].map(x => ALPHA[x % ALPHA.length]).join("");
}
let ETAT_ROUTEUR = { ok: false, message: "Pas encore contacte", le: 0 };
async function routeur(methode, chemin, corps) {
  const url = `${R.protocole || "http"}://${R.adresse}/rest${chemin}`;
  const auth = "Basic " + Buffer.from(`${R.utilisateur}:${R.motDePasse}`).toString("base64");
  let rep;
  try {
    rep = await fetch(url, {
      method: methode,
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: corps ? JSON.stringify(corps) : undefined,
      signal: AbortSignal.timeout(6000),
    });
  } catch (e) {
    ETAT_ROUTEUR = { ok: false, message: "Routeur injoignable (" + (e.name === "TimeoutError" ? "delai depasse" : e.message) + ")", le: Date.now() };
    const err = new Error("Le routeur ne repond pas. Verifiez le cable et l'adresse dans config.json."); err.code = "routeur"; throw err;
  }
  const texte = await rep.text();
  let json = null; try { json = texte ? JSON.parse(texte) : null; } catch (e) {}
  if (rep.status === 401) {
    ETAT_ROUTEUR = { ok: false, message: "Identifiants refuses par le routeur", le: Date.now() };
    const err = new Error("Le routeur refuse l'identifiant de la caisse (config.json)."); err.code = "routeur"; throw err;
  }
  if (!rep.ok) {
    ETAT_ROUTEUR = { ok: true, message: "Connecte", le: Date.now() };
    const err = new Error((json && (json.detail || json.message)) || ("Erreur routeur " + rep.status)); err.code = "routeur-refus"; err.status = rep.status; throw err;
  }
  ETAT_ROUTEUR = { ok: true, message: "Connecte", le: Date.now() };
  return json;
}
async function creerSurRouteur(code, f) {
  await routeur("PUT", "/ip/hotspot/user", { name: code, password: code, profile: f.profil, server: R.serveurHotspot || "all" });
}
async function supprimerSurRouteur(code) {
  const liste = await routeur("GET", "/ip/hotspot/user?name=" + encodeURIComponent(code));
  for (const u of liste || []) await routeur("DELETE", "/ip/hotspot/user/" + u[".id"]);
}
async function creerCodeUnique(f) {
  for (let i = 0; i < 6; i++) {
    const code = nouveauCode(f.id);
    if (DATA.tickets[code]) continue;
    try { await creerSurRouteur(code, f); return code; }
    catch (e) { if (e.code === "routeur-refus" && /already|existe/i.test(e.message)) continue; throw e; }
  }
  throw Object.assign(new Error("Impossible de trouver un code libre, reessayez."), { code: "routeur" });
}

/* ---------------------------------------------------------------- calculs */
function debut(periode) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (periode === "semaine") d.setDate(d.getDate() - 6);
  if (periode === "mois") d.setDate(1);
  return d.getTime();
}
function ventesDepuis(t0) {
  return Object.values(DATA.tickets).filter(t => t.statut === "vendu" && t.venduLe >= t0).sort((a, b) => b.venduLe - a.venduLe);
}
function stockParForfait() {
  const s = {}; for (const f of forfaits()) s[f.id] = 0;
  for (const t of Object.values(DATA.tickets)) if (t.statut === "stock") s[t.forfait] = (s[t.forfait] || 0) + 1;
  return s;
}

/* ---------------------------------------------------------------- HTTP */
function envoyer(res, code, obj, entetes = {}) {
  const corps = typeof obj === "string" ? obj : JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": typeof obj === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8", "Cache-Control": "no-store", ...entetes });
  res.end(corps);
}
function lireCorps(req) {
  return new Promise((ok, ko) => {
    let d = ""; req.on("data", c => { d += c; if (d.length > 1e6) { req.destroy(); ko(new Error("trop gros")); } });
    req.on("end", () => { try { ok(d ? JSON.parse(d) : {}); } catch (e) { ko(e); } });
  });
}
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
function fichierStatique(req, res, p) {
  if (p === "/") p = "/index.html";
  const f = path.normalize(path.join(PUBLIC_DIR, p));
  if (!f.startsWith(PUBLIC_DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return envoyer(res, 404, "Page introuvable");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(f).pipe(res);
}
function venteVue(t) {
  return { code: t.code, forfait: t.forfait, prix: t.prix, venduLe: t.venduLe, vendeur: t.vendeur, client: t.client || "", source: t.source };
}

const API = {
  "POST /api/connexion": async (req, res) => {
    const ip = req.socket.remoteAddress; const e = ESSAIS.get(ip) || { n: 0, jusqua: 0 };
    if (e.jusqua > Date.now()) return envoyer(res, 429, { erreur: "Trop d'essais. Patientez une minute." });
    const { pin } = await lireCorps(req);
    const u = (CONFIG.utilisateurs || []).find(x => String(x.pin) === String(pin || ""));
    if (!u) { e.n++; if (e.n >= 5) { e.jusqua = Date.now() + 60e3; e.n = 0; } ESSAIS.set(ip, e); return envoyer(res, 401, { erreur: "Code PIN incorrect." }); }
    ESSAIS.delete(ip);
    const t = nouvelleSession(u);
    envoyer(res, 200, { nom: u.nom, role: u.role }, { "Set-Cookie": `caisse_sid=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${14 * 24 * 3600}` });
  },
  "POST /api/deconnexion": async (req, res, s) => { SESSIONS.delete(s.token); envoyer(res, 200, { ok: true }, { "Set-Cookie": "caisse_sid=; Path=/; Max-Age=0" }); },

  "GET /api/etat": async (req, res, s) => {
    const jour = ventesDepuis(debut("jour"));
    envoyer(res, 200, {
      moi: { nom: s.nom, role: s.role }, site: CONFIG.site || "CISPOLstore",
      forfaits: forfaits().map(({ id, nom, duree, prix, c }) => ({ id, nom, duree, prix, c })),
      seuil: CONFIG.seuil || 10, stock: stockParForfait(),
      ventesDuJour: jour.map(venteVue), routeur: ETAT_ROUTEUR, heure: Date.now(),
      lotsRecents: s.role === "gerant" ? DATA.lots.slice(-8).reverse() : [],
    });
  },

  "POST /api/vendre": async (req, res, s) => {
    const { forfait: fid, client } = await lireCorps(req);
    const f = forfait(fid); if (!f) return envoyer(res, 400, { erreur: "Forfait inconnu." });
    const code = await creerCodeUnique(f);
    const t = { code, forfait: f.id, statut: "vendu", source: "direct", ajouteLe: Date.now(), venduLe: Date.now(), vendeur: s.nom, prix: f.prix, client: String(client || "").slice(0, 80) };
    DATA.tickets[code] = t; sauverMaintenant();
    envoyer(res, 200, { vente: venteVue(t) });
  },

  "POST /api/vendre-imprime": async (req, res, s) => {
    const { code: brut } = await lireCorps(req);
    const code = String(brut || "").toUpperCase().replace(/\s+/g, "");
    const t = DATA.tickets[code];
    if (!t) return envoyer(res, 404, { erreur: `${code || "Ce code"} n'est pas dans la caisse. Verifiez le code.` });
    if (t.statut === "vendu") return envoyer(res, 409, { erreur: `${code} est deja vendu (${new Date(t.venduLe).toLocaleString("fr-FR")}).` });
    const f = forfait(t.forfait);
    Object.assign(t, { statut: "vendu", venduLe: Date.now(), vendeur: s.nom, prix: f ? f.prix : 0 });
    sauverMaintenant();
    envoyer(res, 200, { vente: venteVue(t) });
  },

  "POST /api/annuler": async (req, res, s) => {
    if (s.role !== "gerant") return envoyer(res, 403, { erreur: "Reserve au gerant." });
    const { code } = await lireCorps(req);
    const t = DATA.tickets[code];
    if (!t || t.statut !== "vendu") return envoyer(res, 404, { erreur: "Vente introuvable." });
    if (t.source === "direct") {
      await supprimerSurRouteur(code); // le code ne doit plus donner acces
      delete DATA.tickets[code];
    } else {
      Object.assign(t, { statut: "stock", venduLe: null, vendeur: null, prix: null, client: "" });
    }
    sauverMaintenant(); envoyer(res, 200, { ok: true });
  },

  "POST /api/lots": async (req, res, s) => {
    if (s.role !== "gerant") return envoyer(res, 403, { erreur: "Reserve au gerant." });
    const { forfait: fid, nombre } = await lireCorps(req);
    const f = forfait(fid); const n = Math.min(300, Math.max(1, parseInt(nombre, 10) || 0));
    if (!f) return envoyer(res, 400, { erreur: "Forfait inconnu." });
    const id = "L" + Date.now(); const codes = [];
    try {
      for (let i = 0; i < n; i++) {
        const code = await creerCodeUnique(f);
        DATA.tickets[code] = { code, forfait: f.id, statut: "stock", source: "imprime", lot: id, ajouteLe: Date.now(), venduLe: null, vendeur: null, prix: null, client: "" };
        codes.push(code);
      }
    } finally {
      if (codes.length) { DATA.lots.push({ id, forfait: f.id, nombre: codes.length, creeLe: Date.now(), par: s.nom }); sauverMaintenant(); }
    }
    envoyer(res, 200, { lot: id, crees: codes.length });
  },
  "GET /api/lot": async (req, res, s, url) => {
    if (s.role !== "gerant") return envoyer(res, 403, { erreur: "Reserve au gerant." });
    const id = url.searchParams.get("id");
    const codes = Object.values(DATA.tickets).filter(t => t.lot === id).map(t => t.code);
    envoyer(res, 200, { id, codes });
  },

  "POST /api/prix": async (req, res, s) => {
    if (s.role !== "gerant") return envoyer(res, 403, { erreur: "Reserve au gerant." });
    const { prix } = await lireCorps(req);
    for (const f of CONFIG.forfaits || []) { const v = parseInt(prix && prix[f.id], 10); if (Number.isFinite(v) && v >= 0) DATA.prix[f.id] = v; }
    sauverMaintenant(); envoyer(res, 200, { ok: true });
  },

  "GET /api/rapport": async (req, res, s, url) => {
    if (s.role !== "gerant") return envoyer(res, 403, { erreur: "Reserve au gerant." });
    const p = url.searchParams.get("periode") || "jour";
    const l = ventesDepuis(debut(p));
    envoyer(res, 200, { periode: p, ventes: l.map(venteVue) });
  },
  "GET /api/export": async (req, res, s, url) => {
    if (s.role !== "gerant") return envoyer(res, 403, { erreur: "Reserve au gerant." });
    const p = url.searchParams.get("periode") || "mois";
    const lignes = [["Date", "Heure", "Code", "Forfait", "Vendeur", "Prix FC", "Client", "Type"].join(";")];
    for (const v of ventesDepuis(debut(p)).reverse()) {
      const d = new Date(v.venduLe), f = forfait(v.forfait);
      lignes.push([d.toLocaleDateString("fr-FR"), d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }), v.code, f ? f.nom : v.forfait, v.vendeur || "", v.prix || 0, String(v.client || "").replace(/;/g, ","), v.source === "direct" ? "Direct" : "Imprime"].join(";"));
    }
    res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="ventes-${p}-${new Date().toISOString().slice(0, 10)}.csv"` });
    res.end("﻿" + lignes.join("\r\n"));
  },

  "GET /api/clients": async (req, res, s) => {
    if (s.role !== "gerant") return envoyer(res, 403, { erreur: "Reserve au gerant." });
    const l = await routeur("GET", "/ip/hotspot/active");
    envoyer(res, 200, { clients: (l || []).map(a => ({ id: a[".id"], code: a.user, adresse: a.address, mac: a["mac-address"], duree: a.uptime, recu: Number(a["bytes-out"] || 0), envoye: Number(a["bytes-in"] || 0) })) });
  },
  "POST /api/clients/deconnecter": async (req, res, s) => {
    if (s.role !== "gerant") return envoyer(res, 403, { erreur: "Reserve au gerant." });
    const { id } = await lireCorps(req);
    if (!/^\*[0-9A-F]+$/i.test(String(id || ""))) return envoyer(res, 400, { erreur: "Identifiant invalide." });
    await routeur("DELETE", "/ip/hotspot/active/" + id);
    envoyer(res, 200, { ok: true });
  },
  "GET /api/routeur": async (req, res) => {
    try { const r = await routeur("GET", "/system/identity"); envoyer(res, 200, { ok: true, nom: r && r.name }); }
    catch (e) { envoyer(res, 200, { ok: false, message: e.message }); }
  },
};

const serveur = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://caisse.local");
  if (!url.pathname.startsWith("/api/")) return fichierStatique(req, res, url.pathname);
  const h = API[req.method + " " + url.pathname];
  if (!h) return envoyer(res, 404, { erreur: "Action inconnue." });
  const s = session(req);
  if (!s && url.pathname !== "/api/connexion") return envoyer(res, 401, { erreur: "Connectez-vous avec votre code PIN." });
  try { await h(req, res, s, url); }
  catch (e) {
    if (e.code === "routeur" || e.code === "routeur-refus") return envoyer(res, 502, { erreur: e.message });
    console.error(e); envoyer(res, 500, { erreur: "Erreur interne de la caisse." });
  }
});

// verification periodique du routeur (affichee dans la caisse)
async function sonder() { try { await routeur("GET", "/system/identity"); } catch (e) {} }
setInterval(sonder, 60e3);

serveur.listen(PORT, "0.0.0.0", () => {
  console.log(`Caisse CISPOLstore demarree : http://localhost:${PORT}`);
  console.log(`Depuis un telephone du reseau : http://<adresse-de-cet-appareil>:${PORT}`);
  sonder();
});
process.on("SIGINT", () => { sauverMaintenant(); process.exit(0); });
process.on("SIGTERM", () => { sauverMaintenant(); process.exit(0); });
