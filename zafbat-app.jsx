import { useState, useRef } from "react";

const G = "#06402B", GOLD = "#D3A357", DARK = "#141414", GRAY = "#6B7280", IVORY = "#F7F5F0", BORDER = "#E4DDD3";

const css = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,600;1,300&family=Jost:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--g:#06402B;--gold:#D3A357;--dark:#141414;--gray:#6B7280;--ivory:#F7F5F0;--border:#E4DDD3;--r:14px;--shadow:0 8px 24px rgba(20,20,20,.08)}
body{font-family:'Jost',sans-serif;background:var(--ivory);color:var(--dark);-webkit-font-smoothing:antialiased}
button{cursor:pointer;font-family:'Jost',sans-serif}
input,textarea,select{font-family:'Jost',sans-serif}

/* APP SHELL */
.app{min-height:100vh;display:flex;flex-direction:column}
.topbar{background:var(--dark);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.topbar-logo{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:600;color:white;letter-spacing:.5px}
.topbar-logo span{color:var(--gold)}
.topbar-back{background:none;border:1px solid rgba(255,255,255,.15);color:rgba(255,255,255,.7);padding:7px 14px;border-radius:8px;font-size:13px;display:flex;align-items:center;gap:6px;transition:.15s}
.topbar-back:hover{border-color:var(--gold);color:var(--gold)}

/* HOME */
.home{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px;gap:40px}
.home-title{text-align:center}
.home-title h1{font-family:'Cormorant Garamond',serif;font-size:clamp(32px,6vw,52px);font-weight:300;line-height:1.1;margin-bottom:8px}
.home-title h1 em{color:var(--gold);font-style:italic}
.home-title p{color:var(--gray);font-size:14px;letter-spacing:.5px}
.home-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;width:100%;max-width:640px}
.home-card{background:white;border:1px solid var(--border);border-radius:18px;padding:32px 28px;cursor:pointer;transition:.2s;text-align:left;display:flex;flex-direction:column;gap:16px;box-shadow:var(--shadow);position:relative;overflow:hidden}
.home-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--g),transparent)}
.home-card:hover{transform:translateY(-3px);box-shadow:0 16px 40px rgba(20,20,20,.12);border-color:var(--g)}
.home-card-icon{width:44px;height:44px;background:rgba(6,64,43,.08);border-radius:10px;display:flex;align-items:center;justify-content:center}
.home-card-num{font-family:'Cormorant Garamond',serif;font-size:13px;color:var(--gold);font-weight:600;letter-spacing:2px;text-transform:uppercase}
.home-card-title{font-size:18px;font-weight:600;line-height:1.3}
.home-card-desc{font-size:13px;color:var(--gray);line-height:1.6}
.home-card-arrow{font-size:20px;color:var(--g);margin-top:auto;align-self:flex-end}

/* FORM SHELL */
.form-shell{flex:1;display:flex;flex-direction:column;max-width:720px;margin:0 auto;width:100%;padding:24px 20px 48px}
.form-progress{display:flex;align-items:center;gap:8px;margin-bottom:32px}
.form-step{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;transition:.2s;border:1.5px solid var(--border);background:white;color:var(--gray);flex-shrink:0}
.form-step.active{background:var(--g);border-color:var(--g);color:white}
.form-step.done{background:var(--g);border-color:var(--g);color:white}
.form-step-line{flex:1;height:1.5px;background:var(--border);transition:.2s}
.form-step-line.done{background:var(--g)}
.form-section-title{font-family:'Cormorant Garamond',serif;font-size:26px;font-weight:600;margin-bottom:6px}
.form-section-sub{font-size:13px;color:var(--gray);margin-bottom:28px}
.form-group{margin-bottom:18px}
.form-label{font-size:12px;font-weight:500;letter-spacing:.8px;text-transform:uppercase;color:var(--gray);margin-bottom:6px;display:block}
.form-input{width:100%;border:1.5px solid var(--border);border-radius:10px;padding:11px 14px;font-size:15px;background:white;color:var(--dark);transition:.15s;outline:none}
.form-input:focus{border-color:var(--g);box-shadow:0 0 0 3px rgba(6,64,43,.08)}
.form-textarea{width:100%;border:1.5px solid var(--border);border-radius:10px;padding:11px 14px;font-size:15px;background:white;color:var(--dark);transition:.15s;outline:none;resize:vertical;min-height:80px}
.form-textarea:focus{border-color:var(--g);box-shadow:0 0 0 3px rgba(6,64,43,.08)}
.form-select{width:100%;border:1.5px solid var(--border);border-radius:10px;padding:11px 14px;font-size:15px;background:white;color:var(--dark);transition:.15s;outline:none;appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236B7280' stroke-width='1.5' fill='none'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 14px center}
.form-select:focus{border-color:var(--g)}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:520px){.form-row{grid-template-columns:1fr}}
.form-card{background:white;border:1.5px solid var(--border);border-radius:14px;padding:20px;margin-bottom:16px}
.form-card-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.form-card-num{font-family:'Cormorant Garamond',serif;font-size:28px;font-weight:600;color:var(--gold)}
.sev-pills{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}
.sev-pill{padding:6px 14px;border-radius:20px;font-size:12px;font-weight:500;border:1.5px solid var(--border);background:white;cursor:pointer;transition:.15s;color:var(--gray)}
.sev-pill.urgent{border-color:#DC2626;color:#DC2626;background:#FEF2F2}
.sev-pill.surveiller{border-color:#EA580C;color:#EA580C;background:#FFF7ED}
.sev-pill.informatif{border-color:var(--gray);color:var(--gray);background:#F9FAFB}
.sev-pill.selected{font-weight:600;box-shadow:0 0 0 2px currentColor}
.add-btn{background:none;border:1.5px dashed var(--border);border-radius:10px;padding:12px;width:100%;font-size:14px;color:var(--gray);transition:.15s;margin-bottom:24px}
.add-btn:hover{border-color:var(--g);color:var(--g);background:rgba(6,64,43,.04)}
.form-actions{display:flex;gap:12px;margin-top:32px}
.btn-primary{flex:1;background:var(--g);color:white;border:none;padding:14px 24px;border-radius:12px;font-size:15px;font-weight:500;transition:.2s}
.btn-primary:hover{background:#085235}
.btn-secondary{background:white;color:var(--dark);border:1.5px solid var(--border);padding:14px 24px;border-radius:12px;font-size:15px;font-weight:500;transition:.2s}
.btn-secondary:hover{border-color:var(--dark)}
.btn-generate{width:100%;background:var(--gold);color:var(--dark);border:none;padding:16px 24px;border-radius:12px;font-size:16px;font-weight:600;margin-top:24px;transition:.2s;display:flex;align-items:center;justify-content:center;gap:10px}
.btn-generate:hover{background:#C6943F}

/* SÉVÉRITÉ BADGE */
.badge-urgent{color:#DC2626;font-weight:600}
.badge-surveiller{color:#EA580C;font-weight:600}
.badge-informatif{color:var(--gray);font-weight:500}

/* PRINT PREVIEW MODAL */
.modal-overlay{position:fixed;inset:0;background:rgba(20,20,20,.6);z-index:200;display:flex;flex-direction:column;overflow-y:auto}
.modal-bar{background:var(--dark);padding:14px 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10;flex-shrink:0}
.modal-bar-title{font-family:'Cormorant Garamond',serif;font-size:18px;color:white;font-weight:600}
.modal-actions{display:flex;gap:10px}
.btn-print{background:var(--gold);color:var(--dark);border:none;padding:10px 20px;border-radius:8px;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px;cursor:pointer;transition:.15s}
.btn-print:hover{background:#C6943F}
.btn-close-modal{background:none;border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.7);padding:10px 16px;border-radius:8px;font-size:14px;cursor:pointer;transition:.15s}
.btn-close-modal:hover{border-color:var(--gold);color:var(--gold)}
.modal-content{background:white;margin:20px auto;width:min(794px,calc(100%-32px));border-radius:4px;overflow:hidden}

/* PDF DOCUMENT STYLES */
.pdf-doc{background:white;font-family:'Jost',sans-serif;font-size:14px;color:#1A1A1A;line-height:1.5}
.pdf-cover{background:#06402B;padding:52px 48px 40px;position:relative}
.pdf-cover-logo{font-family:'Cormorant Garamond',serif;font-size:42px;font-weight:600;color:white;letter-spacing:1px}
.pdf-cover-sub{font-size:13px;color:#D3A357;letter-spacing:2px;text-transform:uppercase;margin-top:4px;margin-bottom:48px}
.pdf-cover-title{font-family:'Cormorant Garamond',serif;font-size:34px;font-weight:300;color:white;line-height:1.2;margin-bottom:8px}
.pdf-cover-title strong{font-weight:600;display:block}
.pdf-cover-conf{font-size:11px;color:rgba(255,255,255,.45);letter-spacing:1px;margin-top:24px;font-style:italic}
.pdf-gold-bar{height:4px;background:linear-gradient(90deg,#D3A357,rgba(211,163,87,0));flex-shrink:0}
.pdf-info{padding:28px 48px;display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid #E4DDD3}
.pdf-info-item{padding:10px 0;border-bottom:1px solid #F0EDE8}
.pdf-info-label{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:#9CA3AF;margin-bottom:3px}
.pdf-info-value{font-size:14px;font-weight:500;color:#1A1A1A}
.pdf-info-value.empty{color:#D1D5DB;font-style:italic}
.pdf-body{padding:28px 48px}
.pdf-section{margin-bottom:32px}
.pdf-section-head{background:#06402B;color:white;padding:10px 16px;font-size:12px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:16px;border-radius:4px}
.pdf-synth{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.pdf-stat{border:1.5px solid #E4DDD3;border-radius:8px;padding:14px;text-align:center}
.pdf-stat.urgent{border-color:#FCA5A5;background:#FEF2F2}
.pdf-stat.surveiller{border-color:#FDB97D;background:#FFF7ED}
.pdf-stat-num{font-family:'Cormorant Garamond',serif;font-size:38px;font-weight:600;line-height:1;color:#1A1A1A}
.pdf-stat.urgent .pdf-stat-num{color:#DC2626}
.pdf-stat.surveiller .pdf-stat-num{color:#EA580C}
.pdf-stat-label{font-size:10px;color:#6B7280;letter-spacing:1px;text-transform:uppercase;margin-top:4px}
.pdf-cost-bar{border-left:4px solid #D3A357;padding:12px 16px;background:#FAFAF8;margin-bottom:20px;border-radius:0 6px 6px 0}
.pdf-cost-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0}
.pdf-cost-label{font-size:13px;color:#6B7280}
.pdf-cost-val{font-size:15px;font-weight:600}
.pdf-cost-val.red{color:#DC2626}
.pdf-obs-lines{border:1px solid #E4DDD3;border-radius:6px;padding:14px;min-height:72px;font-size:13px;color:#374151;white-space:pre-wrap}
.pdf-anomaly{border:1.5px solid #E4DDD3;border-radius:10px;overflow:hidden;margin-bottom:16px;break-inside:avoid}
.pdf-anomaly-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#F7F5F0;border-bottom:1px solid #E4DDD3}
.pdf-anomaly-num{font-family:'Cormorant Garamond',serif;font-size:24px;font-weight:600;color:#D3A357}
.pdf-anomaly-sev{font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:20px}
.pdf-anomaly-sev.urgent{color:#DC2626;background:#FEF2F2;border:1px solid #FCA5A5}
.pdf-anomaly-sev.surveiller{color:#EA580C;background:#FFF7ED;border:1px solid #FDB97D}
.pdf-anomaly-sev.informatif{color:#6B7280;background:#F9FAFB;border:1px solid #E4DDD3}
.pdf-anomaly-cost{font-size:13px;font-weight:600;color:#DC2626}
.pdf-anomaly-body{padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.pdf-field{display:flex;gap:12px}
.pdf-field-label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF;width:110px;flex-shrink:0;padding-top:2px}
.pdf-field-val{font-size:13px;color:#374151;flex:1}
.pdf-checklist{border:1px solid #E4DDD3;border-radius:8px;overflow:hidden;margin-bottom:16px}
.pdf-check-header{display:grid;grid-template-columns:1fr 80px;background:#06402B;color:white;font-size:11px;font-weight:500;letter-spacing:1px;text-transform:uppercase}
.pdf-check-header div{padding:8px 12px}
.pdf-check-row{display:grid;grid-template-columns:1fr 80px;border-top:1px solid #F0EDE8;font-size:12px}
.pdf-check-row:nth-child(even){background:#FAFAF8}
.pdf-check-row div{padding:7px 12px}
.pdf-check-status{text-align:center;font-weight:600}
.pdf-sign{display:grid;grid-template-columns:1fr 1fr;gap:24px;border-top:1px solid #E4DDD3;padding-top:20px;margin-top:20px}
.pdf-sign-block{display:flex;flex-direction:column;gap:8px}
.pdf-sign-label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#9CA3AF}
.pdf-sign-name{font-size:15px;font-weight:600}
.pdf-sign-role{font-size:12px;color:#6B7280}
.pdf-sign-line{border-bottom:1px solid #E4DDD3;height:40px;margin-top:8px}
.pdf-footer{background:#F7F5F0;border-top:1px solid #E4DDD3;padding:12px 48px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#9CA3AF}

/* PRINT */
@media print{
  .modal-overlay,.modal-bar,.topbar,.form-shell,.home{display:none!important}
  .print-target{display:block!important}
  body{background:white}
  .pdf-doc{box-shadow:none}
  @page{margin:0;size:A4}
}
`;

// ─────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────
const IconAudit = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="1.5">
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
    <rect x="9" y="3" width="6" height="4" rx="1"/>
    <path d="M9 12h6M9 16h4"/>
    <circle cx="17" cy="17" r="3"/><path d="M21 21l-2-2"/>
  </svg>
);
const IconCR = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={G} strokeWidth="1.5">
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
  </svg>
);
const IconPrint = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
    <rect x="6" y="14" width="12" height="8"/>
  </svg>
);

// ─────────────────────────────────────────────────────────────
// AUDIT FORM
// ─────────────────────────────────────────────────────────────
const defaultAnomaly = () => ({ zone: "", description: "", recommandation: "", severite: "", cout: "" });
const defaultAudit = () => ({
  ref: "", client: "", adresse: "", ville: "", type: "", surface: "",
  phase: "", dateVisite: "", observations: "", coutTotal: "", economie: "",
  anomalies: [defaultAnomaly()],
  checklist: {}
});

const PHASES = ["Fondations","Gros œuvre","Maçonnerie","Clos couvert","Second œuvre","Finitions"];
const CHECKLIST_ITEMS = [
  ["Dosage et qualité du béton","Ferraillage conforme aux plans","Fondations et semelles","Chaînages et poteaux","Hourdis / plancher"],
  ["Murs (aplomb, joints)","Enduits intérieurs","Enduits extérieurs","Étanchéité toiture / terrasse","Évacuations eaux pluviales"],
  ["Carrelage sol","Carrelage mural","Plâtrerie / faux-plafonds","Menuiseries bois","Menuiseries alu / PVC","Plomberie apparente","Électricité apparente","Conformité aux plans"]
];
const CHECK_CATS = ["Structure & Fondations","Maçonnerie & Étanchéité","Finitions & Second œuvre"];

function AuditForm({ onPreview }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState(defaultAudit());
  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  const setAnomaly = (i, k, v) => setData(d => {
    const a = [...d.anomalies]; a[i] = { ...a[i], [k]: v }; return { ...d, anomalies: a };
  });
  const addAnomaly = () => setData(d => ({ ...d, anomalies: [...d.anomalies, defaultAnomaly()] }));
  const setCheck = (item, val) => setData(d => ({ ...d, checklist: { ...d.checklist, [item]: val } }));

  const STEPS = ["Projet", "Anomalies", "Checklist", "Bilan"];

  return (
    <div className="form-shell">
      <style>{css}</style>
      {/* Progress */}
      <div className="form-progress">
        {STEPS.map((s, i) => (
          <>
            <div key={i} className={`form-step ${i < step ? "done" : i === step ? "active" : ""}`}>{i < step ? "✓" : i + 1}</div>
            {i < STEPS.length - 1 && <div key={`l${i}`} className={`form-step-line ${i < step ? "done" : ""}`} />}
          </>
        ))}
      </div>

      {/* Step 0 — Projet */}
      {step === 0 && (
        <>
          <div className="form-section-title">Informations projet</div>
          <div className="form-section-sub">Renseignez les détails du chantier à auditer</div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Référence dossier</label><input className="form-input" value={data.ref} onChange={e => set("ref", e.target.value)} placeholder="ZAF-2025-001" /></div>
            <div className="form-group"><label className="form-label">Ville</label><input className="form-input" value={data.ville} onChange={e => set("ville", e.target.value)} placeholder="Casablanca" /></div>
          </div>
          <div className="form-group"><label className="form-label">Client</label><input className="form-input" value={data.client} onChange={e => set("client", e.target.value)} placeholder="Nom du maître d'ouvrage" /></div>
          <div className="form-group"><label className="form-label">Adresse du chantier</label><input className="form-input" value={data.adresse} onChange={e => set("adresse", e.target.value)} placeholder="Adresse complète" /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Type de projet</label><input className="form-input" value={data.type} onChange={e => set("type", e.target.value)} placeholder="Villa R+1, appartement..." /></div>
            <div className="form-group"><label className="form-label">Surface (m²)</label><input className="form-input" type="number" value={data.surface} onChange={e => set("surface", e.target.value)} placeholder="350" /></div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phase de chantier</label>
              <select className="form-select" value={data.phase} onChange={e => set("phase", e.target.value)}>
                <option value="">Sélectionner</option>
                {PHASES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Date de visite</label><input className="form-input" type="date" value={data.dateVisite} onChange={e => set("dateVisite", e.target.value)} /></div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={() => setStep(1)}>Suivant → Anomalies</button>
          </div>
        </>
      )}

      {/* Step 1 — Anomalies */}
      {step === 1 && (
        <>
          <div className="form-section-title">Anomalies détectées</div>
          <div className="form-section-sub">Documentez chaque anomalie trouvée sur le chantier</div>
          {data.anomalies.map((a, i) => (
            <div className="form-card" key={i}>
              <div className="form-card-head">
                <span className="form-card-num">{String(i + 1).padStart(2, "0")}</span>
                {data.anomalies.length > 1 && (
                  <button style={{ background: "none", border: "none", color: GRAY, fontSize: 13, cursor: "pointer" }}
                    onClick={() => setData(d => ({ ...d, anomalies: d.anomalies.filter((_, j) => j !== i) }))}>
                    Supprimer
                  </button>
                )}
              </div>
              <div className="form-group"><label className="form-label">Zone / Poste</label><input className="form-input" value={a.zone} onChange={e => setAnomaly(i, "zone", e.target.value)} placeholder="Ex: Fondations Nord, Carrelage séjour..." /></div>
              <div className="form-group"><label className="form-label">Constat</label><textarea className="form-textarea" value={a.description} onChange={e => setAnomaly(i, "description", e.target.value)} placeholder="Décrivez l'anomalie observée..." /></div>
              <div className="form-group"><label className="form-label">Recommandation</label><textarea className="form-textarea" style={{ minHeight: 60 }} value={a.recommandation} onChange={e => setAnomaly(i, "recommandation", e.target.value)} placeholder="Action à mener..." /></div>
              <div className="form-group">
                <label className="form-label">Sévérité</label>
                <div className="sev-pills">
                  {[["urgent", "🔴 Urgent"], ["surveiller", "🟠 À surveiller"], ["informatif", "⚪ Informatif"]].map(([v, l]) => (
                    <button key={v} className={`sev-pill ${v} ${a.severite === v ? "selected" : ""}`} onClick={() => setAnomaly(i, "severite", v)}>{l}</button>
                  ))}
                </div>
              </div>
              <div className="form-group"><label className="form-label">Coût estimé (MAD)</label><input className="form-input" type="number" value={a.cout} onChange={e => setAnomaly(i, "cout", e.target.value)} placeholder="Ex: 12000" /></div>
            </div>
          ))}
          <button className="add-btn" onClick={addAnomaly}>+ Ajouter une anomalie</button>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setStep(0)}>← Retour</button>
            <button className="btn-primary" onClick={() => setStep(2)}>Suivant → Checklist</button>
          </div>
        </>
      )}

      {/* Step 2 — Checklist */}
      {step === 2 && (
        <>
          <div className="form-section-title">Checklist d'inspection</div>
          <div className="form-section-sub">Cochez l'état de chaque élément inspecté</div>
          {CHECK_CATS.map((cat, ci) => (
            <div key={cat} style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: G, marginBottom: 10, letterSpacing: ".5px" }}>{cat}</div>
              {CHECKLIST_ITEMS[ci].map(item => (
                <div key={item} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ fontSize: 14 }}>{item}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[["RAS", "#16A34A"], ["⚠", "#EA580C"], ["N/A", GRAY]].map(([v, c]) => (
                      <button key={v} onClick={() => setCheck(item, v)}
                        style={{ padding: "5px 10px", borderRadius: 6, border: `1.5px solid ${data.checklist[item] === v ? c : BORDER}`, background: data.checklist[item] === v ? c : "white", color: data.checklist[item] === v ? "white" : GRAY, fontSize: 12, fontWeight: 500, cursor: "pointer" }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setStep(1)}>← Retour</button>
            <button className="btn-primary" onClick={() => setStep(3)}>Suivant → Bilan</button>
          </div>
        </>
      )}

      {/* Step 3 — Bilan */}
      {step === 3 && (
        <>
          <div className="form-section-title">Bilan & Synthèse</div>
          <div className="form-section-sub">Finalisez le rapport avant génération</div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Coût total corrections (MAD)</label><input className="form-input" type="number" value={data.coutTotal} onChange={e => set("coutTotal", e.target.value)} placeholder="Auto-calculé si vide" /></div>
            <div className="form-group"><label className="form-label">Économie négociable (MAD)</label><input className="form-input" type="number" value={data.economie} onChange={e => set("economie", e.target.value)} placeholder="Estimation" /></div>
          </div>
          <div className="form-group"><label className="form-label">Observations générales</label><textarea className="form-textarea" style={{ minHeight: 100 }} value={data.observations} onChange={e => set("observations", e.target.value)} placeholder="Remarques générales sur l'état du chantier..." /></div>

          {/* Summary preview */}
          <div style={{ background: "white", border: `1.5px solid ${BORDER}`, borderRadius: 12, padding: "16px 20px", marginTop: 8 }}>
            <div style={{ fontSize: 12, color: GRAY, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Récapitulatif</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
              {[
                ["Total", data.anomalies.length, DARK],
                ["Urgent", data.anomalies.filter(a => a.severite === "urgent").length, "#DC2626"],
                ["À surveiller", data.anomalies.filter(a => a.severite === "surveiller").length, "#EA580C"],
              ].map(([l, v, c]) => (
                <div key={l} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 36, fontWeight: 600, color: c, lineHeight: 1 }}>{v}</div>
                  <div style={{ fontSize: 11, color: GRAY, marginTop: 4 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setStep(2)}>← Retour</button>
          </div>
          <button className="btn-generate" onClick={() => onPreview(data)}>
            <IconPrint /> Générer le rapport PDF
          </button>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// COMPTE-RENDU FORM
// ─────────────────────────────────────────────────────────────
const defaultCR = () => ({
  projet: "", client: "", adresse: "", semaine: "", dateVisite: "",
  phaseEnCours: "", avancementPrevu: "", avancementReel: "", ecart: "conforme",
  travauxRealises: [{ tache: "", qualite: "", conforme: "" }],
  factures: [{ entreprise: "", montant: "", verifie: "", avis: "", paye: "" }],
  alertes: [{ zone: "", constat: "", action: "", responsable: "", delai: "" }],
  prochaineTravaux: "", decisionsAttentes: ""
});

function CRForm({ onPreview }) {
  const [data, setData] = useState(defaultCR());
  const [step, setStep] = useState(0);
  const set = (k, v) => setData(d => ({ ...d, [k]: v }));

  const setTravaux = (i, k, v) => setData(d => {
    const t = [...d.travauxRealises]; t[i] = { ...t[i], [k]: v }; return { ...d, travauxRealises: t };
  });
  const setFacture = (i, k, v) => setData(d => {
    const f = [...d.factures]; f[i] = { ...f[i], [k]: v }; return { ...d, factures: f };
  });
  const setAlerte = (i, k, v) => setData(d => {
    const a = [...d.alertes]; a[i] = { ...a[i], [k]: v }; return { ...d, alertes: a };
  });

  const STEPS = ["Projet", "Travaux", "Finances", "Alertes & Suite"];

  return (
    <div className="form-shell">
      <style>{css}</style>
      <div className="form-progress">
        {STEPS.map((s, i) => (
          <>
            <div key={i} className={`form-step ${i < step ? "done" : i === step ? "active" : ""}`}>{i < step ? "✓" : i + 1}</div>
            {i < STEPS.length - 1 && <div key={`l${i}`} className={`form-step-line ${i < step ? "done" : ""}`} />}
          </>
        ))}
      </div>

      {/* Step 0 — Projet */}
      {step === 0 && (
        <>
          <div className="form-section-title">Identification</div>
          <div className="form-section-sub">Projet et période concernée</div>
          <div className="form-group"><label className="form-label">Nom du projet</label><input className="form-input" value={data.projet} onChange={e => set("projet", e.target.value)} placeholder="Villa R+1, Casablanca" /></div>
          <div className="form-group"><label className="form-label">Client</label><input className="form-input" value={data.client} onChange={e => set("client", e.target.value)} placeholder="Nom du client" /></div>
          <div className="form-group"><label className="form-label">Adresse</label><input className="form-input" value={data.adresse} onChange={e => set("adresse", e.target.value)} placeholder="Adresse du chantier" /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Semaine N°</label><input className="form-input" type="number" value={data.semaine} onChange={e => set("semaine", e.target.value)} placeholder="12" /></div>
            <div className="form-group"><label className="form-label">Date de visite</label><input className="form-input" type="date" value={data.dateVisite} onChange={e => set("dateVisite", e.target.value)} /></div>
          </div>
          <div className="form-group">
            <label className="form-label">Phase en cours</label>
            <select className="form-select" value={data.phaseEnCours} onChange={e => set("phaseEnCours", e.target.value)}>
              <option value="">Sélectionner</option>
              {PHASES.map(p => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Avancement prévu</label><input className="form-input" value={data.avancementPrevu} onChange={e => set("avancementPrevu", e.target.value)} placeholder="Ex: 60%" /></div>
            <div className="form-group"><label className="form-label">Avancement réel</label><input className="form-input" value={data.avancementReel} onChange={e => set("avancementReel", e.target.value)} placeholder="Ex: 55%" /></div>
          </div>
          <div className="form-group">
            <label className="form-label">Écart planning</label>
            <div className="sev-pills">
              {[["avance","🟢 En avance"],["conforme","✅ Conforme"],["retard","🔴 En retard"]].map(([v,l]) => (
                <button key={v} className={`sev-pill ${data.ecart===v?"selected":""}`}
                  style={data.ecart===v?{borderColor:G,color:G,background:"rgba(6,64,43,.06)"}:{}}
                  onClick={() => set("ecart", v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={() => setStep(1)}>Suivant → Travaux</button>
          </div>
        </>
      )}

      {/* Step 1 — Travaux */}
      {step === 1 && (
        <>
          <div className="form-section-title">Travaux réalisés</div>
          <div className="form-section-sub">Cette semaine sur le chantier</div>
          {data.travauxRealises.map((t, i) => (
            <div className="form-card" key={i}>
              <div className="form-card-head">
                <span style={{ fontSize: 13, fontWeight: 600, color: GRAY }}>Tâche {i + 1}</span>
                {data.travauxRealises.length > 1 && <button style={{ background: "none", border: "none", color: GRAY, fontSize: 12, cursor: "pointer" }} onClick={() => setData(d => ({ ...d, travauxRealises: d.travauxRealises.filter((_, j) => j !== i) }))}>Supprimer</button>}
              </div>
              <div className="form-group"><label className="form-label">Poste / Tâche</label><input className="form-input" value={t.tache} onChange={e => setTravaux(i, "tache", e.target.value)} placeholder="Ex: Pose carrelage séjour" /></div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Qualité</label>
                  <select className="form-select" value={t.qualite} onChange={e => setTravaux(i, "qualite", e.target.value)}>
                    <option value="">—</option><option>Bonne</option><option>À revoir</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Conforme aux plans</label>
                  <select className="form-select" value={t.conforme} onChange={e => setTravaux(i, "conforme", e.target.value)}>
                    <option value="">—</option><option>Oui</option><option>Non</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
          <button className="add-btn" onClick={() => setData(d => ({ ...d, travauxRealises: [...d.travauxRealises, { tache: "", qualite: "", conforme: "" }] }))}>+ Ajouter une tâche</button>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setStep(0)}>← Retour</button>
            <button className="btn-primary" onClick={() => setStep(2)}>Suivant → Finances</button>
          </div>
        </>
      )}

      {/* Step 2 — Finances */}
      {step === 2 && (
        <>
          <div className="form-section-title">Factures & Paiements</div>
          <div className="form-section-sub">Validation des factures de la semaine</div>
          {data.factures.map((f, i) => (
            <div className="form-card" key={i}>
              <div className="form-card-head">
                <span style={{ fontSize: 13, fontWeight: 600, color: GRAY }}>Facture {i + 1}</span>
                {data.factures.length > 1 && <button style={{ background: "none", border: "none", color: GRAY, fontSize: 12, cursor: "pointer" }} onClick={() => setData(d => ({ ...d, factures: d.factures.filter((_, j) => j !== i) }))}>Supprimer</button>}
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Entreprise</label><input className="form-input" value={f.entreprise} onChange={e => setFacture(i, "entreprise", e.target.value)} placeholder="Nom de l'entreprise" /></div>
                <div className="form-group"><label className="form-label">Montant (MAD)</label><input className="form-input" type="number" value={f.montant} onChange={e => setFacture(i, "montant", e.target.value)} /></div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Travaux vérifiés</label>
                  <select className="form-select" value={f.verifie} onChange={e => setFacture(i, "verifie", e.target.value)}>
                    <option value="">—</option><option>Oui</option><option>Partiel</option><option>Non</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Avis ZAF BAT</label>
                  <select className="form-select" value={f.avis} onChange={e => setFacture(i, "avis", e.target.value)}>
                    <option value="">—</option><option>✅ Approuvé</option><option>🚫 Bloqué</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
          <button className="add-btn" onClick={() => setData(d => ({ ...d, factures: [...d.factures, { entreprise: "", montant: "", verifie: "", avis: "", paye: "" }] }))}>+ Ajouter une facture</button>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setStep(1)}>← Retour</button>
            <button className="btn-primary" onClick={() => setStep(3)}>Suivant → Suite</button>
          </div>
        </>
      )}

      {/* Step 3 — Alertes & Suite */}
      {step === 3 && (
        <>
          <div className="form-section-title">Alertes & Prochaine semaine</div>
          <div className="form-section-sub">Points d'attention et planning à venir</div>
          {data.alertes.map((a, i) => (
            <div className="form-card" key={i} style={{ borderColor: a.zone ? "#FDB97D" : BORDER }}>
              <div className="form-card-head">
                <span style={{ fontSize: 13, fontWeight: 600, color: "#EA580C" }}>⚠ Alerte {i + 1}</span>
                {data.alertes.length > 1 && <button style={{ background: "none", border: "none", color: GRAY, fontSize: 12, cursor: "pointer" }} onClick={() => setData(d => ({ ...d, alertes: d.alertes.filter((_, j) => j !== i) }))}>Supprimer</button>}
              </div>
              <div className="form-group"><label className="form-label">Zone / Sujet</label><input className="form-input" value={a.zone} onChange={e => setAlerte(i, "zone", e.target.value)} placeholder="Laisser vide si rien à signaler" /></div>
              {a.zone && <>
                <div className="form-group"><label className="form-label">Constat</label><textarea className="form-textarea" style={{ minHeight: 60 }} value={a.constat} onChange={e => setAlerte(i, "constat", e.target.value)} /></div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">Action requise</label><input className="form-input" value={a.action} onChange={e => setAlerte(i, "action", e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Délai</label><input className="form-input" value={a.delai} onChange={e => setAlerte(i, "delai", e.target.value)} placeholder="Ex: 3 jours" /></div>
                </div>
              </>}
            </div>
          ))}
          <button className="add-btn" onClick={() => setData(d => ({ ...d, alertes: [...d.alertes, { zone: "", constat: "", action: "", responsable: "", delai: "" }] }))}>+ Ajouter une alerte</button>
          <div className="form-group"><label className="form-label">Travaux prévus la semaine prochaine</label><textarea className="form-textarea" value={data.prochaineTravaux} onChange={e => set("prochaineTravaux", e.target.value)} placeholder="Listez les travaux prévus..." /></div>
          <div className="form-group"><label className="form-label">Décisions en attente du client</label><textarea className="form-textarea" style={{ minHeight: 60 }} value={data.decisionsAttentes} onChange={e => set("decisionsAttentes", e.target.value)} /></div>
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setStep(2)}>← Retour</button>
          </div>
          <button className="btn-generate" onClick={() => onPreview(data)}>
            <IconPrint /> Générer le compte-rendu PDF
          </button>
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PDF DOCUMENTS
// ─────────────────────────────────────────────────────────────
function fmtDate(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("fr-MA", { day: "2-digit", month: "long", year: "numeric" }); } catch { return d; }
}
function fmtNum(n) { if (!n) return "—"; return Number(n).toLocaleString("fr-MA") + " MAD"; }

function AuditPDF({ data }) {
  const urgent = data.anomalies.filter(a => a.severite === "urgent").length;
  const surveiller = data.anomalies.filter(a => a.severite === "surveiller").length;
  const informatif = data.anomalies.filter(a => a.severite === "informatif").length;
  const totalCout = data.coutTotal || data.anomalies.reduce((s, a) => s + (Number(a.cout) || 0), 0);
  const checks = data.checklist || {};

  return (
    <div className="pdf-doc">
      {/* Cover */}
      <div className="pdf-cover">
        <div className="pdf-cover-logo">ZAF BAT</div>
        <div className="pdf-cover-sub">Maîtrise d'Ouvrage Déléguée</div>
        <div className="pdf-cover-title">
          Rapport d'audit<br />
          <strong>de chantier</strong>
        </div>
        <div className="pdf-cover-conf">Document confidentiel · Usage exclusif du maître d'ouvrage</div>
      </div>
      <div className="pdf-gold-bar" />

      {/* Project info */}
      <div className="pdf-info">
        {[
          ["Référence", data.ref], ["Client", data.client],
          ["Adresse", data.adresse], ["Ville", data.ville],
          ["Type de projet", data.type], ["Surface", data.surface ? data.surface + " m²" : ""],
          ["Phase", data.phase], ["Date de visite", fmtDate(data.dateVisite)],
          ["Ingénieur inspecteur", "Achraf Zaddoug"], ["Rapport établi le", fmtDate(new Date().toISOString().split("T")[0])]
        ].map(([l, v]) => (
          <div className="pdf-info-item" key={l}>
            <div className="pdf-info-label">{l}</div>
            <div className={`pdf-info-value ${!v ? "empty" : ""}`}>{v || "—"}</div>
          </div>
        ))}
      </div>

      <div className="pdf-body">
        {/* Synthèse */}
        <div className="pdf-section">
          <div className="pdf-section-head">Synthèse exécutive</div>
          <div className="pdf-synth">
            <div className="pdf-stat"><div className="pdf-stat-num">{data.anomalies.length}</div><div className="pdf-stat-label">Total</div></div>
            <div className="pdf-stat urgent"><div className="pdf-stat-num">{urgent}</div><div className="pdf-stat-label">Urgent</div></div>
            <div className="pdf-stat surveiller"><div className="pdf-stat-num">{surveiller}</div><div className="pdf-stat-label">À surveiller</div></div>
            <div className="pdf-stat"><div className="pdf-stat-num">{informatif}</div><div className="pdf-stat-label">Informatif</div></div>
          </div>
          {(totalCout || data.economie) && (
            <div className="pdf-cost-bar">
              {totalCout && <div className="pdf-cost-row"><span className="pdf-cost-label">Coût estimé des corrections</span><span className="pdf-cost-val red">{fmtNum(totalCout)}</span></div>}
              {data.economie && <div className="pdf-cost-row"><span className="pdf-cost-label">Économie négociable estimée</span><span className="pdf-cost-val" style={{ color: G }}>{fmtNum(data.economie)}</span></div>}
            </div>
          )}
          {data.observations && (
            <div>
              <div style={{ fontSize: 12, color: GRAY, marginBottom: 8, fontWeight: 500 }}>Observations générales</div>
              <div className="pdf-obs-lines">{data.observations}</div>
            </div>
          )}
        </div>

        {/* Checklist */}
        {Object.keys(checks).length > 0 && (
          <div className="pdf-section">
            <div className="pdf-section-head">Checklist d'inspection</div>
            {CHECK_CATS.map((cat, ci) => {
              const items = CHECKLIST_ITEMS[ci].filter(item => checks[item]);
              if (!items.length) return null;
              return (
                <div key={cat} className="pdf-checklist" style={{ marginBottom: 12 }}>
                  <div className="pdf-check-header"><div>{cat}</div><div style={{ textAlign: "center" }}>Statut</div></div>
                  {items.map(item => (
                    <div key={item} className="pdf-check-row">
                      <div>{item}</div>
                      <div className="pdf-check-status" style={{ color: checks[item] === "RAS" ? "#16A34A" : checks[item] === "⚠" ? "#EA580C" : GRAY }}>{checks[item]}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Anomalies */}
        {data.anomalies.some(a => a.zone || a.description) && (
          <div className="pdf-section">
            <div className="pdf-section-head">Anomalies détectées</div>
            {data.anomalies.filter(a => a.zone || a.description).map((a, i) => (
              <div key={i} className="pdf-anomaly">
                <div className="pdf-anomaly-head">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="pdf-anomaly-num">{String(i + 1).padStart(2, "0")}</span>
                    {a.severite && <span className={`pdf-anomaly-sev ${a.severite}`}>{a.severite === "urgent" ? "🔴 Urgent" : a.severite === "surveiller" ? "🟠 À surveiller" : "⚪ Informatif"}</span>}
                  </div>
                  {a.cout && <span className="pdf-anomaly-cost">{fmtNum(a.cout)}</span>}
                </div>
                <div className="pdf-anomaly-body">
                  {a.zone && <div className="pdf-field"><span className="pdf-field-label">Zone / Poste</span><span className="pdf-field-val">{a.zone}</span></div>}
                  {a.description && <div className="pdf-field"><span className="pdf-field-label">Constat</span><span className="pdf-field-val">{a.description}</span></div>}
                  {a.recommandation && <div className="pdf-field"><span className="pdf-field-label">Recommandation</span><span className="pdf-field-val">{a.recommandation}</span></div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Signatures */}
        <div className="pdf-sign">
          <div className="pdf-sign-block">
            <div className="pdf-sign-label">Établi par</div>
            <div className="pdf-sign-name">Achraf Zaddoug</div>
            <div className="pdf-sign-role">Ingénieur Civil · ZAF BAT</div>
            <div className="pdf-sign-line" />
          </div>
          <div className="pdf-sign-block">
            <div className="pdf-sign-label">Lu et approuvé</div>
            <div className="pdf-sign-name">{data.client || "Client"}</div>
            <div className="pdf-sign-role">Maître d'ouvrage</div>
            <div className="pdf-sign-line" />
          </div>
        </div>
      </div>

      <div className="pdf-footer">
        <span>ZAF BAT · Maîtrise d'Ouvrage Déléguée</span>
        <span>zafbatiment@gmail.com · +212 717 380 728 · zafbat.ma</span>
      </div>
    </div>
  );
}

function CRPDF({ data }) {
  const alertesActives = data.alertes.filter(a => a.zone);
  return (
    <div className="pdf-doc">
      <div className="pdf-cover" style={{ paddingBottom: 32 }}>
        <div className="pdf-cover-logo">ZAF BAT</div>
        <div className="pdf-cover-sub">Maîtrise d'Ouvrage Déléguée</div>
        <div className="pdf-cover-title">Compte-rendu<br /><strong>de chantier</strong></div>
        <div style={{ display: "flex", gap: 24, marginTop: 20 }}>
          {data.semaine && <div style={{ color: "rgba(255,255,255,.7)", fontSize: 13 }}>Semaine <strong style={{ color: GOLD }}>N° {data.semaine}</strong></div>}
          {data.dateVisite && <div style={{ color: "rgba(255,255,255,.7)", fontSize: 13 }}>Visite du <strong style={{ color: GOLD }}>{fmtDate(data.dateVisite)}</strong></div>}
        </div>
      </div>
      <div className="pdf-gold-bar" />

      <div className="pdf-info">
        {[["Projet", data.projet], ["Client", data.client], ["Adresse", data.adresse], ["Phase en cours", data.phaseEnCours],
          ["Avancement prévu", data.avancementPrevu], ["Avancement réel", data.avancementReel],
          ["Écart planning", data.ecart === "avance" ? "✅ En avance" : data.ecart === "retard" ? "🔴 En retard" : "✅ Conforme"],
          ["Rédigé par", "Achraf Zaddoug · ZAF BAT"]
        ].map(([l, v]) => (
          <div className="pdf-info-item" key={l}>
            <div className="pdf-info-label">{l}</div>
            <div className={`pdf-info-value ${!v ? "empty" : ""}`}>{v || "—"}</div>
          </div>
        ))}
      </div>

      <div className="pdf-body">
        {/* Travaux */}
        {data.travauxRealises.some(t => t.tache) && (
          <div className="pdf-section">
            <div className="pdf-section-head">Travaux réalisés cette semaine</div>
            <div className="pdf-checklist">
              <div className="pdf-check-header" style={{ gridTemplateColumns: "1fr 90px 90px" }}>
                <div>Poste / Tâche</div><div style={{ textAlign: "center" }}>Qualité</div><div style={{ textAlign: "center" }}>Conforme</div>
              </div>
              {data.travauxRealises.filter(t => t.tache).map((t, i) => (
                <div key={i} className="pdf-check-row" style={{ gridTemplateColumns: "1fr 90px 90px" }}>
                  <div>{t.tache}</div>
                  <div style={{ textAlign: "center", color: t.qualite === "Bonne" ? "#16A34A" : "#EA580C" }}>{t.qualite || "—"}</div>
                  <div style={{ textAlign: "center", color: t.conforme === "Oui" ? "#16A34A" : t.conforme === "Non" ? "#DC2626" : GRAY }}>{t.conforme || "—"}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Factures */}
        {data.factures.some(f => f.entreprise) && (
          <div className="pdf-section">
            <div className="pdf-section-head">Factures & Paiements</div>
            <div className="pdf-checklist">
              <div className="pdf-check-header" style={{ gridTemplateColumns: "1fr 110px 100px 90px" }}>
                <div>Entreprise</div><div style={{ textAlign: "center" }}>Montant</div><div style={{ textAlign: "center" }}>Vérifiés</div><div style={{ textAlign: "center" }}>Avis ZAF BAT</div>
              </div>
              {data.factures.filter(f => f.entreprise).map((f, i) => (
                <div key={i} className="pdf-check-row" style={{ gridTemplateColumns: "1fr 110px 100px 90px" }}>
                  <div>{f.entreprise}</div>
                  <div style={{ textAlign: "center", fontWeight: 500 }}>{f.montant ? Number(f.montant).toLocaleString("fr-MA") + " MAD" : "—"}</div>
                  <div style={{ textAlign: "center" }}>{f.verifie || "—"}</div>
                  <div style={{ textAlign: "center", fontWeight: 600, color: f.avis?.includes("Approuvé") ? "#16A34A" : f.avis?.includes("Bloqué") ? "#DC2626" : GRAY }}>{f.avis || "—"}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alertes */}
        {alertesActives.length > 0 && (
          <div className="pdf-section">
            <div className="pdf-section-head" style={{ background: "#EA580C" }}>Points d'attention · Alertes</div>
            {alertesActives.map((a, i) => (
              <div key={i} className="pdf-anomaly" style={{ borderColor: "#FDB97D" }}>
                <div className="pdf-anomaly-head" style={{ background: "#FFF7ED" }}>
                  <span style={{ fontWeight: 600, color: "#EA580C" }}>⚠ Alerte {i + 1} · {a.zone}</span>
                  {a.delai && <span style={{ fontSize: 12, color: GRAY }}>Délai : {a.delai}</span>}
                </div>
                <div className="pdf-anomaly-body">
                  {a.constat && <div className="pdf-field"><span className="pdf-field-label">Constat</span><span className="pdf-field-val">{a.constat}</span></div>}
                  {a.action && <div className="pdf-field"><span className="pdf-field-label">Action requise</span><span className="pdf-field-val">{a.action}</span></div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Prochaine semaine */}
        {(data.prochaineTravaux || data.decisionsAttentes) && (
          <div className="pdf-section">
            <div className="pdf-section-head">Prochaine semaine</div>
            {data.prochaineTravaux && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: GRAY, marginBottom: 8 }}>Travaux prévus</div>
                <div className="pdf-obs-lines">{data.prochaineTravaux}</div>
              </div>
            )}
            {data.decisionsAttentes && (
              <div>
                <div style={{ fontSize: 12, color: GRAY, marginBottom: 8 }}>Décisions en attente du client</div>
                <div className="pdf-obs-lines">{data.decisionsAttentes}</div>
              </div>
            )}
          </div>
        )}

        <div className="pdf-sign">
          <div className="pdf-sign-block">
            <div className="pdf-sign-label">Établi par ZAF BAT</div>
            <div className="pdf-sign-name">Achraf Zaddoug</div>
            <div className="pdf-sign-role">Ingénieur Civil</div>
            <div className="pdf-sign-line" />
          </div>
          <div className="pdf-sign-block">
            <div className="pdf-sign-label">Lu et approuvé</div>
            <div className="pdf-sign-name">{data.client || "Client"}</div>
            <div className="pdf-sign-role">Date : _______________</div>
            <div className="pdf-sign-line" />
          </div>
        </div>
      </div>
      <div className="pdf-footer">
        <span>ZAF BAT · Compte-Rendu Hebdomadaire</span>
        <span>zafbatiment@gmail.com · +212 717 380 728</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// PREVIEW MODAL
// ─────────────────────────────────────────────────────────────
function PreviewModal({ type, data, onClose }) {
  return (
    <div className="modal-overlay">
      <style>{css}</style>
      <div className="modal-bar">
        <span className="modal-bar-title">Aperçu · {type === "audit" ? "Rapport d'audit" : "Compte-rendu hebdo"}</span>
        <div className="modal-actions">
          <button className="btn-print" onClick={() => window.print()}>
            <IconPrint /> Imprimer / Enregistrer PDF
          </button>
          <button className="btn-close-modal" onClick={onClose}>✕ Fermer</button>
        </div>
      </div>
      <div style={{ padding: "0 16px 32px", background: "#374151" }}>
        <div className="modal-content">
          {type === "audit" ? <AuditPDF data={data} /> : <CRPDF data={data} />}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home"); // home | audit | cr
  const [preview, setPreview] = useState(null); // { type, data }

  return (
    <>
      <style>{css}</style>
      {preview && (
        <PreviewModal type={preview.type} data={preview.data} onClose={() => setPreview(null)} />
      )}
      <div className="app">
        <div className="topbar">
          <span className="topbar-logo">ZAF <span>BAT</span></span>
          {screen !== "home" && (
            <button className="topbar-back" onClick={() => setScreen("home")}>← Accueil</button>
          )}
        </div>

        {screen === "home" && (
          <div className="home">
            <div className="home-title">
              <h1>Générer un <em>document</em><br />professionnel</h1>
              <p>ZAF BAT · Outils internes</p>
            </div>
            <div className="home-cards">
              <button className="home-card" onClick={() => setScreen("audit")}>
                <div className="home-card-icon"><IconAudit /></div>
                <div>
                  <div className="home-card-num">Service 01</div>
                  <div className="home-card-title">Rapport d'audit de chantier</div>
                </div>
                <div className="home-card-desc">Remplissez le formulaire, documentez les anomalies, générez un PDF branded prêt à envoyer.</div>
                <div className="home-card-arrow">→</div>
              </button>
              <button className="home-card" onClick={() => setScreen("cr")}>
                <div className="home-card-icon"><IconCR /></div>
                <div>
                  <div className="home-card-num">Service 03</div>
                  <div className="home-card-title">Compte-rendu hebdomadaire</div>
                </div>
                <div className="home-card-desc">Avancement, travaux, factures, alertes. PDF généré en 2 minutes, à envoyer directement sur WhatsApp.</div>
                <div className="home-card-arrow">→</div>
              </button>
            </div>
          </div>
        )}

        {screen === "audit" && (
          <AuditForm onPreview={(d) => setPreview({ type: "audit", data: d })} />
        )}
        {screen === "cr" && (
          <CRForm onPreview={(d) => setPreview({ type: "cr", data: d })} />
        )}
      </div>
    </>
  );
}
