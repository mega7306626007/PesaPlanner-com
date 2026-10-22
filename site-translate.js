/* Authored Sheng UI copy plus full-page Google translation links. */
(() => {
  const localeKey = 'pesaplanner-language';
  const pageName = location.pathname.split('/').pop() || 'index.html';
  const page = /\/learn\//i.test(location.pathname) ? `learn/${pageName}` : pageName;
  const current = document.getElementById('siteLanguage');
  const main = document.querySelector('main');
  const urlForTranslation = () => {
    if (/^https?:$/.test(location.protocol)) return location.href;
    const canonical = document.querySelector('link[rel="canonical"]')?.href;
    if (canonical && /^https:\/\//i.test(canonical)) return canonical;
    const path = location.pathname.replace(/^.*?New%20folder%20\(3\)\//i, '').replace(/^.*?New folder \(3\)\//i, '');
    return `https://pesaplanner.co.ke/${path || 'index.html'}`;
  };
  const googleTranslate = (language) => {
    if (!['sw', 'fr'].includes(language)) return;
    try { localStorage.setItem(localeKey, language); } catch (_) {}
    const url = new URL('https://translate.google.com/');
    url.searchParams.set('sl', 'en'); url.searchParams.set('tl', language);
    url.searchParams.set('op', 'websites'); url.searchParams.set('text', urlForTranslation());
    window.open(url.href, '_blank', 'noopener');
  };
  const translations = {
    'learn/index.html': {
      '.back': '← Rudi kwa app', '.eyebrow': 'Mwongozo wa pesa wa mtaa', 'h1': 'Mwezi iko katikati.<br>Pesa ilienda wapi?', '.lead': 'Rent ilichukua yake. Fare inaongea. Shopping list inaongeza vitu yenyewe. Hizi lesson fupi zitakusaidia kupanga pesa uko nayo, bila kujifanya maisha hufuata spreadsheet.', '#topics': 'Anza hapa',
      '.card:nth-child(1) h3': 'Tengeneza budget inaweza bend', '.card:nth-child(1) p': 'Panga income, vitu lazima, spending na goals—hata kama pesa inaingia kidogo kidogo.', '.card:nth-child(1) a': 'Soma lesson ya budget →',
      '.card:nth-child(2) h3': 'Elewa deni kabla ukubali loan', '.card:nth-child(2) p': 'Linganisha total ya kulipa, tarehe na consequences; loan ya haraka isiwe surprise ya baadaye.', '.card:nth-child(2) a': 'Soma lesson ya kukopa →',
      '.card:nth-child(3) h3': 'Fanya saving iwe rahisi kushikilia', '.card:nth-child(3) p': 'Weka amount na deadline ya goal, anza na contribution unaweza afford, na plan ya setbacks.', '.card:nth-child(3) a': 'Soma lesson ya kuweka →',
      '.chips span:nth-child(1)': 'Maneno rahisi', '.chips span:nth-child(2)': 'Mifano ya Kenya', '.chips span:nth-child(3)': 'Hakuna pressure ya budget perfect',
      '.callout strong': 'Hizi ni elimu ya kawaida tu.', '.callout p': 'Hazichambui hali yako wala kukuambia uchague lender, investment au financial product fulani. Check terms za sasa na provider mwenyewe kabla ya kuamua.'
    },
    'learn/budgeting.html': {
      '.back': '← Lesson za pesa', '.eyebrow': 'Lesson 01 · Budget', 'h1': 'Budget haijaharibika.<br>Maisha hu-edit kila saa.', '.lead': 'Budget ni plan ya kazi, si promise kwamba fare, bei, income na relatives watakaa sawa. Ifanye rahisi ku-update reality ikibadilisha numbers.',
      '.article .callout strong': 'Anza na unajua.', '.article .callout p': 'Tumia pesa imeingia ama estimate ya kujihadhari. Tenga income ya kubahatisha mpaka ifike.',
      '.article h2:nth-of-type(1)': 'Jaribu plan ya sehemu nne', '.article .steps li:nth-child(1)': '<strong>Pesa inaingia:</strong> andika income inatoka wapi na inafika lini. Kama income si regular, panga na pesa imeingia kweli.', '.article .steps li:nth-child(2)': '<strong>Vitu lazima:</strong> rent, food ya msingi, fare, stima, school costs na minimum ya kulipa deni.', '.article .steps li:nth-child(3)': '<strong>Spending unaweza badilisha:</strong> airtime, kutoka, subscriptions na choices zingine. Weka limit inakuachia space ya maisha.', '.article .steps li:nth-child(4)': '<strong>Goals zinazofuata:</strong> savings, bills zinakuja na kulipa deni zaidi. Weka amount na date ikiwezekana.',
      '.article h2:nth-of-type(2)': 'Fanya check-in kila wiki', '.article p:nth-of-type(2)': 'Wiki ikianza, compare pesa iko available na bills due kabla income ingine ifike. Katikati ya wiki, record change. Wiki ikiisha, adjust plan ya wiki ingine—target ikikosekana si failure.',
      '.article .example strong': 'Mfano tu — si budget ya kukuambia ufuate.', '.article .example p': 'Kama KSh 6,000 imeingia ya wiki, kwanza tenga rent na fare due kabla payment ingine ifike. Kama commitments ni KSh 4,200, ile KSh 1,800 inabaki kulipia food, choices zingine na goal. Split ya ukweli inategemea mtu na nyumba.',
      '.article h2:nth-of-type(3)': 'Pesa ikifika kidogo kidogo', '.article p:nth-of-type(3)': 'Weka due dates karibu na income dates. Shikilia pesa ya commitments za karibu kabla huite balance ya kutumia. “Safe to spend” estimate inajua tu bills na transactions uliorecord—icheck kabla uamue.',
      '.article h2:nth-of-type(4)': 'Acha plan ionekane', '.article p:nth-of-type(4)': 'Panga spending kwa categories chache unaweza maintain. Track cash pia kama M-Pesa ama bank inainfluence decisions. Review plan rent ikibadilika, term mpya ikianza, job ikibadilika ama responsibilities za home ziki-change.'
    },
    'learn/debt.html': {
      '.back': '← Lesson za pesa', '.eyebrow': 'Lesson 02 · Kukopa', 'h1': 'Kabla ukope,<br>jua gharama yote.', '.lead': 'Iyo KSh 500 ya haraka inaweza kuja na fees, tarehe na consequences haziondoki haraka. Tulia, soma total ya kulipa uone kama cash flow yako inaweza carry.', '.article h2:nth-of-type(1)': 'Jiulize hizi kwanza',
      '.article .steps li:nth-child(1)': 'Nitapokea ngapi, na jumla natakiwa kulipa ngapi?', '.article .steps li:nth-child(2)': 'Interest, fees, taxes, penalties na charges zingine ni ngapi? Zinafaa kulipwa lini?', '.article .steps li:nth-child(3)': 'Nikituma late, nikikosa payment ama nikitaka kulipa mapema, nini itafanyika?', '.article .steps li:nth-child(4)': 'Naweza lipa baada ya essentials na commitments zingine—hata wiki yenye income iko chini?', '.article .steps li:nth-child(5)': 'Provider amepewa license ya hii product? Naweza soma agreement yote kabla nikubali?',
      '.article .callout strong': 'Linganisha total, si instalment pekee.', '.article .callout p': 'Instalment inaonekana ndogo inaweza kuficha muda mrefu wa kulipa ama fees zingine. Mwambie provider akuonyeshe total na payment schedule kwa maandishi.',
      '.article h2:nth-of-type(2)': 'Linganishia repayment na tarehe', '.article p:nth-of-type(1)': 'Weka repayment date karibu na income dates na bills. Kama repayment inategemea income hauna uhakika nayo, tafuta backup plan kabla ya kukopa. Usikope loan ingine ya kulipa ya kwanza bila kuelewa total cost na matokeo yake.',
      '.article h2:nth-of-type(3)': 'Hifadhi record', '.article p:nth-of-type(2)': 'Hifadhi agreement, amount ilitumwa, confirmations za kulipa na messages za changes. Figures zikikataa match na mlivyokubaliana, contact provider kwa official support na uhifadhi reply.',
      '.article .example strong': 'Mfano tu.', '.article .example p': 'Kwa loan ya mfano ya KSh 5,000, compare pesa unapokea na payments zote zimepangwa. Difference ndiyo gharama ya kukopa kabla ya consequences zingine. Tumia disclosure ya sasa ya provider kupata figures za ukweli; cost hutegemea product na customer.'
    },
    'learn/saving.html': {
      '.back': '← Lesson za pesa', '.eyebrow': 'Lesson 03 · Kuweka', 'h1': 'Kuweka pesa wakati kila shilling<br>tayari ina kazi.', '.lead': '“Nifaa kuweka” ni idea poa. Halafu rent, shopping na bill ya kushtukiza wanaingia group chat. Weka amount na timeline ina-fit cash flow yako ya ukweli.', '.article h2:nth-of-type(1)': 'Ipe goal shape',
      '.article .steps li:nth-child(1)': 'Ipe jina: fees, emergency buffer, equipment, safari ama priority ingine.', '.article .steps li:nth-child(2)': 'Chagua target amount na date. Kama hauna uhakika, sema wazi ni estimate.', '.article .steps li:nth-child(3)': 'Rudi nyuma uone contribution ina-fit. Kama income si regular, amua utaweka ngapi pesa ikiingia badala ya kutegemea date fixed ya kila mwezi.', '.article .steps li:nth-child(4)': 'Chagua mahali pa kushikilia pesa ukijali access, safety, fees, terms na mahitaji yako. Elewa product kabla uitumie.',
      '.article .example strong': 'Mfano tu — ibadilishe ifit hali yako.', '.article .example p': 'Target ya KSh 3,000 ndani ya wiki 10 ingehitaji average ya KSh 300 kila wiki kama contributions ni sawa. Wiki zingine zikibana, weka minimum ndogo halafu ongeza ukiweza; deadline inaweza sogea.',
      '.article h2:nth-of-type(2)': 'Ifanye imara', '.article p:nth-of-type(1)': 'Anza na contribution unaweza rudia baada ya essentials. Ukikosa wiki, hiyo ni info: review target, amount ama timing. Tenga goal ya muda mfupi na pesa ya bills zinakuja.',
      '.article h2:nth-of-type(3)': 'Angalia trade-offs', '.article p:nth-of-type(2)': 'Kabla uchague account ama savings product, check rules za kutoa, charges, interest conditions na nini hutokea ukitoa mapema. Rates na terms hubadilika, confirm na provider. Usiweke pesa huwezi afford kupoteza kwa investment kwa sababu wamepromise return.',
      '.article h2:nth-of-type(4)': 'Sherehekea progress bila kupoteza plan', '.article p:nth-of-type(3)': 'Record kila contribution na ucheck kiasi imebaki. Goal ikibadilika—kama semester imeongeza cost—update plan badala ya kuiba kimya pesa ya commitment ingine.'
    },
    'privacy.html': { 'h1': 'Privacy yako', 'main > p:nth-of-type(2)': 'Hii notice inaelezea vile site na app zinafanya sasa. Publisher anafaa ku-review kila release na service kabla ya kusasisha.', 'h2:nth-of-type(1)': 'Website', 'h2:nth-of-type(2)': 'Records za app kwa simu yako', 'h2:nth-of-type(3)': 'SMS na notifications', 'h2:nth-of-type(4)': 'Files na exports', 'h2:nth-of-type(5)': 'Plan za kulipia na payment info', 'h2:nth-of-type(6)': 'Kushare na kuhifadhi data', 'h2:nth-of-type(7)': 'Choices na maombi yako', 'h2:nth-of-type(8)': 'Security, watoto na updates' },
    'terms.html': { 'h1': 'Terms za kutumia', 'h2:nth-of-type(1)': 'App inafanya nini', 'h2:nth-of-type(2)': 'Simu yako na info', 'h2:nth-of-type(3)': 'Plan za kulipia', 'h2:nth-of-type(4)': 'Upatikanaji na kupotea kwa data', 'h2:nth-of-type(5)': 'Matumizi yanakubalika na umiliki', 'h2:nth-of-type(6)': 'Changes na haki zako' },
    'security.html': { 'h1': 'Info ya security', 'h2:nth-of-type(1)': 'Protections za sasa', 'h2:nth-of-type(2)': 'Limitations zinazojulikana', 'h2:nth-of-type(3)': 'Ripoti concern' },
    'data-deletion.html': { 'h1': 'Futa data yako', 'h2:nth-of-type(1)': 'Ondoa app data kwa simu', 'h2:nth-of-type(2)': 'Omba payment-service data ifutwe', 'h2:nth-of-type(3)': 'Website preferences' },
    'cookies.html': { 'h1': 'Cookies na browser storage', 'h2:nth-of-type(1)': 'Analytics ya hiari', 'h2:nth-of-type(2)': 'Badilisha choice yako' },
    'reviews.html': { '.back': '← Rudi PesaPlanner', '.eyebrow': 'Maoni yako ni muhimu', 'h1': 'PesaPlanner inakusaidia aje?', '.intro': 'Chagua nyota. Ukitaka, tuambie ulipenda nini ama tunafaa kuboresha nini. Jina si lazima. Weka email kama unataka reply tu.' }
  };
  const applySheng = (on) => {
    const map = translations[page];
    if (!map) return false;
    Object.entries(map).forEach(([selector, value]) => {
      const node = document.querySelector(selector);
      if (!node) return;
      if (!node.dataset.originalHtml) node.dataset.originalHtml = node.innerHTML;
      node.innerHTML = on ? value : node.dataset.originalHtml;
    });
    document.documentElement.lang = on ? 'en-KE' : 'en';
    return true;
  };
  const addStyles = () => {
    if (document.getElementById('site-translate-styles')) return;
    const style = document.createElement('style'); style.id = 'site-translate-styles';
    style.textContent = '.site-translate-toolbar{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;padding:12px 18px;background:#0c1a2b;color:#b9c8dc;border-bottom:1px solid #26364b;font:500 13px/1.45 system-ui,sans-serif}.site-translate-toolbar select,.site-translate-toolbar button{border:1px solid #43546c;border-radius:10px;padding:9px 12px;background:#14243a;color:#f4f7fc;font:inherit}.site-translate-toolbar button{background:#f6c453;border-color:#f6c453;color:#17130a;font-weight:750;cursor:pointer}.site-translate-toolbar button:focus-visible,.site-translate-toolbar select:focus-visible{outline:3px solid #77a9ff;outline-offset:2px}.site-translate-note{max-width:620px}.site-translate-standalone{margin:0 0 16px;border:1px solid #26364b;border-radius:14px}.site-translate-standalone label{font-weight:700}@media(max-width:600px){.site-translate-toolbar{justify-content:flex-start;padding:12px}.site-translate-note{flex-basis:100%}}';
    document.head.append(style);
  };
  if (current || !main) return;
  addStyles();
  const toolbar = document.createElement('div'); toolbar.className = 'site-translate-toolbar site-translate-standalone';
  toolbar.innerHTML = '<label for="siteTranslateLanguage">Language</label><select id="siteTranslateLanguage" aria-label="Choose page language"><option value="mix">Original / Mix</option><option value="sheng">Sheng</option><option value="sw">Kiswahili</option><option value="fr">Français</option></select><button type="button">Translate full page with Google ↗</button><span class="site-translate-note">Sheng uses PesaPlanner-written copy for this page’s headings and key text. Kiswahili and French open in Google Translate.</span>';
  main.before(toolbar);
  const picker = toolbar.querySelector('select'), note = toolbar.querySelector('.site-translate-note');
  try { const saved = localStorage.getItem(localeKey); if (['sw','fr','sheng'].includes(saved)) picker.value = saved; } catch (_) {}
  picker.addEventListener('change', () => {
    const language = picker.value;
    try { localStorage.setItem(localeKey, language); } catch (_) {}
    if (language === 'sheng') {
      const complete = applySheng(true);
      note.textContent = complete ? 'Showing PesaPlanner-written Sheng headings and key text. Details with legal or payment meaning stay in their original wording for accuracy.' : 'This page does not yet have authored Sheng copy. Original wording is shown.';
    } else {
      applySheng(false);
      note.textContent = language === 'mix' ? 'Original / Mix wording selected.' : 'Google opens the public page in a new tab. Automated wording can be imperfect; check English for legal or payment details.';
    }
  });
  toolbar.querySelector('button').addEventListener('click', () => {
    if (['sw','fr'].includes(picker.value)) googleTranslate(picker.value);
    else note.textContent = picker.value === 'sheng' ? 'Sheng is authored by PesaPlanner on this page; no Google translation is used.' : 'Choose Kiswahili or French to translate the full page with Google.';
  });
  if (picker.value === 'sheng') picker.dispatchEvent(new Event('change'));
})();
