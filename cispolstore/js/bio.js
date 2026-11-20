// Fingerprint / face unlock (WebAuthn, platform authenticator): an optional shortcut next to the 4-digit PIN.
// Credentials are kept ON THIS DEVICE only (localStorage, never in the synced data or the exports): { id, u } where u is the profile id ('solo' without profiles).
// With profiles, the finger itself tells which profile opens. The PIN always remains the fallback.
(() => {
  'use strict';
  const App = window.App, S = () => App.db.settings, KEY = 'cispol.bio';
  const b64 = u => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  const multi = () => !!(App.multi && App.multi());
  let avail = false, busy = false, migrated = false;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const write = a => { try { localStorage.setItem(KEY, JSON.stringify(a)); return true; } catch (e) { return false; } };
  const list = () => {
    if (!migrated) { migrated = true; const o = S().bio; if (o && o.id) { const a = read().filter(e => e.u !== 'solo'); a.push({ id: o.id, u: 'solo' }); write(a); } if ('bio' in S()) { delete S().bio; App.save(); } } // v197 kept it in the settings
    return read();
  };
  const who = () => multi() ? (App.user && App.user.id) : 'solo';
  const usable = () => list().filter(e => multi() ? App.users().some(x => x.id === e.u && x.active !== false) : e.u === 'solo');
  const check = async () => { try { avail = !!(window.PublicKeyCredential && navigator.credentials && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { avail = false; } return avail; };
  const refresh = () => { if (App.state && !App.locked) App.refresh(); };
  App.bio = {
    ok: () => avail,                                   // this device can do it (known after the first check)
    on: () => usable().length > 0,                     // the lock screen can offer the fingerprint
    mine: () => { const w = who(); return !!w && list().some(e => e.u === w); },   // the current profile has it on this device
    check,
    enroll: async () => {
      const w = who(); if (!w) return;
      if (!(await check())) return App.toast("L'empreinte n'est pas disponible sur cet appareil");
      try {
        const c = await navigator.credentials.create({ publicKey: { challenge: rnd(32), rp: { name: 'CISPOLstore Manager' }, user: { id: rnd(16), name: 'cispolstore', displayName: 'CISPOLstore' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000 } });
        const a = list().filter(e => e.u !== w); a.push({ id: b64(new Uint8Array(c.rawId)), u: w });
        if (!write(a)) return App.toast("Impossible d'enregistrer l'empreinte sur cet appareil");
        App.toast('Empreinte activée'); refresh();
      } catch (e) { App.toast('Empreinte non activée (annulée ou refusée)'); }
    },
    off: () => { const w = who(); write(list().filter(e => e.u !== w)); App.toast('Empreinte désactivée'); refresh(); },
    // the lock screen: ask for the finger, then open the profile it belongs to
    prompt: async manual => {
      const ents = usable(); if (busy || !ents.length || !App.locked) return; busy = true;
      try {
        const r = await navigator.credentials.get({ publicKey: { challenge: rnd(32), allowCredentials: ents.map(e => ({ type: 'public-key', id: unb64(e.id) })), userVerification: 'required', timeout: 60000 } });
        const e = ents.find(x => x.id === b64(new Uint8Array(r.rawId)));
        if (!e) throw new Error('unknown');
        if (multi()) { const u = App.users().find(x => x.id === e.u && x.active !== false); if (!u) throw new Error('profile'); App.unlockNow(); App.me_login(u); }
        else App.unlockNow();
      } catch (er) { if (manual) App.toast('Empreinte non reconnue : utilisez le code'); }
      busy = false;
    }
  };
  App.actions.bioset = () => App.showLock('enter', 'bio');   // the PIN is asked first, then the finger
  App.actions.bioremove = () => { if (App.confirm("Désactiver l'empreinte ? Le code PIN reste en place.")) App.bio.off(); };
  check().then(() => { if (document.readyState === 'complete') refresh(); else window.addEventListener('load', refresh, { once: true }); });   // not while the scripts are still loading
})();
