const STORAGE_KEY = 'zafbat_execution_os_v5';
const LEGACY_STORAGE_KEYS = ['zafbat_execution_os_v1'];
const LOCK_TIMEOUT_MS = 12 * 60 * 1000;

const SPECIALTIES = [
  'Tracage','Terrassement','Coffrage','Aide coffrage','Ferraillage','Beton',
  'Maconnerie','Etancheite','Plomberie','Electricite','Carrelage','Platre',
  'Menuiserie alu','Menuiserie bois','Peinture','Facade','VRD','Piscine','Domotique','Finitions'
];

const DOC_TYPES = [
  {id:'devis', label:'Devis'},
  {id:'contrat', label:'Contrat'},
  {id:'avenant', label:'Avenant'},
  {id:'situation', label:'Situation'},
  {id:'pv', label:'PV réception'},
  {id:'audit', label:'Audit chantier'}
];

const ADJACENT_SPECIALTIES = {
  'Tracage':['Terrassement','VRD'],
  'Terrassement':['Tracage','VRD'],
  'Coffrage':['Aide coffrage','Ferraillage','Beton'],
  'Aide coffrage':['Coffrage','Beton'],
  'Ferraillage':['Coffrage','Beton'],
  'Beton':['Coffrage','Aide coffrage','Ferraillage'],
  'Maconnerie':['Platre','Facade'],
  'Etancheite':['Facade','Piscine'],
  'Plomberie':['Electricite','Domotique'],
  'Electricite':['Domotique','Plomberie'],
  'Carrelage':['Finitions','Platre'],
  'Platre':['Peinture','Finitions'],
  'Menuiserie alu':['Facade','Finitions'],
  'Menuiserie bois':['Finitions','Peinture'],
  'Peinture':['Finitions','Platre'],
  'Facade':['Etancheite','Peinture'],
  'VRD':['Terrassement','Tracage'],
  'Piscine':['Etancheite','Beton'],
  'Domotique':['Electricite'],
  'Finitions':['Peinture','Carrelage','Menuiserie bois']
};

const VIEWS = {
  dashboard:{title:'Dashboard', sub:'Vue consolidée des projets, du réseau d’exécution, du matching et du studio documentaire.'},
  projects:{title:'Projects', sub:'Portefeuille des opérations, données client, cadrage commercial et paramètres documentaires.'},
  network:{title:'Execution Network', sub:'Base partenaires approfondie : capacités, conformité, tarifs, couverture et mémoire d’exécution.'},
  matching:{title:'Matching', sub:'Matching pondéré par spécialité, zone, disponibilité, historique, conformité et score de terrain.'},
  assignments:{title:'Assignments', sub:'Historique des affectations, revues de phase et décisions de réembauche.'},
  documents:{title:'Documents', sub:'Studio documentaire branché aux données projet, avec snapshots figés et empreinte.'},
  activity:{title:'Activity Log', sub:'Journal d’activité append-only du coffre local chiffré.'},
  settings:{title:'Settings', sub:'Sécurité locale, export, import et paramètres de société.'}
};

const state = {
  vault: null,
  sessionPassphrase: null,
  currentView: 'dashboard',
  selectedProjectId: null,
  selectedContactId: null,
  selectedAssignmentId: null,
  selectedDocumentId: null,
  filters: {search:'', specialty:'', city:'', trust:'', projectStatus:''},
  matchDraft: {projectId:'', specialty:'', city:'', availability:'', legalStatus:'', minScore:55},
  docDraft: {projectId:'', type:'devis'}
};

const $ = (id) => document.getElementById(id);
const esc = (v='') => String(v).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const nowIso = () => new Date().toISOString();
const uid = (p='id') => `${p}_${Math.random().toString(36).slice(2,10)}${Date.now().toString(36).slice(-4)}`;
const shortDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const money = (v) => new Intl.NumberFormat('fr-MA', {style:'currency', currency:'MAD', maximumFractionDigits:0}).format(Number(v || 0));
const pct = (v) => `${Math.round(Number(v || 0))}%`;
const yesNo = (v) => v ? 'Oui' : 'Non';
const csvList = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map(x => String(x).trim()).filter(Boolean);
const unique = (arr) => Array.from(new Set(arr.filter(Boolean)));
const avg = (arr) => { const items = arr.filter(n => Number(n) > 0).map(Number); return items.length ? items.reduce((a,b)=>a+b,0) / items.length : 0; };
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function availabilityDaysFromText(v='') {
  const t = String(v).toLowerCase();
  if (!t) return 14;
  if (t.includes('dispo')) return 0;
  const n = Number((t.match(/\d+/) || [14])[0]);
  if (t.includes('jour')) return n;
  if (t.includes('semaine')) return n * 7;
  if (t.includes('mois')) return n * 30;
  return n || 14;
}

function toBase64(buf){ return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function fromBase64(b64){ return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }
async function deriveKey(passphrase, salt){
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {name:'PBKDF2', salt, iterations:250000, hash:'SHA-256'},
    baseKey,
    {name:'AES-GCM', length:256},
    false,
    ['encrypt','decrypt']
  );
}
async function encryptVault(vault, passphrase){
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const payload = new TextEncoder().encode(JSON.stringify(vault));
  const encrypted = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, payload);
  return {salt:toBase64(salt), iv:toBase64(iv), cipher:toBase64(encrypted), meta:{version:5, updatedAt:nowIso()}};
}
async function decryptVault(envelope, passphrase){
  const salt = fromBase64(envelope.salt);
  const iv = fromBase64(envelope.iv);
  const key = await deriveKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt({name:'AES-GCM', iv}, key, fromBase64(envelope.cipher));
  return JSON.parse(new TextDecoder().decode(decrypted));
}
async function sha256(text){
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,16);
}

function defaultProject(project={}){
  return {
    id: project.id || uid('proj'),
    code: project.code || '',
    name: project.name || '',
    clientType: project.clientType || 'particulier',
    clientName: project.clientName || '',
    clientAddress: project.clientAddress || '',
    clientEmail: project.clientEmail || '',
    clientPhone: project.clientPhone || '',
    architect: project.architect || '',
    bet: project.bet || '',
    location: project.location || '',
    status: project.status || 'appel offre',
    phase: project.phase || '',
    requiredSpecialties: unique(csvList(project.requiredSpecialties || [])),
    startDate: project.startDate || '',
    endDate: project.endDate || '',
    budgetHT: Number(project.budgetHT ?? project.budget ?? 0),
    budgetTTC: Number(project.budgetTTC ?? project.budget ?? 0),
    depositPercent: Number(project.depositPercent ?? 30),
    delayDays: Number(project.delayDays ?? 90),
    progressPercent: Number(project.progressPercent ?? 0),
    paymentTerms: project.paymentTerms || '30% à la commande · situations intermédiaires · solde à la réception sous réserves ciblées.',
    scopeSummary: project.scopeSummary || project.description || '',
    inclusions: unique(csvList(project.inclusions || [])),
    exclusions: unique(csvList(project.exclusions || [])),
    assumptions: unique(csvList(project.assumptions || [])),
    notes: project.notes || ''
  };
}

function defaultContact(contact={}){
  const specialties = unique([contact.primarySpecialty || '', ...csvList(contact.specialties || [])]);
  const compliance = contact.compliance || {};
  return {
    id: contact.id || uid('ct'),
    kind: contact.kind || 'sous-traitant',
    name: contact.name || '',
    tradeName: contact.tradeName || '',
    primarySpecialty: contact.primarySpecialty || specialties[0] || SPECIALTIES[0],
    specialties: unique([contact.primarySpecialty || specialties[0] || SPECIALTIES[0], ...specialties]),
    city: contact.city || '',
    zones: unique(csvList(contact.zones || [contact.city || ''])),
    phone: contact.phone || '',
    whatsapp: contact.whatsapp || '',
    email: contact.email || '',
    legalStatus: contact.legalStatus || 'informel',
    trust: contact.trust || 'moyen',
    availability: contact.availability || '7 jours',
    availabilityDays: Number(contact.availabilityDays ?? availabilityDaysFromText(contact.availability || '7 jours')),
    rateDay: Number(contact.rateDay ?? 0),
    ratePackage: Number(contact.ratePackage ?? 0),
    crewSize: Number(contact.crewSize ?? 1),
    yearsExperience: Number(contact.yearsExperience ?? 0),
    canLeadTeam: Boolean(contact.canLeadTeam ?? false),
    ownTools: Boolean(contact.ownTools ?? false),
    hasVehicle: Boolean(contact.hasVehicle ?? false),
    minJobSize: contact.minJobSize || 'petit lot',
    paymentMode: contact.paymentMode || 'virement / espèce',
    languages: unique(csvList(contact.languages || ['Darija'])),
    tags: unique(csvList(contact.tags || [])),
    referralSource: contact.referralSource || '',
    lastKnownStage: contact.lastKnownStage || '',
    notes: contact.notes || '',
    active: contact.active !== false,
    compliance: {
      idReceived: Boolean(compliance.idReceived),
      contractSigned: Boolean(compliance.contractSigned),
      ndaSigned: Boolean(compliance.ndaSigned),
      bankInfo: Boolean(compliance.bankInfo),
      taxStatus: Boolean(compliance.taxStatus),
      safetyBriefing: Boolean(compliance.safetyBriefing)
    }
  };
}

function defaultAssignment(assignment={}){
  return {
    id: assignment.id || uid('as'),
    projectId: assignment.projectId || '',
    contactId: assignment.contactId || '',
    specialty: assignment.specialty || '',
    phase: assignment.phase || '',
    role: assignment.role || '',
    status: assignment.status || 'propose',
    from: assignment.from || '',
    to: assignment.to || '',
    quality: Number(assignment.quality ?? 0),
    reliability: Number(assignment.reliability ?? 0),
    speed: Number(assignment.speed ?? 0),
    discipline: Number(assignment.discipline ?? 0),
    rehire: assignment.rehire === undefined ? null : assignment.rehire,
    notes: assignment.notes || ''
  };
}

function normalizeVault(vault) {
  const company = vault.company || {};
  return {
    meta: {
      version: 5,
      companyName: company.name || vault.meta?.companyName || 'ZAF BAT',
      signatory: company.signatory || vault.meta?.signatory || 'Signataire',
      createdAt: vault.meta?.createdAt || nowIso(),
      updatedAt: vault.meta?.updatedAt || nowIso(),
      locale: vault.meta?.locale || 'fr-MA'
    },
    company: {
      name: company.name || vault.meta?.companyName || 'ZAF BAT',
      signatory: company.signatory || vault.meta?.signatory || 'Signataire',
      legalForm: company.legalForm || 'SARL',
      ice: company.ice || '',
      if: company.if || '',
      rc: company.rc || '',
      address: company.address || 'Casablanca',
      phone: company.phone || '',
      email: company.email || '',
      lockOnBlur: company.lockOnBlur !== false
    },
    projects: (vault.projects || []).map(defaultProject),
    contacts: (vault.contacts || []).map(defaultContact),
    assignments: (vault.assignments || []).map(defaultAssignment),
    documents: (vault.documents || []).map(d => ({...d, createdAt: d.createdAt || nowIso()})),
    activity: Array.isArray(vault.activity) ? vault.activity : []
  };
}

function sampleVault(companyName='ZAF BAT', signatory='Ahmed Yassine Fliyou'){
  const p1 = uid('proj');
  const p2 = uid('proj');
  const p3 = uid('proj');
  const c1 = uid('ct');
  const c2 = uid('ct');
  const c3 = uid('ct');
  const c4 = uid('ct');
  const a1 = uid('as');
  const a2 = uid('as');
  const a3 = uid('as');
  const a4 = uid('as');
  const createdAt = nowIso();
  return normalizeVault({
    meta:{companyName, signatory, createdAt, updatedAt:createdAt, locale:'fr-MA'},
    company:{name:companyName, signatory, legalForm:'SARL', address:'Casablanca', lockOnBlur:true},
    projects:[
      {
        id:p1,
        code:'ZB-VIL-2026-014',
        name:'Villa Calypso',
        clientType:'particulier',
        clientName:'M. et Mme B.',
        clientAddress:'Bouskoura, Casablanca',
        clientEmail:'client.calypso@example.com',
        clientPhone:'+212600001001',
        architect:'Atelier Atlas',
        bet:'BET Horizon',
        location:'Bouskoura',
        status:'en cours',
        phase:'second oeuvre',
        requiredSpecialties:['Menuiserie bois','Peinture','Finitions'],
        startDate:'2026-02-01',
        endDate:'2026-06-30',
        budgetHT:2700000,
        budgetTTC:3200000,
        depositPercent:30,
        delayDays:120,
        progressPercent:47,
        paymentTerms:'30% acompte · 30% à fin gros œuvre · 30% à fin second œuvre · 10% à la réception.',
        scopeSummary:'Villa R+1 haut de gamme avec second œuvre premium, finitions sur mesure et coordination architecte.',
        inclusions:['Coordination chantier','Lots décrits au devis','Reporting mensuel'],
        exclusions:['Décoration loose furniture','Honoraires architecte','Démarches administratives non précisées'],
        assumptions:['Accès site maintenu','Choix matériaux validés dans les temps','Acompte encaissé avant lancement des commandes'],
        notes:'Projet vitrine pour finitions premium.'
      },
      {
        id:p2,
        code:'ZB-REN-2026-009',
        name:'Rénovation Ain Diab',
        clientType:'societe',
        clientName:'Palm Asset SARL',
        clientAddress:'Casablanca Finance City',
        clientEmail:'procurement@palmasset.ma',
        clientPhone:'+212600001002',
        architect:'Studio Luma',
        bet:'BET Marine',
        location:'Casablanca',
        status:'appel offre',
        phase:'chiffrage',
        requiredSpecialties:['Tracage','Coffrage','Electricite'],
        startDate:'2026-03-10',
        endDate:'2026-07-15',
        budgetHT:1250000,
        budgetTTC:1480000,
        depositPercent:35,
        delayDays:95,
        progressPercent:5,
        paymentTerms:'35% à la commande · situations mensuelles · solde sur PV de réception.',
        scopeSummary:'Rénovation lourde d’une villa front de mer avec remise à niveau réseaux et reprise structurelle localisée.',
        inclusions:['Curage et préparation','Lots structurants chiffrés','Pilotage base planning'],
        exclusions:['Mobilier intégré non listé','Études structure complémentaires non transmises'],
        assumptions:['Études remises avant lancement','Site libéré','Décisions client sous 48h sur les variantes'],
        notes:'Dossier en cours de finalisation commerciale.'
      },
      {
        id:p3,
        code:'ZB-VIL-2026-021',
        name:'Villa Noura',
        clientType:'particulier',
        clientName:'Mme N.',
        clientAddress:'Dar Bouazza',
        clientEmail:'villa.noura@example.com',
        clientPhone:'+212600001003',
        architect:'Cabinet Mays',
        bet:'BET Oryx',
        location:'Dar Bouazza',
        status:'termine',
        phase:'livré',
        requiredSpecialties:['Tracage','Coffrage','Peinture'],
        startDate:'2025-09-01',
        endDate:'2026-01-20',
        budgetHT:1800000,
        budgetTTC:2140000,
        depositPercent:30,
        delayDays:135,
        progressPercent:100,
        paymentTerms:'30/40/20/10',
        scopeSummary:'Villa livrée avec pilotage complet et finitions architecturales.',
        inclusions:['Gros œuvre','Second œuvre','Finitions'],
        exclusions:['Paysagisme hors lot','Appareils décoratifs'],
        assumptions:['Client valide les échantillons avant commande'],
        notes:'Projet de référence livré dans les délais.'
      }
    ],
    contacts:[
      {
        id:c1,
        kind:'sous-traitant',
        name:'Hamid Coffrage',
        tradeName:'Coffrage Premium',
        primarySpecialty:'Coffrage',
        specialties:['Coffrage','Aide coffrage','Beton'],
        city:'Casablanca',
        zones:['Casablanca','Bouskoura','Dar Bouazza'],
        phone:'+212600000001',
        whatsapp:'+212600000001',
        email:'hamid.coffrage@example.com',
        legalStatus:'informel',
        trust:'eleve',
        availability:'7 jours',
        availabilityDays:7,
        rateDay:380,
        ratePackage:0,
        crewSize:6,
        yearsExperience:11,
        canLeadTeam:true,
        ownTools:true,
        hasVehicle:true,
        minJobSize:'lot moyen',
        paymentMode:'virement / espèce',
        languages:['Darija','Français'],
        tags:['villa premium','gros œuvre','réactif'],
        referralSource:'Architecte partenaire',
        lastKnownStage:'gros œuvre',
        notes:'Très bon sur villas et coordination de coffrage. Peu de reprises.',
        compliance:{idReceived:true, contractSigned:true, ndaSigned:false, bankInfo:true, taxStatus:false, safetyBriefing:true}
      },
      {
        id:c2,
        kind:'chef equipe',
        name:'Youssef Peinture',
        tradeName:'Youssef Finitions',
        primarySpecialty:'Peinture',
        specialties:['Peinture','Finitions','Platre'],
        city:'Casablanca',
        zones:['Casablanca','Bouskoura'],
        phone:'+212600000002',
        whatsapp:'+212600000002',
        email:'youssef.peinture@example.com',
        legalStatus:'auto-entrepreneur',
        trust:'moyen',
        availability:'disponible',
        availabilityDays:0,
        rateDay:300,
        ratePackage:0,
        crewSize:4,
        yearsExperience:8,
        canLeadTeam:true,
        ownTools:true,
        hasVehicle:false,
        minJobSize:'petit lot',
        paymentMode:'virement',
        languages:['Darija','Français'],
        tags:['finitions','chantier propre'],
        referralSource:'Bouche-à-oreille',
        lastKnownStage:'finitions',
        notes:'Bon rendu esthétique, vitesse variable selon préparation des supports.',
        compliance:{idReceived:true, contractSigned:false, ndaSigned:false, bankInfo:true, taxStatus:true, safetyBriefing:true}
      },
      {
        id:c3,
        kind:'sous-traitant',
        name:'Anas Traçage',
        tradeName:'Implantation Atlas',
        primarySpecialty:'Tracage',
        specialties:['Tracage','Terrassement','VRD'],
        city:'Bouskoura',
        zones:['Bouskoura','Dar Bouazza','Casablanca'],
        phone:'+212600000003',
        whatsapp:'+212600000003',
        email:'anas.tracage@example.com',
        legalStatus:'societe',
        trust:'eleve',
        availability:'15 jours',
        availabilityDays:15,
        rateDay:550,
        ratePackage:9500,
        crewSize:3,
        yearsExperience:10,
        canLeadTeam:true,
        ownTools:true,
        hasVehicle:true,
        minJobSize:'lot moyen',
        paymentMode:'virement',
        languages:['Darija','Français','Arabe'],
        tags:['implantation','démarrage','rigoureux'],
        referralSource:'BET Horizon',
        lastKnownStage:'préparation',
        notes:'Très fiable pour implantation et démarrage structuré.',
        compliance:{idReceived:true, contractSigned:true, ndaSigned:true, bankInfo:true, taxStatus:true, safetyBriefing:true}
      },
      {
        id:c4,
        kind:'sous-traitant',
        name:'Sami Electric',
        tradeName:'Sami Elec Services',
        primarySpecialty:'Electricite',
        specialties:['Electricite','Domotique'],
        city:'Casablanca',
        zones:['Casablanca','Ain Diab'],
        phone:'+212600000004',
        whatsapp:'+212600000004',
        email:'sami.elec@example.com',
        legalStatus:'societe',
        trust:'eleve',
        availability:'7 jours',
        availabilityDays:7,
        rateDay:520,
        ratePackage:0,
        crewSize:5,
        yearsExperience:13,
        canLeadTeam:true,
        ownTools:true,
        hasVehicle:true,
        minJobSize:'lot technique',
        paymentMode:'virement',
        languages:['Darija','Français'],
        tags:['technique','domotique','villa'],
        referralSource:'Client ancien',
        lastKnownStage:'réseaux',
        notes:'Très fiable pour villas et lots techniques.',
        compliance:{idReceived:true, contractSigned:true, ndaSigned:true, bankInfo:true, taxStatus:true, safetyBriefing:true}
      }
    ],
    assignments:[
      {id:a1, projectId:p3, contactId:c1, specialty:'Coffrage', phase:'gros œuvre', role:'équipe coffrage', status:'termine', from:'2025-09-06', to:'2025-10-15', quality:5, reliability:5, speed:4, discipline:4, rehire:true, notes:'Exécution propre, peu de reprises.'},
      {id:a2, projectId:p1, contactId:c2, specialty:'Peinture', phase:'finitions', role:'chef équipe', status:'planifie', from:'2026-05-20', to:'', quality:0, reliability:0, speed:0, discipline:0, rehire:null, notes:'Réservé sur phase finitions.'},
      {id:a3, projectId:p2, contactId:c3, specialty:'Tracage', phase:'préparation', role:'implantation', status:'propose', from:'2026-03-12', to:'2026-03-13', quality:0, reliability:0, speed:0, discipline:0, rehire:null, notes:'À confirmer selon go client.'},
      {id:a4, projectId:p3, contactId:c4, specialty:'Electricite', phase:'second œuvre', role:'équipe lots techniques', status:'termine', from:'2025-11-01', to:'2025-12-05', quality:5, reliability:4, speed:4, discipline:5, rehire:true, notes:'Exécution très propre sur réseaux et tableau.'}
    ],
    documents:[],
    activity:[
      {id:uid('act'), at:createdAt, type:'vault_created', detail:'Coffre initialisé'},
      {id:uid('act'), at:createdAt, type:'seed_loaded', detail:'Jeu de données V5 chargé'}
    ]
  });
}

function getEnvelope(){
  const primary = localStorage.getItem(STORAGE_KEY);
  if (primary) return {raw: primary, key: STORAGE_KEY};
  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    const raw = localStorage.getItem(legacyKey);
    if (raw) return {raw, key: legacyKey};
  }
  return null;
}
function hasVault(){ return !!getEnvelope(); }

function logActivity(type, detail){
  if (!state.vault) return;
  state.vault.activity.unshift({id:uid('act'), at:nowIso(), type, detail});
  state.vault.activity = state.vault.activity.slice(0, 500);
}
function touchUpdated(){ if (state.vault) state.vault.meta.updatedAt = nowIso(); }
async function persistVault(){
  if (!state.vault || !state.sessionPassphrase) return;
  touchUpdated();
  const envelope = await encryptVault(state.vault, state.sessionPassphrase);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  updateCounts();
}

function showToast(text, kind='ok'){
  const el = document.createElement('div');
  el.className = 'toast ' + (kind === 'error' ? 'error' : 'ok');
  el.textContent = text;
  $('toastStack').appendChild(el);
  setTimeout(() => el.remove(), 2800);
}
function setAuthMessage(id, text, cls=''){
  const el = $(id);
  el.className = 'auth-note ' + cls;
  el.textContent = text;
}
function initAuthView(){
  $('createVaultView').classList.toggle('hidden', hasVault());
  $('unlockVaultView').classList.toggle('hidden', !hasVault());
}

async function createVault(){
  const companyName = $('createCompanyName').value.trim() || 'ZAF BAT';
  const signatory = $('createSignatory').value.trim() || 'Signataire';
  const pass1 = $('createPassphrase').value;
  const pass2 = $('createPassphrase2').value;
  if (pass1.length < 10) return setAuthMessage('createVaultMessage', 'La phrase secrète doit contenir au moins 10 caractères.', 'error');
  if (pass1 !== pass2) return setAuthMessage('createVaultMessage', 'Les deux phrases secrètes ne correspondent pas.', 'error');
  state.vault = sampleVault(companyName, signatory);
  state.sessionPassphrase = pass1;
  logActivity('vault_initialized', 'Coffre créé et ouvert');
  await persistVault();
  openApp();
}

async function unlockVault(){
  const pass = $('unlockPassphrase').value;
  if (!pass) return setAuthMessage('unlockVaultMessage', 'Entre la phrase secrète.', 'error');
  try {
    const env = getEnvelope();
    const decrypted = await decryptVault(JSON.parse(env.raw), pass);
    state.vault = normalizeVault(decrypted);
    state.sessionPassphrase = pass;
    if (env.key !== STORAGE_KEY) await persistVault();
    openApp();
  } catch (e) {
    setAuthMessage('unlockVaultMessage', 'Phrase secrète invalide ou coffre corrompu.', 'error');
  }
}

function lockApp(){
  state.vault = null;
  state.sessionPassphrase = null;
  $('unlockPassphrase').value = '';
  $('appShell').classList.add('hidden');
  $('unlockScreen').classList.remove('hidden');
  initAuthView();
}

let idleTimer = null;
function resetIdleTimer(){
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    showToast('Session verrouillée après inactivité.', 'error');
    lockApp();
  }, LOCK_TIMEOUT_MS);
}
['click','keydown','mousemove','touchstart'].forEach(evt => window.addEventListener(evt, () => state.vault && resetIdleTimer(), {passive:true}));
document.addEventListener('visibilitychange', () => {
  if (state.vault && state.vault.company.lockOnBlur && document.hidden) {
    showToast('Session verrouillée au changement d’onglet.', 'error');
    lockApp();
  }
});

function openApp(){
  $('unlockScreen').classList.add('hidden');
  $('appShell').classList.remove('hidden');
  state.selectedProjectId = state.selectedProjectId || state.vault.projects[0]?.id || null;
  state.selectedContactId = state.selectedContactId || state.vault.contacts[0]?.id || null;
  state.selectedAssignmentId = state.selectedAssignmentId || state.vault.assignments[0]?.id || null;
  state.docDraft.projectId = state.docDraft.projectId || state.selectedProjectId || '';
  state.matchDraft.projectId = state.matchDraft.projectId || state.selectedProjectId || '';
  setView(state.currentView);
  resetIdleTimer();
  showToast('Coffre ouvert.');
}

function projectById(id){ return state.vault.projects.find(x => x.id === id); }
function contactById(id){ return state.vault.contacts.find(x => x.id === id); }
function assignmentById(id){ return state.vault.assignments.find(x => x.id === id); }
function documentById(id){ return state.vault.documents.find(x => x.id === id); }
function assignmentsForProject(projectId){ return state.vault.assignments.filter(a => a.projectId === projectId); }
function assignmentsForContact(contactId){ return state.vault.assignments.filter(a => a.contactId === contactId); }

function completedAssignmentsForContact(contactId){ return assignmentsForContact(contactId).filter(a => a.status === 'termine'); }
function contactStats(contactId){
  const items = completedAssignmentsForContact(contactId);
  return {
    quality: avg(items.map(a => a.quality)),
    reliability: avg(items.map(a => a.reliability)),
    speed: avg(items.map(a => a.speed)),
    discipline: avg(items.map(a => a.discipline)),
    projects: new Set(items.map(a => a.projectId)).size,
    rehireRate: items.length ? items.filter(a => a.rehire === true).length / items.length : 0,
    avgScore: avg(items.flatMap(a => [a.quality, a.reliability, a.speed, a.discipline]))
  };
}
function profileCompleteness(contact){
  const checks = [
    contact.name, contact.primarySpecialty, contact.city, contact.phone,
    contact.legalStatus, contact.availability, contact.rateDay || contact.ratePackage,
    contact.specialties?.length, contact.zones?.length, contact.languages?.length,
    contact.yearsExperience, contact.notes,
    ...Object.values(contact.compliance || {})
  ];
  const count = checks.filter(Boolean).length;
  return Math.round((count / checks.length) * 100);
}
function complianceScore(contact){
  const flags = Object.values(contact.compliance || {});
  return flags.length ? flags.filter(Boolean).length / flags.length : 0;
}

function trustBadge(val){
  const map = {eleve:'ok', moyen:'warn', faible:'danger'};
  return `<span class="badge ${map[val] || 'neutral'}">${esc(val || '—')}</span>`;
}
function statusBadge(val){
  const lc = String(val || '').toLowerCase();
  let kind = 'neutral';
  if (['en cours','actif','termine','disponible','livré'].includes(lc)) kind = 'ok';
  else if (['appel offre','planifie','propose','chiffrage'].includes(lc)) kind = 'warn';
  else if (['bloque','retard','faible'].includes(lc)) kind = 'danger';
  else kind = 'info';
  return `<span class="badge ${kind}">${esc(val || '—')}</span>`;
}
function docFingerprintPill(doc){ return `<span class="badge neutral">hash ${esc(doc.fingerprint)}</span>`; }

function updateCounts(){
  if (!state.vault) return;
  $('countProjectsSide').textContent = state.vault.projects.length;
  $('countProjectsSide2').textContent = state.vault.projects.length;
  $('countContactsSide').textContent = state.vault.contacts.length;
  $('countMatchingSide').textContent = state.vault.contacts.filter(c => c.active).length;
  $('countAssignmentsSide').textContent = state.vault.assignments.length;
  $('countDocumentsSide').textContent = state.vault.documents.length;
  $('countActivitySide').textContent = state.vault.activity.length;
}

function setView(view){
  state.currentView = view;
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  $('viewTitle').textContent = VIEWS[view].title;
  $('viewSub').textContent = VIEWS[view].sub;
  updateCounts();
  render();
}

function render(){
  switch(state.currentView){
    case 'dashboard': return renderDashboard();
    case 'projects': return renderProjects();
    case 'network': return renderNetwork();
    case 'matching': return renderMatching();
    case 'assignments': return renderAssignments();
    case 'documents': return renderDocuments();
    case 'activity': return renderActivity();
    case 'settings': return renderSettings();
  }
}

function renderDashboard(){
  const activeProjects = state.vault.projects.filter(p => p.status === 'en cours').length;
  const activeContacts = state.vault.contacts.filter(c => c.active).length;
  const avgCompleteness = Math.round(avg(state.vault.contacts.map(profileCompleteness)));
  const openDocs = state.vault.documents.length;
  const latestProjects = [...state.vault.projects].sort((a,b) => (b.startDate || '').localeCompare(a.startDate || ''));
  const topMatches = getMatchCandidates({
    projectId: state.vault.projects[0]?.id || '',
    specialty: state.vault.projects[0]?.requiredSpecialties?.[0] || SPECIALTIES[0],
    city: state.vault.projects[0]?.location || '',
    availability: '',
    legalStatus: '',
    minScore: 0
  }).slice(0,3);
  $('content').innerHTML = `
    <div class="kpis">
      <div class="card kpi"><div class="value">${state.vault.projects.length}</div><div class="label">Projects</div><div class="line"></div></div>
      <div class="card kpi blue"><div class="value">${activeContacts}</div><div class="label">Execution network</div><div class="line"></div></div>
      <div class="card kpi green"><div class="value">${avgCompleteness}</div><div class="label">Complétude profils</div><div class="line"></div></div>
      <div class="card kpi orange"><div class="value">${openDocs}</div><div class="label">Snapshots docs</div><div class="line"></div></div>
    </div>
    <div class="grid-main">
      <div class="card pane">
        <div class="section-title"><div class="label">Projects pipeline</div></div>
        <div class="summary-bar">
          <div><div class="micro">Projets actifs</div><div class="big">${activeProjects}</div></div>
          <div><div class="micro">Documents</div><div class="big">${openDocs}</div></div>
          <div><div class="micro">Dernière sauvegarde</div><div class="big" style="font-size:22px">${shortDate(state.vault.meta.updatedAt)}</div></div>
        </div>
        <div style="height:12px"></div>
        <div class="list-pane">
          ${latestProjects.map(p => `
            <div class="entity-card" data-open-project="${p.id}">
              <div class="entity-head">
                <div>
                  <div class="entity-title">${esc(p.name)}</div>
                  <div class="entity-meta">${esc(p.code)} · ${esc(p.location || '—')} · ${esc(p.clientName)}</div>
                </div>
                ${statusBadge(p.status)}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="detail-stack">
        <div class="card pane">
          <div class="section-title"><div class="label">Matching instantané</div></div>
          ${topMatches.map(m => `
            <div class="match-card" data-open-contact="${m.contact.id}">
              <div class="match-top">
                <div>
                  <div class="entity-title">${esc(m.contact.name)}</div>
                  <div class="entity-meta">${esc(m.contact.primarySpecialty)} · ${esc(m.contact.city || '—')} · équipe ${esc(m.contact.crewSize)}</div>
                </div>
                <div class="match-score">${m.total}</div>
              </div>
              <div class="fitbar"><span style="width:${m.total}%"></span></div>
              <div class="tag-row">${m.reasons.slice(0,3).map(r => `<span class="tag">${esc(r)}</span>`).join('')}</div>
            </div>
          `).join('') || `<div class="empty-state">Aucun candidat calculé.</div>`}
        </div>
        <div class="card pane">
          <div class="section-title"><div class="label">Activity feed</div></div>
          <div class="activity-list">
            ${state.vault.activity.slice(0,8).map(a => `<div class="activity-item"><div class="activity-meta">${shortDate(a.at)} · ${esc(a.type)}</div><div>${esc(a.detail)}</div></div>`).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
  document.querySelectorAll('[data-open-project]').forEach(el => el.onclick = () => { state.selectedProjectId = el.dataset.openProject; setView('projects'); });
  document.querySelectorAll('[data-open-contact]').forEach(el => el.onclick = () => { state.selectedContactId = el.dataset.openContact; setView('network'); });
}

function renderProjects(){
  const selected = projectById(state.selectedProjectId) || state.vault.projects[0];
  if (selected) state.selectedProjectId = selected.id;
  const list = [...state.vault.projects].sort((a,b) => (b.startDate || '').localeCompare(a.startDate || ''));
  $('content').innerHTML = `
    <div class="topline" style="margin-bottom:12px">
      <div class="helper">Le projet concentre maintenant le cadrage commercial, les données client, les hypothèses documentaires et les besoins de staffing.</div>
      <div class="inline-actions">
        <button class="btn btn-primary small" id="btnAddProject">Nouveau projet</button>
        ${selected ? `<button class="btn btn-secondary small" id="btnEditProject">Modifier</button>` : ''}
      </div>
    </div>
    <div class="grid-main">
      <div class="card pane">
        <div class="filter-row">
          <input id="projectSearch" placeholder="Recherche projet / code / client" value="${esc(state.filters.search)}" />
          <select id="projectStatusFilter">
            <option value="">Tous statuts</option>
            ${['appel offre','en cours','termine','bloque'].map(s => `<option value="${s}" ${state.filters.projectStatus===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="list-pane">
          ${list.filter(p => {
            const q = state.filters.search.toLowerCase();
            const okSearch = !q || [p.name,p.code,p.clientName,p.location,p.scopeSummary].join(' ').toLowerCase().includes(q);
            const okStatus = !state.filters.projectStatus || p.status === state.filters.projectStatus;
            return okSearch && okStatus;
          }).map(p => `
            <div class="entity-card ${selected && p.id === selected.id ? 'active' : ''}" data-project="${p.id}">
              <div class="entity-head">
                <div>
                  <div class="entity-title">${esc(p.name)}</div>
                  <div class="entity-meta">${esc(p.code)} · ${esc(p.clientName)} · ${esc(p.location || '—')}</div>
                </div>
                ${statusBadge(p.status)}
              </div>
            </div>
          `).join('') || `<div class="empty-state">Aucun projet ne correspond au filtre.</div>`}
        </div>
      </div>
      <div class="detail-stack">
        ${selected ? renderProjectDetail(selected) : `<div class="card pane"><div class="empty-state">Aucun projet.</div></div>`}
      </div>
    </div>
  `;
  $('projectSearch').oninput = e => { state.filters.search = e.target.value; renderProjects(); };
  $('projectStatusFilter').onchange = e => { state.filters.projectStatus = e.target.value; renderProjects(); };
  document.querySelectorAll('[data-project]').forEach(el => el.onclick = () => { state.selectedProjectId = el.dataset.project; renderProjects(); });
  if ($('btnAddProject')) $('btnAddProject').onclick = () => openProjectModal();
  if ($('btnEditProject')) $('btnEditProject').onclick = () => openProjectModal(selected);
  document.querySelectorAll('[data-project-doc]').forEach(el => {
    el.onclick = () => {
      state.docDraft.projectId = el.dataset.projectDoc;
      state.selectedProjectId = el.dataset.projectDoc;
      setView('documents');
    };
  });
  document.querySelectorAll('[data-project-match]').forEach(el => {
    el.onclick = () => {
      state.matchDraft.projectId = el.dataset.projectMatch;
      state.selectedProjectId = el.dataset.projectMatch;
      setView('matching');
    };
  });
}

function renderProjectDetail(project){
  const assignments = assignmentsForProject(project.id);
  const budgetTTC = project.budgetTTC || project.budgetHT;
  const currentLots = assignments.map(a => `<span class="assignment-chip">${esc(contactById(a.contactId)?.name || '—')} · ${esc(a.specialty)} · ${esc(a.status)}</span>`).join('');
  return `
    <div class="card pane">
      <div class="preview-header">
        <div>
          <div class="section-title"><div class="label">Project file</div></div>
          <div class="entity-title">${esc(project.name)}</div>
          <div class="entity-meta">${esc(project.code)} · ${esc(project.clientName)} · ${esc(project.clientType)}</div>
        </div>
        <div class="inline-actions">
          <button class="btn btn-secondary small" data-project-match="${project.id}">Ouvrir matching</button>
          <button class="btn btn-primary small" data-project-doc="${project.id}">Créer document</button>
        </div>
      </div>
      <div class="stack-4">
        <div class="muted-box"><div class="label">Budget HT</div><div class="value">${money(project.budgetHT)}</div></div>
        <div class="muted-box"><div class="label">Budget TTC</div><div class="value">${money(budgetTTC)}</div></div>
        <div class="muted-box"><div class="label">Acompte</div><div class="value">${pct(project.depositPercent)}</div></div>
        <div class="muted-box"><div class="label">Délai</div><div class="value">${project.delayDays} jours</div></div>
      </div>
      <div style="height:12px"></div>
      <div class="info-grid">
        <div class="muted-box"><div class="label">Client</div><div class="value">${esc(project.clientName)}<br>${esc(project.clientAddress || '—')}<br>${esc(project.clientPhone || '—')}</div></div>
        <div class="muted-box"><div class="label">Architecte / BET</div><div class="value">${esc(project.architect || '—')}<br>${esc(project.bet || '—')}</div></div>
        <div class="muted-box"><div class="label">Localisation</div><div class="value">${esc(project.location || '—')}</div></div>
        <div class="muted-box"><div class="label">Progression</div><div class="value">${pct(project.progressPercent)}</div></div>
      </div>
      <div style="height:12px"></div>
      <div class="muted-box"><div class="label">Scope summary</div><div class="value">${esc(project.scopeSummary || '—')}</div></div>
      <div style="height:12px"></div>
      <div class="stack-3">
        <div class="muted-box"><div class="label">Spécialités requises</div><div class="value">${project.requiredSpecialties.map(esc).join(' · ') || '—'}</div></div>
        <div class="muted-box"><div class="label">Inclusions</div><div class="value">${project.inclusions.map(esc).join(' · ') || '—'}</div></div>
        <div class="muted-box"><div class="label">Exclusions</div><div class="value">${project.exclusions.map(esc).join(' · ') || '—'}</div></div>
      </div>
      <div style="height:12px"></div>
      <div class="muted-box"><div class="label">Hypothèses & paiement</div><div class="value">${project.assumptions.map(esc).join(' · ') || '—'}<br><br>${esc(project.paymentTerms || '—')}</div></div>
      <div style="height:12px"></div>
      <div class="section-title"><div class="label">Crew & phase memory</div></div>
      <div>${currentLots || `<div class="empty-state">Aucune affectation.</div>`}</div>
    </div>
  `;
}

function renderNetwork(){
  const selected = contactById(state.selectedContactId) || state.vault.contacts[0];
  if (selected) state.selectedContactId = selected.id;
  const contacts = [...state.vault.contacts].sort((a,b) => a.name.localeCompare(b.name));
  const filtered = contacts.filter(c => {
    const q = (state.filters.search || '').toLowerCase();
    const okSpec = !state.filters.specialty || c.specialties.includes(state.filters.specialty);
    const okCity = !state.filters.city || c.city === state.filters.city || c.zones.includes(state.filters.city);
    const okTrust = !state.filters.trust || c.trust === state.filters.trust;
    const okSearch = !q || [c.name,c.tradeName,c.primarySpecialty,c.city,c.notes,c.tags.join(' ')].join(' ').toLowerCase().includes(q);
    return okSpec && okCity && okTrust && okSearch;
  });
  $('content').innerHTML = `
    <div class="topline" style="margin-bottom:12px">
      <div class="helper">La fiche contact est désormais plus profonde : capacité, conformité, zones, tarifs, expérience et mémoire terrain.</div>
      <div class="inline-actions">
        <button class="btn btn-primary small" id="btnAddContact">Nouveau contact</button>
        ${selected ? `<button class="btn btn-secondary small" id="btnEditContact">Modifier</button>` : ''}
      </div>
    </div>
    <div class="grid-main">
      <div class="card pane">
        <div class="filter-row">
          <input id="networkSearch" placeholder="Nom / spécialité / tags / notes" value="${esc(state.filters.search)}" />
          <select id="networkSpecialty"><option value="">Toutes spécialités</option>${SPECIALTIES.map(s => `<option value="${s}" ${state.filters.specialty===s?'selected':''}>${s}</option>`).join('')}</select>
          <select id="networkCity"><option value="">Toutes villes</option>${unique(state.vault.contacts.flatMap(c => [c.city, ...c.zones])).filter(Boolean).map(s => `<option value="${s}" ${state.filters.city===s?'selected':''}>${s}</option>`).join('')}</select>
          <select id="networkTrust"><option value="">Tous niveaux</option>${['eleve','moyen','faible'].map(s => `<option value="${s}" ${state.filters.trust===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
        <div class="list-pane">
          ${filtered.map(c => {
            const stats = contactStats(c.id);
            return `
              <div class="entity-card ${selected && c.id===selected.id ? 'active' : ''}" data-contact="${c.id}">
                <div class="entity-head">
                  <div>
                    <div class="entity-title">${esc(c.name)}</div>
                    <div class="entity-meta">${esc(c.primarySpecialty)} · ${esc(c.city || '—')} · équipe ${esc(c.crewSize)} · complétude ${profileCompleteness(c)}%</div>
                  </div>
                  ${trustBadge(c.trust)}
                </div>
                <div class="tag-row" style="margin-top:10px">${c.tags.slice(0,3).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
                <div class="fitbar" style="margin-top:10px"><span style="width:${Math.round((stats.avgScore/5)*100)}%"></span></div>
              </div>
            `;
          }).join('') || `<div class="empty-state">Aucun contact ne correspond au filtre.</div>`}
        </div>
      </div>
      <div class="detail-stack">
        ${selected ? renderContactDetail(selected) : `<div class="card pane"><div class="empty-state">Aucun contact.</div></div>`}
      </div>
    </div>
  `;
  $('networkSearch').oninput = e => { state.filters.search = e.target.value; renderNetwork(); };
  $('networkSpecialty').onchange = e => { state.filters.specialty = e.target.value; renderNetwork(); };
  $('networkCity').onchange = e => { state.filters.city = e.target.value; renderNetwork(); };
  $('networkTrust').onchange = e => { state.filters.trust = e.target.value; renderNetwork(); };
  document.querySelectorAll('[data-contact]').forEach(el => el.onclick = () => { state.selectedContactId = el.dataset.contact; renderNetwork(); });
  if ($('btnAddContact')) $('btnAddContact').onclick = () => openContactModal();
  if ($('btnEditContact')) $('btnEditContact').onclick = () => openContactModal(selected);
  document.querySelectorAll('[data-contact-assign]').forEach(el => el.onclick = () => openAssignmentModal(null, {contactId: el.dataset.contactAssign}));
  document.querySelectorAll('[data-contact-match]').forEach(el => {
    el.onclick = () => {
      state.selectedContactId = el.dataset.contactMatch;
      state.matchDraft.specialty = contactById(el.dataset.contactMatch)?.primarySpecialty || '';
      setView('matching');
    };
  });
}

function renderContactDetail(contact){
  const stats = contactStats(contact.id);
  const history = assignmentsForContact(contact.id).sort((a,b) => (b.from || '').localeCompare(a.from || ''));
  return `
    <div class="card pane">
      <div class="preview-header">
        <div>
          <div class="section-title"><div class="label">Fiche partenaire</div></div>
          <div class="entity-title">${esc(contact.name)}</div>
          <div class="entity-meta">${esc(contact.tradeName || contact.kind)} · ${esc(contact.primarySpecialty)} · ${esc(contact.city || '—')}</div>
        </div>
        <div class="inline-actions">
          <button class="btn btn-secondary small" data-contact-match="${contact.id}">Voir matching</button>
          <button class="btn btn-primary small" data-contact-assign="${contact.id}">Nouvelle affectation</button>
        </div>
      </div>
      <div class="stack-4">
        <div class="muted-box"><div class="label">Confiance</div><div class="value">${esc(contact.trust)}</div></div>
        <div class="muted-box"><div class="label">Complétude</div><div class="value">${profileCompleteness(contact)}%</div></div>
        <div class="muted-box"><div class="label">Expérience</div><div class="value">${contact.yearsExperience} ans</div></div>
        <div class="muted-box"><div class="label">Équipe</div><div class="value">${contact.crewSize} pers.</div></div>
      </div>
      <div style="height:12px"></div>
      <div class="stack-3">
        <div class="muted-box"><div class="label">Identité</div><div class="value">${esc(contact.kind)}<br>${esc(contact.legalStatus)}<br>${esc(contact.phone || '—')}</div></div>
        <div class="muted-box"><div class="label">Couverture</div><div class="value">${contact.zones.map(esc).join(' · ') || '—'}<br>${esc(contact.availability)}<br>véhicule ${yesNo(contact.hasVehicle)}</div></div>
        <div class="muted-box"><div class="label">Commercial</div><div class="value">${money(contact.rateDay)}/jour<br>${contact.ratePackage ? money(contact.ratePackage) + '/forfait' : '—'}<br>${esc(contact.paymentMode)}</div></div>
      </div>
      <div style="height:12px"></div>
      <div class="stack-4">
        <div class="metric"><div class="n">${stats.quality ? stats.quality.toFixed(1) : '—'}</div><div class="t">Qualité</div></div>
        <div class="metric"><div class="n">${stats.reliability ? stats.reliability.toFixed(1) : '—'}</div><div class="t">Fiabilité</div></div>
        <div class="metric"><div class="n">${stats.speed ? stats.speed.toFixed(1) : '—'}</div><div class="t">Vitesse</div></div>
        <div class="metric"><div class="n">${stats.discipline ? stats.discipline.toFixed(1) : '—'}</div><div class="t">Discipline</div></div>
      </div>
      <div style="height:12px"></div>
      <div class="compliance-grid">
        <div class="compliance-tile"><strong>Conformité</strong>${renderBoolLine('CIN / ID', contact.compliance.idReceived)}${renderBoolLine('Contrat', contact.compliance.contractSigned)}${renderBoolLine('NDA', contact.compliance.ndaSigned)}</div>
        <div class="compliance-tile"><strong>Financier</strong>${renderBoolLine('RIB / banque', contact.compliance.bankInfo)}${renderBoolLine('Statut fiscal', contact.compliance.taxStatus)}${renderBoolLine('Safety briefing', contact.compliance.safetyBriefing)}</div>
        <div class="compliance-tile"><strong>Capacités</strong>${renderBoolLine('Lead team', contact.canLeadTeam)}${renderBoolLine('Own tools', contact.ownTools)}${renderBoolLine('Vehicle', contact.hasVehicle)}</div>
      </div>
      <div style="height:12px"></div>
      <div class="muted-box"><div class="label">Spécialités / langues / tags</div><div class="value">${contact.specialties.map(esc).join(' · ') || '—'}<br>${contact.languages.map(esc).join(' · ') || '—'}<br>${contact.tags.map(esc).join(' · ') || '—'}</div></div>
      <div style="height:12px"></div>
      <div class="muted-box"><div class="label">Notes internes</div><div class="value">${esc(contact.notes || '—')}</div></div>
      <div style="height:12px"></div>
      <div class="section-title"><div class="label">Historique projets</div></div>
      <div class="table-wrap responsive-table">
        <table>
          <thead><tr><th>Projet</th><th>Spécialité</th><th>Phase</th><th>Statut</th><th>Score</th><th>Réembauche</th></tr></thead>
          <tbody>
            ${history.map(a => {
              const p = projectById(a.projectId);
              const score = avg([a.quality, a.reliability, a.speed, a.discipline]);
              return `<tr data-assignment="${a.id}"><td>${esc(p ? p.code : '—')}</td><td>${esc(a.specialty)}</td><td>${esc(a.phase || '—')}</td><td>${statusBadge(a.status)}</td><td>${score ? score.toFixed(1) + '/5' : '—'}</td><td>${a.rehire === null ? '—' : a.rehire ? 'Oui' : 'Non'}</td></tr>`;
            }).join('') || `<tr><td colspan="6">Aucune affectation.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderBoolLine(label, value){
  return `<div class="kv"><div class="k">${esc(label)}</div><div class="v">${value ? 'Oui' : 'Non'}</div></div>`;
}

function specialtyFit(contact, specialty){
  if (!specialty) return 0.65;
  if (contact.primarySpecialty === specialty) return 1;
  if (contact.specialties.includes(specialty)) return 0.88;
  if ((ADJACENT_SPECIALTIES[specialty] || []).some(s => contact.specialties.includes(s))) return 0.62;
  const history = completedAssignmentsForContact(contact.id);
  if (history.some(a => a.specialty === specialty)) return 0.8;
  return 0.18;
}

function zoneFit(contact, city){
  if (!city) return 0.65;
  if (contact.city === city) return 1;
  if ((contact.zones || []).includes(city)) return 0.9;
  return 0.35;
}

function availabilityFit(contact, maxDays){
  const d = Number(contact.availabilityDays ?? availabilityDaysFromText(contact.availability));
  if (!maxDays) return clamp(1 - (d / 45), 0.25, 1);
  return d <= maxDays ? clamp(1 - (d / Math.max(maxDays, 1)) * 0.45, 0.55, 1) : 0.15;
}

function trustFit(contact){
  return {eleve:1, moyen:0.67, faible:0.3}[contact.trust] || 0.5;
}

function getMatchCandidates(draft = state.matchDraft){
  const project = projectById(draft.projectId) || state.vault.projects[0];
  const requestedSpecialty = draft.specialty || project?.requiredSpecialties?.[0] || '';
  const city = draft.city || project?.location || '';
  const maxAvailability = draft.availability ? Number(draft.availability) : 0;
  const minScore = Number(draft.minScore || 0);
  const legalFilter = draft.legalStatus || '';

  return state.vault.contacts
    .filter(c => c.active)
    .map(contact => {
      const stats = contactStats(contact.id);
      const spec = specialtyFit(contact, requestedSpecialty);
      const perf = stats.avgScore ? stats.avgScore / 5 : 0.45;
      const zone = zoneFit(contact, city);
      const avail = availabilityFit(contact, maxAvailability);
      const trust = trustFit(contact);
      const compliance = complianceScore(contact);
      const rehire = stats.rehireRate || 0.4;
      const total = Math.round((spec*32 + perf*25 + zone*10 + avail*14 + trust*8 + compliance*6 + rehire*5));
      const reasons = [];
      if (spec >= 0.88) reasons.push('Spécialité très alignée');
      else if (spec >= 0.6) reasons.push('Spécialité adjacente utile');
      if (perf >= 0.8) reasons.push('Historique terrain solide');
      if (zone >= 0.9) reasons.push('Zone couverte');
      if (avail >= 0.75) reasons.push('Disponibilité favorable');
      if (compliance >= 0.8) reasons.push('Conformité complète');
      if (trust >= 0.9) reasons.push('Confiance élevée');
      return {contact, stats, total, reasons, spec, perf, zone, avail, compliance, project, requestedSpecialty};
    })
    .filter(x => !legalFilter || x.contact.legalStatus === legalFilter)
    .filter(x => x.total >= minScore)
    .sort((a,b) => b.total - a.total || b.stats.avgScore - a.stats.avgScore);
}

function renderMatching(){
  const fallbackProject = projectById(state.matchDraft.projectId) || projectById(state.selectedProjectId) || state.vault.projects[0];
  if (fallbackProject) state.matchDraft.projectId = fallbackProject.id;
  if (!state.matchDraft.specialty && fallbackProject?.requiredSpecialties?.length) state.matchDraft.specialty = fallbackProject.requiredSpecialties[0];
  if (!state.matchDraft.city && fallbackProject?.location) state.matchDraft.city = fallbackProject.location;
  const matches = getMatchCandidates();
  const lead = matches[0] || null;
  $('content').innerHTML = `
    <div class="match-grid">
      <div class="card pane">
        <div class="section-title"><div class="label">Matching studio</div></div>
        <div class="doc-controls">
          <div class="form-row"><label>Projet</label><select id="matchProject">${state.vault.projects.map(p => `<option value="${p.id}" ${state.matchDraft.projectId===p.id?'selected':''}>${esc(p.code)} · ${esc(p.name)}</option>`).join('')}</select></div>
          <div class="form-row"><label>Spécialité</label><select id="matchSpecialty"><option value="">Auto</option>${SPECIALTIES.map(s => `<option value="${s}" ${state.matchDraft.specialty===s?'selected':''}>${s}</option>`).join('')}</select></div>
          <div class="form-row"><label>Ville / zone</label><input id="matchCity" value="${esc(state.matchDraft.city || '')}" placeholder="Bouskoura, Casablanca..." /></div>
          <div class="form-row"><label>Disponibilité max (jours)</label><select id="matchAvailability"><option value="" ${!state.matchDraft.availability?'selected':''}>Sans filtre</option>${[0,7,15,30].map(v => `<option value="${v}" ${String(state.matchDraft.availability)===String(v)?'selected':''}>${v === 0 ? 'Immédiate' : v + ' jours'}</option>`).join('')}</select></div>
          <div class="form-row"><label>Statut légal</label><select id="matchLegal"><option value="">Tous</option>${['informel','auto-entrepreneur','societe'].map(v => `<option value="${v}" ${state.matchDraft.legalStatus===v?'selected':''}>${v}</option>`).join('')}</select></div>
          <div class="form-row"><label>Score minimum</label><input id="matchMinScore" type="range" min="0" max="95" step="5" value="${esc(state.matchDraft.minScore)}"><div class="form-hint">Seuil actuel : <strong id="matchMinScoreValue">${state.matchDraft.minScore}</strong>/100</div></div>
        </div>
        <div style="height:10px"></div>
        <div class="helper">Le moteur pondère : spécialité, historique de terrain, zone, disponibilité, confiance, conformité et réembauche. Il reste décisionnel, pas automatique.</div>
        <div style="height:12px"></div>
        <div class="match-list">
          ${matches.map(m => `
            <div class="match-card ${lead && m.contact.id===lead.contact.id ? 'active' : ''}" data-match-contact="${m.contact.id}">
              <div class="match-top">
                <div>
                  <div class="entity-title">${esc(m.contact.name)}</div>
                  <div class="entity-meta">${esc(m.contact.primarySpecialty)} · ${esc(m.contact.city || '—')} · ${esc(m.contact.crewSize)} pers. · ${esc(m.contact.legalStatus)}</div>
                </div>
                <div class="match-score">${m.total}</div>
              </div>
              <div class="fitbar"><span style="width:${m.total}%"></span></div>
              <div class="tag-row">${m.reasons.slice(0,4).map(r => `<span class="tag">${esc(r)}</span>`).join('')}</div>
              <div class="stack-4">
                <div class="muted-box"><div class="label">Qualité</div><div class="value">${m.stats.quality ? m.stats.quality.toFixed(1) : '—'}</div></div>
                <div class="muted-box"><div class="label">Fiabilité</div><div class="value">${m.stats.reliability ? m.stats.reliability.toFixed(1) : '—'}</div></div>
                <div class="muted-box"><div class="label">Dispo</div><div class="value">${esc(m.contact.availability)}</div></div>
                <div class="muted-box"><div class="label">Conformité</div><div class="value">${Math.round(m.compliance * 100)}%</div></div>
              </div>
              <div class="inline-actions">
                <button class="btn btn-secondary small" data-open-contact="${m.contact.id}">Fiche</button>
                <button class="btn btn-primary small" data-assign-contact="${m.contact.id}">Affecter</button>
              </div>
            </div>
          `).join('') || `<div class="empty-state">Aucun candidat au-dessus du seuil.</div>`}
        </div>
      </div>
      <div class="detail-stack">
        <div class="card pane">
          <div class="section-title"><div class="label">Lecture du top match</div></div>
          ${lead ? `
            <div class="client-card">
              <h3>${esc(lead.contact.name)} — ${lead.total}/100</h3>
              <div class="helper">Projet : ${esc(lead.project?.code || '—')} · Spécialité cherchée : ${esc(lead.requestedSpecialty || '—')}</div>
              <div style="height:10px"></div>
              <div class="kv"><div class="k">Spécialité</div><div class="v">${Math.round(lead.spec*100)}%</div></div>
              <div class="kv"><div class="k">Terrain</div><div class="v">${Math.round(lead.perf*100)}%</div></div>
              <div class="kv"><div class="k">Zone</div><div class="v">${Math.round(lead.zone*100)}%</div></div>
              <div class="kv"><div class="k">Disponibilité</div><div class="v">${Math.round(lead.avail*100)}%</div></div>
              <div class="kv"><div class="k">Conformité</div><div class="v">${Math.round(lead.compliance*100)}%</div></div>
            </div>
            <div style="height:12px"></div>
            <div class="muted-box"><div class="label">Pourquoi il sort en tête</div><div class="value">${lead.reasons.map(esc).join(' · ') || 'Fit global supérieur.'}</div></div>
            <div style="height:12px"></div>
            <div class="inline-actions">
              <button class="btn btn-secondary" data-open-contact="${lead.contact.id}">Ouvrir la fiche</button>
              <button class="btn btn-primary" data-assign-contact="${lead.contact.id}">Créer affectation</button>
            </div>
          ` : `<div class="empty-state">Aucun candidat top match.</div>`}
        </div>
        <div class="card pane">
          <div class="section-title"><div class="label">Staffing actuel du projet</div></div>
          ${fallbackProject ? assignmentsForProject(fallbackProject.id).map(a => {
            const c = contactById(a.contactId);
            return `<div class="assignment-chip">${esc(c ? c.name : '—')} · ${esc(a.specialty)} · ${esc(a.status)}</div>`;
          }).join('') || `<div class="empty-state">Aucune affectation sur ce projet.</div>` : `<div class="empty-state">Aucun projet sélectionné.</div>`}
        </div>
      </div>
    </div>
  `;
  $('matchProject').onchange = e => {
    state.matchDraft.projectId = e.target.value;
    const p = projectById(e.target.value);
    state.matchDraft.city = p?.location || '';
    state.matchDraft.specialty = p?.requiredSpecialties?.[0] || '';
    renderMatching();
  };
  $('matchSpecialty').onchange = e => { state.matchDraft.specialty = e.target.value; renderMatching(); };
  $('matchCity').oninput = e => { state.matchDraft.city = e.target.value; renderMatching(); };
  $('matchAvailability').onchange = e => { state.matchDraft.availability = e.target.value; renderMatching(); };
  $('matchLegal').onchange = e => { state.matchDraft.legalStatus = e.target.value; renderMatching(); };
  $('matchMinScore').oninput = e => { state.matchDraft.minScore = Number(e.target.value); $('matchMinScoreValue').textContent = e.target.value; renderMatching(); };
  document.querySelectorAll('[data-open-contact]').forEach(el => el.onclick = () => { state.selectedContactId = el.dataset.openContact; setView('network'); });
  document.querySelectorAll('[data-assign-contact]').forEach(el => el.onclick = () => openAssignmentModal(null, {contactId: el.dataset.assignContact, projectId: state.matchDraft.projectId, specialty: state.matchDraft.specialty}));
  document.querySelectorAll('[data-match-contact]').forEach(el => el.onclick = () => { state.selectedContactId = el.dataset.matchContact; });
}

function renderAssignments(){
  const selected = assignmentById(state.selectedAssignmentId) || state.vault.assignments[0];
  if (selected) state.selectedAssignmentId = selected.id;
  const rows = [...state.vault.assignments].sort((a,b) => (b.from || '').localeCompare(a.from || ''));
  $('content').innerHTML = `
    <div class="topline" style="margin-bottom:12px">
      <div class="helper">Les affectations gardent la mémoire d’exécution et alimentent le matching futur.</div>
      <div class="inline-actions">
        <button class="btn btn-primary small" id="btnAddAssignment">Nouvelle affectation</button>
        ${selected ? `<button class="btn btn-secondary small" id="btnEditAssignment">Modifier</button>` : ''}
      </div>
    </div>
    <div class="grid-main">
      <div class="card pane">
        <div class="table-wrap responsive-table">
          <table>
            <thead><tr><th>Projet</th><th>Contact</th><th>Spécialité</th><th>Phase</th><th>Statut</th></tr></thead>
            <tbody>
              ${rows.map(a => {
                const p = projectById(a.projectId), c = contactById(a.contactId);
                return `<tr data-select-assignment="${a.id}"><td>${esc(p ? p.code : '—')}</td><td>${esc(c ? c.name : '—')}</td><td>${esc(a.specialty)}</td><td>${esc(a.phase || '—')}</td><td>${statusBadge(a.status)}</td></tr>`;
              }).join('') || `<tr><td colspan="5">Aucune affectation.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      <div class="card pane">
        ${selected ? renderAssignmentDetail(selected) : `<div class="empty-state">Aucune affectation.</div>`}
      </div>
    </div>
  `;
  document.querySelectorAll('[data-select-assignment]').forEach(el => el.onclick = () => { state.selectedAssignmentId = el.dataset.selectAssignment; renderAssignments(); });
  if ($('btnAddAssignment')) $('btnAddAssignment').onclick = () => openAssignmentModal();
  if ($('btnEditAssignment')) $('btnEditAssignment').onclick = () => openAssignmentModal(selected);
}

function renderAssignmentDetail(a){
  const p = projectById(a.projectId), c = contactById(a.contactId);
  const score = avg([a.quality, a.reliability, a.speed, a.discipline]);
  return `
    <div class="section-title"><div class="label">Assignment record</div></div>
    <div class="info-grid">
      <div class="muted-box"><div class="label">Projet</div><div class="value">${esc(p ? p.name : '—')}<br>${esc(p ? p.code : '—')}</div></div>
      <div class="muted-box"><div class="label">Contact</div><div class="value">${esc(c ? c.name : '—')}<br>${esc(c ? c.primarySpecialty : '—')}</div></div>
      <div class="muted-box"><div class="label">Rôle</div><div class="value">${esc(a.role || '—')}</div></div>
      <div class="muted-box"><div class="label">Période</div><div class="value">${shortDate(a.from)} → ${shortDate(a.to)}</div></div>
    </div>
    <div style="height:12px"></div>
    <div class="stack-4">
      <div class="metric"><div class="n">${a.quality || '—'}</div><div class="t">Qualité</div></div>
      <div class="metric"><div class="n">${a.reliability || '—'}</div><div class="t">Fiabilité</div></div>
      <div class="metric"><div class="n">${a.speed || '—'}</div><div class="t">Vitesse</div></div>
      <div class="metric"><div class="n">${a.discipline || '—'}</div><div class="t">Discipline</div></div>
    </div>
    <div style="height:12px"></div>
    <div class="muted-box"><div class="label">Score moyen</div><div class="value">${score ? score.toFixed(1) + '/5' : '—'} · réembauche ${a.rehire === null ? 'à décider' : a.rehire ? 'oui' : 'non'}</div></div>
    <div style="height:12px"></div>
    <div class="muted-box"><div class="label">Notes</div><div class="value">${esc(a.notes || '—')}</div></div>
  `;
}

function renderDocuments(){
  const selectedProject = projectById(state.docDraft.projectId) || projectById(state.selectedProjectId) || state.vault.projects[0];
  if (selectedProject) state.docDraft.projectId = selectedProject.id;
  const selectedDoc = documentById(state.selectedDocumentId) || state.vault.documents[0];
  const previewHtml = selectedDoc ? selectedDoc.html : selectedProject ? renderDocPreview(state.docDraft.type, selectedProject) : `<div class="doc-page"><h1>Aucun projet</h1></div>`;
  $('content').innerHTML = `
    <div class="docs-layout">
      <div class="card pane">
        <div class="section-title"><div class="label">Document studio</div></div>
        <div class="doc-controls">
          <div class="form-row"><label>Projet</label><select id="docProjectSelect">${state.vault.projects.map(p => `<option value="${p.id}" ${selectedProject && p.id===selectedProject.id?'selected':''}>${esc(p.code)} · ${esc(p.name)}</option>`).join('')}</select></div>
          <div class="form-row"><label>Type de document</label><select id="docTypeSelect">${DOC_TYPES.map(t => `<option value="${t.id}" ${state.docDraft.type===t.id?'selected':''}>${esc(t.label)}</option>`).join('')}</select></div>
        </div>
        ${selectedProject ? `
          <div style="height:12px"></div>
          <div class="client-card">
            <h3>Données utilisées</h3>
            <div class="kv"><div class="k">Client</div><div class="v">${esc(selectedProject.clientName)}</div></div>
            <div class="kv"><div class="k">Budget HT</div><div class="v">${money(selectedProject.budgetHT)}</div></div>
            <div class="kv"><div class="k">Délai</div><div class="v">${selectedProject.delayDays} jours</div></div>
            <div class="kv"><div class="k">Acompte</div><div class="v">${pct(selectedProject.depositPercent)}</div></div>
          </div>
        ` : ''}
        <div style="height:12px"></div>
        <div class="inline-actions">
          <button class="btn btn-secondary" id="btnEditProjectForDoc">Modifier données projet</button>
          <button class="btn btn-primary" id="btnCreateDoc">Créer un snapshot</button>
          <button class="btn btn-secondary" id="btnPreviewDoc">Actualiser l’aperçu</button>
        </div>
        <hr class="sep">
        <div class="section-title"><div class="label">Snapshots existants</div></div>
        <div class="doc-list">
          ${state.vault.documents.map(doc => {
            const p = projectById(doc.projectId);
            return `<div class="doc-item ${selectedDoc && selectedDoc.id===doc.id ? 'active' : ''}" data-doc="${doc.id}"><div class="title">${esc(doc.label)}</div><div class="meta">${esc(p ? p.code : '—')} · ${shortDate(doc.createdAt)} · ${docFingerprintPill(doc)}</div></div>`;
          }).join('') || `<div class="empty-state">Aucun snapshot généré.</div>`}
        </div>
        ${selectedDoc ? `<div style="height:12px"></div><div class="toolbar"><button class="btn btn-secondary small" id="btnPrintDoc">Imprimer / PDF</button><button class="btn btn-secondary small" id="btnExportDocHtml">Exporter HTML</button></div>` : ''}
      </div>
      <div class="card pane">
        <div class="section-title"><div class="label">Aperçu</div></div>
        <iframe class="preview-frame" id="docPreviewFrame"></iframe>
      </div>
    </div>
  `;
  $('docProjectSelect').onchange = e => { state.docDraft.projectId = e.target.value; state.selectedProjectId = e.target.value; state.selectedDocumentId = null; renderDocuments(); };
  $('docTypeSelect').onchange = e => { state.docDraft.type = e.target.value; state.selectedDocumentId = null; renderDocuments(); };
  $('btnPreviewDoc').onclick = () => renderDocuments();
  $('btnEditProjectForDoc').onclick = () => openProjectModal(selectedProject);
  $('btnCreateDoc').onclick = async () => {
    const p = projectById(state.docDraft.projectId);
    const html = renderDocPreview(state.docDraft.type, p);
    const fingerprint = await sha256(html + JSON.stringify(p));
    const label = `${DOC_TYPES.find(d => d.id === state.docDraft.type)?.label || state.docDraft.type} · ${p.code}`;
    const doc = {id:uid('doc'), projectId:p.id, type:state.docDraft.type, label, html, fingerprint, createdAt:nowIso()};
    state.vault.documents.unshift(doc);
    state.selectedDocumentId = doc.id;
    logActivity('document_snapshot', `${label} créé`);
    await persistVault();
    renderDocuments();
    showToast('Snapshot documentaire créé.');
  };
  document.querySelectorAll('[data-doc]').forEach(el => el.onclick = () => { state.selectedDocumentId = el.dataset.doc; renderDocuments(); });
  if ($('btnPrintDoc')) $('btnPrintDoc').onclick = () => printDoc(selectedDoc.html);
  if ($('btnExportDocHtml')) $('btnExportDocHtml').onclick = () => exportTextFile(`${selectedDoc.type}-${selectedDoc.fingerprint}.html`, selectedDoc.html, 'text/html');
  $('docPreviewFrame').srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Preview</title><style>${document.querySelector('style').innerHTML}</style></head><body>${previewHtml}</body></html>`;
}

function listMarkup(items){
  return items.length ? `<ul style="margin:8px 0 0 18px;padding:0;line-height:1.6">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p style="margin:8px 0 0">—</p>';
}

function renderDocPreview(type, project){
  if (!project) return `<div class="doc-page"><h1>Aucun projet sélectionné</h1></div>`;
  const assignments = assignmentsForProject(project.id);
  const teamRows = assignments.map(a => {
    const c = contactById(a.contactId);
    return `<tr><td>${esc(c ? c.name : '—')}</td><td>${esc(a.specialty)}</td><td>${esc(a.phase || '—')}</td><td>${esc(a.status)}</td></tr>`;
  }).join('') || `<tr><td colspan="4">Aucune affectation.</td></tr>`;
  const head = `
    <div class="doc-head">
      <div>
        <div class="doc-brand">${esc(state.vault.company.name)}</div>
        <div class="doc-note">Construction · Pilotage · Execution Network</div>
      </div>
      <div class="doc-note">
        <div><strong>Projet</strong> ${esc(project.code)}</div>
        <div><strong>Client</strong> ${esc(project.clientName)}</div>
        <div><strong>Type</strong> ${esc(project.clientType)}</div>
        <div><strong>Date</strong> ${shortDate(nowIso())}</div>
      </div>
    </div>
  `;
  const financial = `
    <div class="doc-grid">
      <div class="doc-box"><strong>Budget HT</strong><br>${money(project.budgetHT)}</div>
      <div class="doc-box"><strong>Budget TTC</strong><br>${money(project.budgetTTC || project.budgetHT)}</div>
      <div class="doc-box"><strong>Acompte</strong><br>${pct(project.depositPercent)}</div>
      <div class="doc-box"><strong>Délai prévisionnel</strong><br>${project.delayDays} jours</div>
    </div>
  `;
  const clientTypeClause = project.clientType === 'societe'
    ? 'Les validations écrites, hiérarchies documentaires et variations quantitatives s’imposent entre professionnels selon les pièces contractuelles signées.'
    : 'Le document reste rédigé dans un style clair et pédagogique pour un client particulier, tout en cadrant précisément le périmètre, les exclusions et les conditions de démarrage.';
  if (type === 'devis') {
    return `<div class="doc-page">${head}
      <h1>Devis / Proposition de travaux</h1>
      ${financial}
      <h2>Objet</h2><p>${esc(project.scopeSummary || 'Prestations de travaux selon les pièces du dossier.')}</p>
      <h2>Prestations comprises</h2>${listMarkup(project.inclusions)}
      <h2>Prestations non comprises</h2>${listMarkup(project.exclusions)}
      <h2>Hypothèses de base</h2>${listMarkup(project.assumptions)}
      <h2>Conditions commerciales</h2><p>${esc(project.paymentTerms)}</p>
      <h2>Mémoire d’exécution mobilisable</h2><table class="doc-table"><thead><tr><th>Contact</th><th>Spécialité</th><th>Phase</th><th>Statut</th></tr></thead><tbody>${teamRows}</tbody></table>
      <div class="signature-grid"><div class="signature-box"><strong>Pour ${esc(state.vault.company.name)}</strong><br><br>${esc(state.vault.company.signatory || 'Signataire')}</div><div class="signature-box"><strong>Pour le client</strong></div></div>
    </div>`;
  }
  if (type === 'contrat') {
    return `<div class="doc-page">${head}
      <h1>Contrat de travaux</h1>
      ${financial}
      <h2>Préambule</h2><p>${esc(project.scopeSummary || 'Prestations définies selon les pièces contractuelles.')}</p>
      <h2>Clauses structurantes</h2>
      <table class="doc-table"><thead><tr><th>Point</th><th>Rédaction</th></tr></thead><tbody>
        <tr><td>Périmètre</td><td>Toute prestation non expressément décrite est réputée non comprise et soumise à validation complémentaire sur prix et délai.</td></tr>
        <tr><td>Démarrage</td><td>Le délai ne court qu’après acompte, accès site, plans, choix et validations nécessaires.</td></tr>
        <tr><td>Variations</td><td>Aucune modification n’est exécutée sans écrit préalable et impact délai/prix identifié.</td></tr>
        <tr><td>Réception</td><td>Réception par PV, avec réserves localisées et proportionnées.</td></tr>
        <tr><td>Position client</td><td>${esc(clientTypeClause)}</td></tr>
      </tbody></table>
      <h2>Références projet</h2><p>${esc(project.clientName)} · ${esc(project.clientAddress || '—')} · ${esc(project.location || '—')}</p>
      <div class="signature-grid"><div class="signature-box"><strong>${esc(state.vault.company.name)}</strong><br>${esc(state.vault.company.signatory || 'Signataire')}</div><div class="signature-box"><strong>Client</strong></div></div>
    </div>`;
  }
  if (type === 'avenant') {
    return `<div class="doc-page">${head}
      <h1>Avenant / Change Order</h1>
      <h2>Base projet</h2><p>${esc(project.code)} · ${esc(project.name)}.</p>
      <h2>Effets</h2>
      <table class="doc-table"><thead><tr><th>Impact</th><th>Description</th></tr></thead><tbody>
        <tr><td>Périmètre</td><td>Adaptation à préciser en annexe ou au corps du présent avenant.</td></tr>
        <tr><td>Prix</td><td>Chiffrage complémentaire calculé selon les conditions commerciales du projet.</td></tr>
        <tr><td>Délai</td><td>Prorogation à due concurrence de l’impact réel constaté.</td></tr>
      </tbody></table>
      <p class="doc-note">Aucune exécution de la modification concernée sans validation écrite du présent avenant.</p>
      <div class="signature-grid"><div class="signature-box"><strong>${esc(state.vault.company.name)}</strong></div><div class="signature-box"><strong>Client</strong></div></div>
    </div>`;
  }
  if (type === 'situation') {
    const current = Math.round((project.progressPercent / 100) * (project.budgetHT || 0));
    const previous = Math.round(current * 0.65);
    const period = current - previous;
    return `<div class="doc-page">${head}
      <h1>Situation de travaux</h1>
      <p class="doc-note">Constat d’avancement lié au projet ${esc(project.code)}.</p>
      <table class="doc-table"><thead><tr><th>Poste</th><th>Cumul précédent HT</th><th>Période HT</th><th>Cumul à date HT</th></tr></thead><tbody>
        <tr><td>Marché principal</td><td>${money(previous)}</td><td>${money(period)}</td><td>${money(current)}</td></tr>
      </tbody></table>
      <h2>Observations</h2><p>La situation reflète une progression chantier estimative de ${pct(project.progressPercent)} et reste ajustable à l’issue des métrés finaux et de la régularisation des avenants.</p>
    </div>`;
  }
  if (type === 'pv') {
    return `<div class="doc-page">${head}
      <h1>Procès-verbal de réception</h1>
      <h2>Constat</h2><p>Les parties se réunissent pour constater l’état des prestations principales du projet ${esc(project.code)}.</p>
      <table class="doc-table"><thead><tr><th>Décision</th><th>Commentaire</th></tr></thead><tbody>
        <tr><td>Réception</td><td>Prononcée lorsque les prestations principales sont en état d’usage normal, avec ou sans réserves.</td></tr>
        <tr><td>Réserves</td><td>Doivent être précises, localisées et objectivement vérifiables.</td></tr>
        <tr><td>Solde</td><td>Exigible selon les conditions convenues, hors retenues ciblées sur postes réservés.</td></tr>
      </tbody></table>
      <div class="signature-grid"><div class="signature-box"><strong>${esc(state.vault.company.name)}</strong></div><div class="signature-box"><strong>Client</strong></div></div>
    </div>`;
  }
  const auditRows = assignments.map(a => {
    const c = contactById(a.contactId);
    const issue = avg([a.quality,a.reliability,a.speed,a.discipline]) && avg([a.quality,a.reliability,a.speed,a.discipline]) < 3.5 ? 'Surveiller les reprises / coordination' : 'Contrôle courant';
    return `<tr><td>${esc(a.phase || '—')}</td><td>${esc(a.specialty)}</td><td>${esc(c ? c.name : '—')}</td><td>${esc(issue)}</td></tr>`;
  }).join('') || `<tr><td colspan="4">Aucune ligne d’audit initiale.</td></tr>`;
  return `<div class="doc-page">${head}
    <h1>Audit chantier</h1>
    <h2>Synthèse</h2><p>Audit interne de conformité opérationnelle et de suivi du projet ${esc(project.code)}.</p>
    <table class="doc-table"><thead><tr><th>Phase</th><th>Lot</th><th>Responsable</th><th>Action</th></tr></thead><tbody>${auditRows}</tbody></table>
    <h2>Base documentaire</h2><p>${esc(project.scopeSummary || '—')}</p>
  </div>`;
}

function printDoc(html){
  const win = window.open('', '_blank');
  if (!win) return showToast('Le navigateur a bloqué la fenêtre d’impression.', 'error');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Doc</title><style>${document.querySelector('style').innerHTML}</style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function renderActivity(){
  $('content').innerHTML = `
    <div class="card pane">
      <div class="section-title"><div class="label">Journal d’activité</div></div>
      <div class="activity-list">
        ${state.vault.activity.map(a => `<div class="activity-item"><div class="activity-meta">${shortDate(a.at)} · ${esc(a.type)}</div><div>${esc(a.detail)}</div></div>`).join('')}
      </div>
    </div>
  `;
}

function renderSettings(){
  $('content').innerHTML = `
    <div class="grid-main">
      <div class="card pane">
        <div class="section-title"><div class="label">Société & sécurité</div></div>
        <div class="grid-2">
          <div class="form-row"><label>Nom société</label><input id="stCompanyName" value="${esc(state.vault.company.name)}"></div>
          <div class="form-row"><label>Signataire</label><input id="stSignatory" value="${esc(state.vault.company.signatory)}"></div>
          <div class="form-row"><label>Adresse</label><input id="stAddress" value="${esc(state.vault.company.address || '')}"></div>
          <div class="form-row"><label>Email</label><input id="stEmail" value="${esc(state.vault.company.email || '')}"></div>
        </div>
        <div class="form-row"><label>Verrouiller au changement d’onglet</label><select id="lockOnBlurSelect"><option value="true" ${state.vault.company.lockOnBlur ? 'selected' : ''}>Oui</option><option value="false" ${!state.vault.company.lockOnBlur ? 'selected' : ''}>Non</option></select></div>
        <div class="inline-actions"><button class="btn btn-primary" id="btnSaveSettings">Enregistrer</button><button class="btn btn-secondary" id="btnLockNow">Verrouiller maintenant</button></div>
      </div>
      <div class="card pane">
        <div class="section-title"><div class="label">Export / import</div></div>
        <div class="helper">Export du coffre chiffré pour sauvegarde ou transfert. L’import remplace le coffre actuel.</div>
        <div style="height:12px"></div>
        <div class="inline-actions">
          <button class="btn btn-primary" id="btnExportVault">Exporter le coffre chiffré</button>
          <label class="btn btn-secondary" for="importVaultInput">Importer un coffre</label>
          <input type="file" class="hidden" id="importVaultInput" accept=".json,application/json" />
        </div>
        <div style="height:12px"></div>
        <div class="helper">Cette version est sérieuse pour une app statique locale, mais une vraie sécurité entreprise nécessitera un backend avec auth, rôles et logs côté serveur.</div>
      </div>
    </div>
  `;
  $('btnSaveSettings').onclick = async () => {
    state.vault.company.name = $('stCompanyName').value.trim() || state.vault.company.name;
    state.vault.company.signatory = $('stSignatory').value.trim() || state.vault.company.signatory;
    state.vault.company.address = $('stAddress').value.trim();
    state.vault.company.email = $('stEmail').value.trim();
    state.vault.company.lockOnBlur = $('lockOnBlurSelect').value === 'true';
    logActivity('settings_updated', 'Paramètres société mis à jour');
    await persistVault();
    showToast('Paramètres enregistrés.');
    renderSettings();
  };
  $('btnLockNow').onclick = () => lockApp();
  $('btnExportVault').onclick = () => exportTextFile(`${state.vault.company.name.replace(/\s+/g,'-').toLowerCase()}-vault-v5.json`, localStorage.getItem(STORAGE_KEY), 'application/json');
  $('importVaultInput').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    try {
      JSON.parse(text);
      localStorage.setItem(STORAGE_KEY, text);
      showToast('Coffre importé. Déverrouille-le pour continuer.');
      lockApp();
    } catch {
      showToast('Fichier invalide.', 'error');
    }
  };
}

function exportTextFile(name, text, type='text/plain'){
  const blob = new Blob([text], {type});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}

function openModal(title, body, onConfirm, confirmLabel='Enregistrer'){
  const root = $('modalRoot');
  root.innerHTML = `
    <div class="modal-backdrop">
      <div class="modal">
        <div class="topline" style="margin-bottom:12px">
          <div style="font-size:22px;font-weight:600">${esc(title)}</div>
          <button class="btn btn-ghost small" id="modalCloseBtn">Fermer</button>
        </div>
        ${body}
        <div class="inline-actions" style="margin-top:14px">
          <button class="btn btn-primary" id="modalConfirmBtn">${esc(confirmLabel)}</button>
          <button class="btn btn-secondary" id="modalCancelBtn">Annuler</button>
        </div>
      </div>
    </div>
  `;
  $('modalCloseBtn').onclick = closeModal;
  $('modalCancelBtn').onclick = closeModal;
  $('modalConfirmBtn').onclick = async () => {
    const ok = await onConfirm();
    if (ok !== false) closeModal();
  };
}
function closeModal(){ $('modalRoot').innerHTML = ''; }

function openProjectModal(project=null){
  const p = defaultProject(project || {});
  openModal(project ? 'Modifier le projet' : 'Nouveau projet', `
    <div class="split-2">
      <div class="form-row"><label>Code</label><input id="p_code" value="${esc(p.code)}"></div>
      <div class="form-row"><label>Nom</label><input id="p_name" value="${esc(p.name)}"></div>
      <div class="form-row"><label>Type client</label><select id="p_clientType">${['particulier','societe'].map(v => `<option value="${v}" ${p.clientType===v?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="form-row"><label>Client</label><input id="p_clientName" value="${esc(p.clientName)}"></div>
      <div class="form-row"><label>Adresse client</label><input id="p_clientAddress" value="${esc(p.clientAddress)}"></div>
      <div class="form-row"><label>Téléphone client</label><input id="p_clientPhone" value="${esc(p.clientPhone)}"></div>
      <div class="form-row"><label>Email client</label><input id="p_clientEmail" value="${esc(p.clientEmail)}"></div>
      <div class="form-row"><label>Localisation</label><input id="p_location" value="${esc(p.location)}"></div>
      <div class="form-row"><label>Architecte</label><input id="p_architect" value="${esc(p.architect)}"></div>
      <div class="form-row"><label>BET</label><input id="p_bet" value="${esc(p.bet)}"></div>
      <div class="form-row"><label>Statut</label><select id="p_status">${['appel offre','en cours','termine','bloque'].map(v => `<option value="${v}" ${p.status===v?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="form-row"><label>Phase</label><input id="p_phase" value="${esc(p.phase)}"></div>
      <div class="form-row"><label>Spécialités requises (virgule)</label><input id="p_requiredSpecialties" value="${esc(p.requiredSpecialties.join(', '))}"></div>
      <div class="form-row"><label>Date début</label><input id="p_startDate" type="date" value="${esc(p.startDate)}"></div>
      <div class="form-row"><label>Date fin</label><input id="p_endDate" type="date" value="${esc(p.endDate)}"></div>
      <div class="form-row"><label>Budget HT</label><input id="p_budgetHT" type="number" value="${esc(p.budgetHT)}"></div>
      <div class="form-row"><label>Budget TTC</label><input id="p_budgetTTC" type="number" value="${esc(p.budgetTTC)}"></div>
      <div class="form-row"><label>Acompte %</label><input id="p_depositPercent" type="number" min="0" max="100" value="${esc(p.depositPercent)}"></div>
      <div class="form-row"><label>Délai jours</label><input id="p_delayDays" type="number" value="${esc(p.delayDays)}"></div>
      <div class="form-row"><label>Progression %</label><input id="p_progressPercent" type="number" min="0" max="100" value="${esc(p.progressPercent)}"></div>
    </div>
    <div class="form-row"><label>Scope summary</label><textarea id="p_scopeSummary">${esc(p.scopeSummary)}</textarea></div>
    <div class="split-2">
      <div class="form-row"><label>Inclusions (virgule)</label><textarea id="p_inclusions">${esc(p.inclusions.join(', '))}</textarea></div>
      <div class="form-row"><label>Exclusions (virgule)</label><textarea id="p_exclusions">${esc(p.exclusions.join(', '))}</textarea></div>
    </div>
    <div class="split-2">
      <div class="form-row"><label>Hypothèses (virgule)</label><textarea id="p_assumptions">${esc(p.assumptions.join(', '))}</textarea></div>
      <div class="form-row"><label>Conditions de paiement</label><textarea id="p_paymentTerms">${esc(p.paymentTerms)}</textarea></div>
    </div>
    <div class="form-row"><label>Notes</label><textarea id="p_notes">${esc(p.notes)}</textarea></div>
  `, async () => {
    const payload = defaultProject({
      id: project?.id || uid('proj'),
      code: $('p_code').value.trim(),
      name: $('p_name').value.trim(),
      clientType: $('p_clientType').value,
      clientName: $('p_clientName').value.trim(),
      clientAddress: $('p_clientAddress').value.trim(),
      clientPhone: $('p_clientPhone').value.trim(),
      clientEmail: $('p_clientEmail').value.trim(),
      architect: $('p_architect').value.trim(),
      bet: $('p_bet').value.trim(),
      location: $('p_location').value.trim(),
      status: $('p_status').value,
      phase: $('p_phase').value.trim(),
      requiredSpecialties: csvList($('p_requiredSpecialties').value),
      startDate: $('p_startDate').value,
      endDate: $('p_endDate').value,
      budgetHT: Number($('p_budgetHT').value || 0),
      budgetTTC: Number($('p_budgetTTC').value || 0),
      depositPercent: Number($('p_depositPercent').value || 0),
      delayDays: Number($('p_delayDays').value || 0),
      progressPercent: Number($('p_progressPercent').value || 0),
      scopeSummary: $('p_scopeSummary').value.trim(),
      inclusions: csvList($('p_inclusions').value),
      exclusions: csvList($('p_exclusions').value),
      assumptions: csvList($('p_assumptions').value),
      paymentTerms: $('p_paymentTerms').value.trim(),
      notes: $('p_notes').value.trim()
    });
    if (!payload.code || !payload.name || !payload.clientName) return showToast('Code, nom et client sont requis.', 'error'), false;
    if (project) {
      Object.assign(project, payload);
      logActivity('project_updated', `${payload.code} mis à jour`);
    } else {
      state.vault.projects.unshift(payload);
      state.selectedProjectId = payload.id;
      state.docDraft.projectId = payload.id;
      state.matchDraft.projectId = payload.id;
      logActivity('project_created', `${payload.code} créé`);
    }
    await persistVault();
    renderProjects();
    showToast('Projet enregistré.');
  });
}

function openContactModal(contact=null){
  const c = defaultContact(contact || {});
  const check = (id, value) => `<label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="${id}" ${value ? 'checked' : ''}> <span>${id.replace(/_/g,' ')}</span></label>`;
  openModal(contact ? 'Modifier le contact' : 'Nouveau contact', `
    <div class="split-2">
      <div class="form-row"><label>Nom</label><input id="c_name" value="${esc(c.name)}"></div>
      <div class="form-row"><label>Nom commercial</label><input id="c_tradeName" value="${esc(c.tradeName)}"></div>
      <div class="form-row"><label>Type</label><select id="c_kind">${['sous-traitant','chef equipe','ouvrier','fournisseur'].map(v => `<option value="${v}" ${c.kind===v?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="form-row"><label>Spécialité principale</label><select id="c_primarySpecialty">${SPECIALTIES.map(v => `<option value="${v}" ${c.primarySpecialty===v?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="form-row"><label>Spécialités secondaires (virgule)</label><input id="c_specialties" value="${esc(c.specialties.join(', '))}"></div>
      <div class="form-row"><label>Ville</label><input id="c_city" value="${esc(c.city)}"></div>
      <div class="form-row"><label>Zones couvertes (virgule)</label><input id="c_zones" value="${esc(c.zones.join(', '))}"></div>
      <div class="form-row"><label>Téléphone</label><input id="c_phone" value="${esc(c.phone)}"></div>
      <div class="form-row"><label>WhatsApp</label><input id="c_whatsapp" value="${esc(c.whatsapp)}"></div>
      <div class="form-row"><label>Email</label><input id="c_email" value="${esc(c.email)}"></div>
      <div class="form-row"><label>Statut légal</label><select id="c_legalStatus">${['informel','auto-entrepreneur','societe'].map(v => `<option value="${v}" ${c.legalStatus===v?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="form-row"><label>Niveau de confiance</label><select id="c_trust">${['eleve','moyen','faible'].map(v => `<option value="${v}" ${c.trust===v?'selected':''}>${v}</option>`).join('')}</select></div>
      <div class="form-row"><label>Disponibilité</label><input id="c_availability" value="${esc(c.availability)}"></div>
      <div class="form-row"><label>Tarif jour MAD</label><input id="c_rateDay" type="number" value="${esc(c.rateDay)}"></div>
      <div class="form-row"><label>Forfait MAD</label><input id="c_ratePackage" type="number" value="${esc(c.ratePackage)}"></div>
      <div class="form-row"><label>Taille équipe</label><input id="c_crewSize" type="number" value="${esc(c.crewSize)}"></div>
      <div class="form-row"><label>Expérience (ans)</label><input id="c_yearsExperience" type="number" value="${esc(c.yearsExperience)}"></div>
      <div class="form-row"><label>Taille de lot mini</label><input id="c_minJobSize" value="${esc(c.minJobSize)}"></div>
      <div class="form-row"><label>Mode de paiement</label><input id="c_paymentMode" value="${esc(c.paymentMode)}"></div>
      <div class="form-row"><label>Langues (virgule)</label><input id="c_languages" value="${esc(c.languages.join(', '))}"></div>
      <div class="form-row"><label>Tags (virgule)</label><input id="c_tags" value="${esc(c.tags.join(', '))}"></div>
      <div class="form-row"><label>Source</label><input id="c_referralSource" value="${esc(c.referralSource)}"></div>
      <div class="form-row"><label>Dernière phase connue</label><input id="c_lastKnownStage" value="${esc(c.lastKnownStage)}"></div>
    </div>
    <div class="split-2">
      <div class="form-row"><label>Capacités</label>
        <label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="c_canLeadTeam" ${c.canLeadTeam ? 'checked' : ''}> Peut mener une équipe</label>
        <label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="c_ownTools" ${c.ownTools ? 'checked' : ''}> Possède ses outils</label>
        <label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="c_hasVehicle" ${c.hasVehicle ? 'checked' : ''}> Dispose d’un véhicule</label>
      </div>
      <div class="form-row"><label>Conformité</label>
        <label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="c_comp_idReceived" ${c.compliance.idReceived ? 'checked' : ''}> CIN / ID reçu</label>
        <label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="c_comp_contractSigned" ${c.compliance.contractSigned ? 'checked' : ''}> Contrat signé</label>
        <label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="c_comp_ndaSigned" ${c.compliance.ndaSigned ? 'checked' : ''}> NDA / confidentialité</label>
        <label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="c_comp_bankInfo" ${c.compliance.bankInfo ? 'checked' : ''}> Coordonnées bancaires</label>
        <label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="c_comp_taxStatus" ${c.compliance.taxStatus ? 'checked' : ''}> Statut fiscal documenté</label>
        <label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="c_comp_safetyBriefing" ${c.compliance.safetyBriefing ? 'checked' : ''}> Brief sécurité fait</label>
      </div>
    </div>
    <div class="form-row"><label>Notes</label><textarea id="c_notes">${esc(c.notes)}</textarea></div>
  `, async () => {
    const primary = $('c_primarySpecialty').value;
    const payload = defaultContact({
      id: contact?.id || uid('ct'),
      name: $('c_name').value.trim(),
      tradeName: $('c_tradeName').value.trim(),
      kind: $('c_kind').value,
      primarySpecialty: primary,
      specialties: unique([primary, ...csvList($('c_specialties').value)]),
      city: $('c_city').value.trim(),
      zones: unique(csvList($('c_zones').value)),
      phone: $('c_phone').value.trim(),
      whatsapp: $('c_whatsapp').value.trim(),
      email: $('c_email').value.trim(),
      legalStatus: $('c_legalStatus').value,
      trust: $('c_trust').value,
      availability: $('c_availability').value.trim(),
      availabilityDays: availabilityDaysFromText($('c_availability').value.trim()),
      rateDay: Number($('c_rateDay').value || 0),
      ratePackage: Number($('c_ratePackage').value || 0),
      crewSize: Number($('c_crewSize').value || 1),
      yearsExperience: Number($('c_yearsExperience').value || 0),
      canLeadTeam: $('c_canLeadTeam').checked,
      ownTools: $('c_ownTools').checked,
      hasVehicle: $('c_hasVehicle').checked,
      minJobSize: $('c_minJobSize').value.trim(),
      paymentMode: $('c_paymentMode').value.trim(),
      languages: csvList($('c_languages').value),
      tags: csvList($('c_tags').value),
      referralSource: $('c_referralSource').value.trim(),
      lastKnownStage: $('c_lastKnownStage').value.trim(),
      notes: $('c_notes').value.trim(),
      compliance: {
        idReceived: $('c_comp_idReceived').checked,
        contractSigned: $('c_comp_contractSigned').checked,
        ndaSigned: $('c_comp_ndaSigned').checked,
        bankInfo: $('c_comp_bankInfo').checked,
        taxStatus: $('c_comp_taxStatus').checked,
        safetyBriefing: $('c_comp_safetyBriefing').checked
      }
    });
    if (!payload.name) return showToast('Le nom est requis.', 'error'), false;
    if (contact) {
      Object.assign(contact, payload);
      logActivity('contact_updated', `${payload.name} mis à jour`);
    } else {
      state.vault.contacts.unshift(payload);
      state.selectedContactId = payload.id;
      logActivity('contact_created', `${payload.name} créé`);
    }
    await persistVault();
    renderNetwork();
    showToast('Contact enregistré.');
  });
}

function openAssignmentModal(assignment=null, defaults={}){
  openModal(assignment ? 'Modifier l’affectation' : 'Nouvelle affectation', `
    <div class="split-2">
      <div class="form-row"><label>Projet</label><select id="a_project">${state.vault.projects.map(p => `<option value="${p.id}" ${(assignment?.projectId || defaults.projectId)===p.id?'selected':''}>${esc(p.code)} · ${esc(p.name)}</option>`).join('')}</select></div>
      <div class="form-row"><label>Contact</label><select id="a_contact">${state.vault.contacts.map(c => `<option value="${c.id}" ${(assignment?.contactId || defaults.contactId)===c.id?'selected':''}>${esc(c.name)} · ${esc(c.primarySpecialty)}</option>`).join('')}</select></div>
      <div class="form-row"><label>Spécialité</label><select id="a_specialty">${SPECIALTIES.map(s => `<option value="${s}" ${(assignment?.specialty || defaults.specialty)===s?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="form-row"><label>Phase</label><input id="a_phase" value="${esc(assignment?.phase || '')}"></div>
      <div class="form-row"><label>Rôle</label><input id="a_role" value="${esc(assignment?.role || '')}"></div>
      <div class="form-row"><label>Statut</label><select id="a_status">${['propose','planifie','en cours','termine','bloque'].map(s => `<option value="${s}" ${assignment?.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="form-row"><label>Début</label><input id="a_from" type="date" value="${esc(assignment?.from || '')}"></div>
      <div class="form-row"><label>Fin</label><input id="a_to" type="date" value="${esc(assignment?.to || '')}"></div>
      <div class="form-row"><label>Qualité /5</label><input id="a_quality" type="number" min="0" max="5" value="${esc(assignment?.quality || 0)}"></div>
      <div class="form-row"><label>Fiabilité /5</label><input id="a_reliability" type="number" min="0" max="5" value="${esc(assignment?.reliability || 0)}"></div>
      <div class="form-row"><label>Vitesse /5</label><input id="a_speed" type="number" min="0" max="5" value="${esc(assignment?.speed || 0)}"></div>
      <div class="form-row"><label>Discipline /5</label><input id="a_discipline" type="number" min="0" max="5" value="${esc(assignment?.discipline || 0)}"></div>
      <div class="form-row"><label>Réembauche</label><select id="a_rehire"><option value="" ${assignment?.rehire===null || assignment?.rehire===undefined ? 'selected' : ''}>À décider</option><option value="true" ${assignment?.rehire===true?'selected':''}>Oui</option><option value="false" ${assignment?.rehire===false?'selected':''}>Non</option></select></div>
    </div>
    <div class="form-row"><label>Notes</label><textarea id="a_notes">${esc(assignment?.notes || '')}</textarea></div>
  `, async () => {
    const rehireRaw = $('a_rehire').value;
    const payload = defaultAssignment({
      id: assignment?.id || uid('as'),
      projectId: $('a_project').value,
      contactId: $('a_contact').value,
      specialty: $('a_specialty').value,
      phase: $('a_phase').value.trim(),
      role: $('a_role').value.trim(),
      status: $('a_status').value,
      from: $('a_from').value,
      to: $('a_to').value,
      quality: Number($('a_quality').value || 0),
      reliability: Number($('a_reliability').value || 0),
      speed: Number($('a_speed').value || 0),
      discipline: Number($('a_discipline').value || 0),
      rehire: rehireRaw === '' ? null : rehireRaw === 'true',
      notes: $('a_notes').value.trim()
    });
    if (assignment) {
      Object.assign(assignment, payload);
      logActivity('assignment_updated', `${payload.specialty} mise à jour`);
    } else {
      state.vault.assignments.unshift(payload);
      state.selectedAssignmentId = payload.id;
      logActivity('assignment_created', `${payload.specialty} affectée`);
    }
    await persistVault();
    renderAssignments();
    showToast('Affectation enregistrée.');
  });
}

function quickSearchModal(){
  openModal('Recherche rapide', `
    <div class="form-row"><label>Recherche</label><input id="quickSearchInput" placeholder="Projet, contact, spécialité, code..."></div>
    <div id="quickSearchResults" class="list-pane"></div>
  `, () => false, 'Fermer');
  $('modalConfirmBtn').classList.add('hidden');
  $('quickSearchInput').oninput = () => {
    const q = $('quickSearchInput').value.toLowerCase().trim();
    const items = [];
    if (q) {
      state.vault.projects.forEach(p => {
        if ([p.code,p.name,p.clientName,p.location,p.scopeSummary].join(' ').toLowerCase().includes(q)) items.push({type:'project', id:p.id, label:`${p.code} · ${p.name}`, meta:p.location || '—'});
      });
      state.vault.contacts.forEach(c => {
        if ([c.name,c.tradeName,c.primarySpecialty,c.city,c.notes,c.tags.join(' ')].join(' ').toLowerCase().includes(q)) items.push({type:'contact', id:c.id, label:`${c.name} · ${c.primarySpecialty}`, meta:c.city || '—'});
      });
    }
    $('quickSearchResults').innerHTML = items.map(x => `<div class="entity-card" data-search-hit="${x.type}:${x.id}"><div class="entity-title">${esc(x.label)}</div><div class="entity-meta">${esc(x.meta)}</div></div>`).join('') || `<div class="empty-state">Aucun résultat.</div>`;
    document.querySelectorAll('[data-search-hit]').forEach(el => el.onclick = () => {
      const [type,id] = el.dataset.searchHit.split(':');
      closeModal();
      if (type === 'project') { state.selectedProjectId = id; setView('projects'); }
      if (type === 'contact') { state.selectedContactId = id; setView('network'); }
    });
  };
}

function bindShell(){
  document.querySelectorAll('.nav-btn[data-view]').forEach(btn => btn.onclick = () => setView(btn.dataset.view));
  $('btnSidebarLock').onclick = () => lockApp();
  $('btnOpenSidebar').onclick = () => $('sidebar').classList.add('show');
  $('btnCloseSidebar').onclick = () => $('sidebar').classList.remove('show');
  $('btnGlobalSearch').onclick = quickSearchModal;
  $('btnQuickDoc').onclick = () => setView('documents');
}

$('btnCreateVault').onclick = createVault;
$('btnUnlockVault').onclick = unlockVault;
$('btnResetVault').onclick = () => {
  if (confirm('Réinitialiser le coffre local ? Toutes les données locales seront supprimées.')) {
    localStorage.removeItem(STORAGE_KEY);
    LEGACY_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
    initAuthView();
    setAuthMessage('unlockVaultMessage', 'Coffre supprimé.', 'success');
  }
};

bindShell();
initAuthView();
