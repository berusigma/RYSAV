/**
 * tempmail.js — Temporary Email module supporting Server 1 (Mail.tm) & Server 2 (1TimeTech Custom Email)
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

let currentServer = localStorage.getItem("rysav_temp_server") || "server1"; // 'server1' or 'server2'
let currentEmail = localStorage.getItem("rysav_temp_email") || null;
let currentToken = localStorage.getItem("rysav_temp_token") || null;
let currentAccountId = localStorage.getItem("rysav_temp_id") || null;

let pollingInterval = null;
let totalMessagesCount = 0;
let fetchedMessages = [];

// Helper for Server 2 Base64 Encryption/Decryption
function encPayload(obj) {
  try {
    const str = JSON.stringify(obj);
    const b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.split("").reverse().join("");
  } catch (e) {
    console.error("[Server2 encPayload error]", e);
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
    console.error("[Server2 decPayload error]", e);
    return {};
  }
}

function toSnakeCase(obj) {
  if (Array.isArray(obj)) return obj.map((v) => toSnakeCase(v));
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      acc[snakeKey] = toSnakeCase(obj[key]);
      return acc;
    }, {});
  }
  return obj;
}

function generateRandomName() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let res = "";
  for (let i = 0; i < 7; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return "user_" + res;
}

// UI State Manager
export function checkTempMailState() {
  const emptyView = document.getElementById("tempMailEmptyView");
  const activeView = document.getElementById("tempMailActiveView");
  const statActive = document.getElementById("tempStatActive");
  const statMsg = document.getElementById("tempStatMsg");
  const displayInput = document.getElementById("tempDisplayEmailInput");
  const serverSelect = document.getElementById("tempServerSelect");

  if (serverSelect) serverSelect.value = currentServer;

  if (currentEmail) {
    if (emptyView) emptyView.style.display = "none";
    if (activeView) activeView.style.display = "block";
    if (displayInput) displayInput.value = currentEmail;
    if (statActive) {
      statActive.textContent = "Active";
      statActive.style.color = "var(--primary)";
    }
    startPolling();
  } else {
    if (emptyView) emptyView.style.display = "block";
    if (activeView) activeView.style.display = "none";
    if (statActive) {
      statActive.textContent = "Standby";
      statActive.style.color = "var(--text-secondary)";
    }
    if (statMsg) statMsg.textContent = "0";
    updateNavBadge(0);
  }
}

function updateNavBadge(count) {
  const badge = document.getElementById("tempMailBadge");
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? "99+" : count;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
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

// Generate Email
export async function generateNewTempEmail(customUsername = null, selectedDomain = null) {
  const btnGen = document.getElementById("btnTempGenerate");
  const btnCustom = document.getElementById("btnTempCustomCreate");

  if (btnGen) {
    btnGen.disabled = true;
    btnGen.innerHTML = '<span class="spinner"></span> Creating...';
  }
  if (btnCustom) {
    btnCustom.disabled = true;
  }

  try {
    if (currentServer === "server2") {
      // Server 2: 1TimeTech Custom Email API
      const username = (customUsername && customUsername.trim()) || generateRandomName();
      const domain = selectedDomain || DOMAINS_SERVER_2[Math.floor(Math.random() * DOMAINS_SERVER_2.length)];
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

      if (!res.ok) throw new Error("Server 2 email creation failed.");

      setSession(targetEmail, null, null, "server2");
      saveToHistory(targetEmail, null, null, "server2");
      showToast("Email created successfully! (Server 2)");
    } else {
      // Server 1: Mail.tm API
      const domRes = await fetch(`${SERVER1_API}/domains`);
      const domData = await domRes.json();
      const domain = domData["hydra:member"]?.[0]?.domain || "mail.tm";

      const username = (customUsername && customUsername.trim().toLowerCase()) || generateRandomName();
      const targetEmail = username.includes("@") ? username : `${username}@${domain}`;

      const accRes = await fetch(`${SERVER1_API}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: targetEmail, password: MAIL_PASS }),
      });

      if (!accRes.ok) {
        const errData = await accRes.json().catch(() => ({}));
        throw new Error(errData.message || "Failed to create account on Server 1.");
      }
      const accData = await accRes.json();

      const tokRes = await fetch(`${SERVER1_API}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: targetEmail, password: MAIL_PASS }),
      });
      const tokData = await tokRes.json();

      setSession(targetEmail, tokData.token, accData.id, "server1");
      saveToHistory(targetEmail, tokData.token, accData.id, "server1");
      showToast("Email created successfully! (Server 1)");
    }

    totalMessagesCount = 0;
    checkTempMailState();
  } catch (err) {
    showToast(err.message || "Failed to create email", "error");
  } finally {
    if (btnGen) {
      btnGen.disabled = false;
      btnGen.innerHTML = "Generate Random Email";
    }
    if (btnCustom) btnCustom.disabled = false;
  }
}

// Manual Login
export async function loginExistingEmail(emailInput) {
  const email = (emailInput || "").trim();
  if (!email || !email.includes("@")) {
    showToast("Please enter a valid email format.", "error");
    return;
  }

  try {
    if (currentServer === "server2") {
      setSession(email, null, null, "server2");
      saveToHistory(email, null, null, "server2");
      showToast("Switched to target email (Server 2)");
    } else {
      const tokRes = await fetch(`${SERVER1_API}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: email, password: MAIL_PASS }),
      });

      if (!tokRes.ok) throw new Error("Email not found or password mismatch on Server 1.");
      const tokData = await tokRes.json();

      setSession(email, tokData.token, tokData.id, "server1");
      saveToHistory(email, tokData.token, tokData.id, "server1");
      showToast("Logged in to email (Server 1)");
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
  pollingInterval = setInterval(fetchInboxMessages, 15000); // 15 seconds
}

export async function fetchInboxMessages() {
  if (!currentEmail) return;
  const pulse = document.getElementById("tempPulseDot");
  if (pulse) pulse.style.background = "var(--primary)";

  try {
    let messages = [];

    if (currentServer === "server2") {
      // Fetch Server 2 Messages
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
      // Fetch Server 1 Messages
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

    fetchedMessages = messages;
    const statMsg = document.getElementById("tempStatMsg");
    if (statMsg) statMsg.textContent = messages.length;

    if (messages.length > totalMessagesCount) {
      const newCount = messages.length - totalMessagesCount;
      triggerHaptic("heavy");
      showToast(`New email received! (${messages.length})`, "success");
      updateNavBadge(messages.length);
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
        <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor" style="opacity:0.4; margin-bottom:8px;">
          <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
        </svg>
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

    // Attach copy url listeners
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

// History & Server Switching
export function openMailHistoryModal() {
  const modal = document.getElementById("tempHistoryModal");
  const list = document.getElementById("tempHistoryList");
  if (!modal || !list) return;

  const history = JSON.parse(localStorage.getItem("rysav_mail_history") || "[]");
  if (history.length === 0) {
    list.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary);">No email history saved.</div>';
  } else {
    list.innerHTML = history.map((item) => `
      <div class="mail-history-item">
        <div class="mail-history-info">
          <span class="mail-history-email">${escapeHtml(item.email)}</span>
          <span class="mail-history-server">(${item.server === "server2" ? "Server 2" : "Server 1"})</span>
        </div>
        <button class="primary-btn btn-sm btn-use-mail" data-email="${item.email}" data-token="${item.token || ""}" data-id="${item.id || ""}" data-server="${item.server || "server1"}">Use</button>
      </div>
    `).join("");

    list.querySelectorAll(".btn-use-mail").forEach((btn) => {
      btn.addEventListener("click", () => {
        const email = btn.getAttribute("data-email");
        const token = btn.getAttribute("data-token");
        const id = btn.getAttribute("data-id");
        const server = btn.getAttribute("data-server");
        setSession(email, token, id, server);
        checkTempMailState();
        modal.classList.add("hidden");
        showToast("Switched email: " + email);
      });
    });
  }
  modal.classList.remove("hidden");
}

export function initTempMailEvents() {
  // Server Switcher
  const serverSelect = document.getElementById("tempServerSelect");
  if (serverSelect) {
    serverSelect.addEventListener("change", (e) => {
      currentServer = e.target.value;
      localStorage.setItem("rysav_temp_server", currentServer);
      const customSection = document.getElementById("tempCustomSection");
      if (customSection) {
        customSection.style.display = currentServer === "server2" ? "block" : "block";
      }
      showToast(`Switched server to ${currentServer === "server2" ? "Server 2 (Custom Email)" : "Server 1 (Mail.tm)"}`);
    });
  }

  // Generate Email Btn
  const btnGen = document.getElementById("btnTempGenerate");
  if (btnGen) {
    btnGen.addEventListener("click", () => generateNewTempEmail());
  }

  // Custom Create Email Btn
  const btnCustom = document.getElementById("btnTempCustomCreate");
  if (btnCustom) {
    btnCustom.addEventListener("click", () => {
      const usernameInput = document.getElementById("tempCustomUsernameInput");
      const domainSelect = document.getElementById("tempDomainSelect");
      const uname = usernameInput ? usernameInput.value.trim() : "";
      const dom = domainSelect ? domainSelect.value : "";
      if (!uname) {
        showToast("Please enter a custom username.", "error");
        return;
      }
      generateNewTempEmail(uname, dom);
    });
  }

  // Manual Login Btn
  const btnLogin = document.getElementById("btnTempManualLogin");
  if (btnLogin) {
    btnLogin.addEventListener("click", () => {
      const input = document.getElementById("tempManualEmailInput");
      if (input) loginExistingEmail(input.value);
    });
  }

  // Copy Email Btn
  const btnCopy = document.getElementById("btnTempCopyEmail");
  if (btnCopy) {
    btnCopy.addEventListener("click", () => {
      if (currentEmail) {
        navigator.clipboard.writeText(currentEmail).then(() => showToast("Email copied to clipboard!"));
      }
    });
  }

  // History Btn
  const btnHistory = document.getElementById("btnTempHistory");
  if (btnHistory) {
    btnHistory.addEventListener("click", () => openMailHistoryModal());
  }

  // Change Email Btn
  const btnChange = document.getElementById("btnTempChangeEmail");
  if (btnChange) {
    btnChange.addEventListener("click", () => {
      generateNewTempEmail();
    });
  }

  // Initial Check
  checkTempMailState();
}
