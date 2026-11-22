// Fingerprint / face unlock (WebAuthn, platform authenticator): an optional shortcut next to the PIN on the lock screen.
// The credentials stay ON THIS DEVICE only (localStorage `biz.bio`, never in the synced data or the exports): [{ id, u }] where u is the profile id,
// so the finger itself tells which profile opens. The PIN always remains the fallback (and is asked first to enrol: the finger can only be added from an open session).
(function () {
  const App = window.App, R = () => App.roles, KEY = 'biz.bio';
  const b64 = u => btoa(String.fromCharCode(...u)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const rnd = n => crypto.getRandomValues(new Uint8Array(n));
  let avail = false, busy = false;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  const write = a => { try { localStorage.setItem(KEY, JSON.stringify(a)); return true; } catch (e) { return false; } };
  const usable = () => read().filter(e => App.db.users.some(x => x.id === e.u));
  const check = async () => { try { avail = !!(window.PublicKeyCredential && navigator.credentials && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch (e) { avail = false; } return avail; };
  App.bio = {
    ok: () => avail,                                                     // this device can do it (known after the first check)
    check,
    on: () => usable().length > 0,                                       // the lock screen can offer the fingerprint
    mine: () => !!App.user && read().some(e => e.u === App.user.id),     // the open profile has it on this device
    enroll: async () => {
      const u = App.user; if (!u) return false;
      if (!(await check())) { App.toast('L\'empreinte n\'est pas disponible sur cet appareil', 'err'); return false; }
      try {
        const c = await navigator.credentials.create({ publicKey: { challenge: rnd(32), rp: { name: 'CISPOLstore Business' }, user: { id: rnd(16), name: 'business-' + u.id, displayName: u.name }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' }, timeout: 60000 } });
        const a = read().filter(e => e.u !== u.id); a.push({ id: b64(new Uint8Array(c.rawId)), u: u.id });
        if (!write(a)) { App.toast('Impossible d\'enregistrer l\'empreinte sur cet appareil', 'err'); return false; }
        App.log('security.bio', u.name); App.toast('Empreinte activée'); return true;
      } catch (e) { App.toast('Empreinte non activée (annulée ou refusée)', 'err'); return false; }
    },
    off: () => { const u = App.user; if (!u) return; write(read().filter(e => e.u !== u.id)); App.log('security.bioOff', u.name); App.toast('Empreinte désactivée'); },
    // the lock screen: ask for the finger, then open the profile it belongs to
    prompt: async manual => {
      const ents = usable(); if (busy || !ents.length || !R() || !R().isLocked()) return false; busy = true; let ok = false;
      try {
        const r = await navigator.credentials.get({ publicKey: { challenge: rnd(32), allowCredentials: ents.map(e => ({ type: 'public-key', id: unb64(e.id) })), userVerification: 'required', timeout: 60000 } });
        const e = ents.find(x => x.id === b64(new Uint8Array(r.rawId))), u = e && App.db.users.find(x => x.id === e.u);
        if (!u) throw new Error('unknown'); R().unlockUser(u, 'empreinte'); ok = true;
      } catch (er) { if (manual) App.toast('Empreinte non reconnue : utilisez le code', 'err'); }
      busy = false; return ok;
    }
  };
  App.ready.then(check);
})();
