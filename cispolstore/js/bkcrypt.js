// Optional password protection of backups (file + Google Drive). AES-GCM, key derived with PBKDF2-SHA256.
// The password is never stored: it is kept in memory for the session only, and asked again after a reload.
(() => {
  'use strict';
  const App = window.App, $ = App.$, esc = App.esc, ITER = 210000, MARK = 'cispolstore-enc1';
  let mem = '';
  const b64 = u => { let s = ''; u = new Uint8Array(u); for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const key = async (pass, salt, iter) => { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']); return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, k, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']); };
  App.bkEncrypted = t => { try { return JSON.parse(t).format === MARK; } catch (e) { return false; } };
  App.bkEncrypt = async (text, pass) => {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12)), k = await key(pass, salt, ITER);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(text));
    return JSON.stringify({ format: MARK, app: 'CISPOLstore Manager', iter: ITER, salt: b64(salt), iv: b64(iv), data: b64(ct), info: 'Sauvegarde chiffrée : le mot de passe est nécessaire pour la restaurer.' });
  };
  App.bkDecrypt = async (text, pass) => { const o = JSON.parse(text), k = await key(pass, unb64(o.salt), o.iter || ITER); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv) }, k, unb64(o.data))); };

  // ask for the password in a modal; resolves with the password, or null when cancelled
  const ask = (title, text, confirmField) => new Promise(res => {
    let done = false; const finish = v => { if (!done) { done = true; res(v); } };
    App.modal(title, `<p class="mut" style="margin-top:0">${text}</p><label>Mot de passe<input id="bk_pw" type="password" autocomplete="off" style="width:100%"></label>${confirmField ? '<label>Confirmer le mot de passe<input id="bk_pw2" type="password" autocomplete="off" style="width:100%"></label>' : ''}<div id="bk_err" class="mut" style="color:var(--red,#c0392b);min-height:18px"></div>`, () => {
      const p = $('bk_pw').value, p2 = confirmField ? $('bk_pw2').value : p, err = $('bk_err');
      if (p.length < 6) { err.textContent = '6 caractères au minimum.'; return false; }
      if (p !== p2) { err.textContent = 'Les deux mots de passe sont différents.'; return false; }
      finish(p);
    }, 'Valider');
    const d = $('dlg'); d.addEventListener('close', () => finish(null), { once: true });
    setTimeout(() => { const i = $('bk_pw'); if (i) i.focus(); }, 50);
  });

  // text to write in a backup file: encrypted when protection is on. silent = no question (automatic Drive backup)
  App.bkProtect = async (text, silent) => {
    if (!App.db.settings.bkEnc) return text;
    if (!mem) { if (silent) throw Object.assign(new Error('Mot de passe des sauvegardes non saisi : faites une sauvegarde manuelle une fois pour le mémoriser jusqu\'à la fermeture.'), { code: 'bkpass' }); mem = await ask('Mot de passe de la sauvegarde', 'La sauvegarde sera chiffrée. Notez ce mot de passe : sans lui, elle est impossible à restaurer.'); if (!mem) return null; }
    return App.bkEncrypt(text, mem);
  };
  // plain text from a backup file that may be encrypted (asks the password); null when cancelled or wrong
  App.bkOpen = async text => {
    if (!App.bkEncrypted(text)) return text;
    if (mem) { try { return await App.bkDecrypt(text, mem); } catch (e) {} }
    for (let i = 0; i < 3; i++) {
      const p = await ask('Sauvegarde chiffrée', i ? 'Mot de passe incorrect. Réessayez.' : 'Cette sauvegarde est protégée. Saisissez son mot de passe.');
      if (!p) return null;
      try { const t = await App.bkDecrypt(text, p); mem = mem || p; return t; } catch (e) {}
    }
    App.toast('Mot de passe incorrect : sauvegarde non ouverte'); return null;
  };
  App.actions.bk_enc_on = async () => { const p = await ask('Chiffrer les sauvegardes', 'Choisissez un mot de passe (6 caractères minimum). Il n\'est enregistré nulle part : si vous l\'oubliez, vos sauvegardes sont perdues.', true); if (!p) return; mem = p; App.db.settings.bkEnc = true; App.save(); App.toast('Sauvegardes chiffrées activées'); App.refresh(); };
  App.actions.bk_enc_off = () => { if (!App.confirm('Désactiver le chiffrement ? Les prochaines sauvegardes seront lisibles par tout le monde.')) return; App.db.settings.bkEnc = false; mem = ''; App.save(); App.toast('Chiffrement désactivé'); App.refresh(); };
  App.bkEncRow = () => { const on = !!App.db.settings.bkEnc; return `<div class="item"><div class="grow"><b>Chiffrer les sauvegardes</b><small style="white-space:normal">${on ? 'Activé : fichiers et Drive sont protégés par votre mot de passe (AES-256).' : 'Protège les fichiers de sauvegarde par un mot de passe. Recommandé si le téléphone est partagé.'}</small></div>${on ? '<button class="btn sm del" data-act="bk_enc_off">Désactiver</button>' : '<button class="btn sm sec" data-act="bk_enc_on">Activer…</button>'}</div>`; };
})();
