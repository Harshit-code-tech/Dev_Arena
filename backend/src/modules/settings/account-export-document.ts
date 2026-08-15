type RecordLike = Record<string, unknown>;

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

function dateValue(value: unknown) {
  if (!value) return "Not recorded";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : escapeHtml(new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date));
}

function simpleValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return escapeHtml(value);
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return dateValue(value);
    return escapeHtml(value.replaceAll("_", " "));
  }
  if (Array.isArray(value)) return value.length ? value.map(simpleValue).join(", ") : "None";
  if (typeof value === "object") {
    const entries = Object.entries(value as RecordLike).filter(([, item]) => item !== null && item !== undefined && item !== "");
    return entries.length ? entries.map(([key, item]) => `${escapeHtml(label(key))}: ${simpleValue(item)}`).join("; ") : "None";
  }
  return escapeHtml(value);
}

function definitionList(data: RecordLike) {
  return `<dl class="facts">${Object.entries(data).map(([key, value]) => `<div><dt>${escapeHtml(label(key))}</dt><dd>${simpleValue(value)}</dd></div>`).join("")}</dl>`;
}

function empty(text = "No records in this section.") {
  return `<p class="empty">${escapeHtml(text)}</p>`;
}

function table(rows: RecordLike[], columns: Array<[string, string]>) {
  if (!rows.length) return empty();
  return `<div class="table-wrap"><table><thead><tr>${columns.map(([, title]) => `<th>${escapeHtml(title)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map(([key]) => `<td>${simpleValue(row[key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function person(personValue: unknown) {
  const item = personValue && typeof personValue === "object" ? personValue as RecordLike : {};
  return [item.name, item.username ? `@${item.username}` : null, item.email].filter(Boolean).map((value) => String(value)).join(" · ") || "Account unavailable";
}

function projectCards(projects: RecordLike[]) {
  if (!projects.length) return empty("No projects have been recorded.");
  return `<div class="cards">${projects.map((project) => {
    const logs = Array.isArray(project.logs) ? project.logs as RecordLike[] : [];
    const milestones = Array.isArray(project.milestones) ? project.milestones as RecordLike[] : [];
    const github = [project.githubRepositoryFullName, project.githubVisibility, project.githubContributionStatus].filter(Boolean).map(simpleValue).join(" · ");
    return `<article class="card"><div class="card-head"><div><span>${simpleValue(project.domain)} project</span><h3>${simpleValue(project.title)}</h3></div><b>${simpleValue(project.status)}</b></div><p>${simpleValue(project.description || "No description provided.")}</p>${github ? `<p class="muted">GitHub: ${github}</p>` : ""}<div class="mini-grid"><span>Project score <strong>${simpleValue(project.projectScore)}</strong></span><span>Sessions <strong>${logs.length}</strong></span><span>Milestones <strong>${milestones.length}</strong></span><span>Shared <strong>${simpleValue(project.isShared)}</strong></span></div>${logs.length ? `<details><summary>Work sessions</summary>${table(logs, [["activityDate","Date"],["description","Work"],["timeSpent","Minutes"],["proofLink","Proof"]])}</details>` : ""}${milestones.length ? `<details><summary>Milestones</summary>${table(milestones, [["title","Milestone"],["status","Status"],["description","Description"],["updatedAt","Updated"]])}</details>` : ""}</article>`;
  }).join("")}</div>`;
}

export function renderAccountExportDocument(payload: RecordLike) {
  const report = (payload.report || {}) as RecordLike;
  const profile = (payload.profile || {}) as RecordLike;
  const progress = (payload.developerProgress || {}) as RecordLike;
  const preferences = (payload.preferences || {}) as RecordLike;
  const github = (payload.github || {}) as RecordLike;
  const scoring = (payload.scoring || {}) as RecordLike;
  const network = (payload.network || {}) as RecordLike;
  const messaging = (payload.secureMessaging || {}) as RecordLike;
  const projects = Array.isArray(payload.projects) ? payload.projects as RecordLike[] : [];
  const dsa = Array.isArray(payload.dsaHistory) ? payload.dsaHistory as RecordLike[] : [];
  const practice = Array.isArray(payload.practiceHistory) ? payload.practiceHistory as RecordLike[] : [];
  const fullstack = Array.isArray(payload.legacyFullstackHistory) ? payload.legacyFullstackHistory as RecordLike[] : [];
  const notifications = Array.isArray(payload.notifications) ? payload.notifications as RecordLike[] : [];
  const achievements = Array.isArray(payload.achievements) ? payload.achievements as RecordLike[] : [];
  const activities = Array.isArray(payload.activityHistory) ? payload.activityHistory as RecordLike[] : [];
  const weeklyScores = Array.isArray(scoring.weeklyScores) ? scoring.weeklyScores as RecordLike[] : [];
  const scoreEvents = Array.isArray(scoring.scoreEvents) ? scoring.scoreEvents as RecordLike[] : [];
  const friends = Array.isArray(network.friends) ? network.friends as RecordLike[] : [];
  const sentRequests = Array.isArray(network.sentRequests) ? network.sentRequests as RecordLike[] : [];
  const receivedRequests = Array.isArray(network.receivedRequests) ? network.receivedRequests as RecordLike[] : [];
  const invites = Array.isArray(network.emailInvitations) ? network.emailInvitations as RecordLike[] : [];
  const repos = Array.isArray(github.authorizedRepositories) ? github.authorizedRepositories as RecordLike[] : [];

  const friendRows = friends.map((item) => ({ person: person(item.person), connectedAt: item.connectedAt }));
  const sentRows = sentRequests.map((item) => ({ person: person(item.person), status: item.status, createdAt: item.createdAt }));
  const receivedRows = receivedRequests.map((item) => ({ person: person(item.person), status: item.status, createdAt: item.createdAt }));

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(report.title || "DevArena Personal Data Report")}</title><style>
  :root{color-scheme:light;--ink:#121214;--muted:#67676f;--line:#d9d9df;--soft:#f5f5f7;--black:#050506}*{box-sizing:border-box}body{margin:0;background:#ececef;color:var(--ink);font:14px/1.55 Arial,Helvetica,sans-serif}.document{width:min(1120px,calc(100% - 32px));margin:32px auto;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.12)}header.cover{background:var(--black);color:#fff;padding:48px 52px}.eyebrow{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#b7b7bd}.cover h1{margin:8px 0 14px;font-size:42px;line-height:1;text-transform:uppercase;letter-spacing:.03em}.cover p{max-width:820px;color:#d0d0d5}.meta{display:flex;gap:24px;flex-wrap:wrap;margin-top:26px}.meta span{border-left:1px solid #444;padding-left:12px}.content{padding:36px 52px 60px}.notice{border:1px solid var(--line);background:var(--soft);padding:16px 18px;margin-bottom:28px}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border:1px solid var(--line);margin-bottom:34px}.summary div{padding:18px;border-right:1px solid var(--line)}.summary div:last-child{border-right:0}.summary span,.mini-grid span{display:block;color:var(--muted);font-size:10px;letter-spacing:.11em;text-transform:uppercase}.summary strong{display:block;margin-top:5px;font-size:22px}section{padding:28px 0;border-top:1px solid var(--line)}section:first-of-type{border-top:0}section>h2{margin:0 0 6px;font-size:25px;text-transform:uppercase;letter-spacing:.025em}section>.section-note{margin:0 0 18px;color:var(--muted)}.facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));margin:0;border-top:1px solid var(--line)}.facts div{display:grid;grid-template-columns:160px 1fr;gap:12px;padding:11px 0;border-bottom:1px solid var(--line)}.facts div:nth-child(odd){padding-right:20px}.facts dt{color:var(--muted)}.facts dd{margin:0;overflow-wrap:anywhere}.table-wrap{overflow:auto;border:1px solid var(--line)}table{width:100%;border-collapse:collapse;min-width:650px}th,td{text-align:left;vertical-align:top;padding:10px 12px;border-bottom:1px solid var(--line);overflow-wrap:anywhere}th{background:var(--soft);font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:#505058}tr:last-child td{border-bottom:0}.cards{display:grid;gap:12px}.card{border:1px solid var(--line);padding:18px}.card-head{display:flex;justify-content:space-between;gap:16px}.card-head span{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}.card h3{margin:3px 0 0;font-size:18px}.card p{margin:12px 0}.muted,.empty{color:var(--muted)}.mini-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;background:var(--soft);padding:12px}.mini-grid strong{display:block;margin-top:3px;color:var(--ink);font-size:13px;letter-spacing:0;text-transform:none}details{margin-top:12px}summary{cursor:pointer;font-weight:700}.security{border-left:3px solid var(--black);padding:4px 0 4px 16px}.footer{padding:20px 52px;background:var(--soft);border-top:1px solid var(--line);color:var(--muted);font-size:12px}@media(max-width:760px){header.cover,.content,.footer{padding-left:22px;padding-right:22px}.summary,.facts{grid-template-columns:1fr}.summary div{border-right:0;border-bottom:1px solid var(--line)}.summary div:last-child{border-bottom:0}.facts div:nth-child(odd){padding-right:0}.mini-grid{grid-template-columns:1fr 1fr}.cover h1{font-size:32px}}@media print{body{background:#fff}.document{width:100%;margin:0;box-shadow:none}.card,table,.summary{break-inside:avoid}details{display:block}details>*{display:block}summary{display:none}}
  </style></head><body><main class="document"><header class="cover"><span class="eyebrow">Personal data export</span><h1>${escapeHtml(report.title || "DevArena Personal Data Report")}</h1><p>${escapeHtml(report.description || "A readable copy of your DevArena account data.")}</p><div class="meta"><span><b>Account</b><br>${escapeHtml(profile.name || "Unknown")} · @${escapeHtml(profile.username || "unknown")}</span><span><b>Generated</b><br>${dateValue(report.exportedAt)}</span></div></header><div class="content"><div class="notice"><b>How to use this report:</b> Open it in any modern browser. You can print it or use the browser's <i>Save as PDF</i> option. Security credentials and unreadable encrypted payloads are intentionally omitted.</div><div class="summary"><div><span>Arena score</span><strong>${simpleValue(progress.arenaScore)}</strong></div><div><span>Rank</span><strong>${simpleValue(progress.rank)}</strong></div><div><span>Projects</span><strong>${projects.length}</strong></div><div><span>DSA logs</span><strong>${dsa.length}</strong></div></div>
  <section><h2>Account profile</h2><p class="section-note">Identity, account status, public links, and legal acceptance information.</p>${definitionList({ name: profile.name, username: profile.username, email: profile.email, role: profile.role, joinedAt: profile.joinedAt, emailVerified: profile.emailVerified, avatarUrl: profile.avatarUrl })}${profile.links && typeof profile.links === "object" ? definitionList(profile.links as RecordLike) : ""}${profile.legal && typeof profile.legal === "object" ? definitionList(profile.legal as RecordLike) : ""}</section>
  <section><h2>Developer progress</h2><p class="section-note">Your current DevArena score, rank, streak, activity, and verified technology profile.</p>${definitionList(progress)}</section>
  <section><h2>Preferences</h2><p class="section-note">The settings currently applied to your DevArena account.</p>${definitionList(preferences)}</section>
  <section><h2>GitHub connection</h2><p class="section-note">Only non-secret GitHub connection and repository information is shown. OAuth tokens and installation credentials are excluded.</p>${definitionList({ connected: github.connected, login: github.login, connectedAt: github.connectedAt })}${table(repos, [["fullName","Repository"],["visibility","Visibility"],["permission","Permission"],["url","Repository URL"],["lastSyncedAt","Last synced"]])}</section>
  <section><h2>Projects</h2><p class="section-note">Projects, work sessions, milestones, public GitHub evidence, and project scores.</p>${projectCards(projects)}</section>
  <section><h2>DSA history</h2><p class="section-note">Problem-solving evidence recorded in DevArena.</p>${table(dsa, [["activityDate","Date"],["problemName","Problem"],["difficulty","Difficulty"],["timeTaken","Minutes"],["timeComplexity","Time complexity"],["spaceComplexity","Space complexity"],["notes","Notes"]])}</section>
  <section><h2>Practice history</h2>${table(practice, [["activityDate","Date"],["title","Session"],["type","Type"],["timeSpent","Minutes"],["notes","Notes"],["proofLink","Proof"]])}</section>
  ${fullstack.length ? `<section><h2>Legacy full-stack activity</h2><p class="section-note">Historical full-stack tracking records retained from earlier DevArena versions.</p>${table(fullstack, [["activityDate","Date"],["title","Activity"],["type","Type"],["category","Category"],["timeSpent","Minutes"],["description","Description"]])}</section>` : ""}
  <section><h2>Scoring history</h2><p class="section-note">Weekly score summaries and the individual score events that contributed to your Arena Score.</p><h3>Weekly scores</h3>${table(weeklyScores, [["weekStart","Week"],["dsaPoints","DSA"],["projectPoints","Projects"],["practicePoints","Practice"],["challengePoints","Tournament"],["totalScore","Total"],["activeDays","Active days"]])}<h3>Score events</h3>${table(scoreEvents, [["occurredAt","Date"],["category","Category"],["label","Activity"],["points","Points"]])}</section>
  <section><h2>Activity calendar</h2>${table(activities, [["date","Date"],["isActive","Active"]])}</section>
  <section><h2>Notifications</h2>${table(notifications, [["createdAt","Date"],["type","Type"],["message","Message"],["isRead","Read"],["link","Destination"]])}</section>
  <section><h2>Player network</h2><h3>Friends</h3>${table(friendRows, [["person","Player"],["connectedAt","Connected"]])}<h3>Sent requests</h3>${table(sentRows, [["person","Player"],["status","Status"],["createdAt","Sent"]])}<h3>Received requests</h3>${table(receivedRows, [["person","Player"],["status","Status"],["createdAt","Received"]])}<h3>Email invitations</h3>${table(invites, [["email","Email"],["status","Status"],["createdAt","Created"],["expiresAt","Expires"]])}</section>
  <section><h2>Achievements</h2>${table(achievements, [["unlockedAt","Unlocked"],["title","Achievement"],["category","Category"]])}</section>
  <section><h2>Secure messaging</h2><div class="security">${definitionList({ conversations: messaging.conversations, messagesSent: messaging.messagesSent, activeAuthorizedDevices: messaging.activeAuthorizedDevices })}<p>${escapeHtml(messaging.privacyNote || "Direct-message content is protected by end-to-end encryption.")}</p></div></section>
  </div><footer class="footer">Generated by DevArena on ${dateValue(report.exportedAt)}. This document is intended for the account holder and may contain personal information.</footer></main></body></html>`;
}
