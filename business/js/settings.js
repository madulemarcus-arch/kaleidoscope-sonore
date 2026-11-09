// Company setup: start-up wizard + settings screen (identity, currencies, modules, vocabulary, custom fields, appearance).
(function () {
  const App = window.App, ui = App.ui, esc = App.esc, M = App.money;
  const S = () => App.db.settings;
  const curOpts = () => M.CODES.map(c => [c, c + ' (' + M.info(c)[0] + ')']);
  const entities = { clients: 'Clients', products: 'Produits', invoices: 'Factures' };
  const ftypes = [['text', 'Texte'], ['number', 'Nombre'], ['date', 'Date'], ['list', 'Liste']];

  const imgField = (key, label, val) => '<div class="fld"><span>' + esc(label) + '</span><div class="imgpick"><div class="prev" data-prev="' + key + '">' + (val ? '<img alt="" src="' + val + '">' : '<em>Aucun</em>') + '</div><label class="btn ghost">Importer<input type="file" accept="image/*" hidden data-img="' + key + '"></label><button type="button" class="btn ghost" data-imgdel="' + key + '">Retirer</button></div></div>';
  const bindImgs = (root, target) => {
    root.querySelectorAll('[data-img]').forEach(inp => inp.onchange = async () => {
      const k = inp.dataset.img; try { target[k] = await ui.pickImage(inp.files[0], k === 'logo' ? 400 : 300); } catch (e) { return App.toast('Image illisible', 'err'); }
      root.querySelector('[data-prev="' + k + '"]').innerHTML = '<img alt="" src="' + target[k] + '">'; target === S() && App.save();
    });
    root.querySelectorAll('[data-imgdel]').forEach(b => b.onclick = () => { const k = b.dataset.imgdel; target[k] = ''; root.querySelector('[data-prev="' + k + '"]').innerHTML = '<em>Aucun</em>'; target === S() && App.save(); });
  };
  const legalHtml = list => list.map((l, i) => '<div class="row2"><input data-legal-k="' + i + '" value="' + esc(l.k) + '" aria-label="Libellé"><input data-legal-v="' + i + '" value="' + esc(l.v) + '" aria-label="Valeur"></div>').join('');
  const readLegal = (root, list) => list.forEach((l, i) => { l.k = root.querySelector('[data-legal-k="' + i + '"]').value.trim() || l.k; l.v = root.querySelector('[data-legal-v="' + i + '"]').value.trim(); });
  const modulesHtml = mods => '<div class="mods">' + App.MODULES.map(m => '<label class="mod"><input type="checkbox" data-mod="' + m[0] + '"' + (mods[m[0]] ? ' checked' : '') + '><span><b>' + esc(m[1]) + '</b><small>' + esc(m[2]) + '</small></span></label>').join('') + '</div>';
  const vocabHtml = v => [['client', 'Un client, c\'est un…'], ['product', 'Un produit, c\'est un…'], ['sub', 'Un abonnement, c\'est un…']].map(([k, l]) => ui.field(l, '<input data-vocab="' + k + '" value="' + esc(v[k]) + '" maxlength="24">')).join('');

  // ---------- wizard ----------
  App.wizard = () => {
    const d = JSON.parse(JSON.stringify(S())); let step = 0; const steps = ['Votre entreprise', 'Argent et mentions', 'Modules et mots'];
    const layer = App.$('#layer'), el = document.createElement('div'); el.className = 'wizard'; layer.appendChild(el);
    const apply = p => { const pr = App.PRESETS[p]; d.activity = p; d.vocab = { ...pr.vocab }; App.MODULES.forEach(m => d.modules[m[0]] = pr.modules.includes(m[0])); };
    const body = () => {
      if (step === 0) return ui.field('Nom de l\'entreprise *', ui.input('name', d.name, { ph: 'Ex. Ets Mavuela' })) +
        ui.field('Activité', ui.select('activity', Object.entries(App.PRESETS).map(([k, v]) => [k, v.label]), d.activity), 'Choisit les modules et le vocabulaire de départ. Tout reste modifiable.') +
        ui.field('Ville', ui.input('city', d.city)) + ui.field('Slogan (facultatif)', ui.input('slogan', d.slogan)) + imgField('logo', 'Logo', d.logo);
      if (step === 1) return '<div class="row2">' + ui.field('Devise principale', ui.select('currency', curOpts(), d.currency)) + ui.field('Devise secondaire', ui.select('cur2', curOpts(), d.cur2)) + '</div>' +
        ui.field('Taux : 1 ' + d.currency + ' = ? ' + d.cur2, ui.input('rate', d.rate, { num: 1 })) + ui.field('Adresse', ui.input('address', d.address)) +
        '<div class="row2">' + ui.field('Téléphone', ui.input('phone', d.phone, { tel: 1 })) + ui.field('Courriel', ui.input('email', d.email, { type: 'email' })) + '</div>' +
        '<div class="fld"><span>Mentions légales (libellés modifiables)</span>' + legalHtml(d.legal) + '</div>' + imgField('stamp', 'Sceau / cachet', d.stamp);
      return '<div class="fld"><span>Modules à activer</span>' + modulesHtml(d.modules) + '</div>' + vocabHtml(d.vocab) + ui.field('Conditions de paiement', '<textarea name="terms" rows="2">' + esc(d.terms) + '</textarea>', 'Imprimées sur les factures.');
    };
    const read = () => {
      const b = el.querySelector('.body'); Object.assign(d, ui.read(b));
      if (step === 1) readLegal(b, d.legal);
      if (step === 2) { b.querySelectorAll('[data-mod]').forEach(c => d.modules[c.dataset.mod] = c.checked); b.querySelectorAll('[data-vocab]').forEach(i => d.vocab[i.dataset.vocab] = i.value.trim() || d.vocab[i.dataset.vocab]); }
    };
    const draw = () => {
      el.innerHTML = '<div class="wbox"><div class="dots">' + steps.map((s, i) => '<i class="' + (i <= step ? 'on' : '') + '"></i>').join('') + '</div><h1>' + (step === 0 ? 'Bienvenue dans CISPOLstore Business' : esc(steps[step])) + '</h1><p class="muted">Étape ' + (step + 1) + ' sur 3 — ' + steps[step] + '</p><div class="body">' + body() + '</div><div class="wfoot">' + (step ? '<button class="btn ghost" data-back>Retour</button>' : '<span></span>') + '<button class="btn primary" data-next>' + (step === 2 ? 'Terminer' : 'Suivant') + '</button></div></div>';
      bindImgs(el, d);
      el.querySelector('[data-back]') && (el.querySelector('[data-back]').onclick = () => { read(); step--; draw(); });
      el.querySelector('[data-next]').onclick = () => {
        read();
        if (step === 0) { if (!d.name) return App.toast('Indiquez le nom de l\'entreprise', 'err'); if (d.activity !== el._act) { apply(d.activity); el._act = d.activity; } }
        if (step === 1) { if (d.currency === d.cur2) return App.toast('Choisissez deux devises différentes', 'err'); if (!(d.rate > 0)) return App.toast('Taux invalide', 'err'); }
        if (step < 2) { step++; return draw(); }
        d.setup = true; Object.assign(App.db.settings, d); App.log('setup', d.name); App.flush(); el.remove(); ui.applyTheme(); App.emit('settings'); App.go('home'); App.toast('Entreprise enregistrée');
      };
    };
    el._act = d.activity; draw(); setTimeout(() => { const i = el.querySelector('input'); i && i.focus(); }, 50);
  };

  // ---------- settings screen ----------
  const customFields = () => {
    return Object.entries(entities).map(([k, label]) => '<div class="cf"><h4>' + label + '</h4>' + (S().fields[k].length ? S().fields[k].map(f => '<div class="cfrow"><span>' + esc(f.label) + ' <small>(' + (ftypes.find(t => t[0] === f.type) || [0, f.type])[1] + (f.options ? ' : ' + esc(f.options) : '') + ')</small></span><button class="btn ghost sm" data-cfdel="' + k + '|' + f.id + '">Supprimer</button></div>').join('') : '<p class="muted">Aucun champ.</p>') + '<button class="btn ghost sm" data-cfadd="' + k + '">+ Ajouter un champ</button></div>').join('');
  };
  App.views.settings = {
    title: 'Réglages',
    render(el) {
      const s = S();
      el.innerHTML = '<div class="page set">' +
        '<section class="card"><h3>Entreprise</h3>' + ui.field('Nom', '<input data-p="name" value="' + esc(s.name) + '">') + ui.field('Activité', '<select data-p="activity">' + Object.entries(App.PRESETS).map(([k, v]) => '<option value="' + k + '"' + (s.activity === k ? ' selected' : '') + '>' + v.label + '</option>').join('') + '</select>', 'Changer l\'activité ne modifie pas vos modules.') +
        '<div class="row2">' + ui.field('Ville', '<input data-p="city" value="' + esc(s.city) + '">') + ui.field('Slogan', '<input data-p="slogan" value="' + esc(s.slogan) + '">') + '</div>' +
        ui.field('Adresse', '<input data-p="address" value="' + esc(s.address) + '">') + '<div class="row2">' + ui.field('Téléphone', '<input data-p="phone" inputmode="tel" value="' + esc(s.phone) + '">') + ui.field('Courriel', '<input data-p="email" type="email" value="' + esc(s.email) + '">') + '</div>' +
        ui.field('Conditions de paiement', '<textarea data-p="terms" rows="2">' + esc(s.terms) + '</textarea>') + '<div class="fld"><span>Mentions légales</span><div id="legal">' + legalHtml(s.legal) + '</div><button class="btn ghost sm" id="addlegal">+ Ajouter une mention</button></div>' + imgField('logo', 'Logo', s.logo) + imgField('stamp', 'Sceau / cachet', s.stamp) + '</section>' +
        '<section class="card"><h3>Devises</h3><div class="row2">' + ui.field('Principale', '<select data-p="currency">' + curOpts().map(o => '<option value="' + o[0] + '"' + (s.currency === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>') + ui.field('Secondaire', '<select data-p="cur2">' + curOpts().map(o => '<option value="' + o[0] + '"' + (s.cur2 === o[0] ? ' selected' : '') + '>' + o[1] + '</option>').join('') + '</select>') + '</div>' +
        '<button class="btn ghost" id="rate">Taux : 1 ' + esc(s.currency) + ' = ' + esc(s.rate) + ' ' + esc(s.cur2) + ' — modifier</button></section>' +
        '<section class="card"><h3>Modules</h3><p class="muted">Un module désactivé disparaît des menus, de l\'accueil et des rapports.</p>' + modulesHtml(s.modules) + '</section>' +
        '<section class="card"><h3>Vocabulaire</h3>' + vocabHtml(s.vocab) + '</section>' +
        '<section class="card"><h3>Champs personnalisés</h3><div id="cfs">' + customFields() + '</div></section>' +
        '<section class="card"><h3>Apparence</h3><div class="seg" id="theme">' + [['auto', 'Auto'], ['light', 'Clair'], ['dark', 'Sombre']].map(t => '<button data-t="' + t[0] + '" class="' + (s.theme === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') + '</div></section></div>';
      const redo = () => App.views.settings.render(el);
      el.querySelectorAll('[data-p]').forEach(i => i.onchange = () => {
        const k = i.dataset.p; s[k] = i.value.trim();
        if (k === 'currency' || k === 'cur2') { if (s.currency === s.cur2) { App.toast('Les deux devises doivent différer', 'err'); s[k] = k === 'currency' ? (s.currency === 'USD' ? 'EUR' : 'USD') : (s.cur2 === 'CDF' ? 'USD' : 'CDF'); return redo(); } redo(); }
        App.save(); App.emit('settings');
      });
      bindImgs(el, s);
      const lg = el.querySelector('#legal'), saveLegal = () => { readLegal(lg, s.legal); App.save(); };
      lg.oninput = saveLegal; el.querySelector('#addlegal').onclick = () => { s.legal.push({ k: 'Mention', v: '' }); App.save(); redo(); };
      el.querySelector('#rate').onclick = () => { ui.rateSheet(); };
      el.querySelectorAll('[data-mod]').forEach(c => c.onchange = () => { s.modules[c.dataset.mod] = c.checked; App.save(); App.emit('settings'); });
      el.querySelectorAll('[data-vocab]').forEach(i => i.onchange = () => { s.vocab[i.dataset.vocab] = i.value.trim() || s.vocab[i.dataset.vocab]; App.save(); App.emit('settings'); });
      el.querySelectorAll('#theme button').forEach(b => b.onclick = () => { s.theme = b.dataset.t; App.save(); ui.applyTheme(); redo(); });
      el.querySelectorAll('[data-cfdel]').forEach(b => b.onclick = () => { const [k, id] = b.dataset.cfdel.split('|'); s.fields[k] = s.fields[k].filter(f => f.id !== id); App.save(); redo(); });
      el.querySelectorAll('[data-cfadd]').forEach(b => b.onclick = () => {
        const k = b.dataset.cfadd;
        ui.sheet({ title: 'Nouveau champ — ' + entities[k], html: ui.field('Libellé', ui.input('label', '', { ph: 'Ex. Immatriculation' })) + ui.field('Type', ui.select('type', ftypes, 'text')) + ui.field('Choix (type Liste)', ui.input('options', '', { ph: 'Séparés par des virgules' })),
          actions: [{ label: 'Annuler', cls: 'ghost' }, { label: 'Ajouter', cls: 'primary', fn: sh => { const v = ui.read(sh.body); if (!v.label) { App.toast('Libellé requis', 'err'); return false; } s.fields[k].push({ id: App.uid(), label: v.label, type: v.type, options: v.type === 'list' ? v.options : '' }); App.save(); redo(); } }] });
      });
    }
  };
})();
