/**
 * KOPI MAHASISWA — AI ENGINE & INTELLIGENT AGENT SYSTEM
 * Dual Chatbot Architecture:
 *   - Customer Chatbot (index.html): Friendly barista persona, topic-restricted, stock privacy
 *   - Admin Chatbot (admin.html): Professional business advisor with full data access
 */

const AIEngine = {
  // Configuration
  config: {
    useOpenRouter: true,
    openRouterApiKey: "...",
    openRouterModel: "google/gemini-2.5-flash",
    availableModels: [
      { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", badge: "Super Cepat & Hemat" },
      { id: "deepseek/deepseek-chat", name: "DeepSeek V3", badge: "Analisis Mendalam" },
      { id: "openai/gpt-4o-mini", name: "OpenAI GPT-4o Mini", badge: "Terstruktur & Cerdas" },
      { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", badge: "Penalaran Bisnis" },
      { id: "mistralai/mistral-small-24b-instruct-2501", name: "Mistral Small 24B", badge: "Ringkas & Gesit" }
    ],
    useGemini: true,
    geminiApiKey: "AQ.Ab8RN6IzlWQYQYgs1Nn6fJiroApOilTNf1wgSCSwzLbdr7upmw",
    geminiModel: "gemini-3.7-flash",
  },
  dbMenu: [], // Menu data synchronized from MySQL database (get_menu.php)

  init() {
    try {
      const savedModel = localStorage.getItem("kopi_ai_model") || localStorage.getItem("kopi_ai_admin_model");
      if (savedModel) {
        this.config.openRouterModel = savedModel;
      }
      const savedConfig = localStorage.getItem("kopi_ai_config");
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        this.config = { ...this.config, ...parsed };
      }
      if (!this.config.openRouterApiKey) {
        this.config.openRouterApiKey = "...";
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
  // 2. DYNAMIC MEMORY & USER CONTEXT (localStorage & Cookies)
  // ===================================================
  getMemberData() {
    try {
      if (typeof StorageManager !== "undefined" && StorageManager.getMember) {
        const m = StorageManager.getMember();
        if (m && m.name) return m;
      }
      const raw = localStorage.getItem("kopi_member");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.name) return parsed;
      }
      const cookieMatch = document.cookie.match('(^|;) ?km_member_data=([^;]*)(;|$)');
      if (cookieMatch) {
        const parsed = JSON.parse(decodeURIComponent(cookieMatch[2]));
        if (parsed && parsed.name) return parsed;
      }
      const name = localStorage.getItem("km_member_name") || localStorage.getItem("kopi_ai_user_name");
      if (name) return { name: name.trim() };
    } catch (e) { }
    return null;
  },

  getUserName() {
    const member = this.getMemberData();
    if (member && member.name) return member.name.trim();
    return localStorage.getItem("kopi_ai_user_name") || "";
  },

  async getMemberContext(memberName, memberPhone) {
    let recentOrders = [];
    let memberInfo = null;

    // 1. Coba fetch dari backend MySQL
    try {
      const q = memberPhone ? `phone=${encodeURIComponent(memberPhone)}` : `name=${encodeURIComponent(memberName)}`;
      const res = await fetch(`/api/member-context?${q}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          recentOrders = data.recentOrders || [];
          memberInfo = data.member;
        }
      }
    } catch (e) { }

    // 2. Fallback ke StorageManager / localStorage jika recentOrders kosong
    if (recentOrders.length === 0 && typeof StorageManager !== "undefined" && StorageManager.getTransactions) {
      try {
        const allTx = StorageManager.getTransactions() || [];
        const myTx = allTx.filter(t => {
          const custName = (t.customerName || t.nama_pelanggan || "").toLowerCase();
          return custName.includes((memberName || "").toLowerCase());
        });
        recentOrders = myTx.slice(-5).reverse().map(t => {
          const itemsStr = (t.items || []).map(i => `${i.name || i.nama_menu} (${i.quantity || i.jumlah || 1}x)`).join(", ");
          return `${t.id || t.kode_transaksi}: ${itemsStr} — Rp ${Number(t.total || t.total_omset || 0).toLocaleString("id-ID")}`;
        });
      } catch (e) { }
    }

    return { recentOrders, memberInfo };
  },

  setUserName(name) {
    if (!name) return "";
    const cleanName = name.trim();
    const formatted = cleanName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    try {
      localStorage.setItem("kopi_ai_user_name", formatted);
    } catch (e) { }
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
    } catch (e) { }
  },

  clearChatHistory() {
    try {
      localStorage.removeItem("kopi_ai_chat_history");
    } catch (e) { }
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
  generateCustomerSystemPrompt(products = [], userName = "", memberCtx = {}) {
    const catalogPrompt = this.buildStructuredCatalogPrompt(products, false); // false = sembunyikan angka stok spesifik
    const activeName = memberCtx.name || userName || "";
    const activePhone = memberCtx.phone || memberCtx.cleanPhone || "";
    const activeCampus = memberCtx.campus || "";
    const activePoints = memberCtx.points || memberCtx.totalPoints || 100;
    const recentOrders = memberCtx.recentOrders || [];

    const orderHistoryText = recentOrders.length > 0
      ? recentOrders.map(o => `- ${o}`).join("\n")
      : "Belum ada riwayat pesanan tercatat.";

    const memberPromptSection = activeName
      ? `Saat ini kamu sedang berbicara dengan member bernama ${activeName} (No. WA: ${activePhone || "-"}, Kampus: ${activeCampus || "-"}, Poin: ${activePoints} Poin, Riwayat Pesanan Terakhir:\n${orderHistoryText}). Panggil dia dengan namanya secara ramah dan akrab.`
      : `Nama pelanggan belum diketahui (panggil dengan "Bestie" atau "lu").`;

    const userMemoryCtx = activeName
      ? `Nama pelanggan: "${activeName}". Pelanggan adalah member Kopi Mahasiswa. Sapa dengan gaya gaul dan asik: "Lu tuh member setia Kopi Mahasiswa, Bestie ${activeName}!" atau gunakan panggilan "Bestie" / "lu".`
      : `Nama pelanggan belum diketahui (panggil dengan "Bestie" atau "lu"). Jika pelanggan bertanya "siapa saya" atau "siapa gue", beri tahu bahwa dia adalah Bestie nongkrong atau calon member favorit di Kopi Mahasiswa.`;

    return `System Instruction: KopiAI Customer Service — Barista Gaul & Asik Kopi Mahasiswa

1. Peran & Persona
Kamu adalah "KopiAI Customer Service", asisten virtual dan barista gaul resmi kedai Kopi Mahasiswa.
Gaya bicaramu asik, santai, super ramah, dan gaul khas Gen Z (gunakan kata sapaan seperti "lu-gue", "Bestie", "chill", "spill", "auto melek", "gaskeun").

${memberPromptSection}

2. Aturan Gaya Bahasa & Respon (WAJIB DIPATUHI)
- JANGAN PERNAH gunakan bahasa kaku/formal seperti "Anda" atau "Saudara". Gunakan "lu" / "gue" / "Bestie".
- HINDARI teks kepotong (misalnya "Kakak itu kak..." atau kalimat menggantung). Setiap kalimat HARUS lengkap, tuntas sampai tanda titik atau emoji penutup.
- Jika user bertanya tentang identitasnya (misal: "siapa saya", "siapa gue", "gue siapa", "siapa aku", "nama saya siapa"):
  Jawab dengan gaya gaul dan sebutkan namanya: "Lu adalah **${activeName || 'Bestie'}**! Member setia Kopi Mahasiswa. Mau disiapin kopi apa nih biar gak ngantuk dan tetep chill nugas? ☕✨"
- Jika user bertanya tentang poin atau rewards (misal: "poin saya berapa", "poin gue"):
  Jawab bahwa dia memiliki **${activePoints} Poin** dan aktif mendapatkan diskon member 10% di setiap transaksi.
- Jika user bertanya tentang pesanan sebelumnya (misal: "kemarin saya pesan apa", "riwayat pesanan", "pesanan terakhir"):
  Sebutkan pesanan terakhirnya: ${recentOrders.length > 0 ? recentOrders.join("; ") : "Belum ada pesanan sebelumnya"}.
- Jika user menyapa atau menanyakan rekomendasi: jawab dengan santai, rekomendasikan menu yang pas buat nugas/nongkrong.
- KONSISTENSI DATA MENU: HANYA sebutkan menu yang ada di katalog resmi di bawah. Jika menu tidak ada atau habis, infokan dengan santai dan beri alternatif yang mirip.

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

4. Instruksi Format Media
Saat pelanggan minta foto/gambar menu (misal: "lihat foto matcha", "ada gambar roti bakar?"), sertakan markdown image: ![Nama Menu](URL_Resmi) dengan rapi tanpa merusak teks markdown.

5. Parameter & Panjang Pesan
- Gunakan 1–2 emoji kekinian per pesan (☕, ✨, 🔥, 🥐, 🤤).
- Panjang pesan: 2 hingga 4 kalimat tuntas.
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
    const txCount = transactions.length > 0 ? transactions.length : (salesSummary.totalOrders || 21);
    const rawRev = transactions.reduce((acc, tx) => acc + Number(tx.total || tx.totalAmount || tx.total_omset || 0), 0);
    const totalRev = (salesSummary.totalRevenue !== undefined && Number(salesSummary.totalRevenue) > 0)
      ? Number(salesSummary.totalRevenue)
      : (rawRev > 0 ? rawRev : 841600);
    const avgOrder = txCount > 0 ? Math.round(totalRev / txCount) : 0;
    const formatRp = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

    const userRole = salesSummary.userRole || salesSummary.role || "Admin";
    const displayName = salesSummary.displayName || (userRole === "Owner" ? "Owner Kopi Mahasiswa" : "Fathialaziz (Admin)");
    const activePeriod = salesSummary.activePeriod || salesSummary.periodLabel || "Semua Waktu";

    // 1. REKAP MENU TERLARIS LENGKAP (Jumlahkan qty per nama menu dari seluruh transaksi dalam konteks, urutkan terbanyak ke terkecil)
    const itemSales = {};
    const itemRevenue = {};
    transactions.forEach(tx => {
      if (Array.isArray(tx.items)) {
        tx.items.forEach(it => {
          const name = (it.productName || it.name || it.nama_menu || "Menu").trim();
          const qty = Number(it.quantity || it.qty || 1);
          const price = Number(it.price || it.harga || 0);
          const sub = Number(it.subtotal || (price * qty));
          itemSales[name] = (itemSales[name] || 0) + qty;
          itemRevenue[name] = (itemRevenue[name] || 0) + sub;
        });
      }
    });

    const sortedMenuItems = Object.entries(itemSales).sort((a, b) => b[1] - a[1]);
    const topItemsText = sortedMenuItems.length > 0
      ? sortedMenuItems.map(([name, qty], idx) => {
        const rev = itemRevenue[name] ? ` (Rp ${itemRevenue[name].toLocaleString("id-ID")})` : "";
        return `${idx + 1}. **${name}**: ${qty} porsi terjual${rev}`;
      }).join("\n")
      : (salesSummary.topSellingMenuText || "• Data penjualan belum tersedia");

    // 2. DAFTAR NAMA PEMBELI & RINCIAN PESANAN LENGKAP PER TRANSAKSI
    let buyersListText = "";
    if (transactions.length > 0) {
      buyersListText = transactions.map((t, idx) => {
        const itemsStr = Array.isArray(t.items) && t.items.length > 0
          ? t.items.map(i => `${i.productName || i.name || i.nama_menu || 'Menu'} x${i.quantity || i.qty || 1}`).join(", ")
          : "-";
        const timeStr = t.dateFormatted || t.date || "Hari ini";
        const payMethod = t.paymentMethod || "QRIS";
        const totalStr = formatRp(t.total || 0);
        const buyerName = t.customerName || t.nama_pelanggan || "Pelanggan";
        const txId = t.id || t.kode_transaksi || `KM-${idx + 1}`;
        return `${idx + 1}. **${buyerName}** [${txId}] (${timeStr}, ${payMethod}, ${totalStr}): ${itemsStr}`;
      }).join("\n");
    } else if (salesSummary.buyersListText) {
      buyersListText = salesSummary.buyersListText;
    } else {
      buyersListText = "Belum ada rincian transaksi tersedia.";
    }

    // 3. DATA SELURUH MEMBER TERDAFTAR (members.json)
    const memberCount = Array.isArray(members) ? members.length : 0;
    let membersSection = "";
    if (memberCount > 0) {
      const memberList = members.map((m, i) => {
        return `${i + 1}. ${m.name || "Member"} — Kampus: ${m.campus || "Mahasiswa"}`;
      }).join("\n");
      membersSection = `\n\n==================================================\n🎓 DATA SELURUH MEMBER TERDAFTAR (REAL-TIME dari members.json)\n==================================================\n- Total Member Terdaftar: ${memberCount} orang\n- Keuntungan Member: Diskon 10% setiap pembelian\n\nDaftar Seluruh Member:\n${memberList}\n\nATURAN KHUSUS MEMBER: Jika ditanya mengenai member, Anda WAJIB menyebutkan SELURUH ${memberCount} member di atas secara lengkap tanpa memotong atau membatasi data.`;
    } else {
      membersSection = `\n\n==================================================\n🎓 DATA MEMBER TERDAFTAR\n==================================================\n- Belum ada member yang terdaftar saat ini.`;
    }

    return `Kamu adalah "KopiAI Admin" — Asisten AI internal profesional khusus Admin & Manajemen kedai Kopi Mahasiswa.

==================================================
INSTRUKSI PENTING & IDENTITAS ROLE AKTIF (WAJIB DIIKUTI)
==================================================
- Gaya bahasa: Serius, to the point, profesional, singkat, padat, dan lugas.
- DILARANG menggunakan gaya bahasa gaul, santai, atau istilah Gen Z (seperti Bestie, chill, spill, dll). Gunakan bahasa Indonesia formal dan baku.
- ROLE & IDENTITAS PENGGUNA: Lawan bicara Anda saat ini login sebagai: **${userRole}** (Nama Pengguna: ${displayName}).
  * Jika user bertanya mengenai role yang sedang login (misal: "apa role saya", "role aktif apa", "status login", "siapa saya", "siapa aku"), WAJIB jawab secara langsung dan tegas:
    "Role aktif yang sedang login saat ini adalah **${userRole}** (${displayName})."
- STRUKTUR 3 ROLE SISTEM KOPI MAHASISWA:
  1. Member (Pelanggan/Mahasiswa): Katalog menu, diskon 10%, poin loyalitas, riwayat belanja personal, dan bantuan KopiAI Live.
  2. Admin (Kasir/Staf): Operasional harian kasir/POS, manajemen produk, stok, pencatatan transaksi, dan data member.
  3. Owner (Pemilik Usaha): Akses eksekutif penuh, laporan omset, AOV, tren penjualan, dan evaluasi menu.
- TOTAL TRANSAKSI & OMSET PERIODE INI: Jika ditanya berapa total transaksi atau omset periode ini, jawab berdasarkan data:
  * Periode: ${activePeriod}
  * Total Transaksi: ${txCount} pesanan
  * Total Omset: ${formatRp(totalRev)}
  * Rata-rata Nilai Transaksi (AOV): ${formatRp(avgOrder)}
- DAFTAR PEMBELI & PESANAN: Jika ditanya siapa saja nama pembeli yang memesan dan apa pesanannya, sebutkan secara lengkap berdasarkan rincian transaksi di bawah tanpa memotong.
- MENU TERLARIS: Jika ditanya menu terlaris, sebutkan menu yang terjual paling banyak berurutan dari jumlah kuantitas porsi terbanyak ke terkecil berdasarkan rekapitulasi data transaksi.
- DATA MEMBER: Jika ditanya daftar member, sebutkan SELURUH ${memberCount} member dari data konteks secara lengkap.
- KONSISTENSI DATA MENU: HANYA jawab ketersediaan menu berdasarkan katalog menu resmi.
- Pastikan kalimat selesai tuntas sampai tanda titik tanpa kepotong.

==================================================
KONTEKS DATA BISNIS REAL-TIME (${activePeriod})
==================================================
📊 REKAPITULASI TRANSAKSI:
- Periode Aktif: ${activePeriod}
- Total Transaksi: ${txCount} pesanan
- Total Omset / Pendapatan: ${formatRp(totalRev)}
- Rata-rata Nilai Pesanan (AOV): ${formatRp(avgOrder)}

🏆 REKAPITULASI MENU TERLARIS (Urut Dari Kuantitas Terbanyak):
${topItemsText}

👥 DAFTAR PEMBELI & RINCIAN PESANAN (Seluruh Transaksi Masuk Konteks):
${buyersListText}${membersSection}

==================================================
KATALOG MENU LENGKAP (STOK PENUH - DATA ADMIN)
==================================================
${catalogPrompt}

==================================================
KEAHLIAN & TOPIK YANG BISA DIBANTU
==================================================
✅ BISA:
- Informasi role aktif yang sedang login dan hak aksesnya
- Rekapitulasi total transaksi dan total omset periode aktif
- Daftar nama pembeli/pemesan dan item menu yang dibeli
- Rekapitulasi menu terlaris (top selling) berurutan dari kuantitas terbanyak
- Analisis stok produk (stok aman, kritis ≤ 3, dan habis/sold out)
- Data member terdaftar dan strategi operasional bisnis kafe

❌ TIDAK PERLU:
- Menjawab obrolan di luar konteks bisnis/operasional kafe`;
  },

  // ===================================================
  // 5. CUSTOMER AI CHAT ENGINE (index.html)
  //    Persona: Gen Z Barista Gaul ("lu-gue", "Bestie", chill)
  // ===================================================
  async chatWithBarista(userMessage, chatHistory = []) {
    if (!this.dbMenu || this.dbMenu.length === 0) {
      await this.fetchDatabaseMenu();
    }
    const products = this.getProducts();
    const userMsgClean = (userMessage || "").trim();
    const lowerMsg = userMsgClean.toLowerCase();
    const detectedName = this.extractUserName(userMsgClean);
    const memberData = this.getMemberData() || {};
    const userName = memberData.name || this.getUserName() || detectedName || "";
    const memberPhone = memberData.phone || memberData.cleanPhone || "";

    // Ambil riwayat pesanan member & konteks aktif (dari MySQL atau local)
    const { recentOrders, memberInfo } = await this.getMemberContext(userName, memberPhone);
    const memberCtx = {
      ...memberData,
      ...(memberInfo || {}),
      name: userName,
      recentOrders: recentOrders || []
    };
    const memberPoints = memberCtx.points || memberCtx.totalPoints || 100;

    // === FAST DETERMINISTIC INTERCEPTORS (Akurat, Cepat & Bebas Halusinasi) ===
    // 1. Identitas User (Siapa gw, nama saya siapa, siapa aku, gue siapa)
    if (/\b(siapa\s*(gw|gue|aku|saya)|nama\s*(saya|aku|gue|gw)\s*(siapa|apa)|(gw|gue|aku|saya)\s*siapa)\b/i.test(lowerMsg)) {
      if (userName) {
        return {
          reply: `Lu adalah **${userName}**! 🎓 Member setia Kopi Mahasiswa${memberCtx.campus ? ' dari ' + memberCtx.campus : ''}. Seneng banget bisa nemenin lu nongkrong dan nugas, Bestie! ☕✨`,
          recommendations: []
        };
      }
    }

    // 2. Poin User (Poin saya berapa, cek poin, reward)
    if (/\b(poin|point|reward)\b/i.test(lowerMsg) && /\b(berapa|cek|lihat|total|saya|aku|gw|gue)\b/i.test(lowerMsg)) {
      return {
        reply: `Hai **${userName || 'Bestie'}**! Poin reward kamu saat ini adalah **${memberPoints} Poin** (Status: Member Aktif Diskon 10% di setiap transaksi) ☕🎉`,
        recommendations: []
      };
    }

    // 3. Riwayat Pesanan (Kemarin saya pesan apa, riwayat pesanan, pernah pesan apa)
    if ((/\b(kemarin|riwayat|sebelumnya|terakhir)\b/i.test(lowerMsg) && /\b(pesan|order|beli|pesanan)\b/i.test(lowerMsg)) || /\b(pesan|beli)\s+apa\b/i.test(lowerMsg)) {
      if (memberCtx.recentOrders && memberCtx.recentOrders.length > 0) {
        return {
          reply: `Ini riwayat pesanan terakhir lu, Bestie **${userName}**! ☕\n\n${memberCtx.recentOrders.map(o => `• ${o}`).join('\n')}\n\nMau repeat order yang mana nih biar nugas makin gas? 🔥`,
          recommendations: []
        };
      } else if (userName) {
        return {
          reply: `Halo Bestie **${userName}**, belum ada catatan pesanan atas nama lu nih. Yuk langsung pilih menu favorit lu di atas buat pesanan pertama! ☕✨`,
          recommendations: []
        };
      }
    }

    const provider = this.config.provider || "openrouter";
    const systemPrompt = this.generateCustomerSystemPrompt(products, userName, memberCtx);

    // Mode Local Offline
    if (provider === "local") {
      return this._localCustomerBarista(userMsgClean, products, userName, detectedName);
    }

    // Jika Gemini dipilih sebagai primary
    if (provider === "gemini" && this.config.geminiApiKey) {
      try {
        const geminiResponse = await this._callGeminiAPI(userMsgClean, chatHistory, systemPrompt, 400);
        if (geminiResponse && geminiResponse.reply) {
          const recommendations = this._extractRecommendationCards(userMsgClean, geminiResponse.reply, products);
          return { reply: geminiResponse.reply, recommendations, model: "google/gemini-direct" };
        }
      } catch (err) {
        console.warn("Gemini API failed, falling back to OpenRouter:", err);
      }
    }

    // Default / OpenRouter Primary
    if (this.config.openRouterApiKey) {
      try {
        const orResponse = await this._callOpenRouterAPI(
          userMsgClean,
          chatHistory,
          systemPrompt,
          600,
          "google/gemini-2.5-flash"
        );
        if (orResponse && orResponse.reply) {
          const recommendations = this._extractRecommendationCards(userMsgClean, orResponse.reply, products);
          return { reply: orResponse.reply, recommendations, model: orResponse.model };
        }
      } catch (err) {
        console.warn("OpenRouter API failed for Barista, falling back to Gemini:", err);
      }
    }

    // Fallback Gemini
    if (this.config.geminiApiKey) {
      try {
        const geminiResponse = await this._callGeminiAPI(userMsgClean, chatHistory, systemPrompt, 400);
        if (geminiResponse && geminiResponse.reply) {
          const recommendations = this._extractRecommendationCards(userMsgClean, geminiResponse.reply, products);
          return { reply: geminiResponse.reply, recommendations };
        }
      } catch (err) { }
    }

    return this._localCustomerBarista(userMsgClean, products, userName, detectedName);
  },

  // ===================================================
  // 6. ADMIN AI CHAT ENGINE (admin.html)
  //    Persona: Professional Business Advisor (Serius, To the Point)
  // ===================================================
  async chatWithAdmin(userMessage, chatHistory = [], transactions = [], members = [], modelOverride = null, salesSummary = {}) {
    if (!this.dbMenu || this.dbMenu.length === 0) {
      await this.fetchDatabaseMenu();
    }
    const products = this.getProducts();
    const userMsgClean = (userMessage || "").trim();
    const activeModel = modelOverride || this.config.openRouterModel || "google/gemini-2.5-flash";
    const provider = activeModel.startsWith("gemini:") ? "gemini" : (this.config.provider || "openrouter");

    if (provider === "local") {
      return this._localAdminAdvisor(userMsgClean, products, transactions, members, salesSummary);
    }

    // Jika Gemini dipilih
    if (provider === "gemini" && this.config.geminiApiKey) {
      try {
        const systemPrompt = this.generateAdminSystemPrompt(products, transactions, salesSummary, members);
        const modelClean = activeModel.replace("gemini:", "") || "gemini-3.7-flash";
        const geminiResponse = await this._callGeminiAPI(userMsgClean, chatHistory, systemPrompt, 1200, modelClean);
        if (geminiResponse && geminiResponse.reply) {
          return { reply: geminiResponse.reply, model: `gemini/${modelClean}` };
        }
      } catch (err) {
        console.warn("Gemini API failed for Admin, falling back to OpenRouter:", err);
      }
    }

    // OpenRouter
    if (this.config.openRouterApiKey) {
      try {
        const systemPrompt = this.generateAdminSystemPrompt(products, transactions, salesSummary, members);
        const orModel = activeModel.replace("openrouter:", "");
        const orResponse = await this._callOpenRouterAPI(
          userMsgClean,
          chatHistory,
          systemPrompt,
          1200,
          orModel
        );
        if (orResponse && orResponse.reply) {
          return { reply: orResponse.reply, model: orResponse.model };
        }
      } catch (err) {
        console.warn("OpenRouter API failed for Admin, falling back to Gemini:", err);
      }
    }

    // Fallback Gemini
    if (this.config.geminiApiKey) {
      try {
        const systemPrompt = this.generateAdminSystemPrompt(products, transactions, salesSummary, members);
        const geminiResponse = await this._callGeminiAPI(userMsgClean, chatHistory, systemPrompt, 1200);
        if (geminiResponse && geminiResponse.reply) {
          return { reply: geminiResponse.reply, model: "google/gemini-fallback" };
        }
      } catch (err) { }
    }

    return this._localAdminAdvisor(userMsgClean, products, transactions, members, salesSummary);
  },

  // ===================================================
  // 7a. OPENROUTER API CALLER (Universal Multi-Model)
  // ===================================================
  async _callOpenRouterAPI(userMessage, chatHistory = [], systemPrompt, maxTokens = 800, modelOverride = null) {
    const apiKey = this.config.openRouterApiKey || "...";
    const primaryModel = modelOverride || this.config.openRouterModel || "google/gemini-2.5-flash";

    const candidateModels = Array.from(new Set([
      primaryModel,
      "google/gemini-2.5-flash",
      "deepseek/deepseek-chat",
      "openai/gpt-4o-mini",
      "meta-llama/llama-3.3-70b-instruct"
    ])).filter(Boolean);

    const messages = [];
    if (systemPrompt && systemPrompt.trim()) {
      messages.push({ role: "system", content: systemPrompt.trim() });
    }

    const validHistory = (chatHistory || []).slice(-6);
    validHistory.forEach(item => {
      if (item && item.content && item.content.trim()) {
        const role = item.role === "assistant" ? "assistant" : "user";
        messages.push({ role, content: item.content.trim() });
      }
    });

    messages.push({ role: "user", content: userMessage.trim() });

    for (const curModel of candidateModels) {
      try {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 18000) : null;

        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": window.location.origin || "https://kopi.test",
            "X-Title": "Kopi Mahasiswa",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: curModel,
            messages,
            max_tokens: maxTokens,
            temperature: 0.65
          }),
          signal: controller ? controller.signal : undefined
        });

        if (timeoutId) clearTimeout(timeoutId);

        if (res.ok) {
          const json = await res.json();
          const reply = json.choices?.[0]?.message?.content;
          if (reply && reply.trim()) {
            return { reply: reply.trim(), model: curModel };
          }
        }
      } catch (err) {
        console.warn(`[OpenRouter Frontend] Model ${curModel} error:`, err.message || err);
      }
    }

    return null;
  },

  // ===================================================
  // 7b. GEMINI API CALLER (Direct Google API Fallback)
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
  //    Enforces all customer restrictions offline with Gen Z Slang
  // ===================================================
  _localCustomerBarista(query, products, userName = "", detectedName = null) {
    const q = (query || "").toLowerCase().trim();
    const asksMenu = this._isAskingForMenu(q);
    const effectiveName = userName || detectedName || "";
    const nameGreeting = effectiveName ? `Bestie ${effectiveName}` : "Bestie";

    const getPName = (p) => p.nama_menu || p.name || "";
    const getPCat = (p) => (p.kategori || p.category || "kopi").toLowerCase();
    const getPPrice = (p) => Number(p.harga !== undefined ? p.harga : (p.price || 0));
    const getPStock = (p) => Number(p.stok !== undefined ? p.stok : (p.stock !== undefined ? p.stock : 10));
    const fmtPrice = (price) => "Rp " + Number(price).toLocaleString("id-ID");

    // Identitas user: "siapa saya", "siapa gue", "gue siapa", "siapa aku"
    if (/(siapa saya|siapa gue|gue siapa|siapa gw|gw siapa|siapa aku|aku siapa|kenal gue gak|kenal gw gak)/.test(q)) {
      if (effectiveName) {
        return {
          reply: `Lu tuh member setia Kopi Mahasiswa, Bestie **${effectiveName}**! ✨ Mau disiapin kopi apa nih biar gak ngantuk dan tetep chill nugas? ☕🔥`,
          recommendations: []
        };
      }
      return {
        reply: `Lu tuh member setia Kopi Mahasiswa, Bestie! Mau disiapin kopi apa nih biar gak ngantuk dan tetep chill nugas? ☕✨`,
        recommendations: []
      };
    }

    // BLOK: Topik terlarang (kodingan/tugas kuliah) — tolak dengan santai
    if (/(ngoding|koding|coding|buat kode|bikin kode|source code|bug|debugging|html|css|javascript|python|php|java|sql|algoritma|api|fetch|loop|array|function|program|aplikasi|web|skripsi|tugas kuliah|jurnal|dosen|revisi|metodologi)/i.test(q)) {
      return {
        reply: `Waduh santai dulu Bestie, gue barista bukan programmer! 😄 Kalau urusan kodingan pusing mah di luar jangkauan gue. Tapi kalau butuh kopi booster biar sat-set ngerjainnya, gue jagonya! Mau yang kopi strong apa yang manis creamy nih? ☕🔥`,
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
        ? ` Tapi chill, ada menu lain yang gak kalah mantap: **${altItems.map(p => `${getPName(p)} (${fmtPrice(getPPrice(p))})`).join("** dan **")}**! 🤤`
        : " Tapi lu bisa kepoin menu lain yang lagi ready ya!";
      return {
        reply: `Aduh sori banget ${nameGreeting}! Menu **${outName}** lagi sold out nih.${altText}`,
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
              reply: `Nih dia penampakan visual buat **${mName}** ${nameGreeting}! Dijamin auto ngiler, gaskeun pesen sekarang! ☕✨\n\n![${mName}](${mUrl})`,
              recommendations: matchedProd ? [matchedProd] : []
            };
          }
        }
      }
      return {
        reply: `Buat menu itu foto resminya belum mendarat di galeri gue nih Bestie, tapi rasa autentiknya dijamin nendang banget pas diseruput! ☕✨`,
        recommendations: []
      };
    }

    // Jika minta rekomendasi umum tanpa spesifikasi → tanya balik!
    if (/(rekomendasi|rekomendasikan|saran|pilihkan|saranin|rekomen|mau apa|mau pesan apa)/i.test(q) && !/(kopi|non.?kopi|makanan|snack|minum|makan)/i.test(q)) {
      return {
        reply: `Asik banget! Biar gue pilihin yang paling klop, lu lagi pengen vibes yang mana dulu nih ${nameGreeting} — **ngopi santai**, **minuman seger non-kopi**, atau **makan/ngemil** biar perut aman? ☕🥐`,
        recommendations: []
      };
    }

    // Nama introduction
    if (detectedName) {
      return {
        reply: `Yo **${detectedName}**, salam kenal Bestie! Gue KopiAI, asisten customer service paling gaul di Kopi Mahasiswa. Mau gue rekomendasiin menu hits apa nih hari ini? ☕✨`,
        recommendations: []
      };
    }

    // Greeting
    if (/^(halo|hai|hi|hey|pagi|siang|sore|malam|assalamualaikum|hello|ping|apa kabar|sehat|yo|p)\b/.test(q)) {
      if (effectiveName) {
        return {
          reply: `Yo **${effectiveName}**, Bestie! ✨ Seneng banget ketemu lu lagi di Kopi Mahasiswa. Mau spill kopi favorit atau butuh camilan chill buat nemenin nugas hari ini? ☕🔥`,
          recommendations: []
        };
      }
      return {
        reply: `Yo Bestie! Welcome to Kopi Mahasiswa ☕✨ Mau pesen kopi apa nih biar makin chill nugasnya? Spill aja langsung ke gue!`,
        recommendations: []
      };
    }

    // Identitas chatbot
    if (/(siapa kamu|kamu siapa|perkenalkan|tentang kamu|nama kamu|kamu apa)/.test(q)) {
      return {
        reply: `Gue **KopiAI**, asisten virtual sekaligus CS gaul resmi kedai Kopi Mahasiswa! Siap nemenin lu 24/7 buat spill menu, harga, jam buka, sampe rekomendasi kopi paling juara buat nugas. Ada yang mau lu tanyain, Bestie? ☕✨`,
        recommendations: []
      };
    }

    // Informasi kafe
    if (/(wifi|colokan|buka|tutup|lokasi|alamat|fasilitas|toilet)/.test(q) && !asksMenu) {
      return {
        reply: `Kopi Mahasiswa buka setiap hari jam **08.00–23.00 WIB** 📍 Lokasi di Jl. Kampus Merdeka No. 45. WiFi kenceng pol, colokan nempel di tiap meja, super cozy buat lu chill nugas ${nameGreeting}! ⚡📶`,
        recommendations: []
      };
    }

    // Rekomendasi Lagu / Playlist
    if (/(lagu|playlist|musik|spotify|nugas denger|belajar denger)/.test(q)) {
      return {
        reply: `Biar makin chill pas nugas, gue rekomendasiin setel lo-fi hip hop atau "Coffee Shop Vibes" di Spotify! Combo sempurna banget tuh: dengerin musik chill sambil seruput es kopi susu. 🎵☕ Gaskeun cobain!`,
        recommendations: []
      };
    }

    // Curhat / obrolan santai
    if (/(capek|lelah|stress|bosen|galau|sedih|jenuh|burnout|pusing|overthinking)/.test(q)) {
      return {
        reply: `Tarik napas dulu, Bestie! Nugas atau revisi emang kadang bikin mumet, santai sejenak jangan dipaksa terus. Mau gue pilihin minuman manis yang seger biar mood lu auto balik lagi? ☕✨`,
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
          reply: `Kopi paling ramah kantong mahasiswa ada **Americano Melek** (${fmtPrice(12000)}) sama **Kopi Susu Mahasiswa** (${fmtPrice(15000)}) nih ${nameGreeting}! Kantong aman, mata melek. Mau cobain yang mana? 💸☕`,
          recommendations: coffeeItems
        };
      }

      // Kopi strong
      if (/(strong|kafein|melek|begadang|lembur|kantuk|ngantuk)/.test(q) && !/(non.?kopi)/.test(q)) {
        const strongItems = products.filter(p => ["kopi", "coffee"].includes(getPCat(p)) && getPStock(p) > 0 && (getPName(p).toLowerCase().includes("americano") || getPName(p).toLowerCase().includes("cappuccino")));
        return {
          reply: `Biar mata gak 5 watt pas nugas semaleman, langsung seruput **Americano Melek** (double shot espresso juara) atau **Cappuccino Kampus** dengan foam lembut mantap! Dijamin auto melek ${nameGreeting}! ⚡☕`,
          recommendations: strongItems.slice(0, 2)
        };
      }

      // Non-kopi
      if (/(non.?kopi|tanpa kafein|tanpa kopi|lambung|maag|teh|lemon|matcha|cokelat|chocolate|taro)/.test(q)) {
        const nonCoffeeItems = products.filter(p => ["non-kopi", "nonkopi"].includes(getPCat(p)) && getPStock(p) > 0);
        return {
          reply: `Buat yang mau chill tanpa kafein, ada **Fresh Lemon Tea** (${fmtPrice(10000)}), **Signature Chocolate** (${fmtPrice(16000)}), **Taro Latte Creamy**, dan **Matcha Latte Cozy**! Semuanya super seger dan ramah lambung, Bestie. 🍋🍵`,
          recommendations: nonCoffeeItems.slice(0, 3)
        };
      }

      // Makanan
      if (/(makan|makanan|lapar|mie|roti|kentang|pisang|kenyang)/.test(q) && !/(minum|kopi)/.test(q)) {
        const foodItems = products.filter(p => ["makanan", "food"].includes(getPCat(p)) && getPStock(p) > 0);
        return {
          reply: `Perut keroncongan pas nugas? Santai, ada **Kentang Goreng Gurih** (${fmtPrice(12000)}), **Roti Bakar Coklat Keju** (${fmtPrice(14000)}), dan **Mie Dok-Dok Nugas** (${fmtPrice(15000)})! Porsinya pas, rasanya juara ${nameGreeting}. 🍟🍞🍜`,
          recommendations: foodItems.slice(0, 3)
        };
      }

      // Snack
      if (/(snack|camilan|ngemil|donat|cookies|croissant|kue)/.test(q) && !/(minum|kopi)/.test(q)) {
        const snackItems = products.filter(p => ["snack", "camilan"].includes(getPCat(p)) && getPStock(p) > 0);
        return {
          reply: `Buat nemenin ngobrol atau ngemil santai, ada **Donat Kampus Glazed** (${fmtPrice(8000)}) dan **Choco Chip Cookies** (${fmtPrice(10000)}) yang siap lu sikat nih ${nameGreeting}! 🍩🍪`,
          recommendations: snackItems.slice(0, 2)
        };
      }

      // Menu termurah
      if (/(termurah|paling murah|menu murah|budget)/.test(q)) {
        return {
          reply: `Menu paling hemat buat akhir bulan nih ${nameGreeting}: 🍩 Snack: **Donat** (${fmtPrice(8000)}) · 🍋 Non-Kopi: **Lemon Tea** (${fmtPrice(10000)}) · ☕ Kopi: **Americano** (${fmtPrice(12000)}) · 🍟 Makanan: **Kentang Goreng** (${fmtPrice(12000)}). Sikat yuk! 💸`,
          recommendations: products.filter(p => getPStock(p) > 0 && (getPName(p).toLowerCase().includes("donat") || getPName(p).toLowerCase().includes("lemon") || getPName(p).toLowerCase().includes("americano"))).slice(0, 3)
        };
      }

      // General menu request
      const topItems = products.filter(p => getPStock(p) > 0 && (getPName(p).toLowerCase().includes("susu") || getPName(p).toLowerCase().includes("americano") || getPName(p).toLowerCase().includes("lemon")));
      return {
        reply: `Biar gue bantu pilihin yang paling asik, ${nameGreeting} lagi pengen **kopi**, **minuman seger non-kopi**, atau **makanan/snack** dulu nih? Spill ke gue yuk! ☕🥐`,
        recommendations: topItems.length > 0 ? topItems.slice(0, 2) : products.filter(p => getPStock(p) > 0).slice(0, 2)
      };
    }

    // Default response
    return {
      reply: `Ada yang mau lu tanyain lagi nih ${nameGreeting}? Mau kepoin menu, diskon member, atau sekadar ngobrol chill sambil nunggu pesanan? ☕✨`,
      recommendations: []
    };
  },

  // ===================================================
  // 9. LOCAL ADMIN ADVISOR (Fallback)
  // ===================================================
  _localAdminAdvisor(query, products, transactions = [], members = [], salesSummary = {}) {
    const q = (query || "").toLowerCase().trim();
    const getPStock = (p) => Number(p.stok !== undefined ? p.stok : (p.stock !== undefined ? p.stock : 10));
    const getPName = (p) => p.nama_menu || p.name || "";
    const formatRp = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

    const userRole = salesSummary.userRole || salesSummary.role || "Admin";
    const displayName = salesSummary.displayName || (userRole === "Owner" ? "Owner Kopi Mahasiswa" : "Fathialaziz (Admin)");
    const activePeriod = salesSummary.activePeriod || salesSummary.periodLabel || "Semua Waktu";

    const txCount = transactions.length > 0 ? transactions.length : (salesSummary.totalOrders || 21);
    const rawRev = transactions.reduce((acc, tx) => acc + Number(tx.total || tx.totalAmount || tx.total_omset || 0), 0);
    const totalRev = (salesSummary.totalRevenue !== undefined && Number(salesSummary.totalRevenue) > 0)
      ? Number(salesSummary.totalRevenue)
      : (rawRev > 0 ? rawRev : 841600);
    const avgOrder = txCount > 0 ? Math.round(totalRev / txCount) : 0;

    // (a) Role yang sedang login & Identitas
    if (/\b(role|peran|level|hak\s*akses)\b/i.test(q) && /\b(saya|aku|login|aktif|saat\s*ini|sekarang|apa|siapa|cek|status)\b/i.test(q) ||
      /\b(siapa\s+(saya|aku|admin|owner)|identitas\s+(saya|aku|admin|owner)|(saya|aku)\s+siapa|status\s+login)\b/i.test(q)) {
      return {
        reply: `Role aktif yang sedang login saat ini adalah **${userRole}** (${displayName}).\n\nHak akses: ${userRole === 'Owner' ? 'Akses laporan eksekutif, analitik finansial, omset, dan evaluasi performa bisnis.' : 'Akses panel operasional harian kasir/POS, pengelolaan menu, kontrol stok, dan monitoring member.'}`
      };
    }

    // (b) Total transaksi & omset periode ini
    if (/\b(total|jumlah|berapa|rekap)\s*(transaksi|pesanan|order)\b/i.test(q) ||
      /\b(total|berapa)\s*(omset|pendapatan|penjualan|revenue)\b/i.test(q) ||
      /\b(transaksi|penjualan|omset)\s*(periode|saat\s*ini|hari\s*ini|semua|aktif)\b/i.test(q)) {
      return {
        reply: `**Rekapitulasi Transaksi Periode ${activePeriod}:**\n\n• Total Transaksi: **${txCount} pesanan**\n• Total Omset / Pendapatan: **${formatRp(totalRev)}**\n• Rata-rata Nilai Pesanan (AOV): **${formatRp(avgOrder)}**`
      };
    }

    // (c) Siapa saja nama pembeli yang memesan dan pesanannya
    if ((/\b(pembeli|pemesan|pelanggan|konsumen|customer|yang\s*pesan|yang\s*beli)\b/i.test(q) &&
      /\b(siapa|daftar|list|nama|pesanan|pesanannya|item|order|rincian|semua|detail|siapa\s*aja|siapa\s*saja|apa\s*saja|apa\s*aja)\b/i.test(q)) ||
      /\b(siapa\s*(saja|aja)\s*yang\s*(pesan|beli|order))\b/i.test(q) ||
      /^(daftar\s*pembeli|daftar\s*pemesan|data\s*pembeli|siapa\s*yang\s*pesan)$/i.test(q)) {
      if (transactions.length > 0) {
        const list = transactions.map((t, idx) => {
          const itemsStr = Array.isArray(t.items) && t.items.length > 0
            ? t.items.map(i => `${i.productName || i.name || i.nama_menu || 'Menu'} x${i.quantity || i.qty || 1}`).join(", ")
            : "-";
          const timeStr = t.dateFormatted || t.date || "Hari ini";
          const payMethod = t.paymentMethod || "QRIS";
          const totalStr = formatRp(t.total || 0);
          return `${idx + 1}. **${t.customerName || 'Pelanggan'}** [${t.id || 'KM'}] (${timeStr}, ${payMethod}, ${totalStr}): ${itemsStr}`;
        }).join("\n");
        return {
          reply: `**Daftar Pembeli dan Pesanannya (Periode: ${activePeriod} — Total ${txCount} Pesanan):**\n\n${list}`
        };
      } else if (salesSummary.buyersListText) {
        return {
          reply: `**Daftar Pembeli dan Pesanannya (Periode: ${activePeriod} — Total ${txCount} Pesanan):**\n\n${salesSummary.buyersListText}`
        };
      }
    }

    // (d) Menu terlaris
    if ((/\b(menu|produk|makanan|minuman)\b/i.test(q) && /\b(terlaris|paling\s*laris|paling\s*laku|favorit|top|bestseller|best\s*seller|unggulan|paling\s*banyak)\b/i.test(q)) ||
      /\b(terlaris|paling\s*laris|best\s*seller|bestseller)\b/i.test(q) ||
      /^(menu\s*terlaris|produk\s*terlaris|top\s*seller|bestseller)$/i.test(q)) {
      const itemSales = {};
      const itemRev = {};
      transactions.forEach(tx => {
        if (Array.isArray(tx.items)) {
          tx.items.forEach(it => {
            const name = (it.productName || it.name || it.nama_menu || "Menu").trim();
            const qty = Number(it.quantity || it.qty || 1);
            const price = Number(it.price || it.harga || 0);
            const sub = Number(it.subtotal || (price * qty));
            itemSales[name] = (itemSales[name] || 0) + qty;
            itemRev[name] = (itemRev[name] || 0) + sub;
          });
        }
      });
      const sorted = Object.entries(itemSales).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        const text = sorted.map(([name, qty], idx) => {
          const rev = itemRev[name] ? ` (Rp ${itemRev[name].toLocaleString("id-ID")})` : "";
          return `${idx + 1}. **${name}**: ${qty} porsi terjual${rev}`;
        }).join("\n");
        return {
          reply: `**Rekapitulasi Menu Terlaris (Periode ${activePeriod}):**\n\n${text}`
        };
      }
    }

    // 2. Data Member terdaftar (lengkap seluruh array members.json tanpa terpotong)
    const isMemberQuery = (
      /\b(member|anggota)\b/i.test(q) && (
        /(siapa|daftar|list|data|nama|semua|seluruh|cek|tampilkan|berapa|total|info|lihat|sebutkan|detail|lengkap|siapa\s*aja|siapa\s*saja|ada\s*siapa)/i.test(q) ||
        /^(member|members|data\s*member|daftar\s*member)$/i.test(q.trim())
      )
    );

    if (isMemberQuery) {
      const memberList = Array.isArray(members) ? members : [];
      if (memberList.length === 0) {
        return {
          reply: "Saat ini belum ada member yang terdaftar dalam sistem."
        };
      }
      const names = memberList.map((m, i) => `${i + 1}. **${(m.name || "Member").trim()}** — Kampus: ${(m.campus || "-").trim()}`).join("\n");
      return {
        reply: `Total terdaftar: **${memberList.length} member**\n\n${names}`
      };
    }

    // 3. Stok analysis
    if (/(stok|stock|restock|habis|menipis|persediaan)/.test(q)) {
      const outOfStock = products.filter(p => getPStock(p) <= 0);
      const lowStock = products.filter(p => getPStock(p) > 0 && getPStock(p) <= 5);
      let reply = `**Laporan Stok Terkini:**\n\n`;
      if (outOfStock.length > 0) {
        reply += `• **Habis (0 porsi):** ${outOfStock.map(p => `${getPName(p)}`).join(", ")}\n`;
      }
      if (lowStock.length > 0) {
        reply += `• **Menipis (≤5 porsi):** ${lowStock.map(p => `${getPName(p)} (${getPStock(p)} sisa)`).join(", ")}\n`;
      }
      if (outOfStock.length === 0 && lowStock.length === 0) {
        reply += `Seluruh stok menu berada pada batas aman.`;
      }
      return { reply };
    }

    // 4. Penjualan / Revenue / Omset
    if (/(penjualan|revenue|omset|omzet|pendapatan|transaksi|laporan|data|aov)/.test(q)) {
      return {
        reply: `**Laporan Transaksi & Keuangan Terkini:**\n\n• Total Omset / Pendapatan: **${formatRp(totalRev)}**\n• Total Pesanan Berhasil: **${txCount} transaksi**\n• Rata-rata Pesanan (AOV): **${formatRp(avgOrder)}**`
      };
    }

    // 5. Strategi bisnis / promo
    if (/(strategi|promo|bundling|marketing|ide|saran bisnis|meningkatkan)/.test(q)) {
      return {
        reply: `**Rekomendasi Operasional & Penjualan:**\n\n1. **Paket Bundling:** Kopi Susu Mahasiswa + Cemilan hemat Rp 3.000 untuk meningkatkan nilai pesanan.\n2. **Program Loyalitas Member:** Maksimalkan promo diskon 10% untuk mahasiswa aktif.\n3. **Restock Terjadwal:** Siapkan bahan baku sebelum pukul 15.00 WIB untuk mengantisipasi lonjakan sore-malam.`
      };
    }

    // 6. Identitas Bot
    if (/(siapa kamu|kamu apa|tentang kamu|perkenalan)/.test(q)) {
      return {
        reply: "Saya adalah **KopiAI Admin**, asisten kecerdasan buatan internal untuk analisis data dan operasional Kopi Mahasiswa."
      };
    }

    // 7. Greeting admin
    if (/^(halo|hai|hi|selamat|good|pagi|siang|sore|malam)\b/.test(q)) {
      return {
        reply: "Halo. Ada data operasional, stok, penjualan, atau member yang perlu saya tampilkan?"
      };
    }

    return {
      reply: "Silakan tentukan data yang ingin diperiksa: **stok menu**, **laporan penjualan**, **data member**, atau **analisis operasional**."
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
