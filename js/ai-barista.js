/**
 * KOPI MAHASISWA — AI BARISTA INTERACTIVE CONTROLLER
 * Handles chat widget lifecycle, quick chips, message rendering,
 * inline product cards, and instant cart integration.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Check if AIEngine exists
  if (typeof AIEngine === "undefined") {
    console.warn("AIEngine is not loaded.");
    return;
  }

  // State
  let chatHistory = (typeof AIEngine !== "undefined" && AIEngine.getChatHistory) ? AIEngine.getChatHistory() : [];
  let isThinking = false;

  // ===================================================
  // 1. INJECT DOM ELEMENTS (LAUNCHER & CHAT WINDOW)
  // ===================================================
  const baristaContainer = document.createElement("div");
  baristaContainer.id = "aiBaristaRoot";
  baristaContainer.innerHTML = `
    <!-- Floating Launcher -->
    <div class="ai-barista-launcher" id="aiLauncher" aria-label="Buka KopiAI Customer Service">
      <div class="ai-launcher-bubble" id="aiBubble">
        <span>☕ Hai kak! Ada yang bisa KopiAI bantu seputar menu, harga, atau rekomendasi minuman? Tanya di sini yuk!</span>
        <button class="ai-bubble-close" id="aiBubbleClose" aria-label="Tutup pesan">✕</button>
      </div>
      <button class="ai-launcher-btn" id="aiLauncherBtn" title="Chat dengan KopiAI Customer Service">
        <span class="ai-launcher-icon">☕</span>
        <span class="ai-sparkle-badge">✨ KopiAI Live</span>
      </button>
    </div>

    <!-- Floating Chat Window -->
    <div class="ai-chat-window" id="aiChatWindow" aria-hidden="true">
      <!-- Header -->
      <div class="ai-chat-header">
        <div class="ai-header-profile">
          <div class="ai-avatar-wrap">
            <span>☕</span>
            <span class="ai-online-dot"></span>
          </div>
          <div>
            <div class="ai-header-name">KopiAI Customer Service ✨</div>
            <div class="ai-header-status">
              <span class="ai-status-indicator">●</span>
              <span>Gemini AI Live • CS Resmi Kopi Mahasiswa 24/7</span>
            </div>
          </div>
        </div>

        <div class="ai-header-actions">
          <button class="ai-btn-icon" id="aiSettingsToggleBtn" title="Pengaturan AI">⚙️</button>
          <button class="ai-btn-icon" id="aiResetChatBtn" title="Reset Percakapan">🔄</button>
          <button class="ai-btn-icon" id="aiCloseChatBtn" title="Tutup Chat">✕</button>
        </div>
      </div>

      <!-- Settings Dropdown Modal -->
      <div class="ai-settings-modal" id="aiSettingsModal">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="font-family: var(--font-comic); font-size: 0.95rem; color: var(--coffee-950); margin: 0;">
            ⚙️ Pengaturan AI Gemini
          </h4>
          <button class="ai-btn-icon" id="aiCloseSettingsBtn" style="color: var(--coffee-950);">✕</button>
        </div>

        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 12px;">
          Pilih mode kecerdasan buatan Barista Virtual:
        </div>

        <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.82rem;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="radio" name="aiEngineMode" value="gemini" checked id="modeGeminiRadio">
            <span><strong>Google Gemini Live</strong> (Cloud AI)</span>
          </label>

          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="radio" name="aiEngineMode" value="local" id="modeLocalRadio">
            <span><strong>Smart Local Barista</strong> (Offline Fallback)</span>
          </label>

          <div id="geminiKeyGroup" style="display: block; margin-top: 6px;">
            <label style="font-size: 0.75rem; font-weight: 700; color: var(--coffee-800); display: block; margin-bottom: 4px;">Gemini API Key:</label>
            <input type="password" id="geminiApiKeyInput" class="form-input" style="font-size: 0.8rem; padding: 6px 10px;" placeholder="Masukkan Gemini API Key..." value="${AIEngine.config.geminiApiKey || 'AQ.Ab8RN6IzlWQYQYgs1Nn6fJiroApOilTNf1wgSCSwzLbdr7upmw'}">
            <span style="font-size: 0.7rem; color: var(--text-muted); display: block; margin-top: 4px;">
              *API Key aktif & terintegrasi langsung dengan Google Gemini.
            </span>
          </div>

          <button class="btn-primary" id="saveAiSettingsBtn" style="padding: 8px; font-size: 0.82rem; margin-top: 6px;">
            Simpan Pengaturan
          </button>
        </div>
      </div>

      <!-- Quick Prompt Chips -->
      <div class="ai-quick-chips-wrapper" id="aiChipsWrapper">
        <button class="ai-prompt-chip" data-prompt="Rekomendasi kopi hemat yang enak dan ramah kantong">☕ Kopi Hemat</button>
        <button class="ai-prompt-chip" data-prompt="Butuh kopi strong kafein tinggi penahan kantuk nugas">⚡ Kopi Strong</button>
        <button class="ai-prompt-chip" data-prompt="Rekomendasi minuman non-kopi yang segar dan ramah lambung">🍋 Non-Kopi Segar</button>
        <button class="ai-prompt-chip" data-prompt="Rekomendasi makanan atau snack pendamping kopi">🍞 Makanan & Snack</button>
        <button class="ai-prompt-chip" data-prompt="Buka sampai jam berapa dan di mana lokasi Kopi Mahasiswa?">📍 Jam Buka & Lokasi</button>
        <button class="ai-prompt-chip" data-prompt="Apa saja daftar menu paling murah di kafe?">💸 Menu Termurah</button>
      </div>

      <!-- Chat Body Messages -->
      <div class="ai-chat-body" id="aiChatBody">
        <!-- Injected via JS -->
      </div>

      <!-- Chat Footer Input -->
      <form class="ai-chat-footer" id="aiChatForm">
        <input 
          type="text" 
          id="aiChatInput" 
          class="ai-chat-input" 
          placeholder="Tanya menu, harga, lokasi, jam operasional, atau rekomendasi..." 
          autocomplete="off"
        >
        <button type="submit" class="ai-chat-send-btn" id="aiSendBtn" aria-label="Kirim Pesan">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
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

  document.body.appendChild(baristaContainer);

  // ===================================================
  // 2. DOM SELECTIONS & EVENT BINDINGS
  // ===================================================
  const aiLauncher = document.getElementById("aiLauncher");
  const aiLauncherBtn = document.getElementById("aiLauncherBtn");
  const aiBubble = document.getElementById("aiBubble");
  const aiBubbleClose = document.getElementById("aiBubbleClose");
  const aiChatWindow = document.getElementById("aiChatWindow");
  const aiCloseChatBtn = document.getElementById("aiCloseChatBtn");
  const aiResetChatBtn = document.getElementById("aiResetChatBtn");
  const aiSettingsToggleBtn = document.getElementById("aiSettingsToggleBtn");
  const aiSettingsModal = document.getElementById("aiSettingsModal");
  const aiCloseSettingsBtn = document.getElementById("aiCloseSettingsBtn");
  const saveAiSettingsBtn = document.getElementById("saveAiSettingsBtn");
  const modeLocalRadio = document.getElementById("modeLocalRadio");
  const modeGeminiRadio = document.getElementById("modeGeminiRadio");
  const geminiKeyGroup = document.getElementById("geminiKeyGroup");
  const geminiApiKeyInput = document.getElementById("geminiApiKeyInput");
  const aiChipsWrapper = document.getElementById("aiChipsWrapper");
  const aiChatBody = document.getElementById("aiChatBody");
  const aiChatForm = document.getElementById("aiChatForm");
  const aiChatInput = document.getElementById("aiChatInput");

  // Load Saved AI Settings
  if (AIEngine.config.useGemini) {
    modeGeminiRadio.checked = true;
    geminiKeyGroup.style.display = "block";
    geminiApiKeyInput.value = AIEngine.config.geminiApiKey || "AQ.Ab8RN6IzlWQYQYgs1Nn6fJiroApOilTNf1wgSCSwzLbdr7upmw";
  } else {
    modeLocalRadio.checked = true;
    geminiKeyGroup.style.display = "none";
  }

  modeGeminiRadio.addEventListener("change", () => {
    geminiKeyGroup.style.display = "block";
  });
  modeLocalRadio.addEventListener("change", () => {
    geminiKeyGroup.style.display = "none";
  });

  // Settings Open/Close
  aiSettingsToggleBtn.addEventListener("click", () => {
    aiSettingsModal.classList.toggle("active");
  });
  aiCloseSettingsBtn.addEventListener("click", () => {
    aiSettingsModal.classList.remove("active");
  });
  saveAiSettingsBtn.addEventListener("click", () => {
    const isGemini = modeGeminiRadio.checked;
    const key = (geminiApiKeyInput.value || "").trim();
    AIEngine.saveConfig({
      useGemini: isGemini,
      geminiApiKey: key
    });
    aiSettingsModal.classList.remove("active");
    appendAiMessage(`⚙️ Pengaturan AI disimpan! Menggunakan mode **${isGemini ? "Google Gemini AI Live" : "Smart Local Barista"}**.`);
  });

  // Render Saved Chat History on Startup
  function renderSavedHistory() {
    aiChatBody.innerHTML = "";
    if (chatHistory && chatHistory.length > 0) {
      chatHistory.forEach(item => {
        if (item.role === "user") {
          renderUserMessageDOM(item.content);
        } else if (item.role === "assistant") {
          renderAiMessageDOM(item.content, item.recommendations || []);
        }
      });
      scrollToBottom();
    } else {
      initWelcomeMessage();
    }
  }

  // Toggle Chat Window
  function toggleChat(open = null) {
    const isOpen = open !== null ? open : !aiChatWindow.classList.contains("active");
    if (isOpen) {
      aiChatWindow.classList.add("active");
      aiChatWindow.setAttribute("aria-hidden", "false");
      if (aiBubble) aiBubble.style.display = "none";
      setTimeout(() => aiChatInput.focus(), 300);
      if (aiChatBody.children.length === 0) {
        renderSavedHistory();
      }
    } else {
      aiChatWindow.classList.remove("active");
      aiChatWindow.setAttribute("aria-hidden", "true");
      aiSettingsModal.classList.remove("active");
    }
  }

  aiLauncherBtn.addEventListener("click", () => toggleChat());
  aiCloseChatBtn.addEventListener("click", () => toggleChat(false));

  const navAiBaristaBtn = document.getElementById("navAiBaristaBtn");
  const drawerAiBaristaBtn = document.getElementById("drawerAiBaristaBtn");
  const heroAiBtn = document.getElementById("heroAiBtn");

  if (navAiBaristaBtn) {
    navAiBaristaBtn.addEventListener("click", () => toggleChat(true));
  }
  if (drawerAiBaristaBtn) {
    drawerAiBaristaBtn.addEventListener("click", () => {
      const mobileNavDrawer = document.getElementById("mobileNavDrawer");
      const mobileNavBackdrop = document.getElementById("mobileNavBackdrop");
      if (mobileNavDrawer) mobileNavDrawer.classList.remove("open");
      if (mobileNavBackdrop) mobileNavBackdrop.classList.remove("active");
      toggleChat(true);
    });
  }
  if (heroAiBtn) {
    heroAiBtn.addEventListener("click", () => toggleChat(true));
  }

  if (aiBubbleClose) {
    aiBubbleClose.addEventListener("click", (e) => {
      e.stopPropagation();
      aiBubble.style.display = "none";
    });
  }

  // Reset Chat & Clear localStorage History
  aiResetChatBtn.addEventListener("click", () => {
    chatHistory = [];
    if (typeof AIEngine !== "undefined" && AIEngine.clearChatHistory) {
      AIEngine.clearChatHistory();
    }
    aiChatBody.innerHTML = "";
    initWelcomeMessage();
  });

  // Quick Chips Click
  aiChipsWrapper.addEventListener("click", (e) => {
    const chip = e.target.closest(".ai-prompt-chip");
    if (!chip || isThinking) return;
    const prompt = chip.getAttribute("data-prompt");
    handleUserMessage(prompt);
  });

  // Chat Form Submit
  aiChatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = (aiChatInput.value || "").trim();
    if (!text || isThinking) return;
    aiChatInput.value = "";
    handleUserMessage(text);
  });

  // ===================================================
  // 3. MESSAGE HANDLING, RENDERING & PERSISTENCE
  // ===================================================
  function initWelcomeMessage() {
    const userName = (typeof AIEngine !== "undefined" && AIEngine.getUserName) ? AIEngine.getUserName() : "";
    let welcomeText = "";
    if (userName) {
      welcomeText = `Halo kak **${userName}**! Senang ketemu lagi di **Kopi Mahasiswa** ☕✨\n\nAda yang bisa KopiAI bantu seputar menu, harga, jam operasional, atau rekomendasi minuman favorit hari ini?`;
    } else {
      welcomeText = `Halo kak! Selamat datang di **Kopi Mahasiswa** ☕✨\n\nAku **KopiAI**, asisten virtual dan customer service resmi di sini. Ada yang bisa aku bantu seputar menu, harga, jam operasional, atau rekomendasi minuman hari ini? Silakan tanya langsung atau klik tombol cepat di atas ya!`;
    }
    appendAiMessage(welcomeText, []);
  }

  function renderUserMessageDOM(text) {
    const row = document.createElement("div");
    row.className = "ai-msg-row user";
    row.innerHTML = `
      <div class="ai-msg-bubble">${formatMarkdown(text)}</div>
    `;
    aiChatBody.appendChild(row);
  }

  function renderAiMessageDOM(text, recommendations = []) {
    const row = document.createElement("div");
    row.className = "ai-msg-row ai";

    let recsHTML = "";
    if (recommendations && recommendations.length > 0) {
      const formatCurrency = (amount) => {
        if (typeof formatRupiah === "function") return formatRupiah(amount);
        return "Rp " + Number(amount || 0).toLocaleString("id-ID");
      };

      recsHTML = `
        <div class="ai-product-suggestions">
          ${recommendations.map(p => {
            const pName = p.nama_menu || p.name || "Menu";
            const pPrice = Number(p.harga !== undefined ? p.harga : (p.price || 0));
            const pStock = Number(p.stok !== undefined ? p.stok : (p.stock !== undefined ? p.stock : 10));
            const pId = p.id || pName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
            const pImg = p.image || p.gambar || (typeof getMenuImage === "function" ? getMenuImage(pName) : (typeof AIEngine !== "undefined" && AIEngine._findFallbackImage ? AIEngine._findFallbackImage(pName) : 'images/kopi-susu.jpg'));
            const isOutOfStock = pStock <= 0;

            return `
              <div class="ai-product-card-mini ${isOutOfStock ? 'is-out-of-stock' : ''}" data-id="${pId}">
                <img src="${pImg}" alt="${pName}" class="ai-mini-img">
                <div class="ai-mini-info">
                  <div class="ai-mini-title">${pName} ${isOutOfStock ? '<span style="color:#e63946;font-size:0.7rem;font-weight:700;">(Habis)</span>' : ''}</div>
                  <div class="ai-mini-price">${formatCurrency(pPrice)}</div>
                </div>
                ${isOutOfStock 
                  ? `<button class="ai-mini-btn-add out-of-stock" disabled style="background:#a0aec0;cursor:not-allowed;opacity:0.75;box-shadow:none;">Habis</button>`
                  : `<button class="ai-mini-btn-add" data-id="${pId}" data-name="${pName}">+ Keranjang</button>`
                }
              </div>
            `;
          }).join("")}
        </div>
      `;
    }

    row.innerHTML = `
      <div class="ai-msg-avatar">☕</div>
      <div class="ai-msg-bubble">
        ${formatMarkdown(text)}
        ${recsHTML}
      </div>
    `;

    aiChatBody.appendChild(row);
    attachCardAddToCartEvents(row);
  }

  function appendUserMessage(text) {
    renderUserMessageDOM(text);
    scrollToBottom();
    chatHistory.push({ role: "user", content: text });
    if (typeof AIEngine !== "undefined" && AIEngine.saveChatHistory) {
      AIEngine.saveChatHistory(chatHistory);
    }
  }

  function appendAiMessage(text, recommendations = []) {
    renderAiMessageDOM(text, recommendations);
    scrollToBottom();
    chatHistory.push({ role: "assistant", content: text, recommendations: recommendations });
    if (typeof AIEngine !== "undefined" && AIEngine.saveChatHistory) {
      AIEngine.saveChatHistory(chatHistory);
    }
  }

  function showTypingIndicator() {
    const row = document.createElement("div");
    row.className = "ai-msg-row ai";
    row.id = "aiTypingRow";
    row.innerHTML = `
      <div class="ai-msg-avatar">☕</div>
      <div class="ai-typing-indicator">
        <div class="ai-typing-dot"></div>
        <div class="ai-typing-dot"></div>
        <div class="ai-typing-dot"></div>
      </div>
    `;
    aiChatBody.appendChild(row);
    scrollToBottom();
  }

  function hideTypingIndicator() {
    const typing = document.getElementById("aiTypingRow");
    if (typing) typing.remove();
  }

  function scrollToBottom() {
    aiChatBody.scrollTop = aiChatBody.scrollHeight;
  }

  async function handleUserMessage(message) {
    appendUserMessage(message);
    isThinking = true;
    showTypingIndicator();

    try {
      // Realistic smooth pause for conversational feel
      const delayPromise = new Promise(resolve => setTimeout(resolve, 350));
      const aiPromise = AIEngine.chatWithBarista(message, chatHistory);
      const [_, result] = await Promise.all([delayPromise, aiPromise]);

      hideTypingIndicator();
      if (result && result.reply) {
        appendAiMessage(result.reply, result.recommendations || []);
      } else {
        appendAiMessage("Halo kak! Ada yang bisa Barista Virtual bantu untuk rekomendasi menu atau obrolan santai hari ini? ☕✨");
      }
    } catch (err) {
      console.error("AI Barista error:", err);
      hideTypingIndicator();
      appendAiMessage("Aduh maaf kak, koneksi AI Barista lagi sedikit terganggu. Coba tanyakan sekali lagi ya! ☕");
    } finally {
      isThinking = false;
    }
  }

  // ===================================================
  // 4. INLINE PRODUCT CARD "+ TAMBAH" EVENT
  // ===================================================
  function attachCardAddToCartEvents(container) {
    const btns = container.querySelectorAll(".ai-mini-btn-add");
    btns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const target = e.currentTarget;
        const prodId = target.getAttribute("data-id");

        if (typeof StorageManager !== "undefined") {
          const res = StorageManager.addToCart(prodId, 1);
          if (res.success) {
            target.classList.add("added");
            target.textContent = "✓ Ditambah";
            
            // Trigger cart badge & UI updates
            const counters = document.querySelectorAll(".cart-counter");
            if (counters.length > 0) {
              const summary = StorageManager.getCartSummary();
              counters.forEach(counter => {
                counter.textContent = summary.totalItems;
                counter.classList.add("pop");
                setTimeout(() => counter.classList.remove("pop"), 300);
              });
            }

            // Show Toast
            if (typeof window.showToast === "function") {
              window.showToast(`✅ ${res.productName} berhasil ditambahkan ke keranjang!`, "success");
            }

            setTimeout(() => {
              target.classList.remove("added");
              target.textContent = "+ Keranjang";
            }, 1500);
          }
        }
      });
    });
  }

  // ===================================================
  // 5. ENHANCED MARKDOWN PARSER (CODE BLOCKS, LISTS, ETC)
  // ===================================================
  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatMarkdown(text) {
    if (!text) return "";

    // 1. Extract triple-backtick code blocks
    const codeBlocks = [];
    let processed = text.replace(/```([a-zA-Z0-9_\-\+]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
      const id = `__CODE_BLOCK_${codeBlocks.length}__`;
      const cleanLang = lang ? lang.trim() : "code";
      const escapedCode = escapeHtml(code.trim());
      const encodedRaw = encodeURIComponent(code.trim());
      codeBlocks.push(`
        <div class="ai-code-wrapper">
          <div class="ai-code-header">
            <span class="ai-code-lang">${cleanLang}</span>
            <button class="ai-copy-code-btn" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodedRaw}')).then(()=>{this.textContent='✓ Disalin'; setTimeout(()=>this.textContent='Salin', 2000);});">Salin</button>
          </div>
          <pre class="ai-code-block"><code class="language-${cleanLang}">${escapedCode}</code></pre>
        </div>
      `);
      return id;
    });

    // 2. Extract single-backtick inline code
    const inlineCodes = [];
    processed = processed.replace(/`([^`\n]+)`/g, (match, code) => {
      const id = `__INLINE_CODE_${inlineCodes.length}__`;
      inlineCodes.push(`<code class="ai-inline-code">${escapeHtml(code)}</code>`);
      return id;
    });

    // 3. Escape general HTML in the remaining text
    let html = escapeHtml(processed);

    // 4. Headers: ### Title -> <h5>Title</h5>, ## Title -> <h4>Title</h4>
    html = html.replace(/^### (.*?)$/gm, '<h5 class="ai-msg-h5">$1</h5>');
    html = html.replace(/^## (.*?)$/gm, '<h4 class="ai-msg-h4">$1</h4>');
    html = html.replace(/^# (.*?)$/gm, '<h4 class="ai-msg-h4">$1</h4>');

    // 4b. Markdown Image Media: ![Caption](URL)
    html = html.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s\)]+)\)/g, (match, alt, src) => {
      const cleanAlt = alt || "Foto Menu";
      return `<figure class="ai-msg-image-wrap"><img src="${src}" alt="${cleanAlt}" class="ai-msg-media-img" loading="lazy"><figcaption class="ai-msg-media-caption">${cleanAlt}</figcaption></figure>`;
    });

    // 5. Bold & Italic formatting
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^\*\n]+)\*/g, '<em>$1</em>');
    html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');

    // 6. Bullet lists and numbered lists
    html = html.replace(/^[•\-\*]\s+(.*?)$/gm, '<li class="ai-msg-li">• $1</li>');
    html = html.replace(/^(\d+)\.\s+(.*?)$/gm, '<li class="ai-msg-li ai-msg-ol">$1. $2</li>');

    // 7. Spacing & Linebreaks
    html = html.replace(/\n\n/g, '<div class="ai-msg-spacer"></div>');
    html = html.replace(/\n/g, '<br>');

    // 8. Restore Code Blocks & Inline Code
    codeBlocks.forEach((block, idx) => {
      html = html.replace(`__CODE_BLOCK_${idx}__`, block);
    });
    inlineCodes.forEach((code, idx) => {
      html = html.replace(`__INLINE_CODE_${idx}__`, code);
    });

    return html;
  }
});
