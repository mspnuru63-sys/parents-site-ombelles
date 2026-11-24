/* ===========================================================
   Site des parents — logique principale
   =========================================================== */
let db = null;
let currentStudent = null;
let unsubNotifs = null, unsubRemarks = null, unsubBulletins = null, unsubPayments = null;
let schoolSettings = {};

/* Icône selon le type de notification envoyé par l'application (texte libre) */
const NOTIF_ICONS = { paiement: "💰", reunion: "📣", sortie: "🚌", info: "ℹ️" };
function notifKind(type) {
  const t = norm(type);
  if (t.includes("paiement")) return "paiement";
  if (t.includes("reunion") || t.includes("convocation")) return "reunion";
  if (t.includes("sortie")) return "sortie";
  return "info";
}

/* Comparaison tolérante : majuscules, accents et espaces ignorés */
function norm(s) {
  return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function studentFullName(s) { return (((s && s.prenom) || "") + " " + ((s && s.nom) || "")).trim(); }
/* Même chemin que l'application NuruxData : ecoles/{code établissement}/... */
function schoolRef() { return db.collection("ecoles").doc(SCHOOL_CODE); }
/* Les notes sont envoyées sur 20 ; on les ramène au barème du bulletin (10 ou 20) */
function toBar(v, scale) { return v == null || v === "" ? null : Number(v) * (Number(scale) || 20) / 20; }


function escapeHTML(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}
function initials(firstName, lastName) {
  return ((firstName || "?")[0] || "?").toUpperCase() + ((lastName || "?")[0] || "?").toUpperCase();
}
/* -------- Note / moyenne sans zéros inutiles : 14 (pas 14.00), 14,5 (pas 14.50) — identique à l'application -------- */
function fmtNote(n) {
  if (n == null || n === "" || isNaN(Number(n))) return "—";
  const rounded = Math.round(Number(n) * 100) / 100;
  return rounded.toString().replace(".", ",");
}

/* -------- Fenêtre professionnelle (remplace alert()) -------- */
function showSiteAlert(title, message) {
  let back = document.getElementById("site-alert-backdrop");
  if (!back) {
    const style = document.createElement("style");
    style.textContent = `
      #site-alert-backdrop{display:flex;position:fixed;inset:0;background:rgba(15,29,51,0.45);align-items:center;justify-content:center;z-index:9999;padding:16px}
      #site-alert-box{background:#fff;border-radius:14px;max-width:400px;width:100%;padding:24px;box-shadow:0 20px 50px rgba(0,0,0,0.25);font-family:inherit}
      #site-alert-box h3{margin:0 0 10px;color:#0F1D33;font-size:16px}
      #site-alert-box p{margin:0 0 18px;color:#333;font-size:14px;line-height:1.5}
      #site-alert-box button{background:#0F1D33;color:#fff;border:none;border-radius:8px;padding:10px 18px;font-size:13.5px;font-weight:600;cursor:pointer;width:100%}
    `;
    document.head.appendChild(style);
    back = document.createElement("div");
    back.id = "site-alert-backdrop";
    back.innerHTML = `<div id="site-alert-box"><h3 id="site-alert-title"></h3><p id="site-alert-msg"></p><button onclick="document.getElementById('site-alert-backdrop').style.display='none'">OK</button></div>`;
    back.addEventListener("click", (e) => { if (e.target === back) back.style.display = "none"; });
    document.body.appendChild(back);
  }
  document.getElementById("site-alert-title").textContent = title || "Information";
  document.getElementById("site-alert-msg").textContent = message || "";
  back.style.display = "flex";
}

/* -------- Génération PDF (impression) : bulletins, notifications, avis -------- */
const PRINT_CSS = `
  @page{ size:A4; margin:16mm 14mm; }
  *{box-sizing:border-box}
  body{font-family:Georgia,"Times New Roman",serif;color:#161616;margin:0;font-size:12.6px;line-height:1.55}
  .doc{max-width:800px;margin:0 auto}
  .doc-head{display:flex;align-items:center;gap:14px;border-bottom:3px double #0F1D33;padding-bottom:10px;margin-bottom:18px}
  .doc-seal{width:52px;height:52px;border-radius:50%;border:3px solid #0F1D33;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:#0F1D33;flex:0 0 auto}
  .doc-school{font-size:16px;font-weight:700;color:#0F1D33}
  .doc-title{text-align:center;font-size:15.5px;text-transform:uppercase;letter-spacing:1.4px;font-weight:700;margin:8px 0 16px;color:#0F1D33}
  .doc-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;margin-bottom:14px}
  .doc-field{display:flex;font-size:12px;padding:3px 0;border-bottom:1px dotted #ccc}
  .doc-field .k{color:#555;min-width:120px}
  .doc-field .v{font-weight:600;color:#111}
  table.doc-table{width:100%;border-collapse:collapse;margin:10px 0;font-size:12px}
  table.doc-table th{background:#EDEAE1;border:1px solid #999;padding:6px 8px;text-align:left;font-size:11px;text-transform:uppercase}
  table.doc-table td{border:1px solid #ccc;padding:6px 8px}
  table.doc-table td.num,table.doc-table th.num{text-align:center}
  table.doc-table tr.total-row td{font-weight:700;background:#F6F4EE;border-top:2px solid #0F1D33}
  .doc-msg{margin:14px 0;white-space:pre-wrap;text-align:justify}
  .doc-footer{margin-top:34px;font-size:10px;color:#888;text-align:center;border-top:1px solid #ddd;padding-top:8px}
  .doc-bulletin{font-size:11.3px;line-height:1.35}
  .doc-bulletin table.doc-table{margin:6px 0;font-size:11px;page-break-inside:avoid}
  .doc-bulletin table.doc-table th{padding:4px 6px;font-size:10px}
  .doc-bulletin table.doc-table td{padding:3px 6px}
  .doc-bulletin{page-break-inside:avoid;page-break-after:avoid}
  .doc-bulletin{max-width:680px;margin-left:auto;margin-right:auto}
`;
function openPrintable(title, bodyHTML) {
  const fullHTML = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
    <title>${escapeHTML(title)}</title><style>${PRINT_CSS}</style></head><body>
    ${bodyHTML}
    <script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>
    </body></html>`;

  // Méthode principale : URL Blob (plus fiable que document.write dans certains
  // navigateurs/environnements restreints).
  try {
    const blob = new Blob([fullHTML], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) { URL.revokeObjectURL(url); throw new Error("popup-blocked"); }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return;
  } catch (e) {
    // Repli : ancienne méthode (document.write)
    const win = window.open("", "_blank");
    if (!win) { showSiteAlert("Fenêtre bloquée", "Autorisez les fenêtres pop-up dans votre navigateur pour télécharger ce document."); return; }
    win.document.open();
    win.document.write(fullHTML);
    win.document.close();
  }
}
function docHeadHTML() {
  return `<div class="doc-head"><div class="doc-seal">🎓</div><div class="doc-school">${escapeHTML(SCHOOL_NAME)}</div></div>`;
}
function downloadNotificationPDF(n) {
  const html = `<div class="doc">
    ${docHeadHTML()}
    <div class="doc-title">${escapeHTML(n.type || "Notification")}</div>
    <div class="doc-grid">
      <div class="doc-field"><span class="k">Élève</span><span class="v">${escapeHTML(studentFullName(currentStudent))}</span></div>
      <div class="doc-field"><span class="k">Date</span><span class="v">${fmtDate(n.date)}</span></div>
    </div>
    <h3 style="font-size:14px;color:#0F1D33;margin-bottom:6px">${escapeHTML(n.title)}</h3>
    <p class="doc-msg">${escapeHTML(n.message)}</p>
    <div class="doc-footer">Document généré depuis l'espace parents — ${escapeHTML(SCHOOL_NAME)}</div>
  </div>`;
  openPrintable(n.title, html);
}
/* -------- Construction du document "bulletin" — SOURCE UNIQUE, utilisée à
   l'identique pour l'aperçu à l'écran ET pour le PDF, afin que les deux
   soient rigoureusement identiques (aucune divergence possible). -------- */
function buildBulletinDocHTML(b) {
  const sc = Number(b.scale) || 20;
  const hasCoef = Array.isArray(b.subjects) && b.subjects.some((g) => g.coef != null);
  const rowsSubjects = (Array.isArray(b.subjects) && b.subjects.length) ? `
    <table class="doc-table"><thead><tr><th>Matière</th>${hasCoef ? '<th class="num">Coef.</th>' : ""}<th class="num">Moyenne</th><th>Appréciation</th></tr></thead>
    <tbody>${b.subjects.map((g) => `<tr><td>${escapeHTML(g.name)}</td>${hasCoef ? `<td class="num">${g.coef != null ? escapeHTML(g.coef) : "—"}</td>` : ""}<td class="num">${g.average20 != null ? fmtNote(toBar(g.average20, sc)) + " / " + sc : "—"}</td><td>${escapeHTML(g.appreciation || "—")}</td></tr>`).join("")}</tbody>
    <tfoot><tr class="total-row"><td colspan="${hasCoef ? 2 : 1}">Moyenne générale</td><td class="num">${b.average20 != null ? fmtNote(toBar(b.average20, sc)) + " / " + sc : "—"}</td><td></td></tr></tfoot></table>` : "";
  const hasTerms = b.t1 !== undefined || b.t2 !== undefined || b.t3 !== undefined;
  const rowsTerms = hasTerms ? `
    <table class="doc-table"><thead><tr><th>Trimestre</th><th class="num">Moyenne /${sc}</th></tr></thead>
    <tbody>${[b.t1, b.t2, b.t3].map((m, i) => `<tr><td>Trimestre ${i + 1}</td><td class="num">${m != null ? fmtNote(toBar(m, sc)) : "—"}</td></tr>`).join("")}</tbody>
    <tfoot><tr class="total-row"><td>Moyenne annuelle</td><td class="num">${b.average20 != null ? fmtNote(toBar(b.average20, sc)) : "—"}</td></tr></tfoot></table>` : "";
  return `<div class="doc doc-bulletin">
    ${docHeadHTML()}
    <div class="doc-title">Bulletin — ${escapeHTML(b.periodLabel || "")}</div>
    <div class="doc-grid">
      <div class="doc-field"><span class="k">Élève</span><span class="v">${escapeHTML(studentFullName(currentStudent))}</span></div>
      <div class="doc-field"><span class="k">Classe</span><span class="v">${escapeHTML(b.className || "")}</span></div>
      <div class="doc-field"><span class="k">Année scolaire</span><span class="v">${escapeHTML(b.schoolYear || "—")}</span></div>
      <div class="doc-field"><span class="k">Publié le</span><span class="v">${fmtDate(b.publishedAt)}</span></div>
    </div>
    ${rowsSubjects}${rowsTerms}
    <div class="doc-grid" style="margin-top:8px">
      <div class="doc-field"><span class="k">Rang</span><span class="v">${b.rank > 0 ? b.rank + " / " + (b.classSize || "—") : "—"}</span></div>
      <div class="doc-field"><span class="k">Appréciation générale</span><span class="v" style="font-style:italic">${escapeHTML(b.appreciation || "—")}</span></div>
    </div>
    <div class="doc-footer">Document généré depuis l'espace parents — ${escapeHTML(SCHOOL_NAME)}</div>
  </div>`;
}
function downloadBulletinPDF(b) {
  openPrintable(`Bulletin - ${studentFullName(currentStudent)}`, buildBulletinDocHTML(b));
}

/* -------- Rend PRINT_CSS utilisable à l'écran (pas seulement dans la fenêtre
   d'impression) en préfixant chaque règle par .doc-preview-wrap, pour que
   l'aperçu dans le tableau de bord ait EXACTEMENT le même rendu visuel que
   le document imprimé — sans jamais affecter le reste du site (nav, boutons…). -------- */
function scopeCss(css, scopeSelector) {
  return css
    .replace(/@page[^}]*\}/g, "") // la mise en page d'impression n'a pas de sens à l'écran
    .replace(/([^{}]+)\{/g, (m, selectors) => {
      const scoped = selectors.split(",").map((s) => {
        s = s.trim();
        if (!s) return s;
        return s === "body" ? scopeSelector : `${scopeSelector} ${s}`;
      }).join(", ");
      return `${scoped}{`;
    });
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("school-name-display").textContent = SCHOOL_NAME;
  document.title = SCHOOL_NAME + " — Espace parents";

  // Injecte le style du document officiel (identique à l'impression) pour que
  // l'aperçu du bulletin à l'écran soit un vrai "copier-coller" du document.
  const docPreviewStyle = document.createElement("style");
  docPreviewStyle.textContent = scopeCss(PRINT_CSS, ".doc-preview-wrap") + `
    .doc-preview-wrap{background:#fff;padding:20px 24px;border-radius:10px;box-shadow:0 2px 14px rgba(0,0,0,0.1);border:1px solid #e6e6e6;margin-top:10px}
  `;
  document.head.appendChild(docPreviewStyle);

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    db = firebase.firestore();
  } catch (e) {
    showLoginError("Le site n'est pas encore configuré (voir js/firebase-config.js).");
  }

  document.getElementById("login-form").addEventListener("submit", (e) => { e.preventDefault(); doLogin(); });
  document.getElementById("logout-link").addEventListener("click", (e) => { e.preventDefault(); doLogout(); });
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.addEventListener("click", () => switchTab(btn.dataset.tab)));

  window.addEventListener("online", updateOfflineBanner);
  window.addEventListener("offline", updateOfflineBanner);
  updateOfflineBanner();

  // Reprise de session
  const saved = sessionStorage.getItem("parent_matricule");
  if (saved) loginWithMatricule(saved, null, true);
});

function updateOfflineBanner() {
  document.getElementById("offline-banner").classList.toggle("show", !navigator.onLine);
}

function showLoginError(msg) {
  document.getElementById("login-error").textContent = msg;
}

async function doLogin() {
  const matricule = document.getElementById("login-matricule").value.trim();
  const lastName = document.getElementById("login-lastname").value.trim();
  if (!matricule || !lastName) return showLoginError("Renseignez le matricule et le nom de famille de l'élève.");
  await loginWithMatricule(matricule, lastName, false);
}

async function loginWithMatricule(matricule, lastName, silent) {
  showLoginError("");
  if (!db) return showLoginError("Le site n'est pas encore configuré. Contactez l'établissement.");
  try {
    const studentsCol = schoolRef().collection("students");
    /* Recherche par matricule (l'identifiant du document est un code interne, pas le matricule) */
    let snap = await studentsCol.where("matricule", "==", matricule).get();
    if (snap.empty && matricule.toUpperCase() !== matricule) snap = await studentsCol.where("matricule", "==", matricule.toUpperCase()).get();
    if (snap.empty) { if (!silent) showLoginError("Aucun élève trouvé avec ce matricule."); return; }

    /* Si plusieurs fiches ont le même matricule, celle dont le nom correspond est retenue */
    const found = snap.docs.map((d) => d.data());
    const student = (lastName && found.find((s) => norm(s.nom) === norm(lastName))) || found[0];
    if (!silent && lastName && norm(student.nom) !== norm(lastName)) {
      showLoginError("Le nom de famille ne correspond pas à ce matricule.");
      return;
    }

    /* Nom de la classe : l'application n'envoie que l'identifiant de classe sur la fiche élève */
    student.className = "";
    if (student.classId) {
      try {
        const c = await schoolRef().collection("classes").doc(String(student.classId)).get();
        if (c.exists) { student.className = c.data().name || ""; student.monthlyFee = Number(c.data().monthlyFee) || 0; }
      } catch (e) { /* la classe reste "non renseignée" */ }
    }

    /* Paramètres de l'école : année scolaire, mois de rentrée, devise */
    schoolSettings = {};
    try {
      const st = await schoolRef().collection("settings").doc("school").get();
      if (st.exists) schoolSettings = st.data() || {};
    } catch (e) { /* valeurs par défaut */ }

    currentStudent = student;
    sessionStorage.setItem("parent_matricule", student.matricule);
    enterDashboard(student);
  } catch (e) {
    console.warn("Connexion :", e);
    if (e && e.code === "permission-denied") showLoginError("Accès refusé par la base de données : les règles Firestore doivent autoriser la lecture.");
    else showLoginError("Connexion impossible : vérifiez votre accès internet et réessayez.");
  }
}

function doLogout() {
  sessionStorage.removeItem("parent_matricule");
  if (unsubNotifs) unsubNotifs();
  if (unsubRemarks) unsubRemarks();
  if (unsubBulletins) unsubBulletins();
  if (unsubPayments) unsubPayments();
  currentStudent = null;
  document.getElementById("dashboard-view").classList.add("hidden");
  document.getElementById("login-view").classList.remove("hidden");
  document.getElementById("login-matricule").value = "";
  document.getElementById("login-lastname").value = "";
}

function switchTab(tab) {
  document.querySelectorAll(".tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "panel-" + tab));
}

function enterDashboard(student) {
  document.getElementById("login-view").classList.add("hidden");
  document.getElementById("dashboard-view").classList.remove("hidden");

  const photoWrap = document.getElementById("student-photo-wrap");
  photoWrap.innerHTML = `<div class="student-photo placeholder">${escapeHTML(initials(student.prenom, student.nom))}</div>`;
  document.getElementById("student-name").textContent = studentFullName(student);
  document.getElementById("student-meta").textContent = `${student.className || "Classe non renseignée"} · Matricule ${student.matricule}`;

  listenNotifications(student);
  listenRemarks(student);
  listenBulletins(student);
  listenPayments(student);
}

/* -------- Notifications (temps réel) -------- */
function listenNotifications(student) {
  if (unsubNotifs) unsubNotifs();
  const box = document.getElementById("notif-list");
  unsubNotifs = schoolRef().collection("notifications")
    .onSnapshot((snap) => {
      let list = [];
      snap.forEach((d) => list.push(d.data()));
      /* target = "all" (toute l'école) ou l'identifiant d'une classe */
      list = list.filter((n) => !n.target || n.target === "all" || n.target === student.classId);
      list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      window.__notifCache = list;
      box.innerHTML = list.length ? list.map((n, idx) => `
        <div class="card notif-card">
          <div class="notif-ic">${NOTIF_ICONS[notifKind(n.type)]}</div>
          <div style="flex:1">
            <div class="notif-badge">${escapeHTML(n.type || "Information")}</div>
            <div class="notif-title">${escapeHTML(n.title)}</div>
            <div class="notif-date">${fmtDate(n.date)}</div>
            <div class="notif-msg">${escapeHTML(n.message)}</div>
            <button class="pdf-btn" onclick="downloadNotificationPDF(window.__notifCache[${idx}])">⬇ Télécharger en PDF</button>
          </div>
        </div>`).join("") : `<p class="empty-note">Aucune notification pour le moment.</p>`;
    }, () => { box.innerHTML = `<p class="empty-note">Impossible de charger les notifications (vérifiez votre connexion).</p>`; });
}

/* -------- Remarques (temps réel) -------- */
function listenRemarks(student) {
  if (unsubRemarks) unsubRemarks();
  const box = document.getElementById("remark-list");
  unsubRemarks = schoolRef().collection("remarks")
    .where("studentId", "==", student.id)
    .onSnapshot((snap) => {
      let list = [];
      snap.forEach((d) => list.push(d.data()));
      list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      box.innerHTML = list.length ? `<div class="card">${list.map((r) => `
        <div class="remark-row">
          <div class="dot ${escapeHTML(r.severity || "vert")}"></div>
          <div>
            <div class="remark-type">${escapeHTML(r.type || "Remarque")}</div>
            <div class="remark-desc">${escapeHTML(r.text || "")}</div>
            <div class="remark-date">${fmtDate(r.date)}${r.author ? " · " + escapeHTML(r.author) : ""}</div>
          </div>
        </div>`).join("")}</div>` : `<p class="empty-note">Aucune remarque enregistrée pour le moment.</p>`;
    }, () => { box.innerHTML = `<p class="empty-note">Impossible de charger les remarques (vérifiez votre connexion).</p>`; });
}

/* -------- Bulletins (temps réel) -------- */
function listenBulletins(student) {
  if (unsubBulletins) unsubBulletins();
  const box = document.getElementById("bulletin-list");
  unsubBulletins = schoolRef().collection("bulletins")
    .where("studentId", "==", student.id)
    .onSnapshot((snap) => {
      let list = [];
      snap.forEach((d) => list.push(d.data()));
      list.sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""));
      window.__bulletinCache = list;
      box.innerHTML = list.length ? list.map((b, idx) => `
        <div class="card">
          <div class="bulletin-head" onclick="toggleBulletin(${idx})">
            <div>
              <h3>${escapeHTML(b.periodLabel || "Bulletin")}</h3>
              <div class="notif-date">${escapeHTML(b.className || "")} · Publié le ${fmtDate(b.publishedAt)}</div>
            </div>
            <div class="bulletin-avg">${b.average20 != null ? fmtNote(toBar(b.average20, b.scale)) + "/" + (Number(b.scale) || 20) : "—"}</div>
          </div>
          <div class="bulletin-details" id="bulletin-details-${idx}">
            <div class="doc-preview-wrap">${buildBulletinDocHTML(b)}</div>
            <button class="pdf-btn" onclick="downloadBulletinPDF(window.__bulletinCache[${idx}])">⬇ Télécharger en PDF</button>
          </div>
        </div>`).join("") : `<p class="empty-note">Aucun bulletin publié pour le moment.</p>`;
    }, () => { box.innerHTML = `<p class="empty-note">Impossible de charger les bulletins (vérifiez votre connexion).</p>`; });
}
function toggleBulletin(idx) {
  document.getElementById("bulletin-details-" + idx).classList.toggle("open");
}


/* =========================================================
   Paiements : progression annuelle + reçu de chaque mois
   ========================================================= */
const MONTH_NAMES = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
function monthLabelFR(k) { if (!k) return "—"; const [y, m] = k.split("-").map(Number); return MONTH_NAMES[m - 1] + " " + y; }
function shiftMonth(k, n) {
  const [y, m] = k.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}
/* Mois de l'année scolaire : de la rentrée (octobre par défaut) à juin */
function schoolMonthsList() {
  const m = String(schoolSettings.schoolYear || "").match(/(\d{4})/);
  const y = m ? Number(m[1]) : new Date().getFullYear();
  const start = Number(schoolSettings.startMonth || 10);
  const to = (y + 1) + "-06";
  const out = [];
  let k = y + "-" + String(start).padStart(2, "0"), guard = 0;
  while (k <= to && guard++ < 60) { out.push(k); k = shiftMonth(k, 1); }
  return out;
}
function money(n) {
  return Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/[\u202f\u00a0]/g, " ") + " " + (schoolSettings.currency || "FCFA");
}
/* Scolarité mensuelle (les autres frais — inscription, tenue… — ne font pas avancer la jauge) */
function isTuition(p) { return p.kind ? p.kind === "scolarite" : norm(p.label).includes("scolarite"); }

function listenPayments(student) {
  if (unsubPayments) unsubPayments();
  const box = document.getElementById("payment-list");
  unsubPayments = schoolRef().collection("payments")
    .where("studentId", "==", student.id)
    .onSnapshot((snap) => {
      const pays = [];
      snap.forEach((d) => pays.push(d.data()));
      pays.sort((a, b) => ((b.date || "") + (b.time || "")).localeCompare((a.date || "") + (a.time || "")));
      window.__payCache = pays;
      renderPayments(box, student, pays);
    }, () => { box.innerHTML = `<p class="empty-note">Impossible de charger les paiements (vérifiez votre connexion).</p>`; });
}

function renderPayments(box, student, pays) {
  const months = schoolMonthsList(), monthSet = new Set(months);
  const fee = Number(student.monthlyFee) || 0;
  const du = fee * months.length;
  const verse = pays.filter((p) => isTuition(p) && monthSet.has(p.month)).reduce((t, p) => t + (Number(p.amount) || 0), 0);
  const reste = Math.max(0, du - verse);
  const pct = du > 0 ? Math.min(100, Math.round((verse / du) * 100)) : 0;
  const color = pct >= 75 ? "#1f7a4d" : pct >= 35 ? "#b7791f" : "#b3261e";
  const r = 64, circ = 2 * Math.PI * r, off = circ - (pct / 100) * circ;

  const summary = `
    <div class="card pay-summary">
      <div class="pay-title">Progression annuelle de la scolarité (${months.length} mois)</div>
      <div class="pay-gauge-row">
        <div class="pay-ring">
          <svg viewBox="0 0 160 160" aria-hidden="true">
            <circle cx="80" cy="80" r="${r}" fill="none" stroke="#ece9e2" stroke-width="14"/>
            <circle cx="80" cy="80" r="${r}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"
              stroke-dasharray="${circ}" stroke-dashoffset="${off}" transform="rotate(-90 80 80)"/>
          </svg>
          <div class="pay-ring-text" style="color:${color}">${pct}%</div>
        </div>
        <div class="pay-figures">
          <div class="pay-big">${money(verse)} versés</div>
          ${fee > 0
            ? `<div>Total annuel dû : <b>${money(du)}</b></div>
               <div>Restant à verser : <b style="color:${reste > 0 ? "#b3261e" : "#1f7a4d"}">${money(reste)}</b></div>`
            : `<div class="pay-muted">La scolarité mensuelle de la classe n'est pas encore renseignée par l'établissement.</div>`}
        </div>
      </div>
    </div>`;

  const extra = Array.from(new Set(pays.map((p) => p.month).filter((k) => k && !monthSet.has(k)))).sort();
  const monthsHTML = months.concat(extra).map((k) => {
    const list = pays.filter((p) => p.month === k);
    const tuition = list.filter(isTuition).reduce((t, p) => t + (Number(p.amount) || 0), 0);
    const inYear = monthSet.has(k) && fee > 0;
    const badge = !inYear ? "" : tuition <= 0 ? '<span class="pay-stamp bad">Non payé</span>' : tuition >= fee ? '<span class="pay-stamp ok">Payé</span>' : '<span class="pay-stamp warn">Partiel</span>';
    const mp = inYear ? Math.min(100, Math.round((tuition / fee) * 100)) : null;
    const rows = list.length ? list.map((p) => `
        <div class="pay-row">
          <div class="pay-row-main">
            <div class="pay-row-label">${escapeHTML(p.label || "Paiement")}</div>
            <div class="pay-row-meta">${p.receiptNo ? "Reçu " + escapeHTML(p.receiptNo) + " · " : ""}${fmtDate(p.date)}${p.mode ? " · " + escapeHTML(p.mode) : ""}</div>
          </div>
          <div class="pay-row-amt">${money(p.amount)}</div>
          <button class="pdf-btn" onclick="downloadReceiptPDF(window.__payCache[${pays.indexOf(p)}])">⬇ Reçu</button>
        </div>`).join("") : `<div class="pay-muted">Aucun paiement ce mois.</div>`;
    return `<div class="pay-month">
      <div class="pay-mh"><b>${monthLabelFR(k)}</b>
        <span class="pay-right">${badge}<span class="pay-amt">${money(tuition)}${monthSet.has(k) && fee > 0 ? " / " + money(fee) : ""}${mp != null ? " · " + mp + "%" : ""}</span></span>
      </div>${rows}</div>`;
  }).join("");

  box.innerHTML = summary + `<div class="card">
    <div class="pay-title">Paiements par mois · ${pays.length} reçu(s)</div>${monthsHTML}</div>`;
}

function buildReceiptDocHTML(p) {
  const s = currentStudent || {};
  return `<div class="doc">
    ${docHeadHTML()}
    <div class="doc-title">Reçu de paiement${p.receiptNo ? " N° " + escapeHTML(p.receiptNo) : ""}</div>
    <div class="doc-grid">
      <div class="doc-field"><span class="k">Élève</span><span class="v">${escapeHTML(studentFullName(s))}</span></div>
      <div class="doc-field"><span class="k">Matricule</span><span class="v">${escapeHTML(s.matricule || "—")}</span></div>
      <div class="doc-field"><span class="k">Classe</span><span class="v">${escapeHTML(s.className || "—")}</span></div>
      <div class="doc-field"><span class="k">Date du paiement</span><span class="v">${fmtDate(p.date)}</span></div>
      <div class="doc-field"><span class="k">Mois concerné</span><span class="v">${monthLabelFR(p.month)}</span></div>
      <div class="doc-field"><span class="k">Mode de paiement</span><span class="v">${escapeHTML(p.mode || "—")}</span></div>
    </div>
    <table class="doc-table">
      <thead><tr><th>Motif</th><th class="num">Montant</th></tr></thead>
      <tbody><tr><td>${escapeHTML(p.label || "Paiement")}</td><td class="num">${money(p.amount)}</td></tr></tbody>
      <tfoot><tr class="total-row"><td>Total reçu</td><td class="num">${money(p.amount)}</td></tr></tfoot>
    </table>
    <div class="doc-footer">Document généré depuis l'espace parents — ${escapeHTML(SCHOOL_NAME)}</div>
  </div>`;
}
function downloadReceiptPDF(p) {
  openPrintable("Reçu " + (p.receiptNo || "") + " - " + studentFullName(currentStudent), buildReceiptDocHTML(p));
}