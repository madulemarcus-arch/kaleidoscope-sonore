// Settings for the encryption of this phone's data (the machinery runs in gate.js, before the application starts).
(() => {
  'use strict';
  const App = window.App, $ = App.$, F = App.f, G = () => window.__enc;
  const MIN = 8;
  const row = (t, s, b) => `<div class="item"><div class="grow"><b>${t}</b><small style="white-space:normal">${s}</small></div>${b || ''}</div>`;
  const pwFields = (a, b) => F.text('enc_p1', a, '', 'type="password" autocomplete="new-password"') + F.text('enc_p2', b, '', 'type="password" autocomplete="new-password"');
  const bad = t => { const m = $('enc_msg'); if (m) m.textContent = t; return false; };
  const check = (p1, p2) => p1.length < MIN ? `Au moins ${MIN} caractères (une phrase facile à retenir est mieux qu'un mot court).` : p1 !== p2 ? 'Les deux mots de passe ne sont pas identiques.' : '';
  App.encRow = () => {
    if (!G() || !window.crypto || !crypto.subtle) return '';
    return G().on
      ? row('🔒 Données chiffrées', "Sur ce téléphone, clients, factures et réglages sont illisibles sans le mot de passe, même si le téléphone est volé. Le mot de passe est demandé quand l'application est rouverte (le code PIN et l'empreinte servent ensuite pendant la journée).", '<div style="display:grid;gap:6px"><button class="btn sm sec" data-act="enc_change">Changer</button><button class="btn sm del" data-act="enc_off">Désactiver</button></div>')
        + `<div class="item"><div class="grow"><b>Effacer après 10 essais ratés</b><small style="white-space:normal">Les données de ce téléphone sont supprimées (vos sauvegardes et la synchronisation les restaurent). À réserver aux téléphones exposés.</small></div><select id="enc_wipe" style="width:auto"><option value="0"${G().wipeOpt() ? '' : ' selected'}>Non</option><option value="1"${G().wipeOpt() ? ' selected' : ''}>Oui</option></select></div>`
      : row('Chiffrer les données', "Sur ce téléphone. Si le téléphone est volé ou perdu, les données (clients, factures, synchronisation) restent illisibles sans un mot de passe. Le code PIN seul ne protège que l'écran : il ne chiffre rien.", '<button class="btn sm" data-act="enc_on">Activer</button>');
  };
  document.addEventListener('change', e => { if (e.target && e.target.id === 'enc_wipe' && G()) { G().setWipeOpt(e.target.value === '1'); App.toast(e.target.value === '1' ? 'Effacement après 10 essais ratés : activé' : 'Effacement automatique : désactivé'); } });
  App.actions.enc_on = () => App.modal('Chiffrer les données de ce téléphone',
    `<p style="margin-top:0">Choisissez un <b>mot de passe</b> pour l'application. Il sera demandé chaque fois que l'application est rouverte après une fermeture complète.</p>${pwFields('Mot de passe', 'Confirmez le mot de passe')}
     <p class="warn"><b>Notez-le en lieu sûr.</b> Il ne peut pas être récupéré : sans lui, les données de ce téléphone sont perdues (vous pourrez toujours les restaurer depuis une sauvegarde ou la synchronisation). <b>Faites une sauvegarde avant d'activer.</b></p><p id="enc_msg" class="warn"></p>`,
    () => {
      const p1 = $('enc_p1').value, p2 = $('enc_p2').value, m = check(p1, p2); if (m) return bad(m);
      $('enc_msg').textContent = 'Chiffrement en cours…';
      G().enable(p1, JSON.stringify(App.db)).then(() => { App.close(); App.save(); App.toast('Données chiffrées sur ce téléphone'); App.refresh(); }).catch(() => bad('Le chiffrement a échoué : rien n\'a été modifié.'));
      return false;
    }, 'Activer');
  App.actions.enc_change = () => App.modal('Changer le mot de passe',
    `${F.text('enc_p0', 'Mot de passe actuel', '', 'type="password" autocomplete="current-password"')}${pwFields('Nouveau mot de passe', 'Confirmez le nouveau mot de passe')}<p id="enc_msg" class="warn"></p>`,
    () => {
      const p0 = $('enc_p0').value, p1 = $('enc_p1').value, p2 = $('enc_p2').value, m = check(p1, p2);
      G().check(p0).then(ok => { if (!ok) return bad('Mot de passe actuel incorrect.'); if (m) return bad(m); return G().change(p1, JSON.stringify(App.db)).then(() => { App.close(); App.toast('Mot de passe changé'); }); }).catch(() => bad('Le changement a échoué : l\'ancien mot de passe reste valable.'));
      return false;
    }, 'Changer');
  App.actions.enc_off = () => App.modal('Désactiver le chiffrement',
    `<p style="margin-top:0">Les données de ce téléphone redeviennent lisibles sans mot de passe. Entrez le mot de passe pour confirmer.</p>${F.text('enc_p0', 'Mot de passe', '', 'type="password" autocomplete="current-password"')}<p id="enc_msg" class="warn"></p>`,
    () => {
      G().check($('enc_p0').value).then(ok => { if (!ok) return bad('Mot de passe incorrect.'); return G().disable(JSON.stringify(App.db)).then(() => { App.close(); App.save(); App.toast('Chiffrement désactivé'); App.refresh(); }); }).catch(() => bad('La désactivation a échoué : rien n\'a été modifié.'));
      return false;
    }, 'Désactiver');
})();
