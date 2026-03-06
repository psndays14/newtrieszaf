export function escapeHtml(value = "") { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
export function get(obj, path, fallback = "") { return path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj) ?? fallback; }
export function listItems(items = []) { return items.map(item => `<li>${escapeHtml(item)}</li>`).join("
"); }
export function chiffrageRows(lines = []) { return lines.map(line => `
<tr><td>${escapeHtml(line.designation)}</td><td>${escapeHtml(line.unite)}</td><td class="num">${escapeHtml(line.qte)}</td><td class="num">${escapeHtml(line.pu)}</td><td class="num">${escapeHtml(line.total)}</td></tr>`).join("
"); }
export function jalonsRows(lines = []) { return lines.map(line => `
<tr><td>${escapeHtml(line.label)}</td><td class="num">${escapeHtml(line.amount)}</td></tr>`).join("
"); }
export function situationRows(lines = []) { return lines.map(line => `
<tr><td>${escapeHtml(line.poste)}</td><td class="num">${escapeHtml(line.marche)}</td><td class="num">${escapeHtml(line.prec)}</td><td class="num">${escapeHtml(line.periode)}</td><td class="num">${escapeHtml(line.cumul)}</td></tr>`).join("
"); }
export function reservesRows(lines = []) { if (!lines.length) { return `<tr><td colspan="5" class="text-center">Aucune réserve.</td></tr>`; } return lines.map(line => `
<tr><td>${escapeHtml(line.n)}</td><td>${escapeHtml(line.reserve)}</td><td>${escapeHtml(line.localisation)}</td><td>${escapeHtml(line.action)}</td><td>${escapeHtml(line.delai)}</td></tr>`).join("
"); }
export function auditRows(lines = []) { return lines.map(line => { const badgeClass = line.statut === "Conforme" ? "ok" : line.statut === "À corriger" ? "warn" : "neutral"; return `
<tr><td>${escapeHtml(line.zone)}</td><td>${escapeHtml(line.point)}</td><td>${escapeHtml(line.constat)}</td><td><span class="badge ${badgeClass}">${escapeHtml(line.statut)}</span></td><td>${escapeHtml(line.action)}</td><td>${escapeHtml(line.responsable)}</td><td>${escapeHtml(line.echeance)}</td></tr>`; }).join("
"); }
export function paragraphs(paras = []) { return paras.map(p => `<p>${escapeHtml(p)}</p>`).join("
"); }
export function materializeData(raw) { return { ...raw, INCLUSIONS_ITEMS_HTML: listItems(raw.contractuel?.inclusions), EXCLUSIONS_ITEMS_HTML: listItems(raw.contractuel?.exclusions), HYPOTHESES_ITEMS_HTML: listItems(raw.contractuel?.hypotheses), CHIFFRAGE_ROWS_HTML: chiffrageRows(raw.chiffrage?.lignes), JALONS_ROWS_HTML: jalonsRows(raw.commercial?.jalons), SITUATION_ROWS_HTML: situationRows(raw.situation?.lignes), RESERVES_ROWS_HTML: reservesRows(raw.pv?.reserves), AUDIT_ROWS_HTML: auditRows(raw.audit?.lignes), AUDIT_SYNTHESIS_HTML: paragraphs(raw.audit?.synthesis_paragraphs) }; }
export function renderTemplate(templateHtml, data) { return templateHtml.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, token) => { const key = token.trim(); if (Object.prototype.hasOwnProperty.call(data, key)) return data[key] ?? ""; return escapeHtml(get(data, key, "")); }); }
