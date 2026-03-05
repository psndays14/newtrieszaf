
const STORAGE_KEY = "zafbat_sprint2_js_v1";

const S = {
  route: { name: "dashboard", projectId: null, docId: null },
  projects: [],
  documents: [],
  drafts: {},
  filters: { search: "", status: "all", sort: "updated_desc" },
  ui: { previewDocId: null },
  flash: null,
};

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}
function nowISO() { return new Date().toISOString(); }
function today() { return new Date().toISOString().slice(0, 10); }
function esc(v = "") {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function safeNum(v, fallback = 0) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function formatMoney(v) {
  const n = safeNum(v, 0);
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
}
function statusClass(status = "") {
  const s = status.toLowerCase();
  if (s.includes("termin") || s.includes("final")) return "ok";
  if (s.includes("cours") || s.includes("étude") || s.includes("etude") || s.includes("prospect") || s.includes("brouillon")) return "warn";
  if (s.includes("perdu") || s.includes("suspendu")) return "danger";
  return "neutral";
}
function flash(message, kind = "ok") { S.flash = { message, kind, at: Date.now() }; render(); }
function relativeDateLabel(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("fr-FR");
}
function validateEmail(v) { if (!v) return true; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

function baseProject() {
  return {
    id: uid("prj"),
    ref: "",
    nom: "",
    client: "",
    contact: "",
    telephone: "",
    email: "",
    adresse: "",
    ville: "Casablanca",
    type: "Villa",
    surface: "",
    budget: 0,
    responsable: "",
    statut: "Prospect",
    dateDebut: "",
    dateFinPrevue: "",
    notes: "",
    createdAt: nowISO(),
    updatedAt: nowISO(),
    schemaVersion: 2,
  };
}

function makeAuditDraft(project) {
  return {
    id: uid("audit"),
    projectId: project.id,
    projet: project.nom,
    client: project.client,
    contact: project.contact || "",
    telephone: project.telephone || "",
    email: project.email || "",
    adresse: project.adresse || "",
    ville: project.ville || "Casablanca",
    typeProjet: project.type || "Villa",
    surface: project.surface || "",
    phase: "",
    date: today(),
    responsable: project.responsable || "",
    observations: "",
    coutTotal: 0,
    economie: 0,
    anomalies: [],
    status: "brouillon",
    updatedAt: nowISO(),
    schemaVersion: 2,
  };
}
function makeCRDraft(project) {
  return {
    id: uid("cr"),
    projectId: project.id,
    projet: project.nom,
    client: project.client,
    contact: project.contact || "",
    telephone: project.telephone || "",
    email: project.email || "",
    adresse: project.adresse || "",
    semaine: "",
    phase: "",
    prevu: "",
    reel: "",
    ecart: "",
    travaux: [],
    factures: [],
    alertes: [],
    prochains: "",
    decisions: "",
    responsable: project.responsable || "",
    status: "brouillon",
    updatedAt: nowISO(),
    schemaVersion: 2,
  };
}
function makeDevisDraft(project) {
  return {
    id: uid("devis"),
    projectId: project.id,
    projet: project.nom,
    client: project.client,
    contact: project.contact || "",
    telephone: project.telephone || "",
    email: project.email || "",
    adresse: project.adresse || "",
    date: today(),
    validite: "15 jours",
    conditions: "40% à la commande, 40% en cours, 20% à la livraison",
    responsable: project.responsable || "",
    lignes: [newDevisLine()],
    tva: 20,
    remise: 0,
    devise: "MAD",
    notes: "",
    status: "brouillon",
    updatedAt: nowISO(),
    schemaVersion: 2,
  };
}
function newDevisLine() { return { id: uid("ln"), designation: "", unite: "u", quantite: 1, prixUnitaire: 0 }; }
function newAnomaly() { return { id: uid("an"), titre: "", lot: "", detail: "", cout: 0, echeance: "" }; }
function newTravail() { return { id: uid("trv"), tache: "", statut: "" }; }
function newFacture() { return { id: uid("fac"), numero: "", montant: 0 }; }

function projectById(id) { return S.projects.find((p) => p.id === id) || null; }
function documentById(id) { return S.documents.find((d) => d.id === id) || null; }
function docsForProject(projectId) { return S.documents.filter((d) => d.projectId === projectId); }

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    route: S.route,
    projects: S.projects,
    documents: S.documents,
    drafts: S.drafts,
    filters: S.filters,
    ui: S.ui,
    savedAt: nowISO(),
    version: 2,
  }));
}

function seedDemo() {
  const p1 = baseProject();
  p1.ref = "ZB-2026-001";
  p1.nom = "Villa Bouskoura";
  p1.client = "Famille El Idrissi";
  p1.contact = "M. El Idrissi";
  p1.telephone = "+212 6 00 00 00 00";
  p1.email = "client@example.com";
  p1.adresse = "Bouskoura, Casablanca";
  p1.surface = 540;
  p1.budget = 4800000;
  p1.responsable = "Yassine";
  p1.statut = "En étude";
  p1.dateDebut = today();

  const p2 = baseProject();
  p2.ref = "ZB-2026-002";
  p2.nom = "Villa Californie";
  p2.client = "Mme A.";
  p2.responsable = "Yassine";
  p2.statut = "Prospect";
  p2.budget = 6200000;

  const auditDraft = makeAuditDraft(p1);
  auditDraft.phase = "Avant-projet";
  auditDraft.observations = "Première estimation des postes et risques budgétaires.";
  auditDraft.anomalies = [{ id: uid("an"), titre: "Sous-estimation VRD", lot: "VRD", detail: "Prévoir réserve supplémentaire.", cout: 65000, echeance: today() }];
  auditDraft.coutTotal = 65000;
  auditDraft.economie = 25000;
  auditDraft.status = "final";

  const devisDraft = makeDevisDraft(p1);
  devisDraft.lignes = [
    { id: uid("ln"), designation: "Gros oeuvre", unite: "forfait", quantite: 1, prixUnitaire: 1250000 },
    { id: uid("ln"), designation: "Second oeuvre", unite: "forfait", quantite: 1, prixUnitaire: 980000 },
  ];
  devisDraft.status = "final";

  S.projects = [p1, p2];
  S.documents = [
    buildDocumentFromDraft("audit", p1, auditDraft, null),
    buildDocumentFromDraft("devis", p1, devisDraft, null),
  ];
  S.documents[0].version = 1;
  S.documents[1].version = 1;
  saveState();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) { seedDemo(); return; }
    const parsed = JSON.parse(raw);
    S.route = parsed.route || S.route;
    S.projects = Array.isArray(parsed.projects) ? parsed.projects : [];
    S.documents = Array.isArray(parsed.documents) ? parsed.documents : [];
    S.drafts = parsed.drafts || {};
    S.filters = parsed.filters || S.filters;
    S.ui = parsed.ui || S.ui;
  } catch (e) {
    console.error(e);
    seedDemo();
  }
}

function exportBackup() {
  saveState();
  const raw = localStorage.getItem(STORAGE_KEY) || "{}";
  const blob = new Blob([raw], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `zafbat-sprint2-backup-${today()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  flash("Backup JSON exporté.");
}
function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      loadState();
      S.route = { name: "dashboard", projectId: null, docId: null };
      flash("Backup importé.");
    } catch (e) {
      flash("Le fichier JSON est invalide.", "error");
    }
  };
  reader.readAsText(file);
}

function resetProjectForm() {
  const ids = ["f_ref","f_nom","f_client","f_contact","f_telephone","f_email","f_adresse","f_ville","f_type","f_surface","f_budget","f_responsable","f_statut","f_dateDebut","f_dateFinPrevue","f_notes"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === "f_ville") el.value = "Casablanca";
    else if (id === "f_type") el.value = "Villa";
    else if (id === "f_statut") el.value = "Prospect";
    else el.value = "";
  });
}
function createProjectFromForm() {
  const p = baseProject();
  p.ref = document.getElementById("f_ref").value.trim();
  p.nom = document.getElementById("f_nom").value.trim();
  p.client = document.getElementById("f_client").value.trim();
  p.contact = document.getElementById("f_contact").value.trim();
  p.telephone = document.getElementById("f_telephone").value.trim().replace(/\s+/g, " ");
  p.email = document.getElementById("f_email").value.trim();
  p.adresse = document.getElementById("f_adresse").value.trim();
  p.ville = document.getElementById("f_ville").value.trim() || "Casablanca";
  p.type = document.getElementById("f_type").value.trim() || "Villa";
  p.surface = document.getElementById("f_surface").value.trim() === "" ? "" : safeNum(document.getElementById("f_surface").value, 0);
  p.budget = document.getElementById("f_budget").value.trim() === "" ? 0 : safeNum(document.getElementById("f_budget").value, 0);
  p.responsable = document.getElementById("f_responsable").value.trim();
  p.statut = document.getElementById("f_statut").value;
  p.dateDebut = document.getElementById("f_dateDebut").value;
  p.dateFinPrevue = document.getElementById("f_dateFinPrevue").value;
  p.notes = document.getElementById("f_notes").value.trim();

  if (!p.ref || !p.nom || !p.client) { flash("Référence, nom du projet et client sont obligatoires.", "error"); return; }
  if (S.projects.some((x) => x.ref.toLowerCase() === p.ref.toLowerCase())) { flash("La référence projet doit être unique.", "error"); return; }
  if (!validateEmail(p.email)) { flash("L’adresse email n’est pas valide.", "error"); return; }
  if (safeNum(p.budget, 0) < 0 || (p.surface !== "" && safeNum(p.surface, 0) < 0)) { flash("Budget et surface doivent être positifs.", "error"); return; }

  S.projects.unshift(p);
  saveState();
  resetProjectForm();
  flash("Projet créé.");
}
function setRoute(name, projectId = null, docId = null) { S.route = { name, projectId, docId }; saveState(); render(); }

function filteredProjects() {
  let items = [...S.projects];
  const q = S.filters.search.trim().toLowerCase();
  if (q) items = items.filter((p) => [p.ref, p.nom, p.client].some((v) => String(v || "").toLowerCase().includes(q)));
  if (S.filters.status !== "all") items = items.filter((p) => p.statut === S.filters.status);
  if (S.filters.sort === "updated_desc") items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  else if (S.filters.sort === "updated_asc") items.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
  else if (S.filters.sort === "budget_desc") items.sort((a, b) => safeNum(b.budget, 0) - safeNum(a.budget, 0));
  else if (S.filters.sort === "budget_asc") items.sort((a, b) => safeNum(a.budget, 0) - safeNum(b.budget, 0));
  return items;
}
function dashboardStats() {
  const active = S.projects.filter((p) => !["Terminé","Perdu"].includes(p.statut)).length;
  const lastSaved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")?.savedAt || null;
  return { totalProjects: S.projects.length, activeProjects: active, totalDocuments: S.documents.length, lastSaved };
}
function updateSearch(v) { S.filters.search = v; saveState(); render(); }
function updateStatusFilter(v) { S.filters.status = v; saveState(); render(); }
function updateSort(v) { S.filters.sort = v; saveState(); render(); }
function focusNewProject() { const el = document.getElementById("new-project-card"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); setTimeout(() => document.getElementById("f_ref")?.focus(), 180); }

function saveProjectEdits(projectId) {
  const project = projectById(projectId);
  if (!project) { flash("Projet introuvable.", "error"); return; }
  const candidate = structuredClone(project);
  candidate.ref = document.getElementById("e_ref").value.trim();
  candidate.nom = document.getElementById("e_nom").value.trim();
  candidate.client = document.getElementById("e_client").value.trim();
  candidate.contact = document.getElementById("e_contact").value.trim();
  candidate.telephone = document.getElementById("e_telephone").value.trim().replace(/\s+/g, " ");
  candidate.email = document.getElementById("e_email").value.trim();
  candidate.adresse = document.getElementById("e_adresse").value.trim();
  candidate.ville = document.getElementById("e_ville").value.trim();
  candidate.type = document.getElementById("e_type").value.trim();
  candidate.surface = document.getElementById("e_surface").value.trim() === "" ? "" : safeNum(document.getElementById("e_surface").value, 0);
  candidate.budget = document.getElementById("e_budget").value.trim() === "" ? 0 : safeNum(document.getElementById("e_budget").value, 0);
  candidate.responsable = document.getElementById("e_responsable").value.trim();
  candidate.statut = document.getElementById("e_statut").value;
  candidate.dateDebut = document.getElementById("e_dateDebut").value;
  candidate.dateFinPrevue = document.getElementById("e_dateFinPrevue").value;
  candidate.notes = document.getElementById("e_notes").value.trim();

  if (!candidate.ref || !candidate.nom || !candidate.client) { flash("Référence, nom du projet et client sont obligatoires.", "error"); return; }
  if (S.projects.some((x) => x.id !== projectId && x.ref.toLowerCase() === candidate.ref.toLowerCase())) { flash("La référence projet doit rester unique.", "error"); return; }
  if (!validateEmail(candidate.email)) { flash("L’adresse email n’est pas valide.", "error"); return; }

  candidate.updatedAt = nowISO();
  S.projects = S.projects.map((x) => x.id === projectId ? candidate : x);
  S.documents = S.documents.map((d) => d.projectId === projectId ? { ...d, projectName: candidate.nom, updatedAt: nowISO() } : d);
  saveState();
  flash("Projet mis à jour.");
}
function deleteProject(projectId) {
  const p = projectById(projectId);
  if (!p) return;
  if (!confirm(`Supprimer le projet "${p.ref} — ${p.nom}" et ses documents liés ?`)) return;
  S.projects = S.projects.filter((x) => x.id !== projectId);
  S.documents = S.documents.filter((x) => x.projectId !== projectId);
  Object.keys(S.drafts).forEach((k) => { if (k.includes(`:${projectId}:`)) delete S.drafts[k]; });
  S.route = { name: "dashboard", projectId: null, docId: null };
  saveState();
  flash("Projet supprimé.");
}
function exportSingleProject(projectId) {
  const p = projectById(projectId);
  if (!p) return;
  const payload = { project: p, documents: docsForProject(projectId), exportedAt: nowISO(), version: 2 };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${p.ref || "projet"}-export.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  flash("Projet exporté.");
}

function editorKey(type, projectId, docId = "new") { return `${type}:${projectId}:${docId || "new"}`; }

function openNewDoc(type, projectId) {
  const project = projectById(projectId);
  if (!project) { flash("Projet introuvable.", "error"); return; }
  const key = editorKey(type, projectId, "new");
  if (!S.drafts[key]) {
    S.drafts[key] = { type, projectId, docId: null, data: type === "audit" ? makeAuditDraft(project) : type === "cr" ? makeCRDraft(project) : makeDevisDraft(project), updatedAt: nowISO() };
  }
  saveState();
  setRoute(type, projectId, null);
}
function editDocument(docId) {
  const doc = documentById(docId);
  if (!doc) { flash("Document introuvable.", "error"); return; }
  const key = editorKey(doc.type, doc.projectId, doc.id);
  if (!S.drafts[key]) {
    S.drafts[key] = { type: doc.type, projectId: doc.projectId, docId: doc.id, data: structuredClone(doc.sourceData), updatedAt: nowISO() };
  }
  saveState();
  setRoute(doc.type, doc.projectId, doc.id);
}
function previewDocument(docId) {
  const doc = documentById(docId);
  if (!doc) return;
  S.ui.previewDocId = docId;
  saveState();
  render();
}
function clearPreview() { S.ui.previewDocId = null; saveState(); render(); }

function currentEditor() {
  if (!["audit","cr","devis"].includes(S.route.name) || !S.route.projectId) return null;
  const key = editorKey(S.route.name, S.route.projectId, S.route.docId || "new");
  return { key, draft: S.drafts[key] || null };
}
function ensureEditorDraft() {
  if (!["audit","cr","devis"].includes(S.route.name) || !S.route.projectId) return;
  const key = editorKey(S.route.name, S.route.projectId, S.route.docId || "new");
  if (S.drafts[key]) return;
  const project = projectById(S.route.projectId);
  if (!project) return;
  if (S.route.docId) {
    const doc = documentById(S.route.docId);
    if (doc) S.drafts[key] = { type: doc.type, projectId: doc.projectId, docId: doc.id, data: structuredClone(doc.sourceData), updatedAt: nowISO() };
  } else {
    S.drafts[key] = { type: S.route.name, projectId: S.route.projectId, docId: null, data: S.route.name === "audit" ? makeAuditDraft(project) : S.route.name === "cr" ? makeCRDraft(project) : makeDevisDraft(project), updatedAt: nowISO() };
  }
  saveState();
}
function updateDraftField(path, value) {
  const ctx = currentEditor();
  if (!ctx || !ctx.draft) return;
  setByPath(ctx.draft.data, path, value);
  ctx.draft.updatedAt = nowISO();
  saveState();
  render();
}
function setByPath(obj, path, value) {
  const parts = path.split(".");
  let ref = obj;
  for (let i = 0; i < parts.length - 1; i++) ref = ref[parts[i]];
  ref[parts[parts.length - 1]] = value;
}
function draftData() { return currentEditor()?.draft?.data || null; }

function addDraftItem(kind) {
  const data = draftData();
  if (!data) return;
  if (kind === "anomaly") data.anomalies.push(newAnomaly());
  if (kind === "travail") data.travaux.push(newTravail());
  if (kind === "facture") data.factures.push(newFacture());
  if (kind === "ligne") data.lignes.push(newDevisLine());
  touchDraft();
}
function removeDraftItem(listName, id) {
  const data = draftData();
  if (!data) return;
  data[listName] = data[listName].filter((x) => x.id !== id);
  touchDraft();
}
function touchDraft() {
  const ctx = currentEditor();
  if (!ctx || !ctx.draft) return;
  if (ctx.draft.type === "audit") recomputeAuditTotals(ctx.draft.data);
  ctx.draft.data.updatedAt = nowISO();
  ctx.draft.updatedAt = nowISO();
  saveState();
  render();
}
function recomputeAuditTotals(audit) {
  audit.coutTotal = audit.anomalies.reduce((s, x) => s + safeNum(x.cout, 0), 0);
}
function devisTotals(d) {
  const ht = d.lignes.reduce((s, x) => s + safeNum(x.quantite, 0) * safeNum(x.prixUnitaire, 0), 0);
  const remiseMontant = ht * (safeNum(d.remise, 0) / 100);
  const base = ht - remiseMontant;
  const tvaMontant = base * (safeNum(d.tva, 0) / 100);
  const ttc = base + tvaMontant;
  return { ht, remiseMontant, base, tvaMontant, ttc };
}
function buildDocumentFromDraft(type, project, data, existingDoc) {
  const version = existingDoc ? existingDoc.version : docsForProject(project.id).filter((d) => d.type === type).length + 1;
  const prefixes = { audit: "AUD", cr: "CR", devis: "DEV" };
  const base = {
    id: existingDoc ? existingDoc.id : uid("doc"),
    type,
    projectId: project.id,
    projectName: project.nom,
    documentRef: existingDoc ? existingDoc.documentRef : `${prefixes[type]}-${project.ref}-V${version}`,
    name: existingDoc ? existingDoc.name : `${docTypeLabel(type)} — ${project.nom}`,
    version,
    status: data.status || "brouillon",
    sourceData: structuredClone(data),
    htmlPreview: type === "audit" ? auditHTML(data) : type === "cr" ? crHTML(data) : devisHTML(data),
    createdAt: existingDoc ? existingDoc.createdAt : nowISO(),
    updatedAt: nowISO(),
    schemaVersion: 2,
  };
  if (type === "audit") base.summary = { anomalies: data.anomalies.length, coutTotal: data.coutTotal || 0 };
  if (type === "cr") base.summary = { travaux: data.travaux.length, factures: data.factures.length };
  if (type === "devis") base.summary = devisTotals(data);
  return base;
}
function saveCurrentDocument() {
  const ctx = currentEditor();
  if (!ctx || !ctx.draft) return;
  const project = projectById(ctx.draft.projectId);
  if (!project) { flash("Projet introuvable.", "error"); return; }
  const data = ctx.draft.data;
  if (!data.projet || !data.client) { flash("Projet et client sont obligatoires.", "error"); return; }
  let existing = ctx.draft.docId ? documentById(ctx.draft.docId) : null;
  const built = buildDocumentFromDraft(ctx.draft.type, project, data, existing);
  if (existing) S.documents = S.documents.map((d) => d.id === existing.id ? built : d);
  else S.documents.unshift(built);
  project.updatedAt = nowISO();
  delete S.drafts[ctx.key];
  saveState();
  S.ui.previewDocId = built.id;
  setRoute("project", project.id, null);
  flash(`${docTypeLabel(ctx.draft.type)} enregistré.`);
}
function cancelEditor() {
  const ctx = currentEditor();
  if (!ctx) return;
  if (!confirm("Quitter l’éditeur ? Le brouillon reste sauvegardé localement.")) return;
  setRoute("project", ctx.draft.projectId, null);
}
function resetCurrentDraft() {
  const ctx = currentEditor();
  if (!ctx || !ctx.draft) return;
  const project = projectById(ctx.draft.projectId);
  if (!project) return;
  if (!confirm("Réinitialiser ce brouillon ?")) return;
  ctx.draft.data = ctx.draft.type === "audit" ? makeAuditDraft(project) : ctx.draft.type === "cr" ? makeCRDraft(project) : makeDevisDraft(project);
  ctx.draft.updatedAt = nowISO();
  saveState();
  render();
}

function projectFormHTML() {
  return `
    <div class="grid grid-2">
      <div class="field"><label>Référence projet *</label><input id="f_ref" placeholder="ZB-2026-003" /></div>
      <div class="field"><label>Nom du projet *</label><input id="f_nom" placeholder="Villa Anfa" /></div>
      <div class="field"><label>Client *</label><input id="f_client" placeholder="Nom du client" /></div>
      <div class="field"><label>Contact</label><input id="f_contact" placeholder="Contact principal" /></div>
      <div class="field"><label>Téléphone</label><input id="f_telephone" placeholder="+212 ..." /></div>
      <div class="field"><label>Email</label><input id="f_email" type="email" placeholder="client@email.com" /></div>
      <div class="field"><label>Adresse</label><input id="f_adresse" placeholder="Adresse chantier" /></div>
      <div class="field"><label>Ville</label><input id="f_ville" value="Casablanca" /></div>
      <div class="field"><label>Type</label><input id="f_type" value="Villa" /></div>
      <div class="field"><label>Surface (m²)</label><input id="f_surface" type="number" min="0" /></div>
      <div class="field"><label>Budget (MAD)</label><input id="f_budget" type="number" min="0" step="0.01" /></div>
      <div class="field"><label>Responsable</label><input id="f_responsable" placeholder="Chef de projet" /></div>
      <div class="field"><label>Statut</label><select id="f_statut"><option>Prospect</option><option>En étude</option><option>En cours</option><option>Terminé</option><option>Perdu</option><option>Suspendu</option></select></div>
      <div class="field"><label>Date début</label><input id="f_dateDebut" type="date" /></div>
      <div class="field"><label>Date fin prévue</label><input id="f_dateFinPrevue" type="date" /></div>
      <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea id="f_notes" placeholder="Contexte, contraintes, remarques"></textarea></div>
    </div>
    <div class="toolbar" style="margin-top:14px">
      <button class="btn-primary" onclick="createProjectFromForm()">Créer</button>
      <button class="btn-ghost" onclick="resetProjectForm()">Reset</button>
    </div>
  `;
}
function projectEditFormHTML(p) {
  return `
    <div class="grid grid-2">
      <div class="field"><label>Référence projet *</label><input id="e_ref" value="${esc(p.ref)}" /></div>
      <div class="field"><label>Nom du projet *</label><input id="e_nom" value="${esc(p.nom)}" /></div>
      <div class="field"><label>Client *</label><input id="e_client" value="${esc(p.client)}" /></div>
      <div class="field"><label>Contact</label><input id="e_contact" value="${esc(p.contact || "")}" /></div>
      <div class="field"><label>Téléphone</label><input id="e_telephone" value="${esc(p.telephone || "")}" /></div>
      <div class="field"><label>Email</label><input id="e_email" type="email" value="${esc(p.email || "")}" /></div>
      <div class="field"><label>Adresse</label><input id="e_adresse" value="${esc(p.adresse || "")}" /></div>
      <div class="field"><label>Ville</label><input id="e_ville" value="${esc(p.ville || "")}" /></div>
      <div class="field"><label>Type</label><input id="e_type" value="${esc(p.type || "")}" /></div>
      <div class="field"><label>Surface (m²)</label><input id="e_surface" type="number" min="0" value="${esc(p.surface ?? "")}" /></div>
      <div class="field"><label>Budget (MAD)</label><input id="e_budget" type="number" min="0" step="0.01" value="${esc(p.budget ?? 0)}" /></div>
      <div class="field"><label>Responsable</label><input id="e_responsable" value="${esc(p.responsable || "")}" /></div>
      <div class="field"><label>Statut</label><select id="e_statut">${["Prospect","En étude","En cours","Terminé","Perdu","Suspendu"].map(v => `<option ${p.statut === v ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></div>
      <div class="field"><label>Date début</label><input id="e_dateDebut" type="date" value="${esc(p.dateDebut || "")}" /></div>
      <div class="field"><label>Date fin prévue</label><input id="e_dateFinPrevue" type="date" value="${esc(p.dateFinPrevue || "")}" /></div>
      <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea id="e_notes">${esc(p.notes || "")}</textarea></div>
    </div>
    <div class="toolbar" style="margin-top:14px">
      <button class="btn-primary" onclick="saveProjectEdits('${p.id}')">Enregistrer</button>
      <button class="btn-ghost" onclick="render()">Annuler modifications</button>
    </div>
  `;
}
function flashHTML() {
  if (!S.flash) return "";
  return `<div class="flash ${esc(S.flash.kind || "info")}">${esc(S.flash.message)}</div>`;
}
function docTypeLabel(type) {
  if (type === "audit") return "Audit";
  if (type === "cr") return "CR";
  if (type === "devis") return "Devis";
  return type;
}

function dashboardHTML() {
  const stats = dashboardStats();
  const items = filteredProjects();
  return `
    ${flashHTML()}
    <div class="topbar">
      <div><h2>Tableau de bord</h2><p>Projets, documents et modules complets Audit / CR / Devis.</p></div>
      <div class="top-actions">
        <button class="btn-secondary" onclick="exportBackup()">Exporter JSON</button>
        <label class="btn-secondary" style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;">Importer JSON<input type="file" accept="application/json" style="display:none" onchange="importBackup(event)" /></label>
        <button class="btn-primary" onclick="focusNewProject()">Nouveau projet</button>
      </div>
    </div>

    <div class="grid grid-4">
      <div class="kpi"><div class="label">Projets</div><div class="value">${stats.totalProjects}</div></div>
      <div class="kpi"><div class="label">Projets actifs</div><div class="value">${stats.activeProjects}</div></div>
      <div class="kpi"><div class="label">Documents</div><div class="value">${stats.totalDocuments}</div></div>
      <div class="kpi"><div class="label">Dernière sauvegarde</div><div class="value" style="font-size:1rem">${stats.lastSaved ? esc(relativeDateLabel(stats.lastSaved)) : "—"}</div></div>
    </div>

    <div class="grid grid-2" style="margin-top:18px">
      <div class="card">
        <div class="section-head"><h3>Projets</h3><span class="muted small">${items.length} résultat(s)</span></div>
        <div class="row" style="margin-bottom:14px">
          <div class="field"><label>Recherche</label><input value="${esc(S.filters.search)}" oninput="updateSearch(this.value)" placeholder="Réf, projet, client" /></div>
          <div class="field"><label>Statut</label><select onchange="updateStatusFilter(this.value)">${["all","Prospect","En étude","En cours","Terminé","Perdu","Suspendu"].map(v => `<option ${S.filters.status === v ? "selected" : ""} value="${esc(v)}">${esc(v === "all" ? "Tous" : v)}</option>`).join("")}</select></div>
          <div class="field"><label>Tri</label><select onchange="updateSort(this.value)"><option value="updated_desc" ${S.filters.sort === "updated_desc" ? "selected" : ""}>Dernière mise à jour ↓</option><option value="updated_asc" ${S.filters.sort === "updated_asc" ? "selected" : ""}>Dernière mise à jour ↑</option><option value="budget_desc" ${S.filters.sort === "budget_desc" ? "selected" : ""}>Budget ↓</option><option value="budget_asc" ${S.filters.sort === "budget_asc" ? "selected" : ""}>Budget ↑</option></select></div>
        </div>
        ${items.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Réf</th><th>Projet</th><th>Client</th><th>Statut</th><th>Responsable</th><th>Budget</th><th>Mise à jour</th><th>Actions</th></tr></thead>
              <tbody>
                ${items.map(p => `
                  <tr>
                    <td>${esc(p.ref)}</td>
                    <td>${esc(p.nom)}</td>
                    <td>${esc(p.client)}</td>
                    <td><span class="badge ${statusClass(p.statut)}">${esc(p.statut)}</span></td>
                    <td>${esc(p.responsable || "—")}</td>
                    <td>${formatMoney(p.budget || 0)}</td>
                    <td>${esc(relativeDateLabel(p.updatedAt))}</td>
                    <td><div class="actions-inline"><button class="btn-secondary btn-small" onclick="setRoute('project','${p.id}',null)">Ouvrir</button><button class="btn-ghost btn-small" onclick="openNewDoc('devis','${p.id}')">Devis</button></div></td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>
        ` : `<div class="empty">Aucun projet trouvé avec ces filtres.</div>`}
      </div>

      <div class="card" id="new-project-card">
        <div class="section-head"><h3>Nouveau projet</h3><span class="muted small">Schéma Project v2</span></div>
        ${projectFormHTML()}
      </div>
    </div>
  `;
}

function projectPageHTML(projectId) {
  const p = projectById(projectId);
  if (!p) return `${flashHTML()}<div class="card"><div class="empty">Projet introuvable.</div><div class="toolbar" style="margin-top:14px"><button class="btn-secondary" onclick="setRoute('dashboard')">Retour dashboard</button></div></div>`;
  const docs = docsForProject(projectId);
  const preview = S.ui.previewDocId ? documentById(S.ui.previewDocId) : null;
  return `
    ${flashHTML()}
    <div class="topbar">
      <div>
        <h2>${esc(p.ref)} — ${esc(p.nom)}</h2>
        <p>${esc(p.client)} · ${esc(p.responsable || "Sans responsable")} · ${esc(p.ville || "—")}</p>
        <div class="project-header-meta">
          <span class="badge ${statusClass(p.statut)}">${esc(p.statut)}</span>
          <span class="badge neutral">Créé ${esc(relativeDateLabel(p.createdAt))}</span>
          <span class="badge neutral">Mis à jour ${esc(relativeDateLabel(p.updatedAt))}</span>
        </div>
      </div>
      <div class="top-actions">
        <button class="btn-secondary" onclick="setRoute('dashboard',null,null)">Retour dashboard</button>
        <button class="btn-secondary" onclick="exportSingleProject('${p.id}')">Exporter projet</button>
        <button class="btn-danger" onclick="deleteProject('${p.id}')">Supprimer projet</button>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="section-head"><h3>Infos projet</h3><span class="muted small">Objet central</span></div>
        ${projectEditFormHTML(p)}
      </div>
      <div class="grid">
        <div class="card" id="doc-actions-card">
          <div class="section-head"><h3>Créer un document</h3><span class="muted small">Sprint 2 opérationnel</span></div>
          <div class="toolbar">
            <button class="btn-primary" onclick="openNewDoc('audit','${p.id}')">Créer Audit</button>
            <button class="btn-secondary" onclick="openNewDoc('cr','${p.id}')">Créer CR</button>
            <button class="btn-secondary" onclick="openNewDoc('devis','${p.id}')">Créer Devis</button>
          </div>
        </div>
        <div class="card">
          <div class="section-head"><h3>Résumé</h3><span class="muted small">Vue rapide</span></div>
          <div class="stat-grid">
            <div class="stat-box"><div class="t">Budget</div><div class="v">${formatMoney(p.budget || 0)}</div></div>
            <div class="stat-box"><div class="t">Surface</div><div class="v">${p.surface === "" ? "—" : `${esc(String(p.surface))} m²`}</div></div>
            <div class="stat-box"><div class="t">Date début</div><div class="v">${esc(p.dateDebut || "—")}</div></div>
            <div class="stat-box"><div class="t">Date fin prévue</div><div class="v">${esc(p.dateFinPrevue || "—")}</div></div>
          </div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <div class="section-head"><h3>Documents du projet</h3><span class="muted small">${docs.length} document(s)</span></div>
      ${docs.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Type</th><th>Référence doc</th><th>Nom</th><th>Version</th><th>Statut</th><th>Créé</th><th>Mise à jour</th><th>Actions</th></tr></thead>
            <tbody>
              ${docs.map(d => `
                <tr>
                  <td>${esc(docTypeLabel(d.type))}</td>
                  <td>${esc(d.documentRef || "—")}</td>
                  <td>${esc(d.name || "—")}</td>
                  <td>V${esc(String(d.version || 1))}</td>
                  <td><span class="badge ${statusClass(d.status || "brouillon")}">${esc(d.status || "brouillon")}</span></td>
                  <td>${esc(relativeDateLabel(d.createdAt))}</td>
                  <td>${esc(relativeDateLabel(d.updatedAt))}</td>
                  <td><div class="actions-inline"><button class="btn-secondary btn-small" onclick="previewDocument('${d.id}')">Voir</button><button class="btn-ghost btn-small" onclick="editDocument('${d.id}')">Éditer</button></div></td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>` : `<div class="empty">Aucun document lié à ce projet pour l’instant.</div>`}
    </div>

    ${preview ? `<div class="card" style="margin-top:18px"><div class="section-head"><h3>Aperçu document</h3><div class="toolbar"><span class="muted small">${esc(preview.documentRef || preview.name)}</span><button class="btn-ghost btn-small" onclick="clearPreview()">Fermer</button></div></div><div class="doc-preview">${preview.htmlPreview || ""}</div></div>` : ``}
  `;
}

function auditHTML(a) {
  return `
    <div class="doc-head"><div><div class="doc-logo">ZAF BAT</div><div class="muted">Audit financier chantier</div></div><div class="doc-chip">Audit</div></div>
    <div class="doc-grid">
      <div class="doc-box"><div class="t">Projet</div><div class="v">${esc(a.projet || "—")}</div></div>
      <div class="doc-box"><div class="t">Client</div><div class="v">${esc(a.client || "—")}</div></div>
      <div class="doc-box"><div class="t">Phase</div><div class="v">${esc(a.phase || "—")}</div></div>
      <div class="doc-box"><div class="t">Date</div><div class="v">${esc(a.date || "—")}</div></div>
    </div>
    <div class="doc-section"><h4>Observations</h4><div class="doc-note">${esc(a.observations || "Aucune observation.")}</div></div>
    <div class="doc-section"><h4>Anomalies</h4>
      ${a.anomalies.length ? `<table class="doc-table"><thead><tr><th>Intitulé</th><th>Lot</th><th>Échéance</th><th>Coût</th></tr></thead><tbody>${a.anomalies.map(x => `<tr><td>${esc(x.titre || "")}</td><td>${esc(x.lot || "")}</td><td>${esc(x.echeance || "")}</td><td>${formatMoney(x.cout || 0)}</td></tr>`).join("")}</tbody></table>` : `<div class="doc-note">Aucune anomalie.</div>`}
    </div>
    <div class="doc-section"><h4>Synthèse</h4><div class="doc-grid"><div class="doc-box"><div class="t">Coût total</div><div class="v">${formatMoney(a.coutTotal || 0)}</div></div><div class="doc-box"><div class="t">Économie potentielle</div><div class="v">${formatMoney(a.economie || 0)}</div></div></div></div>
  `;
}
function crHTML(c) {
  const totalFactures = c.factures.reduce((s, x) => s + safeNum(x.montant, 0), 0);
  return `
    <div class="doc-head"><div><div class="doc-logo">ZAF BAT</div><div class="muted">Compte rendu chantier</div></div><div class="doc-chip">CR</div></div>
    <div class="doc-grid">
      <div class="doc-box"><div class="t">Projet</div><div class="v">${esc(c.projet || "—")}</div></div>
      <div class="doc-box"><div class="t">Client</div><div class="v">${esc(c.client || "—")}</div></div>
      <div class="doc-box"><div class="t">Semaine</div><div class="v">${esc(c.semaine || "—")}</div></div>
      <div class="doc-box"><div class="t">Phase</div><div class="v">${esc(c.phase || "—")}</div></div>
    </div>
    <div class="doc-section"><h4>Prévu</h4><div class="doc-note">${esc(c.prevu || "—")}</div></div>
    <div class="doc-section"><h4>Réel</h4><div class="doc-note">${esc(c.reel || "—")}</div></div>
    <div class="doc-section"><h4>Écart</h4><div class="doc-note">${esc(c.ecart || "—")}</div></div>
    <div class="doc-section"><h4>Travaux</h4>${c.travaux.length ? `<table class="doc-table"><thead><tr><th>Tâche</th><th>Statut</th></tr></thead><tbody>${c.travaux.map(x => `<tr><td>${esc(x.tache || "")}</td><td>${esc(x.statut || "")}</td></tr>`).join("")}</tbody></table>` : `<div class="doc-note">Aucun travail saisi.</div>`}</div>
    <div class="doc-section"><h4>Total factures</h4><div class="doc-note">${formatMoney(totalFactures)}</div></div>
    <div class="doc-section"><h4>Prochaines actions</h4><div class="doc-note">${esc(c.prochains || "—")}</div></div>
  `;
}
function devisHTML(d) {
  const t = devisTotals(d);
  return `
    <div class="doc-head"><div><div class="doc-logo">ZAF BAT</div><div class="muted">Devis / Proposition commerciale</div></div><div class="doc-chip">Devis</div></div>
    <div class="doc-grid">
      <div class="doc-box"><div class="t">Projet</div><div class="v">${esc(d.projet || "—")}</div></div>
      <div class="doc-box"><div class="t">Client</div><div class="v">${esc(d.client || "—")}</div></div>
      <div class="doc-box"><div class="t">Date</div><div class="v">${esc(d.date || "—")}</div></div>
      <div class="doc-box"><div class="t">Validité</div><div class="v">${esc(d.validite || "—")}</div></div>
    </div>
    <div class="doc-section">
      <h4>Détail</h4>
      <table class="doc-table"><thead><tr><th>Désignation</th><th>Unité</th><th>Qté</th><th>PU</th><th>Total</th></tr></thead><tbody>${d.lignes.map(x => `<tr><td>${esc(x.designation || "")}</td><td>${esc(x.unite || "")}</td><td>${safeNum(x.quantite, 0)}</td><td>${formatMoney(x.prixUnitaire || 0)}</td><td>${formatMoney(safeNum(x.quantite, 0) * safeNum(x.prixUnitaire, 0))}</td></tr>`).join("")}</tbody></table>
    </div>
    <div class="doc-section"><h4>Totaux</h4><div class="doc-grid"><div class="doc-box"><div class="t">HT</div><div class="v">${formatMoney(t.ht)}</div></div><div class="doc-box"><div class="t">Remise</div><div class="v">${formatMoney(t.remiseMontant)}</div></div><div class="doc-box"><div class="t">TVA</div><div class="v">${formatMoney(t.tvaMontant)}</div></div><div class="doc-box"><div class="t">TTC</div><div class="v">${formatMoney(t.ttc)}</div></div></div></div>
    <div class="doc-section"><h4>Conditions</h4><div class="doc-note">${esc(d.conditions || "—")}</div></div>
  `;
}

function auditEditorHTML(a) {
  return `
    <div class="grid grid-2">
      <div class="field"><label>Projet *</label><input value="${esc(a.projet)}" oninput="updateDraftField('projet', this.value)" /></div>
      <div class="field"><label>Client *</label><input value="${esc(a.client)}" oninput="updateDraftField('client', this.value)" /></div>
      <div class="field"><label>Phase</label><input value="${esc(a.phase)}" oninput="updateDraftField('phase', this.value)" /></div>
      <div class="field"><label>Date</label><input type="date" value="${esc(a.date)}" oninput="updateDraftField('date', this.value)" /></div>
      <div class="field"><label>Responsable</label><input value="${esc(a.responsable)}" oninput="updateDraftField('responsable', this.value)" /></div>
      <div class="field"><label>Statut</label><select onchange="updateDraftField('status', this.value)"><option ${a.status === "brouillon" ? "selected" : ""}>brouillon</option><option ${a.status === "final" ? "selected" : ""}>final</option></select></div>
      <div class="field" style="grid-column:1/-1"><label>Observations</label><textarea oninput="updateDraftField('observations', this.value)">${esc(a.observations)}</textarea></div>
    </div>
    <hr class="sep" />
    <div class="section-head"><h3>Anomalies</h3><button class="btn-secondary btn-small" onclick="addDraftItem('anomaly')">Ajouter</button></div>
    ${a.anomalies.length ? a.anomalies.map((x, i) => `
      <div class="item-card">
        <div class="grid grid-2">
          <div class="field"><label>Intitulé</label><input value="${esc(x.titre || "")}" oninput="updateDraftField('anomalies.${i}.titre', this.value)" /></div>
          <div class="field"><label>Lot</label><input value="${esc(x.lot || "")}" oninput="updateDraftField('anomalies.${i}.lot', this.value)" /></div>
          <div class="field"><label>Coût estimé</label><input type="number" min="0" step="0.01" value="${safeNum(x.cout, 0)}" oninput="updateDraftField('anomalies.${i}.cout', safeNum(this.value,0)); touchDraft()" /></div>
          <div class="field"><label>Échéance</label><input type="date" value="${esc(x.echeance || "")}" oninput="updateDraftField('anomalies.${i}.echeance', this.value)" /></div>
          <div class="field" style="grid-column:1/-1"><label>Détail</label><textarea oninput="updateDraftField('anomalies.${i}.detail', this.value)">${esc(x.detail || "")}</textarea></div>
        </div>
        <div class="toolbar"><button class="btn-danger btn-small" onclick="removeDraftItem('anomalies','${x.id}')">Supprimer</button></div>
      </div>`).join("") : `<div class="empty">Aucune anomalie ajoutée.</div>`}
    <hr class="sep" />
    <div class="grid grid-2">
      <div class="field"><label>Coût total</label><input type="number" value="${safeNum(a.coutTotal, 0)}" oninput="updateDraftField('coutTotal', safeNum(this.value,0))" /></div>
      <div class="field"><label>Économie potentielle</label><input type="number" value="${safeNum(a.economie, 0)}" oninput="updateDraftField('economie', safeNum(this.value,0))" /></div>
    </div>
  `;
}
function crEditorHTML(c) {
  return `
    <div class="grid grid-2">
      <div class="field"><label>Projet *</label><input value="${esc(c.projet)}" oninput="updateDraftField('projet', this.value)" /></div>
      <div class="field"><label>Client *</label><input value="${esc(c.client)}" oninput="updateDraftField('client', this.value)" /></div>
      <div class="field"><label>Semaine</label><input value="${esc(c.semaine)}" oninput="updateDraftField('semaine', this.value)" placeholder="Semaine 10" /></div>
      <div class="field"><label>Phase</label><input value="${esc(c.phase)}" oninput="updateDraftField('phase', this.value)" /></div>
      <div class="field"><label>Responsable</label><input value="${esc(c.responsable)}" oninput="updateDraftField('responsable', this.value)" /></div>
      <div class="field"><label>Statut</label><select onchange="updateDraftField('status', this.value)"><option ${c.status === "brouillon" ? "selected" : ""}>brouillon</option><option ${c.status === "final" ? "selected" : ""}>final</option></select></div>
      <div class="field" style="grid-column:1/-1"><label>Prévu</label><textarea oninput="updateDraftField('prevu', this.value)">${esc(c.prevu)}</textarea></div>
      <div class="field" style="grid-column:1/-1"><label>Réel</label><textarea oninput="updateDraftField('reel', this.value)">${esc(c.reel)}</textarea></div>
      <div class="field" style="grid-column:1/-1"><label>Écart</label><textarea oninput="updateDraftField('ecart', this.value)">${esc(c.ecart)}</textarea></div>
      <div class="field" style="grid-column:1/-1"><label>Prochaines actions</label><textarea oninput="updateDraftField('prochains', this.value)">${esc(c.prochains)}</textarea></div>
      <div class="field" style="grid-column:1/-1"><label>Décisions</label><textarea oninput="updateDraftField('decisions', this.value)">${esc(c.decisions)}</textarea></div>
    </div>
    <hr class="sep" />
    <div class="section-head"><h3>Travaux</h3><button class="btn-secondary btn-small" onclick="addDraftItem('travail')">Ajouter</button></div>
    ${c.travaux.length ? c.travaux.map((x, i) => `
      <div class="item-card">
        <div class="grid grid-2">
          <div class="field"><label>Tâche</label><input value="${esc(x.tache || "")}" oninput="updateDraftField('travaux.${i}.tache', this.value)" /></div>
          <div class="field"><label>Statut</label><input value="${esc(x.statut || "")}" oninput="updateDraftField('travaux.${i}.statut', this.value)" /></div>
        </div>
        <div class="toolbar"><button class="btn-danger btn-small" onclick="removeDraftItem('travaux','${x.id}')">Supprimer</button></div>
      </div>`).join("") : `<div class="empty">Aucun travail listé.</div>`}
    <hr class="sep" />
    <div class="section-head"><h3>Factures</h3><button class="btn-secondary btn-small" onclick="addDraftItem('facture')">Ajouter</button></div>
    ${c.factures.length ? c.factures.map((x, i) => `
      <div class="item-card">
        <div class="grid grid-2">
          <div class="field"><label>N° facture</label><input value="${esc(x.numero || "")}" oninput="updateDraftField('factures.${i}.numero', this.value)" /></div>
          <div class="field"><label>Montant</label><input type="number" min="0" step="0.01" value="${safeNum(x.montant, 0)}" oninput="updateDraftField('factures.${i}.montant', safeNum(this.value,0))" /></div>
        </div>
        <div class="toolbar"><button class="btn-danger btn-small" onclick="removeDraftItem('factures','${x.id}')">Supprimer</button></div>
      </div>`).join("") : `<div class="empty">Aucune facture listée.</div>`}
  `;
}
function devisEditorHTML(d) {
  const t = devisTotals(d);
  return `
    <div class="grid grid-2">
      <div class="field"><label>Projet *</label><input value="${esc(d.projet)}" oninput="updateDraftField('projet', this.value)" /></div>
      <div class="field"><label>Client *</label><input value="${esc(d.client)}" oninput="updateDraftField('client', this.value)" /></div>
      <div class="field"><label>Date</label><input type="date" value="${esc(d.date)}" oninput="updateDraftField('date', this.value)" /></div>
      <div class="field"><label>Validité</label><input value="${esc(d.validite)}" oninput="updateDraftField('validite', this.value)" /></div>
      <div class="field"><label>TVA %</label><input type="number" min="0" step="0.01" value="${safeNum(d.tva, 20)}" oninput="updateDraftField('tva', safeNum(this.value,20))" /></div>
      <div class="field"><label>Remise %</label><input type="number" min="0" step="0.01" value="${safeNum(d.remise, 0)}" oninput="updateDraftField('remise', safeNum(this.value,0))" /></div>
      <div class="field"><label>Statut</label><select onchange="updateDraftField('status', this.value)"><option ${d.status === "brouillon" ? "selected" : ""}>brouillon</option><option ${d.status === "final" ? "selected" : ""}>final</option></select></div>
      <div class="field"><label>Responsable</label><input value="${esc(d.responsable)}" oninput="updateDraftField('responsable', this.value)" /></div>
      <div class="field" style="grid-column:1/-1"><label>Conditions</label><textarea oninput="updateDraftField('conditions', this.value)">${esc(d.conditions)}</textarea></div>
      <div class="field" style="grid-column:1/-1"><label>Notes</label><textarea oninput="updateDraftField('notes', this.value)">${esc(d.notes)}</textarea></div>
    </div>
    <hr class="sep" />
    <div class="section-head"><h3>Lignes</h3><button class="btn-secondary btn-small" onclick="addDraftItem('ligne')">Ajouter</button></div>
    ${d.lignes.map((x, i) => `
      <div class="item-card">
        <div class="grid grid-3">
          <div class="field"><label>Désignation</label><input value="${esc(x.designation || "")}" oninput="updateDraftField('lignes.${i}.designation', this.value)" /></div>
          <div class="field"><label>Unité</label><input value="${esc(x.unite || "u")}" oninput="updateDraftField('lignes.${i}.unite', this.value)" /></div>
          <div class="field"><label>Quantité</label><input type="number" min="0" step="0.01" value="${safeNum(x.quantite, 1)}" oninput="updateDraftField('lignes.${i}.quantite', safeNum(this.value,0))" /></div>
          <div class="field"><label>Prix unitaire</label><input type="number" min="0" step="0.01" value="${safeNum(x.prixUnitaire, 0)}" oninput="updateDraftField('lignes.${i}.prixUnitaire', safeNum(this.value,0))" /></div>
          <div class="field"><label>Total ligne</label><input value="${formatMoney(safeNum(x.quantite,0)*safeNum(x.prixUnitaire,0))}" disabled /></div>
        </div>
        <div class="toolbar"><button class="btn-danger btn-small" onclick="removeDraftItem('lignes','${x.id}')">Supprimer</button></div>
      </div>`).join("")}
    <hr class="sep" />
    <div class="grid grid-2">
      <div class="stat-box"><div class="t">HT</div><div class="v">${formatMoney(t.ht)}</div></div>
      <div class="stat-box"><div class="t">TTC</div><div class="v">${formatMoney(t.ttc)}</div></div>
    </div>
  `;
}

function editorPageHTML(type, projectId, docId) {
  ensureEditorDraft();
  const ctx = currentEditor();
  if (!ctx || !ctx.draft) return `${flashHTML()}<div class="card"><div class="empty">Brouillon introuvable.</div></div>`;
  const project = projectById(projectId);
  const data = ctx.draft.data;
  const title = docId ? `Éditer ${docTypeLabel(type)}` : `Nouveau ${docTypeLabel(type)}`;
  const preview = type === "audit" ? auditHTML(data) : type === "cr" ? crHTML(data) : devisHTML(data);
  return `
    ${flashHTML()}
    <div class="topbar">
      <div><h2>${title}</h2><p>${esc(project?.ref || "")} · ${esc(project?.nom || "")} · brouillon local sauvegardé</p></div>
      <div class="top-actions">
        <button class="btn-secondary" onclick="cancelEditor()">Retour projet</button>
        <button class="btn-ghost" onclick="resetCurrentDraft()">Réinitialiser</button>
        <button class="btn-primary" onclick="saveCurrentDocument()">Enregistrer</button>
      </div>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <div class="section-head"><h3>Éditeur</h3><span class="muted small">${esc(docTypeLabel(type))}</span></div>
        ${type === "audit" ? auditEditorHTML(data) : type === "cr" ? crEditorHTML(data) : devisEditorHTML(data)}
      </div>
      <div class="card">
        <div class="section-head"><h3>Aperçu</h3><span class="muted small">${esc(data.status || "brouillon")}</span></div>
        <div class="doc-preview">${preview}</div>
      </div>
    </div>
  `;
}

function layout(inner) {
  return `
    <div class="page">
      <aside class="sidebar">
        <div class="brand"><div class="brand-badge">ZB</div><div class="brand-copy"><h1>ZAF BAT</h1><p>Sprint 2 — JS statique</p></div></div>
        <div class="nav">
          <button class="${S.route.name === "dashboard" ? "active" : ""}" onclick="setRoute('dashboard',null,null)">Tableau de bord</button>
          <button class="${S.route.name === "project" ? "active" : ""}" onclick="${S.route.projectId ? `setRoute('project','${S.route.projectId}',null)` : `setRoute('dashboard',null,null)`}">Fiche projet</button>
          <button class="${["audit","cr","devis"].includes(S.route.name) ? "active" : ""}" onclick="${S.route.projectId ? `setRoute('project','${S.route.projectId}',null)` : `setRoute('dashboard',null,null)`}">Documents</button>
        </div>
        <div class="sidebar-note">GitHub Pages friendly. Sprint 2 ajoute les vrais modules Audit, CR et Devis avec aperçu live, sauvegarde locale et rattachement au projet.</div>
      </aside>
      <main class="main">${inner}</main>
    </div>
  `;
}

let flashTimeout = null;
function render() {
  if (flashTimeout) clearTimeout(flashTimeout);
  const app = document.getElementById("app");
  let inner = "";
  if (S.route.name === "project" && S.route.projectId) inner = projectPageHTML(S.route.projectId);
  else if (["audit","cr","devis"].includes(S.route.name) && S.route.projectId) inner = editorPageHTML(S.route.name, S.route.projectId, S.route.docId);
  else inner = dashboardHTML();
  app.innerHTML = layout(inner);
  if (S.flash) {
    flashTimeout = setTimeout(() => { S.flash = null; render(); }, 3200);
  }
}

window.createProjectFromForm = createProjectFromForm;
window.resetProjectForm = resetProjectForm;
window.updateSearch = updateSearch;
window.updateStatusFilter = updateStatusFilter;
window.updateSort = updateSort;
window.focusNewProject = focusNewProject;
window.setRoute = setRoute;
window.importBackup = importBackup;
window.exportBackup = exportBackup;
window.saveProjectEdits = saveProjectEdits;
window.deleteProject = deleteProject;
window.exportSingleProject = exportSingleProject;
window.openNewDoc = openNewDoc;
window.editDocument = editDocument;
window.previewDocument = previewDocument;
window.clearPreview = clearPreview;
window.updateDraftField = updateDraftField;
window.addDraftItem = addDraftItem;
window.removeDraftItem = removeDraftItem;
window.touchDraft = touchDraft;
window.saveCurrentDocument = saveCurrentDocument;
window.cancelEditor = cancelEditor;
window.resetCurrentDraft = resetCurrentDraft;

loadState();
render();
