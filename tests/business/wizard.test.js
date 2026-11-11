const { check, launch, setup } = require('./helper');
(async () => {
  const t = await launch(), p = t.page;
  check('assistant affiché au premier lancement', await p.isVisible('.wizard'));
  await p.click('[data-next]'); check('nom obligatoire', await p.isVisible('.wizard') && (await p.textContent('.wbox h1')).includes('Bienvenue'));
  await p.fill('.wizard input[name=name]', 'Cabinet Test'); await p.selectOption('.wizard select[name=activity]', 'cabinet'); await p.click('[data-next]');
  check('devises par défaut USD/CDF', (await p.inputValue('select[name=currency]')) === 'USD' && (await p.inputValue('select[name=cur2]')) === 'CDF');
  await p.selectOption('select[name=cur2]', 'USD'); await p.click('[data-next]'); check('devises identiques refusées', await p.isVisible('.toast.err'));
  await p.selectOption('select[name=cur2]', 'CDF'); await p.click('[data-next]');
  check('préréglage cabinet : vocabulaire patient', (await p.inputValue('[data-vocab=client]')) === 'patient');
  check('préréglage cabinet : module services coché', await p.isChecked('[data-mod=services]') && !(await p.isChecked('[data-mod=stock]')));
  await p.click('[data-next]'); await p.waitForSelector('.wizard', { state: 'detached' });
  check('accueil après assistant', (await p.textContent('#ttl')) === 'Cabinet Test');
  check('onglet Clients renommé Patients', (await p.textContent('#tabs')).includes('Patients'));
  await t.reload(); check('réglages conservés après rechargement', !(await p.isVisible('.wizard')) && (await p.textContent('#ttl')) === 'Cabinet Test');
  check('aucune erreur JS', t.errors.length === 0, t.errors.join(' | ')); await t.browser.close();
})().catch(e => { console.log('FAIL exception → ' + e.message); process.exit(1); });
