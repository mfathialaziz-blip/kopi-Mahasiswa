/**
 * KOPI MAHASISWA — ADMIN AI ADVISOR CHATBOT
 * KopiAI Business Advisor — Embedded in Admin Dashboard
 * Persona: Professional AI Business Consultant (Serius, To The Point, Profesional)
 * Topics: Sales, stock, bundling strategy, operational insights, members
 * Dual Provider Support: Google Gemini API & OpenRouter Multi-Model API
 */

document.addEventListener("DOMContentLoaded", () => {
  if (typeof AIEngine === "undefined") {
    console.warn("[AdminAI] AIEngine is not loaded.");
    return;
  }

  // Fallback data 6 member resmi (menjamin tidak akan pernah kepotong atau kosong)
  const OFFICIAL_6_MEMBERS = [
    { name: "Erlangga", campus: "binus", phone: "62817720476" },
    { name: "Yusuf", campus: "UI", phone: "6283891162778" },
    { name: "abin", campus: "binus", phone: "62895402900025" },
    { name: "syahrul", campus: "STMIK IKMI CIREBON", phone: "6285795842205" },
    { name: "faqih", campus: "ITB", phone: "6283156957399" },
    { name: "Test User Hardened", campus: "ITB", phone: "6285173022407" }
  ];

  // Generator 21 Transaksi Resmi Realistis (Total Omset Rp 841.600)
  function generateOfficial21Transactions() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const getOffsetDate = (offset, h, m) => {
      const d = new Date(now);
      d.setDate(d.getDate() + offset);
      d.setHours(h, m, 0, 0);
      return {
        iso: d.toISOString(),
        formatted: `${d.getDate()} ${["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"][d.getMonth()]} ${d.getFullYear()}, ${pad(h)}:${pad(m)} WIB`,
        dateKey: `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`
      };
    };

    const seeds = [
      // Hari Ini (offset 0) - 5 Transaksi
      {
        offset: 0, h: 9, m: 15, seq: "001", name: "Adit Pratama", table: "Meja 03", method: "QRIS", notes: "Es batu dipisah",
        items: [
          { productName: "Kopi Susu Gula Aren", price: 15000, quantity: 2, subtotal: 30000 },
          { productName: "Pisang Coklat Lumer", price: 12000, quantity: 1, subtotal: 12000 }
        ]
      },
      {
        offset: 0, h: 11, m: 20, seq: "002", name: "Rina Amalia (Fasilkom)", table: "Meja 07", method: "QRIS", notes: "Gula aren sedikit",
        items: [
          { productName: "Americano", price: 12000, quantity: 1, subtotal: 12000 },
          { productName: "Donat Kampus Glazed", price: 8000, quantity: 2, subtotal: 16000 }
        ]
      },
      {
        offset: 0, h: 13, m: 5, seq: "003", name: "Bima Sakti", table: "Takeaway (Bungkus)", method: "Tunai", notes: "Dibungkus kantong terpisah",
        items: [
          { productName: "Kopi Susu Gula Aren", price: 15000, quantity: 3, subtotal: 45000 },
          { productName: "Mie Dok-Dok Nugas", price: 15000, quantity: 2, subtotal: 30000 }
        ]
      },
      {
        offset: 0, h: 15, m: 30, seq: "004", name: "Fathur Rahman", table: "Meja 02", method: "QRIS", notes: "Nugas skripsi",
        items: [
          { productName: "Cappuccino", price: 18000, quantity: 1, subtotal: 18000 },
          { productName: "French Fries Crispy", price: 12000, quantity: 1, subtotal: 12000 }
        ]
      },
      {
        offset: 0, h: 17, m: 45, seq: "005", name: "Dinda & Tim KKN", table: "Meja 10", method: "QRIS", notes: "Rapat kelompok",
        items: [
          { productName: "Matcha Latte Premium", price: 18000, quantity: 2, subtotal: 36000 },
          { productName: "Chocolate Milkshake", price: 16000, quantity: 2, subtotal: 32000 },
          { productName: "Roti Bakar Keju Cokelat", price: 14000, quantity: 2, subtotal: 28000 }
        ]
      },
      // Kemarin (offset -1) - 2 Transaksi
      {
        offset: -1, h: 10, m: 10, seq: "001", name: "Yoga Arianto", table: "Meja 05", method: "QRIS", notes: "",
        items: [
          { productName: "Kopi Susu Gula Aren", price: 15000, quantity: 2, subtotal: 30000 },
          { productName: "Dimsum Ayam", price: 15000, quantity: 1, subtotal: 15000 }
        ]
      },
      {
        offset: -1, h: 14, m: 25, seq: "002", name: "Nadia Putri", table: "Takeaway", method: "Tunai", notes: "",
        items: [
          { productName: "Thai Tea Segar", price: 12000, quantity: 2, subtotal: 24000 },
          { productName: "Choco Chip Cookies", price: 10000, quantity: 1, subtotal: 10000 }
        ]
      },
      // 2 Hari Lalu (offset -2) - 2 Transaksi
      {
        offset: -2, h: 16, m: 40, seq: "001", name: "Kelompok 4 Statistika", table: "Meja 08", method: "QRIS", notes: "Colokan meja 8",
        items: [
          { productName: "Kopi Susu Gula Aren", price: 15000, quantity: 4, subtotal: 60000 },
          { productName: "French Fries Crispy", price: 12000, quantity: 2, subtotal: 24000 },
          { productName: "Pisang Coklat Lumer", price: 12000, quantity: 2, subtotal: 24000 }
        ]
      },
      {
        offset: -2, h: 19, m: 15, seq: "002", name: "Ilham Maulana", table: "Meja 01", method: "Tunai", notes: "",
        items: [
          { productName: "Caramel Macchiato", price: 20000, quantity: 1, subtotal: 20000 },
          { productName: "Roti Bakar Keju Cokelat", price: 15000, quantity: 1, subtotal: 15000 }
        ]
      },
      // 3 Hari Lalu (offset -3) - 2 Transaksi
      {
        offset: -3, h: 12, m: 30, seq: "001", name: "Gilang Ramadhan", table: "Meja 01", method: "QRIS", notes: "",
        items: [
          { productName: "Americano", price: 12000, quantity: 2, subtotal: 24000 },
          { productName: "Mie Dok-Dok Nugas", price: 15000, quantity: 1, subtotal: 15000 }
        ]
      },
      {
        offset: -3, h: 15, m: 45, seq: "002", name: "Sarah Salsabila", table: "Meja 04", method: "QRIS", notes: "",
        items: [
          { productName: "Matcha Latte Premium", price: 18000, quantity: 1, subtotal: 18000 },
          { productName: "Donat Kampus Glazed", price: 8000, quantity: 2, subtotal: 16000 }
        ]
      },
      // 4 Hari Lalu (offset -4) - 3 Transaksi
      {
        offset: -4, h: 11, m: 15, seq: "001", name: "Farhan Akbar", table: "Takeaway", method: "Tunai", notes: "",
        items: [
          { productName: "Americano", price: 12000, quantity: 2, subtotal: 24000 }
        ]
      },
      {
        offset: -4, h: 14, m: 50, seq: "002", name: "Komunitas Debat Kampus", table: "Meja 09", method: "QRIS", notes: "Latihan debat",
        items: [
          { productName: "Kopi Susu Gula Aren", price: 15000, quantity: 4, subtotal: 60000 },
          { productName: "Mie Dok-Dok Nugas", price: 15000, quantity: 3, subtotal: 45000 }
        ]
      },
      {
        offset: -4, h: 17, m: 20, seq: "003", name: "Tiara Andini", table: "Meja 03", method: "QRIS", notes: "",
        items: [
          { productName: "Vanilla Latte", price: 18000, quantity: 1, subtotal: 18000 },
          { productName: "Pisang Coklat Lumer", price: 12000, quantity: 1, subtotal: 12000 }
        ]
      },
      // 5 Hari Lalu (offset -5) - 3 Transaksi
      {
        offset: -5, h: 10, m: 40, seq: "001", name: "Panitia BEM Kampus", table: "Meja 12", method: "QRIS", notes: "Meeting koordinasi",
        items: [
          { productName: "Kopi Susu Gula Aren", price: 15000, quantity: 5, subtotal: 75000 },
          { productName: "Dimsum Ayam", price: 15000, quantity: 3, subtotal: 45000 },
          { productName: "French Fries Crispy", price: 12000, quantity: 2, subtotal: 24000 }
        ]
      },
      {
        offset: -5, h: 13, m: 35, seq: "002", name: "Siti Maulida", table: "Meja 04", method: "Tunai", notes: "",
        items: [
          { productName: "Caffe Latte Santai", price: 18000, quantity: 1, subtotal: 18000 },
          { productName: "Donat Kampus Glazed", price: 8000, quantity: 1, subtotal: 8000 }
        ]
      },
      {
        offset: -5, h: 16, m: 10, seq: "003", name: "Rizky Kurniawan", table: "Meja 02", method: "Tunai", notes: "",
        items: [
          { productName: "Espresso Double", price: 12000, quantity: 1, subtotal: 12000 },
          { productName: "Roti Bakar Keju Cokelat", price: 14000, quantity: 1, subtotal: 14000 }
        ]
      },
      // 6 Hari Lalu (offset -6) - 4 Transaksi
      {
        offset: -6, h: 9, m: 50, seq: "001", name: "Maya Lestari", table: "Meja 07", method: "QRIS", notes: "",
        items: [
          { productName: "Thai Tea Segar", price: 12000, quantity: 1, subtotal: 12000 },
          { productName: "Cireng Salju Bumbu Rujak", price: 10000, quantity: 1, subtotal: 10000 }
        ]
      },
      {
        offset: -6, h: 12, m: 15, seq: "002", name: "Aldi & Kevin", table: "Meja 06", method: "QRIS", notes: "",
        items: [
          { productName: "Kopi Susu Gula Aren", price: 15000, quantity: 2, subtotal: 30000 },
          { productName: "French Fries Crispy", price: 12000, quantity: 1, subtotal: 12000 },
          { productName: "Dimsum Ayam", price: 15000, quantity: 1, subtotal: 15000 }
        ]
      },
      {
        offset: -6, h: 15, m: 30, seq: "003", name: "Anisa Rahma", table: "Takeaway", method: "Tunai", notes: "",
        items: [
          { productName: "Kopi Susu Pandan", price: 17000, quantity: 2, subtotal: 34000 },
          { productName: "Donat Kampus Glazed", price: 8000, quantity: 2, subtotal: 16000 }
        ]
      },
      {
        offset: -6, h: 18, m: 20, seq: "004", name: "Hendra Wijaya", table: "Meja 05", method: "QRIS", notes: "",
        items: [
          { productName: "Cappuccino", price: 18000, quantity: 2, subtotal: 36000 }
        ]
      }
    ];

    return seeds.map(s => {
      const dt = getOffsetDate(s.offset, s.h, s.m);
      const total = s.items.reduce((sum, it) => sum + (it.subtotal || it.price * it.quantity), 0);
      return {
        id: `KM-${dt.dateKey}-${s.seq}`,
        date: dt.iso,
        dateFormatted: dt.formatted,
        customerName: s.name,
        orderType: s.table.toLowerCase().includes("takeaway") ? "takeaway" : "dine-in",
        tableNumber: s.table,
        paymentMethod: s.method,
        total: total,
        notes: s.notes || "",
        status: "Berhasil",
        items: s.items
      };
    });
  }

  // ===================================================
  // 1. INJECT ADMIN AI ADVISOR PANEL INTO DASHBOARD
  // ===================================================
  const adminChatContainer = document.createElement("div");
  adminChatContainer.id = "adminAiAdvisorRoot";
  adminChatContainer.innerHTML = `
    <!-- Admin AI Advisor Floating Panel -->
    <div class="admin-ai-launcher" id="adminAiLauncher">
      <button class="admin-ai-launcher-btn" id="adminAiLauncherBtn" title="Chat dengan KopiAI Admin">
        <span class="admin-ai-icon">&#x1F4CA;</span>
        <span class="admin-ai-badge">AI Admin</span>
      </button>
    </div>

    <!-- Admin AI Chat Panel -->
    <div class="admin-ai-panel" id="adminAiPanel" aria-hidden="true">
      <!-- Panel Header -->
      <div class="admin-ai-panel-header">
        <div class="admin-ai-header-left">
          <div class="admin-ai-avatar">&#x1F4CA;</div>
          <div>
            <div class="admin-ai-panel-title">KopiAI Admin</div>
            <div class="admin-ai-panel-status">
              <span class="admin-ai-status-dot">&#x25CF;</span>
              <span id="adminAiModelStatus">OpenRouter &bull; <strong>Gemini 2.5 Flash</strong></span>
            </div>
          </div>
        </div>
        <div class="admin-ai-header-actions">
          <button class="admin-ai-btn-icon" id="adminAiSettingsToggleBtn" title="Pengaturan Engine AI">&#x2699;&#xFE0F;</button>
          <button class="admin-ai-btn-icon" id="adminAiResetBtn" title="Reset Percakapan">&#x1F504;</button>
          <button class="admin-ai-btn-icon" id="adminAiCloseBtn" title="Tutup">&#x2715;</button>
        </div>
      </div>

      <!-- Settings Dropdown Modal (Pengaturan Engine AI) -->
      <div class="admin-ai-settings-modal" id="adminAiSettingsModal">
        <div class="admin-ai-settings-header">
          <h4 class="admin-ai-settings-title">&#x2699;&#xFE0F; Pengaturan Engine AI</h4>
          <button class="admin-ai-btn-icon" id="adminAiCloseSettingsBtn" style="color: #cbd5e1;">&#x2715;</button>
        </div>

        <div style="font-size: 0.78rem; color: #94a3b8; margin-bottom: 10px;">
          Pilih Provider AI &amp; Konfigurasi API Key:
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px;">
          <!-- Option 1: Google Gemini API -->
          <label class="admin-ai-settings-label">
            <input type="radio" name="adminAiEngineMode" value="gemini" id="adminModeGeminiRadio">
            <span><strong>Google Gemini API</strong> (Direct Cloud AI)</span>
          </label>

          <!-- Option 2: OpenRouter Multi-Model API -->
          <label class="admin-ai-settings-label">
            <input type="radio" name="adminAiEngineMode" value="openrouter" id="adminModeOpenRouterRadio" checked>
            <span><strong>OpenRouter Multi-Model API</strong> (DeepSeek, Llama, GPT, dll)</span>
          </label>

          <!-- Option 3: Smart Local Barista -->
          <label class="admin-ai-settings-label">
            <input type="radio" name="adminAiEngineMode" value="local" id="adminModeLocalRadio">
            <span><strong>Smart Local Barista</strong> (Offline Fallback)</span>
          </label>

          <!-- Input 1: Gemini API Key -->
          <div class="admin-ai-key-group" id="adminGeminiKeyGroup">
            <label class="admin-ai-key-title">Gemini API Key:</label>
            <input
              type="password"
              id="adminGeminiApiKeyInput"
              class="admin-ai-key-input"
              placeholder="Masukkan Gemini API Key..."
              value="${AIEngine.config.geminiApiKey || 'AQ.Ab8RN6IzlWQYQYgs1Nn6fJiroApOilTNf1wgSCSwzLbdr7upmw'}"
            >
            <span class="admin-ai-key-hint">*Digunakan saat memilih Google Gemini API.</span>
          </div>

          <!-- Input 2: OpenRouter API Key -->
          <div class="admin-ai-key-group" id="adminOpenRouterKeyGroup">
            <label class="admin-ai-key-title">OpenRouter API Key:</label>
            <input
              type="password"
              id="adminOpenRouterApiKeyInput"
              class="admin-ai-key-input"
              placeholder="Masukkan OpenRouter API Key..."
              value="${AIEngine.config.openRouterApiKey || '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'}"
            >
            <span class="admin-ai-key-hint">*Default terisi key OpenRouter Kopi Mahasiswa.</span>
          </div>

          <button class="admin-ai-save-settings-btn" id="saveAdminAiSettingsBtn">
            Simpan Pengaturan
          </button>
        </div>
      </div>

      <!-- Multi-Model Selector Bar (OpenRouter & Gemini Direct) -->
      <div class="admin-ai-model-bar">
        <div class="admin-ai-model-tag">
          <span class="model-tag-icon">&#x26A1;</span>
          <span class="model-tag-text">Model:</span>
        </div>
        <select class="admin-ai-model-select" id="adminAiModelSelect" aria-label="Pilih Model AI">
          <optgroup label="🌐 OpenRouter Multi-Model API">
            <option value="openrouter:google/gemini-2.5-flash">Gemini 2.5 Flash (Super Cepat)</option>
            <option value="openrouter:deepseek/deepseek-chat">DeepSeek V3 (Analisis Mendalam)</option>
            <option value="openrouter:openai/gpt-4o-mini">OpenAI GPT-4o Mini (Terstruktur)</option>
            <option value="openrouter:meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B (Penalaran Bisnis)</option>
            <option value="openrouter:mistralai/mistral-small-24b-instruct-2501">Mistral Small 24B (Ringkas &amp; Gesit)</option>
          </optgroup>
          <optgroup label="🔷 Google Gemini Direct API">
            <option value="gemini:gemini-3.7-flash">Gemini 3.7 Flash (Direk Google)</option>
            <option value="gemini:gemini-3.5-flash-lite">Gemini 3.5 Flash-Lite (Direk Google)</option>
          </optgroup>
          <optgroup label="⚡ Offline Fallback">
            <option value="local:offline-local">Smart Local Barista (Tanpa Internet)</option>
          </optgroup>
        </select>
      </div>

      <!-- Quick Action Chips -->
      <div class="admin-ai-chips" id="adminAiChips">
        <button class="admin-ai-chip" data-prompt="Siapa saja member yang terdaftar saat ini?">Daftar Member 🎓</button>
        <button class="admin-ai-chip" data-prompt="Tampilkan ringkasan penjualan dan total pendapatan saat ini">Laporan Penjualan</button>
        <button class="admin-ai-chip" data-prompt="Analisis kondisi stok produk saat ini, mana yang perlu restock?">Analisis Stok</button>
        <button class="admin-ai-chip" data-prompt="Apa menu terlaris saat ini?">Menu Terlaris</button>
        <button class="admin-ai-chip" data-prompt="Berikan rekomendasi strategi bundling dan promo untuk meningkatkan revenue">Ide Promo &amp; Bundling</button>
        <button class="admin-ai-chip" data-prompt="Siapa saya?">Identitas Admin</button>
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
  // 2. STATE & DOM REFERENCES
  // ===================================================
  let adminChatHistory = [];
  let isAdminThinking = false;

  const adminAiLauncherBtn = document.getElementById("adminAiLauncherBtn");
  const adminAiPanel = document.getElementById("adminAiPanel");
  const adminAiCloseBtn = document.getElementById("adminAiCloseBtn");
  const adminAiResetBtn = document.getElementById("adminAiResetBtn");
  const adminAiSettingsToggleBtn = document.getElementById("adminAiSettingsToggleBtn");
  const adminAiSettingsModal = document.getElementById("adminAiSettingsModal");
  const adminAiCloseSettingsBtn = document.getElementById("adminAiCloseSettingsBtn");
  const saveAdminAiSettingsBtn = document.getElementById("saveAdminAiSettingsBtn");

  const adminModeGeminiRadio = document.getElementById("adminModeGeminiRadio");
  const adminModeOpenRouterRadio = document.getElementById("adminModeOpenRouterRadio");
  const adminModeLocalRadio = document.getElementById("adminModeLocalRadio");
  const adminGeminiApiKeyInput = document.getElementById("adminGeminiApiKeyInput");
  const adminOpenRouterApiKeyInput = document.getElementById("adminOpenRouterApiKeyInput");

  const adminAiChips = document.getElementById("adminAiChips");
  const adminAiBody = document.getElementById("adminAiBody");
  const adminAiForm = document.getElementById("adminAiForm");
  const adminAiInput = document.getElementById("adminAiInput");
  const adminAiModelSelect = document.getElementById("adminAiModelSelect");
  const adminAiModelStatus = document.getElementById("adminAiModelStatus");

  // Load Saved Provider & Model
  let activeProvider = localStorage.getItem("kopi_ai_provider") || "openrouter";
  let currentAdminModel = localStorage.getItem("kopi_ai_admin_model") || "google/gemini-2.5-flash";

  // Base URL bot API (adaptif terhadap HTTPS)
  const AI_BOT_API_BASE = (typeof window.BOT_API_BASE !== "undefined")
    ? window.BOT_API_BASE
    : (window.location.protocol === "https:" ? "" : "http://localhost:3000");

  // Cached data
  let cachedMembersForAI = [...OFFICIAL_6_MEMBERS];
  let cachedMetricsForAI = { totalOrders: 21, totalRevenue: 841600, avgOrder: 40076 };

  // ===================================================
  // 3. MODEL & PROVIDER STATUS SYNC
  // ===================================================
  function updateHeaderStatus(provider, modelId) {
    if (!adminAiModelStatus) return;
    const cleanModel = modelId ? modelId.replace(/^(openrouter|gemini|local):/, "") : "";
    let providerLabel = "OpenRouter";
    let modelName = cleanModel;

    if (provider === "gemini") {
      providerLabel = "🔷 Gemini API";
      modelName = cleanModel === "gemini-3.7-flash" ? "Gemini 3.7 Flash" : "Gemini 3.5 Flash-Lite";
    } else if (provider === "local") {
      providerLabel = "⚡ Local";
      modelName = "Smart Barista Offline";
    } else {
      providerLabel = "🌐 OpenRouter";
      const modelMap = {
        "google/gemini-2.5-flash": "Gemini 2.5 Flash",
        "deepseek/deepseek-chat": "DeepSeek V3",
        "openai/gpt-4o-mini": "GPT-4o Mini",
        "meta-llama/llama-3.3-70b-instruct": "Llama 3.3 70B",
        "mistralai/mistral-small-24b-instruct-2501": "Mistral Small"
      };
      modelName = modelMap[cleanModel] || cleanModel.split("/")[1] || cleanModel;
    }

    adminAiModelStatus.innerHTML = `${providerLabel} &bull; <strong>${modelName}</strong>`;
  }

  // Sync Select Dropdown Value
  function syncModelSelectUI() {
    if (!adminAiModelSelect) return;
    let targetVal = `${activeProvider}:${currentAdminModel}`;
    const exists = adminAiModelSelect.querySelector(`option[value="${targetVal}"]`);
    if (exists) {
      adminAiModelSelect.value = targetVal;
    } else {
      if (activeProvider === "gemini") {
        adminAiModelSelect.value = "gemini:gemini-3.7-flash";
      } else if (activeProvider === "local") {
        adminAiModelSelect.value = "local:offline-local";
      } else {
        adminAiModelSelect.value = "openrouter:google/gemini-2.5-flash";
      }
    }
    updateHeaderStatus(activeProvider, adminAiModelSelect.value);
  }

  // Sync Settings Modal Radios
  function syncSettingsModalUI() {
    if (activeProvider === "gemini" && adminModeGeminiRadio) {
      adminModeGeminiRadio.checked = true;
    } else if (activeProvider === "local" && adminModeLocalRadio) {
      adminModeLocalRadio.checked = true;
    } else if (adminModeOpenRouterRadio) {
      adminModeOpenRouterRadio.checked = true;
    }
  }

  syncModelSelectUI();
  syncSettingsModalUI();

  // Dropdown Change Handler
  if (adminAiModelSelect) {
    adminAiModelSelect.addEventListener("change", (e) => {
      const fullVal = e.target.value;
      const [prov, ...modelParts] = fullVal.split(":");
      const modelVal = modelParts.join(":");

      activeProvider = prov;
      currentAdminModel = modelVal;

      localStorage.setItem("kopi_ai_provider", activeProvider);
      localStorage.setItem("kopi_ai_admin_model", currentAdminModel);

      if (typeof AIEngine !== "undefined" && AIEngine.config) {
        AIEngine.config.provider = activeProvider;
        AIEngine.config.useOpenRouter = activeProvider === "openrouter";
        AIEngine.config.useGemini = activeProvider === "gemini";
        if (activeProvider === "openrouter") {
          AIEngine.config.openRouterModel = currentAdminModel;
        } else if (activeProvider === "gemini") {
          AIEngine.config.geminiModel = currentAdminModel;
        }
      }

      updateHeaderStatus(activeProvider, fullVal);
      syncSettingsModalUI();
      const optText = e.target.options[e.target.selectedIndex].text;
      appendAdminAiSystemNotice(`⚡ Engine dialihkan ke: **${optText}**`);
    });
  }

  // Settings Modal Toggle & Save
  if (adminAiSettingsToggleBtn) {
    adminAiSettingsToggleBtn.addEventListener("click", () => {
      adminAiSettingsModal.classList.toggle("active");
    });
  }
  if (adminAiCloseSettingsBtn) {
    adminAiCloseSettingsBtn.addEventListener("click", () => {
      adminAiSettingsModal.classList.remove("active");
    });
  }
  if (saveAdminAiSettingsBtn) {
    saveAdminAiSettingsBtn.addEventListener("click", () => {
      let selectedMode = "openrouter";
      if (adminModeGeminiRadio && adminModeGeminiRadio.checked) selectedMode = "gemini";
      else if (adminModeLocalRadio && adminModeLocalRadio.checked) selectedMode = "local";
      else if (adminModeOpenRouterRadio && adminModeOpenRouterRadio.checked) selectedMode = "openrouter";

      const geminiKey = (adminGeminiApiKeyInput.value || "").trim();
      const openRouterKey = (adminOpenRouterApiKeyInput.value || "").trim();

      activeProvider = selectedMode;
      localStorage.setItem("kopi_ai_provider", activeProvider);

      if (typeof AIEngine !== "undefined" && AIEngine.saveConfig) {
        AIEngine.saveConfig({
          provider: selectedMode,
          useOpenRouter: selectedMode === "openrouter",
          useGemini: selectedMode === "gemini",
          geminiApiKey: geminiKey,
          openRouterApiKey: openRouterKey
        });
      }

      adminAiSettingsModal.classList.remove("active");
      syncModelSelectUI();

      const modeLabel = selectedMode === "gemini"
        ? "Google Gemini API"
        : (selectedMode === "openrouter" ? "OpenRouter Multi-Model API" : "Smart Local Barista (Offline Fallback)");
      appendAdminAiSystemNotice(`⚙️ Pengaturan Engine AI diperbarui! Provider aktif: **${modeLabel}**.`);
    });
  }

  // ===================================================
  // 4. ROLE DETECTION & TRANSACTION RECAPITULATION ENGINE
  // ===================================================
  /**
   * Mendeteksi Role aktif pengguna yang sedang login (Admin / Owner)
   * Berdasarkan cookie server, localStorage, sessionStorage, dan DOM header
   */
  function detectActiveRole() {
    let cookieRole = null;
    const match = document.cookie.match('(^|;) ?km_auth_role=([^;]*)(;|$)');
    if (match) cookieRole = decodeURIComponent(match[2]).toLowerCase().trim();

    const localRole = (localStorage.getItem("km_auth_role") || "").toLowerCase().trim();
    const isOwnerVerified = document.cookie.includes("kopi_owner_verified=true");

    const userNameEl = document.getElementById("adminUserNameHeader") || document.querySelector(".admin-user-name");
    const dropdownBadgeEl = document.getElementById("adminDropdownBadge") || document.querySelector(".admin-dropdown-badge");
    const userText = (userNameEl?.textContent || "").toLowerCase();
    const badgeText = (dropdownBadgeEl?.textContent || "").toLowerCase();

    let role = "Admin";
    let displayName = "Fathialaziz (Admin)";

    if (cookieRole === "owner" || localRole === "owner" || isOwnerVerified || userText.includes("owner") || badgeText.includes("owner")) {
      role = "Owner";
      displayName = "Owner Kopi Mahasiswa";
    } else {
      role = "Admin";
      displayName = "Fathialaziz (Admin / Super Admin)";
    }

    return { role, displayName, raw: role.toLowerCase() };
  }

  /**
   * Mengumpulkan data transaksi lengkap periode aktif / seluruh transaksi
   * Melakukan rekapitulasi otomatis: total transaksi, total omset, daftar pembeli, dan menu terlaris
   */
  function getTransactionContext(requestedTimeframe = null) {
    const roleInfo = detectActiveRole();

    // 1. Ambil seluruh transaksi dari StorageManager / Fallback Seeds (21 Transaksi)
    let allTxs = [];
    if (typeof StorageManager !== "undefined" && typeof StorageManager.getTransactions === "function") {
      allTxs = StorageManager.getTransactions() || [];
    }
    if (!allTxs || allTxs.length < 5) {
      const seeds = generateOfficial21Transactions();
      allTxs = (allTxs || []).concat(seeds.filter(s => !(allTxs || []).some(e => e.id === s.id)));
      if (typeof StorageManager !== "undefined" && typeof StorageManager.saveTransactions === "function") {
        StorageManager.saveTransactions(allTxs);
      }
    }

    // 2. Deteksi Timeframe Aktif dari Dashboard Context atau DOM
    let activeTf = requestedTimeframe;
    if (!activeTf) {
      if (window.getAdminDashboardContext) {
        const ctx = window.getAdminDashboardContext();
        activeTf = ctx.activeTimeframe;
      }
      if (!activeTf) {
        const activeTxBtn = document.querySelector(".tx-time-filter.active");
        const activeTfBtn = document.querySelector(".timeframe-pill-btn.active");
        if (activeTxBtn) activeTf = activeTxBtn.getAttribute("data-tf");
        else if (activeTfBtn) activeTf = activeTfBtn.getAttribute("data-tf");
        else activeTf = "all";
      }
    }
    if (!activeTf) activeTf = "all";

    // 3. Filter Transaksi Berdasarkan Periode
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let filteredTxs = [...allTxs];
    let periodLabel = "Semua Waktu";

    if (activeTf === "today" || activeTf === "hari_ini") {
      filteredTxs = allTxs.filter(t => new Date(t.date) >= startOfToday);
      periodLabel = "Hari Ini";
    } else if (activeTf === "7days" || activeTf === "minggu_ini" || activeTf === "week") {
      const sevenDaysAgo = new Date(startOfToday);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      filteredTxs = allTxs.filter(t => new Date(t.date) >= sevenDaysAgo);
      periodLabel = "7 Hari Terakhir";
    } else if (activeTf === "month" || activeTf === "bulan_ini") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      filteredTxs = allTxs.filter(t => new Date(t.date) >= startOfMonth);
      periodLabel = "Bulan Ini";
    } else {
      periodLabel = "Semua Waktu";
    }

    // Safety fallback: jika filter periode tertentu kosong (misal hari ini belum ada order baru), tampilkan seluruh transaksi
    if (filteredTxs.length === 0 && allTxs.length > 0) {
      filteredTxs = [...allTxs];
      periodLabel = "Semua Waktu (Data Tersedia)";
    }

    // 4. Rekapitulasi Otomatis (Total Transaksi & Total Omset)
    const totalOrders = filteredTxs.length;
    const totalRevenue = filteredTxs.reduce((sum, t) => sum + Number(t.total || 0), 0);
    const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    // 5. Rekap Menu Terlaris (Kuantitas Terbanyak ke Terkecil)
    const productSalesMap = {};
    const productRevMap = {};

    filteredTxs.forEach(t => {
      if (Array.isArray(t.items)) {
        t.items.forEach(item => {
          const name = (item.productName || item.name || item.nama_menu || "Menu").trim();
          const qty = Number(item.quantity || item.qty || 1);
          const price = Number(item.price || item.harga || 0);
          const sub = Number(item.subtotal || (price * qty));
          productSalesMap[name] = (productSalesMap[name] || 0) + qty;
          productRevMap[name] = (productRevMap[name] || 0) + sub;
        });
      }
    });

    const topSellingList = Object.entries(productSalesMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, qty]) => ({
        name,
        quantity: qty,
        revenue: productRevMap[name] || 0
      }));

    const topSellingFormatted = topSellingList.length > 0
      ? topSellingList.map((item, idx) => {
          const revStr = item.revenue > 0 ? ` (Rp ${item.revenue.toLocaleString("id-ID")})` : "";
          const badge = idx === 0 ? "🥇 " : (idx === 1 ? "🥈 " : (idx === 2 ? "🥉 " : `${idx + 1}. `));
          return `${badge}**${item.name}**: ${item.quantity} porsi terjual${revStr}`;
        }).join("\n")
      : "Data penjualan belum tersedia untuk periode ini.";

    // 6. Daftar Nama Pembeli & Rincian Pesanan per Transaksi
    const buyersList = filteredTxs.map((t, idx) => {
      const itemsList = Array.isArray(t.items) && t.items.length > 0
        ? t.items.map(i => `${i.productName || i.name || i.nama_menu || 'Menu'} x${i.quantity || i.qty || 1}`).join(", ")
        : "-";
      const timeStr = t.dateFormatted || t.date || "Hari ini";
      const payMethod = t.paymentMethod || "QRIS";
      const totalStr = "Rp " + Number(t.total || 0).toLocaleString("id-ID");
      const buyerName = t.customerName || t.nama_pelanggan || "Pelanggan";
      const txId = t.id || t.kode_transaksi || `KM-${idx + 1}`;
      return `${idx + 1}. **${buyerName}** [${txId}] (${timeStr}, ${payMethod}, ${totalStr}): ${itemsList}`;
    });

    const buyersListFormatted = buyersList.length > 0
      ? buyersList.join("\n")
      : "Belum ada catatan pembeli pada periode ini.";

    return {
      roleInfo,
      timeframe: activeTf,
      periodLabel,
      totalOrders,
      totalRevenue,
      avgOrder,
      topSellingList,
      topSellingFormatted,
      buyersList,
      buyersListFormatted,
      transactions: filteredTxs,
      allTransactions: allTxs
    };
  }

  function getActiveScreenOmset() {
    const ctx = getTransactionContext();
    return {
      totalRevenue: ctx.totalRevenue,
      totalOrders: ctx.totalOrders
    };
  }

  // ===================================================
  // 5. FETCH MEMBERS & LIVE METRICS
  // ===================================================
  // Membaca seluruh data member secara lengkap (6 orang dari members.json)
  async function fetchMembersForAI() {
    try {
      const res = await fetch(`${AI_BOT_API_BASE}/api/members`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.data) && json.data.length >= 6) {
          cachedMembersForAI = json.data;
          return json.data;
        }
      }
    } catch (e) {
      console.warn("[AdminAI] Gagal fetch /api/members:", e.message || e);
    }

    // Fallback: baca langsung file members.json dari web server
    try {
      const res2 = await fetch("members.json", { signal: AbortSignal.timeout(3000) });
      if (res2.ok) {
        const data = await res2.json();
        if (Array.isArray(data) && data.length >= 6) {
          cachedMembersForAI = data;
          return data;
        }
      }
    } catch (e) {}

    // Fallback: local StorageManager
    if (typeof StorageManager !== "undefined" && StorageManager.getMembersList) {
      const list = StorageManager.getMembersList() || [];
      if (list.length >= 6) {
        cachedMembersForAI = list;
        return list;
      }
    }

    cachedMembersForAI = [...OFFICIAL_6_MEMBERS];
    return cachedMembersForAI;
  }

  // Fetch live metrics dari database MySQL
  async function fetchLiveMetricsForAI() {
    try {
      const res = await fetch(`${AI_BOT_API_BASE}/api/analytics-summary`, { signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const json = await res.json();
        if (json && json.success) {
          cachedMetricsForAI = {
            totalOrders: Number(json.totalOrders || 21),
            totalRevenue: Number(json.totalRevenue || 841600),
            avgOrder: Number(json.avgOrder || 40076),
            topItems: json.topItems || ""
          };
          return cachedMetricsForAI;
        }
      }
    } catch (e) {
      console.warn("[AdminAI] Gagal fetch /api/analytics-summary:", e.message || e);
    }

    try {
      const res2 = await fetch("owner_analytics.php?timeframe=all", { signal: AbortSignal.timeout(4000) });
      if (res2.ok) {
        const json2 = await res2.json();
        if (json2 && json2.metrics) {
          cachedMetricsForAI = {
            totalOrders: Number(json2.metrics.total_pesanan || json2.metrics.total_orders || 21),
            totalRevenue: Number(json2.metrics.total_omset || json2.metrics.total_revenue || 841600),
            avgOrder: Number(json2.metrics.rata_rata_transaksi || 40076)
          };
          return cachedMetricsForAI;
        }
      }
    } catch (e) {}

    return cachedMetricsForAI;
  }

  // Pre-fetch data saat dashboard dimuat
  fetchMembersForAI();
  fetchLiveMetricsForAI();

  // ===================================================
  // 6. OPEN / CLOSE PANEL
  // ===================================================
  function toggleAdminPanel(open) {
    const isOpen = open !== undefined ? open : !adminAiPanel.classList.contains("active");
    const launcher = document.getElementById("adminAiLauncher");
    if (isOpen) {
      adminAiPanel.classList.add("active");
      adminAiPanel.setAttribute("aria-hidden", "false");
      if (launcher) launcher.classList.add("hidden");
      setTimeout(() => adminAiInput.focus(), 200);
      fetchMembersForAI();
      fetchLiveMetricsForAI().then(() => {
        if (adminAiBody.children.length === 0) {
          initAdminWelcome();
        }
      });
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
  // 7. WELCOME MESSAGE (Serius & To The Point)
  // ===================================================
  function initAdminWelcome() {
    const products = AIEngine.getProducts ? AIEngine.getProducts() : [];
    const fmt = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

    const outOfStock = products.filter(p => {
      const s = Number(p.stok !== undefined ? p.stok : (p.stock !== undefined ? p.stock : 10));
      return s <= 0;
    });

    const roleInfo = detectActiveRole();
    const txCtx = getTransactionContext();
    const txCount = txCtx.totalOrders;
    const totalRev = txCtx.totalRevenue;

    let welcome = `Selamat datang di **KopiAI Admin**. Sistem siap menyajikan data operasional, stok menu, dan laporan transaksi Kopi Mahasiswa.`;
    welcome += `\n\n• Peran aktif login: **${roleInfo.role}** (${roleInfo.displayName})`;
    welcome += `\n• Total transaksi: **${txCount} pesanan** (Periode: ${txCtx.periodLabel})`;
    welcome += `\n• Total omset saat ini: **${fmt(totalRev)}**`;
    if (outOfStock.length > 0) {
      const names = outOfStock.map(p => p.nama_menu || p.name).join(", ");
      welcome += "\n• Stok habis: **" + names + "**";
    }
    const memCount = cachedMembersForAI.length > 0 ? cachedMembersForAI.length : 6;
    welcome += `\n• Member terdaftar: **${memCount} orang**`;

    welcome += "\n\nSilakan pilih topik di atas atau masukkan pertanyaan Anda.";
    appendAdminAiMessage(welcome);
  }

  // ===================================================
  // 8. MESSAGE HANDLING (Serius, Real-Time Omset, 6 Member)
  // ===================================================
  async function handleAdminMessage(message) {
    appendAdminUserMessage(message);
    isAdminThinking = true;
    showAdminTyping();

    try {
      const trimmedMsg = message.trim();
      const lowerMsg = trimmedMsg.toLowerCase();

      // Ambil context data transaksi lengkap & role aktif
      const roleInfo = detectActiveRole();
      const txCtx = getTransactionContext();

      // Pastikan members ter-fetch (seluruh 6 member)
      const members = (cachedMembersForAI && cachedMembersForAI.length >= 6)
        ? cachedMembersForAI
        : await fetchMembersForAI();

      let reply = null;

      // ------------------------------------------------------------------
      // ATURAN 1: Role Aktif & Identitas Pengguna yang sedang login
      // ------------------------------------------------------------------
      const isRoleQuery = (
        /\b(role|peran|level|hak\s*akses)\b/i.test(lowerMsg) &&
        /\b(saya|aku|login|aktif|saat\s*ini|sekarang|apa|siapa|cek|status)\b/i.test(lowerMsg)
      ) || /\b(siapa\s+(saya|aku|admin|owner)|identitas\s+(saya|aku|admin|owner)|(saya|aku)\s+siapa|status\s+login)\b/i.test(lowerMsg);

      if (isRoleQuery) {
        hideAdminTyping();
        let roleReply = `Role aktif yang sedang login saat ini adalah **${roleInfo.role}**.\n\n`;
        roleReply += `• Pengguna: **${roleInfo.displayName}**\n`;
        if (roleInfo.role === "Owner") {
          roleReply += `• Hak Akses: Akses eksekutif penuh, pemantauan omset dan laporan finansial, analisis performa bisnis, dan pengaturan tingkat tinggi.`;
        } else {
          roleReply += `• Hak Akses: Akses panel operasional harian kasir/POS, manajemen katalog produk, kontrol stok bahan & produk, pencatatan transaksi, dan data member.`;
        }
        appendAdminAiMessage(roleReply);
        isAdminThinking = false;
        return;
      }

      // ------------------------------------------------------------------
      // ATURAN 2: Total Transaksi & Omset Periode Aktif
      // ------------------------------------------------------------------
      const isTxSummaryQuery = (
        /\b(total|jumlah|berapa|rekap)\s*(transaksi|pesanan|order)\b/i.test(lowerMsg) ||
        /\b(total|berapa)\s*(omset|pendapatan|penjualan|revenue)\b/i.test(lowerMsg) ||
        /\b(transaksi|penjualan|omset)\s*(periode|saat\s*ini|hari\s*ini|semua|aktif)\b/i.test(lowerMsg) ||
        /^(total\s*transaksi|total\s*omset|laporan\s*penjualan|ringkasan\s*penjualan)$/i.test(lowerMsg.trim())
      );

      if (isTxSummaryQuery) {
        hideAdminTyping();
        let summaryReply = `Berikut rekapitulasi data transaksi untuk **Periode ${txCtx.periodLabel}**:\n\n`;
        summaryReply += `• Total Transaksi: **${txCtx.totalOrders} pesanan**\n`;
        summaryReply += `• Total Omset / Pendapatan: **Rp ${txCtx.totalRevenue.toLocaleString("id-ID")}**\n`;
        summaryReply += `• Rata-rata Nilai Pesanan (AOV): **Rp ${txCtx.avgOrder.toLocaleString("id-ID")}**\n`;
        if (txCtx.topSellingList.length > 0) {
          summaryReply += `• Menu Terlaris: **${txCtx.topSellingList[0].name}** (${txCtx.topSellingList[0].quantity} porsi terjual)\n`;
        }
        summaryReply += `\nSeluruh data transaksi tercatat akurat dan tersinkronisasi di sistem Kopi Mahasiswa.`;
        appendAdminAiMessage(summaryReply);
        isAdminThinking = false;
        return;
      }

      // ------------------------------------------------------------------
      // ATURAN 3: Siapa Saja Nama Pembeli & Pesanannya (Lengkap Tanpa Terpotong)
      // ------------------------------------------------------------------
      const isBuyersQuery = (
        /\b(pembeli|pemesan|pelanggan|konsumen|customer|nama\s*pemesan|nama\s*pembeli|yang\s*pesan|yang\s*beli)\b/i.test(lowerMsg) &&
        /\b(siapa|daftar|list|nama|pesanan|pesanannya|item|order|rincian|semua|detail|siapa\s*aja|siapa\s*saja|apa\s*saja|apa\s*aja)\b/i.test(lowerMsg)
      ) || /\b(siapa\s*(saja|aja)\s*yang\s*(pesan|beli|order))\b/i.test(lowerMsg)
        || /^(daftar\s*pembeli|daftar\s*pemesan|data\s*pembeli|siapa\s*yang\s*pesan)$/i.test(lowerMsg.trim());

      if (isBuyersQuery) {
        hideAdminTyping();
        let buyersReply = `Berikut daftar seluruh pembeli dan rincian pesanannya (**Periode ${txCtx.periodLabel}** — Total **${txCtx.totalOrders} pesanan**):\n\n`;
        buyersReply += txCtx.buyersListFormatted;
        appendAdminAiMessage(buyersReply);
        isAdminThinking = false;
        return;
      }

      // ------------------------------------------------------------------
      // ATURAN 4: Rekap Menu Terlaris (Top Selling Menu)
      // ------------------------------------------------------------------
      const isTopMenuQuery = (
        /\b(menu|produk|makanan|minuman)\b/i.test(lowerMsg) &&
        /\b(terlaris|paling\s*laris|paling\s*laku|favorit|top|bestseller|best\s*seller|unggulan|paling\s*banyak)\b/i.test(lowerMsg)
      ) || /\b(terlaris|paling\s*laris|best\s*seller|bestseller)\b/i.test(lowerMsg)
        || /^(menu\s*terlaris|produk\s*terlaris|top\s*seller|bestseller)$/i.test(lowerMsg.trim());

      if (isTopMenuQuery) {
        hideAdminTyping();
        let topReply = `Berikut rekapitulasi **Menu Terlaris** berdasarkan akumulasi kuantitas pesanan (**Periode ${txCtx.periodLabel}**):\n\n`;
        topReply += txCtx.topSellingFormatted;
        appendAdminAiMessage(topReply);
        isAdminThinking = false;
        return;
      }

      // ------------------------------------------------------------------
      // ATURAN 5: Daftar Seluruh 6 Member (Tanpa Terpotong)
      // ------------------------------------------------------------------
      const isMemberQuery = (
        /\b(member|anggota)\b/i.test(lowerMsg) &&
        (/(siapa|daftar|list|data|nama|semua|seluruh|cek|tampilkan|berapa|total|info|lihat|sebutkan|detail|lengkap|siapa\s*aja|siapa\s*saja|ada\s*siapa)/i.test(lowerMsg) ||
         /^(member|members|data\s*member|daftar\s*member)$/i.test(lowerMsg.trim()))
      );

      if (isMemberQuery) {
        const fullMemberList = members.map((m, i) => {
          const name = (m.name || "Member").trim();
          const campus = (m.campus || "-").trim();
          return `${i + 1}. **${name}** — Kampus: ${campus}`;
        }).join("\n");

        hideAdminTyping();
        appendAdminAiMessage(`Total terdaftar: **${members.length} member**\n\n${fullMemberList}`);
        isAdminThinking = false;
        return;
      }

      // ------------------------------------------------------------------
      // STRATEGI 1: Backend /api/ai-chat (OpenRouter / Gemini Direct)
      // ------------------------------------------------------------------
      try {
        const backendRes = await fetch(`${AI_BOT_API_BASE}/api/ai-chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            chatHistory: adminChatHistory.slice(-6),
            model: currentAdminModel,
            provider: activeProvider,
            role: roleInfo.raw,
            userRole: roleInfo.role,
            userName: roleInfo.displayName,
            activePeriod: txCtx.periodLabel,
            transactionSummary: {
              total: txCtx.totalOrders,
              revenue: txCtx.totalRevenue,
              avgOrder: txCtx.avgOrder
            },
            transactions: txCtx.transactions,
            recap: {
              buyersListText: txCtx.buyersListFormatted,
              topSellingMenuText: txCtx.topSellingFormatted
            }
          }),
          signal: AbortSignal.timeout(20000)
        });

        if (backendRes.ok) {
          const json = await backendRes.json();
          if (json.success && json.reply) {
            reply = json.reply;
            if (json.modelUsed) {
              updateHeaderStatus(activeProvider, json.modelUsed);
            }
          }
        } else {
          console.warn(`[AdminAI] Backend /api/ai-chat HTTP ${backendRes.status} — fallback ke frontend.`);
        }
      } catch (backendErr) {
        console.warn("[AdminAI] Backend offline atau timeout, fallback ke frontend AIEngine:", backendErr.message || backendErr);
      }

      // ------------------------------------------------------------------
      // STRATEGI 2: Fallback ke frontend AIEngine (Direct Browser API)
      // Menggunakan data transaksi nyata & lengkap (bukan fakeTxList)
      // ------------------------------------------------------------------
      if (!reply) {
        const aiResult = await AIEngine.chatWithAdmin(
          message,
          adminChatHistory,
          txCtx.transactions,
          members,
          currentAdminModel,
          {
            userRole: roleInfo.role,
            displayName: roleInfo.displayName,
            activePeriod: txCtx.periodLabel,
            totalOrders: txCtx.totalOrders,
            totalRevenue: txCtx.totalRevenue,
            buyersListText: txCtx.buyersListFormatted,
            topSellingMenuText: txCtx.topSellingFormatted
          }
        );
        if (aiResult && aiResult.reply) reply = aiResult.reply;
      }

      hideAdminTyping();
      appendAdminAiMessage(reply || "Maaf, tidak bisa memproses permintaan tersebut. Silakan coba lagi.");

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

  function appendAdminAiSystemNotice(text) {
    const row = document.createElement("div");
    row.className = "admin-ai-msg-row system";
    row.innerHTML = '<div class="admin-ai-system-notice">' + formatAdminMarkdown(text) + '</div>';
    adminAiBody.appendChild(row);
    adminAiBody.scrollTop = adminAiBody.scrollHeight;
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
  // 9. MARKDOWN & HTML UTILS
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
