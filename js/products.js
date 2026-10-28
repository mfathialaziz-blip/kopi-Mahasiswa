/**
 * KOPI MAHASISWA — Product Catalog Dataset & Image Mapping
 * Daftar gambar menu resmi lokal terstandarisasi untuk seluruh menu kafe.
 */

// Pemetaan gambar resmi terverifikasi — Sesuai System Instruction Pemetaan Menu Visual
const menuImages = {
  // ☕ COFFEE SERIES
  "Kopi Susu Mahasiswa": "https://i.pinimg.com/736x/e0/2d/01/e02d0124461097bf06ec219eb51d5c69.jpg",
  "Kopi Susu Mahasiswa (Gula Aren)": "https://i.pinimg.com/736x/e0/2d/01/e02d0124461097bf06ec219eb51d5c69.jpg",
  "Americano / Kopi Hitam": "https://i.pinimg.com/736x/0e/52/30/0e52308b27b6b9ea83aa371c0b01a5a8.jpg",
  "Cappuccino": "https://i.pinimg.com/1200x/bc/d2/0a/bcd20ada9e61be0077f08b4be21a4242.jpg",
  "Caramel Macchiato": "https://i.pinimg.com/736x/3a/74/db/3a74db74d7ce5a4683e6f3a2f5dc6462.jpg",
  "Espresso Single": "https://i.pinimg.com/1200x/e8/8c/96/e88c963b93c4ee2f3481b3576e2c9395.jpg",
  "Caffe Latte": "https://i.pinimg.com/736x/6b/4d/ca/6b4dcad544eec6fb886abf03514a7cc0.jpg",
  "Mocha Deadline": "https://i.pinimg.com/736x/b7/38/53/b7385352694908aa56d7a4405404eb89.jpg",

  // 🥛 NON-COFFEE
  "Matcha Latte": "https://i.pinimg.com/736x/16/6b/d0/166bd08582b84f62ec20ba9aa2110d3c.jpg",
  "Chocolate / Cokelat": "https://i.pinimg.com/736x/c2/77/7f/c2777f71cb0e13b28a413113fce481a0.jpg",
  "Thai Tea Seger": "https://i.pinimg.com/736x/d0/df/ce/d0dfce1ba2625e47d77bfec7930609b8.jpg",
  "Fresh Lemon Tea": "https://i.pinimg.com/1200x/a2/e6/34/a2e634d3e685e263ed681fdbbd8fce9f.jpg",
  "Taro Latte Creamy": "https://i.pinimg.com/736x/08/f1/da/08f1da3145406ef23701a7383f149ecf.jpg",

  // 🥐 SNACK & PASTRIES
  "Pisang Coklat (Piscok)": "https://i.pinimg.com/1200x/a7/51/a1/a751a10a1b3fd8d3fb308a03453d1df9.jpg",
  "Kentang Goreng": "https://i.pinimg.com/736x/66/9a/58/669a5862c19c0bd6e442ebca1c7d89a7.jpg",
  "Roti Bakar": "https://i.pinimg.com/1200x/94/90/37/949037d9e892a69787585d8e1b70ce9a.jpg",
  "Dimsum Ayam": "https://i.pinimg.com/1200x/70/8b/75/708b7548e688948cacbc14339a4a820c.jpg",
  "Mie Dok-Dok Nugas": "https://i.pinimg.com/736x/6c/9c/fb/6c9cfbda40f0d15572fb59e4ad30965e.jpg",
  "Donat Kampus Glazed": "https://i.pinimg.com/1200x/47/eb/49/47eb4964e3d315ff758175b3274e5c74.jpg",
  "Choco Chip Cookies": "https://i.pinimg.com/736x/b1/60/b5/b160b5a47f607efd3ef055f29b4a22ed.jpg",
  "Butter Croissant": "https://i.pinimg.com/736x/30/98/b3/3098b37993867ed5b37bd686d463ca4b.jpg"
};

// URL publik default kosong/null jika menu tidak memiliki link gambar resmi
const DEFAULT_IMAGE = "";

/**
 * Helper resolusi gambar otomatis berdasarkan nama menu atau kata kunci
 * Menggunakan URL gambar resmi terverifikasi
 */
function getMenuImage(name) {
  if (!name) return "";
  const clean = name.trim();
  if (menuImages[clean]) return menuImages[clean];

  const lower = clean.toLowerCase();
  for (const [key, url] of Object.entries(menuImages)) {
    if (key.toLowerCase() === lower) return url;
  }

  // 1. Makanan & Camilan spesifik
  if (lower.includes("pisang") || lower.includes("piscok")) return menuImages["Pisang Coklat (Piscok)"];
  if (lower.includes("kentang")) return menuImages["Kentang Goreng"];
  if (lower.includes("roti")) return menuImages["Roti Bakar"];
  if (lower.includes("dimsum")) return menuImages["Dimsum Ayam"];
  if (lower.includes("mie") || lower.includes("dokdok") || lower.includes("dok-dok")) return menuImages["Mie Dok-Dok Nugas"];
  if (lower.includes("donat")) return menuImages["Donat Kampus Glazed"];
  if (lower.includes("cookie") || lower.includes("cookies")) return menuImages["Choco Chip Cookies"];
  if (lower.includes("croissant")) return menuImages["Butter Croissant"];

  // 2. Minuman non-kopi spesifik
  if (lower.includes("matcha")) return menuImages["Matcha Latte"];
  if (lower.includes("chocolate") || lower.includes("cokelat") || lower.includes("coklat")) return menuImages["Chocolate / Cokelat"];
  if (lower.includes("thai tea") || lower.includes("thai")) return menuImages["Thai Tea Seger"];
  if (lower.includes("lemon")) return menuImages["Fresh Lemon Tea"];
  if (lower.includes("taro")) return menuImages["Taro Latte Creamy"];

  // 3. Minuman kopi spesifik
  if (lower.includes("susu") || lower.includes("aren")) return menuImages["Kopi Susu Mahasiswa"];
  if (lower.includes("americano") || lower.includes("hitam")) return menuImages["Americano / Kopi Hitam"];
  if (lower.includes("cappuccino")) return menuImages["Cappuccino"];
  if (lower.includes("caramel") || lower.includes("macchiato")) return menuImages["Caramel Macchiato"];
  if (lower.includes("espresso")) return menuImages["Espresso Single"];
  if (lower.includes("caffe latte") || lower.includes("cafe latte") || lower.includes("latte")) return menuImages["Caffe Latte"];
  if (lower.includes("mocha")) return menuImages["Mocha Deadline"];

  return "";
}

const INITIAL_PRODUCTS_DATA = [
  // ==================== MINUMAN KOPI ====================
  {
    id: "kopi-susu",
    name: "Kopi Susu Mahasiswa",
    category: "kopi",
    categoryLabel: "Kopi",
    price: 15000,
    stock: 20,
    active: true,
    rating: 4.9,
    reviews: 182,
    badge: "Best Seller 🔥",
    description: "Espresso robusta-arabica blend dipadu susu creamy dan gula aren organik. Teman setia kuliah!",
    image: menuImages["Kopi Susu Mahasiswa"] || "",
    tags: ["Es", "Aren", "Manis"]
  },
  {
    id: "americano",
    name: "Americano / Kopi Hitam",
    category: "kopi",
    categoryLabel: "Kopi",
    price: 12000,
    stock: 15,
    active: true,
    rating: 4.8,
    reviews: 94,
    badge: "Extra Strong ⚡",
    description: "Double shot espresso dengan air mineral dingin/hangat. Dijamin melek ngerjain revisi skripsi.",
    image: menuImages["Americano / Kopi Hitam"] || "",
    tags: ["No Sugar", "Strong", "Pilihan Hangat/Dingin"]
  },
  {
    id: "cappuccino",
    name: "Cappuccino",
    category: "kopi",
    categoryLabel: "Kopi",
    price: 18000,
    stock: 12,
    active: true,
    rating: 4.8,
    reviews: 76,
    badge: "Favorit ☕",
    description: "Espresso mantap dengan foam susu tebal dan taburan cocoa powder aromatik.",
    image: menuImages["Cappuccino"],
    tags: ["Foamy", "Bold", "Latte Art"]
  },
  {
    id: "cafe-latte",
    name: "Caffe Latte",
    category: "kopi",
    categoryLabel: "Kopi",
    price: 18000,
    stock: 14,
    active: true,
    rating: 4.7,
    reviews: 65,
    badge: "Smooth ✨",
    description: "Paduan seimbang espresso dan steamed milk yang halus. Pas dinikmati sambil diskusi kelompok.",
    image: menuImages["Caffe Latte"],
    tags: ["Milky", "Smooth", "Latte Art"]
  },
  {
    id: "espresso-single",
    name: "Espresso Single",
    category: "kopi",
    categoryLabel: "Kopi",
    price: 10000,
    stock: 18,
    active: true,
    rating: 4.8,
    reviews: 52,
    badge: "Pure Shot ⚡",
    description: "Single shot ekstrak biji kopi pilihan dengan crema tebal keemasan dan aroma intens.",
    image: menuImages["Espresso Single"] || "",
    tags: ["Pure", "Crema", "Bold"]
  },
  {
    id: "caramel-macchiato",
    name: "Caramel Macchiato",
    category: "kopi",
    categoryLabel: "Kopi",
    price: 20000,
    stock: 12,
    active: true,
    rating: 4.9,
    reviews: 88,
    badge: "Signature ✨",
    description: "Layer steamed milk vanila, espresso mantap, dengan siraman saus karamel manis legit di atasnya.",
    image: menuImages["Caramel Macchiato"] || "",
    tags: ["Sweet Caramel", "Creamy", "Aesthetic"]
  },
  {
    id: "mocha",
    name: "Mocha Deadline",
    category: "kopi",
    categoryLabel: "Kopi",
    price: 20000,
    stock: 10,
    active: true,
    rating: 4.9,
    reviews: 110,
    badge: "Energy Booster 🍫",
    description: "Perpaduan kopi espresso pekat dan dark chocolate Belgia, manis legit penambah semangat nugas.",
    image: menuImages["Mocha Deadline"],
    tags: ["Choco Coffee", "Rich", "Sweet"]
  },

  // ==================== MINUMAN NON-KOPI ====================
  {
    id: "matcha-latte",
    name: "Matcha Latte",
    category: "non-kopi",
    categoryLabel: "Non-Kopi",
    price: 18000,
    stock: 12,
    active: true,
    rating: 4.9,
    reviews: 134,
    badge: "Top Choice 🍃",
    description: "Matcha Uji Jepang asli dengan susu creamy. Rasa earthy autentik yang menenangkan.",
    image: menuImages["Matcha Latte"],
    tags: ["Authentic Matcha", "Creamy", "Anti-Stress"]
  },
  {
    id: "chocolate",
    name: "Chocolate / Cokelat",
    category: "non-kopi",
    categoryLabel: "Non-Kopi",
    price: 16000,
    stock: 16,
    active: true,
    rating: 4.8,
    reviews: 142,
    badge: "Mood Booster 🍫",
    description: "Cokelat murni premium dipadukan susu segar dingin/panas, legit dan melegakan pikiran.",
    image: menuImages["Chocolate / Cokelat"],
    tags: ["Pure Cocoa", "Creamy", "Kids Friendly"]
  },
  {
    id: "thai-tea",
    name: "Thai Tea Seger",
    category: "non-kopi",
    categoryLabel: "Non-Kopi",
    price: 12000,
    stock: 16,
    active: true,
    rating: 4.8,
    reviews: 95,
    badge: "Favorit Nugas 🧋",
    description: "Racikan teh rempah khas Thailand berpadu susu kental manis gurih disajikan dingin menyegarkan.",
    image: menuImages["Thai Tea Seger"],
    tags: ["Sweet", "Creamy Tea", "Dingin Segar"]
  },
  {
    id: "lemon-tea",
    name: "Fresh Lemon Tea",
    category: "non-kopi",
    categoryLabel: "Non-Kopi",
    price: 10000,
    stock: 18,
    active: true,
    rating: 4.7,
    reviews: 89,
    badge: "Segar 🍋",
    description: "Seduhan teh pilihan dengan perasan lemon asli. Dingin, asam segar, langsung balikin fokus.",
    image: menuImages["Fresh Lemon Tea"],
    tags: ["Citrus Fresh", "Dingin", "Hemat"]
  },
  {
    id: "taro-latte",
    name: "Taro Latte Creamy",
    category: "non-kopi",
    categoryLabel: "Non-Kopi",
    price: 16000,
    stock: 8,
    active: true,
    rating: 4.7,
    reviews: 58,
    badge: "Unik 🍠",
    description: "Rasa taro manis wangi dengan warna ungu estetik dan kelembutan susu murni.",
    image: menuImages["Taro Latte Creamy"],
    tags: ["Sweet Taro", "Estetik", "Milky"]
  },

  // ==================== MAKANAN & CAMILAN ====================
  {
    id: "pisang-coklat",
    name: "Pisang Coklat (Piscok)",
    category: "makanan",
    categoryLabel: "Makanan",
    price: 12000,
    stock: 10,
    active: true,
    rating: 4.8,
    reviews: 92,
    badge: "Crispy Lumer 🍌",
    description: "Kulit lumpia renyah membungkus pisang manis dan lelehan dark chocolate nikmat.",
    image: menuImages["Pisang Coklat (Piscok)"],
    tags: ["Piscok", "Crispy", "Sweet"]
  },
  {
    id: "kentang-goreng",
    name: "Kentang Goreng",
    category: "makanan",
    categoryLabel: "Makanan",
    price: 12000,
    stock: 14,
    active: true,
    rating: 4.8,
    reviews: 168,
    badge: "Best Snack 🍟",
    description: "French fries garing gurih disajikan dengan saus sambal cocolan dan taburan bumbu rahasia.",
    image: menuImages["Kentang Goreng"],
    tags: ["Crispy", "Saus Sambal", "Sharing"]
  },
  {
    id: "roti-bakar",
    name: "Roti Bakar",
    category: "makanan",
    categoryLabel: "Makanan",
    price: 14000,
    stock: 15,
    active: true,
    rating: 4.9,
    reviews: 215,
    badge: "Ngemil Kenyang 🍞",
    description: "Roti bakar tebal renyah di luar, bertabur keju cheddar melimpah dan lumeran coklat manis.",
    image: menuImages["Roti Bakar"],
    tags: ["Crispy", "Cheesy", "Porsi Pas"]
  },
  {
    id: "dimsum-ayam",
    name: "Dimsum Ayam",
    category: "makanan",
    categoryLabel: "Makanan",
    price: 15000,
    stock: 12,
    active: true,
    rating: 4.9,
    reviews: 104,
    badge: "Gurih Hangat 🥟",
    description: "Dimsum olahan daging ayam segar dibalut kulit tipis lembut, disajikan hangat dengan chili oil gurih.",
    image: menuImages["Dimsum Ayam"],
    tags: ["Chili Oil", "Daging Ayam", "Hangat"]
  },
  {
    id: "mie-dokdok",
    name: "Mie Dok-Dok Nugas",
    category: "makanan",
    categoryLabel: "Makanan",
    price: 15000,
    stock: 10,
    active: true,
    rating: 4.9,
    reviews: 198,
    badge: "Spesial Malam 🍜",
    description: "Mie kuah kental gurih khas warkop modern berpadu telur kocok, sayuran segar, dan cabai rawit.",
    image: menuImages["Mie Dok-Dok Nugas"],
    tags: ["Hangat", "Pedas Gurih", "Telur"]
  },

  // ==================== SNACK & PASTRY ====================
  {
    id: "donat-kampus",
    name: "Donat Kampus Glazed",
    category: "snack",
    categoryLabel: "Snack",
    price: 8000,
    stock: 12,
    active: true,
    rating: 4.7,
    reviews: 114,
    badge: "Harga Mahasiswa 🍩",
    description: "Donat kentang super empuk dengan topping cokelat leleh dan taburan meses warna-warni.",
    image: menuImages["Donat Kampus Glazed"],
    tags: ["Soft", "Sweet", "Camilan Ringan"]
  },
  {
    id: "cookies",
    name: "Choco Chip Cookies",
    category: "snack",
    categoryLabel: "Snack",
    price: 10000,
    stock: 15,
    active: true,
    rating: 4.8,
    reviews: 87,
    badge: "Crunchy 🍪",
    description: "Kue kering renyah harum mentega dengan limpahan dark choco chunks lezat.",
    image: menuImages["Choco Chip Cookies"],
    tags: ["Butter", "Choco Chunks", "Fresh Bake"]
  },
  {
    id: "croissant",
    name: "Butter Croissant",
    category: "snack",
    categoryLabel: "Snack",
    price: 14000,
    stock: 6,
    active: true,
    rating: 4.8,
    reviews: 73,
    badge: "Flaky & Buttery 🥐",
    description: "Pastry ala Prancis dengan layer renyah di luar dan lembut wangi butter di dalam.",
    image: menuImages["Butter Croissant"],
    tags: ["French Pastry", "Golden Flaky", "Wangi"]
  }
];

// Helper to format IDR currency
function formatRupiah(amount) {
  return "Rp " + Number(amount || 0).toLocaleString("id-ID");
}
