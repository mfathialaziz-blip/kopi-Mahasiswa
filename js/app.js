/**
 * KOPI MAHASISWA — MAIN APPLICATION LOGIC (TAHAP 2: SISTEM TRANSAKSI PEMBELI)
 * Integrates: StorageManager, Shopping Cart Drawer, Stock Live Updates,
 * Checkout Form, QRIS/Cash Payment Simulation, Success Receipt, and Order History.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Direct redirect if opened with #owner hash
  if (window.location.hash === "#owner") {
    window.location.href = "owner.html";
    return;
  }

  // Initialize Storage
  if (typeof StorageManager !== "undefined") {
    StorageManager.init();

    // Sinkronisasi data katalog secara real-time dari database MySQL
    if (typeof StorageManager.syncWithDatabase === "function") {
      StorageManager.syncWithDatabase().then(() => {
        if (typeof updateGlobalBadges === "function") updateGlobalBadges();
        if (typeof renderProducts === "function") renderProducts();
      }).catch(e => console.warn("[App] Sync DB background:", e));
    }
  }

  // Dengarkan event sinkronisasi produk (dari StorageManager atau tab lain)
  window.addEventListener("kopi:products-synced", () => {
    if (typeof updateGlobalBadges === "function") updateGlobalBadges();
    if (typeof renderProducts === "function") renderProducts();
  });

  window.addEventListener("storage", (e) => {
    if (e.key === "kopi_products") {
      if (typeof updateGlobalBadges === "function") updateGlobalBadges();
      if (typeof renderProducts === "function") renderProducts();
    }
  });

  // App State
  let currentCategory = "all";
  let searchQuery = "";
  let selectedOrderType = "dine-in";
  let selectedPaymentMethod = "QRIS";

  // ===================================================
  // DOM ELEMENTS
  // ===================================================
  // Catalog & Navigation
  const productGrid = document.getElementById("productGrid");
  const categoryBtns = document.querySelectorAll(".category-btn");
  const searchInput = document.getElementById("searchInput");
  const searchClearBtn = document.getElementById("searchClearBtn");
  const cartCounter = document.getElementById("cartCounter");
  const cartBtn = document.getElementById("cartBtn");
  const floatingCartBtn = document.getElementById("floatingCartBtn");
  const floatingCartCounter = document.getElementById("floatingCartCounter");
  const navbarHeader = document.getElementById("navbarHeader");
  const toastContainer = document.getElementById("toastContainer");

  // Mobile Navigation
  const mobileToggleBtn = document.getElementById("mobileToggleBtn");
  const mobileNavDrawer = document.getElementById("mobileNavDrawer");
  const mobileNavBackdrop = document.getElementById("mobileNavBackdrop");
  const drawerCloseBtn = document.getElementById("drawerCloseBtn");
  const drawerLinks = document.querySelectorAll(".drawer-link");
  const navHistoryBtn = document.getElementById("navHistoryBtn");
  const drawerHistoryBtn = document.getElementById("drawerHistoryBtn");
  const navHistoryBadge = document.getElementById("navHistoryBadge");
  const drawerHistoryCount = document.getElementById("drawerHistoryCount");

  // Cart Drawer Elements
  const cartDrawer = document.getElementById("cartDrawer");
  const cartDrawerBackdrop = document.getElementById("cartDrawerBackdrop");
  const cartDrawerCloseBtn = document.getElementById("cartDrawerCloseBtn");
  const cartDrawerBody = document.getElementById("cartDrawerBody");
  const cartTotalItemsCount = document.getElementById("cartTotalItemsCount");
  const cartTotalAmount = document.getElementById("cartTotalAmount");
  const checkoutProceedBtn = document.getElementById("checkoutProceedBtn");
  const clearCartBtn = document.getElementById("clearCartBtn");
  const cartDiscountRow = document.getElementById("cartDiscountRow");
  const cartDiscountAmount = document.getElementById("cartDiscountAmount");
  const cartMemberPrompt = document.getElementById("cartMemberPrompt");
  const cartJoinMemberBtn = document.getElementById("cartJoinMemberBtn");

  // Member Elements
  const memberBtn = document.getElementById("memberBtn");
  const memberBtnText = document.getElementById("memberBtnText");
  const memberBtnIcon = document.getElementById("memberBtnIcon");
  const memberBtnBadge = document.getElementById("memberBtnBadge");
  const memberSwitchBtn = document.getElementById("memberSwitchBtn");
  const drawerMemberBtn = document.getElementById("drawerMemberBtn");
  const drawerMemberText = document.getElementById("drawerMemberText");
  const drawerMemberIcon = document.getElementById("drawerMemberIcon");
  const drawerLogoutItem = document.getElementById("drawerLogoutItem");
  const drawerMemberLogoutBtn = document.getElementById("drawerMemberLogoutBtn");
  const memberModalBackdrop = document.getElementById("memberModalBackdrop");
  const memberModalCloseBtn = document.getElementById("memberModalCloseBtn");
  const memberModalTitle = document.getElementById("memberModalTitle");
  const memberTabsNav = document.getElementById("memberTabsNav");
  const tabLoginBtn = document.getElementById("tabLoginBtn");
  const tabRegisterBtn = document.getElementById("tabRegisterBtn");
  const memberLoginView = document.getElementById("memberLoginView");
  const memberLoginForm = document.getElementById("memberLoginForm");
  const memberLoginPhone = document.getElementById("memberLoginPhone");
  const memberLoginSubmitBtn = document.getElementById("memberLoginSubmitBtn");
  const linkToRegister = document.getElementById("linkToRegister");
  const linkToLogin = document.getElementById("linkToLogin");
  const memberRegisterView = document.getElementById("memberRegisterView");
  const memberCardView = document.getElementById("memberCardView");
  const memberRegisterForm = document.getElementById("memberRegisterForm");
  const memberFormName = document.getElementById("memberFormName");
  const memberFormCampus = document.getElementById("memberFormCampus");
  const memberFormPhone = document.getElementById("memberFormPhone");
  const memberSubmitBtn = document.getElementById("memberSubmitBtn");
  const memberLogoutBtn = document.getElementById("memberLogoutBtn");
  const memberDoneBtn = document.getElementById("memberDoneBtn");
  const cardMemberId = document.getElementById("cardMemberId");
  const cardMemberName = document.getElementById("cardMemberName");
  const cardMemberCampus = document.getElementById("cardMemberCampus");
  const cardMemberPhone = document.getElementById("cardMemberPhone");

  // Checkout Modal Elements
  const checkoutModalBackdrop = document.getElementById("checkoutModalBackdrop");
  const checkoutModalCloseBtn = document.getElementById("checkoutModalCloseBtn");
  const checkoutCancelBtn = document.getElementById("checkoutCancelBtn");
  const confirmOrderBtn = document.getElementById("confirmOrderBtn");
  const customerNameInput = document.getElementById("customerNameInput");
  const orderTypeDineIn = document.getElementById("orderTypeDineIn");
  const orderTypeTakeaway = document.getElementById("orderTypeTakeaway");
  const tableNumberGroup = document.getElementById("tableNumberGroup");
  const tableNumberInput = document.getElementById("tableNumberInput");
  const tableChips = document.querySelectorAll(".table-chip");
  const orderNotesInput = document.getElementById("orderNotesInput");
  const pmQris = document.getElementById("pmQris");
  const pmCash = document.getElementById("pmCash");
  const pmTransfer = document.getElementById("pmTransfer");
  const qrisSimulatorBox = document.getElementById("qrisSimulatorBox");
  const bankTransferBox = document.getElementById("bankTransferBox");
  const cashInfoBox = document.getElementById("cashInfoBox");
  const checkoutSummaryList = document.getElementById("checkoutSummaryList");
  const checkoutGrandTotal = document.getElementById("checkoutGrandTotal");
  const checkoutDiscountRow = document.getElementById("checkoutDiscountRow");
  const checkoutDiscountLabel = document.getElementById("checkoutDiscountLabel");
  const checkoutDiscountAmount = document.getElementById("checkoutDiscountAmount");

  // Success Receipt Modal Elements
  const receiptModalBackdrop = document.getElementById("receiptModalBackdrop");
  const receiptCloseBtn = document.getElementById("receiptCloseBtn");
  const receiptTxId = document.getElementById("receiptTxId");
  const receiptCustomerName = document.getElementById("receiptCustomerName");
  const receiptTableInfo = document.getElementById("receiptTableInfo");
  const receiptDateTime = document.getElementById("receiptDateTime");
  const receiptPaymentMethod = document.getElementById("receiptPaymentMethod");
  const receiptItemsTableBody = document.getElementById("receiptItemsTableBody");
  const receiptSubtotal = document.getElementById("receiptSubtotal");
  const receiptDiscountRow = document.getElementById("receiptDiscountRow");
  const receiptDiscountLabel = document.getElementById("receiptDiscountLabel");
  const receiptDiscountAmount = document.getElementById("receiptDiscountAmount");
  const receiptGrandTotal = document.getElementById("receiptGrandTotal");
  const printReceiptBtn = document.getElementById("printReceiptBtn");
  const viewHistoryFromReceiptBtn = document.getElementById("viewHistoryFromReceiptBtn");
  const orderAgainBtn = document.getElementById("orderAgainBtn");

  // History Modal Elements
  const historyModalBackdrop = document.getElementById("historyModalBackdrop");
  const historyCloseBtn = document.getElementById("historyCloseBtn");
  const historyDoneBtn = document.getElementById("historyDoneBtn");
  const historyListContainer = document.getElementById("historyListContainer");

  // ===================================================
  // 1. UPDATE BADGES & STATS
  // ===================================================
  function updateGlobalBadges() {
    // 1. Cart Badge
    const cartSummary = StorageManager.getCartSummary();
    if (cartCounter) {
      cartCounter.textContent = cartSummary.totalItems;
      if (cartSummary.totalItems > 0) {
        cartCounter.classList.add("pop");
        setTimeout(() => cartCounter.classList.remove("pop"), 300);
      }
    }
    if (floatingCartCounter) {
      floatingCartCounter.textContent = cartSummary.totalItems;
      if (cartSummary.totalItems > 0) {
        floatingCartCounter.classList.add("pop");
        setTimeout(() => floatingCartCounter.classList.remove("pop"), 300);
      }
    }

    // 2. Member Status in Header & Mobile Navigation
    const isMember = StorageManager.isMember();
    const currentMember = StorageManager.getMember();
    if (memberBtnText) {
      if (isMember && currentMember && currentMember.name) {
        const shortName = currentMember.name.trim().split(" ")[0];
        memberBtnText.textContent = `Halo, ${shortName} ☕`;
        if (memberBtn) {
          memberBtn.classList.add("member-btn-logged");
          memberBtn.title = "Klik untuk melihat Kartu Member Digital Anda";
        }
        if (memberBtnIcon) memberBtnIcon.textContent = "☕";
        if (memberBtnBadge) memberBtnBadge.style.display = "inline-flex";
        if (memberSwitchBtn) memberSwitchBtn.style.display = "inline-flex";

        if (drawerMemberText) drawerMemberText.textContent = `Halo, ${shortName} ☕ (Lihat Kartu)`;
        if (drawerMemberIcon) drawerMemberIcon.textContent = "☕";
        if (drawerLogoutItem) drawerLogoutItem.style.display = "block";
      } else {
        memberBtnText.textContent = "Daftar / Login Member";
        if (memberBtn) {
          memberBtn.classList.remove("member-btn-logged");
          memberBtn.title = "Daftar atau Login Akun Member Mahasiswa (Diskon 10%)";
        }
        if (memberBtnIcon) memberBtnIcon.textContent = "🎓";
        if (memberBtnBadge) memberBtnBadge.style.display = "none";
        if (memberSwitchBtn) memberSwitchBtn.style.display = "none";

        if (drawerMemberText) drawerMemberText.textContent = "Daftar / Login Member";
        if (drawerMemberIcon) drawerMemberIcon.textContent = "🎓";
        if (drawerLogoutItem) drawerLogoutItem.style.display = "none";
      }
    }

    // 3. Transaction History Badges
    const transactions = StorageManager.getTransactions();
    const txCount = transactions.length;
    if (navHistoryBadge) navHistoryBadge.textContent = txCount;
    if (drawerHistoryCount) drawerHistoryCount.textContent = txCount;

    // 4. Category Filter Counts
    const products = StorageManager.getProducts(false);
    const counts = { all: products.length, kopi: 0, "non-kopi": 0, makanan: 0, snack: 0 };
    products.forEach(p => {
      if (counts[p.category] !== undefined) counts[p.category]++;
    });

    categoryBtns.forEach(btn => {
      const cat = btn.getAttribute("data-category");
      const badge = btn.querySelector(".category-badge-count");
      if (badge && counts[cat] !== undefined) {
        badge.textContent = counts[cat];
      }
    });
  }

  // ===================================================
  // 2. RENDER PRODUCT CATALOG WITH REAL-TIME STOCK
  // ===================================================
  function renderProducts() {
    if (!productGrid) return;

    const products = StorageManager.getProducts(false);

    // Filter logic
    const filteredProducts = products.filter(product => {
      const matchCategory = (currentCategory === "all" || product.category === currentCategory);
      const matchSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          product.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCategory && matchSearch;
    });

    // Empty State
    if (filteredProducts.length === 0) {
      productGrid.innerHTML = `
        <div class="catalog-empty-state">
          <div class="empty-icon">☕🔍</div>
          <h3 class="empty-title">Menu Tidak Ditemukan</h3>
          <p class="empty-desc">Coba gunakan kata kunci lain atau pilih kategori menu di atas.</p>
          <button class="btn-primary" id="resetFilterBtn" style="padding: 8px 18px; font-size: 0.9rem;">
            Lihat Semua Menu
          </button>
        </div>
      `;
      const resetBtn = document.getElementById("resetFilterBtn");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          currentCategory = "all";
          searchQuery = "";
          if (searchInput) searchInput.value = "";
          if (searchClearBtn) searchClearBtn.style.display = "none";
          updateActiveCategoryButton();
          renderProducts();
        });
      }
      return;
    }

    // Build Cards HTML
    const cardsHTML = filteredProducts.map(product => {
      const isOutOfStock = product.stock <= 0;
      const isLowStock = product.stock > 0 && product.stock <= 5;
      const tagsHTML = product.tags.map(tag => `<span class="tag-pill">${tag}</span>`).join("");

      // Stock Indicator Pill
      let stockHTML = "";
      if (isOutOfStock) {
        stockHTML = `<span class="stock-indicator stock-empty">Stok Habis ❌</span>`;
      } else if (isLowStock) {
        stockHTML = `<span class="stock-indicator stock-low">⚡ Sisa ${product.stock} Porsi!</span>`;
      } else {
        stockHTML = `<span class="stock-indicator stock-normal">Stok: ${product.stock}</span>`;
      }

      // Add Button State
      let buttonHTML = "";
      if (isOutOfStock) {
        buttonHTML = `
          <button class="btn-add-product disabled" disabled aria-label="Stok ${product.name} habis">
            <span class="btn-text">Habis</span>
          </button>
        `;
      } else {
        buttonHTML = `
          <button class="btn-add-product" data-id="${product.id}" data-name="${product.name}" aria-label="Tambah ${product.name} ke keranjang">
            <span class="btn-text">+ Tambah</span>
          </button>
        `;
      }

      return `
        <article class="product-card ${isOutOfStock ? 'out-of-stock' : ''}" data-id="${product.id}">
          <div class="product-image-wrap">
            ${(product.image || product.gambar)
              ? `<img src="${product.image || product.gambar}" alt="${product.name}" class="product-img" loading="lazy" onerror="this.style.display='none'; if (this.nextElementSibling) this.nextElementSibling.style.display='flex';">
                 <div class="product-no-img-text" style="display: none;"><span class="no-img-icon">☕</span><span class="no-img-caption">Kopi Mahasiswa</span></div>`
              : `<div class="product-no-img-text"><span class="no-img-icon">☕</span><span class="no-img-caption">Kopi Mahasiswa</span></div>`
            }
            <span class="product-badge-tag">${product.badge}</span>
            <div class="product-rating-pill">
              <span class="star-icon">★</span>
              <span>${product.rating}</span>
            </div>
          </div>
          
          <div class="product-body">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2px;">
              <span class="product-category-name">${product.categoryLabel}</span>
              ${stockHTML}
            </div>
            
            <h3 class="product-name">${product.name}</h3>
            <p class="product-desc">${product.description}</p>
            <div class="product-tags">${tagsHTML}</div>
            
            <div class="product-footer">
              <div class="product-price-wrap">
                <span class="price-label">Harga</span>
                <span class="product-price">${formatRupiah(product.price)}</span>
              </div>
              
              ${buttonHTML}
            </div>
          </div>
        </article>
      `;
    }).join("");

    productGrid.innerHTML = cardsHTML;

    // Attach Click Handlers to "+ Tambah" buttons
    attachAddToCartEvents();
  }

  // ===================================================
  // 3. "+ TAMBAH" CLICK EVENT WITH STORAGE INTEGRATION
  // ===================================================
  function attachAddToCartEvents() {
    const addBtns = productGrid.querySelectorAll(".btn-add-product:not([disabled])");
    addBtns.forEach(btn => {
      btn.addEventListener("click", (e) => {
        const targetBtn = e.currentTarget;
        const productId = targetBtn.getAttribute("data-id");

        const result = StorageManager.addToCart(productId, 1);

        if (!result.success) {
          showToast(`⚠️ ${result.message}`, "warning");
          return;
        }

        // 1. Temporary button feedback
        targetBtn.classList.add("added");
        const originalText = targetBtn.innerHTML;
        targetBtn.innerHTML = `<span>✓ Ditambahkan</span>`;

        // 2. Update Global Badges
        updateGlobalBadges();

        // 3. Show Toast notification (Format resmi: ✅ [Nama Menu] berhasil ditambahkan ke keranjang!)
        showToast(`✅ ${result.productName} berhasil ditambahkan ke keranjang!`, "success");

        // 4. Reset button after 1.2s
        setTimeout(() => {
          targetBtn.classList.remove("added");
          targetBtn.innerHTML = originalText;
        }, 1200);
      });
    });
  }

  // ===================================================
  // 4. TOAST NOTIFICATION SYSTEM (GLASSMORPHISM DARK MODE)
  // ===================================================
  function showToast(message, type = "success") {
    if (!toastContainer) return;

    // Bersihkan toast yang terlalu banyak agar rapi
    const existingToasts = toastContainer.querySelectorAll(".toast");
    if (existingToasts.length >= 3) {
      existingToasts[0].remove();
    }

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let iconChar = "✅";
    if (type === "warning" || message.includes("🗑️")) {
      iconChar = "🗑️";
    } else if (message.includes("🎓")) {
      iconChar = "🎓";
    } else if (message.includes("🎉")) {
      iconChar = "🎉";
    } else if (message.includes("📋")) {
      iconChar = "📋";
    } else if (message.includes("🔄")) {
      iconChar = "🔄";
    } else if (type === "info" || message.includes("📲") || message.includes("ℹ️")) {
      iconChar = "ℹ️";
    }

    // Jika pesan sudah mengandung emoji di awal, rapikan agar tidak dobel
    let cleanMsg = message;
    const knownEmojis = ["✅", "🗑️", "🎓", "🎉", "📋", "🔄", "📲", "⚠️", "ℹ️"];
    for (const em of knownEmojis) {
      if (cleanMsg.startsWith(em)) {
        iconChar = em;
        cleanMsg = cleanMsg.slice(em.length).trim();
        break;
      }
    }

    toast.innerHTML = `
      <div class="toast-icon">${iconChar}</div>
      <div class="toast-body">
        <span class="toast-msg">${cleanMsg}</span>
      </div>
    `;

    toastContainer.appendChild(toast);

    // Animasi smooth fade-in
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    // Otomatis hilang setelah 3 detik
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 350);
    }, 3000);
  }
  window.showToast = showToast;

  // ===================================================
  // 5. SHOPPING CART DRAWER LOGIC
  // ===================================================
  function openCartDrawer() {
    renderCartDrawer();
    if (cartDrawer) cartDrawer.classList.add("active");
    if (cartDrawerBackdrop) cartDrawerBackdrop.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeCartDrawer() {
    if (cartDrawer) cartDrawer.classList.remove("active");
    if (cartDrawerBackdrop) cartDrawerBackdrop.classList.remove("active");
    document.body.style.overflow = "";
  }

  function renderCartDrawer() {
    if (!cartDrawerBody) return;

    const cartSummary = StorageManager.getCartSummary();
    const products = StorageManager.getProducts();
    const discountInfo = StorageManager.getMemberDiscount(cartSummary.totalPrice);
    const isUserMember = StorageManager.isMember();

    if (cartTotalItemsCount) {
      cartTotalItemsCount.textContent = `${cartSummary.totalItems} item`;
    }

    // Tampilkan perhitungan diskon member jika memenuhi syarat
    const cartSubtotalRow = document.getElementById("cartSubtotalRow");
    const cartSubtotalAmount = document.getElementById("cartSubtotalAmount");
    const cartDiscountLabel = document.getElementById("cartDiscountLabel");

    if (discountInfo.eligible && discountInfo.amount > 0) {
      if (cartSubtotalRow) cartSubtotalRow.style.display = "flex";
      if (cartSubtotalAmount) cartSubtotalAmount.textContent = formatRupiah(cartSummary.totalPrice);
      if (cartDiscountRow) cartDiscountRow.style.display = "flex";
      if (cartDiscountLabel) cartDiscountLabel.textContent = discountInfo.label;
      if (cartDiscountAmount) {
        cartDiscountAmount.textContent = `- ${formatRupiah(discountInfo.amount)}`;
      }
      const finalPrice = Math.max(0, cartSummary.totalPrice - discountInfo.amount);
      if (cartTotalAmount) {
        cartTotalAmount.textContent = formatRupiah(finalPrice);
      }
      if (cartMemberPrompt) {
        cartMemberPrompt.style.display = "none";
      }
    } else {
      if (cartSubtotalRow) cartSubtotalRow.style.display = "none";
      if (cartDiscountRow) cartDiscountRow.style.display = "none";
      if (cartTotalAmount) {
        cartTotalAmount.textContent = formatRupiah(cartSummary.totalPrice);
      }
      if (cartMemberPrompt) {
        cartMemberPrompt.style.display = isUserMember ? "none" : "flex";
      }
    }

    // Disable Checkout button if cart is empty
    if (checkoutProceedBtn) {
      checkoutProceedBtn.disabled = cartSummary.items.length === 0;
      checkoutProceedBtn.style.opacity = cartSummary.items.length === 0 ? "0.5" : "1";
      checkoutProceedBtn.style.cursor = cartSummary.items.length === 0 ? "not-allowed" : "pointer";
    }

    // Empty Cart State
    if (cartSummary.items.length === 0) {
      cartDrawerBody.innerHTML = `
        <div class="cart-empty-state">
          <div class="cart-empty-icon">☕🛒</div>
          <h4 class="cart-empty-title">Keranjangmu Masih Kosong</h4>
          <p class="cart-empty-desc">Yuk pilih kopi dan camilan favorit mahasiswa untuk menemani harimu!</p>
          <button class="btn-primary" id="startOrderingBtn" style="padding: 10px 20px;">
            Mulai Pesan Sekarang
          </button>
        </div>
      `;
      const startBtn = document.getElementById("startOrderingBtn");
      if (startBtn) {
        startBtn.addEventListener("click", () => {
          closeCartDrawer();
          const menuSection = document.getElementById("menu");
          if (menuSection) menuSection.scrollIntoView({ behavior: "smooth" });
        });
      }
      return;
    }

    // Render Cart Items
    cartDrawerBody.innerHTML = cartSummary.items.map(item => {
      const product = products.find(p => p.id === item.productId);
      const maxStock = product ? product.stock : 99;
      const isMaxReached = item.quantity >= maxStock;

      return `
        <div class="cart-item-card" data-product-id="${item.productId}">
          <img src="${item.image || (typeof DEFAULT_IMAGE !== 'undefined' ? DEFAULT_IMAGE : 'images/kopi-susu.jpg')}" alt="${item.productName}" class="cart-item-thumb" onerror="this.onerror=null; this.src='images/kopi-susu.jpg';">
          
          <div class="cart-item-info">
            <h4 class="cart-item-name">${item.productName}</h4>
            <span class="cart-item-price-unit">${formatRupiah(item.price)} / porsi</span>
            <span class="cart-item-subtotal">${formatRupiah(item.subtotal)}</span>
            
            <div class="cart-qty-controls">
              <button class="btn-qty btn-cart-minus" data-id="${item.productId}" aria-label="Kurangi">-</button>
              <span class="cart-qty-display">${item.quantity}</span>
              <button class="btn-qty btn-cart-plus" data-id="${item.productId}" ${isMaxReached ? 'disabled' : ''} aria-label="Tambah">+</button>
            </div>
          </div>
          
          <button class="btn-remove-item" data-id="${item.productId}" aria-label="Hapus ${item.productName}">
            🗑️
          </button>
        </div>
      `;
    }).join("");

    // Attach Cart Action Listeners
    attachCartActionListeners();
  }

  function attachCartActionListeners() {
    // Plus Button
    const plusBtns = cartDrawerBody.querySelectorAll(".btn-cart-plus");
    plusBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const productId = btn.getAttribute("data-id");
        const cart = StorageManager.getCart();
        const item = cart.find(i => i.productId === productId);
        if (item) {
          const res = StorageManager.updateCartQty(productId, item.quantity + 1);
          if (!res.success && res.message) {
            showToast("Batas Stok: " + res.message, "warning");
          }
          updateGlobalBadges();
          renderCartDrawer();
        }
      });
    });

    // Minus Button
    const minusBtns = cartDrawerBody.querySelectorAll(".btn-cart-minus");
    minusBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const productId = btn.getAttribute("data-id");
        const cart = StorageManager.getCart();
        const item = cart.find(i => i.productId === productId);
        if (item) {
          if (item.quantity - 1 <= 0) {
            StorageManager.removeFromCart(productId);
            showToast("🗑️ Menu telah dihapus dari keranjang.", "warning");
          } else {
            StorageManager.updateCartQty(productId, item.quantity - 1);
          }
          updateGlobalBadges();
          renderCartDrawer();
        }
      });
    });

    // Remove Button (Hapus menu: "🗑️ Menu telah dihapus dari keranjang.")
    const removeBtns = cartDrawerBody.querySelectorAll(".btn-remove-item");
    removeBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const productId = btn.getAttribute("data-id");
        StorageManager.removeFromCart(productId);
        updateGlobalBadges();
        renderCartDrawer();
        showToast("🗑️ Menu telah dihapus dari keranjang.", "warning");
      });
    });
  }

  // Cart Open & Close Handlers
  if (cartBtn) cartBtn.addEventListener("click", openCartDrawer);
  if (floatingCartBtn) floatingCartBtn.addEventListener("click", openCartDrawer);
  if (cartDrawerCloseBtn) cartDrawerCloseBtn.addEventListener("click", closeCartDrawer);
  if (cartDrawerBackdrop) cartDrawerBackdrop.addEventListener("click", closeCartDrawer);

  // Cart Banner Join Member Trigger
  if (cartJoinMemberBtn) {
    cartJoinMemberBtn.addEventListener("click", () => {
      closeCartDrawer();
      openMemberModal();
    });
  }

  // Clear Cart Handler
  if (clearCartBtn) {
    clearCartBtn.addEventListener("click", () => {
      const cartSummary = StorageManager.getCartSummary();
      if (cartSummary.items.length === 0) return;
      
      if (confirm("Apakah Anda yakin ingin mengosongkan keranjang belanja?")) {
        StorageManager.clearCart();
        updateGlobalBadges();
        renderCartDrawer();
        showToast("🗑️ Menu telah dihapus dari keranjang.", "warning");
      }
    });
  }

  // ===================================================
  // 6. CHECKOUT LANGSUNG DI WEB (UTAMA)
  // ===================================================
  function openCheckoutModal() {
    const cartSummary = StorageManager.getCartSummary();
    if (cartSummary.items.length === 0) {
      showToast("⚠️ Keranjang belanja Anda masih kosong!", "warning");
      return;
    }

    closeCartDrawer();

    // Populate Order Summary
    if (checkoutSummaryList) {
      checkoutSummaryList.innerHTML = cartSummary.items.map(item => `
        <li class="summary-item-row">
          <span class="summary-item-name">
            ${item.productName} <span class="summary-item-qty">× ${item.quantity}</span>
          </span>
          <span class="summary-item-price">${formatRupiah(item.subtotal)}</span>
        </li>
      `).join("");
    }

    // Perhitungan Diskon Member di Modal Checkout
    const discountInfo = StorageManager.getMemberDiscount(cartSummary.totalPrice);
    let finalTotal = cartSummary.totalPrice;

    if (discountInfo.eligible && discountInfo.amount > 0) {
      finalTotal = Math.max(0, cartSummary.totalPrice - discountInfo.amount);
      if (checkoutDiscountRow) checkoutDiscountRow.style.display = "flex";
      if (checkoutDiscountLabel) checkoutDiscountLabel.textContent = `${discountInfo.label}:`;
      if (checkoutDiscountAmount) checkoutDiscountAmount.textContent = `- ${formatRupiah(discountInfo.amount)}`;
    } else {
      if (checkoutDiscountRow) checkoutDiscountRow.style.display = "none";
    }

    if (checkoutGrandTotal) {
      checkoutGrandTotal.textContent = formatRupiah(finalTotal);
    }

    // Auto-fill nama pembeli jika sudah terdaftar sebagai Member
    const currentMember = StorageManager.getMember();
    if (currentMember && currentMember.name && customerNameInput && !customerNameInput.value) {
      customerNameInput.value = currentMember.name;
    }

    // Reset metode pembayaran default ke QRIS
    selectedPaymentMethod = "QRIS";
    if (pmQris) pmQris.classList.add("active");
    if (pmCash) pmCash.classList.remove("active");
    if (pmTransfer) pmTransfer.classList.remove("active");
    if (qrisSimulatorBox) qrisSimulatorBox.style.display = "flex";
    if (bankTransferBox) bankTransferBox.style.display = "none";
    if (cashInfoBox) cashInfoBox.style.display = "none";

    // Open Modal
    if (checkoutModalBackdrop) checkoutModalBackdrop.classList.add("active");
    document.body.style.overflow = "hidden";

    // Focus on Customer Name if empty
    setTimeout(() => {
      if (customerNameInput && !customerNameInput.value) customerNameInput.focus();
    }, 150);
  }

  function closeCheckoutModal() {
    if (checkoutModalBackdrop) checkoutModalBackdrop.classList.remove("active");
    document.body.style.overflow = "";
  }

  // Tombol Checkout Keranjang membuka Formulir Checkout Web
  if (checkoutProceedBtn) {
    checkoutProceedBtn.addEventListener("click", openCheckoutModal);
  }
  if (checkoutModalCloseBtn) checkoutModalCloseBtn.addEventListener("click", closeCheckoutModal);
  if (checkoutCancelBtn) checkoutCancelBtn.addEventListener("click", closeCheckoutModal);

  // Order Type Toggle (Dine In vs Takeaway)
  if (orderTypeDineIn && orderTypeTakeaway) {
    orderTypeDineIn.addEventListener("click", () => {
      selectedOrderType = "dine-in";
      orderTypeDineIn.classList.add("active");
      orderTypeTakeaway.classList.remove("active");
      if (tableNumberGroup) tableNumberGroup.style.display = "flex";
    });

    orderTypeTakeaway.addEventListener("click", () => {
      selectedOrderType = "takeaway";
      orderTypeTakeaway.classList.add("active");
      orderTypeDineIn.classList.remove("active");
      if (tableNumberGroup) tableNumberGroup.style.display = "none";
    });
  }

  // Quick Table Chips
  tableChips.forEach(chip => {
    chip.addEventListener("click", () => {
      tableChips.forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      if (tableNumberInput) {
        tableNumberInput.value = chip.textContent.trim();
      }
    });
  });

  // Payment Method Selection: QRIS vs Tunai vs Transfer Bank
  if (pmQris) {
    pmQris.addEventListener("click", () => {
      selectedPaymentMethod = "QRIS";
      pmQris.classList.add("active");
      if (pmCash) pmCash.classList.remove("active");
      if (pmTransfer) pmTransfer.classList.remove("active");
      if (qrisSimulatorBox) qrisSimulatorBox.style.display = "flex";
      if (bankTransferBox) bankTransferBox.style.display = "none";
      if (cashInfoBox) cashInfoBox.style.display = "none";
    });
  }

  if (pmCash) {
    pmCash.addEventListener("click", () => {
      selectedPaymentMethod = "Tunai";
      pmCash.classList.add("active");
      if (pmQris) pmQris.classList.remove("active");
      if (pmTransfer) pmTransfer.classList.remove("active");
      if (cashInfoBox) cashInfoBox.style.display = "flex";
      if (qrisSimulatorBox) qrisSimulatorBox.style.display = "none";
      if (bankTransferBox) bankTransferBox.style.display = "none";
    });
  }

  if (pmTransfer) {
    pmTransfer.addEventListener("click", () => {
      selectedPaymentMethod = "Transfer Bank";
      pmTransfer.classList.add("active");
      if (pmQris) pmQris.classList.remove("active");
      if (pmCash) pmCash.classList.remove("active");
      if (bankTransferBox) bankTransferBox.style.display = "flex";
      if (qrisSimulatorBox) qrisSimulatorBox.style.display = "none";
      if (cashInfoBox) cashInfoBox.style.display = "none";
    });
  }

  // Salin Nomor Rekening Transfer Bank
  const copyAccountBtns = document.querySelectorAll(".btn-copy-account");
  copyAccountBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const acc = btn.getAttribute("data-account");
      if (acc && navigator.clipboard) {
        navigator.clipboard.writeText(acc).then(() => {
          const origText = btn.innerHTML;
          btn.innerHTML = "✓ Tersalin!";
          btn.classList.add("copied");
          showToast("📋 Nomor rekening berhasil disalin!", "success");
          setTimeout(() => {
            btn.innerHTML = origText;
            btn.classList.remove("copied");
          }, 1500);
        }).catch(() => {
          showToast("Nomor rekening: " + acc, "info");
        });
      }
    });
  });

  // Confirm Order Submission (Langsung di Web + Munculkan Struk Digital)
  if (confirmOrderBtn) {
    confirmOrderBtn.addEventListener("click", () => {
      const customerName = (customerNameInput ? customerNameInput.value : "").trim();
      const tableNumber = (tableNumberInput ? tableNumberInput.value : "").trim();
      const notes = (orderNotesInput ? orderNotesInput.value : "").trim();

      // Form Validation
      if (!customerName) {
        alert("Mohon masukkan nama pembeli terlebih dahulu!");
        if (customerNameInput) customerNameInput.focus();
        return;
      }

      if (selectedOrderType === "dine-in" && !tableNumber) {
        alert("Mohon masukkan nomor meja untuk pemesanan Dine In!");
        if (tableNumberInput) tableNumberInput.focus();
        return;
      }

      // Execute Transaction
      const orderPayload = {
        customerName,
        orderType: selectedOrderType,
        tableNumber: selectedOrderType === "takeaway" ? "Takeaway (Bungkus)" : tableNumber,
        notes,
        paymentMethod: selectedPaymentMethod
      };

      const result = StorageManager.createTransaction(orderPayload);

      if (!result.success) {
        alert(result.message || "Gagal memproses transaksi.");
        return;
      }

      // Transaction Success!
      closeCheckoutModal();

      // Update Catalog UI & Badges
      renderProducts();
      updateGlobalBadges();

      // Notifikasi Toast Pesanan Berhasil
      showToast("🎉 Pesanan berhasil diproses! Silakan tunjukkan struk ke kasir.", "success");

      // Tampilkan Pop-up Struk Digital di Web untuk Ditunjukkan ke Kasir
      openReceiptModal(result.transaction);
    });
  }

  // ===================================================
  // 7. SUCCESS RECEIPT MODAL (STRUK DIGITAL KASIR)
  // ===================================================
  function openReceiptModal(transaction) {
    if (!transaction) return;

    if (receiptTxId) receiptTxId.textContent = transaction.id;
    if (receiptCustomerName) {
      receiptCustomerName.textContent = transaction.customerName + (transaction.campus ? ` (${transaction.campus})` : "");
    }
    if (receiptTableInfo) receiptTableInfo.textContent = transaction.tableNumber;
    if (receiptDateTime) receiptDateTime.textContent = transaction.dateFormatted;
    if (receiptPaymentMethod) receiptPaymentMethod.textContent = transaction.paymentMethod;

    if (receiptSubtotal) {
      receiptSubtotal.textContent = formatRupiah(transaction.subtotal || transaction.total);
    }

    if (receiptDiscountRow) {
      if (transaction.discount && transaction.discount > 0) {
        receiptDiscountRow.style.display = "flex";
        if (receiptDiscountLabel) {
          receiptDiscountLabel.textContent = `${transaction.discountLabel || "Diskon Member (10%)"}:`;
        }
        if (receiptDiscountAmount) {
          receiptDiscountAmount.textContent = `- ${formatRupiah(transaction.discount)}`;
        }
      } else {
        receiptDiscountRow.style.display = "none";
      }
    }

    if (receiptGrandTotal) receiptGrandTotal.textContent = formatRupiah(transaction.total);

    if (receiptItemsTableBody) {
      receiptItemsTableBody.innerHTML = transaction.items.map(item => `
        <tr>
          <td>${item.productName}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: right; font-family: var(--font-comic); font-weight: 700;">
            ${formatRupiah(item.subtotal)}
          </td>
        </tr>
      `).join("");
    }

    if (receiptModalBackdrop) receiptModalBackdrop.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeReceiptModal() {
    if (receiptModalBackdrop) receiptModalBackdrop.classList.remove("active");
    document.body.style.overflow = "";
  }

  if (receiptCloseBtn) receiptCloseBtn.addEventListener("click", closeReceiptModal);
  if (orderAgainBtn) {
    orderAgainBtn.addEventListener("click", () => {
      closeReceiptModal();
      const menuSection = document.getElementById("menu");
      if (menuSection) menuSection.scrollIntoView({ behavior: "smooth" });
    });
  }
  if (viewHistoryFromReceiptBtn) {
    viewHistoryFromReceiptBtn.addEventListener("click", () => {
      closeReceiptModal();
      openHistoryModal();
    });
  }
  if (printReceiptBtn) {
    printReceiptBtn.addEventListener("click", () => {
      window.print();
    });
  }

  // ===================================================
  // 7b. FITUR AKUN MEMBER MAHASISWA & NOTIFIKASI WA
  // ===================================================
  // ===================================================
  // 7b. FITUR AKUN MEMBER MAHASISWA (2-TAB: LOGIN & DAFTAR)
  // ===================================================
  function switchMemberTab(tabName) {
    if (tabName === "login") {
      if (tabLoginBtn) tabLoginBtn.classList.add("active");
      if (tabRegisterBtn) tabRegisterBtn.classList.remove("active");
      if (memberLoginView) memberLoginView.style.display = "flex";
      if (memberRegisterView) memberRegisterView.style.display = "none";
      if (memberModalTitle) memberModalTitle.textContent = "Masuk Akun Member";
      setTimeout(() => {
        if (memberLoginPhone) memberLoginPhone.focus();
      }, 150);
    } else {
      if (tabRegisterBtn) tabRegisterBtn.classList.add("active");
      if (tabLoginBtn) tabLoginBtn.classList.remove("active");
      if (memberRegisterView) memberRegisterView.style.display = "flex";
      if (memberLoginView) memberLoginView.style.display = "none";
      if (memberModalTitle) memberModalTitle.textContent = "Buat Akun Member Baru";
      setTimeout(() => {
        if (memberFormName) memberFormName.focus();
      }, 150);
    }
  }

  function openMemberModal() {
    const isMember = StorageManager.isMember();
    const currentMember = StorageManager.getMember();

    if (isMember && currentMember) {
      // User SUDAH Login: Tampilkan langsung Kartu Digital Member Mahasiswa
      if (memberTabsNav) memberTabsNav.style.display = "none";
      if (memberLoginView) memberLoginView.style.display = "none";
      if (memberRegisterView) memberRegisterView.style.display = "none";
      if (memberCardView) memberCardView.style.display = "flex";

      if (cardMemberId) cardMemberId.textContent = currentMember.memberId || `KM-MBR-${(currentMember.phone || "0000").slice(-4)}`;
      if (cardMemberName) cardMemberName.textContent = currentMember.name || "Mahasiswa";
      if (cardMemberCampus) cardMemberCampus.textContent = currentMember.campus || "Universitas";
      if (cardMemberPhone) cardMemberPhone.textContent = currentMember.phone || "-";
      if (memberModalTitle) memberModalTitle.textContent = "Kartu Member Digital Mahasiswa";
    } else {
      // User BELUM Login: Tampilkan 2 Tab Pilihan (Login & Daftar)
      if (memberTabsNav) memberTabsNav.style.display = "flex";
      if (memberCardView) memberCardView.style.display = "none";
      switchMemberTab("login");
    }

    if (memberModalBackdrop) memberModalBackdrop.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeMemberModal() {
    if (memberModalBackdrop) memberModalBackdrop.classList.remove("active");
    document.body.style.overflow = "";
  }

  // Listener Tab & Switch Links
  if (tabLoginBtn) tabLoginBtn.addEventListener("click", () => switchMemberTab("login"));
  if (tabRegisterBtn) tabRegisterBtn.addEventListener("click", () => switchMemberTab("register"));
  if (linkToRegister) linkToRegister.addEventListener("click", () => switchMemberTab("register"));
  if (linkToLogin) linkToLogin.addEventListener("click", () => switchMemberTab("login"));

  // Listener Tombol Member di Header, Mobile Drawer, dan Modal
  if (memberBtn) memberBtn.addEventListener("click", openMemberModal);
  if (drawerMemberBtn) {
    drawerMemberBtn.addEventListener("click", () => {
      toggleMobileMenu(false);
      openMemberModal();
    });
  }
  if (memberModalCloseBtn) memberModalCloseBtn.addEventListener("click", closeMemberModal);
  if (memberDoneBtn) memberDoneBtn.addEventListener("click", closeMemberModal);

  // 1. TAB LOGIN: Handler Masuk Akun Member Lama (Murni Nomor HP)
  if (memberLoginForm) {
    memberLoginForm.addEventListener("submit", handleMemberLogin);
  }
  if (memberLoginSubmitBtn) {
    memberLoginSubmitBtn.addEventListener("click", handleMemberLogin);
  }

  async function handleMemberLogin(e) {
    if (e && e.preventDefault) e.preventDefault();

    const rawPhone = (memberLoginPhone ? memberLoginPhone.value : "").trim();

    if (!rawPhone) {
      alert("Mohon masukkan nomor HP terdaftar Anda!");
      if (memberLoginPhone) memberLoginPhone.focus();
      return;
    }

    // Tampilkan indikator loading di tombol login
    const origBtnContent = memberLoginSubmitBtn ? memberLoginSubmitBtn.innerHTML : "";
    if (memberLoginSubmitBtn) {
      memberLoginSubmitBtn.disabled = true;
      memberLoginSubmitBtn.innerHTML = "<span>⏳ Memverifikasi Akun...</span>";
    }

    const resetBtn = () => {
      if (memberLoginSubmitBtn) {
        memberLoginSubmitBtn.disabled = false;
        memberLoginSubmitBtn.innerHTML = origBtnContent;
      }
    };

    let member = null;
    let waSentStatus = false;
    let botServerOnline = false;

    // Normalisasi format nomor HP (mengatasi awalan 08xxx vs 628xxx)
    const cleanDigits = rawPhone.replace(/\D/g, "");
    const normalizedPhone = cleanDigits.startsWith("0")
      ? "62" + cleanDigits.slice(1)
      : (cleanDigits.startsWith("8") ? "62" + cleanDigits : cleanDigits);

    let loginSuccess = false;

    // ============================================================
    // TAHAP 1: DIRECT FETCH KE BOT NODE.JS PORT 3000
    // Sesuai sistem utama yang terbukti berhasil mengirim chat WA
    // ============================================================
    try {
      const directRes = await fetch("http://localhost:3000/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: rawPhone, nomorHp: normalizedPhone })
      });

      if (directRes.ok) {
        const data = await directRes.json().catch(() => null);
        console.log("📥 [Login Direct Bot 3000]:", data);
        if (data && data.success === true) {
          member = data.member || { name: "Member", phone: normalizedPhone };
          loginSuccess = true;
          waSentStatus = (data.waSent === true || !data.waError);
          botServerOnline = true;
        } else if (data && data.message) {
          showToast(`⚠️ ${data.message}`, "warning");
          setTimeout(() => { switchMemberTab("register"); if (memberFormPhone) memberFormPhone.value = rawPhone; }, 1200);
          resetBtn();
          return;
        }
      }
    } catch (directErr) {
      console.warn("ℹ️ [Direct Bot 3000 Offline/Mixed]:", directErr.message);
    }

    // ============================================================
    // TAHAP 2: PROXY PHP / bot-proxy.php (Jika diakses via HTTPS)
    // ============================================================
    if (!loginSuccess) {
      try {
        const res = await fetch("bot-proxy.php?action=login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: normalizedPhone })
        });
        const data = await res.json().catch(() => null);
        console.log("📥 [Login via bot-proxy.php]:", data);

        if (data && data.botOnline) botServerOnline = true;

        if (data && data.success === true) {
          member = data.member || { name: "Member", phone: normalizedPhone };
          loginSuccess = true;
          waSentStatus = (data.waSent === true || !data.waError);
        }
      } catch (proxyErr) {
        console.warn("⚠️ [Login] bot-proxy.php:", proxyErr.message);
      }
    }

    // ============================================================
    // TAHAP 3: login.php (backend PHP Laragon)
    // ============================================================
    if (!loginSuccess) {
      try {
        const res = await fetch("login.php", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ phone: normalizedPhone })
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && data.success === true) {
            member = data.member || { name: "Member", phone: normalizedPhone };
            loginSuccess = true;
            if (data.waSent === true) waSentStatus = true;
            if (data.waDetail) botServerOnline = true;
          }
        }
      } catch (e) {}
    }

    // ============================================================
    // TAHAP 4: Fallback ke members.json (Database File)
    // ============================================================
    if (!loginSuccess) {
      try {
        const mRes = await fetch("members.json?_t=" + Date.now());
        if (mRes.ok) {
          const list = await mRes.json();
          if (Array.isArray(list)) {
            localStorage.setItem("km_members_list", JSON.stringify(list));
            const found = list.find(m => {
              const p = String(m.cleanPhone || m.phone || "").replace(/\D/g, "");
              const pNorm = p.startsWith("0") ? "62" + p.slice(1) : p;
              return p === cleanDigits || pNorm === normalizedPhone || p === normalizedPhone;
            });
            if (found) { member = found; loginSuccess = true; }
          }
        }
      } catch (e) {}
    }

    // ============================================================
    // TAHAP 5: Fallback ke localStorage
    // ============================================================
    if (!loginSuccess) {
      const lr = StorageManager.loginMemberByPhone(rawPhone);
      if (lr.success) { member = lr.member; loginSuccess = true; }
    }

    if (!loginSuccess || !member) {
      showToast("⚠️ Nomor HP belum terdaftar, silakan buat akun baru dulu!", "warning");
      setTimeout(() => { switchMemberTab("register"); if (memberFormPhone) memberFormPhone.value = rawPhone; }, 1200);
      resetBtn();
      return;
    }

    if (member) StorageManager.saveMember(member);
    resetBtn();

    // Tampilkan Kartu Member Digital
    if (memberTabsNav) memberTabsNav.style.display = "none";
    if (memberLoginView) memberLoginView.style.display = "none";
    if (memberRegisterView) memberRegisterView.style.display = "none";
    if (memberCardView) memberCardView.style.display = "flex";

    if (cardMemberId) cardMemberId.textContent = member.memberId || `KM-MBR-${(member.phone || rawPhone).slice(-4)}`;
    if (cardMemberName) cardMemberName.textContent = member.name || "Member Mahasiswa";
    if (cardMemberCampus) cardMemberCampus.textContent = member.campus || "Mahasiswa";
    if (cardMemberPhone) cardMemberPhone.textContent = member.phone || rawPhone;
    if (memberModalTitle) memberModalTitle.textContent = "Kartu Member Digital Mahasiswa";

    updateGlobalBadges();
    renderCartDrawer();
    showToast(`🎉 Selamat datang kembali, ${member.name || "Sobat Ngopi"}! Akun Member aktif.`, "success");
    setTimeout(() => {
      if (waSentStatus) {
        showToast(`📲 Notifikasi WhatsApp berhasil dikirim ke (${member.phone || rawPhone})!`, "success");
      } else {
        showToast(`📲 Permintaan notifikasi login telah diteruskan ke WhatsApp!`, "info");
      }
    }, 1200);
  }

  // 2. TAB DAFTAR: Form Submit Pendaftaran Member Baru
  if (memberRegisterForm) {
    memberRegisterForm.addEventListener("submit", handleMemberRegistration);
  }
  if (memberSubmitBtn) {
    memberSubmitBtn.addEventListener("click", handleMemberRegistration);
  }

  let isSubmittingMember = false;
  function handleMemberRegistration(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmittingMember) return;
    isSubmittingMember = true;
    setTimeout(() => { isSubmittingMember = false; }, 1000);

    const name = (memberFormName ? memberFormName.value : "").trim();
    const campus = (memberFormCampus ? memberFormCampus.value : "").trim();
    const rawPhone = (memberFormPhone ? memberFormPhone.value : "").trim();

    // Validasi WAJIB Nama, Kampus, dan Nomor WhatsApp
    if (!name) {
      alert("Mohon masukkan Nama Lengkap / Panggilan Anda!");
      if (memberFormName) memberFormName.focus();
      return;
    }
    if (!campus) {
      alert("Mohon masukkan Asal Kampus / Universitas Anda!");
      if (memberFormCampus) memberFormCampus.focus();
      return;
    }
    if (!rawPhone) {
      alert("Mohon masukkan Nomor WhatsApp aktif Anda!");
      if (memberFormPhone) memberFormPhone.focus();
      return;
    }

    // Bersihkan nomor WhatsApp untuk format standar angka
    let cleanPhone = rawPhone.replace(/[^0-9]/g, "");
    if (cleanPhone.startsWith("0")) {
      cleanPhone = "62" + cleanPhone.slice(1);
    } else if (!cleanPhone.startsWith("62")) {
      cleanPhone = "62" + cleanPhone;
    }

    // Simpan Data Member ke Storage (Termasuk ke list seluruh member)
    const memberId = `KM-MBR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newMember = {
      name,
      campus,
      phone: rawPhone,
      waPhone: cleanPhone,
      memberId,
      registeredAt: new Date().toISOString(),
      welcomeDiscountUsed: false,
      weeklyPromoActive: true
    };

    StorageManager.saveMember(newMember);

    // Tampilkan Pop-up KARTU MEMBER DIGITAL di Layar Web
    if (memberTabsNav) memberTabsNav.style.display = "none";
    if (memberLoginView) memberLoginView.style.display = "none";
    if (memberRegisterView) memberRegisterView.style.display = "none";
    if (memberCardView) memberCardView.style.display = "flex";

    if (cardMemberId) cardMemberId.textContent = newMember.memberId;
    if (cardMemberName) cardMemberName.textContent = newMember.name;
    if (cardMemberCampus) cardMemberCampus.textContent = newMember.campus;
    if (cardMemberPhone) cardMemberPhone.textContent = newMember.phone;
    if (memberModalTitle) memberModalTitle.textContent = "Kartu Member Digital Mahasiswa";

    // Update Tampilan Web (Header & Keranjang)
    updateGlobalBadges();
    renderCartDrawer();

    // Picu Notifikasi Toast Sukses
    showToast(`🎓 Selamat ${name}! Akun Member Kopi Mahasiswa kamu (${campus}) aktif. Welcome Discount 10% siap digunakan!`, "success");

    // Panggil API Bot WA di latar belakang (background fetch via relative/https/http)
    try {
      const botApiBase = (typeof window.BOT_API_BASE !== "undefined")
        ? window.BOT_API_BASE
        : (window.location.protocol === "https:" ? "" : "http://localhost:3000");

      fetch(`${botApiBase}/api/notif-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name,
          campus: campus,
          phone: rawPhone,
          cleanPhone: cleanPhone
        })
      })
      .then(res => res.json())
      .then(data => console.log('Bot WA sukses kirim notifikasi:', data))
      .catch(err => console.log('Bot WA offline / gagal kirim:', err));
    } catch (err) {
      console.log('Bot WA offline / gagal kirim:', err);
    }
  }

  // ===================================================
  // 7c. FITUR GANTI AKUN / LOGOUT MEMBER
  // ===================================================
  function handleMemberLogout() {
    if (confirm("Apakah Anda ingin mengganti akun / keluar dari status member?")) {
      StorageManager.removeMember();
      updateGlobalBadges();
      renderCartDrawer();
      showToast("🔄 Berhasil Ganti Akun. Akun member telah di-logout.", "info");

      // Beralih ke form login member
      if (memberTabsNav) memberTabsNav.style.display = "flex";
      if (memberCardView) memberCardView.style.display = "none";
      if (memberLoginPhone) memberLoginPhone.value = "";
      if (memberFormName) memberFormName.value = "";
      if (memberFormCampus) memberFormCampus.value = "";
      if (memberFormPhone) memberFormPhone.value = "";

      switchMemberTab("login");

      if (memberModalBackdrop) memberModalBackdrop.classList.add("active");
      document.body.style.overflow = "hidden";
    }
  }

  // Pasang Handler Ganti Akun / Logout
  if (memberSwitchBtn) memberSwitchBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handleMemberLogout();
  });
  if (memberLogoutBtn) memberLogoutBtn.addEventListener("click", handleMemberLogout);
  if (drawerMemberLogoutBtn) {
    drawerMemberLogoutBtn.addEventListener("click", () => {
      toggleMobileMenu(false);
      handleMemberLogout();
    });
  }

  // ===================================================
  // 8. ORDER HISTORY MODAL ("RIWAYAT PESANAN")
  // ===================================================
  function openHistoryModal() {
    renderHistoryList();
    if (historyModalBackdrop) historyModalBackdrop.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function closeHistoryModal() {
    if (historyModalBackdrop) historyModalBackdrop.classList.remove("active");
    document.body.style.overflow = "";
  }

  function renderHistoryList() {
    if (!historyListContainer) return;

    const transactions = StorageManager.getTransactions();

    if (transactions.length === 0) {
      historyListContainer.innerHTML = `
        <div class="cart-empty-state" style="padding: 40px 20px;">
          <div class="cart-empty-icon">📜☕</div>
          <h4 class="cart-empty-title">Belum Ada Riwayat Transaksi</h4>
          <p class="cart-empty-desc">Pesanan yang Anda buat akan tercatat rapi di sini.</p>
          <button class="btn-primary" id="historyStartOrderBtn" style="padding: 10px 20px;">
            Pesan Menu Sekarang
          </button>
        </div>
      `;
      const startBtn = document.getElementById("historyStartOrderBtn");
      if (startBtn) {
        startBtn.addEventListener("click", () => {
          closeHistoryModal();
          const menuSection = document.getElementById("menu");
          if (menuSection) menuSection.scrollIntoView({ behavior: "smooth" });
        });
      }
      return;
    }

    historyListContainer.innerHTML = `
      <div class="history-list">
        ${transactions.map(tx => {
          const itemsSummary = tx.items.map(i => `${i.productName} (${i.quantity}x)`).join(", ");
          return `
            <div class="history-card">
              <div class="history-card-header">
                <span class="history-tx-id">${tx.id}</span>
                <span class="history-date">📅 ${tx.dateFormatted}</span>
                <span class="history-status-badge">✓ ${tx.status || 'Berhasil'}</span>
              </div>
              
              <div class="history-card-meta">
                <span>👤 <strong>${tx.customerName}</strong></span>
                <span>🪑 ${tx.tableNumber}</span>
                <span>💳 ${tx.paymentMethod}</span>
              </div>
              
              <div class="history-items-summary">
                <strong>Pesanan:</strong> ${itemsSummary}
                ${tx.notes ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;"><em>Catatan: ${tx.notes}</em></div>` : ''}
              </div>
              
              <div class="history-card-footer">
                <span style="font-size: 0.85rem; color: var(--text-muted);">Total Pembayaran:</span>
                <span class="history-total-val">${formatRupiah(tx.total)}</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  if (navHistoryBtn) navHistoryBtn.addEventListener("click", openHistoryModal);
  if (drawerHistoryBtn) {
    drawerHistoryBtn.addEventListener("click", () => {
      toggleMobileMenu(false);
      openHistoryModal();
    });
  }
  if (historyCloseBtn) historyCloseBtn.addEventListener("click", closeHistoryModal);
  if (historyDoneBtn) historyDoneBtn.addEventListener("click", closeHistoryModal);

  // ===================================================
  // 9. CATEGORY FILTER & SEARCH
  // ===================================================
  function updateActiveCategoryButton() {
    categoryBtns.forEach(btn => {
      if (btn.getAttribute("data-category") === currentCategory) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  categoryBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const selected = btn.getAttribute("data-category");
      if (selected === currentCategory) return;

      currentCategory = selected;
      updateActiveCategoryButton();

      if (productGrid) {
        productGrid.classList.add("fade-out");
        setTimeout(() => {
          renderProducts();
          productGrid.classList.remove("fade-out");
        }, 120);
      } else {
        renderProducts();
      }
    });
  });

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      searchQuery = e.target.value.trim();
      if (searchClearBtn) {
        searchClearBtn.style.display = searchQuery.length > 0 ? "block" : "none";
      }
      renderProducts();
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
        searchQuery = "";
        searchClearBtn.style.display = "none";
        searchInput.focus();
        renderProducts();
      }
    });
  }

  // ===================================================
  // 10. NAVBAR SCROLL & MOBILE DRAWER
  // ===================================================
  window.addEventListener("scroll", () => {
    if (navbarHeader) {
      if (window.scrollY > 20) {
        navbarHeader.classList.add("scrolled");
      } else {
        navbarHeader.classList.remove("scrolled");
      }
    }
  });

  function toggleMobileMenu(isOpen) {
    if (mobileToggleBtn) mobileToggleBtn.classList.toggle("open", isOpen);
    if (mobileNavDrawer) mobileNavDrawer.classList.toggle("active", isOpen);
    if (mobileNavBackdrop) mobileNavBackdrop.classList.toggle("active", isOpen);
    document.body.style.overflow = isOpen ? "hidden" : "";
  }

  if (mobileToggleBtn) {
    mobileToggleBtn.addEventListener("click", () => {
      const isOpen = mobileNavDrawer && mobileNavDrawer.classList.contains("active");
      toggleMobileMenu(!isOpen);
    });
  }

  if (drawerCloseBtn) drawerCloseBtn.addEventListener("click", () => toggleMobileMenu(false));
  if (mobileNavBackdrop) mobileNavBackdrop.addEventListener("click", () => toggleMobileMenu(false));

  drawerLinks.forEach(link => {
    if (link !== drawerHistoryBtn) {
      link.addEventListener("click", () => toggleMobileMenu(false));
    }
  });

  // ===================================================
  // 11. YOUTUBE LO-FI MUSIC PLAYER CONTROLLER (DELEGATED TO KOPI MUSIC PLAYER)
  // ===================================================
  // Logika pemutar YouTube Lofi sekarang ditangani secara terpusat dan estetik
  // oleh KopiMusicPlayer di js/music-player.js dengan dukungan 6 lagu kurasi
  // (Zelda, Kingdom Hearts, Saiki K, Lamp), auto-next playlist, dan turntable vinyl aesthetic.

  // ===================================================
  // 12. INITIAL RUN
  // ===================================================
  updateGlobalBadges();
  renderProducts();

  // ===================================================
  // 13. OWNER PIN MODAL (dibuka dari footer link)
  // ===================================================
  const OWNER_VALID_PINS = ["1234", "owner2026"];
  let ownerPinAttempts = 0;
  const MAX_OWNER_ATTEMPTS = 5;

  const ownerPinBackdrop   = document.getElementById("ownerPinModalBackdrop");
  const ownerPinInput      = document.getElementById("ownerPinInput");
  const ownerPinSubmitBtn  = document.getElementById("ownerPinSubmitBtn");
  const ownerPinCancelBtn  = document.getElementById("ownerPinCancelBtn");
  const ownerPinCloseBtn   = document.getElementById("ownerPinCloseBtn");
  const ownerPinPeekBtn    = document.getElementById("ownerPinPeekBtn");
  const ownerPinErrorMsg   = document.getElementById("ownerPinErrorMsg");
  const ownerPinAttemptInfo  = document.getElementById("ownerPinAttemptInfo");
  const ownerPinAttemptCount = document.getElementById("ownerPinAttemptCount");

  function openOwnerPinModal() {
    if (!ownerPinBackdrop) return;
    ownerPinAttempts = 0;
    if (ownerPinInput) { ownerPinInput.value = ""; ownerPinInput.type = "password"; }
    if (ownerPinErrorMsg) ownerPinErrorMsg.style.display = "none";
    if (ownerPinAttemptInfo) ownerPinAttemptInfo.style.display = "none";
    ownerPinBackdrop.classList.add("active");
    document.body.style.overflow = "hidden";
    setTimeout(() => { if (ownerPinInput) ownerPinInput.focus(); }, 200);
  }

  function closeOwnerPinModal() {
    if (ownerPinBackdrop) ownerPinBackdrop.classList.remove("active");
    document.body.style.overflow = "";
    if (ownerPinInput) ownerPinInput.value = "";
    if (ownerPinErrorMsg) ownerPinErrorMsg.style.display = "none";
    if (ownerPinAttemptInfo) ownerPinAttemptInfo.style.display = "none";
  }

  function verifyOwnerPin() {
    const entered = ownerPinInput ? ownerPinInput.value.trim() : "";
    if (!entered) {
      if (ownerPinInput) ownerPinInput.focus();
      return;
    }

    if (OWNER_VALID_PINS.includes(entered)) {
      // Success — redirect to owner.html
      sessionStorage.setItem("kopi_owner_verified", "true");
      closeOwnerPinModal();
      window.location.href = "owner.html";
    } else {
      // Wrong PIN
      ownerPinAttempts++;
      if (ownerPinErrorMsg) {
        ownerPinErrorMsg.style.display = "block";
        ownerPinErrorMsg.textContent = ownerPinAttempts >= 3
          ? `❌ PIN salah. Tersisa ${MAX_OWNER_ATTEMPTS - ownerPinAttempts} percobaan.`
          : "❌ PIN / Password salah. Coba lagi.";
      }
      if (ownerPinAttempts >= 2) {
        if (ownerPinAttemptInfo) {
          ownerPinAttemptInfo.style.display = "block";
          if (ownerPinAttemptCount) ownerPinAttemptCount.textContent = ownerPinAttempts;
        }
      }

      // Shake the input
      const pinCard = ownerPinBackdrop ? ownerPinBackdrop.querySelector(".modal-card") : null;
      if (pinCard) {
        pinCard.classList.add("shake-animation");
        setTimeout(() => pinCard.classList.remove("shake-animation"), 450);
      }
      if (ownerPinInput) { ownerPinInput.value = ""; ownerPinInput.focus(); }

      // Lockout after max attempts
      if (ownerPinAttempts >= MAX_OWNER_ATTEMPTS) {
        if (ownerPinSubmitBtn) {
          ownerPinSubmitBtn.disabled = true;
          ownerPinSubmitBtn.textContent = "🔒 Akses Dikunci";
        }
        if (ownerPinErrorMsg) {
          ownerPinErrorMsg.textContent = "🔒 Terlalu banyak percobaan salah. Hubungi admin.";
        }
        if (ownerPinInput) ownerPinInput.disabled = true;
      }
    }
  }

  if (ownerPinSubmitBtn) ownerPinSubmitBtn.addEventListener("click", verifyOwnerPin);
  if (ownerPinCancelBtn) ownerPinCancelBtn.addEventListener("click", closeOwnerPinModal);
  if (ownerPinCloseBtn)  ownerPinCloseBtn.addEventListener("click", closeOwnerPinModal);

  // Enter key support
  if (ownerPinInput) {
    ownerPinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") verifyOwnerPin();
      if (e.key === "Escape") closeOwnerPinModal();
    });
  }

  // Toggle peek (show/hide PIN)
  if (ownerPinPeekBtn && ownerPinInput) {
    ownerPinPeekBtn.addEventListener("click", () => {
      ownerPinInput.type = ownerPinInput.type === "password" ? "text" : "password";
      ownerPinPeekBtn.textContent = ownerPinInput.type === "password" ? "👁️" : "🙈";
    });
  }

  // Close on backdrop click
  if (ownerPinBackdrop) {
    ownerPinBackdrop.addEventListener("click", (e) => {
      if (e.target === ownerPinBackdrop) closeOwnerPinModal();
    });
  }

  // Wire the Footer Owner links to open the PIN modal
  document.querySelectorAll(".footer-owner-link, [href='owner.html'], [href='#owner']").forEach(link => {
    link.addEventListener("click", (e) => {
      // Don't intercept if it's NOT an anchor pointing to owner page
      const href = link.getAttribute("href");
      if (href === "owner.html" || href === "#owner") {
        e.preventDefault();
        openOwnerPinModal();
      }
    });
  });

  // ===================================================
  // 14. PRINT THERMAL RECEIPT  (Customer → window.print())
  // ===================================================
  function formatRupiahPrint(num) {
    return "Rp " + Number(num || 0).toLocaleString("id-ID");
  }

  function printReceipt(transaction) {
    if (!transaction) return;
    const printArea = document.getElementById("thermalPrintArea");
    if (!printArea) { window.print(); return; }

    const itemsRows = transaction.items.map(item => `
      <tr>
        <td style="padding: 1px 0;">${item.productName}</td>
        <td style="text-align:center; padding: 1px 4px;">${item.quantity}x</td>
        <td style="text-align:right; padding: 1px 0; white-space:nowrap;">${formatRupiahPrint(item.subtotal)}</td>
      </tr>
    `).join("");

    const now = new Date();
    const printTime = now.toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });

    printArea.innerHTML = `
      <div style="font-family:'Courier New',Courier,monospace; font-size:11px; color:#000; width:100%; max-width:320px; margin:0 auto; padding:8px 0;">
        <div style="text-align:center; border-bottom:1px dashed #000; padding-bottom:8px; margin-bottom:8px;">
          <div style="font-size:15px; font-weight:900; letter-spacing:2px;">☕ KOPI MAHASISWA</div>
          <div style="font-size:9px; margin-top:2px;">Jl. Kampus No. 1 · kopi-mahasiswa.id</div>
          <div style="font-size:9px;">Telp: (021) 000-0000</div>
        </div>

        <div style="margin-bottom:6px; line-height:1.6;">
          <div><b>No. Struk :</b> ${transaction.id}</div>
          <div><b>Tanggal   :</b> ${transaction.dateFormatted || printTime}</div>
          <div><b>Kasir     :</b> Kasir Otomatis</div>
          <div><b>Pelanggan :</b> ${transaction.customerName}</div>
          <div><b>Meja      :</b> ${transaction.tableNumber}</div>
          <div><b>Pembayaran:</b> ${transaction.paymentMethod}</div>
        </div>

        <div style="border-top:1px dashed #000; border-bottom:1px dashed #000; padding:6px 0; margin-bottom:6px;">
          <table style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px dashed #000;">
                <th style="text-align:left; padding-bottom:3px;">Item</th>
                <th style="text-align:center; padding-bottom:3px; width:30px;">Qty</th>
                <th style="text-align:right; padding-bottom:3px;">Harga</th>
              </tr>
            </thead>
            <tbody>${itemsRows}</tbody>
          </table>
        </div>

        <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:900; border-top:1px solid #000; padding-top:5px; margin-bottom:6px;">
          <span>TOTAL:</span>
          <span>${formatRupiahPrint(transaction.total)}</span>
        </div>

        ${transaction.notes ? `<div style="font-size:9px; font-style:italic; margin-bottom:6px;">Catatan: ${transaction.notes}</div>` : ""}

        <div style="text-align:center; border-top:1px dashed #000; padding-top:8px; font-size:9px; line-height:1.7;">
          <div>Terima kasih telah berkunjung!</div>
          <div>Selamat menikmati ☕</div>
          <div style="margin-top:4px; font-size:8px; color:#555;">Dicetak: ${printTime}</div>
        </div>
      </div>
    `;

    window.print();
  }

  // Wire print button inside the receipt modal
  if (printReceiptBtn) {
    printReceiptBtn.addEventListener("click", () => {
      // Grab the current receipt transaction from the modal data attributes
      const txId = receiptTxId ? receiptTxId.textContent : null;
      if (txId) {
        const transactions = StorageManager.getTransactions();
        const tx = transactions.find(t => t.id === txId);
        if (tx) { printReceipt(tx); return; }
      }
      // Fallback: just print whatever is visible
      window.print();
    });
  }

  // Expose printReceipt globally so admin.js can call it too
  window.printKopiReceipt = printReceipt;
});
