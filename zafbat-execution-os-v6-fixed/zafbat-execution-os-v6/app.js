import { materializeData, renderTemplate } from './app-helpers/zafbat-docs.js';

const STORAGE_KEY = 'zafbat_execution_os_v6';
const LEGACY_KEYS = ['zafbat_execution_os_v5', 'zafbat_execution_os_v1'];
const LOCK_TIMEOUT_MS = 12 * 60 * 1000;

const PROJECT_STATUSES = ['Prospect','Devis envoyé','Négociation','Contrat signé','Préparation','En cours','Bloqué','Réception partielle','Réception finale','Clôturé','Archivé'];
const DOCUMENT_STATUSES = ['Brouillon','Généré','Envoyé','Validé','Signé','Archivé'];
const CONTACT_STATUSES = ['Prospecté','Vérifié','Test chantier','Approuvé','Premium','À surveiller','Exclu'];
const ASSIGNMENT_STATUSES = ['Pressenti','Contacté','Confirmé','Mobilisé','En cours','Terminé','Évalué','Litige'];
const INCIDENT_STATUSES = ['Ouvert','En cours','Résolu'];
const PAYMENT_STATUSES = ['Prévu','Émis','Partiel','Réglé','En retard'];
const SPECIALTIES = [
  'Tracage','Terrassement','Coffrage','Aide coffrage','Ferraillage','Beton',
  'Maconnerie','Etancheite','Plomberie','Electricite','Carrelage','Platre',
  'Menuiserie alu','Menuiserie bois','Peinture','Facade','VRD','Piscine','Domotique','Finitions'
];
const DOC_TYPE_LABELS = {devis:'Devis', contrat:'Contrat', avenant:'Avenant', situation:'Situation', pv:'PV réception', audit:'Audit chantier'};
const ADJACENT_SPECIALTIES = {
  'Tracage':['Terrassement','VRD'],'Terrassement':['Tracage','VRD'],'Coffrage':['Aide coffrage','Ferraillage','Beton'],'Aide coffrage':['Coffrage','Beton'],'Ferraillage':['Coffrage','Beton'],'Beton':['Coffrage','Aide coffrage','Ferraillage'],'Maconnerie':['Platre','Facade'],'Etancheite':['Facade','Piscine'],'Plomberie':['Electricite','Domotique'],'Electricite':['Domotique','Plomberie'],'Carrelage':['Finitions','Platre'],'Platre':['Peinture','Finitions'],'Menuiserie alu':['Facade','Finitions'],'Menuiserie bois':['Finitions','Peinture'],'Peinture':['Finitions','Platre'],'Facade':['Etancheite','Peinture'],'VRD':['Terrassement','Tracage'],'Piscine':['Etancheite','Beton'],'Domotique':['Electricite'],'Finitions':['Peinture','Carrelage','Menuiserie bois']
};
const VIEWS = {
  dashboard:{title:'Dashboard', sub:'Actions à faire, alertes, marge, conformité et progression projet.'},
  projects:{title:'Projects', sub:'Cockpit projet : pipeline, coûts, marge, documents, équipe et incidents.'},
  network:{title:'Execution Network', sub:'Base partenaires approfondie : capacité, conformité, coûts, mémoire de performance.'},
  matching:{title:'Matching', sub:'Matching pondéré par spécialité, historique, coût, conformité, disponibilité et zone.'},
  assignments:{title:'Assignments', sub:'Affectations reliées aux projets, coûts terrain, reviews et réembauche.'},
  documents:{title:'Documents', sub:'Templates séparés du code, snapshots figés et génération depuis les données projet.'},
  field:{title:'Field', sub:'Mode terrain : incident, review rapide, présence et note chantier.'},
  activity:{title:'Activity Log', sub:'Journal append-only du coffre, utile pour la traçabilité interne.'},
  settings:{title:'Settings', sub:'Sécurité locale, paramètres société, export / import et gouvernance du coffre.'}
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
  docDraft: {projectId:'', type:'devis', status:'Brouillon'},
  templates: {},
  docCss: ''
};

const $ = (id) => document.getElementById(id);
const esc = (v='') => String(v).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const nowIso = () => new Date().toISOString();
const uid = (p='id') => `${p}_${Math.random().toString(36).slice(2,10)}${Date.now().toString(36).slice(-4)}`;
const shortDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
const money = (v) => new Intl.NumberFormat('fr-MA', {style:'currency', currency:'MAD', maximumFractionDigits:0}).format(Number(v || 0));
const csvList = (v) => (Array.isArray(v) ? v : String(v || '').split(',')).map(x => String(x).trim()).filter(Boolean);
const unique = (arr) => Array.from(new Set(arr.filter(Boolean)));
const avg = (arr) => { const items = arr.filter(n => Number(n) > 0).map(Number); return items.length ? items.reduce((a,b)=>a+b,0) / items.length : 0; };
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const pct = (v) => `${Math.round(Number(v || 0))}%`;

function toBase64(buf){ return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function fromBase64(b64){ return Uint8Array.from(atob(b64), c => c.charCodeAt(0)); }
function availabilityDaysFromText(v=''){ const t=String(v).toLowerCase(); if(!t) return 14; if(t.includes('dispo')) return 0; const n=Number((t.match(/\d+/)||[14])[0]); if(t.includes('mois')) return n*30; if(t.includes('semaine')) return n*7; return n||14; }
function daysBetween(a,b){ if(!a||!b) return 0; const ms=Math.max(0,new Date(b)-new Date(a)); return Math.ceil(ms/86400000)+1; }
function formatStatusBadge(val){
  const lc = String(val || '').toLowerCase();
  let kind='neutral';
  if(['en cours','réception finale','clôturé','archivé','approuvé','premium','réglé','généré','signé','validé','évalué','résolu','confirmé','mobilisé','terminé'].includes(lc)) kind='ok';
  else if(['prospect','devis envoyé','négociation','préparation','test chantier','prévu','émis','partiel','contacté','pressenti'].includes(lc)) kind='warn';
  else if(['bloqué','à surveiller','exclu','en retard','litige','ouvert'].includes(lc)) kind='danger';
  else kind='info';
  return `<span class="badge ${kind}">${esc(val || '—')}</span>`;
}
function trustBadge(val){ return formatStatusBadge(val); }
function yesNo(v){ return v ? 'Oui' : 'Non'; }

async function deriveKey(passphrase, salt){
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2', salt, iterations:250000, hash:'SHA-256'}, baseKey, {name:'AES-GCM', length:256}, false, ['encrypt','decrypt']);
}
async function encryptVault(vault, passphrase){
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const payload = new TextEncoder().encode(JSON.stringify(vault));
  const encrypted = await crypto.subtle.encrypt({name:'AES-GCM', iv}, key, payload);
  return {salt:toBase64(salt), iv:toBase64(iv), cipher:toBase64(encrypted), meta:{version:6, updatedAt:nowIso()}};
}
async function decryptVault(envelope, passphrase){
  const key = await deriveKey(passphrase, fromBase64(envelope.salt));
  const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv:fromBase64(envelope.iv)}, key, fromBase64(envelope.cipher));
  return JSON.parse(new TextDecoder().decode(plain));
}
async function sha256(text){
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('').slice(0,16);
}

function defaultCompany(company={}){
  return {
    name: company.name || 'ZAF BAT',
    signatory: company.signatory || 'Signataire',
    legalForm: company.legalForm || 'SARL',
    ice: company.ice || '',
    if: company.if || '',
    rc: company.rc || '',
    address: company.address || 'Casablanca',
    phone: company.phone || '',
    email: company.email || '',
    lockOnBlur: company.lockOnBlur !== false,
    workflowDefaults: company.workflowDefaults || {depositPercent:30, delayDays:90, marginTarget:28}
  };
}
function defaultProject(project={}){
  const pricingLines = Array.isArray(project.pricingLines) ? project.pricingLines : [];
  return {
    id: project.id || uid('proj'),
    code: project.code || '',
    name: project.name || '',
    projectType: project.projectType || 'villa',
    standing: project.standing || 'premium',
    clientType: project.clientType || 'particulier',
    clientName: project.clientName || '',
    clientAddress: project.clientAddress || '',
    clientEmail: project.clientEmail || '',
    clientPhone: project.clientPhone || '',
    architect: project.architect || '',
    bet: project.bet || '',
    location: project.location || '',
    status: project.status || 'Prospect',
    phase: project.phase || '',
    requiredSpecialties: unique(csvList(project.requiredSpecialties || [])),
    startDate: project.startDate || '',
    endDate: project.endDate || '',
    budgetHT: Number(project.budgetHT ?? 0),
    budgetTTC: Number(project.budgetTTC ?? 0),
    materialBudget: Number(project.materialBudget ?? 0),
    depositPercent: Number(project.depositPercent ?? 30),
    delayDays: Number(project.delayDays ?? 90),
    progressPercent: Number(project.progressPercent ?? 0),
    paymentTerms: project.paymentTerms || '30% acompte · situations intermédiaires · solde à la réception.',
    scopeSummary: project.scopeSummary || '',
    inclusions: unique(csvList(project.inclusions || [])),
    exclusions: unique(csvList(project.exclusions || [])),
    assumptions: unique(csvList(project.assumptions || [])),
    pricingLines: pricingLines.map(line => ({designation: line.designation || '', unite: line.unite || 'forfait', qte: Number(line.qte || 1), pu: Number(line.pu || 0)})),
    notes: project.notes || ''
  };
}
function defaultContact(contact={}){
  const specialties = unique([contact.primarySpecialty || '', ...csvList(contact.specialties || [])]);
  const compliance = contact.compliance || {};
  return {
    id: contact.id || uid('ct'),
    status: contact.status || 'Prospecté',
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
    status: assignment.status || 'Pressenti',
    projectId: assignment.projectId || '',
    contactId: assignment.contactId || '',
    specialty: assignment.specialty || '',
    phase: assignment.phase || '',
    role: assignment.role || '',
    from: assignment.from || '',
    to: assignment.to || '',
    plannedDays: Number(assignment.plannedDays ?? 0),
    actualDays: Number(assignment.actualDays ?? 0),
    reworkPct: Number(assignment.reworkPct ?? 0),
    notes: assignment.notes || ''
  };
}
function defaultReview(review={}){
  return {
    id: review.id || uid('rv'),
    assignmentId: review.assignmentId || '',
    projectId: review.projectId || '',
    contactId: review.contactId || '',
    date: review.date || nowIso().slice(0,10),
    quality: Number(review.quality ?? 0),
    reliability: Number(review.reliability ?? 0),
    speed: Number(review.speed ?? 0),
    discipline: Number(review.discipline ?? 0),
    rehire: review.rehire === undefined ? null : review.rehire,
    notes: review.notes || ''
  };
}
function defaultPayment(payment={}){
  return {
    id: payment.id || uid('pay'),
    projectId: payment.projectId || '',
    kind: payment.kind || 'Acompte',
    dueDate: payment.dueDate || '',
    amount: Number(payment.amount ?? 0),
    receivedAmount: Number(payment.receivedAmount ?? 0),
    status: payment.status || 'Prévu',
    notes: payment.notes || ''
  };
}
function defaultIncident(incident={}){
  return {
    id: incident.id || uid('inc'),
    projectId: incident.projectId || '',
    severity: incident.severity || 'moyenne',
    category: incident.category || 'chantier',
    status: incident.status || 'Ouvert',
    date: incident.date || nowIso().slice(0,10),
    title: incident.title || '',
    description: incident.description || '',
    linkedContactId: incident.linkedContactId || ''
  };
}
function defaultDocument(doc={}){
  return {
    id: doc.id || uid('doc'),
    projectId: doc.projectId || '',
    type: doc.type || 'devis',
    label: doc.label || DOC_TYPE_LABELS[doc.type] || 'Document',
    status: doc.status || 'Généré',
    fingerprint: doc.fingerprint || '',
    html: doc.html || '',
    createdAt: doc.createdAt || nowIso()
  };
}
function normalizeVault(vault){
  return {
    meta: {version:6, createdAt: vault.meta?.createdAt || nowIso(), updatedAt: vault.meta?.updatedAt || nowIso(), locale:'fr-MA'},
    company: defaultCompany(vault.company || {name: vault.meta?.companyName, signatory: vault.meta?.signatory}),
    projects: (vault.projects || []).map(defaultProject),
    contacts: (vault.contacts || []).map(defaultContact),
    assignments: (vault.assignments || []).map(defaultAssignment),
    reviews: (vault.reviews || []).map(defaultReview),
    payments: (vault.payments || []).map(defaultPayment),
    incidents: (vault.incidents || []).map(defaultIncident),
    documents: (vault.documents || []).map(defaultDocument),
    activity: Array.isArray(vault.activity) ? vault.activity : []
  };
}

function sampleVault(companyName='ZAF BAT', signatory='Ahmed Yassine Fliyou'){
  const p1 = uid('proj'), p2 = uid('proj'), p3 = uid('proj');
  const c1 = uid('ct'), c2 = uid('ct'), c3 = uid('ct'), c4 = uid('ct');
  const a1 = uid('as'), a2 = uid('as'), a3 = uid('as'), a4 = uid('as');
  const r1 = uid('rv'), r2 = uid('rv');
  const pay1 = uid('pay'), pay2 = uid('pay'), pay3 = uid('pay');
  const inc1 = uid('inc');
  const createdAt = nowIso();
  return normalizeVault({
    meta:{createdAt, updatedAt:createdAt},
    company:{name:companyName, signatory, legalForm:'SARL', address:'Casablanca', phone:'+212600000000', email:'contact@zafbat.ma', lockOnBlur:true, workflowDefaults:{depositPercent:30, delayDays:90, marginTarget:28}},
    projects:[
      {id:p1, code:'ZB-VIL-2026-014', name:'Villa Calypso', projectType:'villa', standing:'premium', clientType:'particulier', clientName:'M. et Mme B.', clientAddress:'Bouskoura, Casablanca', clientEmail:'client.calypso@example.com', clientPhone:'+212600001001', architect:'Atelier Atlas', bet:'BET Horizon', location:'Bouskoura', status:'En cours', phase:'Second œuvre', requiredSpecialties:['Menuiserie bois','Peinture','Finitions'], startDate:'2026-02-01', endDate:'2026-06-30', budgetHT:2700000, budgetTTC:3200000, materialBudget:980000, depositPercent:30, delayDays:120, progressPercent:47, paymentTerms:'30% acompte · 30% à fin gros œuvre · 30% à fin second œuvre · 10% à la réception.', scopeSummary:'Villa R+1 haut de gamme avec second œuvre premium, finitions sur mesure et coordination architecte.', inclusions:['Coordination chantier','Lots décrits au devis','Reporting mensuel'], exclusions:['Décoration loose furniture','Honoraires architecte','Démarches administratives non précisées'], assumptions:['Accès site maintenu','Choix matériaux validés dans les temps','Acompte encaissé avant lancement des commandes'], pricingLines:[{designation:'Menuiserie bois sur mesure', unite:'forfait', qte:1, pu:850000},{designation:'Peinture premium & reprises support', unite:'forfait', qte:1, pu:420000},{designation:'Finitions architecturales', unite:'forfait', qte:1, pu:560000}], notes:'Projet vitrine pour finitions premium.'},
      {id:p2, code:'ZB-REN-2026-009', name:'Rénovation Ain Diab', projectType:'villa', standing:'haut', clientType:'societe', clientName:'Palm Asset SARL', clientAddress:'Casablanca Finance City', clientEmail:'procurement@palmasset.ma', clientPhone:'+212600001002', architect:'Studio Luma', bet:'BET Marine', location:'Casablanca', status:'Négociation', phase:'Chiffrage', requiredSpecialties:['Tracage','Coffrage','Electricite'], startDate:'2026-03-10', endDate:'2026-07-15', budgetHT:1250000, budgetTTC:1480000, materialBudget:420000, depositPercent:35, delayDays:95, progressPercent:5, paymentTerms:'35% à la commande · situations mensuelles · solde sur PV de réception.', scopeSummary:'Rénovation lourde d’une villa front de mer avec remise à niveau réseaux et reprise structurelle localisée.', inclusions:['Curage et préparation','Lots structurants chiffrés','Pilotage base planning'], exclusions:['Mobilier intégré non listé','Études structure complémentaires non transmises'], assumptions:['Études remises avant lancement','Site libéré','Décisions client sous 48h sur les variantes'], pricingLines:[{designation:'Préparation / curage', unite:'forfait', qte:1, pu:180000},{designation:'Gros œuvre localisé', unite:'forfait', qte:1, pu:390000},{designation:'Lots techniques', unite:'forfait', qte:1, pu:450000}], notes:'Dossier en cours de finalisation commerciale.'},
      {id:p3, code:'ZB-VIL-2026-021', name:'Villa Noura', projectType:'villa', standing:'premium', clientType:'particulier', clientName:'Mme N.', clientAddress:'Dar Bouazza', clientEmail:'villa.noura@example.com', clientPhone:'+212600001003', architect:'Cabinet Mays', bet:'BET Oryx', location:'Dar Bouazza', status:'Clôturé', phase:'Livré', requiredSpecialties:['Tracage','Coffrage','Peinture'], startDate:'2025-09-01', endDate:'2026-01-20', budgetHT:1800000, budgetTTC:2140000, materialBudget:640000, depositPercent:30, delayDays:135, progressPercent:100, paymentTerms:'30/40/20/10', scopeSummary:'Villa livrée avec pilotage complet et finitions architecturales.', inclusions:['Gros œuvre','Second œuvre','Finitions'], exclusions:['Paysagisme hors lot','Appareils décoratifs'], assumptions:['Client valide les échantillons avant commande'], pricingLines:[{designation:'Gros œuvre principal', unite:'forfait', qte:1, pu:680000},{designation:'Second œuvre', unite:'forfait', qte:1, pu:520000},{designation:'Finitions', unite:'forfait', qte:1, pu:360000}], notes:'Projet de référence livré dans les délais.'}
    ],
    contacts:[
      {id:c1, status:'Premium', kind:'sous-traitant', name:'Hamid Coffrage', tradeName:'Coffrage Premium', primarySpecialty:'Coffrage', specialties:['Coffrage','Aide coffrage','Beton'], city:'Casablanca', zones:['Casablanca','Bouskoura','Dar Bouazza'], phone:'+212600000001', whatsapp:'+212600000001', email:'hamid.coffrage@example.com', legalStatus:'informel', trust:'eleve', availability:'7 jours', availabilityDays:7, rateDay:380, crewSize:6, yearsExperience:11, canLeadTeam:true, ownTools:true, hasVehicle:true, minJobSize:'lot moyen', paymentMode:'virement / espèce', languages:['Darija','Français'], tags:['villa premium','gros œuvre','réactif'], referralSource:'Architecte partenaire', lastKnownStage:'gros œuvre', notes:'Très bon sur villas et coordination de coffrage. Peu de reprises.', compliance:{idReceived:true, contractSigned:true, ndaSigned:false, bankInfo:true, taxStatus:false, safetyBriefing:true}},
      {id:c2, status:'Approuvé', kind:'chef equipe', name:'Youssef Peinture', tradeName:'Youssef Finitions', primarySpecialty:'Peinture', specialties:['Peinture','Finitions','Platre'], city:'Casablanca', zones:['Casablanca','Bouskoura'], phone:'+212600000002', whatsapp:'+212600000002', email:'youssef.peinture@example.com', legalStatus:'auto-entrepreneur', trust:'moyen', availability:'disponible', availabilityDays:0, rateDay:300, crewSize:4, yearsExperience:8, canLeadTeam:true, ownTools:true, hasVehicle:false, minJobSize:'petit lot', paymentMode:'virement', languages:['Darija','Français'], tags:['finitions','chantier propre'], referralSource:'Bouche-à-oreille', lastKnownStage:'finitions', notes:'Bon rendu esthétique, vitesse variable selon préparation des supports.', compliance:{idReceived:true, contractSigned:false, ndaSigned:false, bankInfo:true, taxStatus:true, safetyBriefing:true}},
      {id:c3, status:'Premium', kind:'sous-traitant', name:'Anas Traçage', tradeName:'Implantation Atlas', primarySpecialty:'Tracage', specialties:['Tracage','Terrassement','VRD'], city:'Bouskoura', zones:['Bouskoura','Dar Bouazza','Casablanca'], phone:'+212600000003', whatsapp:'+212600000003', email:'anas.tracage@example.com', legalStatus:'societe', trust:'eleve', availability:'15 jours', availabilityDays:15, rateDay:550, ratePackage:9500, crewSize:3, yearsExperience:10, canLeadTeam:true, ownTools:true, hasVehicle:true, minJobSize:'lot moyen', paymentMode:'virement', languages:['Darija','Français','Arabe'], tags:['implantation','démarrage','rigoureux'], referralSource:'BET Horizon', lastKnownStage:'préparation', notes:'Très fiable pour implantation et démarrage structuré.', compliance:{idReceived:true, contractSigned:true, ndaSigned:true, bankInfo:true, taxStatus:true, safetyBriefing:true}},
      {id:c4, status:'Approuvé', kind:'sous-traitant', name:'Sami Electric', tradeName:'Sami Elec Services', primarySpecialty:'Electricite', specialties:['Electricite','Domotique'], city:'Casablanca', zones:['Casablanca','Ain Diab'], phone:'+212600000004', whatsapp:'+212600000004', email:'sami.elec@example.com', legalStatus:'societe', trust:'eleve', availability:'7 jours', availabilityDays:7, rateDay:520, crewSize:5, yearsExperience:13, canLeadTeam:true, ownTools:true, hasVehicle:true, minJobSize:'lot technique', paymentMode:'virement', languages:['Darija','Français'], tags:['technique','domotique','villa'], referralSource:'Client ancien', lastKnownStage:'réseaux', notes:'Très fiable pour villas et lots techniques.', compliance:{idReceived:true, contractSigned:true, ndaSigned:true, bankInfo:true, taxStatus:true, safetyBriefing:true}}
    ],
    assignments:[
      {id:a1, status:'Évalué', projectId:p3, contactId:c1, specialty:'Coffrage', phase:'Gros œuvre', role:'Équipe coffrage', from:'2025-09-06', to:'2025-10-15', plannedDays:32, actualDays:34, reworkPct:4, notes:'Exécution propre, peu de reprises.'},
      {id:a2, status:'Confirmé', projectId:p1, contactId:c2, specialty:'Peinture', phase:'Finitions', role:'Chef équipe', from:'2026-05-20', to:'2026-06-10', plannedDays:18, actualDays:0, reworkPct:0, notes:'Réservé sur phase finitions.'},
      {id:a3, status:'Pressenti', projectId:p2, contactId:c3, specialty:'Tracage', phase:'Préparation', role:'Implantation', from:'2026-03-12', to:'2026-03-13', plannedDays:2, actualDays:0, reworkPct:0, notes:'À confirmer selon go client.'},
      {id:a4, status:'Évalué', projectId:p3, contactId:c4, specialty:'Electricite', phase:'Second œuvre', role:'Équipe lots techniques', from:'2025-11-01', to:'2025-12-05', plannedDays:22, actualDays:23, reworkPct:3, notes:'Exécution très propre sur réseaux et tableau.'}
    ],
    reviews:[
      {id:r1, assignmentId:a1, projectId:p3, contactId:c1, date:'2025-10-16', quality:5, reliability:5, speed:4, discipline:4, rehire:true, notes:'Très bonne tenue de chantier.'},
      {id:r2, assignmentId:a4, projectId:p3, contactId:c4, date:'2025-12-06', quality:5, reliability:4, speed:4, discipline:5, rehire:true, notes:'Très solide sur technique et mise au point.'}
    ],
    payments:[
      {id:pay1, projectId:p1, kind:'Acompte', dueDate:'2026-02-01', amount:960000, receivedAmount:960000, status:'Réglé', notes:''},
      {id:pay2, projectId:p1, kind:'Situation 1', dueDate:'2026-04-15', amount:640000, receivedAmount:320000, status:'Partiel', notes:'Relance en cours'},
      {id:pay3, projectId:p2, kind:'Acompte', dueDate:'2026-03-20', amount:518000, receivedAmount:0, status:'Prévu', notes:''}
    ],
    incidents:[
      {id:inc1, projectId:p1, severity:'moyenne', category:'coordination', status:'Ouvert', date:'2026-03-05', title:'Choix peinture non validé', description:'Le client n’a pas figé les teintes, impact possible sur lancement finitions.', linkedContactId:c2}
    ],
    documents:[],
    activity:[
      {id:uid('act'), at:createdAt, type:'vault_created', detail:'Coffre V6 initialisé'},
      {id:uid('act'), at:createdAt, type:'seed_loaded', detail:'Jeu de données V6 chargé'}
    ]
  });
}

function getEnvelope(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return {raw, key: STORAGE_KEY};
  for (const key of LEGACY_KEYS) { const v = localStorage.getItem(key); if (v) return {raw:v, key}; }
  return null;
}
function hasVault(){ return !!getEnvelope(); }
function logActivity(type, detail){ if(!state.vault) return; state.vault.activity.unshift({id:uid('act'), at:nowIso(), type, detail}); state.vault.activity = state.vault.activity.slice(0,500); }
function touchUpdated(){ if(state.vault) state.vault.meta.updatedAt = nowIso(); }
async function persistVault(){ if(!state.vault || !state.sessionPassphrase) return; touchUpdated(); const env = await encryptVault(state.vault, state.sessionPassphrase); localStorage.setItem(STORAGE_KEY, JSON.stringify(env)); updateCounts(); }
function showToast(text, kind='ok'){ const el=document.createElement('div'); el.className='toast '+(kind==='error'?'error':'ok'); el.textContent=text; $('toastStack').appendChild(el); setTimeout(()=>el.remove(),3000); }
function setAuthMessage(id,text,cls=''){ const el=$(id); el.className='auth-note '+cls; el.textContent=text; }
function initAuthView(){ $('createVaultView').classList.toggle('hidden', hasVault()); $('unlockVaultView').classList.toggle('hidden', !hasVault()); }

async function createVault(){
  const companyName=$('createCompanyName').value.trim()||'ZAF BAT';
  const signatory=$('createSignatory').value.trim()||'Signataire';
  const pass1=$('createPassphrase').value, pass2=$('createPassphrase2').value;
  if(pass1.length < 10) return setAuthMessage('createVaultMessage','La phrase secrète doit contenir au moins 10 caractères.','error');
  if(pass1 !== pass2) return setAuthMessage('createVaultMessage','Les deux phrases secrètes ne correspondent pas.','error');
  state.vault = sampleVault(companyName, signatory);
  state.sessionPassphrase = pass1;
  logActivity('vault_initialized','Coffre créé et ouvert');
  await persistVault();
  openApp();
}
async function unlockVault(){
  const pass=$('unlockPassphrase').value; if(!pass) return setAuthMessage('unlockVaultMessage','Entre la phrase secrète.','error');
  try{ const env=getEnvelope(); const data=await decryptVault(JSON.parse(env.raw), pass); state.vault=normalizeVault(data); state.sessionPassphrase=pass; if(env.key !== STORAGE_KEY) await persistVault(); openApp(); }
  catch(e){ setAuthMessage('unlockVaultMessage','Phrase secrète invalide ou coffre corrompu.','error'); }
}
function lockApp(){ state.vault=null; state.sessionPassphrase=null; $('unlockPassphrase').value=''; $('appShell').classList.add('hidden'); $('unlockScreen').classList.remove('hidden'); initAuthView(); }
let idleTimer=null;
function resetIdleTimer(){ clearTimeout(idleTimer); idleTimer=setTimeout(()=>{ showToast('Session verrouillée après inactivité.','error'); lockApp(); }, LOCK_TIMEOUT_MS); }
['click','keydown','mousemove','touchstart'].forEach(evt => window.addEventListener(evt, () => state.vault && resetIdleTimer(), {passive:true}));
document.addEventListener('visibilitychange', () => { if(state.vault && state.vault.company.lockOnBlur && document.hidden){ showToast('Session verrouillée au changement d’onglet.','error'); lockApp(); } });

function projectById(id){ return state.vault.projects.find(x => x.id === id); }
function contactById(id){ return state.vault.contacts.find(x => x.id === id); }
function assignmentById(id){ return state.vault.assignments.find(x => x.id === id); }
function documentById(id){ return state.vault.documents.find(x => x.id === id); }
function assignmentsForProject(projectId){ return state.vault.assignments.filter(a => a.projectId === projectId); }
function assignmentsForContact(contactId){ return state.vault.assignments.filter(a => a.contactId === contactId); }
function reviewsForAssignment(assignmentId){ return state.vault.reviews.filter(r => r.assignmentId === assignmentId); }
function reviewsForContact(contactId){ return state.vault.reviews.filter(r => r.contactId === contactId); }
function paymentsForProject(projectId){ return state.vault.payments.filter(p => p.projectId === projectId); }
function incidentsForProject(projectId){ return state.vault.incidents.filter(i => i.projectId === projectId); }
function projectLaborMetrics(projectId){
  const assignments = assignmentsForProject(projectId);
  let planned=0, actual=0;
  assignments.forEach(a => {
    const c = contactById(a.contactId); const rate = c ? Number(c.rateDay || 0) : 0; const crew = c ? Number(c.crewSize || 1) : 1;
    planned += Number(a.plannedDays || 0) * rate * crew;
    actual += Number(a.actualDays || 0) * rate * crew;
  });
  return {planned, actual, variance: actual - planned};
}
function projectFinancials(projectId){
  const project = projectById(projectId); if(!project) return {plannedLabor:0, actualLabor:0, variance:0, materialBudget:0, budgetHT:0, marginEstimate:0, paymentsDue:0, paymentsReceived:0, overdueCount:0};
  const labor = projectLaborMetrics(projectId);
  const payments = paymentsForProject(projectId);
  const paymentsDue = payments.reduce((s,p)=>s+Number(p.amount||0),0);
  const paymentsReceived = payments.reduce((s,p)=>s+Number(p.receivedAmount||0),0);
  const overdueCount = payments.filter(p => p.status === 'En retard').length;
  const marginEstimate = Number(project.budgetHT || 0) - labor.actual - Number(project.materialBudget || 0);
  return {plannedLabor:labor.planned, actualLabor:labor.actual, variance:labor.variance, materialBudget:Number(project.materialBudget||0), budgetHT:Number(project.budgetHT||0), marginEstimate, paymentsDue, paymentsReceived, overdueCount};
}
function contactStats(contactId){
  const reviews = reviewsForContact(contactId);
  return {
    quality: avg(reviews.map(r => r.quality)),
    reliability: avg(reviews.map(r => r.reliability)),
    speed: avg(reviews.map(r => r.speed)),
    discipline: avg(reviews.map(r => r.discipline)),
    projects: new Set(reviews.map(r => r.projectId)).size,
    rehireRate: reviews.length ? reviews.filter(r => r.rehire === true).length / reviews.length : 0,
    avgScore: avg(reviews.flatMap(r => [r.quality,r.reliability,r.speed,r.discipline]))
  };
}
function profileCompleteness(contact){
  const checks = [contact.name,contact.primarySpecialty,contact.city,contact.phone,contact.legalStatus,contact.availability,contact.rateDay||contact.ratePackage,contact.specialties?.length,contact.zones?.length,contact.languages?.length,contact.yearsExperience,contact.notes,...Object.values(contact.compliance||{})];
  return Math.round((checks.filter(Boolean).length/checks.length)*100);
}
function complianceScore(contact){ const vals=Object.values(contact.compliance||{}); return vals.length ? vals.filter(Boolean).length / vals.length : 0; }
function specialtyFit(contact, specialty){ if(!specialty) return 0.65; if(contact.primarySpecialty === specialty) return 1; if(contact.specialties.includes(specialty)) return 0.88; if((ADJACENT_SPECIALTIES[specialty]||[]).some(s => contact.specialties.includes(s))) return 0.62; const historic = assignmentsForContact(contact.id); if(historic.some(a => a.specialty === specialty)) return 0.8; return 0.18; }
function zoneFit(contact, city){ if(!city) return 0.65; if(contact.city === city) return 1; if((contact.zones||[]).includes(city)) return 0.9; return 0.35; }
function availabilityFit(contact, maxDays){ const d=Number(contact.availabilityDays ?? availabilityDaysFromText(contact.availability)); if(!maxDays) return clamp(1 - (d/45), .25, 1); return d<=maxDays ? clamp(1 - (d/Math.max(maxDays,1))*0.45, .55, 1) : .15; }
function trustFit(contact){ return {eleve:1,moyen:.67,faible:.3}[contact.trust] || .5; }
function costFit(contact, project){ if(!project || !contact.rateDay) return .5; const benchmark = (project.budgetHT || 0) * .0002; if(!benchmark) return .5; return clamp(1 - ((contact.rateDay - benchmark) / (benchmark * 4)), .25, 1); }
function getMatchCandidates(draft = state.matchDraft){
  const project = projectById(draft.projectId) || state.vault.projects[0];
  const requestedSpecialty = draft.specialty || project?.requiredSpecialties?.[0] || '';
  const city = draft.city || project?.location || '';
  const maxAvailability = draft.availability ? Number(draft.availability) : 0;
  const minScore = Number(draft.minScore || 0);
  const legalFilter = draft.legalStatus || '';
  return state.vault.contacts.filter(c => c.active).map(contact => {
    const stats = contactStats(contact.id); const spec=specialtyFit(contact, requestedSpecialty), perf=stats.avgScore?stats.avgScore/5:.45, zone=zoneFit(contact, city), avail=availabilityFit(contact, maxAvailability), trust=trustFit(contact), compliance=complianceScore(contact), rehire=stats.rehireRate||.4, cost=costFit(contact, project);
    const total = Math.round(spec*28 + perf*23 + zone*9 + avail*12 + trust*8 + compliance*8 + rehire*6 + cost*6);
    const reasons=[]; if(spec>=.88) reasons.push('Spécialité très alignée'); else if(spec>=.6) reasons.push('Spécialité adjacente utile'); if(perf>=.8) reasons.push('Historique terrain solide'); if(zone>=.9) reasons.push('Zone couverte'); if(avail>=.75) reasons.push('Disponibilité favorable'); if(compliance>=.8) reasons.push('Conformité complète'); if(cost>=.75) reasons.push('Coût cohérent'); if(trust>=.9) reasons.push('Confiance élevée');
    return {contact, stats, total, reasons, spec, perf, zone, avail, compliance, rehire, cost, project, requestedSpecialty};
  }).filter(x => !legalFilter || x.contact.legalStatus === legalFilter).filter(x => x.total >= minScore).sort((a,b) => b.total - a.total || b.stats.avgScore - a.stats.avgScore);
}
function pendingActions(){
  const actions=[];
  state.vault.projects.forEach(project => {
    const docs = state.vault.documents.filter(d => d.projectId === project.id);
    const assignments = assignmentsForProject(project.id);
    const finance = projectFinancials(project.id);
    const incidents = incidentsForProject(project.id).filter(i => i.status !== 'Résolu');
    if(['Contrat signé','Préparation','En cours'].includes(project.status) && !docs.some(d => d.type === 'contrat')) actions.push({severity:'warn', label:'Contrat manquant', detail:`${project.code} n’a pas encore de contrat snapshot.`});
    if(['Préparation','En cours'].includes(project.status) && project.requiredSpecialties.some(s => !assignments.some(a => a.specialty === s))) actions.push({severity:'warn', label:'Équipe manquante', detail:`${project.code} n’a pas tous les lots clés affectés.`});
    assignments.forEach(a => {
      const c = contactById(a.contactId);
      if(c && complianceScore(c) < 0.5) actions.push({severity:'danger', label:'Contact non conforme', detail:`${c.name} sur ${project.code} a une conformité incomplète.`});
      if(a.status === 'Terminé' && !state.vault.reviews.some(r => r.assignmentId === a.id)) actions.push({severity:'warn', label:'Review à compléter', detail:`${project.code} · ${a.specialty} n’a pas encore été évalué.`});
    });
    if(finance.overdueCount > 0) actions.push({severity:'danger', label:'Paiement en retard', detail:`${project.code} a ${finance.overdueCount} échéance(s) en retard.`});
    incidents.forEach(i => actions.push({severity:'danger', label:'Incident ouvert', detail:`${project.code} · ${i.title}`}));
  });
  return actions.slice(0, 20);
}

function updateCounts(){
  if(!state.vault) return;
  $('countProjectsSide').textContent = state.vault.projects.length;
  $('countProjectsSide2').textContent = state.vault.projects.length;
  $('countContactsSide').textContent = state.vault.contacts.length;
  $('countMatchingSide').textContent = state.vault.contacts.filter(c => c.active).length;
  $('countAssignmentsSide').textContent = state.vault.assignments.length;
  $('countDocumentsSide').textContent = state.vault.documents.length;
  $('countFieldSide').textContent = state.vault.incidents.filter(i => i.status !== 'Résolu').length;
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
function openApp(){
  $('unlockScreen').classList.add('hidden'); $('appShell').classList.remove('hidden');
  state.selectedProjectId = state.selectedProjectId || state.vault.projects[0]?.id || null;
  state.selectedContactId = state.selectedContactId || state.vault.contacts[0]?.id || null;
  state.selectedAssignmentId = state.selectedAssignmentId || state.vault.assignments[0]?.id || null;
  state.docDraft.projectId = state.docDraft.projectId || state.selectedProjectId || '';
  state.matchDraft.projectId = state.matchDraft.projectId || state.selectedProjectId || '';
  setView(state.currentView); resetIdleTimer(); showToast('Coffre ouvert.');
}
function render(){
  switch(state.currentView){
    case 'dashboard': return renderDashboard();
    case 'projects': return renderProjects();
    case 'network': return renderNetwork();
    case 'matching': return renderMatching();
    case 'assignments': return renderAssignments();
    case 'documents': return renderDocuments();
    case 'field': return renderField();
    case 'activity': return renderActivity();
    case 'settings': return renderSettings();
  }
}

function renderDashboard(){
  const actions = pendingActions();
  const totalMargin = state.vault.projects.reduce((sum,p) => sum + projectFinancials(p.id).marginEstimate, 0);
  const avgCompleteness = Math.round(avg(state.vault.contacts.map(profileCompleteness)));
  const openIncidents = state.vault.incidents.filter(i => i.status !== 'Résolu').length;
  $('content').innerHTML = `
    <div class="kpis">
      <div class="card kpi"><div class="value">${state.vault.projects.length}</div><div class="label">Projects</div><div class="line"></div></div>
      <div class="card kpi blue"><div class="value">${state.vault.contacts.length}</div><div class="label">Execution network</div><div class="line"></div></div>
      <div class="card kpi green"><div class="value">${avgCompleteness}</div><div class="label">Complétude profils</div><div class="line"></div></div>
      <div class="card kpi orange"><div class="value">${openIncidents}</div><div class="label">Incidents ouverts</div><div class="line"></div></div>
    </div>
    <div class="grid-main">
      <div class="detail-stack">
        <div class="card pane">
          <div class="section-title"><div class="label">Prochaines actions</div></div>
          <div class="activity-list">${actions.map(a => `<div class="activity-item"><div class="activity-meta">${esc(a.label)}</div><div>${esc(a.detail)}</div></div>`).join('') || `<div class="empty-state">Aucune alerte critique.</div>`}</div>
        </div>
        <div class="card pane">
          <div class="section-title"><div class="label">Pilotage économique</div></div>
          <div class="summary-bar">
            <div><div class="micro">Marge brute estimée</div><div class="big">${money(totalMargin)}</div></div>
            <div><div class="micro">Snapshots docs</div><div class="big">${state.vault.documents.length}</div></div>
            <div><div class="micro">Dernière sauvegarde</div><div class="big" style="font-size:22px">${shortDate(state.vault.meta.updatedAt)}</div></div>
          </div>
          <div style="height:12px"></div>
          <div class="table-wrap responsive-table"><table><thead><tr><th>Projet</th><th>Budget HT</th><th>Coût réel MO</th><th>Marge estimée</th></tr></thead><tbody>${state.vault.projects.map(p => { const f=projectFinancials(p.id); return `<tr data-open-project="${p.id}"><td>${esc(p.code)}</td><td>${money(p.budgetHT)}</td><td>${money(f.actualLabor)}</td><td>${money(f.marginEstimate)}</td></tr>`; }).join('')}</tbody></table></div>
        </div>
      </div>
      <div class="detail-stack">
        <div class="card pane">
          <div class="section-title"><div class="label">Top matches instantanés</div></div>
          ${getMatchCandidates({projectId: state.vault.projects[0]?.id || '', specialty: state.vault.projects[0]?.requiredSpecialties?.[0] || SPECIALTIES[0], city: state.vault.projects[0]?.location || '', availability:'', legalStatus:'', minScore:0}).slice(0,3).map(m => `<div class="match-card" data-open-contact="${m.contact.id}"><div class="match-top"><div><div class="entity-title">${esc(m.contact.name)}</div><div class="entity-meta">${esc(m.contact.primarySpecialty)} · ${esc(m.contact.city || '—')}</div></div><div class="match-score">${m.total}</div></div><div class="fitbar"><span style="width:${m.total}%"></span></div><div class="tag-row">${m.reasons.slice(0,3).map(r => `<span class="tag">${esc(r)}</span>`).join('')}</div></div>`).join('') || `<div class="empty-state">Aucun candidat.</div>`}
        </div>
        <div class="card pane">
          <div class="section-title"><div class="label">Activity feed</div></div>
          <div class="activity-list">${state.vault.activity.slice(0,8).map(a => `<div class="activity-item"><div class="activity-meta">${shortDate(a.at)} · ${esc(a.type)}</div><div>${esc(a.detail)}</div></div>`).join('')}</div>
        </div>
      </div>
    </div>
  `;
  document.querySelectorAll('[data-open-project]').forEach(el => el.onclick = () => { state.selectedProjectId = el.dataset.openProject; setView('projects'); });
  document.querySelectorAll('[data-open-contact]').forEach(el => el.onclick = () => { state.selectedContactId = el.dataset.openContact; setView('network'); });
}

function renderProjects(){
  const selected = projectById(state.selectedProjectId) || state.vault.projects[0];
  if(selected) state.selectedProjectId = selected.id;
  const list = [...state.vault.projects].sort((a,b)=> (b.startDate||'').localeCompare(a.startDate||''));
  $('content').innerHTML = `
    <div class="topline" style="margin-bottom:12px"><div class="helper">Le cockpit projet relie pipeline, coûts, paiements, incidents, staffing et documents.</div><div class="inline-actions"><button class="btn btn-primary small" id="btnAddProject">Nouveau projet</button>${selected ? `<button class="btn btn-secondary small" id="btnEditProject">Modifier</button>` : ''}</div></div>
    <div class="grid-main">
      <div class="card pane">
        <div class="filter-row"><input id="projectSearch" placeholder="Recherche projet / code / client" value="${esc(state.filters.search)}"><select id="projectStatusFilter"><option value="">Tous statuts</option>${PROJECT_STATUSES.map(s => `<option value="${s}" ${state.filters.projectStatus===s?'selected':''}>${s}</option>`).join('')}</select></div>
        <div class="list-pane">${list.filter(p => { const q=state.filters.search.toLowerCase(); const okSearch=!q||[p.name,p.code,p.clientName,p.location,p.scopeSummary].join(' ').toLowerCase().includes(q); const okStatus=!state.filters.projectStatus||p.status===state.filters.projectStatus; return okSearch&&okStatus; }).map(p => `<div class="entity-card ${selected && p.id===selected.id ? 'active':''}" data-project="${p.id}"><div class="entity-head"><div><div class="entity-title">${esc(p.name)}</div><div class="entity-meta">${esc(p.code)} · ${esc(p.clientName)} · ${esc(p.location || '—')}</div></div>${formatStatusBadge(p.status)}</div></div>`).join('') || `<div class="empty-state">Aucun projet.</div>`}</div>
      </div>
      <div class="detail-stack">${selected ? renderProjectDetail(selected) : `<div class="card pane"><div class="empty-state">Aucun projet.</div></div>`}</div>
    </div>`;
  $('projectSearch').oninput = e => { state.filters.search = e.target.value; renderProjects(); };
  $('projectStatusFilter').onchange = e => { state.filters.projectStatus = e.target.value; renderProjects(); };
  document.querySelectorAll('[data-project]').forEach(el => el.onclick = () => { state.selectedProjectId = el.dataset.project; renderProjects(); });
  if($('btnAddProject')) $('btnAddProject').onclick = () => openProjectModal();
  if($('btnEditProject')) $('btnEditProject').onclick = () => openProjectModal(selected);
  document.querySelectorAll('[data-open-docs]').forEach(el => el.onclick = () => { state.docDraft.projectId = el.dataset.openDocs; setView('documents'); });
  document.querySelectorAll('[data-open-matching]').forEach(el => el.onclick = () => { state.matchDraft.projectId = el.dataset.openMatching; setView('matching'); });
  document.querySelectorAll('[data-open-field]').forEach(el => el.onclick = () => { state.selectedProjectId = el.dataset.openField; setView('field'); });
}
function renderProjectDetail(project){
  const finance = projectFinancials(project.id);
  const payments = paymentsForProject(project.id);
  const incidents = incidentsForProject(project.id);
  const assignments = assignmentsForProject(project.id);
  const openDocs = state.vault.documents.filter(d => d.projectId === project.id);
  return `
    <div class="card pane">
      <div class="preview-header"><div><div class="section-title"><div class="label">Project cockpit</div></div><div class="entity-title">${esc(project.name)}</div><div class="entity-meta">${esc(project.code)} · ${esc(project.clientName)} · ${esc(project.clientType)} · ${esc(project.projectType)} ${esc(project.standing)}</div></div><div class="inline-actions"><button class="btn btn-secondary small" data-open-matching="${project.id}">Matching</button><button class="btn btn-secondary small" data-open-field="${project.id}">Field</button><button class="btn btn-primary small" data-open-docs="${project.id}">Documents</button></div></div>
      <div class="stack-4"><div class="muted-box"><div class="label">Statut</div><div class="value">${esc(project.status)}</div></div><div class="muted-box"><div class="label">Budget HT</div><div class="value">${money(project.budgetHT)}</div></div><div class="muted-box"><div class="label">Progression</div><div class="value">${pct(project.progressPercent)}</div></div><div class="muted-box"><div class="label">Spécialités requises</div><div class="value">${project.requiredSpecialties.map(esc).join(' · ') || '—'}</div></div></div>
      <div style="height:12px"></div>
      <div class="stack-4"><div class="muted-box"><div class="label">Coût MO planifié</div><div class="value">${money(finance.plannedLabor)}</div></div><div class="muted-box"><div class="label">Coût MO réel</div><div class="value">${money(finance.actualLabor)}</div></div><div class="muted-box"><div class="label">Variance</div><div class="value">${money(finance.variance)}</div></div><div class="muted-box"><div class="label">Marge brute estimée</div><div class="value">${money(finance.marginEstimate)}</div></div></div>
      <div style="height:12px"></div>
      <div class="info-grid"><div class="muted-box"><div class="label">Paiements</div><div class="value">Attendu ${money(finance.paymentsDue)}<br>Reçu ${money(finance.paymentsReceived)}<br>Échéances en retard ${finance.overdueCount}</div></div><div class="muted-box"><div class="label">Incidents</div><div class="value">${incidents.length} total · ${incidents.filter(i => i.status !== 'Résolu').length} ouverts</div></div><div class="muted-box"><div class="label">Documents</div><div class="value">${openDocs.length} snapshot(s)</div></div><div class="muted-box"><div class="label">Équipe</div><div class="value">${assignments.length} affectation(s)</div></div></div>
      <div style="height:12px"></div>
      <div class="muted-box"><div class="label">Scope</div><div class="value">${esc(project.scopeSummary || '—')}</div></div>
      <div style="height:12px"></div>
      <div class="table-wrap responsive-table"><table><thead><tr><th>Lot</th><th>PU HT</th><th>Qté</th><th>Total HT</th></tr></thead><tbody>${project.pricingLines.map(l => `<tr><td>${esc(l.designation)}</td><td>${money(l.pu)}</td><td>${l.qte}</td><td>${money(l.qte*l.pu)}</td></tr>`).join('') || `<tr><td colspan="4">Aucune ligne de chiffrage.</td></tr>`}</tbody></table></div>
    </div>
    <div class="grid-main"><div class="card pane"><div class="section-title"><div class="label">Paiements</div></div><div class="table-wrap responsive-table"><table><thead><tr><th>Type</th><th>Échéance</th><th>Montant</th><th>Reçu</th><th>Statut</th></tr></thead><tbody>${payments.map(p => `<tr><td>${esc(p.kind)}</td><td>${shortDate(p.dueDate)}</td><td>${money(p.amount)}</td><td>${money(p.receivedAmount)}</td><td>${formatStatusBadge(p.status)}</td></tr>`).join('') || `<tr><td colspan="5">Aucun paiement.</td></tr>`}</tbody></table></div></div><div class="card pane"><div class="section-title"><div class="label">Incidents</div></div><div class="activity-list">${incidents.map(i => `<div class="activity-item"><div class="activity-meta">${shortDate(i.date)} · ${esc(i.category)} · ${esc(i.severity)}</div><div><strong>${esc(i.title)}</strong><br>${esc(i.description)}</div></div>`).join('') || `<div class="empty-state">Aucun incident.</div>`}</div></div></div>
  `;
}

function renderNetwork(){
  const selected = contactById(state.selectedContactId) || state.vault.contacts[0];
  if(selected) state.selectedContactId = selected.id;
  const contacts = [...state.vault.contacts].sort((a,b)=>a.name.localeCompare(b.name));
  const filtered = contacts.filter(c => {
    const q=(state.filters.search||'').toLowerCase();
    const okSpec=!state.filters.specialty||c.specialties.includes(state.filters.specialty);
    const okCity=!state.filters.city||c.city===state.filters.city||c.zones.includes(state.filters.city);
    const okTrust=!state.filters.trust||c.trust===state.filters.trust;
    const okSearch=!q||[c.name,c.tradeName,c.primarySpecialty,c.city,c.notes,c.tags.join(' ')].join(' ').toLowerCase().includes(q);
    return okSpec&&okCity&&okTrust&&okSearch;
  });
  $('content').innerHTML = `
    <div class="topline" style="margin-bottom:12px"><div class="helper">La fiche réseau mémorise maintenant capacité, coût, conformité, zones, historique, statut et réembauche.</div><div class="inline-actions"><button class="btn btn-primary small" id="btnAddContact">Nouveau contact</button>${selected ? `<button class="btn btn-secondary small" id="btnEditContact">Modifier</button>` : ''}</div></div>
    <div class="grid-main"><div class="card pane"><div class="filter-row"><input id="networkSearch" placeholder="Nom / spécialité / tags / notes" value="${esc(state.filters.search)}"><select id="networkSpecialty"><option value="">Toutes spécialités</option>${SPECIALTIES.map(s => `<option value="${s}" ${state.filters.specialty===s?'selected':''}>${s}</option>`).join('')}</select><select id="networkCity"><option value="">Toutes villes</option>${unique(state.vault.contacts.flatMap(c => [c.city, ...c.zones])).filter(Boolean).map(s => `<option value="${s}" ${state.filters.city===s?'selected':''}>${s}</option>`).join('')}</select><select id="networkTrust"><option value="">Tous niveaux</option>${['eleve','moyen','faible'].map(s => `<option value="${s}" ${state.filters.trust===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="list-pane">${filtered.map(c => { const stats=contactStats(c.id); return `<div class="entity-card ${selected&&c.id===selected.id?'active':''}" data-contact="${c.id}"><div class="entity-head"><div><div class="entity-title">${esc(c.name)}</div><div class="entity-meta">${esc(c.primarySpecialty)} · ${esc(c.city || '—')} · statut ${esc(c.status)} · complétude ${profileCompleteness(c)}%</div></div>${trustBadge(c.trust)}</div><div class="fitbar" style="margin-top:10px"><span style="width:${Math.round((stats.avgScore/5)*100)}%"></span></div></div>`; }).join('') || `<div class="empty-state">Aucun contact.</div>`}</div></div><div class="detail-stack">${selected ? renderContactDetail(selected) : `<div class="card pane"><div class="empty-state">Aucun contact.</div></div>`}</div></div>`;
  $('networkSearch').oninput = e => { state.filters.search=e.target.value; renderNetwork(); };
  $('networkSpecialty').onchange = e => { state.filters.specialty=e.target.value; renderNetwork(); };
  $('networkCity').onchange = e => { state.filters.city=e.target.value; renderNetwork(); };
  $('networkTrust').onchange = e => { state.filters.trust=e.target.value; renderNetwork(); };
  document.querySelectorAll('[data-contact]').forEach(el => el.onclick = () => { state.selectedContactId=el.dataset.contact; renderNetwork(); });
  if($('btnAddContact')) $('btnAddContact').onclick = () => openContactModal();
  if($('btnEditContact')) $('btnEditContact').onclick = () => openContactModal(selected);
  document.querySelectorAll('[data-contact-match]').forEach(el => el.onclick = () => { state.selectedContactId = el.dataset.contactMatch; state.matchDraft.specialty = contactById(el.dataset.contactMatch)?.primarySpecialty || ''; setView('matching'); });
  document.querySelectorAll('[data-contact-assign]').forEach(el => el.onclick = () => openAssignmentModal(null, {contactId: el.dataset.contactAssign}));
}
function renderContactDetail(contact){
  const stats = contactStats(contact.id); const history = assignmentsForContact(contact.id).sort((a,b)=>(b.from||'').localeCompare(a.from||''));
  return `<div class="card pane"><div class="preview-header"><div><div class="section-title"><div class="label">Fiche partenaire</div></div><div class="entity-title">${esc(contact.name)}</div><div class="entity-meta">${esc(contact.tradeName || contact.kind)} · ${esc(contact.primarySpecialty)} · ${esc(contact.status)}</div></div><div class="inline-actions"><button class="btn btn-secondary small" data-contact-match="${contact.id}">Matching</button><button class="btn btn-primary small" data-contact-assign="${contact.id}">Affecter</button></div></div><div class="stack-4"><div class="muted-box"><div class="label">Confiance</div><div class="value">${esc(contact.trust)}</div></div><div class="muted-box"><div class="label">Complétude</div><div class="value">${profileCompleteness(contact)}%</div></div><div class="muted-box"><div class="label">Expérience</div><div class="value">${contact.yearsExperience} ans</div></div><div class="muted-box"><div class="label">Équipe</div><div class="value">${contact.crewSize} pers.</div></div></div><div style="height:12px"></div><div class="stack-3"><div class="muted-box"><div class="label">Identité</div><div class="value">${esc(contact.kind)}<br>${esc(contact.legalStatus)}<br>${esc(contact.phone || '—')}</div></div><div class="muted-box"><div class="label">Couverture</div><div class="value">${contact.zones.map(esc).join(' · ') || '—'}<br>${esc(contact.availability)}<br>véhicule ${yesNo(contact.hasVehicle)}</div></div><div class="muted-box"><div class="label">Commercial</div><div class="value">${money(contact.rateDay)}/jour<br>${contact.ratePackage ? money(contact.ratePackage)+'/forfait' : '—'}<br>${esc(contact.paymentMode)}</div></div></div><div style="height:12px"></div><div class="stack-4"><div class="metric"><div class="n">${stats.quality ? stats.quality.toFixed(1) : '—'}</div><div class="t">Qualité</div></div><div class="metric"><div class="n">${stats.reliability ? stats.reliability.toFixed(1) : '—'}</div><div class="t">Fiabilité</div></div><div class="metric"><div class="n">${stats.speed ? stats.speed.toFixed(1) : '—'}</div><div class="t">Vitesse</div></div><div class="metric"><div class="n">${stats.discipline ? stats.discipline.toFixed(1) : '—'}</div><div class="t">Discipline</div></div></div><div style="height:12px"></div><div class="compliance-grid"><div class="compliance-tile"><strong>Conformité</strong>${renderBoolLine('CIN / ID', contact.compliance.idReceived)}${renderBoolLine('Contrat', contact.compliance.contractSigned)}${renderBoolLine('NDA', contact.compliance.ndaSigned)}</div><div class="compliance-tile"><strong>Financier</strong>${renderBoolLine('RIB / banque', contact.compliance.bankInfo)}${renderBoolLine('Statut fiscal', contact.compliance.taxStatus)}${renderBoolLine('Safety briefing', contact.compliance.safetyBriefing)}</div><div class="compliance-tile"><strong>Capacités</strong>${renderBoolLine('Lead team', contact.canLeadTeam)}${renderBoolLine('Own tools', contact.ownTools)}${renderBoolLine('Vehicle', contact.hasVehicle)}</div></div><div style="height:12px"></div><div class="muted-box"><div class="label">Spécialités / langues / tags</div><div class="value">${contact.specialties.map(esc).join(' · ') || '—'}<br>${contact.languages.map(esc).join(' · ') || '—'}<br>${contact.tags.map(esc).join(' · ') || '—'}</div></div><div style="height:12px"></div><div class="muted-box"><div class="label">Notes internes</div><div class="value">${esc(contact.notes || '—')}</div></div><div style="height:12px"></div><div class="section-title"><div class="label">Historique projets</div></div><div class="table-wrap responsive-table"><table><thead><tr><th>Projet</th><th>Spécialité</th><th>Phase</th><th>Statut</th><th>Coût réel</th></tr></thead><tbody>${history.map(a => { const p=projectById(a.projectId); const cost = assignmentActualCost(a); return `<tr data-assignment="${a.id}"><td>${esc(p?p.code:'—')}</td><td>${esc(a.specialty)}</td><td>${esc(a.phase || '—')}</td><td>${formatStatusBadge(a.status)}</td><td>${money(cost)}</td></tr>`; }).join('') || `<tr><td colspan="5">Aucune affectation.</td></tr>`}</tbody></table></div></div>`;
}
function renderBoolLine(label, value){ return `<div class="kv"><div class="k">${esc(label)}</div><div class="v">${value ? 'Oui' : 'Non'}</div></div>`; }

function renderMatching(){
  const project = projectById(state.matchDraft.projectId) || projectById(state.selectedProjectId) || state.vault.projects[0];
  if(project) state.matchDraft.projectId = project.id;
  if(!state.matchDraft.specialty && project?.requiredSpecialties?.length) state.matchDraft.specialty = project.requiredSpecialties[0];
  if(!state.matchDraft.city && project?.location) state.matchDraft.city = project.location;
  const matches = getMatchCandidates(); const lead = matches[0] || null;
  $('content').innerHTML = `<div class="match-grid"><div class="card pane"><div class="section-title"><div class="label">Matching studio</div></div><div class="doc-controls"><div class="form-row"><label>Projet</label><select id="matchProject">${state.vault.projects.map(p => `<option value="${p.id}" ${state.matchDraft.projectId===p.id?'selected':''}>${esc(p.code)} · ${esc(p.name)}</option>`).join('')}</select></div><div class="form-row"><label>Spécialité</label><select id="matchSpecialty"><option value="">Auto</option>${SPECIALTIES.map(s => `<option value="${s}" ${state.matchDraft.specialty===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="form-row"><label>Ville / zone</label><input id="matchCity" value="${esc(state.matchDraft.city || '')}"></div><div class="form-row"><label>Disponibilité max</label><select id="matchAvailability"><option value="" ${!state.matchDraft.availability?'selected':''}>Sans filtre</option>${[0,7,15,30].map(v => `<option value="${v}" ${String(state.matchDraft.availability)===String(v)?'selected':''}>${v === 0 ? 'Immédiate' : v + ' jours'}</option>`).join('')}</select></div><div class="form-row"><label>Statut légal</label><select id="matchLegal"><option value="">Tous</option>${['informel','auto-entrepreneur','societe'].map(v => `<option value="${v}" ${state.matchDraft.legalStatus===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="form-row"><label>Score minimum</label><input id="matchMinScore" type="range" min="0" max="95" step="5" value="${esc(state.matchDraft.minScore)}"><div class="form-hint">Seuil actuel : <strong id="matchMinScoreValue">${state.matchDraft.minScore}</strong>/100</div></div></div><div style="height:10px"></div><div class="match-list">${matches.map(m => `<div class="match-card"><div class="match-top"><div><div class="entity-title">${esc(m.contact.name)}</div><div class="entity-meta">${esc(m.contact.primarySpecialty)} · ${esc(m.contact.city || '—')} · ${esc(m.contact.status)}</div></div><div class="match-score">${m.total}</div></div><div class="fitbar"><span style="width:${m.total}%"></span></div><div class="tag-row">${m.reasons.slice(0,4).map(r => `<span class="tag">${esc(r)}</span>`).join('')}</div><div class="stack-4"><div class="muted-box"><div class="label">Qualité</div><div class="value">${m.stats.quality ? m.stats.quality.toFixed(1) : '—'}</div></div><div class="muted-box"><div class="label">Dispo</div><div class="value">${esc(m.contact.availability)}</div></div><div class="muted-box"><div class="label">Coût</div><div class="value">${money(m.contact.rateDay)}/j</div></div><div class="muted-box"><div class="label">Conformité</div><div class="value">${Math.round(m.compliance*100)}%</div></div></div><div class="inline-actions"><button class="btn btn-secondary small" data-open-contact="${m.contact.id}">Fiche</button><button class="btn btn-primary small" data-assign-contact="${m.contact.id}">Affecter</button></div></div>`).join('') || `<div class="empty-state">Aucun candidat au-dessus du seuil.</div>`}</div></div><div class="detail-stack"><div class="card pane"><div class="section-title"><div class="label">Lecture du top match</div></div>${lead ? `<div class="client-card"><h3>${esc(lead.contact.name)} — ${lead.total}/100</h3><div class="kv"><div class="k">Spécialité</div><div class="v">${Math.round(lead.spec*100)}%</div></div><div class="kv"><div class="k">Terrain</div><div class="v">${Math.round(lead.perf*100)}%</div></div><div class="kv"><div class="k">Zone</div><div class="v">${Math.round(lead.zone*100)}%</div></div><div class="kv"><div class="k">Disponibilité</div><div class="v">${Math.round(lead.avail*100)}%</div></div><div class="kv"><div class="k">Coût</div><div class="v">${Math.round(lead.cost*100)}%</div></div></div><div style="height:12px"></div><div class="muted-box"><div class="label">Pourquoi il sort en tête</div><div class="value">${lead.reasons.map(esc).join(' · ') || 'Fit global supérieur.'}</div></div><div style="height:12px"></div><div class="inline-actions"><button class="btn btn-secondary" data-open-contact="${lead.contact.id}">Ouvrir la fiche</button><button class="btn btn-primary" data-assign-contact="${lead.contact.id}">Créer affectation</button></div>` : `<div class="empty-state">Aucun top match.</div>`}</div><div class="card pane"><div class="section-title"><div class="label">Lots requis du projet</div></div><div class="tag-row">${project ? project.requiredSpecialties.map(s => `<span class="tag">${esc(s)}</span>`).join('') : '—'}</div></div></div></div>`;
  $('matchProject').onchange = e => { state.matchDraft.projectId = e.target.value; const p=projectById(e.target.value); state.matchDraft.city=p?.location||''; state.matchDraft.specialty=p?.requiredSpecialties?.[0]||''; renderMatching(); };
  $('matchSpecialty').onchange = e => { state.matchDraft.specialty = e.target.value; renderMatching(); };
  $('matchCity').oninput = e => { state.matchDraft.city = e.target.value; renderMatching(); };
  $('matchAvailability').onchange = e => { state.matchDraft.availability = e.target.value; renderMatching(); };
  $('matchLegal').onchange = e => { state.matchDraft.legalStatus = e.target.value; renderMatching(); };
  $('matchMinScore').oninput = e => { state.matchDraft.minScore = Number(e.target.value); $('matchMinScoreValue').textContent = e.target.value; renderMatching(); };
  document.querySelectorAll('[data-open-contact]').forEach(el => el.onclick = () => { state.selectedContactId = el.dataset.openContact; setView('network'); });
  document.querySelectorAll('[data-assign-contact]').forEach(el => el.onclick = () => openAssignmentModal(null, {contactId: el.dataset.assignContact, projectId: state.matchDraft.projectId, specialty: state.matchDraft.specialty}));
}

function assignmentPlannedCost(a){ const c=contactById(a.contactId); return Number(a.plannedDays||0) * Number(c?.rateDay||0) * Number(c?.crewSize||1); }
function assignmentActualCost(a){ const c=contactById(a.contactId); return Number(a.actualDays||0) * Number(c?.rateDay||0) * Number(c?.crewSize||1); }
function renderAssignments(){
  const selected = assignmentById(state.selectedAssignmentId) || state.vault.assignments[0]; if(selected) state.selectedAssignmentId = selected.id;
  $('content').innerHTML = `<div class="topline" style="margin-bottom:12px"><div class="helper">Les affectations stockent maintenant coûts planifiés/réels, reviews et réembauche.</div><div class="inline-actions"><button class="btn btn-primary small" id="btnAddAssignment">Nouvelle affectation</button>${selected ? `<button class="btn btn-secondary small" id="btnEditAssignment">Modifier</button>` : ''}</div></div><div class="grid-main"><div class="card pane"><div class="table-wrap responsive-table"><table><thead><tr><th>Projet</th><th>Contact</th><th>Spécialité</th><th>Statut</th><th>Coût réel</th></tr></thead><tbody>${state.vault.assignments.map(a => { const p=projectById(a.projectId), c=contactById(a.contactId); return `<tr data-assignment="${a.id}"><td>${esc(p ? p.code : '—')}</td><td>${esc(c ? c.name : '—')}</td><td>${esc(a.specialty)}</td><td>${formatStatusBadge(a.status)}</td><td>${money(assignmentActualCost(a))}</td></tr>`; }).join('') || `<tr><td colspan="5">Aucune affectation.</td></tr>`}</tbody></table></div></div><div class="card pane">${selected ? renderAssignmentDetail(selected) : `<div class="empty-state">Aucune affectation.</div>`}</div></div>`;
  document.querySelectorAll('[data-assignment]').forEach(el => el.onclick = () => { state.selectedAssignmentId = el.dataset.assignment; renderAssignments(); });
  if($('btnAddAssignment')) $('btnAddAssignment').onclick = () => openAssignmentModal();
  if($('btnEditAssignment')) $('btnEditAssignment').onclick = () => openAssignmentModal(selected);
  document.querySelectorAll('[data-open-review]').forEach(el => el.onclick = () => openReviewModal(assignmentById(el.dataset.openReview)));
}
function renderAssignmentDetail(a){ const p=projectById(a.projectId), c=contactById(a.contactId); const revs=reviewsForAssignment(a.id); const r= revs[revs.length-1]; const score = r ? avg([r.quality,r.reliability,r.speed,r.discipline]) : 0; return `<div class="section-title"><div class="label">Assignment record</div></div><div class="info-grid"><div class="muted-box"><div class="label">Projet</div><div class="value">${esc(p ? p.name : '—')}<br>${esc(p ? p.code : '—')}</div></div><div class="muted-box"><div class="label">Contact</div><div class="value">${esc(c ? c.name : '—')}<br>${esc(c ? c.primarySpecialty : '—')}</div></div><div class="muted-box"><div class="label">Rôle</div><div class="value">${esc(a.role || '—')}</div></div><div class="muted-box"><div class="label">Période</div><div class="value">${shortDate(a.from)} → ${shortDate(a.to)}</div></div></div><div style="height:12px"></div><div class="stack-4"><div class="muted-box"><div class="label">Jours prévus</div><div class="value">${a.plannedDays}</div></div><div class="muted-box"><div class="label">Jours réels</div><div class="value">${a.actualDays}</div></div><div class="muted-box"><div class="label">Coût prévu</div><div class="value">${money(assignmentPlannedCost(a))}</div></div><div class="muted-box"><div class="label">Coût réel</div><div class="value">${money(assignmentActualCost(a))}</div></div></div><div style="height:12px"></div><div class="muted-box"><div class="label">Review</div><div class="value">${r ? `${score.toFixed(1)}/5 · réembauche ${r.rehire === null ? 'à décider' : r.rehire ? 'oui' : 'non'}` : 'Aucune review'}</div></div><div style="height:12px"></div><div class="inline-actions"><button class="btn btn-primary" data-open-review="${a.id}">${r ? 'Ajouter review' : 'Créer review'}</button></div><div style="height:12px"></div><div class="muted-box"><div class="label">Notes</div><div class="value">${esc(a.notes || '—')}</div></div>`; }

async function loadDocResources(){
  const templateFiles = {
    'devis-particulier':'./templates/devis-particulier.html',
    'devis-societe':'./templates/devis-societe.html',
    'contrat-particulier':'./templates/contrat-particulier.html',
    'contrat-societe':'./templates/contrat-societe.html',
    'avenant':'./templates/avenant.html',
    'situation':'./templates/situation-travaux.html',
    'pv':'./templates/pv-reception.html',
    'audit':'./templates/audit-chantier.html'
  };
  const entries = await Promise.all(Object.entries(templateFiles).map(async ([key, url]) => [key, await fetch(url).then(r => r.text())]));
  state.templates = Object.fromEntries(entries);
  state.docCss = await fetch('./styles/zafbat-docs.css').then(r => r.text());
}
function projectLines(project){
  return (project.pricingLines || []).map(line => ({designation: line.designation, unite: line.unite || 'forfait', qte: Number(line.qte || 1), pu: Number(line.pu || 0), total: Number(line.qte || 1) * Number(line.pu || 0)}));
}
function projectToRawData(project, type){
  const isSociete = project.clientType === 'societe';
  const lines = projectLines(project);
  const totalHT = lines.reduce((s,l) => s + l.total, 0) || Number(project.budgetHT || 0);
  const tva = Number(project.budgetTTC || 0) && Number(project.budgetHT || 0) ? Number(project.budgetTTC) - Number(project.budgetHT) : Math.round(totalHT * 0.2);
  const totalTTC = totalHT + tva;
  const progress = Number(project.progressPercent || 0) / 100;
  const prev = Math.max(0, progress - 0.15);
  const signSoc = state.vault.company.signatory || 'Signataire';
  const raw = {
    societe: {nom: state.vault.company.name, forme: state.vault.company.legalForm, ice: state.vault.company.ice || '', if: state.vault.company.if || '', rc: state.vault.company.rc || '', adresse: state.vault.company.address || '', telephone: state.vault.company.phone || '', email: state.vault.company.email || ''},
    client: {type: isSociete ? 'societe' : 'particulier', type_label: isSociete ? 'Société' : 'Particulier', nom_affichage: project.clientName, representant: project.clientName, adresse: project.clientAddress || '', telephone: project.clientPhone || '', email: project.clientEmail || ''},
    projet: {nom: project.name, code: project.code, adresse: project.location || '', description: project.scopeSummary || '', architecte: project.architect || '', bet: project.bet || ''},
    projet: {nom: project.name, code: project.code, adresse: project.location || '', description: project.scopeSummary || ''},
    project: {name: project.name},
    devis: {reference: `${project.code}-DEV`},
    contrat: {reference: `${project.code}-CTR`},
    document: {reference: `${project.code}-${String(type).toUpperCase()}`, date: nowIso().slice(0,10).split('-').reverse().join('/'), version: 'V1'},
    document_base: {date: nowIso().slice(0,10).split('-').reverse().join('/')},
    commercial: {validite_jours: '15', delai_execution: `${project.delayDays} jours`, debut_condition: 'Acompte encaissé, validations obtenues, accès chantier effectif et zones libérées.', acompte: `${project.depositPercent}%`, jalons: [{label:'Acompte à la commande', amount:`${project.depositPercent}% du TTC`},{label:'Situation intermédiaire', amount:'Selon avancement'},{label:'Solde à la réception', amount:`${100 - project.depositPercent}% du TTC`}]},
    chiffrage: {montant_ht: `${totalHT.toLocaleString('fr-FR')} MAD`, tva: `${tva.toLocaleString('fr-FR')} MAD`, montant_ttc: `${totalTTC.toLocaleString('fr-FR')} MAD`, lignes: lines.map(l => ({designation:l.designation, unite:l.unite, qte:String(l.qte), pu:String(l.pu), total:String(l.total)}))},
    contractuel: {inclusions: project.inclusions, exclusions: project.exclusions, hypotheses: project.assumptions},
    signataires: {societe: {nom: signSoc, fonction:'Gérant'}, client: {nom: project.clientName, fonction: isSociete ? 'Donneur d’ordre' : 'Client'}},
    avenant: {description: 'Adaptation de périmètre à valider par écrit entre les parties.', prix_ht: `${Math.round(totalHT * 0.1).toLocaleString('fr-FR')} MAD`, tva: `${Math.round(Math.round(totalHT * 0.1) * 0.2).toLocaleString('fr-FR')} MAD`, prix_ttc: `${Math.round(Math.round(totalHT * 0.12)).toLocaleString('fr-FR')} MAD`, impact_delai: '+ 10 jours calendaires'},
    situation: {periode: 'Période en cours', total_cumule_ht: `${Math.round(totalHT * progress).toLocaleString('fr-FR')} MAD`, tva: `${Math.round(tva * progress).toLocaleString('fr-FR')} MAD`, deja_facture: `${Math.round(totalTTC * prev).toLocaleString('fr-FR')} MAD`, a_facturer: `${Math.round(totalTTC * (progress-prev)).toLocaleString('fr-FR')} MAD`, lignes: lines.map(l => ({poste:l.designation, marche:String(l.total), prec:String(Math.round(l.total * prev)), periode:String(Math.round(l.total * (progress-prev))), cumul:String(Math.round(l.total * progress))}))},
    pv: {statut: 'Réception avec réserves', solde: `${Math.round(totalTTC * 0.1).toLocaleString('fr-FR')} MAD`, case_sans_reserve:'☐', case_avec_reserve:'☑', case_report:'☐', reserves:[{n:'1', reserve:'Retouche de finition ponctuelle', localisation:'Zone à préciser', action:'Reprise locale', delai:'7 jours'}]},
    audit: {etat_general:'Conforme avec actions ciblées', participants_resume:'ZAF BAT / Client / Architecte', conclusion:'Conforme avec réserves', synthesis_paragraphs:[project.scopeSummary || 'Le chantier suit le cadre prévu, sous réserve des actions correctives listées.', 'Le présent audit repose sur les éléments visibles à date.'], lignes: assignmentsForProject(project.id).map(a => ({zone:a.phase || 'Lot', point:a.specialty, constat:a.notes || 'Contrôle à confirmer', statut: reviewsForAssignment(a.id).length ? 'Conforme' : 'À corriger', action: reviewsForAssignment(a.id).length ? 'Suivi normal' : 'Compléter la revue', responsable: contactById(a.contactId)?.name || 'ZAF BAT', echeance: nowIso().slice(0,10)}))},
    client_type: isSociete ? 'societe' : 'particulier'
  };
  return raw;
}
async function buildDocumentSnapshot(project, type){
  const raw = projectToRawData(project, type);
  const materialized = materializeData(raw);
  const key = type === 'devis' ? (project.clientType === 'societe' ? 'devis-societe' : 'devis-particulier') : type === 'contrat' ? (project.clientType === 'societe' ? 'contrat-societe' : 'contrat-particulier') : type;
  let template = state.templates[key];
  if (!template) throw new Error('Template manquant ' + key);
  template = template.replace(/<link rel="stylesheet"[^>]+>/, `<style>${state.docCss}</style>`);
  const html = renderTemplate(template, materialized);
  const fingerprint = await sha256(html + JSON.stringify(raw));
  return {html, fingerprint, label: `${DOC_TYPE_LABELS[type]} · ${project.code}`};
}
function renderDocuments(){
  const selectedProject = projectById(state.docDraft.projectId) || projectById(state.selectedProjectId) || state.vault.projects[0];
  if(selectedProject) state.docDraft.projectId = selectedProject.id;
  const selectedDoc = documentById(state.selectedDocumentId) || null;
  $('content').innerHTML = `<div class="docs-layout"><div class="card pane"><div class="section-title"><div class="label">Document studio</div></div><div class="doc-controls"><div class="form-row"><label>Projet</label><select id="docProjectSelect">${state.vault.projects.map(p => `<option value="${p.id}" ${selectedProject&&p.id===selectedProject.id?'selected':''}>${esc(p.code)} · ${esc(p.name)}</option>`).join('')}</select></div><div class="form-row"><label>Type de document</label><select id="docTypeSelect">${Object.entries(DOC_TYPE_LABELS).map(([k,v]) => `<option value="${k}" ${state.docDraft.type===k?'selected':''}>${esc(v)}</option>`).join('')}</select></div></div>${selectedProject ? `<div style="height:12px"></div><div class="client-card"><h3>Données projet injectées</h3><div class="kv"><div class="k">Client</div><div class="v">${esc(selectedProject.clientName)}</div></div><div class="kv"><div class="k">Budget HT</div><div class="v">${money(selectedProject.budgetHT)}</div></div><div class="kv"><div class="k">Acompte</div><div class="v">${pct(selectedProject.depositPercent)}</div></div><div class="kv"><div class="k">Délai</div><div class="v">${selectedProject.delayDays} jours</div></div></div>` : ''}<div style="height:12px"></div><div class="inline-actions"><button class="btn btn-secondary" id="btnEditProjectForDoc">Modifier projet</button><button class="btn btn-primary" id="btnCreateDoc">Créer un snapshot</button><button class="btn btn-secondary" id="btnPreviewDoc">Actualiser l’aperçu</button></div><hr class="sep"><div class="section-title"><div class="label">Snapshots existants</div></div><div class="doc-list">${state.vault.documents.map(doc => { const p=projectById(doc.projectId); return `<div class="doc-item ${selectedDoc&&selectedDoc.id===doc.id?'active':''}" data-doc="${doc.id}"><div class="title">${esc(doc.label)}</div><div class="meta">${esc(p ? p.code : '—')} · ${esc(doc.status)} · ${shortDate(doc.createdAt)} · ${doc.fingerprint}</div></div>`; }).join('') || `<div class="empty-state">Aucun snapshot généré.</div>`}</div>${selectedDoc ? `<div style="height:12px"></div><div class="toolbar"><button class="btn btn-secondary small" id="btnPrintDoc">Imprimer / PDF</button><button class="btn btn-secondary small" id="btnExportDocHtml">Exporter HTML</button></div>` : ''}</div><div class="card pane"><div class="section-title"><div class="label">Aperçu</div></div><iframe class="preview-frame" id="docPreviewFrame"></iframe></div></div>`;
  $('docProjectSelect').onchange = e => { state.docDraft.projectId = e.target.value; state.selectedProjectId = e.target.value; state.selectedDocumentId = null; renderDocuments(); };
  $('docTypeSelect').onchange = e => { state.docDraft.type = e.target.value; state.selectedDocumentId = null; renderDocuments(); };
  $('btnEditProjectForDoc').onclick = () => openProjectModal(selectedProject);
  $('btnCreateDoc').onclick = async () => {
    const snapshot = await buildDocumentSnapshot(selectedProject, state.docDraft.type);
    const doc = defaultDocument({projectId:selectedProject.id, type:state.docDraft.type, label:snapshot.label, status:'Généré', fingerprint:snapshot.fingerprint, html:snapshot.html, createdAt:nowIso()});
    state.vault.documents.unshift(doc); state.selectedDocumentId = doc.id; logActivity('document_snapshot', `${doc.label} créé`); await persistVault(); renderDocuments(); showToast('Snapshot documentaire créé.');
  };
  $('btnPreviewDoc').onclick = async () => { const snap = await buildDocumentSnapshot(selectedProject, state.docDraft.type); $('docPreviewFrame').srcdoc = snap.html; };
  document.querySelectorAll('[data-doc]').forEach(el => el.onclick = () => { state.selectedDocumentId = el.dataset.doc; renderDocuments(); });
  if($('btnPrintDoc')) $('btnPrintDoc').onclick = () => printDoc(selectedDoc.html);
  if($('btnExportDocHtml')) $('btnExportDocHtml').onclick = () => exportTextFile(`${selectedDoc.type}-${selectedDoc.fingerprint}.html`, selectedDoc.html, 'text/html');
  const frame = $('docPreviewFrame');
  if(selectedDoc) frame.srcdoc = selectedDoc.html;
  else buildDocumentSnapshot(selectedProject, state.docDraft.type).then(snap => { frame.srcdoc = snap.html; }).catch(() => { frame.srcdoc = `<div class="doc-page"><h1>Erreur de preview</h1></div>`; });
}
function printDoc(html){ const win = window.open('', '_blank'); if(!win) return showToast('Le navigateur a bloqué la fenêtre d’impression.','error'); win.document.write(html); win.document.close(); win.focus(); setTimeout(() => win.print(), 300); }

function renderField(){
  const project = projectById(state.selectedProjectId) || state.vault.projects[0];
  $('content').innerHTML = `<div class="grid-main"><div class="card pane"><div class="section-title"><div class="label">Quick field actions</div></div><div class="form-row"><label>Projet</label><select id="fieldProjectSelect">${state.vault.projects.map(p => `<option value="${p.id}" ${project&&p.id===project.id?'selected':''}>${esc(p.code)} · ${esc(p.name)}</option>`).join('')}</select></div><div class="inline-actions"><button class="btn btn-primary" id="btnQuickIncident">Nouvel incident</button><button class="btn btn-secondary" id="btnQuickReview">Quick review</button><button class="btn btn-secondary" id="btnQuickPresence">Check présence</button></div><div style="height:12px"></div><div class="helper">Ce mode est volontairement court et rapide : incident, review ou présence sans ouvrir toute l’application de gestion.</div></div><div class="detail-stack"><div class="card pane"><div class="section-title"><div class="label">Incidents ouverts</div></div><div class="activity-list">${incidentsForProject(project.id).map(i => `<div class="activity-item"><div class="activity-meta">${shortDate(i.date)} · ${esc(i.category)} · ${esc(i.status)}</div><div><strong>${esc(i.title)}</strong><br>${esc(i.description)}</div></div>`).join('') || `<div class="empty-state">Aucun incident.</div>`}</div></div><div class="card pane"><div class="section-title"><div class="label">Reviews à faire</div></div><div class="activity-list">${assignmentsForProject(project.id).filter(a => a.status === 'Terminé' && !state.vault.reviews.some(r => r.assignmentId === a.id)).map(a => `<div class="activity-item"><div class="activity-meta">${esc(a.specialty)} · ${esc(a.phase || '—')}</div><div>${esc(contactById(a.contactId)?.name || '—')} doit encore être évalué.</div></div>`).join('') || `<div class="empty-state">Aucune review en attente.</div>`}</div></div></div></div>`;
  $('fieldProjectSelect').onchange = e => { state.selectedProjectId = e.target.value; renderField(); };
  $('btnQuickIncident').onclick = () => openIncidentModal(project.id);
  $('btnQuickReview').onclick = () => openReviewPicker(project.id);
  $('btnQuickPresence').onclick = async () => { logActivity('field_presence', `${project.code} · présence confirmée sur site`); await persistVault(); renderField(); showToast('Présence enregistrée dans le journal.'); };
}
function openIncidentModal(projectId){
  openModal('Nouvel incident', `<div class="split-2"><div class="form-row"><label>Gravité</label><select id="inc_severity">${['faible','moyenne','élevée'].map(v => `<option value="${v}">${v}</option>`).join('')}</select></div><div class="form-row"><label>Catégorie</label><input id="inc_category" value="chantier"></div><div class="form-row"><label>Date</label><input id="inc_date" type="date" value="${nowIso().slice(0,10)}"></div><div class="form-row"><label>Contact lié</label><select id="inc_contact"><option value="">—</option>${state.vault.contacts.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div></div><div class="form-row"><label>Titre</label><input id="inc_title"></div><div class="form-row"><label>Description</label><textarea id="inc_description"></textarea></div>`, async () => {
    const incident = defaultIncident({projectId, severity:$('inc_severity').value, category:$('inc_category').value.trim(), date:$('inc_date').value, linkedContactId:$('inc_contact').value, title:$('inc_title').value.trim(), description:$('inc_description').value.trim(), status:'Ouvert'});
    if(!incident.title) return showToast('Le titre est requis.','error'), false;
    state.vault.incidents.unshift(incident); logActivity('incident_created', `${projectById(projectId)?.code} · ${incident.title}`); await persistVault(); renderField(); showToast('Incident enregistré.');
  });
}
function openReviewPicker(projectId){
  const assigns = assignmentsForProject(projectId).filter(a => a.status === 'Terminé' || a.status === 'Évalué');
  openModal('Choisir une affectation à évaluer', `<div class="form-row"><label>Affectation</label><select id="review_assignment">${assigns.map(a => `<option value="${a.id}">${esc(projectById(a.projectId)?.code)} · ${esc(contactById(a.contactId)?.name || '—')} · ${esc(a.specialty)}</option>`).join('')}</select></div>`, async () => { const a = assignmentById($('review_assignment').value); closeModal(); openReviewModal(a); return false; }, 'Continuer');
}
function openReviewModal(assignment){
  if(!assignment) return showToast('Affectation introuvable.','error');
  openModal('Quick review', `<div class="split-2"><div class="form-row"><label>Qualité /5</label><input id="r_quality" type="number" min="0" max="5" value="4"></div><div class="form-row"><label>Fiabilité /5</label><input id="r_reliability" type="number" min="0" max="5" value="4"></div><div class="form-row"><label>Vitesse /5</label><input id="r_speed" type="number" min="0" max="5" value="4"></div><div class="form-row"><label>Discipline /5</label><input id="r_discipline" type="number" min="0" max="5" value="4"></div><div class="form-row"><label>Réembauche</label><select id="r_rehire"><option value="">À décider</option><option value="true">Oui</option><option value="false">Non</option></select></div></div><div class="form-row"><label>Note</label><textarea id="r_notes"></textarea></div>`, async () => {
    const rehireRaw = $('r_rehire').value;
    const review = defaultReview({assignmentId:assignment.id, projectId:assignment.projectId, contactId:assignment.contactId, date:nowIso().slice(0,10), quality:Number($('r_quality').value||0), reliability:Number($('r_reliability').value||0), speed:Number($('r_speed').value||0), discipline:Number($('r_discipline').value||0), rehire: rehireRaw==='' ? null : rehireRaw==='true', notes:$('r_notes').value.trim()});
    state.vault.reviews.unshift(review); assignment.status = 'Évalué'; logActivity('review_created', `${projectById(assignment.projectId)?.code} · ${contactById(assignment.contactId)?.name || '—'} évalué`); await persistVault(); setView('assignments'); showToast('Review enregistrée.');
  });
}

function renderActivity(){ $('content').innerHTML = `<div class="card pane"><div class="section-title"><div class="label">Journal d’activité</div></div><div class="activity-list">${state.vault.activity.map(a => `<div class="activity-item"><div class="activity-meta">${shortDate(a.at)} · ${esc(a.type)}</div><div>${esc(a.detail)}</div></div>`).join('')}</div></div>`; }
function renderSettings(){ $('content').innerHTML = `<div class="grid-main"><div class="card pane"><div class="section-title"><div class="label">Société & sécurité</div></div><div class="grid-2"><div class="form-row"><label>Nom société</label><input id="stCompanyName" value="${esc(state.vault.company.name)}"></div><div class="form-row"><label>Signataire</label><input id="stSignatory" value="${esc(state.vault.company.signatory)}"></div><div class="form-row"><label>Adresse</label><input id="stAddress" value="${esc(state.vault.company.address)}"></div><div class="form-row"><label>Email</label><input id="stEmail" value="${esc(state.vault.company.email)}"></div></div><div class="form-row"><label>Verrouiller au changement d’onglet</label><select id="lockOnBlurSelect"><option value="true" ${state.vault.company.lockOnBlur ? 'selected':''}>Oui</option><option value="false" ${!state.vault.company.lockOnBlur ? 'selected':''}>Non</option></select></div><div class="inline-actions"><button class="btn btn-primary" id="btnSaveSettings">Enregistrer</button><button class="btn btn-secondary" id="btnLockNow">Verrouiller maintenant</button></div></div><div class="card pane"><div class="section-title"><div class="label">Export / import</div></div><div class="helper">Le coffre est chiffré localement. L’export garde l’enveloppe chiffrée. L’import remplace le coffre actuel.</div><div style="height:12px"></div><div class="inline-actions"><button class="btn btn-primary" id="btnExportVault">Exporter le coffre chiffré</button><label class="btn btn-secondary" for="importVaultInput">Importer un coffre</label><input type="file" class="hidden" id="importVaultInput" accept=".json,application/json"></div><div style="height:12px"></div><div class="helper">Pour un vrai produit multi-utilisateur, il faudra ensuite migrer cette V6 vers un backend avec auth, rôles, stockage distant et logs serveur.</div></div></div>`;
  $('btnSaveSettings').onclick = async () => { state.vault.company.name = $('stCompanyName').value.trim() || state.vault.company.name; state.vault.company.signatory = $('stSignatory').value.trim() || state.vault.company.signatory; state.vault.company.address = $('stAddress').value.trim(); state.vault.company.email = $('stEmail').value.trim(); state.vault.company.lockOnBlur = $('lockOnBlurSelect').value === 'true'; logActivity('settings_updated','Paramètres société mis à jour'); await persistVault(); showToast('Paramètres enregistrés.'); renderSettings(); };
  $('btnLockNow').onclick = () => lockApp();
  $('btnExportVault').onclick = () => exportTextFile(`${state.vault.company.name.replace(/\s+/g,'-').toLowerCase()}-vault-v6.json`, localStorage.getItem(STORAGE_KEY), 'application/json');
  $('importVaultInput').onchange = async (e) => { const file=e.target.files[0]; if(!file) return; const text=await file.text(); try{ JSON.parse(text); localStorage.setItem(STORAGE_KEY, text); showToast('Coffre importé. Déverrouille-le pour continuer.'); lockApp(); } catch { showToast('Fichier invalide.','error'); } };
}
function exportTextFile(name, text, type='text/plain'){ const blob=new Blob([text],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),500); }
function openModal(title, body, onConfirm, confirmLabel='Enregistrer'){ const root=$('modalRoot'); root.innerHTML=`<div class="modal-backdrop"><div class="modal"><div class="topline" style="margin-bottom:12px"><div style="font-size:22px;font-weight:600">${esc(title)}</div><button class="btn btn-ghost small" id="modalCloseBtn">Fermer</button></div>${body}<div class="inline-actions" style="margin-top:14px"><button class="btn btn-primary" id="modalConfirmBtn">${esc(confirmLabel)}</button><button class="btn btn-secondary" id="modalCancelBtn">Annuler</button></div></div></div>`; $('modalCloseBtn').onclick=closeModal; $('modalCancelBtn').onclick=closeModal; $('modalConfirmBtn').onclick=async()=>{ const ok=await onConfirm(); if(ok!==false) closeModal(); }; }
function closeModal(){ $('modalRoot').innerHTML=''; }

function openProjectModal(project=null){
  const p=defaultProject(project||{});
  openModal(project?'Modifier le projet':'Nouveau projet', `<div class="split-2"><div class="form-row"><label>Code</label><input id="p_code" value="${esc(p.code)}"></div><div class="form-row"><label>Nom</label><input id="p_name" value="${esc(p.name)}"></div><div class="form-row"><label>Type projet</label><input id="p_projectType" value="${esc(p.projectType)}"></div><div class="form-row"><label>Standing</label><input id="p_standing" value="${esc(p.standing)}"></div><div class="form-row"><label>Type client</label><select id="p_clientType">${['particulier','societe'].map(v=>`<option value="${v}" ${p.clientType===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="form-row"><label>Client</label><input id="p_clientName" value="${esc(p.clientName)}"></div><div class="form-row"><label>Adresse client</label><input id="p_clientAddress" value="${esc(p.clientAddress)}"></div><div class="form-row"><label>Téléphone client</label><input id="p_clientPhone" value="${esc(p.clientPhone)}"></div><div class="form-row"><label>Email client</label><input id="p_clientEmail" value="${esc(p.clientEmail)}"></div><div class="form-row"><label>Localisation</label><input id="p_location" value="${esc(p.location)}"></div><div class="form-row"><label>Statut</label><select id="p_status">${PROJECT_STATUSES.map(v=>`<option value="${v}" ${p.status===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="form-row"><label>Phase</label><input id="p_phase" value="${esc(p.phase)}"></div><div class="form-row"><label>Architecte</label><input id="p_architect" value="${esc(p.architect)}"></div><div class="form-row"><label>BET</label><input id="p_bet" value="${esc(p.bet)}"></div><div class="form-row"><label>Spécialités requises (virgule)</label><input id="p_requiredSpecialties" value="${esc(p.requiredSpecialties.join(', '))}"></div><div class="form-row"><label>Date début</label><input id="p_startDate" type="date" value="${esc(p.startDate)}"></div><div class="form-row"><label>Date fin</label><input id="p_endDate" type="date" value="${esc(p.endDate)}"></div><div class="form-row"><label>Budget HT</label><input id="p_budgetHT" type="number" value="${esc(p.budgetHT)}"></div><div class="form-row"><label>Budget TTC</label><input id="p_budgetTTC" type="number" value="${esc(p.budgetTTC)}"></div><div class="form-row"><label>Budget matériaux</label><input id="p_materialBudget" type="number" value="${esc(p.materialBudget)}"></div><div class="form-row"><label>Acompte %</label><input id="p_depositPercent" type="number" min="0" max="100" value="${esc(p.depositPercent)}"></div><div class="form-row"><label>Délai jours</label><input id="p_delayDays" type="number" value="${esc(p.delayDays)}"></div><div class="form-row"><label>Progression %</label><input id="p_progressPercent" type="number" min="0" max="100" value="${esc(p.progressPercent)}"></div></div><div class="form-row"><label>Scope summary</label><textarea id="p_scopeSummary">${esc(p.scopeSummary)}</textarea></div><div class="split-2"><div class="form-row"><label>Inclusions (virgule)</label><textarea id="p_inclusions">${esc(p.inclusions.join(', '))}</textarea></div><div class="form-row"><label>Exclusions (virgule)</label><textarea id="p_exclusions">${esc(p.exclusions.join(', '))}</textarea></div></div><div class="split-2"><div class="form-row"><label>Hypothèses (virgule)</label><textarea id="p_assumptions">${esc(p.assumptions.join(', '))}</textarea></div><div class="form-row"><label>Conditions de paiement</label><textarea id="p_paymentTerms">${esc(p.paymentTerms)}</textarea></div></div><div class="form-row"><label>Lignes de chiffrage (une ligne = désignation|unité|qté|PU)</label><textarea id="p_pricingLines">${esc(p.pricingLines.map(l => `${l.designation}|${l.unite}|${l.qte}|${l.pu}`).join('\n'))}</textarea></div><div class="form-row"><label>Notes</label><textarea id="p_notes">${esc(p.notes)}</textarea></div>`, async () => {
    const pricingLines = $('p_pricingLines').value.split('\n').map(line => line.trim()).filter(Boolean).map(line => { const [designation, unite='forfait', qte='1', pu='0'] = line.split('|').map(s => s.trim()); return {designation, unite, qte:Number(qte||1), pu:Number(pu||0)}; });
    const payload = defaultProject({id: project?.id || uid('proj'), code:$('p_code').value.trim(), name:$('p_name').value.trim(), projectType:$('p_projectType').value.trim(), standing:$('p_standing').value.trim(), clientType:$('p_clientType').value, clientName:$('p_clientName').value.trim(), clientAddress:$('p_clientAddress').value.trim(), clientPhone:$('p_clientPhone').value.trim(), clientEmail:$('p_clientEmail').value.trim(), location:$('p_location').value.trim(), status:$('p_status').value, phase:$('p_phase').value.trim(), architect:$('p_architect').value.trim(), bet:$('p_bet').value.trim(), requiredSpecialties:csvList($('p_requiredSpecialties').value), startDate:$('p_startDate').value, endDate:$('p_endDate').value, budgetHT:Number($('p_budgetHT').value||0), budgetTTC:Number($('p_budgetTTC').value||0), materialBudget:Number($('p_materialBudget').value||0), depositPercent:Number($('p_depositPercent').value||0), delayDays:Number($('p_delayDays').value||0), progressPercent:Number($('p_progressPercent').value||0), scopeSummary:$('p_scopeSummary').value.trim(), inclusions:csvList($('p_inclusions').value), exclusions:csvList($('p_exclusions').value), assumptions:csvList($('p_assumptions').value), paymentTerms:$('p_paymentTerms').value.trim(), pricingLines, notes:$('p_notes').value.trim()});
    if(!payload.code || !payload.name || !payload.clientName) return showToast('Code, nom et client sont requis.','error'), false;
    if(project){ Object.assign(project, payload); logActivity('project_updated', `${payload.code} mis à jour`); } else { state.vault.projects.unshift(payload); state.selectedProjectId = payload.id; state.docDraft.projectId = payload.id; state.matchDraft.projectId = payload.id; logActivity('project_created', `${payload.code} créé`); }
    await persistVault(); renderProjects(); showToast('Projet enregistré.');
  });
}

function openContactModal(contact=null){
  const c=defaultContact(contact||{});
  openModal(contact?'Modifier le contact':'Nouveau contact', `<div class="split-2"><div class="form-row"><label>Nom</label><input id="c_name" value="${esc(c.name)}"></div><div class="form-row"><label>Nom commercial</label><input id="c_tradeName" value="${esc(c.tradeName)}"></div><div class="form-row"><label>Statut</label><select id="c_status">${CONTACT_STATUSES.map(v=>`<option value="${v}" ${c.status===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="form-row"><label>Type</label><select id="c_kind">${['sous-traitant','chef equipe','ouvrier','fournisseur'].map(v=>`<option value="${v}" ${c.kind===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="form-row"><label>Spécialité principale</label><select id="c_primarySpecialty">${SPECIALTIES.map(v=>`<option value="${v}" ${c.primarySpecialty===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="form-row"><label>Spécialités secondaires (virgule)</label><input id="c_specialties" value="${esc(c.specialties.join(', '))}"></div><div class="form-row"><label>Ville</label><input id="c_city" value="${esc(c.city)}"></div><div class="form-row"><label>Zones couvertes (virgule)</label><input id="c_zones" value="${esc(c.zones.join(', '))}"></div><div class="form-row"><label>Téléphone</label><input id="c_phone" value="${esc(c.phone)}"></div><div class="form-row"><label>WhatsApp</label><input id="c_whatsapp" value="${esc(c.whatsapp)}"></div><div class="form-row"><label>Email</label><input id="c_email" value="${esc(c.email)}"></div><div class="form-row"><label>Statut légal</label><select id="c_legalStatus">${['informel','auto-entrepreneur','societe'].map(v=>`<option value="${v}" ${c.legalStatus===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="form-row"><label>Niveau de confiance</label><select id="c_trust">${['eleve','moyen','faible'].map(v=>`<option value="${v}" ${c.trust===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="form-row"><label>Disponibilité</label><input id="c_availability" value="${esc(c.availability)}"></div><div class="form-row"><label>Tarif jour MAD</label><input id="c_rateDay" type="number" value="${esc(c.rateDay)}"></div><div class="form-row"><label>Forfait MAD</label><input id="c_ratePackage" type="number" value="${esc(c.ratePackage)}"></div><div class="form-row"><label>Taille équipe</label><input id="c_crewSize" type="number" value="${esc(c.crewSize)}"></div><div class="form-row"><label>Expérience (ans)</label><input id="c_yearsExperience" type="number" value="${esc(c.yearsExperience)}"></div><div class="form-row"><label>Taille lot mini</label><input id="c_minJobSize" value="${esc(c.minJobSize)}"></div><div class="form-row"><label>Mode de paiement</label><input id="c_paymentMode" value="${esc(c.paymentMode)}"></div><div class="form-row"><label>Langues (virgule)</label><input id="c_languages" value="${esc(c.languages.join(', '))}"></div><div class="form-row"><label>Tags (virgule)</label><input id="c_tags" value="${esc(c.tags.join(', '))}"></div><div class="form-row"><label>Source</label><input id="c_referralSource" value="${esc(c.referralSource)}"></div><div class="form-row"><label>Dernière phase connue</label><input id="c_lastKnownStage" value="${esc(c.lastKnownStage)}"></div></div><div class="split-2"><div class="form-row"><label>Capacités</label><label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="c_canLeadTeam" ${c.canLeadTeam?'checked':''}> Peut mener une équipe</label><label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="c_ownTools" ${c.ownTools?'checked':''}> Possède ses outils</label><label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="c_hasVehicle" ${c.hasVehicle?'checked':''}> Dispose d’un véhicule</label></div><div class="form-row"><label>Conformité</label><label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="c_comp_idReceived" ${c.compliance.idReceived?'checked':''}> CIN / ID reçu</label><label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="c_comp_contractSigned" ${c.compliance.contractSigned?'checked':''}> Contrat signé</label><label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="c_comp_ndaSigned" ${c.compliance.ndaSigned?'checked':''}> NDA</label><label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="c_comp_bankInfo" ${c.compliance.bankInfo?'checked':''}> Coordonnées bancaires</label><label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="c_comp_taxStatus" ${c.compliance.taxStatus?'checked':''}> Statut fiscal</label><label style="display:flex;align-items:center;gap:8px;margin:6px 0"><input type="checkbox" id="c_comp_safetyBriefing" ${c.compliance.safetyBriefing?'checked':''}> Brief sécurité</label></div></div><div class="form-row"><label>Notes</label><textarea id="c_notes">${esc(c.notes)}</textarea></div>`, async () => {
    const primary = $('c_primarySpecialty').value;
    const payload = defaultContact({id:contact?.id || uid('ct'), status:$('c_status').value, name:$('c_name').value.trim(), tradeName:$('c_tradeName').value.trim(), kind:$('c_kind').value, primarySpecialty:primary, specialties:unique([primary, ...csvList($('c_specialties').value)]), city:$('c_city').value.trim(), zones:unique(csvList($('c_zones').value)), phone:$('c_phone').value.trim(), whatsapp:$('c_whatsapp').value.trim(), email:$('c_email').value.trim(), legalStatus:$('c_legalStatus').value, trust:$('c_trust').value, availability:$('c_availability').value.trim(), availabilityDays:availabilityDaysFromText($('c_availability').value.trim()), rateDay:Number($('c_rateDay').value||0), ratePackage:Number($('c_ratePackage').value||0), crewSize:Number($('c_crewSize').value||1), yearsExperience:Number($('c_yearsExperience').value||0), canLeadTeam:$('c_canLeadTeam').checked, ownTools:$('c_ownTools').checked, hasVehicle:$('c_hasVehicle').checked, minJobSize:$('c_minJobSize').value.trim(), paymentMode:$('c_paymentMode').value.trim(), languages:csvList($('c_languages').value), tags:csvList($('c_tags').value), referralSource:$('c_referralSource').value.trim(), lastKnownStage:$('c_lastKnownStage').value.trim(), notes:$('c_notes').value.trim(), compliance:{idReceived:$('c_comp_idReceived').checked, contractSigned:$('c_comp_contractSigned').checked, ndaSigned:$('c_comp_ndaSigned').checked, bankInfo:$('c_comp_bankInfo').checked, taxStatus:$('c_comp_taxStatus').checked, safetyBriefing:$('c_comp_safetyBriefing').checked}});
    if(!payload.name) return showToast('Le nom est requis.','error'), false;
    if(contact){ Object.assign(contact,payload); logActivity('contact_updated', `${payload.name} mis à jour`); } else { state.vault.contacts.unshift(payload); state.selectedContactId = payload.id; logActivity('contact_created', `${payload.name} créé`); }
    await persistVault(); renderNetwork(); showToast('Contact enregistré.');
  });
}
function openAssignmentModal(assignment=null, defaults={}){
  openModal(assignment?'Modifier l’affectation':'Nouvelle affectation', `<div class="split-2"><div class="form-row"><label>Projet</label><select id="a_project">${state.vault.projects.map(p => `<option value="${p.id}" ${(assignment?.projectId || defaults.projectId)===p.id?'selected':''}>${esc(p.code)} · ${esc(p.name)}</option>`).join('')}</select></div><div class="form-row"><label>Contact</label><select id="a_contact">${state.vault.contacts.map(c => `<option value="${c.id}" ${(assignment?.contactId || defaults.contactId)===c.id?'selected':''}>${esc(c.name)} · ${esc(c.primarySpecialty)}</option>`).join('')}</select></div><div class="form-row"><label>Statut</label><select id="a_status">${ASSIGNMENT_STATUSES.map(s => `<option value="${s}" ${(assignment?.status || defaults.status)===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="form-row"><label>Spécialité</label><select id="a_specialty">${SPECIALTIES.map(s => `<option value="${s}" ${(assignment?.specialty || defaults.specialty)===s?'selected':''}>${s}</option>`).join('')}</select></div><div class="form-row"><label>Phase</label><input id="a_phase" value="${esc(assignment?.phase || defaults.phase || '')}"></div><div class="form-row"><label>Rôle</label><input id="a_role" value="${esc(assignment?.role || '')}"></div><div class="form-row"><label>Début</label><input id="a_from" type="date" value="${esc(assignment?.from || '')}"></div><div class="form-row"><label>Fin</label><input id="a_to" type="date" value="${esc(assignment?.to || '')}"></div><div class="form-row"><label>Jours prévus</label><input id="a_plannedDays" type="number" value="${esc(assignment?.plannedDays || 0)}"></div><div class="form-row"><label>Jours réels</label><input id="a_actualDays" type="number" value="${esc(assignment?.actualDays || 0)}"></div><div class="form-row"><label>% reprise</label><input id="a_reworkPct" type="number" value="${esc(assignment?.reworkPct || 0)}"></div></div><div class="form-row"><label>Notes</label><textarea id="a_notes">${esc(assignment?.notes || '')}</textarea></div>`, async () => {
    const payload = defaultAssignment({id:assignment?.id || uid('as'), status:$('a_status').value, projectId:$('a_project').value, contactId:$('a_contact').value, specialty:$('a_specialty').value, phase:$('a_phase').value.trim(), role:$('a_role').value.trim(), from:$('a_from').value, to:$('a_to').value, plannedDays:Number($('a_plannedDays').value||0), actualDays:Number($('a_actualDays').value||0), reworkPct:Number($('a_reworkPct').value||0), notes:$('a_notes').value.trim()});
    if(assignment){ Object.assign(assignment,payload); logActivity('assignment_updated', `${payload.specialty} mise à jour`); } else { state.vault.assignments.unshift(payload); state.selectedAssignmentId = payload.id; logActivity('assignment_created', `${payload.specialty} affectée`); }
    await persistVault(); renderAssignments(); showToast('Affectation enregistrée.');
  });
}

function quickSearchModal(){
  openModal('Recherche rapide', `<div class="form-row"><label>Recherche</label><input id="quickSearchInput" placeholder="Projet, contact, spécialité, code..."></div><div id="quickSearchResults" class="list-pane"></div>`, () => false, 'Fermer');
  $('modalConfirmBtn').classList.add('hidden');
  $('quickSearchInput').oninput = () => {
    const q=$('quickSearchInput').value.toLowerCase().trim(); const items=[];
    if(q){ state.vault.projects.forEach(p=>{ if([p.code,p.name,p.clientName,p.location,p.scopeSummary].join(' ').toLowerCase().includes(q)) items.push({type:'project',id:p.id,label:`${p.code} · ${p.name}`,meta:p.location || '—'}); }); state.vault.contacts.forEach(c=>{ if([c.name,c.tradeName,c.primarySpecialty,c.city,c.notes,c.tags.join(' ')].join(' ').toLowerCase().includes(q)) items.push({type:'contact',id:c.id,label:`${c.name} · ${c.primarySpecialty}`,meta:c.city || '—'}); }); }
    $('quickSearchResults').innerHTML = items.map(x => `<div class="entity-card" data-search-hit="${x.type}:${x.id}"><div class="entity-title">${esc(x.label)}</div><div class="entity-meta">${esc(x.meta)}</div></div>`).join('') || `<div class="empty-state">Aucun résultat.</div>`;
    document.querySelectorAll('[data-search-hit]').forEach(el => el.onclick = () => { const [type,id]=el.dataset.searchHit.split(':'); closeModal(); if(type==='project'){ state.selectedProjectId=id; setView('projects'); } if(type==='contact'){ state.selectedContactId=id; setView('network'); } });
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

async function init(){
  await loadDocResources();
  bindShell();
  initAuthView();
  $('btnCreateVault').onclick = createVault;
  $('btnUnlockVault').onclick = unlockVault;
  $('btnResetVault').onclick = () => { if(confirm('Réinitialiser le coffre local ? Toutes les données locales seront supprimées.')){ localStorage.removeItem(STORAGE_KEY); LEGACY_KEYS.forEach(k => localStorage.removeItem(k)); initAuthView(); setAuthMessage('unlockVaultMessage','Coffre supprimé.','success'); } };
}
init();
