/**
 * tempmail.js — Clean, Modern Temp Mail module powered exclusively by Mail.tm API
 */
import { showToast, triggerHaptic } from "../utils/index.js";

const MAIL_API = "https://api.mail.tm";
const MAIL_PASS = "RysavMail2026!Secure";

let currentEmail = localStorage.getItem("rysav_temp_email") || null;
let currentToken = localStorage.getItem("rysav_temp_token") || null;
let currentAccountId = localStorage.getItem("rysav_temp_id") || null;

let pollingInterval = null;
let totalMessagesCount = 0;

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

  if (emailDisplay) {
    emailDisplay.textContent = currentEmail || "Belum Ada Email Aktif";
  }
  renderSavedAccountsBar();
}

function renderSavedAccountsBar() {
  const container = document.getElementById("tempAccountsBar");
  if (!container) return;

  const history = JSON.parse(localStorage.getItem("rysav_mail_history") || "[]");
  if (history.length === 0) {
    container.innerHTML = `<span style="font-size:0.75rem; color:var(--text-secondary);">Belum ada riwayat email.</span>`;
    return;
  }

  container.innerHTML = history.map((acc) => {
    const isActive = acc.email === currentEmail;
    return `
      <div class="stat-pill ${isActive ? "active-account-pill" : ""}" style="font-size:0.75rem; padding:5px 12px; cursor:pointer; display:inline-flex; align-items:center; gap:6px; border-radius:20px; transition: all 0.2s ease; ${isActive ? "background:var(--primary); color:var(--on-primary); font-weight:700;" : "background:var(--surface);"}" >
        <span class="btn-switch-account" data-email="${acc.email}" data-token="${acc.token || ""}" data-id="${acc.id || ""}">${escapeHtml(acc.email)}</span>
        <span class="btn-del-account" data-email="${acc.email}" style="opacity:0.7; font-weight:bold; cursor:pointer; padding:0 2px;">✕</span>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".btn-switch-account").forEach((el) => {
    el.addEventListener("click", () => {
      const email = el.getAttribute("data-email");
      const token = el.getAttribute("data-token");
      const id = el.getAttribute("data-id");
      setSession(email, token, id);
      checkTempMailState();
      showToast("Beralih ke email: " + email);
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
      setSession(nextAcc.email, nextAcc.token, nextAcc.id);
    } else {
      clearSession();
    }
  }
  showToast("Email berhasil dihapus!");
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

function setSession(email, token = null, id = null) {
  currentEmail = email;
  currentToken = token;
  currentAccountId = id;
  localStorage.setItem("rysav_temp_email", email);
  localStorage.setItem("rysav_temp_token", token || "");
  localStorage.setItem("rysav_temp_id", id || "");
}

function saveToHistory(email, token = null, id = null) {
  let history = JSON.parse(localStorage.getItem("rysav_mail_history") || "[]");
  history = history.filter((h) => h.email !== email);
  history.unshift({ email, token, id });
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

// Generate New Email (Mail.tm API)
export async function createNewEmail() {
  const btn = document.getElementById("btnCreateEmail");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Membuat Email...';
  }

  try {
    const domRes = await fetch(`${MAIL_API}/domains`);
    const domData = await domRes.json();
    const domain = domData["hydra:member"]?.[0]?.domain || "mail.tm";

    const username = generateRandomName();
    const targetEmail = `${username}@${domain}`;

    const accRes = await fetch(`${MAIL_API}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: targetEmail, password: MAIL_PASS }),
    });

    if (!accRes.ok) throw new Error("Gagal membuat akun email.");
    const accData = await accRes.json();

    const tokRes = await fetch(`${MAIL_API}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: targetEmail, password: MAIL_PASS }),
    });
    const tokData = await tokRes.json();

    setSession(targetEmail, tokData.token, accData.id);
    saveToHistory(targetEmail, tokData.token, accData.id);

    showToast("Email Baru Berhasil Dibuat!");
    totalMessagesCount = 0;
    checkTempMailState();
  } catch (err) {
    showToast(err.message || "Gagal Koneksi API", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> Generate Email Baru`;
    }
  }
}

// Manual Login to existing Mail.tm address
export async function loginExistingEmail(emailInput) {
  const email = (emailInput || "").trim();
  if (!email || !email.includes("@")) {
    showToast("Masukkan alamat email yang valid.", "error");
    return;
  }

  try {
    const tokRes = await fetch(`${MAIL_API}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: email, password: MAIL_PASS }),
    });

    if (!tokRes.ok) throw new Error("Alamat email tidak ditemukan di server.");
    const tokData = await tokRes.json();

    setSession(email, tokData.token, tokData.id);
    saveToHistory(email, tokData.token, tokData.id);
    showToast("Berhasil login ke: " + email);

    totalMessagesCount = 0;
    checkTempMailState();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// Polling & Inbox Fetching
function startPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  fetchInboxMessages();
  pollingInterval = setInterval(fetchInboxMessages, 15000);
}

export async function fetchInboxMessages() {
  if (!currentEmail || !currentToken) return;
  const pulse = document.getElementById("tempPulseDot");
  const msgCounter = document.getElementById("tempMsgCounter");
  if (pulse) pulse.style.background = "var(--primary)";

  try {
    const res = await fetch(`${MAIL_API}/messages`, {
      headers: { Authorization: `Bearer ${currentToken}` },
    });
    if (!res.ok) return;

    const data = await res.json();
    const memberMsgs = data["hydra:member"] || [];
    const messages = memberMsgs.map((m) => ({
      id: m.id,
      from: m.from?.address || m.from?.name || "Pengirim",
      subject: m.subject || "(Tanpa Subjek)",
      intro: m.intro || "",
      createdAt: m.createdAt,
      raw: m,
    }));

    if (msgCounter) msgCounter.textContent = messages.length;

    if (messages.length > totalMessagesCount) {
      triggerHaptic("heavy");
      showToast(`Pesan baru diterima! (${messages.length})`, "success");
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
      <div style="text-align: center; padding: 36px 16px;">
        <svg style="width: 48px; height: 48px; margin-bottom: 10px; opacity: 0.3; color: var(--primary);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
          <polyline points="22,6 12,13 2,6"></polyline>
        </svg>
        <p style="font-size: 0.9rem; color: var(--text-secondary); font-weight: 600;">Inbox Kosong</p>
        <p style="font-size: 0.78rem; color: var(--text-secondary); opacity: 0.7; margin-top: 4px;">Menunggu email masuk secara otomatis...</p>
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

    const senderInitial = (msg.from || "M").charAt(0).toUpperCase();

    card.innerHTML = `
      <div class="email-avatar">${escapeHtml(senderInitial)}</div>
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-weight: 700; font-size: 0.88rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(msg.from)}</span>
          <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 600; margin-left: 8px;">${timeStr}</span>
        </div>
        <div style="font-weight: 800; font-size: 0.92rem; margin-bottom: 4px; color: var(--primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(msg.subject)}</div>
        <div style="font-size: 0.8rem; color: var(--text-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.4;">${escapeHtml(msg.intro)}</div>
      </div>
    `;

    card.addEventListener("click", () => openReadMessageModal(msg));
    container.appendChild(card);
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>'"]/g, (tag) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[tag] || tag));
}

function formatEmailBody(detail) {
  if (!detail) return "Tidak ada pesan.";

  if (detail.html && detail.html.length > 0) {
    const rawHtml = Array.isArray(detail.html) ? detail.html.join("") : detail.html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");
    doc.querySelectorAll("a").forEach((a) => {
      a.setAttribute("target", "_blank");
      a.setAttribute("rel", "noopener noreferrer");
      a.style.color = "var(--primary)";
      a.style.fontWeight = "700";
      a.style.textDecoration = "underline";
      a.style.wordBreak = "break-all";
    });
    return doc.body.innerHTML;
  }

  const text = detail.text || detail.intro || "";
  let safe = escapeHtml(text);
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return safe.replace(urlRegex, (url) => {
    return `<div class="url-box" style="background: var(--bg-color); border: 1px solid var(--border-color); padding: 8px 12px; border-radius: 10px; margin: 8px 0; display: flex; justify-content: space-between; align-items: center; gap: 8px; word-break: break-all;"><a href="${url}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); font-weight: 700;">${url}</a><button class="btn-copy-url btn-action" data-url="${url}" style="padding: 4px 10px; font-size: 0.72rem;">Salin Link</button></div>`;
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
  timeEl.textContent = new Date(msg.createdAt).toLocaleString("id-ID");
  bodyEl.innerHTML = '<div style="text-align:center; padding:20px;"><span class="spinner"></span> Memuat isi email...</div>';

  modal.classList.remove("hidden");

  try {
    let detailData = { intro: msg.intro || "" };
    if (currentToken) {
      const res = await fetch(`${MAIL_API}/messages/${msg.id}`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (res.ok) {
        detailData = await res.json();
      }
    }

    bodyEl.innerHTML = formatEmailBody(detailData);

    bodyEl.querySelectorAll(".btn-copy-url").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const link = btn.getAttribute("data-url");
        navigator.clipboard.writeText(link).then(() => showToast("Link disalin!"));
      });
    });
  } catch (err) {
    bodyEl.textContent = msg.intro || "Gagal memuat pesan.";
  }
}

export function initTempMailEvents() {
  // Generate Email Btn
  const btnCreate = document.getElementById("btnCreateEmail");
  if (btnCreate) {
    btnCreate.addEventListener("click", () => createNewEmail());
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
        navigator.clipboard.writeText(currentEmail).then(() => showToast("Alamat email disalin!"));
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

  // Refresh Inbox Sync Btn
  const btnSyncInbox = document.getElementById("btnSyncInbox");
  if (btnSyncInbox) {
    btnSyncInbox.addEventListener("click", () => {
      fetchInboxMessages();
      showToast("Inbox diperbarui!");
    });
  }

  checkTempMailState();
}
