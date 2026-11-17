/**
 * KOPI MAHASISWA — STORAGE & TRANSACTION MANAGER (PHASE 3 ENHANCED)
 * Storage Keys: kopi_products, kopi_cart, kopi_transactions
 * Handles localStorage persistence, product CRUD, stock updates, transaction creation,
 * and comprehensive sales analytics aggregation for the Admin Dashboard.
 */

const STORAGE_KEYS = {
  PRODUCTS: "kopi_products",
  CART: "kopi_cart",
  TRANSACTIONS: "kopi_transactions",
  MEMBER: "kopi_member",
  MEMBERS_LIST: "kopi_members_list"
};

const StorageManager = {
  // ===================================================
  // INITIALIZATION
  // ===================================================
  init() {
    // 0. Cek versi katalog gambar resmi untuk memastikan data gambar menu terkunci permanen (URL publik)
    const OFFICIAL_IMG_VER = "v8.0_pinterest_all_20_items_2026";
    const currentImgVer = localStorage.getItem("kopi_img_version");

    if (currentImgVer !== OFFICIAL_IMG_VER) {
      // Force update dan reset ke katalog resmi tanpa duplikasi
      if (typeof INITIAL_PRODUCTS_DATA !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS_DATA));
      }
      localStorage.setItem("kopi_img_version", OFFICIAL_IMG_VER);
    }

    // 1. Initialize Products if not yet present
    const existingProducts = this.getProducts();
    if (!existingProducts || existingProducts.length === 0) {
      if (typeof INITIAL_PRODUCTS_DATA !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS_DATA));
      }
    } else {
      let hasUpdate = false;
      const updatedProducts = existingProducts.map(prod => {
        const official = (typeof getMenuImage === "function") ? getMenuImage(prod.name) : null;
        if (!prod.image) {
          const fallback = official || (typeof INITIAL_PRODUCTS_DATA !== "undefined" ? INITIAL_PRODUCTS_DATA.find(p => p.id === prod.id || p.name === prod.name)?.image : null) || DEFAULT_IMAGE;
          hasUpdate = true;
          return { ...prod, image: fallback };
        }
        return prod;
      });

      // Tambahkan menu baru dari INITIAL_PRODUCTS_DATA jika belum ada
      if (typeof INITIAL_PRODUCTS_DATA !== "undefined") {
        INITIAL_PRODUCTS_DATA.forEach(initProd => {
          if (!updatedProducts.some(p => p.id === initProd.id || p.name.toLowerCase() === initProd.name.toLowerCase())) {
            updatedProducts.push(initProd);
            hasUpdate = true;
          }
        });
      }

      if (hasUpdate) {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updatedProducts));
      }
    }

    // 2. Initialize Cart if not present
    if (!localStorage.getItem(STORAGE_KEYS.CART)) {
      localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify([]));
    }

    // 3. Initialize Transactions if not present or fewer than seed
    try {
      const rawTxs = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      const existingTxs = rawTxs ? JSON.parse(rawTxs) : [];
      if (!Array.isArray(existingTxs) || existingTxs.length < 5) {
        const seeds = this.getSeedTransactions();
        const merged = (existingTxs || []).concat(
          seeds.filter(s => !(existingTxs || []).some(e => e.id === s.id))
        );
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(merged));
      }
    } catch (e) {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(this.getSeedTransactions()));
    }

    // 4. Sinkronisasi otomatis data menu & gambar dari database MySQL (non-blocking background)
    if (typeof fetch === "function") {
      this.syncWithDatabase().catch(() => {});

      // 5. Sinkronisasi data member dari members.json ke cache lokal browser
      fetch("members.json?_t=" + Date.now())
        .then(r => r.ok ? r.json() : null)
        .then(list => {
          if (Array.isArray(list) && list.length > 0) {
            localStorage.setItem(STORAGE_KEYS.MEMBERS_LIST, JSON.stringify(list));
          }
        })
        .catch(() => {});
    }
  },

  // ===================================================
  // SYNC FROM MYSQL DATABASE (GET_MENU.PHP)
  // ===================================================
  async syncWithDatabase() {
    try {
      const response = await fetch("get_menu.php?_t=" + Date.now());
      if (!response.ok) return false;
      const dbMenus = await response.json();
      if (!Array.isArray(dbMenus) || dbMenus.length === 0) return false;

      let currentProducts = this.getProducts(true);
      let changed = false;

      // Pembersihan Duplikat: Buang item lokal yang tidak ada di database resmi
      const dbNames = new Set(dbMenus.map(m => (m.nama_menu || "").trim().toLowerCase()));
      const beforeLen = currentProducts.length;
      currentProducts = currentProducts.filter(p => dbNames.has((p.name || "").trim().toLowerCase()));
      if (currentProducts.length !== beforeLen) {
        changed = true;
      }

      dbMenus.forEach(dbItem => {
        if (!dbItem || !dbItem.nama_menu) return;
        const dbName = dbItem.nama_menu.trim().toLowerCase();
        
        // Prioritas gambar: jika database memiliki gambar yang valid, gunakan; jika tidak, gunakan getMenuImage
        let resolvedGambar = (typeof getMenuImage === "function") ? getMenuImage(dbItem.nama_menu) : "";
        if (dbItem.gambar && typeof dbItem.gambar === "string" && dbItem.gambar.trim() !== "") {
          resolvedGambar = dbItem.gambar.trim();
        }

        const match = currentProducts.find(p => (p.name || "").trim().toLowerCase() === dbName);

        if (match) {
          if (match.image !== resolvedGambar) {
            match.image = resolvedGambar;
            changed = true;
          }
          if (dbItem.harga !== undefined && match.price !== Number(dbItem.harga)) {
            match.price = Number(dbItem.harga);
            changed = true;
          }
          if (dbItem.stok !== undefined && match.stock !== Number(dbItem.stok)) {
            match.stock = Number(dbItem.stok);
            changed = true;
          }
          if (dbItem.deskripsi && match.description !== dbItem.deskripsi) {
            match.description = dbItem.deskripsi;
            changed = true;
          }
        } else {
          // Menu baru di database yang belum ada di localStorage
          const newId = "menu-" + (dbItem.id || Date.now() + Math.floor(Math.random() * 1000));

          currentProducts.push({
            id: newId,
            name: dbItem.nama_menu,
            category: dbItem.kategori || "kopi",
            categoryLabel: (dbItem.kategori || "kopi").charAt(0).toUpperCase() + (dbItem.kategori || "kopi").slice(1),
            price: Number(dbItem.harga) || 15000,
            stock: Number(dbItem.stok) !== undefined ? Number(dbItem.stok) : 10,
            active: true,
            rating: 4.8,
            reviews: 12,
            badge: "Pilihan Mahasiswa ✨",
            description: dbItem.deskripsi || "",
            image: resolvedGambar,
            tags: [dbItem.kategori || "Menu"]
          });
          changed = true;
        }
      });

      if (changed) {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(currentProducts));
        window.dispatchEvent(new CustomEvent("kopi:products-synced", { detail: currentProducts }));
      }
      return true;
    } catch (e) {
      console.warn("[StorageManager] Gagal sinkronisasi data dari MySQL:", e);
      return false;
    }
  },

  // ===================================================
  // PRODUCTS & STOCK MANAGEMENT (CRUD)
  // ===================================================
  getProducts(includeInactive = true) {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      const list = data ? JSON.parse(data) : [];
      if (includeInactive) return list;
      return list.filter(p => p.active !== false);
    } catch (e) {
      console.error("Failed to parse products from localStorage:", e);
      return [];
    }
  },

  getProductById(id) {
    const products = this.getProducts(true);
    return products.find(p => p.id === id || (id === "french-fries" && p.id === "kentang-goreng") || (id === "kentang-goreng" && p.id === "french-fries")) || null;
  },

  saveProducts(products) {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  },

  addProduct(productData) {
    const products = this.getProducts(true);
    
    // Auto generate ID if not provided
    const id = productData.id || productData.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString().slice(-4);
    
    // Check if ID already exists
    if (products.some(p => p.id === id)) {
      return { success: false, message: "ID Produk sudah digunakan." };
    }

    const officialImg = (typeof getMenuImage === "function") ? getMenuImage(productData.name) : (typeof DEFAULT_IMAGE !== "undefined" ? DEFAULT_IMAGE : "images/kopi-susu.jpg");
    let finalImg = productData.image && productData.image.trim() !== ""
      ? productData.image.trim()
      : officialImg;

    const newProduct = {
      id: id,
      name: (productData.name || "").trim(),
      category: productData.category || "kopi",
      categoryLabel: productData.categoryLabel || this.getCategoryLabel(productData.category),
      price: Number(productData.price || 0),
      stock: Number(productData.stock || 0),
      active: productData.active !== undefined ? Boolean(productData.active) : true,
      rating: Number(productData.rating || 4.8),
      reviews: Number(productData.reviews || 0),
      badge: productData.badge || "Menu Baru ✨",
      description: (productData.description || "").trim(),
      image: finalImg,
      tags: Array.isArray(productData.tags) ? productData.tags : (productData.tags ? productData.tags.split(",").map(t => t.trim()) : ["Fresh"])
    };

    products.unshift(newProduct);
    this.saveProducts(products);

    return { success: true, message: "Produk berhasil ditambahkan!", product: newProduct };
  },

  updateProduct(id, updatedData) {
    const products = this.getProducts(true);
    const index = products.findIndex(p => p.id === id || (id === "french-fries" && p.id === "kentang-goreng") || (id === "kentang-goreng" && p.id === "french-fries"));

    if (index === -1) {
      return { success: false, message: "Produk tidak ditemukan." };
    }

    const existing = products[index];
    const category = updatedData.category || existing.category;

    let finalImg = updatedData.image !== undefined && updatedData.image.trim() !== "" ? updatedData.image.trim() : existing.image;
    if (!finalImg) {
      finalImg = (typeof getMenuImage === "function") ? getMenuImage(updatedData.name || existing.name) : (typeof DEFAULT_IMAGE !== "undefined" ? DEFAULT_IMAGE : "images/kopi-susu.jpg");
    }

    products[index] = {
      ...existing,
      ...updatedData,
      id: existing.id, // keep immutable ID
      category: category,
      categoryLabel: this.getCategoryLabel(category),
      price: updatedData.price !== undefined ? Number(updatedData.price) : existing.price,
      stock: updatedData.stock !== undefined ? Math.max(0, Number(updatedData.stock)) : existing.stock,
      active: updatedData.active !== undefined ? Boolean(updatedData.active) : existing.active,
      image: finalImg,
      tags: Array.isArray(updatedData.tags) ? updatedData.tags : (updatedData.tags ? updatedData.tags.split(",").map(t => t.trim()) : existing.tags)
    };

    this.saveProducts(products);
    return { success: true, message: "Produk berhasil diperbarui!", product: products[index] };
  },

  deleteProduct(id) {
    let products = this.getProducts(true);
    const initialLen = products.length;
    products = products.filter(p => p.id !== id);

    if (products.length === initialLen) {
      return { success: false, message: "Produk tidak ditemukan." };
    }

    this.saveProducts(products);
    return { success: true, message: "Produk berhasil dihapus!" };
  },

  toggleProductActive(id) {
    const products = this.getProducts(true);
    const product = products.find(p => p.id === id);
    if (!product) return { success: false, message: "Produk tidak ditemukan." };

    product.active = !product.active;
    this.saveProducts(products);
    return { success: true, message: `Status produk berhasil diubah menjadi ${product.active ? 'Aktif' : 'Nonaktif'}.`, active: product.active };
  },

  updateStockDirect(id, newStock) {
    const products = this.getProducts(true);
    const product = products.find(p => p.id === id);
    if (!product) return { success: false, message: "Produk tidak ditemukan." };

    product.stock = Math.max(0, Number(newStock));
    this.saveProducts(products);
    return { success: true, message: "Stok berhasil diperbarui.", stock: product.stock };
  },

  deductProductStock(productId, quantity) {
    const products = this.getProducts(true);
    const productIndex = products.findIndex(p => p.id === productId);
    if (productIndex !== -1) {
      const currentStock = Number(products[productIndex].stock || 0);
      products[productIndex].stock = Math.max(0, currentStock - quantity);
      this.saveProducts(products);
      return products[productIndex].stock;
    }
    return 0;
  },

  getCategoryLabel(category) {
    const map = {
      "kopi": "Kopi",
      "non-kopi": "Non-Kopi",
      "makanan": "Makanan",
      "snack": "Snack"
    };
    return map[category] || "Lainnya";
  },

  resetProductsStock() {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(INITIAL_PRODUCTS_DATA));
  },

  // ===================================================
  // CART MANAGEMENT
  // ===================================================
  getCart() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CART);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Failed to parse cart from localStorage:", e);
      return [];
    }
  },

  saveCart(cart) {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart));
  },

  addToCart(productId, quantityToAdd = 1) {
    const product = this.getProductById(productId);
    if (!product || product.active === false) {
      return { success: false, message: "Produk tidak ditemukan atau sedang tidak aktif." };
    }

    if (product.stock <= 0) {
      return { success: false, message: "Maaf, stok produk ini sudah habis!" };
    }

    const cart = this.getCart();
    const existingIndex = cart.findIndex(item => item.productId === productId);

    let currentQtyInCart = 0;
    if (existingIndex !== -1) {
      currentQtyInCart = cart[existingIndex].quantity;
    }

    const newQty = currentQtyInCart + quantityToAdd;

    if (newQty > product.stock) {
      return {
        success: false,
        message: `Stok tidak mencukupi. Sisa stok hanya ${product.stock}.`
      };
    }

    if (existingIndex !== -1) {
      cart[existingIndex].quantity = newQty;
      cart[existingIndex].subtotal = newQty * cart[existingIndex].price;
    } else {
      cart.push({
        productId: product.id,
        productName: product.name,
        category: product.category,
        price: product.price,
        image: product.image,
        quantity: newQty,
        subtotal: newQty * product.price
      });
    }

    this.saveCart(cart);
    return {
      success: true,
      message: `"${product.name}" ditambahkan ke keranjang`,
      productName: product.name,
      cartSummary: this.getCartSummary()
    };
  },

  updateCartQty(productId, newQty) {
    const product = this.getProductById(productId);
    const cart = this.getCart();
    const itemIndex = cart.findIndex(item => item.productId === productId);

    if (itemIndex === -1) return { success: false, message: "Item tidak ada di keranjang" };

    if (newQty <= 0) {
      return this.removeFromCart(productId);
    }

    const availableStock = product ? product.stock : 999;
    if (newQty > availableStock) {
      cart[itemIndex].quantity = availableStock;
      cart[itemIndex].subtotal = availableStock * cart[itemIndex].price;
      this.saveCart(cart);
      return {
        success: false,
        message: `Maksimal pembelian untuk stok ini adalah ${availableStock}`,
        cartSummary: this.getCartSummary()
      };
    }

    cart[itemIndex].quantity = newQty;
    cart[itemIndex].subtotal = newQty * cart[itemIndex].price;
    this.saveCart(cart);

    return {
      success: true,
      cartSummary: this.getCartSummary()
    };
  },

  removeFromCart(productId) {
    let cart = this.getCart();
    cart = cart.filter(item => item.productId !== productId);
    this.saveCart(cart);
    return {
      success: true,
      message: "Item dihapus dari keranjang",
      cartSummary: this.getCartSummary()
    };
  },

  clearCart() {
    this.saveCart([]);
    return this.getCartSummary();
  },

  getCartSummary() {
    const cart = this.getCart();
    const totalItems = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalPrice = cart.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
    return {
      items: cart,
      totalItems,
      totalPrice
    };
  },

  // ===================================================
  // OFFICIAL SEED TRANSACTIONS (21 TRANSAKSI REALISTIS - RP 841.600)
  // ===================================================
  getSeedTransactions() {
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
  },

  // ===================================================
  // TRANSACTIONS & RECEIPT GENERATOR
  // ===================================================
  getTransactions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      let list = data ? JSON.parse(data) : [];
      if (!Array.isArray(list) || list.length < 5) {
        const seeds = this.getSeedTransactions();
        list = (list || []).concat(seeds.filter(s => !(list || []).some(e => e.id === s.id)));
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(list));
      }
      return list.sort((a, b) => new Date(b.date) - new Date(a.date));
    } catch (e) {
      console.error("Failed to parse transactions from localStorage:", e);
      return this.getSeedTransactions();
    }
  },

  generateTransactionId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const datePrefix = `${year}${month}${day}`;

    const transactions = this.getTransactions();
    const todayTransactions = transactions.filter(t => t.id && t.id.startsWith(`KM-${datePrefix}`));
    const sequence = String(todayTransactions.length + 1).padStart(3, "0");

    return `KM-${datePrefix}-${sequence}`;
  },

  createTransaction(orderData) {
    const cartSummary = this.getCartSummary();
    if (!cartSummary.items || cartSummary.items.length === 0) {
      return { success: false, message: "Keranjang belanja masih kosong." };
    }

    // 1. Double check stock for all cart items
    const products = this.getProducts(true);
    for (const item of cartSummary.items) {
      const product = products.find(p => p.id === item.productId);
      if (!product || product.stock < item.quantity) {
        return {
          success: false,
          message: `Stok untuk "${item.productName}" tidak mencukupi (sisa: ${product ? product.stock : 0}). Silakan sesuaikan keranjang.`
        };
      }
    }

    // 2. Generate Transaction Data & Calculate Discounts
    const now = new Date();
    const transactionId = this.generateTransactionId();

    const formattedDate = new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(now);

    const transactionItems = cartSummary.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      price: item.price,
      quantity: item.quantity,
      subtotal: item.subtotal
    }));

    // Cek diskon member
    const member = this.getMember();
    const discountInfo = this.getMemberDiscount(cartSummary.totalPrice);
    const discountAmount = orderData.discount !== undefined ? Number(orderData.discount) : (discountInfo.eligible ? discountInfo.amount : 0);
    const finalTotal = Math.max(0, cartSummary.totalPrice - discountAmount);

    let orderStatus = "Berhasil";
    if (orderData.paymentMethod === "Tunai") {
      orderStatus = "Menunggu di Kasir";
    } else if (orderData.paymentMethod === "Transfer Bank") {
      orderStatus = "Menunggu Verifikasi";
    } else if (orderData.paymentMethod === "QRIS") {
      orderStatus = "Lunas (QRIS)";
    }

    const newTransaction = {
      id: transactionId,
      date: now.toISOString(),
      dateFormatted: formattedDate + " WIB",
      customerName: (orderData.customerName || (member ? member.name : "Mahasiswa")).trim(),
      campus: orderData.campus || (member ? member.campus : ""),
      orderType: orderData.orderType || "dine-in",
      tableNumber: orderData.orderType === "takeaway" ? "Takeaway (Bungkus)" : (orderData.tableNumber || "Meja 01").trim(),
      notes: (orderData.notes || "").trim(),
      items: transactionItems,
      subtotal: cartSummary.totalPrice,
      discount: discountAmount,
      discountLabel: discountInfo.eligible ? discountInfo.label : (orderData.discountLabel || ""),
      total: finalTotal,
      paymentMethod: orderData.paymentMethod || "QRIS",
      status: orderStatus,
      isMember: Boolean(member)
    };

    // Tandai jika Welcome Discount digunakan
    if (member && !member.welcomeDiscountUsed && discountInfo.type === "welcome") {
      member.welcomeDiscountUsed = true;
      member.lastDiscountUsedAt = now.toISOString();
      this.saveMember(member);
    } else if (member && discountInfo.type === "weekly") {
      member.lastWeeklyDiscountAt = now.toISOString();
      this.saveMember(member);
    }

    // 3. Deduct stock for all items
    transactionItems.forEach(item => {
      this.deductProductStock(item.productId, item.quantity);
    });

    // 4. Save to transaction history
    const allTransactions = this.getTransactions();
    allTransactions.unshift(newTransaction);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(allTransactions));

    // 5. Clear Cart
    this.clearCart();

    // 6. Sinkronisasi transaksi ke MySQL Database (background, non-blocking)
    if (typeof fetch === "function") {
      fetch("owner_analytics.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTransaction)
      }).then(r => r.json()).then(res => {
        window.dispatchEvent(new CustomEvent("kopi:order-created", { detail: newTransaction }));
      }).catch(err => console.warn("[StorageManager] Sync order ke MySQL:", err));
    }

    return {
      success: true,
      message: "Pesanan berhasil dibuat!",
      transaction: newTransaction
    };
  },

  // ===================================================
  // SALES ANALYTICS & REPORTING AGGREGATIONS (PHASE 3)
  // ===================================================
  getSalesAnalytics(timeframe = "today") {
    const transactions = this.getTransactions();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let filteredTransactions = [];

    if (timeframe === "today") {
      filteredTransactions = transactions.filter(t => new Date(t.date) >= startOfToday);
    } else if (timeframe === "7days") {
      const sevenDaysAgo = new Date(startOfToday);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      filteredTransactions = transactions.filter(t => new Date(t.date) >= sevenDaysAgo);
    } else if (timeframe === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      filteredTransactions = transactions.filter(t => new Date(t.date) >= startOfMonth);
    } else {
      filteredTransactions = transactions;
    }

    // 1. Total Revenue
    const totalRevenue = filteredTransactions.reduce((sum, t) => sum + Number(t.total || 0), 0);

    // 2. Total Transactions Count
    const totalTransactions = filteredTransactions.length;

    // 3. Product Sales Quantity Map
    const productSoldMap = {};
    let totalItemsSold = 0;

    filteredTransactions.forEach(t => {
      if (Array.isArray(t.items)) {
        t.items.forEach(item => {
          const qty = Number(item.quantity || 0);
          totalItemsSold += qty;
          const key = item.productName || "Unknown";
          if (!productSoldMap[key]) {
            productSoldMap[key] = {
              name: key,
              quantity: 0,
              revenue: 0,
              productId: item.productId
            };
          }
          productSoldMap[key].quantity += qty;
          productSoldMap[key].revenue += Number(item.subtotal || 0);
        });
      }
    });

    // Top Selling Leaderboard List
    const topSellingList = Object.values(productSoldMap).sort((a, b) => b.quantity - a.quantity);
    const topSellingProduct = topSellingList.length > 0 ? topSellingList[0] : { name: "-", quantity: 0 };

    // 4. Payment Methods Breakdown
    const paymentBreakdown = {
      qris: { count: 0, total: 0 },
      cash: { count: 0, total: 0 }
    };

    filteredTransactions.forEach(t => {
      const isQris = (t.paymentMethod || "").toUpperCase() === "QRIS";
      if (isQris) {
        paymentBreakdown.qris.count++;
        paymentBreakdown.qris.total += Number(t.total || 0);
      } else {
        paymentBreakdown.cash.count++;
        paymentBreakdown.cash.total += Number(t.total || 0);
      }
    });

    return {
      timeframe,
      totalRevenue,
      totalTransactions,
      totalItemsSold,
      topSellingProduct,
      topSellingList,
      paymentBreakdown,
      transactions: filteredTransactions
    };
  },

  getChartData(timeframe = "7days") {
    const transactions = this.getTransactions();
    const now = new Date();
    const labels = [];
    const revenueData = [];
    const orderData = [];

    if (timeframe === "today") {
      // 2-hour interval slots for today (08:00 to 22:00)
      const slots = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"];
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const todayTxs = transactions.filter(t => new Date(t.date) >= startOfToday);

      slots.forEach((slot, idx) => {
        labels.push(slot);
        const slotHour = parseInt(slot.split(":")[0], 10);
        const nextHour = slotHour + 2;

        const slotTxs = todayTxs.filter(t => {
          const h = new Date(t.date).getHours();
          return h >= slotHour && h < nextHour;
        });

        const rev = slotTxs.reduce((sum, t) => sum + Number(t.total || 0), 0);
        revenueData.push(rev);
        orderData.push(slotTxs.length);
      });
    } else if (timeframe === "7days") {
      // Last 7 days daily slots
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dStr = d.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
        labels.push(dStr);

        const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

        const dayTxs = transactions.filter(t => {
          const tDate = new Date(t.date);
          return tDate >= startOfDay && tDate <= endOfDay;
        });

        const rev = dayTxs.reduce((sum, t) => sum + Number(t.total || 0), 0);
        revenueData.push(rev);
        orderData.push(dayTxs.length);
      }
    } else if (timeframe === "month") {
      // 4 weeks breakdown of current month
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthTxs = transactions.filter(t => new Date(t.date) >= startOfMonth);

      for (let w = 1; w <= 4; w++) {
        labels.push(`Minggu ${w}`);
        const startDay = (w - 1) * 7 + 1;
        const endDay = w === 4 ? 31 : w * 7;

        const weekTxs = monthTxs.filter(t => {
          const dNum = new Date(t.date).getDate();
          return dNum >= startDay && dNum <= endDay;
        });

        const rev = weekTxs.reduce((sum, t) => sum + Number(t.total || 0), 0);
        revenueData.push(rev);
        orderData.push(weekTxs.length);
      }
    }

    return { labels, revenueData, orderData };
  },

  getFilteredReport(filter = {}) {
    const transactions = this.getTransactions();
    let result = [...transactions];

    if (filter.startDate) {
      const s = new Date(filter.startDate);
      s.setHours(0, 0, 0, 0);
      result = result.filter(t => new Date(t.date) >= s);
    }

    if (filter.endDate) {
      const e = new Date(filter.endDate);
      e.setHours(23, 59, 59, 999);
      result = result.filter(t => new Date(t.date) <= e);
    }

    if (filter.paymentMethod && filter.paymentMethod !== "all") {
      result = result.filter(t => (t.paymentMethod || "").toLowerCase() === filter.paymentMethod.toLowerCase());
    }

    const totalRevenue = result.reduce((sum, t) => sum + Number(t.total || 0), 0);
    const totalTransactions = result.length;
    let totalItemsSold = 0;

    result.forEach(t => {
      if (Array.isArray(t.items)) {
        t.items.forEach(i => { totalItemsSold += Number(i.quantity || 0); });
      }
    });

    return {
      transactions: result,
      totalRevenue,
      totalTransactions,
      totalItemsSold
    };
  },

  // ===================================================
  // MEMBER MANAGEMENT & DISCOUNT LOGIC
  // ===================================================
  getMember() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MEMBER);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error("Failed to parse member data:", e);
      return null;
    }
  },

  getMembersList() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MEMBERS_LIST);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Failed to parse members list:", e);
      return [];
    }
  },

  findMemberByPhone(phone) {
    if (!phone) return null;
    const clean = String(phone).replace(/[^0-9]/g, "");
    if (!clean) return null;

    // Normalisasi variasi awalan (misal: 0851 vs 62851 vs 851)
    const norm62 = clean.startsWith("0") ? "62" + clean.slice(1) : (clean.startsWith("8") ? "62" + clean : clean);
    const norm0 = norm62.startsWith("62") ? "0" + norm62.slice(2) : norm62;
    const normBare = norm0.startsWith("0") ? norm0.slice(1) : norm0;
    const searchVariants = [clean, norm62, norm0, normBare];

    const list = this.getMembersList();
    return list.find(m => {
      const p1 = String(m.cleanPhone || m.phone || "").replace(/[^0-9]/g, "");
      const p2 = String(m.waPhone || "").replace(/[^0-9]/g, "");
      return searchVariants.includes(p1) || (p2 && searchVariants.includes(p2));
    }) || null;
  },

  loginMemberByPhone(phone) {
    const member = this.findMemberByPhone(phone);
    if (!member) {
      return { success: false, message: "Nomor HP belum terdaftar, silakan buat akun baru dulu!" };
    }
    localStorage.setItem(STORAGE_KEYS.MEMBER, JSON.stringify(member));
    window.dispatchEvent(new CustomEvent("kopi:member-updated", { detail: member }));
    return { success: true, member };
  },

  saveMember(memberData) {
    try {
      localStorage.setItem(STORAGE_KEYS.MEMBER, JSON.stringify(memberData));

      // Simpan / update juga ke daftar seluruh member
      let list = this.getMembersList();
      const cleanPhone = (memberData.phone || "").replace(/[^0-9]/g, "");
      const idx = list.findIndex(m => {
        const p = (m.phone || "").replace(/[^0-9]/g, "");
        return p === cleanPhone || (memberData.waPhone && m.waPhone === memberData.waPhone);
      });

      if (idx !== -1) {
        list[idx] = { ...list[idx], ...memberData };
      } else {
        list.push(memberData);
      }
      localStorage.setItem(STORAGE_KEYS.MEMBERS_LIST, JSON.stringify(list));

      window.dispatchEvent(new CustomEvent("kopi:member-updated", { detail: memberData }));
      return true;
    } catch (e) {
      console.error("Failed to save member:", e);
      return false;
    }
  },

  removeMember() {
    localStorage.removeItem(STORAGE_KEYS.MEMBER);
    window.dispatchEvent(new CustomEvent("kopi:member-updated", { detail: null }));
  },

  isMember() {
    return this.getMember() !== null;
  },

  getMemberDiscount(cartTotalPrice) {
    const member = this.getMember();
    if (!member || !cartTotalPrice || cartTotalPrice <= 0) {
      return { eligible: false, rate: 0, amount: 0, label: "", type: null };
    }

    // 1. Welcome Discount 10%: untuk pembelian pertama setelah daftar
    if (!member.welcomeDiscountUsed) {
      const amount = Math.round(cartTotalPrice * 0.10);
      return {
        eligible: true,
        rate: 0.10,
        amount: amount,
        label: "Welcome Discount 10%",
        type: "welcome"
      };
    }

    // 2. Promo Mingguan: diskon 10% berkala (seminggu sekali)
    const isWeeklyEligible = member.weeklyPromoActive !== false;
    if (isWeeklyEligible) {
      const amount = Math.round(cartTotalPrice * 0.10);
      return {
        eligible: true,
        rate: 0.10,
        amount: amount,
        label: "Promo Member Mingguan 10%",
        type: "weekly"
      };
    }

    return { eligible: false, rate: 0, amount: 0, label: "", type: null };
  }
};

// Auto initialize on load
if (typeof window !== "undefined") {
  window.StorageManager = StorageManager;
  StorageManager.init();
}
