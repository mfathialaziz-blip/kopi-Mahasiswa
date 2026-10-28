/**
 * KOPI MAHASISWA — ADMIN AI ADVISOR CHATBOT
 * KopiAI Business Advisor — Embedded in Admin Dashboard
 * Persona: Professional AI Business Consultant
 * Topics: Sales, stock, bundling strategy, operational insights
 */

document.addEventListener("DOMContentLoaded", () => {
  if (typeof AIEngine === "undefined") {
    console.warn("[AdminAI] AIEngine is not loaded.");
    return;
  }

  // ===================================================
  // INJECT ADMIN AI ADVISOR PANEL INTO DASHBOARD
  // ===================================================
  const adminChatContainer = document.createElement("div");
  adminChatContainer.id = "adminAiAdvisorRoot";
  adminChatContainer.innerHTML = `
    <!-- Admin AI Advisor Floating Panel -->
    <div class="admin-ai-launcher" id="adminAiLauncher">
      <button class="admin-ai-launcher-btn" id="adminAiLauncherBtn" title="Chat dengan KopiAI Business Advisor">
        <span class="admin-ai-icon">&#x1F4CA;</span>
        <span class="admin-ai-badge">AI Advisor</span>
      </button>
    </div>

    <!-- Admin AI Chat Panel -->
    <div class="admin-ai-panel" id="adminAiPanel" aria-hidden="true">
      <!-- Panel Header -->
      <div class="admin-ai-panel-header">
        <div class="admin-ai-header-left">
          <div class="admin-ai-avatar">&#x1F4CA;</div>
          <div>
            <div class="admin-ai-panel-title">KopiAI Business Advisor</div>
            <div class="admin-ai-panel-status">
              <span class="admin-ai-status-dot">&#x25CF;</span>
              <span>Gemini AI Live &bull; Analisis Bisnis Real-time</span>
            </div>
          </div>
        </div>
        <div class="admin-ai-header-actions">
          <button class="admin-ai-btn-icon" id="adminAiResetBtn" title="Reset Percakapan">&#x1F504;</button>
          <button class="admin-ai-btn-icon" id="adminAiCloseBtn" title="Tutup">&#x2715;</button>
        </div>
      </div>

      <!-- Quick Action Chips -->
      <div class="admin-ai-chips" id="adminAiChips">
        <button class="admin-ai-chip" data-prompt="Tampilkan ringkasan penjualan dan total pendapatan hari ini">Ringkasan Penjualan</button>
        <button class="admin-ai-chip" data-prompt="Analisis kondisi stok produk saat ini, mana yang perlu restock?">Analisis Stok</button>
        <button class="admin-ai-chip" data-prompt="Berikan rekomendasi strategi bundling dan promo untuk meningkatkan revenue">Ide Promo &amp; Bundling</button>
        <button class="admin-ai-chip" data-prompt="Apa menu terlaris dan bagaimana strategi untuk meningkatkan penjualannya?">Menu Terlaris</button>
        <button class="admin-ai-chip" data-prompt="Berikan saran operasional untuk persiapan jam sibuk malam ini">Tips Operasional</button>
        <button class="admin-ai-chip" data-prompt="Tampilkan jumlah dan daftar member yang sudah terdaftar saat ini">Data Member 🎓</button>
      </div>

      <!-- Chat Body -->
      <div class="admin-ai-body" id="adminAiBody"></div>

      <!-- Input Form -->
      <form class="admin-ai-footer" id="adminAiForm">
        <input
          type="text"
          id="adminAiInput"
          class="admin-ai-input"
          placeholder="Tanya soal stok, penjualan, strategi promo, atau analisis bisnis..."
          autocomplete="off"
        >
        <button type="submit" class="admin-ai-send-btn" id="adminAiSendBtn" aria-label="Kirim">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>

      <!-- ✦ Developer Watermark (2-Baris Elegan) ✦ -->
      <div class="dev-watermark dev-watermark-chatbot" aria-label="Developer Credit">
        <span class="dev-watermark-version">Virtual Barista v2.4</span>
        <span class="dev-watermark-credit">Created with ☕ by <em class="dev-author">Fathialaziz</em></span>
      </div>
    </div>
  `;

  document.body.appendChild(adminChatContainer);

  // ===================================================
  // STATE & DOM REFERENCES
  // ===================================================
  let adminChatHistory = [];
  let isAdminThinking = false;

  const adminAiLauncherBtn = document.getElementById("adminAiLauncherBtn");
  const adminAiPanel = document.getElementById("adminAiPanel");
  const adminAiCloseBtn = document.getElementById("adminAiCloseBtn");
  const adminAiResetBtn = document.getElementById("adminAiResetBtn");
  const adminAiChips = document.getElementById("adminAiChips");
  const adminAiBody = document.getElementById("adminAiBody");
  const adminAiForm = document.getElementById("adminAiForm");
  const adminAiInput = document.getElementById("adminAiInput");

  // Base URL bot API (consistent with admin.js, adaptif terhadap HTTPS)
  const AI_BOT_API_BASE = (typeof window.BOT_API_BASE !== "undefined")
    ? window.BOT_API_BASE
    : (window.location.protocol === "https:" ? "" : "http://localhost:3000");

  // Cached members from last fetch
  let cachedMembersForAI = [];

  // Fetch members from /api/members for AI context
  async function fetchMembersForAI() {
    try {
      const res = await fetch(`${AI_BOT_API_BASE}/api/members`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.data)) {
          cachedMembersForAI = json.data;
          return json.data;
        }
      }
    } catch (e) {
      console.warn("[AdminAI] Gagal fetch members untuk konteks AI (offline?):", e.message || e);
    }
    // Fallback: local StorageManager
    if (typeof StorageManager !== "undefined" && StorageManager.getMembersList) {
      cachedMembersForAI = StorageManager.getMembersList() || [];
    }
    return cachedMembersForAI;
  }

  // ===================================================
  // OPEN / CLOSE PANEL
  // ===================================================
  function toggleAdminPanel(open) {
    const isOpen = open !== undefined ? open : !adminAiPanel.classList.contains("active");
    const launcher = document.getElementById("adminAiLauncher");
    if (isOpen) {
      adminAiPanel.classList.add("active");
      adminAiPanel.setAttribute("aria-hidden", "false");
      if (launcher) launcher.classList.add("hidden");
      setTimeout(() => adminAiInput.focus(), 200);
      if (adminAiBody.children.length === 0) {
        initAdminWelcome();
      }
    } else {
      adminAiPanel.classList.remove("active");
      adminAiPanel.setAttribute("aria-hidden", "true");
      if (launcher) launcher.classList.remove("hidden");
    }
  }

  adminAiLauncherBtn.addEventListener("click", () => toggleAdminPanel());
  adminAiCloseBtn.addEventListener("click", () => toggleAdminPanel(false));
  adminAiResetBtn.addEventListener("click", () => {
    adminChatHistory = [];
    adminAiBody.innerHTML = "";
    initAdminWelcome();
  });

  adminAiChips.addEventListener("click", (e) => {
    const chip = e.target.closest(".admin-ai-chip");
    if (!chip || isAdminThinking) return;
    handleAdminMessage(chip.getAttribute("data-prompt"));
  });

  adminAiForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = (adminAiInput.value || "").trim();
    if (!text || isAdminThinking) return;
    adminAiInput.value = "";
    handleAdminMessage(text);
  });

  // ===================================================
  // WELCOME MESSAGE
  // ===================================================
  function initAdminWelcome() {
    const products = AIEngine.getProducts ? AIEngine.getProducts() : [];
    const transactions = (typeof StorageManager !== "undefined" && StorageManager.getTransactions)
      ? StorageManager.getTransactions() : [];
    const txCount = transactions.length;
    const totalRev = transactions.reduce((acc, tx) => acc + (tx.totalAmount || 0), 0);
    const fmt = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

    const outOfStock = products.filter(p => {
      const s = Number(p.stok !== undefined ? p.stok : (p.stock !== undefined ? p.stock : 10));
      return s <= 0;
    });

    let welcome = "Selamat datang di **KopiAI Business Advisor**! Saya siap membantu Anda menganalisis bisnis Kopi Mahasiswa.";
    if (txCount > 0) {
      welcome += "\n\n**Snapshot Bisnis Terkini:**\n- Total transaksi: **" + txCount + " pesanan**\n- Total pendapatan: **" + fmt(totalRev) + "**";
    }
    if (outOfStock.length > 0) {
      const names = outOfStock.map(p => p.nama_menu || p.name).join(", ");
      welcome += "\n\n**Peringatan Stok:** Menu **" + names + "** sedang habis. Segera pertimbangkan restock!";
    }
    // Show member count in welcome if available
    if (cachedMembersForAI.length > 0) {
      welcome += `\n\n**Member Terdaftar:** **${cachedMembersForAI.length} orang** aktif menikmati diskon 10%.`;
    }
    welcome += "\n\nApa yang ingin Anda analisis hari ini? Pilih topik di atas atau ketik pertanyaan Anda.";
    appendAdminAiMessage(welcome);
  }

  // ===================================================
  // MESSAGE HANDLING
  // ===================================================
  async function handleAdminMessage(message) {
    appendAdminUserMessage(message);
    isAdminThinking = true;
    showAdminTyping();

    try {
      const transactions = (typeof StorageManager !== "undefined" && StorageManager.getTransactions)
        ? StorageManager.getTransactions() : [];

      // Ringkasan transaksi ringan untuk dikirim ke backend (hindari payload besar)
      const transactionSummary = transactions.length > 0 ? {
        total: transactions.length,
        revenue: transactions.reduce((s, t) => s + (t.totalAmount || 0), 0)
      } : null;

      let reply = null;

      // === STRATEGI 1: Backend /api/ai-chat (real-time members.json + 200 token cap) ===
      try {
        const backendRes = await fetch(`${AI_BOT_API_BASE}/api/ai-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            chatHistory: adminChatHistory.slice(-6),
            transactionSummary
          }),
          signal: AbortSignal.timeout(14000) // timeout 14 detik agar respons 500 token backend tuntas
        });

        if (backendRes.ok) {
          const json = await backendRes.json();
          if (json.success && json.reply) {
            reply = json.reply;
            // Update cached member count jika backend mengembalikannya
            if (typeof json.memberCount === "number") {
              cachedMembersForAI = cachedMembersForAI.length !== json.memberCount
                ? cachedMembersForAI  // Tetap pakai cache; hanya gunakan count untuk UI
                : cachedMembersForAI;
              console.log(`[AdminAI] Backend relay OK | Members: ${json.memberCount}`);
            }
          }
        } else {
          console.warn(`[AdminAI] Backend /api/ai-chat HTTP ${backendRes.status} — fallback ke frontend AI.`);
        }
      } catch (backendErr) {
        console.warn("[AdminAI] Backend offline atau timeout, fallback ke frontend AIEngine:", backendErr.message || backendErr);
      }

      // === STRATEGI 2: Fallback ke frontend AIEngine (jika backend tidak tersedia) ===
      if (!reply) {
        const members = cachedMembersForAI.length > 0 ? cachedMembersForAI : await fetchMembersForAI();
        const [_, aiResult] = await Promise.all([
          new Promise(r => setTimeout(r, 200)),
          AIEngine.chatWithAdmin(message, adminChatHistory, transactions, members)
        ]);
        if (aiResult && aiResult.reply) reply = aiResult.reply;
      }

      hideAdminTyping();
      appendAdminAiMessage(reply || "Maaf, tidak bisa memproses permintaan tersebut. Silakan coba lagi!");

    } catch (err) {
      console.error("[AdminAI] Error:", err);
      hideAdminTyping();
      appendAdminAiMessage("Terjadi gangguan koneksi AI. Silakan coba lagi.");
    } finally {
      isAdminThinking = false;
    }
  }

  function appendAdminUserMessage(text) {
    const row = document.createElement("div");
    row.className = "admin-ai-msg-row user";
    row.innerHTML = '<div class="admin-ai-msg-bubble">' + escapeAdminHtml(text) + '</div>';
    adminAiBody.appendChild(row);
    adminAiBody.scrollTop = adminAiBody.scrollHeight;
    adminChatHistory.push({ role: "user", content: text });
  }

  function appendAdminAiMessage(text) {
    const row = document.createElement("div");
    row.className = "admin-ai-msg-row ai";
    row.innerHTML =
      '<div class="admin-ai-msg-avatar">&#x1F4CA;</div>' +
      '<div class="admin-ai-msg-bubble">' + formatAdminMarkdown(text) + '</div>';
    adminAiBody.appendChild(row);
    adminAiBody.scrollTop = adminAiBody.scrollHeight;
    adminChatHistory.push({ role: "assistant", content: text });
  }

  function showAdminTyping() {
    const row = document.createElement("div");
    row.className = "admin-ai-msg-row ai";
    row.id = "adminAiTypingRow";
    row.innerHTML =
      '<div class="admin-ai-msg-avatar">&#x1F4CA;</div>' +
      '<div class="admin-ai-typing"><span></span><span></span><span></span></div>';
    adminAiBody.appendChild(row);
    adminAiBody.scrollTop = adminAiBody.scrollHeight;
  }

  function hideAdminTyping() {
    const el = document.getElementById("adminAiTypingRow");
    if (el) el.remove();
  }

  // ===================================================
  // MARKDOWN & HTML UTILS
  // ===================================================
  function escapeAdminHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatAdminMarkdown(text) {
    if (!text) return "";
    let html = escapeAdminHtml(text);
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^\*\n]+)\*/g, "<em>$1</em>");
    html = html.replace(/^[•\-]\s+(.*?)$/gm, '<li class="admin-ai-li">$1</li>');
    html = html.replace(/^(\d+)\.\s+(.*?)$/gm, '<li class="admin-ai-li">$1. $2</li>');
    html = html.replace(/^##\s+(.*?)$/gm, '<div class="admin-ai-h4">$1</div>');
    html = html.replace(/\n\n/g, '<div style="height:8px"></div>');
    html = html.replace(/\n/g, "<br>");
    return html;
  }
});
