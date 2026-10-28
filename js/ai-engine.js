/**
 * KOPI MAHASISWA — AI ENGINE & INTELLIGENT AGENT SYSTEM
 * Dual Chatbot Architecture:
 *   - Customer Chatbot (index.html): Friendly barista persona, topic-restricted, stock privacy
 *   - Admin Chatbot (admin.html): Professional business advisor with full data access
 */

const AIEngine = {
  // Configuration
  config: {
    useGemini: true,
    geminiApiKey: "AQ.Ab8RN6IzlWQYQYgs1Nn6fJiroApOilTNf1wgSCSwzLbdr7upmw",
    geminiModel: "gemini-3.7-flash",
  },
  dbMenu: [], // Menu data synchronized from MySQL database (get_menu.php)

  init() {
    try {
      const savedConfig = localStorage.getItem("kopi_ai_config");
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        this.config = { ...this.config, ...parsed };
      }
      if (!this.config.geminiApiKey) {
        this.config.geminiApiKey = "AQ.Ab8RN6IzlWQYQYgs1Nn6fJiroApOilTNf1wgSCSwzLbdr7upmw";
        this.config.useGemini = true;
      }
      if (!this.config.geminiModel || this.config.geminiModel === "gemini-2.0-flash") {
        this.config.geminiModel = "gemini-3.7-flash";
      }
    } catch (e) {
      console.warn("Could not load AI config from localStorage:", e);
    }
    this.fetchDatabaseMenu();
  },

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem("kopi_ai_config", JSON.stringify(this.config));
  },

  // ===================================================
  // 1. MYSQL DATABASE MENU INTEGRATION (get_menu.php)
  // ===================================================
  setDatabaseMenu(menuList) {
    if (Array.isArray(menuList) && menuList.length > 0) {
      this.dbMenu = menuList.map(item => {
        const rawName = item.nama_menu || item.name || "Menu";
        const rawCat = (item.kategori || item.category || "kopi").toLowerCase().trim();
        const rawPrice = Number(item.harga !== undefined ? item.harga : (item.price || 0));
        const rawStock = Number(item.stok !== undefined ? item.stok : (item.stock !== undefined ? item.stock : 10));
        const rawDesc = item.deskripsi || item.description || "-";
        const rawId = item.id || rawName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

        return {
          id: rawId,
          nama_menu: rawName,
          name: rawName,
          kategori: rawCat,
          category: rawCat,
          categoryLabel: this._formatCategoryLabel(rawCat),
          harga: rawPrice,
          price: rawPrice,
          stok: rawStock,
          stock: rawStock,
          deskripsi: rawDesc,
          description: rawDesc,
          badge: item.badge || (rawStock <= 0 ? "Habis" : ""),
          image: item.image || item.gambar || this._findFallbackImage(rawName)
        };
      });
      console.log(`[AIEngine] Berhasil memuat & menyinkronkan ${this.dbMenu.length} menu dari database MySQL.`);
    }
  },

  async fetchDatabaseMenu() {
    try {
      const response = await fetch("get_menu.php");
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          this.setDatabaseMenu(data);
          return this.dbMenu;
        }
      }
    } catch (e) {
      console.warn("[AIEngine] fetchDatabaseMenu gagal, menggunakan data menu lokal:", e);
    }
    return null;
  },

  getProducts() {
    if (this.dbMenu && this.dbMenu.length > 0) {
      return this.dbMenu;
    }
    if (typeof StorageManager !== "undefined" && typeof StorageManager.getProducts === "function") {
      const sm = StorageManager.getProducts(false);
      if (sm && sm.length > 0) return sm;
    }
    return typeof INITIAL_PRODUCTS_DATA !== "undefined" ? INITIAL_PRODUCTS_DATA : [];
  },

  _formatCategoryLabel(cat) {
    if (cat === "non-kopi" || cat === "nonkopi") return "Non-Kopi";
    if (cat === "kopi") return "Kopi";
    if (cat === "makanan") return "Makanan";
    if (cat === "snack") return "Snack";
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  },

  _findFallbackImage(name) {
    if (typeof getMenuImage === "function") {
      return getMenuImage(name) || "";
    }
    if (typeof menuImages !== "undefined" && name && menuImages[name.trim()]) {
      return menuImages[name.trim()];
    }
    return "";
  },

  // ===================================================
  // 2. DYNAMIC MEMORY & USER CONTEXT (localStorage)
  // ===================================================
  getUserName() {
    try {
      return localStorage.getItem("kopi_ai_user_name") || "";
    } catch (e) {
      return "";
    }
  },

  setUserName(name) {
    if (!name) return "";
    const cleanName = name.trim();
    const formatted = cleanName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    try {
      localStorage.setItem("kopi_ai_user_name", formatted);
    } catch (e) {}
    return formatted;
  },

  extractUserName(text) {
    if (!text) return null;
    const t = text.trim();
    const patterns = [
      /(?:nama\s+saya|nama\s+aku|nama\s+gue|nama\s+gw|namaku)(?:\s+adalah)?\s+([A-Za-z]+)/i,
      /(?:panggil\s+aja|panggil\s+saja|panggil\s+aku|panggil\s+saya|panggil\s+gw|panggil\s+gue)\s+([A-Za-z]+)/i,
      /(?:kenalin|perkenalkan|halo|hai)?\s*,?\s*(?:aku|saya|gue|gw)\s+([A-Za-z]+)(?:,|\.|$|\s)/i
    ];
    const stopWords = new Set([
      "mau", "ingin", "pesan", "order", "beli", "pengen", "lagi", "sedang", "bisa", "gak", "tidak",
      "bukan", "punya", "suka", "butuh", "cari", "haus", "lapar", "capek", "lelah", "pusing", "nugas",
      "kuliah", "skripsi", "ngopi", "makan", "minum", "disini", "ada", "udah", "sudah", "baru", "saja", "aja", "barista"
    ]);
    for (const pat of patterns) {
      const match = t.match(pat);
      if (match && match[1]) {
        const potentialName = match[1].trim();
        if (potentialName.length >= 2 && !stopWords.has(potentialName.toLowerCase())) {
          return this.setUserName(potentialName);
        }
      }
    }
    return null;
  },

  getChatHistory() {
    try {
      const data = localStorage.getItem("kopi_ai_chat_history");
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveChatHistory(history) {
    try {
      localStorage.setItem("kopi_ai_chat_history", JSON.stringify(history || []));
    } catch (e) {}
  },

  clearChatHistory() {
    try {
      localStorage.removeItem("kopi_ai_chat_history");
    } catch (e) {}
  },

  // ===================================================
  // 3. STRUCTURED MENU CATALOG BUILDER
  // ===================================================
  buildStructuredCatalogPrompt(products = [], showExactStock = false) {
    const prods = (products && products.length > 0) ? products : this.getProducts();

    const formatPrice = (price) => "Rp " + Number(price || 0).toLocaleString("id-ID");
    const getCat = (p) => (p.kategori || p.category || "kopi").toLowerCase().trim();
    const getName = (p) => p.nama_menu || p.name || "Menu";
    const getPrice = (p) => Number(p.harga !== undefined ? p.harga : (p.price || 0));
    const getStock = (p) => Number(p.stok !== undefined ? p.stok : (p.stock !== undefined ? p.stock : 10));
    const getDesc = (p) => p.deskripsi || p.description || "-";

    const coffeeItems = prods.filter(p => ["kopi", "coffee"].includes(getCat(p)));
    const nonCoffeeItems = prods.filter(p => ["non-kopi", "nonkopi", "non_kopi"].includes(getCat(p)));
    const foodItems = prods.filter(p => ["makanan", "food"].includes(getCat(p)));
    const snackItems = prods.filter(p => ["snack", "camilan", "kue", "pastry"].includes(getCat(p)));

    let prompt = "";

    const formatItem = (p) => {
      const stock = getStock(p);
      if (showExactStock) {
        const status = stock <= 0 ? "❌ HABIS (Stok: 0)" : `✅ Tersedia (Stok: ${stock} porsi)`;
        return `• ${getName(p)} — ${formatPrice(getPrice(p))} | ${status} | ${getDesc(p)}`;
      } else {
        // Customer view: no exact stock numbers
        const status = stock <= 0 ? "❌ Sedang Habis" : "✅ Tersedia";
        return `• ${getName(p)} — ${formatPrice(getPrice(p))} | ${status} | ${getDesc(p)}`;
      }
    };

    prompt += "☕ [KATEGORI MINUMAN KOPI]:\n";
    if (coffeeItems.length > 0) {
      coffeeItems.forEach(p => { prompt += formatItem(p) + "\n"; });
    } else {
      prompt += showExactStock
        ? "• Kopi Susu Mahasiswa — Rp 15.000 | ✅ Tersedia (Stok: 20 porsi)\n• Americano Melek — Rp 12.000 | ✅ Tersedia (Stok: 15 porsi)\n"
        : "• Kopi Susu Mahasiswa — Rp 15.000 | ✅ Tersedia\n• Americano Melek — Rp 12.000 | ✅ Tersedia\n";
    }

    prompt += "\n🍋 [KATEGORI MINUMAN NON-KOPI]:\n";
    if (nonCoffeeItems.length > 0) {
      nonCoffeeItems.forEach(p => { prompt += formatItem(p) + "\n"; });
    } else {
      prompt += showExactStock
        ? "• Fresh Lemon Tea — Rp 10.000 | ✅ Tersedia (Stok: 18 porsi)\n• Signature Chocolate — Rp 16.000 | ✅ Tersedia (Stok: 16 porsi)\n"
        : "• Fresh Lemon Tea — Rp 10.000 | ✅ Tersedia\n• Signature Chocolate — Rp 16.000 | ✅ Tersedia\n";
    }

    prompt += "\n🍞 [KATEGORI MAKANAN]:\n";
    if (foodItems.length > 0) {
      foodItems.forEach(p => { prompt += formatItem(p) + "\n"; });
    } else {
      prompt += showExactStock
        ? "• Kentang Goreng Gurih — Rp 12.000 | ✅ Tersedia (Stok: 14 porsi)\n• Roti Bakar Coklat Keju — Rp 14.000 | ✅ Tersedia (Stok: 15 porsi)\n"
        : "• Kentang Goreng Gurih — Rp 12.000 | ✅ Tersedia\n• Roti Bakar Coklat Keju — Rp 14.000 | ✅ Tersedia\n";
    }

    prompt += "\n🍩 [KATEGORI SNACK & CAMILAN]:\n";
    if (snackItems.length > 0) {
      snackItems.forEach(p => { prompt += formatItem(p) + "\n"; });
    } else {
      prompt += showExactStock
        ? "• Donat Kampus Glazed — Rp 8.000 | ✅ Tersedia (Stok: 12 porsi)\n• Butter Croissant — Rp 14.000 | ❌ HABIS (Stok: 0)\n"
        : "• Donat Kampus Glazed — Rp 8.000 | ✅ Tersedia\n• Butter Croissant — Rp 14.000 | ❌ Sedang Habis\n";
    }

    return prompt.trim();
  },

  // ===================================================
  // 4A. CUSTOMER SYSTEM PROMPT (KopiAI Customer Service - Menu Utama)
  // ===================================================
  generateCustomerSystemPrompt(products = [], userName = "") {
    const catalogPrompt = this.buildStructuredCatalogPrompt(products, false); // false = sembunyikan angka stok spesifik
    const nameGreeting = userName ? `kak ${userName}` : "kak";
    const userMemoryCtx = userName
      ? `Nama pelanggan: "${userName}". Sapa dengan hangat dan sopan menggunakan "${nameGreeting}".`
      : `Nama pelanggan belum diketahui. Jika pelanggan menyebutkan nama mereka, sapa singkat lalu langsung jawab intinya.`;

    return `System Instruction: Pemetaan Menu Visual & Pembersihan Media (Kopi Mahasiswa)

1. Peran & Identitas
Kamu adalah sistem katalog media dan asisten virtual resmi untuk kedai Kopi Mahasiswa yang bertugas mengelola daftar menu resmi serta menghubungkan setiap item menu dengan URL gambar visual yang tepat saat diminta pelanggan.

2. Aturan Pengelolaan Menu & Gambar
- Pembersihan Duplikat: Setiap varian menu hanya boleh muncul satu kali tanpa duplikasi.
- Integritas URL: Gunakan HANYA URL gambar resmi yang sudah ditentukan di bawah ini. JANGAN mengubah, memotong, atau membuat URL gambar baru.
- Menu Tanpa Gambar: Untuk menu yang tidak memiliki link gambar di daftar berikut, tampilkan sebagai teks daftar menu biasa tanpa lampiran media.

3. Pemetaan Daftar Menu & URL Gambar Resmi

☕ COFFEE SERIES
- Kopi Susu Mahasiswa (Gula Aren): https://i.pinimg.com/736x/e0/2d/01/e02d0124461097bf06ec219eb51d5c69.jpg
- Americano / Kopi Hitam: https://i.pinimg.com/736x/0e/52/30/0e52308b27b6b9ea83aa371c0b01a5a8.jpg
- Cappuccino: https://i.pinimg.com/1200x/bc/d2/0a/bcd20ada9e61be0077f08b4be21a4242.jpg
- Caramel Macchiato: https://i.pinimg.com/736x/3a/74/db/3a74db74d7ce5a4683e6f3a2f5dc6462.jpg
- Espresso Single: https://i.pinimg.com/1200x/e8/8c/96/e88c963b93c4ee2f3481b3576e2c9395.jpg
- Caffe Latte: https://i.pinimg.com/736x/6b/4d/ca/6b4dcad544eec6fb886abf03514a7cc0.jpg
- Mocha Deadline: https://i.pinimg.com/736x/b7/38/53/b7385352694908aa56d7a4405404eb89.jpg

🥛 NON-COFFEE
- Matcha Latte: https://i.pinimg.com/736x/16/6b/d0/166bd08582b84f62ec20ba9aa2110d3c.jpg
- Chocolate / Cokelat: https://i.pinimg.com/736x/c2/77/7f/c2777f71cb0e13b28a413113fce481a0.jpg
- Thai Tea Seger: https://i.pinimg.com/736x/d0/df/ce/d0dfce1ba2625e47d77bfec7930609b8.jpg
- Fresh Lemon Tea: https://i.pinimg.com/1200x/a2/e6/34/a2e634d3e685e263ed681fdbbd8fce9f.jpg
- Taro Latte Creamy: https://i.pinimg.com/736x/08/f1/da/08f1da3145406ef23701a7383f149ecf.jpg

🥐 SNACK & PASTRIES
- Pisang Coklat (Piscok): https://i.pinimg.com/1200x/a7/51/a1/a751a10a1b3fd8d3fb308a03453d1df9.jpg
- Kentang Goreng: https://i.pinimg.com/736x/66/9a/58/669a5862c19c0bd6e442ebca1c7d89a7.jpg
- Roti Bakar: https://i.pinimg.com/1200x/94/90/37/949037d9e892a69787585d8e1b70ce9a.jpg
- Dimsum Ayam: https://i.pinimg.com/1200x/70/8b/75/708b7548e688948cacbc14339a4a820c.jpg
- Mie Dok-Dok Nugas: https://i.pinimg.com/736x/6c/9c/fb/6c9cfbda40f0d15572fb59e4ad30965e.jpg
- Donat Kampus Glazed: https://i.pinimg.com/1200x/47/eb/49/47eb4964e3d315ff758175b3274e5c74.jpg
- Choco Chip Cookies: https://i.pinimg.com/736x/b1/60/b5/b160b5a47f607efd3ef055f29b4a22ed.jpg
- Butter Croissant: https://i.pinimg.com/736x/30/98/b3/3098b37993867ed5b37bd686d463ca4b.jpg

4. Instruksi Pengiriman Media
Saat pelanggan meminta informasi menu visual atau gambar produk spesifik (misal: "minta foto cappuccino", "ada gambar roti bakar?", "lihat fotonya matcha latte"), ambil URL gambar yang sesuai dengan item tersebut dan kirimkan dalam format gambar markdown: ![Nama Item](URL) beserta nama item sebagai keterangan (caption).

5. Gaya Bahasa & Format Balasan
- Sikap: Ramah, solutif, santai, dan kasual khas Gen Z yang sopan ("aku" dan "${nameGreeting}").
- Gunakan 1 hingga 2 emoji yang relevan per pesan.
- Panjang pesan: 2 hingga 4 kalimat sedang (max output tokens: 250 agar balasan terkirim di bawah 10 detik).
- Hindari garis pembatas panjang (---) atau heading berlipat (###).
- ${userMemoryCtx}

KATALOG MENU RESMI:
${catalogPrompt}`;
  },

  // ===================================================
  // 4B. ADMIN SYSTEM PROMPT (admin.html)
  //     - Full business advisor persona
  //     - Full stock data access (exact numbers OK)
  //     - Topics: business, operations, stock, sales strategy
  //     - Formal language (saya/Anda)
  // ===================================================
  generateAdminSystemPrompt(products = [], transactions = [], salesSummary = {}, members = []) {
    const catalogPrompt = this.buildStructuredCatalogPrompt(products, true); // true = show exact stock
    const txCount = transactions.length;
    const totalRev = transactions.reduce((acc, tx) => acc + (tx.totalAmount || 0), 0);
    const avgOrder = txCount > 0 ? Math.round(totalRev / txCount) : 0;
    const formatRp = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

    // Build top selling items context
    const itemSales = {};
    transactions.forEach(tx => {
      if (Array.isArray(tx.items)) {
        tx.items.forEach(it => { itemSales[it.name] = (itemSales[it.name] || 0) + (it.quantity || 1); });
      }
    });
    const topItems = Object.entries(itemSales).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topItemsText = topItems.length > 0
      ? topItems.map(([name, qty]) => `• ${name}: ${qty} porsi terjual`).join("\n")
      : "• Data penjualan belum tersedia";

    // Build members context
    const memberCount = Array.isArray(members) ? members.length : 0;
    let membersSection = "";
    if (memberCount > 0) {
      const memberList = members.slice(0, 20).map((m, i) => {
        const regDate = m.registeredAt
          ? new Date(m.registeredAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })
          : "-";
        return `${i + 1}. ${m.name || "Member"} — ${m.campus || "Mahasiswa"} — ${m.phone || "-"} (Daftar: ${regDate})`;
      }).join("\n");
      membersSection = `\n\n==================================================\n🎓 DATA MEMBER TERDAFTAR (REAL-TIME dari members.json)\n==================================================\n- Total Member Aktif: ${memberCount} orang\n- Keuntungan Member: Diskon 10% setiap pembelian\n\nDaftar Member (maks 20 terbaru):\n${memberList}${memberCount > 20 ? `\n... dan ${memberCount - 20} member lainnya.` : ""}`;
    } else {
      membersSection = `\n\n==================================================\n🎓 DATA MEMBER TERDAFTAR\n==================================================\n- Belum ada member yang terdaftar saat ini.`;
    }

    return `Kamu adalah "KopiAI Business Advisor" — Asisten AI Bisnis profesional untuk Admin kedai Kopi Mahasiswa.

==================================================
INSTRUKSI PENTING — WAJIB DIIKUTI
==================================================
- Jawablah selalu dalam Bahasa Indonesia yang jelas, ramah, dan tuntas.
- Berikan jawaban yang padat (maksimal 2-3 kalimat utuh) dan pastikan kalimat selesai sampai tanda titik tanpa terpotong.
- IDENTITAS PENGGUNA: Lawan bicara Anda adalah Admin / Pengelola Kedai Kopi Mahasiswa. Jika user bertanya tentang identitasnya (seperti "siapa saya", "siapa aku"), jawablah secara utuh dan jelas: "Anda adalah Admin / Pengelola Kedai Kopi Mahasiswa."
- KONSISTENSI DATA MENU: HANYA jawab keberadaan menu berdasarkan katalog menu resmi dari database. Jika user menanyakan menu yang tidak ada di daftar, WAJIB jawab tidak tersedia dan berikan saran alternatif dari menu yang ada.
- Gunakan poin-poin singkat jika jawabannya berupa daftar (maks 5 poin).
- Gunakan data aktual dari konteks di bawah.

==================================================
PERSONA
==================================================
- Nama: KopiAI Business Advisor 📊
- Gaya: Bahasa Indonesia, ramah, profesional, dan tuntas. Gunakan "saya" dan "Anda".
- Fokus: Operasional kafe, stok, menu, member, dan analisis bisnis.

==================================================
KONTEKS DATA BISNIS REAL-TIME
==================================================
📊 DATA TRANSAKSI (${txCount} transaksi):
- Total Pendapatan: ${formatRp(totalRev)}
- Rata-rata Nilai Pesanan: ${formatRp(avgOrder)}
- Total Transaksi: ${txCount} pesanan

🏆 MENU TERLARIS:
${topItemsText}${membersSection}

==================================================
KATALOG MENU LENGKAP (STOK PENUH - DATA ADMIN)
==================================================
${catalogPrompt}

==================================================
KEAHLIAN & TOPIK YANG BISA DIBANTU
==================================================
✅ BISA:
- Analisis data penjualan & tren (menu terlaris, jam sibuk, AOV)
- Prediksi & peringatan stok (kapan perlu restock, menu hampir habis)
- Strategi bundling, promo, dan upselling untuk meningkatkan revenue
- Saran operasional harian (persiapan bahan, jam sibuk, efisiensi staf)
- Interpretasi data laporan penjualan (QRIS vs Tunai, tren harian/mingguan)
- Ide pengembangan menu baru atau seasonal promotion
- Analisis biaya, margin, dan penetapan harga menu
- Informasi member terdaftar: jumlah, nama, kampus, tanggal bergabung

❌ TIDAK PERLU:
- Menjawab pertanyaan personal atau obrolan tidak relevan dengan bisnis kafe
- Bila ada pertanyaan di luar konteks bisnis, arahkan kembali ke topik operasional kafe

==================================================
PANDUAN FORMAT JAWABAN
==================================================
- Gunakan data aktual dari konteks di atas saat menjawab.
- Sertakan angka spesifik dan rekomendasi yang actionable.
- Boleh menggunakan format terstruktur (bullet points, tabel sederhana) untuk analisis.
- Jawaban boleh panjang jika memang diperlukan untuk penjelasan bisnis yang komprehensif.
- Selalu akhiri dengan pertanyaan lanjutan atau saran tindakan konkret.`;
  },

  // ===================================================
  // 5. CUSTOMER AI CHAT ENGINE (index.html)
  // ===================================================
  async chatWithBarista(userMessage, chatHistory = []) {
    if (!this.dbMenu || this.dbMenu.length === 0) {
      await this.fetchDatabaseMenu();
    }
    const products = this.getProducts();
    const userMsgClean = (userMessage || "").trim();
    const detectedName = this.extractUserName(userMsgClean);
    const userName = this.getUserName();

    if (this.config.useGemini && this.config.geminiApiKey) {
      try {
        const systemPrompt = this.generateCustomerSystemPrompt(products, userName);
        // Sesuai parameter: max output tokens 200–250 token untuk menjaga durasi proses di bawah 10 detik
        const geminiResponse = await this._callGeminiAPI(userMsgClean, chatHistory, systemPrompt, 250);
        if (geminiResponse && geminiResponse.reply) {
          const recommendations = this._extractRecommendationCards(userMsgClean, geminiResponse.reply, products);
          return { reply: geminiResponse.reply, recommendations };
        }
      } catch (err) {
        console.warn("Gemini API failed, falling back to local barista:", err);
      }
    }
    return this._localCustomerBarista(userMsgClean, products, userName, detectedName);
  },

  // ===================================================
  // 6. ADMIN AI CHAT ENGINE (admin.html)
  // ===================================================
  async chatWithAdmin(userMessage, chatHistory = [], transactions = [], members = []) {
    if (!this.dbMenu || this.dbMenu.length === 0) {
      await this.fetchDatabaseMenu();
    }
    const products = this.getProducts();
    const userMsgClean = (userMessage || "").trim();

    if (this.config.useGemini && this.config.geminiApiKey) {
      try {
        const systemPrompt = this.generateAdminSystemPrompt(products, transactions, {}, members);
        const geminiResponse = await this._callGeminiAPI(userMsgClean, chatHistory, systemPrompt, 500); // 500 token = jawaban tuntas tanpa terpotong
        if (geminiResponse && geminiResponse.reply) {
          return { reply: geminiResponse.reply };
        }
      } catch (err) {
        console.warn("Gemini API failed, falling back to local admin advisor:", err);
      }
    }
    return this._localAdminAdvisor(userMsgClean, products, transactions);
  },

  // ===================================================
  // 7. GEMINI API CALLER (Reusable for both chatbots)
  // ===================================================
  async _callGeminiAPI(userMessage, chatHistory = [], systemPrompt, maxTokens = 2048) {
    const apiKey = this.config.geminiApiKey;
    if (!apiKey) return null;

    const primaryModel = this.config.geminiModel || "gemini-3.7-flash";
    const candidateModels = Array.from(new Set([
      primaryModel,
      "gemini-3.7-flash",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.8-flash"
    ]));

    const contents = [];
    const validHistory = (chatHistory || []).slice(-8);
    validHistory.forEach(item => {
      if (item && item.content && item.content.trim() !== "") {
        const role = item.role === "assistant" ? "model" : "user";
        if (contents.length > 0 && contents[contents.length - 1].role === role) {
          contents[contents.length - 1].parts[0].text += "\n" + item.content;
        } else {
          contents.push({ role, parts: [{ text: item.content }] });
        }
      }
    });

    if (contents.length === 0 || contents[contents.length - 1].role !== "user") {
      contents.push({ role: "user", parts: [{ text: userMessage }] });
    } else {
      contents[contents.length - 1].parts[0].text = userMessage;
    }
    while (contents.length > 0 && contents[0].role !== "user") {
      contents.shift();
    }

    const requestBody = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.75, maxOutputTokens: maxTokens }
    };

    // Try candidate models in cascade (handles 429 rate limit, 503 spike, etc.)
    for (const model of candidateModels) {
      let timeoutId = null;
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        let signal;
        if (typeof AbortController !== "undefined") {
          const controller = new AbortController();
          const timeoutMs = maxTokens <= 300 ? 8500 : 18000;
          timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          signal = controller.signal;
        }

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal
        });

        if (response.ok) {
          const data = await response.json();
          const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (candidateText && candidateText.trim() !== "") {
            return { reply: candidateText, modelUsed: model };
          }
        } else {
          // If 429, 404, or 503, log and try next model
          console.warn(`[AIEngine] Model ${model} returned HTTP ${response.status}, trying fallback model...`);
        }
      } catch (err) {
        console.warn(`[AIEngine] Error with model ${model}:`, err.message || err);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    return null;
  },

  // Helper: extract product recommendation cards for customer chat
  _extractRecommendationCards(userMessage, replyText, products = []) {
    const q = (userMessage || "").toLowerCase();
    const asksMenu = this._isAskingForMenu(q);
    if (!asksMenu) return [];

    const isCoffeeOnly = /(kopi|coffee|espresso|latte|americano|cappuccino|mocha)/i.test(q) && !/(non.?kopi|bukan kopi|tanpa kopi|makanan|snack)/i.test(q);
    const isNonCoffee = /(non.?kopi|bukan kopi|tanpa kopi|teh|lemon|matcha|chocolate|cokelat|taro)/i.test(q);
    const isFood = /(makanan|makan|lapar|mie|roti|kentang|pisang)/i.test(q) && !/(minum|kopi)/i.test(q);
    const isSnack = /(snack|camilan|ngemil|donat|cookies|croissant|kue)/i.test(q) && !/(minum|kopi)/i.test(q);

    const getPName = (p) => (p.nama_menu || p.name || "").toLowerCase();
    const getPCat = (p) => (p.kategori || p.category || "kopi").toLowerCase();
    const getPStock = (p) => Number(p.stok !== undefined ? p.stok : (p.stock !== undefined ? p.stock : 10));

    const replyLower = (replyText || "").toLowerCase();
    let matched = products.filter(p => {
      const pName = getPName(p);
      return replyLower.includes(pName) || q.includes(pName);
    });

    if (isCoffeeOnly) {
      matched = matched.filter(p => ["kopi", "coffee"].includes(getPCat(p)));
      if (matched.length === 0) {
        matched = products.filter(p => ["kopi", "coffee"].includes(getPCat(p)) && getPStock(p) > 0)
          .sort((a, b) => (a.harga || a.price || 0) - (b.harga || b.price || 0)).slice(0, 3);
      }
    } else if (isNonCoffee) {
      matched = matched.filter(p => ["non-kopi", "nonkopi"].includes(getPCat(p)));
      if (matched.length === 0) {
        matched = products.filter(p => ["non-kopi", "nonkopi"].includes(getPCat(p)) && getPStock(p) > 0).slice(0, 3);
      }
    } else if (isFood) {
      matched = matched.filter(p => ["makanan", "food"].includes(getPCat(p)));
      if (matched.length === 0) {
        matched = products.filter(p => ["makanan", "food"].includes(getPCat(p)) && getPStock(p) > 0).slice(0, 3);
      }
    } else if (isSnack) {
      matched = matched.filter(p => ["snack", "camilan"].includes(getPCat(p)));
      if (matched.length === 0) {
        matched = products.filter(p => ["snack", "camilan"].includes(getPCat(p))).slice(0, 3);
      }
    }

    return matched.slice(0, 3);
  },

  _isAskingForMenu(query) {
    const q = (query || "").toLowerCase();
    return /(menu|rekomendasi|rekomendasikan|saran|kopi|minuman|makanan|snack|camilan|matcha|cokelat|latte|americano|espresso|taro|lemon|roti|mie|kentang|donat|croissant|cookies|pesan|order|beli|harga|daftar|haus|lapar|manis|strong|kafein|non.?kopi|budget|hemat|murah|stok)/i.test(q);
  },

  // ===================================================
  // 8. LOCAL CUSTOMER BARISTA (Fallback)
  //    Enforces all customer restrictions offline
  // ===================================================
  _localCustomerBarista(query, products, userName = "", detectedName = null) {
    const q = (query || "").toLowerCase().trim();
    const asksMenu = this._isAskingForMenu(q);
    const nameGreeting = userName ? `kak ${userName}` : "kak";

    const getPName = (p) => p.nama_menu || p.name || "";
    const getPCat = (p) => (p.kategori || p.category || "kopi").toLowerCase();
    const getPPrice = (p) => Number(p.harga !== undefined ? p.harga : (p.price || 0));
    const getPStock = (p) => Number(p.stok !== undefined ? p.stok : (p.stock !== undefined ? p.stock : 10));
    const fmtPrice = (price) => "Rp " + Number(price).toLocaleString("id-ID");

    // BLOK: Topik terlarang (kodingan/tugas kuliah) — tolak dengan sopan
    if (/(ngoding|koding|coding|buat kode|bikin kode|source code|bug|debugging|html|css|javascript|python|php|java|sql|algoritma|api|fetch|loop|array|function|program|aplikasi|web|skripsi|tugas kuliah|jurnal|dosen|revisi|metodologi)/i.test(q)) {
      return {
        reply: `Hehe maaf ya ${nameGreeting}, aku barista bukan programmer! 😄 Urusan koding itu di luar liga-ku. Tapi kalau mau kopi biar semangat ngodingnya, itu aku jagonya! ☕ Mau yang kopi strong atau yang manis nih?`,
        recommendations: []
      };
    }

    // Cek menu yang habis jika ditanyakan
    const outOfStockItems = products.filter(p => getPStock(p) <= 0);
    const askedOutOfStock = outOfStockItems.find(p => {
      const pNameLower = getPName(p).toLowerCase();
      const firstWord = pNameLower.split(" ")[0];
      return q.includes(pNameLower) || (firstWord.length > 3 && q.includes(firstWord));
    });

    if (askedOutOfStock) {
      const outName = getPName(askedOutOfStock);
      const outCat = getPCat(askedOutOfStock);
      const altItems = products.filter(p => getPStock(p) > 0 && getPCat(p) === outCat).slice(0, 2);
      const altText = altItems.length > 0
        ? ` Tapi ada nih yang mirip: **${altItems.map(p => `${getPName(p)} (${fmtPrice(getPPrice(p))})`).join("** dan **")}**! 😊`
        : " Tapi kamu bisa cek menu lain yang ready ya!";
      return {
        reply: `Waduh, maaf banget ya ${nameGreeting}! **${outName}** lagi sedang habis nih.${altText}`,
        recommendations: altItems
      };
    }

    // Permintaan informasi menu visual / gambar produk spesifik
    if (/(foto|gambar|lihat foto|lihat gambar|penampakan|pic|picture|fotonya)/i.test(q)) {
      if (typeof menuImages !== "undefined") {
        for (const [mName, mUrl] of Object.entries(menuImages)) {
          if (!mUrl) continue;
          const mLower = mName.toLowerCase();
          const firstWord = mLower.split(" ")[0];
          if (q.includes(mLower) || (firstWord.length > 3 && q.includes(firstWord))) {
            const matchedProd = products.find(p => (p.nama_menu || p.name).toLowerCase() === mLower);
            return {
              reply: `Ini dia tampilan visual untuk **${mName}** ${nameGreeting}! Minuman/menu ini siap dipesan langsung. ☕✨\n\n![${mName}](${mUrl})`,
              recommendations: matchedProd ? [matchedProd] : []
            };
          }
        }
      }
      return {
        reply: `Untuk menu tersebut saat ini belum ada lampiran foto resmi kak, tapi semua detail dan rasa autentiknya siap dinikmati langsung di Kopi Mahasiswa! ☕✨`,
        recommendations: []
      };
    }

    // Jika minta rekomendasi umum tanpa spesifikasi → tanya balik!
    if (/(rekomendasi|rekomendasikan|saran|pilihkan|saranin|rekomen|mau apa|mau pesan apa)/i.test(q) && !/(kopi|non.?kopi|makanan|snack|minum|makan)/i.test(q)) {
      return {
        reply: `Wah seru nih! 😊 Biar aku bisa rekomendasiin yang pas, ${nameGreeting} lagi pengen yang gimana dulu nih — **minum kopi**, **non-kopi yang segar**, atau **makan dulu** biar gak lapar?`,
        recommendations: []
      };
    }

    // Nama introduction
    if (detectedName) {
      return {
        reply: `Halo kak **${detectedName}**, salam kenal ya! Aku KopiAI, asisten customer service resmi Kopi Mahasiswa. Ada yang bisa aku bantu seputar menu atau rekomendasi minuman favorit hari ini? ☕✨`,
        recommendations: []
      };
    }

    // Greeting
    if (/^(halo|hai|hi|hey|pagi|siang|sore|malam|assalamualaikum|hello|ping|apa kabar|sehat)\b/.test(q)) {
      if (userName) {
        return {
          reply: `Halo kak **${userName}**! Senang ketemu lagi di Kopi Mahasiswa. Mau cek menu favorit atau butuh rekomendasi kopi dan camilan hari ini? ☕✨`,
          recommendations: []
        };
      }
      return {
        reply: `Halo kak! Selamat datang di Kopi Mahasiswa. Ada yang bisa KopiAI bantu seputar menu, harga, atau rekomendasi minuman hari ini? ☕✨`,
        recommendations: []
      };
    }

    // Identitas chatbot
    if (/(siapa kamu|kamu siapa|perkenalkan|tentang kamu|nama kamu|kamu apa)/.test(q)) {
      return {
        reply: `Aku **KopiAI**, asisten virtual dan customer service resmi kedai Kopi Mahasiswa! Siap melayani pertanyaan kamu seputar menu, harga, jam operasional, sampai rekomendasi minuman yang pas buat nugas. Ada yang ingin kamu tanyakan? ☕✨`,
        recommendations: []
      };
    }

    // Informasi kafe
    if (/(wifi|colokan|buka|tutup|lokasi|alamat|fasilitas|toilet)/.test(q) && !asksMenu) {
      return {
        reply: `Kopi Mahasiswa buka setiap hari **08.00–23.00 WIB** 📍 Jl. Kampus Merdeka No. 45. Ada WiFi kencang, colokan di setiap meja, dan suasana yang nyaman buat nugas lho ${nameGreeting}! ⚡📶`,
        recommendations: []
      };
    }

    // Rekomendasi Lagu / Playlist
    if (/(lagu|playlist|musik|spotify|nugas denger|belajar denger)/.test(q)) {
      return {
        reply: `Buat temen nugas, aku rekomendasiin playlist lo-fi hip hop atau "Coffee Shop Vibes" di Spotify! Bisa juga coba "Study with Me" — biasanya ada sound suasana kafe yang bikin fokus. 🎵☕ Nugas sambil ngopi, combo sempurna!`,
        recommendations: []
      };
    }

    // Curhat / obrolan santai
    if (/(capek|lelah|stress|bosen|galau|sedih|jenuh|burnout|pusing|overthinking)/.test(q)) {
      return {
        reply: `Eh, semangat ya ${nameGreeting}! 💪 Kadang emang butuh jeda sebentar. Cobain deh tarik napas, minum sesuatu yang segar, terus lanjut pelan-pelan. Mau aku rekomendasiin menu yang bisa bikin mood naik? ☕😊`,
        recommendations: []
      };
    }

    // Menu recommendations
    if (asksMenu) {
      // Kopi murah
      if (/(kopi.*(murah|hemat|budget|tanggal tua)|(murah|hemat).*kopi)/.test(q)) {
        const coffeeItems = products.filter(p => ["kopi", "coffee"].includes(getPCat(p)) && getPStock(p) > 0)
          .sort((a, b) => getPPrice(a) - getPPrice(b)).slice(0, 2);
        return {
          reply: `Kopi paling hemat kita ada **Americano Melek** (${fmtPrice(12000)}) sama **Kopi Susu Mahasiswa** (${fmtPrice(15000)}) ${nameGreeting}! Keduanya tersedia dan ramah di kantong. 💸☕ Mau yang mana?`,
          recommendations: coffeeItems
        };
      }

      // Kopi strong
      if (/(strong|kafein|melek|begadang|lembur|kantuk|ngantuk)/.test(q) && !/(non.?kopi)/.test(q)) {
        const strongItems = products.filter(p => ["kopi", "coffee"].includes(getPCat(p)) && getPStock(p) > 0 && (getPName(p).toLowerCase().includes("americano") || getPName(p).toLowerCase().includes("cappuccino")));
        return {
          reply: `Buat dorongan kafein maksimal, aku rekomendasiin **Americano Melek** — double shot espresso yang bikin langsung melek! Atau **Cappuccino Kampus** kalau mau tetap ada foam lembut. ⚡☕`,
          recommendations: strongItems.slice(0, 2)
        };
      }

      // Non-kopi
      if (/(non.?kopi|tanpa kafein|tanpa kopi|lambung|maag|teh|lemon|matcha|cokelat|chocolate|taro)/.test(q)) {
        const nonCoffeeItems = products.filter(p => ["non-kopi", "nonkopi"].includes(getPCat(p)) && getPStock(p) > 0);
        return {
          reply: `Untuk minuman non-kopi yang segar, ada **Fresh Lemon Tea** (${fmtPrice(10000)}), **Signature Chocolate** (${fmtPrice(16000)}), **Taro Latte Creamy**, dan **Matcha Latte Cozy**! Semuanya tersedia dan ramah lambung. 🍋🍵`,
          recommendations: nonCoffeeItems.slice(0, 3)
        };
      }

      // Makanan
      if (/(makan|makanan|lapar|mie|roti|kentang|pisang|kenyang)/.test(q) && !/(minum|kopi)/.test(q)) {
        const foodItems = products.filter(p => ["makanan", "food"].includes(getPCat(p)) && getPStock(p) > 0);
        return {
          reply: `Buat yang lagi lapar, ada **Kentang Goreng Gurih** (${fmtPrice(12000)}), **Roti Bakar Coklat Keju** (${fmtPrice(14000)}), dan **Mie Dok-Dok Nugas** (${fmtPrice(15000)})! Semuanya tersedia dan mantap ${nameGreeting}. 🍟🍞🍜`,
          recommendations: foodItems.slice(0, 3)
        };
      }

      // Snack
      if (/(snack|camilan|ngemil|donat|cookies|croissant|kue)/.test(q) && !/(minum|kopi)/.test(q)) {
        const snackItems = products.filter(p => ["snack", "camilan"].includes(getPCat(p)) && getPStock(p) > 0);
        return {
          reply: `Buat camilan ringan, ada **Donat Kampus Glazed** (${fmtPrice(8000)}) dan **Choco Chip Cookies** (${fmtPrice(10000)}) yang tersedia nih ${nameGreeting}! 🍩🍪 Cocok banget buat nemenin ngobrol.`,
          recommendations: snackItems.slice(0, 2)
        };
      }

      // Menu termurah
      if (/(termurah|paling murah|menu murah|budget)/.test(q)) {
        return {
          reply: `Menu paling hemat di sini ${nameGreeting}: 🍩 Snack: **Donat** (${fmtPrice(8000)}) · 🍋 Non-Kopi: **Lemon Tea** (${fmtPrice(10000)}) · ☕ Kopi: **Americano** (${fmtPrice(12000)}) · 🍟 Makanan: **Kentang Goreng** (${fmtPrice(12000)}). Semua tersedia! 💸`,
          recommendations: products.filter(p => getPStock(p) > 0 && (getPName(p).toLowerCase().includes("donat") || getPName(p).toLowerCase().includes("lemon") || getPName(p).toLowerCase().includes("americano"))).slice(0, 3)
        };
      }

      // General menu request
      const topItems = products.filter(p => getPStock(p) > 0 && (getPName(p).toLowerCase().includes("susu") || getPName(p).toLowerCase().includes("americano") || getPName(p).toLowerCase().includes("lemon")));
      return {
        reply: `Sebelum aku rekomendasiin yang paling pas, ${nameGreeting} lagi pengen **kopi**, **minuman segar non-kopi**, atau **makan/snack** dulu nih? 😊`,
        recommendations: topItems.length > 0 ? topItems.slice(0, 2) : products.filter(p => getPStock(p) > 0).slice(0, 2)
      };
    }

    // Default response
    return {
      reply: `Ada yang bisa aku bantu ${nameGreeting}? Mau tanya soal menu, atau sekadar ngobrol santai sambil nunggu pesanan? ☕😊`,
      recommendations: []
    };
  },

  // ===================================================
  // 9. LOCAL ADMIN ADVISOR (Fallback)
  // ===================================================
  _localAdminAdvisor(query, products, transactions = []) {
    const q = (query || "").toLowerCase().trim();
    const getPStock = (p) => Number(p.stok !== undefined ? p.stok : (p.stock !== undefined ? p.stock : 10));
    const getPName = (p) => p.nama_menu || p.name || "";
    const formatRp = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

    const txCount = transactions.length;
    const totalRev = transactions.reduce((acc, tx) => acc + (tx.totalAmount || 0), 0);
    const avgOrder = txCount > 0 ? Math.round(totalRev / txCount) : 0;

    // Stok analysis
    if (/(stok|stock|restock|habis|menipis|persediaan)/.test(q)) {
      const outOfStock = products.filter(p => getPStock(p) <= 0);
      const lowStock = products.filter(p => getPStock(p) > 0 && getPStock(p) <= 5);
      let reply = `**Laporan Stok Terkini:**\n\n`;
      if (outOfStock.length > 0) {
        reply += `❌ **Habis (0 porsi):** ${outOfStock.map(p => `${getPName(p)}`).join(", ")}\n`;
      }
      if (lowStock.length > 0) {
        reply += `⚠️ **Menipis (≤5 porsi):** ${lowStock.map(p => `${getPName(p)} (${getPStock(p)} sisa)`).join(", ")}\n`;
      }
      if (outOfStock.length === 0 && lowStock.length === 0) {
        reply += `✅ Semua stok dalam kondisi aman! Tidak ada menu yang habis atau menipis.`;
      }
      reply += `\n\n💡 **Saran:** Lakukan restock sebelum jam sibuk (15:00–21:00) untuk menghindari kehilangan penjualan.`;
      return { reply };
    }

    // Penjualan / Revenue
    if (/(penjualan|revenue|omset|pendapatan|transaksi|laporan|data)/.test(q)) {
      return {
        reply: `**Ringkasan Penjualan:**\n\n📊 Total Transaksi: **${txCount} pesanan**\n💰 Total Pendapatan: **${formatRp(totalRev)}**\n🧾 Rata-rata Nilai Pesanan: **${formatRp(avgOrder)}**\n\n💡 **Strategi peningkatan AOV:** Terapkan upselling "Tambah Shot Espresso +Rp 4.000" atau bundling kopi + snack dengan diskon Rp 2.000 untuk meningkatkan nilai per transaksi.`
      };
    }

    // Strategi bisnis / promo
    if (/(strategi|promo|bundling|marketing|ide|saran bisnis|meningkatkan)/.test(q)) {
      return {
        reply: `**Rekomendasi Strategi Bisnis:**\n\n1. **Bundling Favorit:** Kopi Susu Mahasiswa + Kentang Goreng dengan diskon Rp 3.000 untuk meningkatkan AOV.\n2. **Happy Hour:** Promo 10% diskon jam 14:00–16:00 untuk menarik pelanggan di luar jam sibuk.\n3. **Loyalty Program:** Setiap 5x pembelian dapat 1 minuman gratis — meningkatkan repeat order.\n4. **Social Media:** Foto aesthetic menu di Instagram bisa mendatangkan traffic baru dari sekitar kampus.\n\n💡 Mana yang ingin Anda implementasikan duluan?`
      };
    }

    // Identitas
    if (/(siapa kamu|kamu apa|tentang kamu|perkenalan)/.test(q)) {
      return {
        reply: `Saya adalah **KopiAI Business Advisor** 📊 — asisten AI khusus untuk membantu Anda mengelola dan mengembangkan bisnis Kopi Mahasiswa.\n\nSaya bisa membantu analisis stok, tren penjualan, strategi promo & bundling, serta rekomendasi operasional harian berbasis data. Silakan tanyakan apa saja seputar bisnis kafe!`
      };
    }

    // Greeting admin
    if (/^(halo|hai|hi|selamat|good|pagi|siang|sore|malam)\b/.test(q)) {
      return {
        reply: `Selamat datang di **KopiAI Business Advisor**! 📊✨\n\nSaya siap membantu Anda menganalisis data penjualan, memantau stok, dan memberikan rekomendasi strategi bisnis. Apa yang ingin Anda analisis hari ini?`
      };
    }

    return {
      reply: `Saya siap membantu Anda dengan analisis bisnis Kopi Mahasiswa. Silakan tanyakan soal **stok**, **data penjualan**, **strategi promo**, atau topik operasional lainnya. 📊`
    };
  },

  // ===================================================
  // 10. AI BUSINESS INSIGHTS (Admin Dashboard Cards)
  // ===================================================
  getBusinessInsights(transactions = [], products = []) {
    const insights = [];
    const prods = (products && products.length > 0) ? products : this.getProducts();
    const getPStock = (p) => Number(p.stok !== undefined ? p.stok : (p.stock !== undefined ? p.stock : 10));
    const getPName = (p) => p.nama_menu || p.name || "";
    const txCount = transactions.length;
    const totalRev = transactions.reduce((acc, tx) => acc + (tx.totalAmount || 0), 0);
    const avgOrderValue = txCount > 0 ? Math.round(totalRev / txCount) : 0;
    const formatCurrency = (amount) => {
      if (typeof formatRupiah === "function") return formatRupiah(amount);
      return "Rp " + Number(amount || 0).toLocaleString("id-ID");
    };

    const lowStockProducts = prods.filter(p => getPStock(p) > 0 && getPStock(p) <= 6 && p.active !== false);
    const outOfStockProducts = prods.filter(p => getPStock(p) <= 0 && p.active !== false);

    if (outOfStockProducts.length > 0) {
      insights.push({
        type: "danger",
        badge: "Stok Kritis ⚠️",
        title: `${outOfStockProducts.length} Menu Habis (Out of Stock)`,
        description: `Menu **${outOfStockProducts.map(p => getPName(p)).join(", ")}** saat ini 0 porsi. Segera update stok agar pembeli tidak kecewa.`,
        actionText: "Kelola Stok",
        actionTab: "products"
      });
    } else if (lowStockProducts.length > 0) {
      insights.push({
        type: "warning",
        badge: "Peringatan Restock 📦",
        title: `${lowStockProducts.length} Produk Menipis (≤ 6 Porsi)`,
        description: `Produk **${lowStockProducts.map(p => `${getPName(p)} (sisa ${getPStock(p)})`).join(", ")}** diprediksi habis dalam beberapa jam ke depan.`,
        actionText: "Tambah Stok",
        actionTab: "products"
      });
    } else {
      insights.push({
        type: "success",
        badge: "Stok Aman ✅",
        title: "Ketersediaan Menu Prima",
        description: "Semua stok produk berada di batas aman. Siap melayani lonjakan pesanan jam nugas malam.",
        actionText: "Lihat Produk",
        actionTab: "products"
      });
    }

    const itemSalesMap = {};
    transactions.forEach(tx => {
      if (Array.isArray(tx.items)) {
        tx.items.forEach(it => { itemSalesMap[it.name] = (itemSalesMap[it.name] || 0) + it.quantity; });
      }
    });
    const sortedItems = Object.entries(itemSalesMap).sort((a, b) => b[1] - a[1]);
    const topItem = sortedItems[0] ? sortedItems[0][0] : "Kopi Susu Mahasiswa";

    insights.push({
      type: "opportunity",
      badge: "Ide Bundling AI 💡",
      title: `Promo Combo: ${topItem} + Camilan`,
      description: `Data menunjukkan **${topItem}** memiliki perputaran tertinggi. Terapkan bundling dengan Roti Bakar atau Kentang Goreng dengan diskon Rp 2.000 untuk meningkatkan Average Order Value (AOV).`,
      actionText: "Buat Promo",
      actionTab: "products"
    });

    insights.push({
      type: "trend",
      badge: "Pola Mahasiswa 📈",
      title: "Puncak Kunjungan Jam Nugas (15.00 - 21.00 WIB)",
      description: "Rata-rata transaksi mahasiswa meningkat signifikan di sore hingga malam hari. Pastikan stok es batu, susu murni, dan biji espresso siap sebelum pukul 15.00.",
      actionText: "Lihat Laporan",
      actionTab: "reports"
    });

    insights.push({
      type: "finance",
      badge: "Optimasi Revenue 💰",
      title: `Rata-rata Transaksi: ${formatCurrency(avgOrderValue || 28000)} / Meja`,
      description: "Gunakan strategi upselling 'Tambah Shot Espresso +Rp 4.000' atau 'Extra Keju +Rp 3.000' di kasir untuk menaikkan margin per pesanan.",
      actionText: "Cek Transaksi",
      actionTab: "transactions"
    });

    return insights;
  },

  // ===================================================
  // 11. AI PRODUCT COPYWRITER & TAG GENERATOR
  // ===================================================
  generateProductCopy(name, category, price) {
    const cleanName = (name || "Menu Kopi").trim();
    const cat = category || "kopi";
    const cost = Number(price || 15000);

    const templates = {
      kopi: [
        { desc: `Perpaduan espresso mantap pilihan dengan cita rasa khas yang aromatik dan seimbang. Teman paling pas buat nuntasin deadline tugas dan diskusi kampus!`, badge: "Best for Study ⚡", tags: ["Bold", "Espresso", "Melek", "Fresh Brew"] },
        { desc: `Racikan kopi istimewa dengan aroma wangi memikat dan aftertaste lembut. Bikin fokus kuliah tetap terjaga dari pagi sampai malam.`, badge: "Favorit Nugas ☕", tags: ["Creamy", "Aromatik", "Booster", "Es/Hangat"] },
        { desc: `Paduan kopi pekat racikan barista dengan sensasi manis legit yang pas. Mood booster harian tanpa bikin kantong mahasiswa bolong!`, badge: "Signature Blend 🔥", tags: ["Signature", "Manis Pas", "Semangat", "Viral"] }
      ],
      "non-kopi": [
        { desc: `Sensasi minuman segar dan manis lembut tanpa kafein. Dibuat dari bahan premium yang siap balikin kesegaran pikiran setelah seharian kelas.`, badge: "Mood Booster 🍃", tags: ["Non-Coffee", "Segar", "Creamy", "Anti-Stress"] },
        { desc: `Perpaduan rasa autentik yang memanjakan lidah dengan tekstur creamy nan nikmat. Pilihan tepat buat kamu yang mau santai tanpa kopi.`, badge: "Top Choice ✨", tags: ["Manis Legit", "Estetik", "Comfort Drink"] }
      ],
      makanan: [
        { desc: `Porsi pas, rasa gurih nagih, dan disajikan hangat fresh dari dapur. Teman ngunyah paling juara saat nugas kelompok atau nongkrong sore.`, badge: "Ngemil Kenyang 🍞", tags: ["Crispy", "Gurih", "Hangat", "Porsi Pas"] },
        { desc: `Camilan renyah mantap dengan racikan bumbu khas Kopi Mahasiswa. Pas buat sharing bareng temen satu tongkrongan!`, badge: "Best Snack 🍟", tags: ["Garing", "Sharing", "Gurih Mantap"] }
      ],
      snack: [
        { desc: `Kue camilan manis renyah dengan tekstur lembut di dalam. Teman setia pendamping secangkir kopi hangat saat belajar.`, badge: "Harga Mahasiswa 🍩", tags: ["Fresh Bake", "Sweet", "Crunchy", "Ringan"] },
        { desc: `Sensasi pastry renyah beraroma butter harum. Gigitan pertama langsung bikin senyum semringah ngerjain tugas.`, badge: "Flaky & Sweet 🥐", tags: ["Butter", "Flaky", "Camilan"] }
      ]
    };

    const pool = templates[cat] || templates.kopi;
    const randomPick = pool[Math.floor(Math.random() * pool.length)];
    return { name: cleanName, category: cat, price: cost, description: randomPick.desc, badge: randomPick.badge, tags: randomPick.tags };
  }
};

// Initialize on script load
AIEngine.init();
