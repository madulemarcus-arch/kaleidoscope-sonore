// Fingerprint / face unlock (WebAuthn, platform authenticator): an optional shortcut next to the 4-digit PIN.
// The credential id stays on this device (it is removed from exports); the PIN always remains the fallback.
(() => {
  'use strict';
  const App = window.App, S = () => App.db.settings;
  const b64 = u => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  let avail = false, busy = false;
  const check = async () => { try { avail = !!(window.PublicKeyCredential && navigator.credentials && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { avail = false; } return avail; };
  App.bio = {
    ok: () => avail,                                   // this device can do it (known after the first check)
    on: () => !!(S().bio && S().bio.id) && !(App.multi && App.multi()),
    check,
    enroll: async () => {
      if (!(await check())) return App.toast("L'empreinte n'est pas disponible sur cet appareil");
      try {
        const c = await navigator.credentials.create({ publicKey: { challenge: rnd(32), rp: { name: 'CISPOLstore Manager' }, user: { id: rnd(16), name: 'cispolstore', displayName: 'CISPOLstore' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000 } });
        S().bio = { id: b64(new Uint8Array(c.rawId)), at: App.today() }; App.save(); App.toast('Empreinte activée'); if (App.state.view === 'settings') App.refresh();
      } catch (e) { App.toast("Empreinte non activée (annulée ou refusée)"); }
    },
    off: () => { S().bio = null; App.save(); App.toast('Empreinte désactivée'); if (App.state.view === 'settings') App.refresh(); },
    prompt: async manual => {
      if (busy || !App.bio.on() || !App.locked) return; busy = true;
      try {
        await navigator.credentials.get({ publicKey: { challenge: rnd(32), allowCredentials: [{ type: 'public-key', id: unb64(S().bio.id) }], userVerification: 'required', timeout: 60000 } });
        App.unlockNow();
      } catch (e) { if (manual) App.toast('Empreinte non reconnue : utilisez le code'); }
      busy = false;
    }
  };
  App.actions.bioset = () => App.showLock('enter', 'bio');   // the PIN is asked first, then the finger
  App.actions.bioremove = () => { if (App.confirm("Désactiver l'empreinte ? Le code PIN reste en place.")) App.bio.off(); };
  check().then(() => { if (App.state && App.state.view === 'settings') App.refresh(); });
})();
