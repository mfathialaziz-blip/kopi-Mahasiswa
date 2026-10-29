/**
 * KOPI MAHASISWA — WHATSAPP BOT & MEMBER NOTIFICATION SERVICE
 * Built with: Node.js, Express.js, and whatsapp-web.js
 * 
 * Features:
 * 1. 24/7 Member Notification API (/api/notif-member)
 * 2. Visual Menu Catalog via MessageMedia.fromUrl (20 Unique Official Pinterest Items)
 * 3. Store Opening Hours Logic (Mon-Sat 09.00-23.00 WIB, Sun Closed)
 * 4. Fuzzy / Typo-Tolerant Keyword Matcher (hasWord)
 * 5. Full REST API & Webhook Support
 */

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");

const app = express();
const PORT = process.env.PORT || 3000;
const APP_URL = process.env.APP_URL || "https://kopi.test";
const MEMBERS_FILE = path.join(__dirname, "members.json");

// Tangani error tidak tertangkap dari Puppeteer (Execution context destroyed saat navigasi WhatsApp Web)
process.on("uncaughtException", (err) => {
  console.warn("⚠️ [Server Safe Guard] Uncaught Exception:", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.warn("⚠️ [Server Safe Guard] Unhandled Rejection:", reason && reason.message ? reason.message : reason);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===================================================
// 0a. MYSQL DATABASE POOL & REAL-TIME MENU HELPER
// ===================================================
const mysql = require("mysql2/promise");

const dbPool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "kopi",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/**
 * Mengambil data menu real-time dari database MySQL
 */
async function getMenuFromDB() {
  try {
    const [rows] = await dbPool.execute(
      "SELECT nama_menu, kategori, harga, stok, deskripsi FROM menu"
    );
    return rows || [];
  } catch (err) {
    console.error("❌ [MySQL Menu Error] Gagal membaca tabel menu:", err.message);
    return [];
  }
}

/**
 * Format daftar menu dari database MySQL menjadi string context untuk AI
 */
function formatMenuContext(menuList) {
  if (!menuList || menuList.length === 0) {
    return "Daftar Menu Resmi: Data menu belum tersedia di database.";
  }
  const lines = menuList.map(
    m => `- ${m.nama_menu} (${m.kategori}): Rp${Number(m.harga).toLocaleString("id-ID")} [Stok: ${m.stok}]`
  );
  return `Daftar Menu Resmi Kopi Mahasiswa Saat Ini (Database MySQL):\n${lines.join("\n")}`;
}

// ===================================================
// 0b. HELPER PENYIMPANAN DATA MEMBER (members.json)
// ===================================================
function getMembers() {
  if (!fs.existsSync(MEMBERS_FILE)) return [];
  try {
    const raw = fs.readFileSync(MEMBERS_FILE, "utf8");
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error("❌ [Members Storage Error] Gagal membaca members.json:", err.message);
    return [];
  }
}

function saveMember(newMember) {
  try {
    const members = getMembers();
    const cleanPhone = String(newMember.phone || "").replace(/\D/g, "");

    // Cek jika member dengan no HP yang sama sudah pernah terdaftar
    const existingIndex = members.findIndex(m => {
      const p = String(m.phone || "").replace(/\D/g, "");
      return p && p === cleanPhone;
    });

    const memberRecord = {
      id: newMember.id || (existingIndex !== -1 ? members[existingIndex].id : Date.now()),
      name: newMember.name || (existingIndex !== -1 ? members[existingIndex].name : "Member"),
      campus: newMember.campus || (existingIndex !== -1 ? members[existingIndex].campus : "Mahasiswa"),
      phone: newMember.phone || (existingIndex !== -1 ? members[existingIndex].phone : ""),
      cleanPhone: cleanPhone,
      password: newMember.password || (existingIndex !== -1 ? members[existingIndex].password : ""),
      registeredAt: newMember.registeredAt || (existingIndex !== -1 ? members[existingIndex].registeredAt : new Date().toISOString()),
      status: "Aktif"
    };

    if (existingIndex !== -1) {
      members[existingIndex] = { ...members[existingIndex], ...memberRecord };
    } else {
      members.unshift(memberRecord);
    }

    fs.writeFileSync(MEMBERS_FILE, JSON.stringify(members, null, 2), "utf8");
    console.log(`💾 [Members Storage] Data member "${memberRecord.name}" disimpan ke members.json (Total: ${members.length})`);
    return memberRecord;
  } catch (err) {
    console.error("❌ [Members Storage Error] Gagal menyimpan ke members.json:", err.message);
    return null;
  }
}

// ===================================================
// 1. DAFTAR KATALOG MENU RESMI & URL PINTEREST (20 ITEM UNIK)
// ===================================================
const MENU_CATALOG = [
  // ☕ COFFEE SERIES (7 Menu)
  {
    id: "kopi-susu",
    name: "Kopi Susu Mahasiswa (Gula Aren)",
    category: "coffee",
    categoryLabel: "☕ Coffee Series",
    price: 15000,
    description: "Espresso robusta-arabica blend dipadu susu creamy dan gula aren organik. Teman setia kuliah!",
    imageUrl: "https://i.pinimg.com/736x/e0/2d/01/e02d0124461097bf06ec219eb51d5c69.jpg",
    keywords: ["kopi susu", "kopsu", "gula aren", "susu", "kopi aren"]
  },
  {
    id: "americano",
    name: "Americano / Kopi Hitam",
    category: "coffee",
    categoryLabel: "☕ Coffee Series",
    price: 12000,
    description: "Double shot espresso dengan air mineral dingin/hangat. Dijamin melek ngerjain revisi skripsi.",
    imageUrl: "https://i.pinimg.com/736x/0e/52/30/0e52308b27b6b9ea83aa371c0b01a5a8.jpg",
    keywords: ["americano", "kopi hitam", "black coffee", "hitam", "kopi o"]
  },
  {
    id: "cappuccino",
    name: "Cappuccino",
    category: "coffee",
    categoryLabel: "☕ Coffee Series",
    price: 18000,
    description: "Espresso mantap dengan foam susu tebal dan taburan cocoa powder aromatik.",
    imageUrl: "https://i.pinimg.com/1200x/bc/d2/0a/bcd20ada9e61be0077f08b4be21a4242.jpg",
    keywords: ["cappuccino", "capucino", "kapucino", "cappucino"]
  },
  {
    id: "caramel-macchiato",
    name: "Caramel Macchiato",
    category: "coffee",
    categoryLabel: "☕ Coffee Series",
    price: 20000,
    description: "Layer steamed milk vanila, espresso mantap, dengan siraman saus karamel manis legit di atasnya.",
    imageUrl: "https://i.pinimg.com/736x/3a/74/db/3a74db74d7ce5a4683e6f3a2f5dc6462.jpg",
    keywords: ["caramel macchiato", "karamel macchiato", "macchiato", "caramel", "karamel"]
  },
  {
    id: "espresso-single",
    name: "Espresso Single",
    category: "coffee",
    categoryLabel: "☕ Coffee Series",
    price: 10000,
    description: "Single shot ekstrak biji kopi pilihan dengan crema tebal keemasan dan aroma intens.",
    imageUrl: "https://i.pinimg.com/1200x/e8/8c/96/e88c963b93c4ee2f3481b3576e2c9395.jpg",
    keywords: ["espresso", "espresso single", "single shot", "espreso"]
  },
  {
    id: "caffe-latte",
    name: "Caffe Latte",
    category: "coffee",
    categoryLabel: "☕ Coffee Series",
    price: 18000,
    description: "Paduan seimbang espresso dan steamed milk yang halus. Pas dinikmati sambil diskusi kelompok.",
    imageUrl: "https://i.pinimg.com/736x/6b/4d/ca/6b4dcad544eec6fb886abf03514a7cc0.jpg",
    keywords: ["caffe latte", "cafe latte", "latte", "kafe latte"]
  },
  {
    id: "mocha-deadline",
    name: "Mocha Deadline",
    category: "coffee",
    categoryLabel: "☕ Coffee Series",
    price: 20000,
    description: "Perpaduan kopi espresso pekat dan dark chocolate Belgia, manis legit penambah semangat nugas.",
    imageUrl: "https://i.pinimg.com/736x/b7/38/53/b7385352694908aa56d7a4405404eb89.jpg",
    keywords: ["mocha", "moka", "mocha deadline", "kopi coklat", "mocca"]
  },

  // 🥛 NON-COFFEE (5 Menu)
  {
    id: "matcha-latte",
    name: "Matcha Latte",
    category: "non-coffee",
    categoryLabel: "🥛 Non-Coffee",
    price: 18000,
    description: "Matcha Uji Jepang asli dengan susu creamy. Rasa earthy autentik yang menenangkan.",
    imageUrl: "https://i.pinimg.com/736x/16/6b/d0/166bd08582b84f62ec20ba9aa2110d3c.jpg",
    keywords: ["matcha", "matcha latte", "green tea", "teh hijau"]
  },
  {
    id: "chocolate",
    name: "Chocolate / Cokelat",
    category: "non-coffee",
    categoryLabel: "🥛 Non-Coffee",
    price: 16000,
    description: "Cokelat murni premium dipadukan susu segar dingin/panas, legit dan melegakan pikiran.",
    imageUrl: "https://i.pinimg.com/736x/c2/77/7f/c2777f71cb0e13b28a413113fce481a0.jpg",
    keywords: ["chocolate", "cokelat", "coklat", "choco"]
  },
  {
    id: "thai-tea",
    name: "Thai Tea Seger",
    category: "non-coffee",
    categoryLabel: "🥛 Non-Coffee",
    price: 12000,
    description: "Racikan teh rempah khas Thailand berpadu susu kental manis gurih disajikan dingin menyegarkan.",
    imageUrl: "https://i.pinimg.com/736x/d0/df/ce/d0dfce1ba2625e47d77bfec7930609b8.jpg",
    keywords: ["thai tea", "thaitea", "teh thailand", "thai"]
  },
  {
    id: "lemon-tea",
    name: "Fresh Lemon Tea",
    category: "non-coffee",
    categoryLabel: "🥛 Non-Coffee",
    price: 10000,
    description: "Seduhan teh pilihan dengan perasan lemon asli. Dingin, asam segar, langsung balikin fokus.",
    imageUrl: "https://i.pinimg.com/1200x/a2/e6/34/a2e634d3e685e263ed681fdbbd8fce9f.jpg",
    keywords: ["lemon tea", "fresh lemon tea", "es lemon tea", "lemon"]
  },
  {
    id: "taro-latte",
    name: "Taro Latte Creamy",
    category: "non-coffee",
    categoryLabel: "🥛 Non-Coffee",
    price: 16000,
    description: "Rasa taro manis wangi dengan warna ungu estetik dan kelembutan susu murni.",
    imageUrl: "https://i.pinimg.com/736x/08/f1/da/08f1da3145406ef23701a7383f149ecf.jpg",
    keywords: ["taro", "taro latte", "taro creamy", "talas"]
  },

  // 🥐 SNACK & PASTRIES (8 Menu)
  {
    id: "piscok",
    name: "Pisang Coklat (Piscok)",
    category: "snack",
    categoryLabel: "🥐 Snack & Pastries",
    price: 12000,
    description: "Kulit lumpia renyah membungkus pisang manis dan lelehan dark chocolate nikmat.",
    imageUrl: "https://i.pinimg.com/1200x/a7/51/a1/a751a10a1b3fd8d3fb308a03453d1df9.jpg",
    keywords: ["piscok", "pisang coklat", "pisang", "lumpia pisang"]
  },
  {
    id: "kentang-goreng",
    name: "Kentang Goreng",
    category: "snack",
    categoryLabel: "🥐 Snack & Pastries",
    price: 12000,
    description: "French fries garing gurih disajikan dengan saus sambal cocolan dan taburan bumbu rahasia.",
    imageUrl: "https://i.pinimg.com/736x/66/9a/58/669a5862c19c0bd6e442ebca1c7d89a7.jpg",
    keywords: ["kentang", "kentang goreng", "french fries", "fries"]
  },
  {
    id: "roti-bakar",
    name: "Roti Bakar",
    category: "snack",
    categoryLabel: "🥐 Snack & Pastries",
    price: 14000,
    description: "Roti bakar tebal renyah di luar, bertabur keju cheddar melimpah dan lumeran coklat manis.",
    imageUrl: "https://i.pinimg.com/1200x/94/90/37/949037d9e892a69787585d8e1b70ce9a.jpg",
    keywords: ["roti bakar", "roti", "toast", "robar"]
  },
  {
    id: "dimsum-ayam",
    name: "Dimsum Ayam",
    category: "snack",
    categoryLabel: "🥐 Snack & Pastries",
    price: 15000,
    description: "Dimsum olahan daging ayam segar dibalut kulit tipis lembut, disajikan hangat dengan chili oil gurih.",
    imageUrl: "https://i.pinimg.com/1200x/70/8b/75/708b7548e688948cacbc14339a4a820c.jpg",
    keywords: ["dimsum", "dimsum ayam", "siomay", "chili oil"]
  },
  {
    id: "mie-dok-dok",
    name: "Mie Dok-Dok Nugas",
    category: "snack",
    categoryLabel: "🥐 Snack & Pastries",
    price: 15000,
    description: "Mie kuah kental gurih khas warkop modern berpadu telur kocok, sayuran segar, dan cabai rawit.",
    imageUrl: "https://i.pinimg.com/736x/6c/9c/fb/6c9cfbda40f0d15572fb59e4ad30965e.jpg",
    keywords: ["mie", "mie dok dok", "mie dokdok", "dokdok", "indomie", "mie nugas"]
  },
  {
    id: "donat-kampus",
    name: "Donat Kampus Glazed",
    category: "snack",
    categoryLabel: "🥐 Snack & Pastries",
    price: 8000,
    description: "Donat kentang super empuk dengan topping cokelat leleh dan taburan meses warna-warni.",
    imageUrl: "https://i.pinimg.com/1200x/47/eb/49/47eb4964e3d315ff758175b3274e5c74.jpg",
    keywords: ["donat", "donut", "donat kampus", "glazed"]
  },
  {
    id: "choco-cookies",
    name: "Choco Chip Cookies",
    category: "snack",
    categoryLabel: "🥐 Snack & Pastries",
    price: 10000,
    description: "Kue kering renyah harum mentega dengan limpahan dark choco chunks lezat.",
    imageUrl: "https://i.pinimg.com/736x/b1/60/b5/b160b5a47f607efd3ef055f29b4a22ed.jpg",
    keywords: ["cookies", "cookie", "choco chip cookies", "kue"]
  },
  {
    id: "butter-croissant",
    name: "Butter Croissant",
    category: "snack",
    categoryLabel: "🥐 Snack & Pastries",
    price: 14000,
    description: "Pastry ala Prancis dengan layer renyah di luar dan lembut wangi butter di dalam.",
    imageUrl: "https://i.pinimg.com/736x/30/98/b3/3098b37993867ed5b37bd686d463ca4b.jpg",
    keywords: ["croissant", "butter croissant", "pastry", "kroisan"]
  }
];

// ===================================================
// 2. HELPER UTILITIES: FORMAT NO HP, JAM BUKA & KEYWORDS
// ===================================================

/**
 * Format nomor WhatsApp ke format standar 62... @c.us
 * Aman dari karakter non-angka dan awalan '0' atau '8'
 */
function formatWhatsAppNumber(phone) {
  if (!phone) return null;
  // Hapus semua karakter non-angka
  let clean = String(phone).replace(/\D/g, "");
  if (!clean) return null;

  // Ubah awalan '0' menjadi '62'
  if (clean.startsWith("0")) {
    clean = "62" + clean.slice(1);
  } else if (clean.startsWith("8")) {
    clean = "62" + clean;
  }

  // Hilangkan suffix jika sudah ada sebelumnya
  clean = clean.replace(/@c\.us$/, "");

  // Pastikan panjang nomor wajar (minimal 9 digit)
  if (clean.length < 9) return null;

  return clean + "@c.us";
}

/**
 * Cek jam operasional Kopi Mahasiswa di zona waktu WIB (UTC+7)
 * Jadwal:
 * - Senin s.d. Sabtu: 09.00 - 23.00 WIB
 * - Minggu: TUTUP (Roasting & Maintenance Day)
 */
function isStoreOpen() {
  const now = new Date();
  // Konversi waktu sekarang ke zona waktu Asia/Jakarta (WIB, UTC+7)
  const wibString = now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
  const wibDate = new Date(wibString);

  const day = wibDate.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
  const hour = wibDate.getHours();
  const minute = wibDate.getMinutes();
  const currentTime = hour + (minute / 60);

  // Hari Minggu (0) TUTUP
  if (day === 0) {
    return false;
  }

  // Senin - Sabtu buka jam 09.00 - 23.00 WIB
  return currentTime >= 9 && currentTime < 23;
}

/**
 * Fungsi pencarian kata kunci fleksibel (Toleransi Typo & Huruf Besar/Kecil)
 * Menguji apakah salah satu keyword ada dalam teks pelanggan
 */
function hasWord(text, keywords) {
  if (!text || !Array.isArray(keywords)) return false;
  const clean = text.toLowerCase().trim();

  return keywords.some(keyword => {
    const kw = keyword.toLowerCase().trim();
    if (!kw) return false;

    // 1. Cek kecocokan langsung substring
    if (clean.includes(kw)) return true;

    // 2. Cek boundary regex untuk kata individual
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(^|\\s|[.,!?;:])${escaped}($|\\s|[.,!?;:])`, "i");
    if (regex.test(clean)) return true;

    return false;
  });
}

/**
 * Cari item menu spesifik berdasarkan teks pesan
 */
function findMenuItemInQuery(text) {
  if (!text) return null;
  const clean = text.toLowerCase().trim();

  // 1. Cek nama menu lengkap
  for (const item of MENU_CATALOG) {
    if (clean.includes(item.name.toLowerCase())) {
      return item;
    }
  }

  // 2. Cek alias / keywords
  for (const item of MENU_CATALOG) {
    for (const kw of item.keywords) {
      if (clean.includes(kw)) {
        return item;
      }
    }
  }

  return null;
}

// ===================================================
// 3. WHATSAPP CLIENT INITIALIZATION (whatsapp-web.js)
// ===================================================
let isClientReady = false;
let currentQrCode = null;

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: "./.wwebjs_auth"
  }),
  puppeteer: {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu"
    ]
  }
});

client.on("qr", (qr) => {
  currentQrCode = qr;
  console.log("\n=======================================================");
  console.log("📲 SCAN QR CODE INI DENGAN WHATSAPP ANDA UNTUK LOGIN:");
  console.log("🌐 Atau buka di browser: http://localhost:3000/qr");
  console.log("=======================================================\n");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", () => {
  console.log("🔑 [WA Bot] Berhasil diautentikasi dengan WhatsApp!");
});

client.on("auth_failure", (err) => {
  console.error("❌ [WA Bot Error] Gagal autentikasi WhatsApp:", err);
});

client.on("ready", () => {
  isClientReady = true;
  currentQrCode = null;
  console.log("🚀 [WA Bot] WhatsApp Client Kopi Mahasiswa SIAP DIGUNAKAN!");
  console.log("⏰ Status Jam Buka Saat Ini:", isStoreOpen() ? "BUKA (09.00-23.00 WIB)" : "TUTUP");
});

client.on("disconnected", (reason) => {
  isClientReady = false;
  currentQrCode = null;
  console.warn("⚠️ [WA Bot] WhatsApp terputus:", reason);
  console.log("🔄 Mencoba menghubungkan ulang...");
  client.initialize().catch(e => console.error("Re-init error:", e));
});

// ===================================================
// 4. PESAN CHAT MASUK (client.on('message')) & 9 KATA KUNCI
// ===================================================
const FALLBACK_KEYWORD_MESSAGE = 
`Waduh, bot belum paham nih, Bestie! 😅

Coba ketik kata kunci ini:
1. 📋 menu
2. 📶 wifi
3. 📍 lokasi
4. 🎟️ promo
5. 👤 register
6. 💳 member
7. ⭐ ulasan
8. 👨💻 admin
9. 🤖 ai`;

client.on("message", async (msg) => {
  try {
    // Abaikan pesan dari status story atau grup broadcast
    if (!msg.from || msg.from.includes("broadcast") || msg.from.includes("status")) {
      return;
    }

    // Abaikan pesan dari nomor bot sendiri
    if (msg.fromMe) return;

    const text = (msg.body || "").trim();
    if (!text) return;

    console.log(`📩 [WA Chat Masuk] Dari: ${msg.from} | Pesan: "${text}"`);

    // ---------------------------------------------------
    // 4A. CEK JAM OPERASIONAL TOKO (09.00 - 23.00 WIB, MINGGU TUTUP)
    // ---------------------------------------------------
    if (!isStoreOpen()) {
      const closedReply = 
`Halo kak! ☕ Terima kasih sudah menghubungi *Kopi Mahasiswa*.

Saat ini kedai kami sedang *TUTUP*. 🙏

⏰ *Jam Operasional Kami:*
• *Senin - Sabtu:* 09.00 - 23.00 WIB
• *Minggu:* Tutup (Roasting & Maintenance Day)

Pesan kakak sudah kami terima dan akan dibalas secepatnya saat kedai kembali beroperasi. 
Untuk melihat katalog menu & promo, silakan kunjungi website kami di:
👉 *${APP_URL}/*

Terima kasih atas pengertiannya! Sampai ketemu di jam ngopi besok ya kak! ✨`;

      await msg.reply(closedReply);
      console.log(`⏱️ [Auto Reply] Respon pesan kedai tutup terkirim ke ${msg.from}`);
      return;
    }

    // ---------------------------------------------------
    // 4B. PERMINTAAN FOTO / GAMBAR MENU SPESIFIK (MessageMedia.fromUrl)
    // ---------------------------------------------------
    const isAskingPhoto = hasWord(text, ["foto", "gambar", "lihat foto", "lihat gambar", "pic", "picture", "fotonya", "penampakan"]);
    const specificItem = findMenuItemInQuery(text);

    if (isAskingPhoto && specificItem) {
      try {
        console.log(`🖼️ [Media Sending] Mengunduh dan mengirim foto: ${specificItem.name}`);
        const media = await MessageMedia.fromUrl(specificItem.imageUrl, { unsafeMime: true });
        
        const caption = 
`☕ *${specificItem.name}*
💰 *Harga:* Rp ${specificItem.price.toLocaleString("id-ID")}
🏷️ *Kategori:* ${specificItem.categoryLabel}

📝 *Deskripsi:*
${specificItem.description}

✨ *Pesan online sekarang:* ${APP_URL}/`;

        await client.sendMessage(msg.from, media, { caption: caption });
        console.log(`✅ [Media Success] Foto ${specificItem.name} berhasil terkirim ke ${msg.from}`);
        return;
      } catch (mediaErr) {
        console.error(`❌ [Media Error] Gagal mengirim MessageMedia untuk ${specificItem.name}:`, mediaErr.message);
        const fallbackMsg = 
`☕ *${specificItem.name}*
💰 *Harga:* Rp ${specificItem.price.toLocaleString("id-ID")}
📝 ${specificItem.description}

🔗 *Foto Visual Menu:*
${specificItem.imageUrl}

Silakan pesan langsung di kasir atau via web: ${APP_URL}/ ✨`;
        await msg.reply(fallbackMsg);
        return;
      }
    }

    // ---------------------------------------------------
    // 4C. PENGECEKAN 9 KATA KUNCI LENGKAP
    // ---------------------------------------------------

    // 1. 📋 MENU (Katalog Real-Time Database MySQL)
    if (hasWord(text, ["menu", "katalog", "daftar menu", "minta menu", "list menu", "harga", "price list", "1", "1."])) {
      const dbMenus = await getMenuFromDB();
      let menuText = "";

      if (dbMenus && dbMenus.length > 0) {
        const kopiItems = dbMenus.filter(m => (m.kategori || "").toLowerCase().includes("kopi") && !(m.kategori || "").toLowerCase().includes("non"));
        const nonKopiItems = dbMenus.filter(m => (m.kategori || "").toLowerCase().includes("non"));
        const snackItems = dbMenus.filter(m => !(m.kategori || "").toLowerCase().includes("kopi"));

        menuText = `📋 *KATALOG RESMI KOPI MAHASISWA* ☕\n_Semua racikan dibuat dari bahan premium ramah kantong mahasiswa!_\n\n`;
        if (kopiItems.length > 0) {
          menuText += `☕ *COFFEE SERIES:*\n` + kopiItems.map(m => `• ${m.nama_menu} — Rp ${Number(m.harga).toLocaleString("id-ID")}${m.stok <= 0 ? ' _(Habis)_' : ''}`).join("\n") + "\n\n";
        }
        if (nonKopiItems.length > 0) {
          menuText += `🥛 *NON-COFFEE:*\n` + nonKopiItems.map(m => `• ${m.nama_menu} — Rp ${Number(m.harga).toLocaleString("id-ID")}${m.stok <= 0 ? ' _(Habis)_' : ''}`).join("\n") + "\n\n";
        }
        if (snackItems.length > 0) {
          menuText += `🥐 *SNACK & MAKANAN:*\n` + snackItems.map(m => `• ${m.nama_menu} — Rp ${Number(m.harga).toLocaleString("id-ID")}${m.stok <= 0 ? ' _(Habis)_' : ''}`).join("\n") + "\n\n";
        }
        menuText += `💡 *Tips:* Ingin lihat foto menu? Cukup ketik misal: *"minta foto cappuccino"*!\n🌐 *Pesan Cepat via Web:* ${APP_URL}/`;
      } else {
        menuText = `📋 *KATALOG KOPI MAHASISWA* ☕\nSilakan cek katalog lengkap di website kami: ${APP_URL}/`;
      }

      await msg.reply(menuText);
      return;
    }

    // 2. 📶 WIFI
    if (hasWord(text, ["wifi", "wifii", "wi-fi", "password wifi", "pw wifi", "pw", "2", "2."])) {
      const wifiReply = 
`📶 *INFO WI-FI KOPI MAHASISWA* ☕

• *SSID:* KopiMahasiswa_5G (atau KopiMahasiswa_2.4G)
• *Password:* \`nugassampaisubuh\`
• *Kecepatan:* Up to 100 Mbps (Lancar buat zoom, download jurnal, & push repo)

🔌 *Fasilitas:* Stopkontak tersedia di setiap meja ya Bestie. Selamat nugas & enjoy your coffee! ⚡`;
      await msg.reply(wifiReply);
      return;
    }

    // 3. 📍 LOKASI
    if (hasWord(text, ["lokasi", "alamat", "dimana", "tempat", "posisi", "maps", "3", "3."])) {
      const lokasiText = 
`📍 *LOKASI KOPI MAHASISWA:*

Jl. Kampus Raya No. 42 (Hanya 100 meter dari Gerbang Utama Kampus)
Google Maps: https://maps.google.com/?q=Kopi+Mahasiswa

🚗 Parkir motor & mobil luas, area indoor AC non-smoking, dan outdoor smoking area yang nyaman!`;
      await msg.reply(lokasiText);
      return;
    }

    // 4. 🎟️ PROMO
    if (hasWord(text, ["promo", "diskon", "voucher", "hemat", "potongan", "4", "4."])) {
      const promoText = 
`🎟️ *PROMO AKTIF KOPI MAHASISWA* ☕

1. 🎓 *Diskon Member 10%:*
Daftar member di web kami (gratis) & dapatkan potongan 10% untuk semua pesananmu!
Daftar sekarang di: ${APP_URL}/

2. ⚡ *Paket Nugas Deadline:*
Kopi Susu Mahasiswa + Roti Bakar hanya *Rp 26.000* (Hemat Rp 3.000)!

3. 🍟 *Combo Ngemil Sore:*
Matcha Latte / Chocolate + Kentang Goreng hanya *Rp 25.000*!

Tunjukkan nomor HP member kakak saat memesan di kasir ya Bestie! ✨`;
      await msg.reply(promoText);
      return;
    }

    // 5. 👤 REGISTER
    if (hasWord(text, ["register", "registrasi", "daftar member", "daftar", "pendaftaran", "buat akun", "gabung member", "gabung", "5", "5."])) {
      const registerText = 
`👤 *PENDAFTARAN MEMBER KOPI MAHASISWA* ☕

Mau nikmati Diskon 10% setiap hari & reward kopi gratis pas ultah? Yuk daftar, 100% GRATIS!

📝 *Cara Daftar Kilat (1 Menit):*
1. Kunjungi website kami di: 👉 ${APP_URL}/
2. Klik tombol *"Gabung Member"* di pojok atas.
3. Masukkan Nama, Kampus, dan Nomor WhatsApp kamu.
4. Notifikasi sambutan member akan otomatis terkirim ke WhatsApp ini! 🚀

Tunggu apa lagi? Yuk gabung jadi keluarga Sobat Ngopi sekarang! ✨`;
      await msg.reply(registerText);
      return;
    }

    // 6. 💳 MEMBER
    if (hasWord(text, ["member", "membership", "kartu member", "keuntungan member", "benefit member", "status member", "6", "6."])) {
      const members = getMembers();
      const memberCount = members.length;

      const memberText = 
`💳 *INFO MEMBERSHIP KOPI MAHASISWA* 🎓

Saat ini sudah ada *${memberCount} Sobat Ngopi* yang resmi terdaftar sebagai member aktif!

🌟 *Keuntungan Eksklusif Member:*
• 🏷️ *Diskon 10%* untuk seluruh menu makanan & minuman tanpa batas minimal belanja.
• ⚡ *Special Promo*: Akses paket promo nugas & combo hemat mingguan.
• 📶 *Prioritas Wi-Fi*: Akses jaringan berkecepatan tinggi up to 100 Mbps.
• 🎁 *Birthday Reward*: Kopi gratis pilihanmu di hari ulang tahun.

Ketik *register* untuk mendaftar sekarang atau kunjungi website kami di:
👉 ${APP_URL}/ ✨`;
      await msg.reply(memberText);
      return;
    }

    // 7. ⭐ ULASAN
    if (hasWord(text, ["ulasan", "review", "testimoni", "rating", "feedback", "saran", "kritik", "7", "7."])) {
      const ulasanText = 
`⭐ *ULASAN & TESTIMONI KOPI MAHASISWA* 🌟

Kepuasan dan kenyamanan Bestie adalah prioritas utama kami! Ulasanmu sangat berarti untuk kemajuan kedai kami.

💬 *Beri Ulasan & Nilai Kami:*
• ⭐ Google Maps Rating:
  👉 https://maps.google.com/?q=Kopi+Mahasiswa
• Atau ketik kritik & saran langsung di WhatsApp ini, tim kami akan dengan senang hati membacanya!

Terima kasih atas dukungan terbaik dari Sobat Ngopi! 🙏☕✨`;
      await msg.reply(ulasanText);
      return;
    }

    // 8. 👨💻 ADMIN
    if (hasWord(text, ["admin", "owner", "cs", "customer service", "bantuan admin", "kontak admin", "hubungi", "kontak", "8", "8."])) {
      const adminText = 
`👨💻 *HUBUNGI ADMIN / CUSTOMER SERVICE* ☕

Butuh bantuan reservasi meja, pemesanan katering event kampus, kendala transaksi, atau kerjasama?

📞 *Layanan Bantuan Kedai:*
• *WhatsApp Admin:* 0812-3456-7890
• *Instagram:* @kopimahasiswa.id
• *Email:* admin@kopimahasiswa.com
• *Jam Operasional Admin:* Senin - Sabtu, 09.00 - 23.00 WIB

Silakan tinggalkan pesan detail kebutuhanmu di sini, staf kami akan segera merespons ya Bestie! 🚀`;
      await msg.reply(adminText);
      return;
    }

    // 9. 🤖 AI (Jika hanya mengetik kata kunci "ai" / "9")
    const lower = text.toLowerCase().trim();
    if (["ai", "9", "9.", "tanya ai", "bot", "barista ai", "kopi ai"].includes(lower)) {
      const aiIntro = 
`🤖 *KOPIAI VIRTUAL BARISTA* ☕✨

Halo Bestie! Saya KopiAI, barista pintar yang siap menemani dan menjawab pertanyaanmu 24/7.

Kamu bisa tanyakan apa saja langsung di chat ini, contohnya:
• *"Rekomendasi kopi yang creamy dan manis dong"*
• *"Kopi apa yang cocok buat begadang ngerjain tugas?"*
• *"Apakah ada snack yang gurih dan renyah?"*
• *"Kopi susu mahasiswa rasanya gimana?"*

Silakan ketik pertanyaanmu sekarang, Bestie! 👇`;
      await msg.reply(aiIntro);
      return;
    }

    // BANTUAN / HELP / DAFTAR KATA KUNCI
    if (hasWord(text, ["bantuan", "help", "kata kunci", "keyword", "keywords", "panduan", "menu bot"])) {
      await msg.reply(FALLBACK_KEYWORD_MESSAGE);
      return;
    }

    // ---------------------------------------------------
    // 4D. DI LUAR 9 KEYWORD: ALIKHAN LANGSUNG KE GEMINI AI
    // ---------------------------------------------------
    console.log(`🤖 [WA Bot AI] Mengalihkan pesan di luar 9 keyword ke Gemini AI: "${text}"`);

    try {
      const dbMenus = await getMenuFromDB();
      const menuContext = formatMenuContext(dbMenus);
      const members = getMembers();
      const memberCount = members.length;

      const geminiKey = process.env.GEMINI_API_KEY || "AQ.Ab8RN6IzlWQYQYgs1Nn6fJiroApOilTNf1wgSCSwzLbdr7upmw";
      const geminiModel = "gemini-3.5-flash-lite";

      const systemPrompt = `Kamu adalah "KopiAI Virtual Barista" dari kedai Kopi Mahasiswa.
Lawan bicaramu adalah pelanggan / mahasiswa yang sedang bertanya melalui WhatsApp.

INSTRUKSI PENTING:
- Panggil pelanggan dengan ramah dan santai, gunakan sebutan "Bestie" atau "kak".
- Jawablah selalu dalam Bahasa Indonesia yang ramah, hangat, santai, dan solutif khas anak muda/mahasiswa.
- Jawab secara SINGKAT, PADAT, dan TUNTAS (maksimal 2-3 kalimat saja). Pastikan kalimat selesai sampai tanda titik tanpa terpotong.
- KONSISTENSI DATA MENU: HANYA sebutkan menu yang ada di daftar menu resmi database MySQL di bawah ini. Jika pelanggan menanyakan menu yang tidak tersedia, katakan dengan sopan bahwa menu tersebut belum ada dan berikan rekomendasi menu lain dari database.
- Jika pelanggan hanya menyapa (halo/hai/p/assalamualaikum), balas ramah dan infokan bahwa mereka bisa tanya rekomendasi menu atau ketik salah satu dari 9 kata kunci bantuan (ketik *bantuan*).

${menuContext}

DATA KEDAI:
- Wi-Fi: KopiMahasiswa_5G (Password: nugassampaisubuh)
- Lokasi: Jl. Kampus Raya No. 42 (100m dari gerbang utama kampus)
- Jam Buka: Senin - Sabtu 09.00 - 23.00 WIB (Minggu Libur)
- Diskon Member: 10% setiap transaksi (daftar gratis di ${APP_URL}/)
- Total Member Terdaftar: ${memberCount} orang.`;

      const aiReply = await callGeminiBackend(
        geminiKey,
        geminiModel,
        systemPrompt,
        text,
        [],
        350
      );

      if (aiReply && aiReply.trim()) {
        await msg.reply(aiReply.trim());
        console.log(`✅ [WA Bot AI] Balasan Gemini (${aiReply.length} char) terkirim ke ${msg.from}`);
        return;
      } else {
        throw new Error("Balasan Gemini kosong.");
      }

    } catch (aiErr) {
      console.warn("⚠️ [WA Bot AI Error] Gagal memanggil Gemini AI, menggunakan fallback 9 keywords:", aiErr.message || aiErr);
      await msg.reply(FALLBACK_KEYWORD_MESSAGE);
      return;
    }

  } catch (err) {
    console.error("❌ [WA Chat Error] Terjadi kesalahan saat memproses pesan:", err);
  }
});

// ===================================================
// 4b. REST API: HALAMAN SCAN QR WHATSAPP VIA BROWSER (/qr & /api/bot-status)
// ===================================================
app.get("/api/bot-status", (req, res) => {
  return res.json({
    status: isClientReady ? "ready" : "need_scan",
    isClientReady,
    hasQr: !!currentQrCode,
    isStoreOpen: isStoreOpen()
  });
});

app.get("/qr", (req, res) => {
  if (isClientReady) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>WhatsApp Bot — Kopi Mahasiswa</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #12100e; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
          .card { background: #1f1a16; border: 1px solid #3d2f23; border-radius: 24px; padding: 40px; text-align: center; max-width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
          .badge { display: inline-block; background: #10b981; color: white; padding: 6px 18px; border-radius: 50px; font-weight: bold; margin-bottom: 20px; font-size: 14px; }
          h2 { color: #d4a373; margin: 0 0 10px; font-size: 22px; }
          p { color: #a89f91; font-size: 14px; line-height: 1.6; }
          .btn { display: inline-block; background: #c88a4b; color: white; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-weight: 600; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">✅ BOT WHATSAPP AKTIF</div>
          <h2>WhatsApp Bot Kopi Mahasiswa</h2>
          <p>WhatsApp Web sudah aktif dan berhasil terhubung! Semua notifikasi login akun, pendaftaran member baru, dan promo diskon 2 mingguan akan otomatis terkirim.</p>
          <a href="${APP_URL}" class="btn">Kembali ke Website Kopi Mahasiswa</a>
        </div>
      </body>
      </html>
    `);
  }

  if (!currentQrCode) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="refresh" content="3">
        <title>Menyiapkan QR Code...</title>
        <style>
          body { font-family: sans-serif; background: #12100e; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: #1f1a16; padding: 30px; border-radius: 16px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>⏳ Menyiapkan QR Code WhatsApp...</h2>
          <p>Halaman otomatis diperbarui dalam beberapa detik...</p>
        </div>
      </body>
      </html>
    `);
  }

  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=15&data=" + encodeURIComponent(currentQrCode);

  return res.send(`
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="refresh" content="12">
      <title>Scan QR WhatsApp — Kopi Mahasiswa</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #12100e; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
        .card { background: #1f1a16; border: 1px solid #3d2f23; border-radius: 24px; padding: 36px; text-align: center; max-width: 440px; box-shadow: 0 25px 50px rgba(0,0,0,0.6); }
        .logo { font-size: 32px; margin-bottom: 8px; }
        h2 { color: #d4a373; margin: 0 0 6px; font-size: 22px; }
        .subtitle { color: #a89f91; font-size: 13px; margin-bottom: 24px; }
        .qr-wrapper { background: white; padding: 14px; border-radius: 18px; display: inline-block; box-shadow: 0 10px 25px rgba(0,0,0,0.4); margin-bottom: 20px; }
        .qr-wrapper img { display: block; border-radius: 8px; width: 280px; height: 280px; }
        .steps { background: #28211b; border-radius: 14px; padding: 16px; text-align: left; font-size: 13px; color: #d0c8be; line-height: 1.6; }
        .steps ol { margin: 0; padding-left: 20px; }
        .steps li { margin-bottom: 4px; }
        .footer { margin-top: 16px; font-size: 12px; color: #887d72; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo">☕</div>
        <h2>Scan QR WhatsApp Bot</h2>
        <div class="subtitle">Hubungkan nomor WhatsApp untuk mengaktifkan notifikasi login & promo</div>
        <div class="qr-wrapper">
          <img src="${qrUrl}" alt="QR Code WhatsApp Bot" />
        </div>
        <div class="steps">
          <ol>
            <li>Buka <b>WhatsApp</b> di HP Anda</li>
            <li>Ketuk menu <b>Titik Tiga (⋮)</b> / <b>Pengaturan</b></li>
            <li>Pilih <b>Perangkat Tertaut (Linked Devices)</b></li>
            <li>Ketuk <b>Tautkan Perangkat</b> dan arahkan kamera ke QR di atas</li>
          </ol>
        </div>
        <div class="footer">🔄 Halaman auto-refresh otomatis saat kode diperbarui</div>
      </div>
    </body>
    </html>
  `);
});

// ===================================================
// 5. REST API: ENDPOINT NOTIFIKASI MEMBER / REGISTER (/api/notif-member & /api/register)
//    PENTING: Tidak terhalang oleh jam operasional kedai (24 Jam Penuh)
// ===================================================
app.post(["/api/notif-member", "/api/register"], async (req, res) => {
  const startTime = Date.now();
  try {
    const { name, campus, phone, cleanPhone, memberName: reqMemberName, password } = req.body || {};

    console.log("\n-------------------------------------------------------");
    console.log(`📨 [API Notif Register] Menerima pendaftaran member:`);
    console.log(`👤 Nama   : ${name || reqMemberName}`);
    console.log(`🎓 Kampus : ${campus || "Mahasiswa"}`);
    console.log(`📱 No HP  : ${phone || cleanPhone}`);
    console.log("-------------------------------------------------------");

    // Validasi parameter nama dan telepon
    const targetPhone = cleanPhone || phone;
    if (!targetPhone) {
      console.warn("⚠️ [API Notif Member] Nomor telepon tidak disediakan dalam request.");
      return res.status(400).json({
        success: false,
        message: "Nomor telepon (phone / cleanPhone) wajib diisi."
      });
    }

    // Format nomor WhatsApp aman (mengubah 08... ke 628...@c.us)
    const formattedNumber = formatWhatsAppNumber(targetPhone);
    if (!formattedNumber) {
      console.warn(`⚠️ [API Notif Member] Format nomor telepon tidak valid: "${targetPhone}"`);
      return res.status(400).json({
        success: false,
        message: "Format nomor telepon tidak valid. Pastikan nomor benar."
      });
    }

    const memberName = reqMemberName || name || "Sobat Ngopi";

    // Simpan data member ke file JSON (members.json)
    const savedRecord = saveMember({
      name: memberName,
      phone: targetPhone,
      campus: campus || "Mahasiswa",
      password: password || "",
      registeredAt: new Date().toISOString()
    });

    // Pesan sambutan hangat pendaftaran member baru (NOTIF REGISTER)
    const welcomeMessage = 
`☕ *SELAMAT DATANG DI KOPI MAHASISWA* ☕

Halo Kak *${memberName}*! 🎉
Selamat! Akun Member Kopi Mahasiswa kamu resmi aktif.

🎓 *Kampus:* ${campus || "Mahasiswa"}
📱 *Nomor:* ${targetPhone}
🎟️ *Voucher Diskon Pertama:* *MHS10OFF* (Diskon 10%)

✨ *Keuntungan Member Kamu:*
1. Diskon 10% untuk transaksi pertamamu (Kupon: *MHS10OFF*)
2. Diskon khusus member setiap kali beli kopi di kedai / pesan online
3. Notifikasi pemberitahuan diskon otomatis setiap 2 minggu sekali langsung ke WhatsApp ini!

Tunjukkan pesan ini atau Kartu Member Digital ke kasir saat memesan. Selamat ngopi & semangat nugas! ☕✨`;

    // Cek kesiapan WhatsApp Client
    if (!isClientReady) {
      console.warn(`⚠️ [API Notif Member] Member "${memberName}" disimpan ke members.json, tetapi WhatsApp Client belum login/ready.`);
      return res.status(200).json({
        status: "success",
        success: true,
        message: "Data member berhasil disimpan ke sistem! (Notifikasi WA tertunda karena WhatsApp Bot belum dihubungkan).",
        recipient: formattedNumber,
        previewMessage: welcomeMessage,
        member: savedRecord
      });
    }

    // Kirim pesan WhatsApp
    console.log(`🚀 [API Notif Member] Mengirim pesan WhatsApp ke: ${formattedNumber}...`);
    const sendResult = await client.sendMessage(formattedNumber, welcomeMessage);

    const elapsed = Date.now() - startTime;
    console.log(`✅ [API Notif Member Success] Pesan notifikasi terkirim dalam ${elapsed}ms ke ${formattedNumber}`);

    return res.status(200).json({
      status: "success",
      success: true,
      message: "Notifikasi pendaftaran member berhasil dikirim ke WhatsApp dan disimpan!",
      recipient: formattedNumber,
      messageId: sendResult && sendResult.id ? sendResult.id._serialized : "sent",
      member: savedRecord,
      elapsedMs: elapsed
    });

  } catch (error) {
    console.error("❌ [API Notif Member Error] Gagal mengirim pesan notifikasi WhatsApp:", error);
    return res.status(500).json({
      status: "error",
      success: false,
      message: "Terjadi kesalahan pada server bot WhatsApp saat memproses member.",
      error: error.message || String(error)
    });
  }
});

// ===================================================
// 5b. REST API: ENDPOINT LOGIN MEMBER (/api/login & /api/notif-login)
// ===================================================
app.post(["/api/login", "/api/notif-login"], async (req, res) => {
  const startTime = Date.now();
  try {
    const inputPhone = String(req.body.phone || req.body.nomorHp || req.body.no_hp || req.body.whatsapp || "").trim();
    const inputPassword = req.body.password ? String(req.body.password).trim() : null;

    console.log("\n=======================================================");
    console.log("📥 [API Login] Menerima request login member:");
    console.log(`📱 Input Phone: "${inputPhone}"`);

    // 1. Validasi Input Nomor HP
    if (!inputPhone) {
      console.warn("⚠️ [API Login Ditolak] Nomor HP tidak diisi dalam request.");
      return res.status(400).json({
        status: "error",
        success: false,
        message: "Nomor HP wajib diisi."
      });
    }

    // 1. Baca file members.json secara sinkron dengan benar
    let members = [];
    if (fs.existsSync(MEMBERS_FILE)) {
      try {
        const fileContent = fs.readFileSync(MEMBERS_FILE, "utf8");
        members = JSON.parse(fileContent) || [];
      } catch (err) {
        console.error("❌ [API Login] Gagal membaca members.json:", err.message);
        members = getMembers();
      }
    } else {
      members = getMembers();
    }

    // 2. Lakukan perulangan / .find() untuk mencocokkan nomor HP
    // Pastikan konversi ke string dilakukan di KEDUA belah pihak agar tidak error tipe data:
    const reqPhone = String(req.body.phone || inputPhone).trim();
    const cleanInput = reqPhone.replace(/\D/g, "");

    // Helper normalisasi format nomor Indonesia (08xxx vs 628xxx)
    const normalizeIndo = (str) => {
      let digits = String(str || "").replace(/\D/g, "");
      if (digits.startsWith("62")) digits = "0" + digits.slice(2);
      return digits;
    };
    const normInput = normalizeIndo(reqPhone);

    const foundMember = members.find(m => {
      const mPhone = String(m.phone || "").trim();
      const mWa = String(m.whatsapp || "").trim();
      const mNoHp = String(m.no_hp || "").trim();
      const mClean = String(m.cleanPhone || mPhone).replace(/\D/g, "");

      return (
        mPhone === reqPhone ||
        mWa === reqPhone ||
        mNoHp === reqPhone ||
        (cleanInput && mClean && cleanInput === mClean) ||
        (normInput && normalizeIndo(mPhone) === normInput) ||
        (normInput && normalizeIndo(mClean) === normInput) ||
        (normInput && normalizeIndo(mWa) === normInput) ||
        (normInput && normalizeIndo(mNoHp) === normInput)
      );
    });

    // 4. Jika TIDAK KETEMU, berikan console.log di terminal backend
    // yang mencetak isi req.body.phone yang di-input user dan seluruh isi array members
    if (!foundMember) {
      console.log("❌ [API Login Member TIDAK KETEMU]");
      console.log("📱 req.body.phone yang di-input user:", req.body.phone);
      console.log("👥 Seluruh isi array members:", JSON.stringify(members, null, 2));

      return res.status(404).json({
        status: "error",
        success: false,
        message: "Nomor HP belum terdaftar, silakan buat akun member baru!"
      });
    }

    // Verifikasi password jika akun memiliki password
    if (inputPassword && foundMember.password && String(foundMember.password).trim() !== inputPassword) {
      console.warn(`❌ [API Login Ditolak] Password salah untuk member: ${foundMember.name}`);
      return res.status(401).json({
        status: "error",
        success: false,
        message: "Password salah! Silakan periksa kembali."
      });
    }

    // 3. Jika foundMember ketemu DAN password cocok:
    console.log("Login Success for:", foundMember.name, "Phone:", foundMember.phone);

    // Format tanggal & waktu WIB
    const loginTime = new Date().toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "full",
      timeStyle: "medium"
    }) + " WIB";

    // Konversi nomor tujuan otomatis menggunakan format standar kode negara '62' (628xxx@c.us)
    const targetPhone = String(foundMember.cleanPhone || foundMember.phone || foundMember.whatsapp || foundMember.no_hp || inputPhone || "").trim();
    const targetWhatsAppId = formatWhatsAppNumber(targetPhone);

    const memberCampus = foundMember.campus || "Mahasiswa";
    const memberIdCode = foundMember.memberId || `KM-MBR-${String(foundMember.id || Date.now()).slice(-4)}`;

    // Format pesan notifikasi login sesuai spesifikasi:
    // "Halo [Nama Member]! Kamu berhasil login di Kopi Mahasiswa pada [Waktu Login]. Selamat menikmati kopi favoritmu! ☕"
    const loginMessage = req.body && req.body.message
      ? req.body.message
      : `☕ *KOPI MAHASISWA — NOTIFIKASI LOGIN AKUN* ☕\n\nHalo ${foundMember.name}! Kamu berhasil login di Kopi Mahasiswa pada ${loginTime}. Selamat menikmati kopi favoritmu! ☕\n\n🎓 *Kampus:* ${memberCampus}\n📱 *Nomor:* ${foundMember.phone || targetPhone}\n🆔 *ID Member:* ${memberIdCode}\n\n_Pemberitahuan ini dikirim otomatis demi keamanan akun Anda._`;

    // 3 & 4. Blok Try-Catch Pengiriman WA & Penanganan Sesi Bot
    try {
      console.log("Mencoba mengirim notif WA ke:", targetPhone);

      // Cek apakah sesi bot WhatsApp sudah ready / authenticated
      const isReady = isClientReady || (client && client.info && client.info.wid);
      if (!isReady || !client) {
        throw new Error("Sesi bot WhatsApp belum ready / authenticated. Notifikasi WA ditunda.");
      }

      if (!targetWhatsAppId) {
        throw new Error(`Format nomor HP tidak valid untuk WhatsApp: "${targetPhone}"`);
      }

      const sendResult = await client.sendMessage(targetWhatsAppId, loginMessage);
      console.log(`✅ [Notif Login] Pesan berhasil dikirim ke ${targetWhatsAppId}`);

      const elapsed = Date.now() - startTime;
      return res.status(200).json({
        status: "success",
        success: true,
        waSent: true,
        message: "Login berhasil dan notifikasi WhatsApp berhasil dikirim!",
        recipient: targetWhatsAppId,
        messageId: sendResult && sendResult.id ? sendResult.id._serialized : "sent",
        member: foundMember,
        elapsedMs: elapsed
      });
    } catch (err) {
      console.warn(`⚠️ [Notif Login] Gagal kirim WA ke ${targetWhatsAppId}: ${err.message || err}`);

      // Bot offline / WA belum konek — login tetap sukses, hanya notif WA yang gagal
      return res.status(200).json({
        status: "success",
        success: true,
        waSent: false,
        message: "Login berhasil! Notifikasi WA tertunda: " + (err ? (err.message || String(err)) : "Kendala pengiriman"),
        recipient: targetWhatsAppId,
        member: foundMember,
        waError: err ? (err.message || String(err)) : null,
        previewMessage: loginMessage
      });
    }
  } catch (error) {
    console.error("❌ [API Login Fatal Error] Terjadi kesalahan tak terduga pada server saat login:", error);
    return res.status(500).json({
      status: "error",
      success: false,
      message: "Terjadi kesalahan pada server saat memproses login.",
      error: error.message || String(error)
    });
  }
});

// ===================================================
// 5c. BROADCAST PROMO & SCHEDULER 14 HARI (2 MINGGU SEKALI)
// ===================================================
// Template pesan promo berkala sesuai spesifikasi:
// "Halo [Nama Member]! Spesial promo 2 mingguan Kopi Mahasiswa! Dapatkan diskon menarik khusus hari ini. Cek menumu sekarang di https://kopi.test ☕ promo terbatas!"
const DEFAULT_PROMO_TEMPLATE = 
  "Halo [Nama Member]! Spesial promo 2 mingguan Kopi Mahasiswa! Dapatkan diskon menarik khusus hari ini. Cek menumu sekarang di https://kopi.test ☕ promo terbatas!";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000; // 14 hari dalam ms (1.209.600.000 ms)

/**
 * Fungsi kirim notifikasi broadcast promo massal ke seluruh nomor WA member
 * Otomatis memformat nomor tujuan dengan kode negara '62' (bukan '0')
 * dan melakukan personalisasi nama member pada pesan.
 */
async function broadcastPromoToMembers(customTemplate = null) {
  const template = customTemplate || DEFAULT_PROMO_TEMPLATE;
  const members = getMembers();
  console.log(`\n=======================================================`);
  console.log(`📢 [Broadcast Promo 2 Mingguan] Memulai pengiriman ke ${members.length} member...`);

  let totalSent = 0;
  let failedCount = 0;
  const results = [];

  for (const member of members) {
    const memberName = member.name || "Sobat Ngopi";
    // Personalisasi pesan per member
    const personalizedMessage = template
      .replace(/\[Nama Member\]/gi, memberName)
      .replace(/{nama}/gi, memberName)
      .replace(/{name}/gi, memberName);

    const targetPhone = member.cleanPhone || member.phone || member.whatsapp || member.no_hp;
    // Format otomatis dengan kode negara '62'
    const formattedNumber = formatWhatsAppNumber(targetPhone);

    if (!formattedNumber) {
      console.warn(`⚠️ [Broadcast Promo] Nomor tidak valid untuk member: ${memberName} (${targetPhone})`);
      failedCount++;
      results.push({ name: memberName, phone: targetPhone, status: "invalid_phone" });
      continue;
    }

    try {
      if (isClientReady && client) {
        await client.sendMessage(formattedNumber, personalizedMessage);
        totalSent++;
        results.push({ name: memberName, phone: targetPhone, formattedPhone: formattedNumber, status: "sent" });
        console.log(`✅ [Broadcast Promo] Terkirim ke ${memberName} (${formattedNumber})`);
        // Jeda 500ms antar pengiriman pesan agar aman dari rate-limit WhatsApp
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.warn(`⚠️ [Broadcast Promo] Sesi WhatsApp offline, pengiriman ke ${memberName} tertunda`);
        results.push({ name: memberName, phone: targetPhone, formattedPhone: formattedNumber, status: "queued_offline" });
      }
    } catch (err) {
      console.error(`❌ [Broadcast Promo Error] Gagal kirim ke ${memberName}:`, err.message);
      failedCount++;
      results.push({ name: memberName, phone: targetPhone, formattedPhone: formattedNumber, status: "failed", error: err.message });
    }
  }

  console.log(`📢 [Broadcast Promo Selesai] Total terkirim: ${totalSent}/${members.length}`);
  console.log(`=======================================================\n`);
  return { totalSent, failedCount, totalMembers: members.length, results };
}

// Scheduler otomatis setiap 14 hari (2 Minggu Sekali)
setInterval(async () => {
  console.log("⏰ [Scheduler WA 14 Hari] Waktunya broadcast promo 2 mingguan dijalankan...");
  try {
    await broadcastPromoToMembers();
  } catch (err) {
    console.error("❌ [Scheduler WA Error] Gagal menjalankan broadcast promo:", err);
  }
}, FOURTEEN_DAYS_MS);

// REST API: ENDPOINT BROADCAST PROMO (/api/broadcast-promo & /api/promo-berkala)
app.all(["/api/broadcast-promo", "/api/promo-berkala"], async (req, res) => {
  try {
    const customMessage = (req.body && req.body.message) || req.query.message || null;
    const broadcastResult = await broadcastPromoToMembers(customMessage);

    return res.status(200).json({
      status: "success",
      success: true,
      message: "Broadcast promo 2 mingguan berhasil diproses!",
      promoTemplate: customMessage || DEFAULT_PROMO_TEMPLATE,
      ...broadcastResult
    });
  } catch (error) {
    console.error("❌ [API Broadcast Promo Error]:", error);
    return res.status(500).json({
      status: "error",
      success: false,
      message: "Terjadi kesalahan saat memproses broadcast promo.",
      error: error.message || String(error)
    });
  }
});

// ===================================================
// 6. REST API: GET ALL MEMBERS (/api/members)
// ===================================================
app.get("/api/members", (req, res) => {
  try {
    const members = getMembers();
    return res.json({
      status: "success",
      success: true,
      total: members.length,
      data: members
    });
  } catch (err) {
    console.error("❌ [API Members Error] Gagal mengambil data member:", err);
    return res.status(500).json({
      status: "error",
      success: false,
      message: "Gagal membaca daftar member dari server.",
      error: err.message
    });
  }
});

// ===================================================
// 6b. REST API: DELETE MEMBER (/api/members/:id)
// ===================================================
app.delete("/api/members/:id", (req, res) => {
  try {
    const memberId = req.params.id;
    const members = getMembers();
    const beforeCount = members.length;

    // Support matching by numeric id OR string id
    const filtered = members.filter(m => String(m.id) !== String(memberId));

    if (filtered.length === beforeCount) {
      return res.status(404).json({
        status: "error",
        success: false,
        message: `Member dengan ID '${memberId}' tidak ditemukan.`
      });
    }

    fs.writeFileSync(MEMBERS_FILE, JSON.stringify(filtered, null, 2), "utf8");
    console.log(`🗑️  [API Delete Member] Member ID '${memberId}' berhasil dihapus. Sisa: ${filtered.length}`);

    return res.json({
      status: "success",
      success: true,
      message: `Member berhasil dihapus.`,
      remaining: filtered.length
    });
  } catch (err) {
    console.error("❌ [API Delete Member Error] Gagal menghapus member:", err);
    return res.status(500).json({
      status: "error",
      success: false,
      message: "Terjadi kesalahan saat menghapus member.",
      error: err.message
    });
  }
});

// ===================================================
// 6c. REST API: AI ADVISOR CHAT — BACKEND RELAY (/api/ai-chat)
// ===================================================
// Node built-in https (no extra dependency needed)
const https = require("https");

/**
 * Relay helper: kirim request ke Gemini REST API dari backend Node.js
 * Menggunakan node built-in https agar tidak perlu install node-fetch.
 */
function callGeminiBackend(apiKey, model, systemPrompt, userMessage, chatHistory = [], maxTokens = 300) {
  const candidateModels = Array.from(new Set([
    model,
    "gemini-3.5-flash-lite",
    "gemini-3.7-flash",
    "gemini-3.8-flash"
  ])).filter(Boolean);

  return new Promise(async (resolve, reject) => {
    const contents = [];
    const validHistory = (chatHistory || []).slice(-6); // Batasi history agar prompt ringkas
    validHistory.forEach(item => {
      if (item && item.content && item.content.trim()) {
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
    while (contents.length > 0 && contents[0].role !== "user") contents.shift();

    const body = JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { temperature: 0.6, maxOutputTokens: maxTokens }
    });

    let lastError = null;

    for (const curModel of candidateModels) {
      try {
        const reply = await new Promise((resInner, rejInner) => {
          const url = new URL(
            `https://generativelanguage.googleapis.com/v1beta/models/${curModel}:generateContent?key=${encodeURIComponent(apiKey)}`
          );

          const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: "POST",
            headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) }
          };

          const req = https.request(options, (res2) => {
            let data = "";
            res2.on("data", chunk => { data += chunk; });
            res2.on("end", () => {
              try {
                const parsed = JSON.parse(data);
                if (res2.statusCode !== 200) {
                  return rejInner(new Error(`Model ${curModel} HTTP ${res2.statusCode}: ${parsed.error?.message || data}`));
                }
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || "";
                resInner(text.trim());
              } catch (e) {
                rejInner(e);
              }
            });
          });

          req.on("error", rejInner);
          req.setTimeout(12000, () => { req.destroy(new Error(`Gemini timeout on ${curModel} (12s)`)); });
          req.write(body);
          req.end();
        });

        if (reply) {
          return resolve(reply);
        }
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ [API AI Chat Cascade] ${err.message} — mencoba kandidat model berikutnya...`);
      }
    }

    reject(lastError || new Error("Semua kandidat model Gemini gagal merespons."));
  });
}

app.post("/api/ai-chat", async (req, res) => {
  try {
    const { message, chatHistory = [], apiKey, model } = req.body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, error: "Parameter 'message' wajib diisi." });
    }

    // === 1. Baca members.json REAL-TIME ===
    const members = getMembers();
    const memberCount = members.length;
    const namaMembers = members.map(m => m.name).join(', ');

    // === 2. Baca data menu langsung dari MySQL REAL-TIME ===
    const menuList = await getMenuFromDB();
    const menuContext = formatMenuContext(menuList);

    // === 3. Baca data transaksi ===
    const txData = req.body.transactionSummary || null;
    const txLine = txData
      ? `\n- Data Transaksi: ${txData.total} transaksi, Total Pendapatan = Rp ${Number(txData.revenue || 0).toLocaleString("id-ID")}.`
      : "";

    // === 4. Bangun System Prompt ringkas, ramah, tuntas & faktual ===
    const geminiKey  = apiKey  || process.env.GEMINI_API_KEY || "AQ.Ab8RN6IzlWQYQYgs1Nn6fJiroApOilTNf1wgSCSwzLbdr7upmw";
    const geminiModel = model  || "gemini-3.5-flash-lite";

    const systemPrompt = `Kamu adalah "KopiAI Business Advisor" — asisten AI bisnis untuk Admin / Pengelola Kedai Kopi Mahasiswa.

INSTRUKSI PENTING & KARAKTER JAWABAN:
- Jawablah selalu dalam Bahasa Indonesia yang jelas, ramah, dan tuntas.
- Berikan jawaban yang padat (maksimal 2-3 kalimat utuh) dan pastikan kalimat selesai sampai tanda titik tanpa terpotong.
- IDENTITAS PENGGUNA: Lawan bicaramu adalah Admin / Pengelola Kedai Kopi Mahasiswa. Jika user bertanya tentang identitasnya (seperti "siapa saya", "siapa aku"), jawablah secara utuh dan jelas: "Anda adalah Admin / Pengelola Kedai Kopi Mahasiswa."
- KONSISTENSI DATA MENU: HANYA jawab keberadaan dan informasi menu berdasarkan daftar menu resmi dari database MySQL di bawah ini. Jika user menanyakan nama menu yang TIDAK ADA di database (misalnya menu yang sudah dihapus atau tidak pernah terdaftar), Anda WAJIB menjawab bahwa menu tersebut tidak tersedia dan berikan saran nama menu yang sesuai dari database.
- Gunakan poin-poin singkat jika jawaban berupa daftar (maksimal 5 poin).

${menuContext}

DATA MEMBER TERDAFTAR (REAL-TIME members.json):
- Total Member Terdaftar = ${memberCount} member${txLine}
- Daftar Member: ${namaMembers}
- Manfaat Member: Diskon 10% setiap transaksi.

Fokus pada: analisis penjualan, stok, strategi promo, data member, data menu, dan operasional kafe.`;

    console.log(`🤖 [API AI Chat] Pesan: "${message.slice(0, 60)}..." | Menu: ${menuList.length} items | Members: ${memberCount} | Model: ${geminiModel}`);

    // === 5. Relay ke Gemini (maxOutputTokens: 300) ===
    const reply = await callGeminiBackend(
      geminiKey,
      geminiModel,
      systemPrompt,
      message.trim(),
      chatHistory,
      300 // maxOutputTokens: 300
    );

    if (!reply) {
      return res.status(502).json({ success: false, error: "Gemini tidak memberikan respons. Coba lagi." });
    }

    console.log(`✅ [API AI Chat] Balasan Gemini (${reply.length} char) terkirim.`);
    return res.json({ success: true, reply, memberCount, menuCount: menuList.length });

  } catch (err) {
    console.error("❌ [API AI Chat Error]:", err.message || err);
    return res.status(500).json({
      success: false,
      error: "Terjadi kesalahan pada AI Advisor backend.",
      detail: err.message || String(err)
    });
  }
});

// ===================================================
// 6. HEALTH CHECK & STATUS ENDPOINT
// ===================================================
app.get("/", (req, res) => {
  res.json({
    app: "Kopi Mahasiswa WhatsApp Bot & Notification Service",
    version: "2.4.0",
    status: isClientReady ? "READY / CONNECTED" : "AWAITING AUTH / CONNECTING",
    storeStatus: isStoreOpen() ? "BUKA (09.00 - 23.00 WIB)" : "TUTUP (Senin-Sabtu 09.00-23.00 WIB)",
    endpoints: {
      notifRegister: "POST /api/notif-member or POST /api/register",
      notifLogin: "POST /api/login or POST /api/notif-login",
      broadcastPromo: "POST /api/broadcast-promo",
      membersList: "GET /api/members",
      healthCheck: "GET /api/status"
    }
  });
});

app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    botReady: isClientReady,
    storeOpen: isStoreOpen(),
    timestamp: new Date().toISOString(),
    wibTime: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
  });
});

// ===================================================
// 7. START EXPRESS SERVER & INITIALIZE BOT
// ===================================================
app.listen(PORT, "0.0.0.0", () => {
  console.log("\n=======================================================");
  console.log(`☕ KOPI MAHASISWA — WHATSAPP BOT & NOTIF SERVICE`);
  console.log(`🌐 Express Server berjalan di: http://localhost:${PORT}`);
  console.log(`🌐 Alternatif IP lokal       : http://127.0.0.1:${PORT}`);
  console.log(`📩 Endpoint Register Member : POST http://localhost:${PORT}/api/notif-member`);
  console.log(`🔑 Endpoint Login Member    : POST http://localhost:${PORT}/api/login`);
  console.log(`📢 Endpoint Broadcast Promo : POST http://localhost:${PORT}/api/broadcast-promo`);
  console.log("=======================================================");
  let isInitializing = false;
  function initWhatsAppClient() {
    if (isClientReady || isInitializing) return;
    isInitializing = true;
    console.log("🔄 Menginisialisasi WhatsApp Web Client...");
    client.initialize()
      .then(() => {
        isInitializing = false;
      })
      .catch(err => {
        isInitializing = false;
        console.warn("⚠️ WhatsApp Client init tertunda (mencoba ulang dalam 4 detik):", err.message);
        setTimeout(initWhatsAppClient, 4000);
      });
  }

  initWhatsAppClient();
});
