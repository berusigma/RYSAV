/**
 * tempmail.js — Redesigned Temp Mail module with Server Separation & Account Management
 */
import { showToast, triggerHaptic } from "../utils/index.js";

const DOMAINS_SERVER_2 = [
  "@gmail10p.com",
  "@oletters.com",
  "@oemails.com",
  "@oegmail.com",
  "@suiemail.com",
  "@voewo.com",
  "@yanemail.com",
];

const SERVER1_API = "https://api.mail.tm";
const MAIL_PASS = "RysavMail2026!Secure";

let currentServer = localStorage.getItem("rysav_temp_server") || "server1";
let currentEmail = localStorage.getItem("rysav_temp_email") || null;
let currentToken = localStorage.getItem("rysav_temp_token") || null;
let currentAccountId = localStorage.getItem("rysav_temp_id") || null;

let pollingInterval = null;
let totalMessagesCount = 0;

function encPayload(obj) {
  try {
    const str = JSON.stringify(obj);
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.split("").reverse().join("");
  } catch (e) {
    return "";
  }
}

function decPayload(str) {
  try {
    if (!str) return {};
    const rev = String(str).split("").reverse().join("");
    const decodedStr = decodeURIComponent(escape(atob(rev)));
    return JSON.parse(decodedStr);
  } catch (e) {
    return {};
  }
}

function generateRandomName() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let res = "";
  for (let i = 0; i < 7; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return "user_" + res;
}

export function renderActiveEmailBanner() {
  const emailDisplay = document.getElementById("tempActiveEmailDisplay");
  const serverTag = document.getElementById("tempActiveServerTag");

  if (emailDisplay) {
    emailDisplay.textContent = currentEmail || "No Active Email";
  }
  if (serverTag) {
    serverTag.textContent = currentServer === "server2" ? "Server 2 (Custom)" : "Server 1 (Fast)";
  }
  renderSavedAccountsBar();
}

function renderSavedAccountsBar() {
  const container = document.getElementById("tempAccountsBar");
  if (!container) return;

  const history = JSON.parse(localStorage.getItem("rysav_mail_history") || "[]");
  if (history.length === 0) {
    container.innerHTML = `<span style="font-size:0.75rem; color:var(--text-secondary);">No saved emails yet.</span>`;
    return;
  }

  container.innerHTML = history.map((acc) => {
    const isActive = acc.email === currentEmail;
    return `
      <div class="stat-pill ${isActive ? "active-account-pill" : ""}" style="font-size:0.75rem; padding:4px 10px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; ${isActive ? "background:var(--primary); color:var(--on-primary);" : ""}">
        <span class="btn-switch-account" data-email="${acc.email}" data-token="${acc.token || ""}" data-id="${acc.id || ""}" data-server="${acc.server || "server1"}">${escapeHtml(acc.email)}</span>
        <span class="btn-del-account" data-email="${acc.email}" style="opacity:0.7; font-weight:bold; cursor:pointer; padding:0 2px;">✕</span>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".btn-switch-account").forEach((el) => {
    el.addEventListener("click", () => {
      const email = el.getAttribute("data-email");
      const token = el.getAttribute("data-token");
      const id = el.getAttribute("data-id");
      const server = el.getAttribute("data-server");
      setSession(email, token, id, server);
      checkTempMailState();
      showToast("Switched to email: " + email);
    });
  });

  container.querySelectorAll(".btn-del-account").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      const email = el.getAttribute("data-email");
      deleteSavedAccount(email);
    });
  });
}

export function deleteSavedAccount(emailToDelete) {
  let history = JSON.parse(localStorage.getItem("rysav_mail_history") || "[]");
  history = history.filter((h) => h.email !== emailToDelete);
  localStorage.setItem("rysav_mail_history", JSON.stringify(history));

  if (currentEmail === emailToDelete) {
    if (history.length > 0) {
      const nextAcc = history[0];
      setSession(nextAcc.email, nextAcc.token, nextAcc.id, nextAcc.server);
    } else {
      clearSession();
    }
  }
  showToast("Email deleted!");
  checkTempMailState();
}

function clearSession() {
  currentEmail = null;
  currentToken = null;
  currentAccountId = null;
  localStorage.removeItem("rysav_temp_email");
  localStorage.removeItem("rysav_temp_token");
  localStorage.removeItem("rysav_temp_id");
}

function setSession(email, token = null, id = null, server = currentServer) {
  currentEmail = email;
  currentToken = token;
  currentAccountId = id;
  currentServer = server;
  localStorage.setItem("rysav_temp_email", email);
  localStorage.setItem("rysav_temp_token", token || "");
  localStorage.setItem("rysav_temp_id", id || "");
  localStorage.setItem("rysav_temp_server", server);
}

function saveToHistory(email, token = null, id = null, server = currentServer) {
  let history = JSON.parse(localStorage.getItem("rysav_mail_history") || "[]");
  history = history.filter((h) => h.email !== email);
  history.unshift({ email, token, id, server });
  if (history.length > 10) history.pop();
  localStorage.setItem("rysav_mail_history", JSON.stringify(history));
}

export function checkTempMailState() {
  renderActiveEmailBanner();
  if (currentEmail) {
    startPolling();
  } else {
    if (pollingInterval) clearInterval(pollingInterval);
    updateNavBadges(0);
    const msgCounter = document.getElementById("tempMsgCounter");
    if (msgCounter) msgCounter.textContent = "0";
    renderInboxList([]);
  }
}

function updateNavBadges(count) {
  const badge1 = document.getElementById("tempMailBadge");
  const badge2 = document.getElementById("toolsMailBadge");

  [badge1, badge2].forEach((badge) => {
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 99 ? "99+" : count;
      badge.classList.remove("hidden");
    } else {
      badge.classList.add("hidden");
    }
  });
}

// Server 1 Email Generator
export async function createServer1Email() {
  const btn = document.getElementById("btnCreateServer1Email");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating Server 1 Email...';
  }

  try {
    const domRes = await fetch(`${SERVER1_API}/domains`);
    const domData = await domRes.json();
    const domain = domData["hydra:member"]?.[0]?.domain || "mail.tm";

    const username = generateRandomName();
    const targetEmail = `${username}@${domain}`;

    const accRes = await fetch(`${SERVER1_API}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: targetEmail, password: MAIL_PASS }),
    });

    if (!accRes.ok) throw new Error("Failed to create Server 1 account.");
    const accData = await accRes.json();

    const tokRes = await fetch(`${SERVER1_API}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: targetEmail, password: MAIL_PASS }),
    });
    const tokData = await tokRes.json();

    setSession(targetEmail, tokData.token, accData.id, "server1");
    saveToHistory(targetEmail, tokData.token, accData.id, "server1");

    showToast("Server 1 Email Created!");
    totalMessagesCount = 0;
    checkTempMailState();
  } catch (err) {
    showToast(err.message || "Server 1 Error", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "⚡ Generate Server 1 Email";
    }
  }
}

// Server 2 Custom Email Generator
export async function createServer2CustomEmail(customUsername, selectedDomain) {
  const btn = document.getElementById("btnCreateServer2Email");
  const username = (customUsername || "").trim();

  if (!username) {
    showToast("Please enter a custom username.", "error");
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Creating Server 2 Custom Email...';
  }

  try {
    const domain = selectedDomain || DOMAINS_SERVER_2[0];
    const targetEmail = username.includes("@") ? username : `${username}${domain}`;

    const payloadEnc = encPayload({ email: targetEmail });
    const res = await fetch("https://mail-server.1timetech.com/api/email", {
      method: "POST",
      headers: {
        "User-Agent": "okhttp/4.9.2",
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "x-app-key": "f07bed4503msh719c2010df3389fp1d6048jsn411a41a84a3c",
      },
      body: JSON.stringify({ data: payloadEnc }),
    });

    if (!res.ok) throw new Error("Server 2 Custom Email Creation failed.");

    setSession(targetEmail, null, null, "server2");
    saveToHistory(targetEmail, null, null, "server2");

    showToast(`Server 2 Email Created: ${targetEmail}`);
    totalMessagesCount = 0;
    checkTempMailState();
  } catch (err) {
    showToast(err.message || "Server 2 Error", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = "✨ Create Custom Server 2 Email";
    }
  }
}

// Manual Login
export async function loginExistingEmail(emailInput) {
  const email = (emailInput || "").trim();
  if (!email || !email.includes("@")) {
    showToast("Please enter a valid email address.", "error");
    return;
  }

  try {
    if (currentServer === "server2") {
      setSession(email, null, null, "server2");
      saveToHistory(email, null, null, "server2");
      showToast("Logged in to " + email);
    } else {
      const tokRes = await fetch(`${SERVER1_API}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: email, password: MAIL_PASS }),
      });

      if (!tokRes.ok) throw new Error("Email not found on Server 1.");
      const tokData = await tokRes.json();

      setSession(email, tokData.token, tokData.id, "server1");
      saveToHistory(email, tokData.token, tokData.id, "server1");
      showToast("Logged in to " + email);
    }

    totalMessagesCount = 0;
    checkTempMailState();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Polling & Inbox Fetch
function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  fetchInboxMessages();
  pollingInterval = setInterval(fetchInboxMessages, 15000);
}

export async function fetchInboxMessages() {
  if (!currentEmail) return;
  const pulse = document.getElementById("tempPulseDot");
  const msgCounter = document.getElementById("tempMsgCounter");
  if (pulse) pulse.style.background = "var(--primary)";

  try {
    let messages = [];

    if (currentServer === "server2") {
      const safeEmail = currentEmail.replace(/@/g, "_").replace(/\./g, "_");
      const paramsEnc = encPayload({});
      const listUrl = `https://mail-server.1timetech.com/api/email/${safeEmail}/messages?params=${paramsEnc}`;
      const listRes = await fetch(listUrl, {
        headers: {
          "User-Agent": "okhttp/4.9.2",
          Accept: "application/json, text/plain, */*",
          "x-app-key": "f07bed4503msh719c2010df3389fp1d6048jsn411a41a84a3c",
        },
      });
      if (listRes.ok) {
        const listJson = await listRes.json();
        const rawMsgs = decPayload(listJson.data || "[]");
        if (Array.isArray(rawMsgs)) {
          messages = rawMsgs.map((m) => ({
            id: m.id || m.message_id || Math.random().toString(),
            from: m.from || m.sender || "Unknown",
            subject: m.subject || "(No Subject)",
            intro: m.intro || m.text || "",
            createdAt: m.date || m.created_at || new Date().toISOString(),
            raw: m,
          }));
        }
      }
    } else {
      if (!currentToken) return;
      const res = await fetch(`${SERVER1_API}/messages`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const memberMsgs = data["hydra:member"] || [];
        messages = memberMsgs.map((m) => ({
          id: m.id,
          from: m.from?.address || "Unknown",
          subject: m.subject || "(No Subject)",
          intro: m.intro || "",
          createdAt: m.createdAt,
          raw: m,
        }));
      }
    }

    if (msgCounter) msgCounter.textContent = messages.length;

    if (messages.length > totalMessagesCount) {
      triggerHaptic("heavy");
      showToast(`New email received! (${messages.length})`, "success");
      updateNavBadges(messages.length);
    }
    totalMessagesCount = messages.length;

    renderInboxList(messages);
  } catch (err) {
    console.warn("Inbox fetch error:", err);
  } finally {
    if (pulse) pulse.style.background = "var(--primary)";
  }
}

function renderInboxList(messages) {
  const container = document.getElementById("tempInboxList");
  if (!container) return;

  if (messages.length === 0) {
    container.innerHTML = `
      <div class="empty-inbox">
        <div style="font-size:2rem; margin-bottom:6px; opacity:0.6;">📭</div>
        <p>No messages in inbox yet.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = "";
  messages.forEach((msg) => {
    const card = document.createElement("div");
    card.className = "msg-card";
    const date = new Date(msg.createdAt);
    const timeStr = isNaN(date.getTime())
      ? ""
      : `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

    card.innerHTML = `
      <div class="msg-card-header">
        <span class="msg-sender">${escapeHtml(msg.from)}</span>
        <span class="msg-time">${timeStr}</span>
      </div>
      <div class="msg-subject">${escapeHtml(msg.subject)}</div>
      <div class="msg-intro">${escapeHtml(msg.intro)}</div>
    `;
    card.addEventListener("click", () => openReadMessageModal(msg));
    container.appendChild(card);
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>'"]/g, (tag) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[tag] || tag));
}

function parseUrls(text) {
  if (!text) return "";
  let safe = escapeHtml(text);
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return safe.replace(urlRegex, (url) => {
    return `<div class="url-box"><a href="${url}" target="_blank">${url}</a><button class="btn-copy-url" data-url="${url}">Copy Link</button></div>`;
  }).replace(/\n/g, "<br>");
}

export async function openReadMessageModal(msg) {
  const modal = document.getElementById("tempReadMsgModal");
  const senderEl = document.getElementById("tempReadSender");
  const subjectEl = document.getElementById("tempReadSubject");
  const timeEl = document.getElementById("tempReadTime");
  const bodyEl = document.getElementById("tempReadBody");

  if (!modal) return;

  senderEl.textContent = msg.from;
  subjectEl.textContent = msg.subject;
  timeEl.textContent = new Date(msg.createdAt).toLocaleString();
  bodyEl.innerHTML = '<div style="text-align:center; padding:20px;"><span class="spinner"></span> Loading content...</div>';

  modal.classList.remove("hidden");

  try {
    let fullText = msg.intro || "";
    if (currentServer === "server2") {
      const safeEmail = currentEmail.replace(/@/g, "_").replace(/\./g, "_");
      const paramsEnc = encPayload({});
      const detailUrl = `https://mail-server.1timetech.com/api/email/${safeEmail}/messages/${msg.id}?params=${paramsEnc}`;
      const detailRes = await fetch(detailUrl, {
        headers: {
          "User-Agent": "okhttp/4.9.2",
          Accept: "application/json, text/plain, */*",
          "x-app-key": "f07bed4503msh719c2010df3389fp1d6048jsn411a41a84a3c",
        },
      });
      if (detailRes.ok) {
        const json = await detailRes.json();
        const detail = decPayload(json.data);
        fullText = detail.text || detail.body || detail.html || fullText;
      }
    } else if (currentToken) {
      const res = await fetch(`${SERVER1_API}/messages/${msg.id}`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (res.ok) {
        const detail = await res.json();
        fullText = detail.text || (detail.html ? detail.html.join("\n") : fullText);
      }
    }

    bodyEl.innerHTML = parseUrls(fullText);

    bodyEl.querySelectorAll(".btn-copy-url").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const link = btn.getAttribute("data-url");
        navigator.clipboard.writeText(link).then(() => showToast("Link copied!"));
      });
    });
  } catch (err) {
    bodyEl.textContent = msg.intro || "Error loading message text.";
  }
}

export function initTempMailEvents() {
  // Server Tab Switcher
  const tab1 = document.getElementById("tabServer1");
  const tab2 = document.getElementById("tabServer2");
  const panel1 = document.getElementById("panelServer1");
  const panel2 = document.getElementById("panelServer2");

  if (tab1 && tab2) {
    tab1.addEventListener("click", () => {
      tab1.classList.add("active");
      tab2.classList.remove("active");
      if (panel1) panel1.classList.remove("hidden");
      if (panel2) panel2.classList.add("hidden");
      currentServer = "server1";
      localStorage.setItem("rysav_temp_server", "server1");
    });

    tab2.addEventListener("click", () => {
      tab2.classList.add("active");
      tab1.classList.remove("active");
      if (panel2) panel2.classList.remove("hidden");
      if (panel1) panel1.classList.add("hidden");
      currentServer = "server2";
      localStorage.setItem("rysav_temp_server", "server2");
    });
  }

  // Create Server 1 Btn
  const btnCreate1 = document.getElementById("btnCreateServer1Email");
  if (btnCreate1) {
    btnCreate1.addEventListener("click", () => createServer1Email());
  }

  // Create Server 2 Btn
  const btnCreate2 = document.getElementById("btnCreateServer2Email");
  if (btnCreate2) {
    btnCreate2.addEventListener("click", () => {
      const uname = document.getElementById("tempCustomNameInput")?.value;
      const dom = document.getElementById("tempDomainSelectBox")?.value;
      createServer2CustomEmail(uname, dom);
    });
  }

  // Manual Login Btn
  const btnLogin = document.getElementById("btnManualLogin");
  if (btnLogin) {
    btnLogin.addEventListener("click", () => {
      const input = document.getElementById("tempManualLoginInput");
      if (input) loginExistingEmail(input.value);
    });
  }

  // Copy Email Btn
  const btnCopy = document.getElementById("btnCopyActiveEmail");
  if (btnCopy) {
    btnCopy.addEventListener("click", () => {
      if (currentEmail) {
        navigator.clipboard.writeText(currentEmail).then(() => showToast("Email copied!"));
      }
    });
  }

  // Delete Email Btn
  const btnDel = document.getElementById("btnDeleteActiveEmail");
  if (btnDel) {
    btnDel.addEventListener("click", () => {
      if (currentEmail) {
        deleteSavedAccount(currentEmail);
      }
    });
  }

  // Refresh History Bar Btn
  const btnRefHist = document.getElementById("btnRefreshHistoryList");
  if (btnRefHist) {
    btnRefHist.addEventListener("click", () => renderSavedAccountsBar());
  }

  checkTempMailState();
}
