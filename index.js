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

// ===================================================
// LOAD ENVIRONMENT VARIABLES (.env)
// ===================================================
const envFilePath = path.join(__dirname, ".env");
if (fs.existsSync(envFilePath)) {
  try {
    const envContent = fs.readFileSync(envFilePath, "utf8");
    envContent.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const idx = trimmed.indexOf("=");
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    });
    console.log("🌱 [.env] Konfigurasi environment berhasil dimuat.");
  } catch (err) {
    console.warn("⚠️ [.env] Gagal membaca file .env:", err.message);
  }
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "..";
const OPENROUTER_DEFAULT_MODEL = process.env.OPENROUTER_DEFAULT_MODEL || "google/gemini-2.5-flash";

const app = express();
const PORT = process.env.PORT || 3001;
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

/**
 * Mengambil ringkasan data transaksi & omset akurat secara real-time dari database MySQL.
 * Juga mengembalikan topItemsArr (array of objects) untuk keperluan deterministik.
 */
async function getTransactionMetricsFromDB() {
  try {
    const [rows] = await dbPool.query(`
      SELECT 
        COUNT(*) AS total_orders, 
        COALESCE(SUM(total_omset), 0) AS total_revenue,
        COALESCE(AVG(total_omset), 0) AS avg_order
      FROM pesanan 
      WHERE status != 'Batal' AND status != 'failed'
    `);
    const totalOrders = rows && rows[0] ? Number(rows[0].total_orders || 0) : 0;
    const totalRevenue = rows && rows[0] ? Number(rows[0].total_revenue || 0) : 0;
    const avgOrder = rows && rows[0] ? Math.round(Number(rows[0].avg_order || 0)) : 0;

    let topItems = "";
    let topItemsArr = [];
    try {
      const [topRows] = await dbPool.query(`
        SELECT pd.nama_menu, SUM(pd.jumlah) AS total_terjual,
               SUM(pd.subtotal) AS total_pendapatan
        FROM pesanan_detail pd
        JOIN pesanan p ON p.id = pd.pesanan_id
        WHERE p.status != 'Batal' AND p.status != 'failed'
        GROUP BY pd.nama_menu 
        ORDER BY total_terjual DESC 
        LIMIT 10
      `);
      if (topRows && topRows.length > 0) {
        topItemsArr = topRows.map(r => ({
          nama: r.nama_menu,
          terjual: Number(r.total_terjual || 0),
          pendapatan: Number(r.total_pendapatan || 0)
        }));
        topItems = topItemsArr
          .slice(0, 5)
          .map((r, i) => `${i + 1}. ${r.nama}: ${r.terjual} porsi (Rp ${r.pendapatan.toLocaleString("id-ID")})`)
          .join("\n");
      }
    } catch (e) {
      // Fallback jika kolom harga_satuan tidak tersedia
      try {
        const [topRows2] = await dbPool.query(`
          SELECT nama_menu, SUM(jumlah) AS total_terjual 
          FROM pesanan_detail 
          GROUP BY nama_menu 
          ORDER BY total_terjual DESC 
          LIMIT 10
        `);
        if (topRows2 && topRows2.length > 0) {
          topItemsArr = topRows2.map(r => ({ nama: r.nama_menu, terjual: Number(r.total_terjual || 0), pendapatan: 0 }));
          topItems = topItemsArr
            .slice(0, 5)
            .map((r, i) => `${i + 1}. ${r.nama}: ${r.terjual} porsi`)
            .join("\n");
        }
      } catch (e2) { }
    }

    return { totalOrders, totalRevenue, avgOrder, topItems, topItemsArr };
  } catch (err) {
    console.warn("⚠️ [DB Metrics Error]:", err.message);
    return { totalOrders: 0, totalRevenue: 0, avgOrder: 0, topItems: "", topItemsArr: [] };
  }
}

/**
 * Mengambil detail transaksi terbaru (20 order) untuk context AI Admin.
 * Menampilkan: nama pembeli, item yang dibeli, jumlah qty, subtotal.
 */
async function getRecentTransactionDetails() {
  try {
    const [rows] = await dbPool.query(`
      SELECT p.nama_pelanggan, p.kode_transaksi, p.total_omset, p.status,
             pd.nama_menu, pd.jumlah, pd.subtotal
      FROM pesanan p
      JOIN pesanan_detail pd ON pd.pesanan_id = p.id
      WHERE p.status != 'Batal' AND p.status != 'failed'
      ORDER BY p.id DESC
      LIMIT 100
    `);
    if (!rows || rows.length === 0) return "Belum ada rincian transaksi tersedia.";

    // Group by kode_transaksi
    const grouped = {};
    for (const r of rows) {
      const kode = r.kode_transaksi || "TX";
      if (!grouped[kode]) {
        grouped[kode] = {
          nama: r.nama_pelanggan || "Tamu",
          total: Number(r.total_omset || 0),
          items: []
        };
      }
      grouped[kode].items.push(`${r.nama_menu} x${r.jumlah}`);
    }

    const lines = Object.entries(grouped)
      .slice(0, 20)
      .map(([kode, tx]) => `- ${tx.nama} [${kode}]: ${tx.items.join(", ")} | Total: Rp ${tx.total.toLocaleString("id-ID")}`);
    return lines.join("\n");
  } catch (err) {
    console.warn("⚠️ [Recent TX Error]:", err.message);
    return "Data rincian transaksi tidak dapat diambil.";
  }
}

/**
 * Format context menu yang lebih kaya untuk system prompt AI Admin.
 * Menyertakan kategori, harga, stok, dan status ketersediaan.
 */
function formatMenuContextRich(menuList) {
  if (!menuList || menuList.length === 0) {
    return "Daftar Menu Resmi: Data menu belum tersedia di database.";
  }
  const byKategori = {};
  menuList.forEach(m => {
    const kat = (m.kategori || "Lainnya").trim();
    if (!byKategori[kat]) byKategori[kat] = [];
    byKategori[kat].push(m);
  });
  const sections = Object.entries(byKategori).map(([kat, items]) => {
    const lines = items.map(m => {
      const stok = Number(m.stok !== undefined ? m.stok : 10);
      const status = stok <= 0 ? "HABIS" : stok <= 3 ? `KRITIS (${stok})` : `OK (${stok})`;
      return `  - ${m.nama_menu}: Rp${Number(m.harga).toLocaleString("id-ID")} [Stok: ${status}]`;
    });
    return `[${kat}]\n${lines.join("\n")}`;
  });
  return `=== KATALOG MENU RESMI (MySQL Real-Time) ===\n${sections.join("\n\n")}`;
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
 * Sanitasi dan format nomor WhatsApp ke format standar internasional: 628... @c.us
 * - Menghapus semua karakter non-angka dan suffix @c.us
 * - Normalisasi awalan '08', '0', '8', '6208', atau '0062' menjadi standar resmi '628...'
 * - Memastikan panjang digit valid (antara 10 s.d. 16 digit angka)
 * - Mengembalikan format string resmi WhatsApp Web: "<nomor_angka>@c.us"
 * 
 * @param {string|number} phone
 * @returns {string|null}
 */
function formatWhatsAppNumber(phone) {
  if (!phone) return null;

  // 1. Ubah ke string dan buang suffix @c.us jika ada, lalu buang semua karakter non-digit
  let str = String(phone).replace(/@c\.us$/i, "").trim();
  let cleanDigits = str.replace(/\D/g, "");
  if (!cleanDigits) return null;

  // 2. Normalisasi berbagai format awalan nomor ke standar '628...'
  if (cleanDigits.startsWith("0062")) {
    cleanDigits = "62" + cleanDigits.slice(4);
  } else if (cleanDigits.startsWith("6208")) {
    cleanDigits = "628" + cleanDigits.slice(4);
  } else if (cleanDigits.startsWith("08")) {
    cleanDigits = "628" + cleanDigits.slice(2);
  } else if (cleanDigits.startsWith("0")) {
    cleanDigits = "62" + cleanDigits.slice(1);
  } else if (cleanDigits.startsWith("8")) {
    cleanDigits = "628" + cleanDigits.slice(1);
  }

  // 3. Validasi panjang nomor Indonesia standar (10 - 16 digit angka)
  if (cleanDigits.length < 10 || cleanDigits.length > 16) {
    return null;
  }

  // 4. Pastikan diawali dengan kode negara 62
  if (!cleanDigits.startsWith("62")) {
    return null;
  }

  return cleanDigits + "@c.us";
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

INSTRUKSI PENTING & GAYA BAHASA GEN Z:
- Gunakan gaya bahasa anak muda yang asik, santai, dan gaul (pake sapaan "lu-gue", "Bestie", "chill", "auto melek", "spill").
- HINDARI kalimat kaku/formal atau kalimat kepotong. Jawaban HARUS tuntas sampai tanda titik atau emoji penutup.
- Jika pelanggan bertanya identitasnya (seperti "siapa saya", "siapa gue", "siapa aku"): jawab interaktif: "Lu tuh member setia Kopi Mahasiswa, Bestie! Mau disiapin kopi apa nih biar gak ngantuk dan tetep chill nugas? ☕✨"
- Jawab secara SINGKAT, PADAT, dan TUNTAS (maksimal 2-3 kalimat saja).
- KONSISTENSI DATA MENU: HANYA sebutkan menu yang ada di daftar menu resmi database MySQL di bawah ini. Jika pelanggan menanyakan menu yang tidak tersedia, katakan bahwa menu tersebut belum ada dan spill menu alternatif lain yang seger/enak.
- Jika pelanggan hanya menyapa (halo/hai/p/assalamualaikum/yo), balas gaul, sapa "Bestie", dan tawarin menu kopi favorit.

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
    // 1. Ekstrak input request dengan variabel lokal yang terisolasi
    const inputName = String(req.body.name || req.body.memberName || "").trim();
    const inputCampus = String(req.body.campus || "Mahasiswa").trim();
    const inputPhone = String(req.body.phone || req.body.cleanPhone || req.body.whatsapp || req.body.nomorHp || "").trim();
    const inputPassword = req.body.password ? String(req.body.password).trim() : "";

    console.log("\n=======================================================");
    console.log(`📨 [API Register Member] Menerima pendaftaran member baru:`);
    console.log(`👤 Nama   : "${inputName}"`);
    console.log(`🎓 Kampus : "${inputCampus}"`);
    console.log(`📱 No HP  : "${inputPhone}"`);

    // 2. Validasi Input Nomor HP
    if (!inputPhone) {
      console.warn("⚠️ [API Register Ditolak] Nomor telepon tidak diisi dalam request.");
      return res.status(400).json({
        status: "error",
        success: false,
        message: "Nomor telepon wajib diisi."
      });
    }

    // 3. Sanitasi Ketat Nomor WhatsApp (Format: 62... @c.us)
    const targetWhatsAppId = formatWhatsAppNumber(inputPhone);
    if (!targetWhatsAppId) {
      console.warn(`⚠️ [API Register Ditolak] Format nomor telepon tidak valid: "${inputPhone}"`);
      return res.status(400).json({
        status: "error",
        success: false,
        message: "Format nomor telepon tidak valid. Pastikan nomor diawali '08' atau '628' dengan minimal 10 digit angka."
      });
    }

    const memberName = inputName || "Sobat Ngopi";
    const cleanPhoneDigits = targetWhatsAppId.replace(/@c\.us$/, "");

    // 4. Simpan data member ke file JSON (members.json) menggunakan variabel lokal
    const savedRecord = saveMember({
      name: memberName,
      phone: cleanPhoneDigits,
      cleanPhone: cleanPhoneDigits,
      campus: inputCampus,
      password: inputPassword,
      registeredAt: new Date().toISOString()
    });

    // 5. Pesan sambutan pendaftaran member baru
    const welcomeMessage =
      `☕ *SELAMAT DATANG DI KOPI MAHASISWA* ☕

Halo Kak *${memberName}*! 🎉
Selamat! Akun Member Kopi Mahasiswa kamu resmi aktif.

🎓 *Kampus:* ${inputCampus}
📱 *Nomor:* ${cleanPhoneDigits}
🎟️ *Voucher Diskon Pertama:* *MHS10OFF* (Diskon 10%)

✨ *Keuntungan Member Kamu:*
1. Diskon 10% untuk transaksi pertamamu (Kupon: *MHS10OFF*)
2. Diskon khusus member setiap kali beli kopi di kedai / pesan online
3. Notifikasi pemberitahuan diskon otomatis setiap 2 minggu sekali langsung ke WhatsApp ini!

Tunjukkan pesan ini atau Kartu Member Digital ke kasir saat memesan. Selamat ngopi & semangat nugas! ☕✨`;

    // 6. Cek kesiapan WhatsApp Client
    const isReady = isClientReady || (client && client.info && client.info.wid);
    if (!isReady || !client) {
      console.warn(`⚠️ [API Register] Member "${memberName}" disimpan, tetapi WhatsApp Client belum login/ready.`);
      return res.status(200).json({
        status: "success",
        success: true,
        waSent: false,
        message: "Data member berhasil disimpan ke sistem! (Notifikasi WA tertunda karena WhatsApp Bot belum ready).",
        recipient: targetWhatsAppId,
        previewMessage: welcomeMessage,
        member: savedRecord
      });
    }

    // 7. Pengiriman Eksklusif ke Nomor Peminta (targetWhatsAppId)
    console.log(`🚀 [API Register] Mengirim pesan WA eksklusif ke: ${targetWhatsAppId}`);
    let sendResult;
    try {
      sendResult = await client.sendMessage(targetWhatsAppId, welcomeMessage);
    } catch (sendErr) {
      if (sendErr && (sendErr.message || "").includes("detached Frame")) {
        console.warn("⚠️ [WA Bot Retry] Puppeteer detached frame, mencoba mengirim ulang dalam 1 detik...");
        await new Promise(r => setTimeout(r, 1000));
        sendResult = await client.sendMessage(targetWhatsAppId, welcomeMessage);
      } else {
        throw sendErr;
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`✅ [API Register Success] Pesan notifikasi terkirim eksklusif dalam ${elapsed}ms ke: ${targetWhatsAppId}`);
    console.log("=======================================================\n");

    return res.status(200).json({
      status: "success",
      success: true,
      waSent: true,
      message: "Notifikasi pendaftaran member berhasil dikirim ke WhatsApp dan disimpan!",
      recipient: targetWhatsAppId,
      messageId: sendResult && sendResult.id ? sendResult.id._serialized : "sent",
      member: savedRecord,
      elapsedMs: elapsed
    });

  } catch (error) {
    console.error("❌ [API Notif Member Error] Gagal memproses pendaftaran:", error);
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
    // 1. Ekstrak input request dengan variabel lokal yang terisolasi per-request
    const inputPhone = String(
      req.body.phone ||
      req.body.nomorHp ||
      req.body.no_hp ||
      req.body.whatsapp ||
      req.body.target ||
      req.body.recipient ||
      req.body.number ||
      ""
    ).trim();
    const inputPassword = req.body.password ? String(req.body.password).trim() : null;

    console.log("\n=======================================================");
    console.log("📥 [API Login Member] Menerima request login member:");
    console.log(`📱 Input Phone: "${inputPhone}"`);

    // 2. Validasi Input Nomor HP
    if (!inputPhone) {
      console.warn("⚠️ [API Login Ditolak] Nomor HP tidak diisi dalam request.");
      return res.status(400).json({
        status: "error",
        success: false,
        message: "Nomor HP wajib diisi."
      });
    }

    // 3. Sanitasi Ketat Nomor WhatsApp Peminta (Format: 628... @c.us)
    const targetWhatsAppId = formatWhatsAppNumber(inputPhone);
    if (!targetWhatsAppId) {
      console.warn(`⚠️ [API Login Ditolak] Format nomor HP tidak valid: "${inputPhone}"`);
      return res.status(400).json({
        status: "error",
        success: false,
        message: "Format nomor HP tidak valid. Pastikan nomor diawali '08' atau '628' dengan minimal 10 digit angka."
      });
    }

    // Ambil digit angka murni nomor peminta (contoh: 6285173022407)
    const cleanPhoneDigits = targetWhatsAppId.replace(/@c\.us$/, "");
    const indoZeroDigits = "0" + cleanPhoneDigits.slice(2); // contoh: 085173022407

    // 4. Baca file members.json secara sinkron
    let members = getMembers();
    if (members.length === 0 && fs.existsSync(MEMBERS_FILE)) {
      try {
        const fileContent = fs.readFileSync(MEMBERS_FILE, "utf8");
        members = JSON.parse(fileContent) || [];
      } catch (err) {
        console.error("❌ [API Login] Gagal membaca members.json:", err.message);
      }
    }

    // 5. Cocokkan nomor HP peminta secara presisi dengan data member
    let foundMember = members.find(m => {
      const mRaw = String(m.phone || m.cleanPhone || m.whatsapp || m.no_hp || "").replace(/\D/g, "");
      if (!mRaw) return false;

      let mIndo62 = mRaw;
      if (mIndo62.startsWith("0")) {
        mIndo62 = "62" + mIndo62.slice(1);
      } else if (mIndo62.startsWith("8")) {
        mIndo62 = "62" + mIndo62;
      }

      return (
        mRaw === cleanPhoneDigits ||
        mRaw === indoZeroDigits ||
        mIndo62 === cleanPhoneDigits ||
        cleanPhoneDigits.endsWith(mRaw) ||
        mRaw.endsWith(cleanPhoneDigits)
      );
    });

    // Fallback Fleksibel: Jika request dikirim dari backend PHP (login.php sudah memverifikasi akun member)
    if (!foundMember && (req.body.name || req.body.memberName || req.body.message)) {
      console.log(`ℹ️ [API Login] Member valid dari request payload: ${req.body.name || req.body.memberName || 'Member'}`);
      foundMember = {
        name: req.body.name || req.body.memberName || "Member",
        campus: req.body.campus || "Mahasiswa",
        phone: cleanPhoneDigits,
        cleanPhone: cleanPhoneDigits,
        status: "Aktif"
      };
    }

    if (!foundMember) {
      console.log(`❌ [API Login Member TIDAK KETEMU] Nomor input: "${cleanPhoneDigits}" (${targetWhatsAppId})`);
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

    const memberName = foundMember.name || req.body.name || req.body.memberName || "Member";
    const memberCampus = foundMember.campus || req.body.campus || "Mahasiswa";
    const memberIdCode = foundMember.memberId || `KM-MBR-${String(foundMember.id || Date.now()).slice(-4)}`;

    console.log(`🔑 [API Login Success] Member: "${memberName}" | Kampus: "${memberCampus}" | Target WA: ${targetWhatsAppId}`);

    // Format tanggal & waktu WIB
    const loginTime = new Date().toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "full",
      timeStyle: "medium"
    }) + " WIB";

    // Pesan notifikasi login eksklusif untuk member peminta
    const loginMessage = (req.body && (req.body.message || req.body.msg || req.body.text || req.body.pesan))
      ? (req.body.message || req.body.msg || req.body.text || req.body.pesan)
      : `☕ *KOPI MAHASISWA — NOTIFIKASI LOGIN AKUN* ☕\n\nHalo Kak *${memberName}*! Kamu berhasil login di Kopi Mahasiswa pada ${loginTime}. Selamat menikmati kopi favoritmu! ☕\n\n🎓 *Kampus:* ${memberCampus}\n📱 *Nomor:* ${cleanPhoneDigits}\n🆔 *ID Member:* ${memberIdCode}\n\n_Pemberitahuan ini dikirim otomatis demi keamanan akun Anda._`;

    // 6. Cek kesiapan sesi bot WhatsApp
    const isReady = isClientReady || (client && client.info && client.info.wid);
    if (!isReady || !client) {
      console.warn(`⚠️ [API Login] Sesi bot WhatsApp belum ready, pengiriman notifikasi ke ${targetWhatsAppId} ditunda.`);
      return res.status(200).json({
        status: "success",
        success: true,
        waSent: false,
        message: "Login berhasil! Notifikasi WA tertunda karena bot WhatsApp belum terhubung.",
        recipient: targetWhatsAppId,
        member: foundMember,
        previewMessage: loginMessage
      });
    }

    // 7. Pengiriman Eksklusif HANYA ke targetWhatsAppId peminta
    console.log(`🚀 [API Login] Mengirim pesan WA eksklusif ke: ${targetWhatsAppId}`);
    let sendResult = null;
    let sendError = null;
    try {
      sendResult = await client.sendMessage(targetWhatsAppId, loginMessage);
    } catch (sendErr) {
      // Jika frame Puppeteer sempat lepas/detached saat page re-render, coba retry sekali
      if (sendErr && (sendErr.message || "").includes("detached Frame")) {
        console.warn("⚠️ [WA Bot Retry] Puppeteer detached frame, mencoba mengirim ulang dalam 1 detik...");
        await new Promise(r => setTimeout(r, 1000));
        try {
          sendResult = await client.sendMessage(targetWhatsAppId, loginMessage);
        } catch (retryErr) {
          sendError = retryErr;
        }
      } else {
        sendError = sendErr;
      }
    }

    const elapsed = Date.now() - startTime;

    if (sendError) {
      console.error(`❌ [API Login Send WA Error] Gagal kirim ke ${targetWhatsAppId}:`, sendError.message);
      return res.status(200).json({
        status: "warning",
        success: true,
        waSent: false,
        waError: sendError.message || String(sendError),
        message: "Login member valid, namun pesan WhatsApp gagal dikirim: " + (sendError.message || String(sendError)),
        recipient: targetWhatsAppId,
        member: foundMember,
        elapsedMs: elapsed
      });
    }

    console.log(`✅ [Notif Login Success] Pesan berhasil dikirim eksklusif dalam ${elapsed}ms ke: ${targetWhatsAppId}`);
    console.log("=======================================================\n");

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
    console.error(`❌ [API Login Fatal Error]:`, err);
    return res.status(500).json({
      status: "error",
      success: false,
      message: "Terjadi kesalahan pada server saat memproses login.",
      error: err.message || String(err)
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
// 6c. REST API: AI CHAT — BACKEND RELAY (/api/ai-chat)
// Mendukung OpenRouter (Universal Multi-Model) & Gemini
// ===================================================
// Node built-in https (no extra dependency needed)
const https = require("https");

/**
 * Panggil AI via OpenRouter API (Universal Multi-Model)
 * Mendukung DeepSeek, Gemini 2.5 Flash, GPT-4o Mini, Llama 3.3, Mistral Small
 */
function callOpenRouterBackend(apiKey, model, systemPrompt, userMessage, chatHistory = [], maxTokens = 800) {
  const openRouterKey = apiKey || process.env.OPENROUTER_API_KEY || "..";
  const primaryModel = model || process.env.OPENROUTER_DEFAULT_MODEL || "google/gemini-2.5-flash";

  // Fallback models jika model utama mengalami kendala
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

  return new Promise(async (resolve, reject) => {
    let lastError = null;

    for (const curModel of candidateModels) {
      try {
        const payload = JSON.stringify({
          model: curModel,
          messages,
          max_tokens: maxTokens,
          temperature: 0.6
        });

        const reply = await new Promise((resInner, rejInner) => {
          const req = https.request({
            hostname: "openrouter.ai",
            path: "/api/v1/chat/completions",
            method: "POST",
            headers: {
              "Authorization": "Bearer " + openRouterKey,
              "HTTP-Referer": APP_URL || "https://kopi.test",
              "X-Title": "Kopi Mahasiswa",
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(payload)
            }
          }, (res) => {
            let data = "";
            res.on("data", chunk => { data += chunk; });
            res.on("end", () => {
              try {
                const parsed = JSON.parse(data);
                if (res.statusCode !== 200) {
                  return rejInner(new Error(`Model ${curModel} HTTP ${res.statusCode}: ${parsed.error?.message || data}`));
                }
                const text = parsed.choices?.[0]?.message?.content || "";
                resInner(text.trim());
              } catch (e) {
                rejInner(e);
              }
            });
          });

          req.on("error", rejInner);
          req.setTimeout(18000, () => {
            req.destroy(new Error(`OpenRouter timeout on ${curModel} (18s)`));
          });
          req.write(payload);
          req.end();
        });

        if (reply) {
          console.log(`✅ [OpenRouter] Model "${curModel}" berhasil merespons (${reply.length} char).`);
          return resolve({ reply, model: curModel });
        }
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ [OpenRouter Cascade] Model ${curModel} gagal: ${err.message} — mencoba model berikutnya...`);
      }
    }

    reject(lastError || new Error("Semua kandidat model OpenRouter gagal merespons."));
  });
}

/**
 * Fallback: relay ke Gemini REST API langsung
 */
function callGeminiBackend(apiKey, model, systemPrompt, userMessage, chatHistory = [], maxTokens = 800) {
  const candidateModels = Array.from(new Set([
    model,
    "gemini-3.5-flash-lite",
    "gemini-3.7-flash",
    "gemini-3.8-flash"
  ])).filter(Boolean);

  return new Promise(async (resolve, reject) => {
    const contents = [];
    const validHistory = (chatHistory || []).slice(-6);
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
          return resolve({ reply, model: curModel });
        }
      } catch (err) {
        lastError = err;
        console.warn(`⚠️ [API AI Chat Cascade] ${err.message} — mencoba kandidat model berikutnya...`);
      }
    }

    reject(lastError || new Error("Semua kandidat model Gemini gagal merespons."));
  });
}

// Helper: Mengambil riwayat pesanan member dari MySQL
async function getMemberOrderHistory(memberName) {
  if (!memberName || !dbPool) return [];
  try {
    const cleanName = memberName.trim();
    const [rows] = await dbPool.query(`
      SELECT p.kode_transaksi, p.total_omset, p.created_at, pd.nama_menu, pd.jumlah, pd.harga, pd.subtotal
      FROM pesanan p
      JOIN pesanan_detail pd ON p.id = pd.pesanan_id
      WHERE LOWER(p.nama_pelanggan) LIKE LOWER(?)
      ORDER BY p.id DESC
      LIMIT 25
    `, [`%${cleanName}%`]);

    const grouped = {};
    for (const r of rows) {
      if (!grouped[r.kode_transaksi]) {
        grouped[r.kode_transaksi] = {
          kode: r.kode_transaksi,
          total: r.total_omset,
          date: r.created_at,
          items: []
        };
      }
      grouped[r.kode_transaksi].items.push(`${r.nama_menu} (${r.jumlah}x)`);
    }

    return Object.values(grouped).slice(0, 5).map(tx => {
      return `${tx.kode}: ${tx.items.join(', ')} — Total: Rp ${Number(tx.total).toLocaleString('id-ID')}`;
    });
  } catch (err) {
    console.error("[MemberOrderHistory Error]", err.message);
    return [];
  }
}

// Endpoint konteks member aktif & riwayat pesanan (Customer Chatbot)
app.get("/api/member-context", async (req, res) => {
  try {
    const queryName = (req.query.name || "").trim();
    const queryPhone = (req.query.phone || "").replace(/\D/g, "");

    const members = getMembers();
    let member = null;

    if (queryPhone) {
      member = members.find(m => {
        const p = (m.cleanPhone || m.phone || "").replace(/\D/g, "");
        return p === queryPhone || p.endsWith(queryPhone) || queryPhone.endsWith(p);
      });
    }

    if (!member && queryName) {
      member = members.find(m => (m.name || "").toLowerCase() === queryName.toLowerCase())
        || members.find(m => (m.name || "").toLowerCase().includes(queryName.toLowerCase()));
    }

    const memberName = member ? member.name : queryName;
    const history = memberName ? await getMemberOrderHistory(memberName) : [];

    res.json({
      success: true,
      member: member || (queryName ? { name: queryName } : null),
      recentOrders: history
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Endpoint status & ringkasan analitik real-time
app.get("/api/analytics-summary", async (req, res) => {
  try {
    const metrics = await getTransactionMetricsFromDB();
    const menuList = await getMenuFromDB();
    const members = getMembers();

    // Stok kritis & habis
    const outOfStock = menuList.filter(m => Number(m.stok || 0) <= 0).map(m => m.nama_menu);
    const lowStock = menuList.filter(m => Number(m.stok || 0) > 0 && Number(m.stok || 0) <= 3).map(m => `${m.nama_menu} (${m.stok})`);

    return res.json({
      status: "success",
      success: true,
      totalOrders: metrics.totalOrders,
      totalRevenue: metrics.totalRevenue,
      avgOrder: metrics.avgOrder,
      topItems: metrics.topItems,
      topItemsArr: metrics.topItemsArr || [],
      totalMembers: members.length,
      menuCount: menuList.length,
      outOfStock,
      lowStock
    });
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
});

app.post("/api/ai-chat", async (req, res) => {
  try {
    const { message, chatHistory = [], apiKey, model, role = "admin" } = req.body || {};

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, error: "Parameter 'message' wajib diisi." });
    }

    const trimmedMsg = message.trim();
    const lowerMsg = trimmedMsg.toLowerCase();

    // === 1. Baca members.json REAL-TIME ===
    const members = getMembers();
    const memberCount = members.length;
    const memberDetails = members.map((m, i) => `${i + 1}. ${m.name || "Member"} — Kampus: ${m.campus || "-"}`).join("\n");
    const memberListFormatted = members.map((m, i) => {
      const name = (m.name || "Member").trim();
      const campus = (m.campus || "-").trim();
      return `${i + 1}. **${name}** — Kampus: ${campus}`;
    }).join("\n");

    // === 2. Baca data menu langsung dari MySQL REAL-TIME ===
    const menuList = await getMenuFromDB();
    const menuContext = formatMenuContext(menuList);

    // === 3. Baca data transaksi & omset real-time (MySQL + Fallback Body) ===
    const dbMetrics = await getTransactionMetricsFromDB();
    const reqTx = req.body.transactionSummary || null;
    const totalOrders = (dbMetrics && dbMetrics.totalOrders > 0)
      ? dbMetrics.totalOrders
      : (reqTx && reqTx.total ? reqTx.total : 0);
    const totalRevenue = (dbMetrics && dbMetrics.totalRevenue > 0)
      ? dbMetrics.totalRevenue
      : (reqTx && reqTx.revenue ? reqTx.revenue : 0);
    const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const formatRp = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

    // Ambil rincian transaksi terbaru untuk context AI Admin
    const recentTxDetails = (role !== "customer") ? await getRecentTransactionDetails() : "";

    // === ATURAN CEPAT / DETERMINISTIK UNTUK CUSTOMER (MEMBER) ===
    if (role === "customer") {
      const activeMember = req.body.member || req.body.memberData || {};
      const memberName = activeMember.name || req.body.name || "";
      const memberPhone = activeMember.phone || activeMember.cleanPhone || req.body.phone || "";
      const memberCampus = activeMember.campus || "";
      const memberPoints = activeMember.points || activeMember.totalPoints || 100;

      // Ambil riwayat pesanan member dari MySQL
      let recentOrders = [];
      if (memberName) {
        recentOrders = await getMemberOrderHistory(memberName);
      }

      // Fast response: siapa saya / siapa gw / siapa aku / nama saya
      if (/\b(siapa\s*(gw|gue|aku|saya)|nama\s*(saya|aku|gue|gw)\s*(siapa|apa)|(gw|gue|aku|saya)\s*siapa)\b/i.test(lowerMsg)) {
        if (memberName) {
          return res.json({
            success: true,
            reply: `Lu adalah **${memberName}**! 🎓 Member setia Kopi Mahasiswa${memberCampus ? ' dari ' + memberCampus : ''}. Seneng banget bisa nemenin lu nongkrong dan nugas, Bestie! ☕✨`
          });
        }
      }

      // Fast response: poin
      if (/\b(poin|point|reward)\b/i.test(lowerMsg) && /\b(berapa|cek|lihat|total|saya|aku|gw|gue)\b/i.test(lowerMsg)) {
        return res.json({
          success: true,
          reply: `Hai **${memberName || 'Bestie'}**! Poin reward kamu saat ini adalah **${memberPoints} Poin** (Status: Member Aktif Diskon 10% di setiap transaksi) ☕🎉`
        });
      }

      // Fast response: riwayat pesanan
      if ((/\b(kemarin|riwayat|sebelumnya|terakhir)\b/i.test(lowerMsg) && /\b(pesan|order|beli|pesanan)\b/i.test(lowerMsg)) || /\b(pesan|beli)\s+apa\b/i.test(lowerMsg)) {
        if (recentOrders && recentOrders.length > 0) {
          return res.json({
            success: true,
            reply: `Ini riwayat pesanan terakhir lu, Bestie **${memberName}**! ☕\n\n${recentOrders.map(o => `• ${o}`).join('\n')}\n\nMau repeat order yang mana nih biar nugas makin gas? 🔥`
          });
        } else if (memberName) {
          return res.json({
            success: true,
            reply: `Halo Bestie **${memberName}**, belum ada catatan pesanan atas nama lu nih. Yuk langsung pilih menu favorit lu di atas buat pesanan pertama! ☕✨`
          });
        }
      }
    }

    // === ATURAN CEPAT / DETERMINISTIK UNTUK ADMIN & OWNER ===
    const activeRole = req.body.userRole || (role === "owner" ? "Owner" : "Admin");
    const activeUserName = req.body.userName || (activeRole === "Owner" ? "Owner Kopi Mahasiswa" : "Fathialaziz (Admin)");
    const activePeriod = req.body.activePeriod || "Semua Waktu";
    const recapData = req.body.recap || {};

    if (role !== "customer") {
      // 1. Role Aktif & Identitas Admin/Owner (Siapa saya / apa role saya)
      if ((/\b(role|peran|level|hak\s*akses)\b/i.test(lowerMsg) && /\b(saya|aku|login|aktif|saat\s*ini|sekarang|apa|siapa|cek|status)\b/i.test(lowerMsg)) ||
        /\b(siapa\s+(saya|aku|admin|owner)|identitas\s+(saya|aku|admin|owner)|(saya|aku)\s+siapa|status\s+login)\b/i.test(lowerMsg)) {
        console.log(`🤖 [API AI Chat] Deteksi pertanyaan role aktif -> "${activeRole} (${activeUserName})"`);
        return res.json({
          success: true,
          reply: `Role aktif yang sedang login saat ini adalah **${activeRole}** (${activeUserName}).\n\nHak akses: ${activeRole === 'Owner' ? 'Akses laporan eksekutif, analitik finansial, omset, dan evaluasi performa bisnis.' : 'Akses panel operasional harian kasir/POS, pengelolaan menu, kontrol stok, dan monitoring member.'}`,
          memberCount,
          metrics: { totalOrders, totalRevenue, avgOrder }
        });
      }

      // 2. Total Transaksi & Omset Periode Aktif
      if (/\b(total|jumlah|berapa|rekap)\s*(transaksi|pesanan|order)\b/i.test(lowerMsg) ||
        /\b(total|berapa)\s*(omset|pendapatan|penjualan|revenue)\b/i.test(lowerMsg) ||
        /\b(transaksi|penjualan|omset)\s*(periode|saat\s*ini|hari\s*ini|semua|aktif)\b/i.test(lowerMsg) ||
        /^(total\s*transaksi|total\s*omset|laporan\s*penjualan|ringkasan\s*penjualan)$/i.test(lowerMsg.trim())) {
        console.log(`🤖 [API AI Chat] Deteksi pertanyaan total transaksi & omset -> Periode ${activePeriod}`);
        return res.json({
          success: true,
          reply: `Berikut rekapitulasi data transaksi untuk **Periode ${activePeriod}**:\n\n• Total Transaksi: **${totalOrders} pesanan**\n• Total Omset / Pendapatan: **${formatRp(totalRevenue)}**\n• Rata-rata Nilai Pesanan (AOV): **${formatRp(avgOrder)}**\n\nSeluruh data transaksi tercatat akurat dan tersinkronisasi di sistem Kopi Mahasiswa.`,
          memberCount,
          metrics: { totalOrders, totalRevenue, avgOrder }
        });
      }

      // 3. Siapa Saja Nama Pembeli & Rincian Pesanannya
      if ((/\b(pembeli|pemesan|pelanggan|konsumen|customer|nama\s*pemesan|nama\s*pembeli|yang\s*pesan|yang\s*beli)\b/i.test(lowerMsg) &&
        /\b(siapa|daftar|list|nama|pesanan|pesanannya|item|order|rincian|semua|detail|siapa\s*aja|siapa\s*saja|apa\s*saja|apa\s*aja)\b/i.test(lowerMsg)) ||
        /\b(siapa\s*(saja|aja)\s*yang\s*(pesan|beli|order))\b/i.test(lowerMsg) ||
        /^(daftar\s*pembeli|daftar\s*pemesan|data\s*pembeli|siapa\s*yang\s*pesan)$/i.test(lowerMsg.trim())) {
        console.log(`🤖 [API AI Chat] Deteksi pertanyaan rincian pembeli & pesanan`);
        const buyersText = recapData.buyersListText || recentTxDetails || "Belum ada rincian transaksi tersedia.";
        return res.json({
          success: true,
          reply: `Berikut daftar seluruh pembeli dan rincian pesanannya (**Periode ${activePeriod}** — Total **${totalOrders} pesanan**):\n\n${buyersText}`,
          memberCount,
          metrics: { totalOrders, totalRevenue, avgOrder }
        });
      }

      // 4. Rekap Menu Terlaris
      if ((/\b(menu|produk|makanan|minuman)\b/i.test(lowerMsg) && /\b(terlaris|paling\s*laris|paling\s*laku|favorit|top|bestseller|best\s*seller|unggulan|paling\s*banyak)\b/i.test(lowerMsg)) ||
        /\b(terlaris|paling\s*laris|best\s*seller|bestseller)\b/i.test(lowerMsg) ||
        /^(menu\s*terlaris|produk\s*terlaris|top\s*seller|bestseller)$/i.test(lowerMsg.trim())) {
        console.log(`🤖 [API AI Chat] Deteksi pertanyaan menu terlaris`);
        const topText = recapData.topSellingMenuText || (dbMetrics.topItemsArr && dbMetrics.topItemsArr.length > 0
          ? dbMetrics.topItemsArr.slice(0, 5).map((r, i) => `${i + 1}. **${r.nama}**: ${r.terjual} porsi terjual (Rp ${Number(r.pendapatan || 0).toLocaleString("id-ID")})`).join("\n")
          : "Data menu terlaris belum tersedia.");
        return res.json({
          success: true,
          reply: `Berikut rekapitulasi **Menu Terlaris** berdasarkan kuantitas pesanan (**Periode ${activePeriod}**):\n\n${topText}`,
          memberCount,
          metrics: { totalOrders, totalRevenue, avgOrder }
        });
      }

      // 5. Daftar Member Terdaftar
      const isMemberQuery = (
        /\b(member|anggota)\b/i.test(lowerMsg) &&
        (/(siapa|daftar|list|data|nama|semua|seluruh|cek|tampilkan|berapa|total|info|lihat|sebutkan|detail|lengkap|siapa\s*aja|siapa\s*saja|ada\s*siapa)/i.test(lowerMsg) ||
          /^(member|members|data\s*member|daftar\s*member)$/i.test(lowerMsg.trim()))
      );

      if (isMemberQuery) {
        console.log(`🤖 [API AI Chat] Deteksi pertanyaan data member -> Mengirim SELURUH ${memberCount} member lengkap`);
        if (memberCount === 0) {
          return res.json({
            success: true,
            reply: "Saat ini belum ada member yang terdaftar dalam sistem.",
            memberCount: 0,
            metrics: { totalOrders, totalRevenue, avgOrder }
          });
        }
        return res.json({
          success: true,
          reply: `Total terdaftar: **${memberCount} member**\n\n${memberListFormatted}`,
          memberCount,
          metrics: { totalOrders, totalRevenue, avgOrder }
        });
      }
    }

    // === 4. Bangun System Prompt (Sesuai Role: Admin Serius atau Customer Gen Z) ===
    const activeModel = model || OPENROUTER_DEFAULT_MODEL;
    let systemPrompt = "";

    if (role === "customer") {
      const activeMember = req.body.member || req.body.memberData || {};
      const memberName = activeMember.name || req.body.name || "";
      const memberPhone = activeMember.phone || activeMember.cleanPhone || req.body.phone || "";
      const memberCampus = activeMember.campus || "";
      const memberPoints = activeMember.points || activeMember.totalPoints || 100;

      let recentOrders = [];
      if (memberName) {
        recentOrders = await getMemberOrderHistory(memberName);
      }

      const memberOrderHistoryText = (recentOrders && recentOrders.length > 0)
        ? recentOrders.map(o => `- ${o}`).join("\n")
        : "Belum ada catatan pesanan sebelumnya.";

      const memberInstruction = memberName
        ? `Saat ini kamu sedang berbicara dengan member bernama ${memberName} (No. WA: ${memberPhone || "-"}, Kampus: ${memberCampus || "-"}, Poin: ${memberPoints} Poin, Riwayat Pesanan Terakhir:\n${memberOrderHistoryText}). Panggil dia dengan namanya secara ramah dan akrab.`
        : `Saat ini kamu sedang berbicara dengan pelanggan. Panggil dengan sebutan "Bestie".`;

      // Prompt Customer (Gen Z)
      systemPrompt = `Kamu adalah "KopiAI Customer Service", asisten virtual dan barista gaul resmi kedai Kopi Mahasiswa.
Gaya bicaramu asik, santai, super ramah, dan gaul khas Gen Z (gunakan sapaan "lu-gue", "Bestie", "chill", "spill", "gaskeun").
JANGAN gunakan bahasa kaku/formal seperti "Anda". Jawab dengan 2-4 kalimat tuntas tanpa kepotong.

${memberInstruction}

${menuContext}
Fasilitas: WiFi kenceng, colokan tiap meja, buka 08.00-23.00 WIB di Jl. Kampus Merdeka No. 45.`;
    } else {
      // Prompt Admin (Serius, To The Point, Profesional) + Full Data Context
      const richMenuCtx = formatMenuContextRich(menuList);
      const topItemsCtx = dbMetrics.topItemsArr && dbMetrics.topItemsArr.length > 0
        ? dbMetrics.topItemsArr.slice(0, 5).map((r, i) => {
          const pendStr = r.pendapatan > 0 ? ` (Rp ${r.pendapatan.toLocaleString("id-ID")})` : "";
          return `  ${i + 1}. ${r.nama}: ${r.terjual} porsi${pendStr}`;
        }).join("\n")
        : "  Data top-selling belum tersedia.";

      const stockSummary = (() => {
        const habis = menuList.filter(m => Number(m.stok || 0) <= 0);
        const kritis = menuList.filter(m => Number(m.stok || 0) > 0 && Number(m.stok || 0) <= 3);
        let s = `  Total: ${menuList.length} produk`;
        if (habis.length > 0) s += `\n  HABIS: ${habis.map(m => m.nama_menu).join(", ")}`;
        if (kritis.length > 0) s += `\n  KRITIS: ${kritis.map(m => `${m.nama_menu} (${m.stok})`).join(", ")}`;
        if (habis.length === 0 && kritis.length === 0) s += "\n  Semua produk stok aman.";
        return s;
      })();

      systemPrompt = `Kamu adalah "KopiAI Admin" — asisten AI internal khusus Admin & Owner Kedai Kopi Mahasiswa.

ATURAN KOMUNIKASI & KARAKTER JAWABAN (WAJIB DIPATUHI):
- Gaya bahasa: Serius, to the point, profesional, singkat, padat, dan lugas.
- DILARANG menggunakan gaya bahasa gaul, santai, atau istilah Gen Z. Gunakan bahasa Indonesia formal dan lugas.
- IDENTITAS & ROLE PENGGUNA: Lawan bicara Anda memiliki Role aktif: **${activeRole}** (Akun: ${activeUserName}).
  * Jika user bertanya mengenai role atau status loginnya, jawab secara tegas bahwa role-nya adalah **${activeRole}**.
- DATA MEMBER: Sebutkan SELURUH ${memberCount} member secara lengkap tanpa memotong data.
- DATA OMSET: Total omset aktif ${formatRp(totalRevenue)} dari ${totalOrders} transaksi (Periode: ${activePeriod}). BUKAN Rp 0.
- Jawaban harus selesai tuntas tanpa kalimat terpotong.

=== STRUKTUR PERAN SISTEM (ROLES) ===
Sistem Kopi Mahasiswa memiliki 3 tingkat peran (Role) utama:
1. Member (Pelanggan/Mahasiswa): Akses ke katalog menu, diskon khusus member 10%, pengumpulan poin, riwayat pesanan pribadi, dan bantuan KopiAI Live.
2. Admin: Akses ke panel operasional harian, manajemen produk, stok, dan pencatatan transaksi.
3. Owner (Pemilik Usaha): Akses penuh untuk memantau laporan keuangan, analisis performa bisnis, dan pengaturan tingkat tinggi.
Jika Admin atau Owner bertanya mengenai jumlah role, hak akses, atau perbedaannya, jelaskan dengan profesional berdasarkan data di atas.

${richMenuCtx}

=== DATA TRANSAKSI & PENJUALAN (${activePeriod}) ===
- Total Omset: ${formatRp(totalRevenue)}
- Total Pesanan: ${totalOrders} transaksi
- Rata-rata Pesanan (AOV): ${formatRp(avgOrder)}

=== REKAP MENU TERLARIS (${activePeriod}) ===
${recapData.topSellingMenuText || topItemsCtx}

=== STATUS STOK ===
${stockSummary}

=== DATA SELURUH MEMBER (members.json — ${memberCount} ORANG) ===
${memberDetails || "Belum ada member terdaftar."}
- Benefit member: Diskon 10% per transaksi.

=== RINCIAN SELURUH TRANSAKSI & PEMBELI (${activePeriod}) ===
${recapData.buyersListText || recentTxDetails}

Fokus: Operasional kedai, data stok, laporan penjualan, dan manajemen member.`;
    }

    console.log(`🤖 [API AI Chat] Pesan: "${trimmedMsg.slice(0, 60)}..." | Role: ${role} | Model: ${activeModel}`);

    // === 5. Panggil Provider AI yang dipilih (OpenRouter / Gemini) ===
    let result = null;
    const chosenProvider = (req.body.provider || "").toLowerCase();

    if (chosenProvider === "gemini" || (model && model.startsWith("gemini:"))) {
      const cleanModel = (model || "").replace(/^gemini:/, "") || "gemini-3.5-flash-lite";
      const geminiKey = (apiKey && !apiKey.startsWith("...")) ? apiKey : (process.env.GEMINI_API_KEY || "..");
      console.log(`🔷 [API AI Chat] Routing ke Google Gemini Direct API [${cleanModel}]`);
      try {
        result = await callGeminiBackend(
          geminiKey,
          cleanModel,
          systemPrompt,
          trimmedMsg,
          chatHistory,
          800
        );
      } catch (gemErr) {
        console.warn("⚠️ [API AI Chat] Gemini direct gagal, mencoba OpenRouter fallback:", gemErr.message);
        result = await callOpenRouterBackend(
          null,
          "google/gemini-2.5-flash",
          systemPrompt,
          trimmedMsg,
          chatHistory,
          800
        );
      }
    } else {
      // Default: OpenRouter Universal Multi-Model
      console.log(`🌐 [API AI Chat] Routing ke OpenRouter Multi-Model API [${activeModel}]`);
      try {
        result = await callOpenRouterBackend(
          apiKey,
          activeModel,
          systemPrompt,
          trimmedMsg,
          chatHistory,
          800
        );
      } catch (orErr) {
        console.warn("⚠️ [API AI Chat] OpenRouter gagal, mencoba Gemini direct fallback:", orErr.message);
        const geminiKey = process.env.GEMINI_API_KEY || "AQ.Ab8RN6IzlWQYQYgs1Nn6fJiroApOilTNf1wgSCSwzLbdr7upmw";
        result = await callGeminiBackend(
          geminiKey,
          "gemini-3.5-flash-lite",
          systemPrompt,
          trimmedMsg,
          chatHistory,
          800
        );
      }
    }

    if (!result || !result.reply) {
      return res.status(502).json({ success: false, error: "AI tidak memberikan respons. Coba lagi." });
    }

    console.log(`✅ [API AI Chat] Balasan (${result.reply.length} char) terkirim via [${result.model}].`);
    return res.json({
      success: true,
      reply: result.reply,
      modelUsed: result.model,
      memberCount,
      menuCount: menuList.length,
      metrics: { totalOrders, totalRevenue, avgOrder }
    });

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
