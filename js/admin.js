/**
 * KOPI MAHASISWA — ADMIN DASHBOARD CONTROLLER (PHASE 3)
 * Handles: Authentication, Analytics computation, Dynamic Charts,
 * Transaction filtering & details, Product CRUD, Stock management, and Printable Sales Reports.
 */

document.addEventListener("DOMContentLoaded", () => {
  // Ensure StorageManager is initialized
  if (typeof StorageManager !== "undefined") {
    StorageManager.init();
  }

  // Dengarkan event jika data produk disinkronkan dari MySQL
  window.addEventListener("kopi:products-synced", () => {
    if (typeof renderProductsView === "function") renderProductsView();
  });

  // State
  let currentTab = "dashboard";
  let dashboardTimeframe = "today";
  let txFilterTimeframe = "all";
  let txSearchQuery = "";
  let productFilterCategory = "all";
  let productSearchQuery = "";
  let salesChart = null;

  // ===================================================
  // 1. PROTOTYPE AUTHENTICATION
  // ===================================================
  const adminLoginScreen = document.getElementById("adminLoginScreen");
  const loginForm = document.getElementById("adminLoginForm");
  const usernameInput = document.getElementById("loginUsername");
  const passwordInput = document.getElementById("loginPassword");
  const loginErrorMsg = document.getElementById("loginErrorMsg");
  const logoutBtn = document.getElementById("logoutBtn");

  function checkAuth() {
    const isLoggedIn = sessionStorage.getItem("kopi_admin_logged_in") === "true";
    if (adminLoginScreen) {
      adminLoginScreen.style.display = isLoggedIn ? "none" : "flex";
    }
    if (isLoggedIn) {
      initDashboard();
    }
  }

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const user = (usernameInput.value || "").trim();
      const pass = (passwordInput.value || "").trim();

      if (user === "admin" && pass === "admin123") {
        sessionStorage.setItem("kopi_admin_logged_in", "true");
        if (loginErrorMsg) loginErrorMsg.style.display = "none";
        checkAuth();
      } else {
        if (loginErrorMsg) {
          loginErrorMsg.textContent = "Username atau password salah! (admin / admin123)";
          loginErrorMsg.style.display = "block";
        }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("kopi_admin_logged_in");
      localStorage.removeItem("kopi_admin_logged_in");
      localStorage.removeItem("km_auth_role");
      window.location.href = "login.php?action=logout";
    });
  }

  // ===================================================
  // 1b. TOPBAR ADMIN PROFILE DROPDOWN
  // ===================================================
  const adminProfileDropdownWrap = document.getElementById("adminProfileDropdownWrap");
  const adminProfileBtn = document.getElementById("adminProfileBtn");
  const headerLogoutBtn = document.getElementById("headerLogoutBtn");

  if (adminProfileBtn && adminProfileDropdownWrap) {
    adminProfileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isActive = adminProfileDropdownWrap.classList.toggle("active");
      adminProfileBtn.setAttribute("aria-expanded", isActive ? "true" : "false");
    });

    // Close dropdown on outside click
    document.addEventListener("click", (e) => {
      if (!adminProfileDropdownWrap.contains(e.target)) {
        adminProfileDropdownWrap.classList.remove("active");
        adminProfileBtn.setAttribute("aria-expanded", "false");
      }
    });

    // Close on Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && adminProfileDropdownWrap.classList.contains("active")) {
        adminProfileDropdownWrap.classList.remove("active");
        adminProfileBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  if (headerLogoutBtn) {
    headerLogoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("kopi_admin_logged_in");
      localStorage.removeItem("kopi_admin_logged_in");
      localStorage.removeItem("km_auth_role");
      window.location.href = "login.php?action=logout";
    });
  }

  // ===================================================
  // 2. SIDEBAR NAVIGATION & VIEW SWITCHER
  // ===================================================
  const navItems = document.querySelectorAll(".sidebar-nav-item[data-tab]");
  const views = document.querySelectorAll(".admin-view");
  const topbarPageTitle = document.getElementById("topbarPageTitle");
  const mobileSidebarToggle = document.getElementById("mobileSidebarToggle");
  const adminSidebar = document.getElementById("adminSidebar");

  const tabTitles = {
    dashboard: "Dashboard Ringkasan & Analitik",
    transactions: "Data & Histori Transaksi",
    products: "Kelola Menu & Stok Produk",
    reports: "Laporan Rekapitulasi Penjualan",
    members: "Data Member Terdaftar"
  };

  function switchTab(tabId) {
    currentTab = tabId;

    // Update active nav pill
    navItems.forEach(item => {
      if (item.getAttribute("data-tab") === tabId) item.classList.add("active");
      else item.classList.remove("active");
    });

    // Update visible view
    views.forEach(v => {
      if (v.id === `view-${tabId}`) v.classList.add("active");
      else v.classList.remove("active");
    });

    if (topbarPageTitle) {
      topbarPageTitle.textContent = tabTitles[tabId] || "Admin Portal";
    }

    // Close mobile sidebar if open
    if (adminSidebar) adminSidebar.classList.remove("mobile-open");

    // Render corresponding view data
    if (tabId === "dashboard") renderDashboard();
    else if (tabId === "transactions") renderTransactionsView();
    else if (tabId === "products") renderProductsView();
    else if (tabId === "reports") renderReportsView();
    else if (tabId === "members") renderMembersView();
  }

  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const tab = item.getAttribute("data-tab");
      switchTab(tab);
    });
  });

  if (mobileSidebarToggle && adminSidebar) {
    mobileSidebarToggle.addEventListener("click", () => {
      adminSidebar.classList.toggle("mobile-open");
    });
  }

  // ===================================================
  // HELPERS
  // ===================================================
  function formatRupiah(num) {
    return "Rp " + Number(num || 0).toLocaleString("id-ID");
  }

  /**
   * Cetak Struk Termal untuk Admin / Kasir
   * Membuka jendela print baru dengan layout termal 80mm
   */
  function printAdminReceipt(txId) {
    const transactions = StorageManager.getTransactions();
    const tx = transactions.find(t => t.id === txId);
    if (!tx) { alert("Data transaksi tidak ditemukan."); return; }

    const now = new Date();
    const printTime = now.toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });

    const itemsRows = tx.items.map(i => `
      <tr>
        <td style="padding:2px 0;">${i.productName}</td>
        <td style="text-align:center; width:28px;">${i.quantity}x</td>
        <td style="text-align:right; white-space:nowrap;">${formatRupiah(i.subtotal)}</td>
      </tr>
    `).join("");

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Struk #${tx.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      color: #000;
      background: #fff;
      width: 320px;
      margin: 0 auto;
      padding: 10px 8px;
    }
    .center { text-align: center; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .bold { font-weight: 900; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-weight: 700; border-bottom: 1px dashed #000; padding-bottom: 3px; }
    th:nth-child(2) { text-align: center; }
    th:last-child { text-align: right; }
    .total-row { font-size: 13px; font-weight: 900; display: flex; justify-content: space-between; padding-top: 5px; margin-top: 4px; border-top: 1px solid #000; }
    .footer-note { font-size: 9px; line-height: 1.7; text-align: center; margin-top: 8px; border-top: 1px dashed #000; padding-top: 6px; }
    @media print { @page { margin: 4mm; size: auto; } }
  </style>
</head>
<body>
  <div class="center bold" style="font-size:15px; letter-spacing:2px;">☕ KOPI MAHASISWA</div>
  <div class="center" style="font-size:9px; margin-top:2px;">Jl. Kampus No. 1 · kopi-mahasiswa.id</div>
  <div class="center" style="font-size:9px;">Telp: (021) 000-0000</div>

  <div class="divider"></div>

  <div style="line-height:1.6;">
    <div><b>No. Struk :</b> ${tx.id}</div>
    <div><b>Tanggal   :</b> ${tx.dateFormatted || printTime}</div>
    <div><b>Kasir     :</b> Admin / Kasir</div>
    <div><b>Pelanggan :</b> ${tx.customerName}</div>
    <div><b>Meja      :</b> ${tx.tableNumber}</div>
    <div><b>Pembayaran:</b> ${tx.paymentMethod}</div>
    ${tx.notes ? `<div><b>Catatan   :</b> <em>${tx.notes}</em></div>` : ""}
  </div>

  <div class="divider"></div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th style="text-align:center; width:28px;">Qty</th>
        <th style="text-align:right;">Harga</th>
      </tr>
    </thead>
    <tbody>${itemsRows}</tbody>
  </table>
  <div class="divider"></div>

  <div class="total-row">
    <span>TOTAL:</span>
    <span>${formatRupiah(tx.total)}</span>
  </div>

  <div class="footer-note">
    <div>Terima kasih telah berkunjung!</div>
    <div>Selamat menikmati ☕</div>
    <div style="margin-top:4px; font-size:8px;">Dicetak: ${printTime}</div>
  </div>
</body>
</html>`;

    const win = window.open("", "_blank", "width=380,height=600,scrollbars=yes");
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); }, 400);
    } else {
      alert("Pop-up diblokir browser. Harap izinkan pop-up untuk mencetak struk.");
    }
  }

  // ===================================================
  // 3. DASHBOARD VIEW & SUMMARY CARDS
  // ===================================================
  function initDashboard() {
    // Set Topbar Date
    const topbarDate = document.getElementById("topbarDate");
    if (topbarDate) {
      const now = new Date();
      topbarDate.textContent = now.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
      });
    }

    // Initialize Chart Engine
    if (typeof SalesChartEngine !== "undefined") {
      salesChart = new SalesChartEngine("salesChartCanvas");
    }

    renderDashboard();
  }

  function renderDashboard() {
    const analytics = StorageManager.getSalesAnalytics(dashboardTimeframe);

    // 1. Stat Cards
    const statRevenue = document.getElementById("statRevenue");
    const statOrders = document.getElementById("statOrders");
    const statItems = document.getElementById("statItems");
    const statBestseller = document.getElementById("statBestseller");
    const statBestsellerSub = document.getElementById("statBestsellerSub");

    if (statRevenue) statRevenue.textContent = formatRupiah(analytics.totalRevenue);
    if (statOrders) statOrders.textContent = analytics.totalTransactions;
    if (statItems) statItems.textContent = `${analytics.totalItemsSold} porsi`;
    if (statBestseller) statBestseller.textContent = analytics.topSellingProduct.name || "-";
    if (statBestsellerSub) statBestsellerSub.textContent = analytics.topSellingProduct.quantity ? `${analytics.topSellingProduct.quantity} porsi terjual` : "Belum ada penjualan";

    // 2. Top Selling Leaderboard
    const topSellingListContainer = document.getElementById("topSellingListContainer");
    if (topSellingListContainer) {
      if (analytics.topSellingList.length === 0) {
        topSellingListContainer.innerHTML = `
          <div style="text-align: center; padding: 24px; color: var(--text-muted);">
            Belum ada produk yang terjual pada periode ini.
          </div>
        `;
      } else {
        const top5 = analytics.topSellingList.slice(0, 5);
        topSellingListContainer.innerHTML = top5.map((item, idx) => {
          let rankClass = "";
          let rankLabel = `#${idx + 1}`;
          if (idx === 0) { rankClass = "rank-1"; rankLabel = "🥇"; }
          else if (idx === 1) { rankClass = "rank-2"; rankLabel = "🥈"; }
          else if (idx === 2) { rankClass = "rank-3"; rankLabel = "🥉"; }

          return `
            <div class="top-selling-item">
              <span class="rank-badge ${rankClass}">${rankLabel}</span>
              <div class="top-product-info">
                <span class="top-product-name">${item.name}</span>
                <span class="top-product-qty">${item.quantity} porsi terjual</span>
              </div>
              <span class="top-product-revenue">${formatRupiah(item.revenue)}</span>
            </div>
          `;
        }).join("");
      }
    }

    // 3. Payment Methods Breakdown
    const qrisAmount = document.getElementById("dashQrisAmount");
    const qrisCount = document.getElementById("dashQrisCount");
    const cashAmount = document.getElementById("dashCashAmount");
    const cashCount = document.getElementById("dashCashCount");

    if (qrisAmount) qrisAmount.textContent = formatRupiah(analytics.paymentBreakdown.qris.total);
    if (qrisCount) qrisCount.textContent = `${analytics.paymentBreakdown.qris.count} transaksi QRIS`;
    if (cashAmount) cashAmount.textContent = formatRupiah(analytics.paymentBreakdown.cash.total);
    if (cashCount) cashCount.textContent = `${analytics.paymentBreakdown.cash.count} transaksi Tunai`;

    // 4. Update Chart
    if (salesChart) {
      const chartData = StorageManager.getChartData(dashboardTimeframe);
      salesChart.render(chartData);
    }

    // 5. Render AI Business Insights
    renderAiInsights();
  }

  // AI Business Insights Generator
  function renderAiInsights() {
    const aiContainer = document.getElementById("aiInsightsContainer");
    const aiLastUpdatedText = document.getElementById("aiLastUpdatedText");
    if (!aiContainer || typeof AIEngine === "undefined") return;

    const transactions = StorageManager.getTransactions();
    const products = StorageManager.getProducts(true);
    const insights = AIEngine.getBusinessInsights(transactions, products, dashboardTimeframe);

    if (aiLastUpdatedText) {
      const now = new Date();
      aiLastUpdatedText.textContent = `Update: ${now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })} WIB`;
    }

    aiContainer.innerHTML = insights.map(item => `
      <div class="ai-insight-item">
        <div class="ai-insight-header">
          <span class="ai-insight-badge badge-${item.type}">${item.badge}</span>
        </div>
        <h4 class="ai-insight-title">${item.title}</h4>
        <p class="ai-insight-desc">${item.description.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</p>
        <button class="ai-insight-action-btn" data-tab="${item.actionTab}">
          ${item.actionText} →
        </button>
      </div>
    `).join("");

    // Attach click events on insight action buttons
    aiContainer.querySelectorAll(".ai-insight-action-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const targetTab = btn.getAttribute("data-tab");
        if (targetTab) switchTab(targetTab);
      });
    });
  }

  const refreshAiInsightsBtn = document.getElementById("refreshAiInsightsBtn");
  if (refreshAiInsightsBtn) {
    refreshAiInsightsBtn.addEventListener("click", () => {
      refreshAiInsightsBtn.innerHTML = `<span>⏳ Menganalisis...</span>`;
      setTimeout(() => {
        renderAiInsights();
        refreshAiInsightsBtn.innerHTML = `<span>🔄 Refresh Analisis AI</span>`;
      }, 400);
    });
  }

  // Timeframe Buttons Handler
  const chartTimeframeBtns = document.querySelectorAll(".timeframe-pill-btn");
  chartTimeframeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      chartTimeframeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      dashboardTimeframe = btn.getAttribute("data-tf") || "today";
      renderDashboard();
    });
  });

  // ===================================================
  // 4. DATA TRANSAKSI VIEW
  // ===================================================
  const txTableBody = document.getElementById("txTableBody");
  const txSearchInput = document.getElementById("txSearchInput");
  const txTimeFilterBtns = document.querySelectorAll(".tx-time-filter");

  function renderTransactionsView() {
    if (!txTableBody) return;

    let transactions = StorageManager.getTransactions();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Time filter
    if (txFilterTimeframe === "today") {
      transactions = transactions.filter(t => new Date(t.date) >= startOfToday);
    } else if (txFilterTimeframe === "7days") {
      const sevenDaysAgo = new Date(startOfToday);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      transactions = transactions.filter(t => new Date(t.date) >= sevenDaysAgo);
    } else if (txFilterTimeframe === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      transactions = transactions.filter(t => new Date(t.date) >= startOfMonth);
    }

    // Search filter
    if (txSearchQuery) {
      const q = txSearchQuery.toLowerCase();
      transactions = transactions.filter(t =>
        (t.id && t.id.toLowerCase().includes(q)) ||
        (t.customerName && t.customerName.toLowerCase().includes(q)) ||
        (t.tableNumber && t.tableNumber.toLowerCase().includes(q))
      );
    }

    if (transactions.length === 0) {
      txTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">
            Tidak ada data transaksi yang sesuai filter.
          </td>
        </tr>
      `;
      return;
    }

    txTableBody.innerHTML = transactions.map(t => `
      <tr>
        <td><strong style="color: var(--caramel-dark); font-family: var(--font-comic);">${t.id}</strong></td>
        <td style="font-size: 0.85rem;">${t.dateFormatted}</td>
        <td>
          <strong>${t.customerName}</strong>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${t.tableNumber}</div>
        </td>
        <td><strong style="font-family: var(--font-comic);">${formatRupiah(t.total)}</strong></td>
        <td>
          <span style="font-size: 0.82rem; font-weight: 700; color: ${t.paymentMethod === 'QRIS' ? '#2563EB' : '#16A34A'};">
            ${t.paymentMethod === 'QRIS' ? '📱 QRIS' : '💵 Tunai'}
          </span>
        </td>
        <td>
          <span class="status-pill status-active">✓ ${t.status || 'Berhasil'}</span>
        </td>
        <td style="display:flex; gap:6px; align-items:center;">
          <button class="btn-action-icon btn-detail" data-id="${t.id}" title="Lihat Rincian">
            👁️
          </button>
          <button class="btn-action-icon btn-print-receipt" data-id="${t.id}" title="Cetak Struk" style="background:rgba(22,163,74,0.12); color:#16A34A; border-color:#16A34A;">
            🖨️
          </button>
        </td>
      </tr>
    `).join("");

    // Attach Detail Handlers
    const detailBtns = txTableBody.querySelectorAll(".btn-detail");
    detailBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        openTxDetailModal(id);
      });
    });

    // Attach Print Receipt Handlers
    const printBtns = txTableBody.querySelectorAll(".btn-print-receipt");
    printBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        printAdminReceipt(id);
      });
    });
  }

  if (txSearchInput) {
    txSearchInput.addEventListener("input", (e) => {
      txSearchQuery = e.target.value.trim();
      renderTransactionsView();
    });
  }

  txTimeFilterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      txTimeFilterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      txFilterTimeframe = btn.getAttribute("data-tf") || "all";
      renderTransactionsView();
    });
  });

  // Transaction Detail Modal
  const txDetailModalBackdrop = document.getElementById("txDetailModalBackdrop");
  const txDetailCloseBtn = document.getElementById("txDetailCloseBtn");

  function openTxDetailModal(txId) {
    const transactions = StorageManager.getTransactions();
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;

    document.getElementById("modalDetailTxId").textContent = tx.id;
    document.getElementById("modalDetailCustomer").textContent = tx.customerName;
    document.getElementById("modalDetailTable").textContent = tx.tableNumber;
    document.getElementById("modalDetailDate").textContent = tx.dateFormatted;
    document.getElementById("modalDetailPayment").textContent = tx.paymentMethod;
    document.getElementById("modalDetailNotes").textContent = tx.notes || "-";
    document.getElementById("modalDetailTotal").textContent = formatRupiah(tx.total);

    const itemsTbody = document.getElementById("modalDetailItemsBody");
    if (itemsTbody) {
      itemsTbody.innerHTML = tx.items.map(i => `
        <tr>
          <td>${i.productName}</td>
          <td>${formatRupiah(i.price)}</td>
          <td style="text-align: center;">${i.quantity}</td>
          <td style="text-align: right; font-weight: 700;">${formatRupiah(i.subtotal)}</td>
        </tr>
      `).join("");
    }

    if (txDetailModalBackdrop) txDetailModalBackdrop.classList.add("active");

    // Wire print button inside detail modal
    const modalPrintBtn = document.getElementById("txDetailPrintBtn");
    if (modalPrintBtn) {
      modalPrintBtn.onclick = () => printAdminReceipt(tx.id);
    }
  }

  if (txDetailCloseBtn) {
    txDetailCloseBtn.addEventListener("click", () => {
      if (txDetailModalBackdrop) txDetailModalBackdrop.classList.remove("active");
    });
  }

  const txDetailCloseFooterBtn = document.getElementById("txDetailCloseFooterBtn");
  if (txDetailCloseFooterBtn) {
    txDetailCloseFooterBtn.addEventListener("click", () => {
      if (txDetailModalBackdrop) txDetailModalBackdrop.classList.remove("active");
    });
  }

  // ===================================================
  // 5. KELOLA PRODUK VIEW & CRUD OPERATIONS
  // ===================================================
  const productTableBody = document.getElementById("productTableBody");
  const productSearchInput = document.getElementById("productSearchInput");
  const productCategoryFilter = document.getElementById("productCategoryFilter");
  const addProductBtn = document.getElementById("addProductBtn");

  const productModalBackdrop = document.getElementById("productModalBackdrop");
  const productModalCloseBtn = document.getElementById("productModalCloseBtn");
  const productModalCancelBtn = document.getElementById("productModalCancelBtn");
  const productForm = document.getElementById("productForm");
  const productModalTitle = document.getElementById("productModalTitle");

  // Form Fields
  const prodIdInput = document.getElementById("prodIdInput");
  const prodNameInput = document.getElementById("prodNameInput");
  const prodCategorySelect = document.getElementById("prodCategorySelect");
  const prodPriceInput = document.getElementById("prodPriceInput");
  const prodStockInput = document.getElementById("prodStockInput");
  const prodBadgeInput = document.getElementById("prodBadgeInput");
  const prodImageInput = document.getElementById("prodImageInput");      // URL text input (new)
  const prodImagePreview = document.getElementById("prodImagePreview");  // <img> preview
  const prodImagePreviewWrap = document.getElementById("prodImagePreviewWrap");
  const prodImagePreviewPlaceholder = document.getElementById("prodImagePreviewPlaceholder");
  const prodDescInput = document.getElementById("prodDescInput");
  const prodTagsInput = document.getElementById("prodTagsInput");
  const prodActiveToggle = document.getElementById("prodActiveToggle");

  // Fungsi utilitas: tampilkan/sembunyikan preview gambar
  function updateImagePreview(url) {
    if (!prodImagePreview || !prodImagePreviewWrap) return;
    if (url && url.trim()) {
      prodImagePreview.src = url.trim();
      prodImagePreview.style.display = "block";
      if (prodImagePreviewPlaceholder) prodImagePreviewPlaceholder.style.display = "none";
      prodImagePreviewWrap.style.borderColor = "var(--caramel)";
      prodImagePreview.onerror = () => {
        // URL tidak valid / gambar gagal load
        prodImagePreview.style.display = "none";
        if (prodImagePreviewPlaceholder) prodImagePreviewPlaceholder.style.display = "block";
        prodImagePreviewWrap.style.borderColor = "#ef4444";
      };
      prodImagePreview.onload = () => {
        prodImagePreviewWrap.style.borderColor = "#22c55e";
      };
    } else {
      prodImagePreview.src = "";
      prodImagePreview.style.display = "none";
      if (prodImagePreviewPlaceholder) prodImagePreviewPlaceholder.style.display = "block";
      prodImagePreviewWrap.style.borderColor = "var(--border-subtle)";
    }
  }

  // Live preview saat user mengetik/paste URL
  if (prodImageInput) {
    prodImageInput.addEventListener("input", () => updateImagePreview(prodImageInput.value));
    prodImageInput.addEventListener("paste", () => {
      setTimeout(() => updateImagePreview(prodImageInput.value), 100);
    });
  }

  function renderProductsView() {
    if (!productTableBody) return;

    let products = StorageManager.getProducts(true);

    if (productCategoryFilter && productCategoryFilter.value !== "all") {
      products = products.filter(p => p.category === productCategoryFilter.value);
    }

    if (productSearchQuery) {
      const q = productSearchQuery.toLowerCase();
      products = products.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
      );
    }

    if (products.length === 0) {
      productTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">
            Tidak ada produk yang ditemukan.
          </td>
        </tr>
      `;
      return;
    }

    productTableBody.innerHTML = products.map(p => {
      const isOutOfStock = p.stock <= 0;
      const isLowStock = p.stock > 0 && p.stock <= 5;

      let stockBadgeHTML = `<span class="stock-indicator stock-normal">Stok: ${p.stock}</span>`;
      if (isOutOfStock) {
        stockBadgeHTML = `<span class="stock-indicator stock-empty">Stok Habis (0)</span>`;
      } else if (isLowStock) {
        stockBadgeHTML = `<span class="stock-indicator stock-low">⚡ Sisa ${p.stock}</span>`;
      }

      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 12px;">
              <img src="${p.image || (typeof DEFAULT_IMAGE !== 'undefined' ? DEFAULT_IMAGE : 'images/kopi-susu.jpg')}" alt="${p.name}" style="width: 44px; height: 44px; border-radius: var(--radius-xs); object-fit: cover; border: 1.5px solid var(--comic-border);" onerror="this.onerror=null; this.src='images/kopi-susu.jpg';">
              <div>
                <strong>${p.name}</strong>
                <div style="font-size: 0.75rem; color: var(--text-muted);">${p.badge}</div>
              </div>
            </div>
          </td>
          <td><span class="tag-pill">${p.categoryLabel}</span></td>
          <td><strong style="font-family: var(--font-comic); color: var(--caramel-dark);">${formatRupiah(p.price)}</strong></td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              ${stockBadgeHTML}
              <button class="btn-action-icon btn-edit-stock" data-id="${p.id}" data-stock="${p.stock}" title="Ubah Stok Cepat" style="width: 24px; height: 24px; font-size: 0.75rem;">
                ✏️
              </button>
            </div>
          </td>
          <td>
            <button class="status-pill ${p.active !== false ? 'status-active' : 'status-inactive'} btn-toggle-active" data-id="${p.id}">
              ${p.active !== false ? '✓ Aktif' : '✕ Nonaktif'}
            </button>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 6px;">
              <button class="btn-action-icon btn-edit btn-edit-product" data-id="${p.id}" title="Edit Produk">
                ✏️
              </button>
              <button class="btn-action-icon btn-delete btn-delete-product" data-id="${p.id}" data-name="${p.name}" title="Hapus Produk">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    attachProductTableActions();
  }

  function attachProductTableActions() {
    // Quick Stock Edit
    productTableBody.querySelectorAll(".btn-edit-stock").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const currentStock = btn.getAttribute("data-stock");
        const newStock = prompt(`Masukkan jumlah stok baru:`, currentStock);
        if (newStock !== null && !isNaN(Number(newStock))) {
          StorageManager.updateStockDirect(id, Number(newStock));
          renderProductsView();
        }
      });
    });

    // Toggle Active/Inactive
    productTableBody.querySelectorAll(".btn-toggle-active").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        StorageManager.toggleProductActive(id);
        renderProductsView();
      });
    });

    // Edit Product
    productTableBody.querySelectorAll(".btn-edit-product").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        openProductModal("edit", id);
      });
    });

    // Delete Product
    productTableBody.querySelectorAll(".btn-delete-product").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const name = btn.getAttribute("data-name");
        if (confirm(`Apakah Anda yakin ingin menghapus produk "${name}"?`)) {
          StorageManager.deleteProduct(id);
          renderProductsView();
        }
      });
    });
  }

  if (productSearchInput) {
    productSearchInput.addEventListener("input", (e) => {
      productSearchQuery = e.target.value.trim();
      renderProductsView();
    });
  }

  if (productCategoryFilter) {
    productCategoryFilter.addEventListener("change", () => {
      renderProductsView();
    });
  }

  // Open Product Form Modal (Add / Edit)
  function openProductModal(mode = "add", productId = null) {
    if (productForm) productForm.reset();

    if (mode === "add") {
      if (productModalTitle) productModalTitle.textContent = "Tambah Menu Produk Baru";
      if (prodIdInput) prodIdInput.value = "";
      if (prodStockInput) prodStockInput.value = 20;
      if (prodPriceInput) prodPriceInput.value = 15000;
      if (prodActiveToggle) prodActiveToggle.checked = true;
    } else {
      if (productModalTitle) productModalTitle.textContent = "Edit Menu Produk";
      const product = StorageManager.getProductById(productId);
      if (product) {
        if (prodIdInput) prodIdInput.value = product.id;
        if (prodNameInput) prodNameInput.value = product.name;
        if (prodCategorySelect) prodCategorySelect.value = product.category;
        if (prodPriceInput) prodPriceInput.value = product.price;
        if (prodStockInput) prodStockInput.value = product.stock;
        if (prodBadgeInput) prodBadgeInput.value = product.badge;
        if (prodImageInput) {
          prodImageInput.value = product.image || "";
          updateImagePreview(product.image || "");
        }
        if (prodDescInput) prodDescInput.value = product.description;
        if (prodTagsInput) prodTagsInput.value = (product.tags || []).join(", ");
        if (prodActiveToggle) prodActiveToggle.checked = product.active !== false;
      }
    }

    if (productModalBackdrop) productModalBackdrop.classList.add("active");
    // Reset preview saat mode Add
    if (mode === "add") updateImagePreview("");
  }

  function closeProductModal() {
    if (productModalBackdrop) productModalBackdrop.classList.remove("active");
  }

  if (addProductBtn) addProductBtn.addEventListener("click", () => openProductModal("add"));
  if (productModalCloseBtn) productModalCloseBtn.addEventListener("click", closeProductModal);
  if (productModalCancelBtn) productModalCancelBtn.addEventListener("click", closeProductModal);

  // AI Magic Product Copywriter Button
  const generateAiCopyBtn = document.getElementById("generateAiCopyBtn");
  if (generateAiCopyBtn) {
    generateAiCopyBtn.addEventListener("click", () => {
      const name = (prodNameInput.value || "").trim();
      const cat = prodCategorySelect.value || "kopi";
      const price = prodPriceInput.value || 15000;

      if (!name) {
        alert("Silakan ketik 'Nama Menu' terlebih dahulu untuk digenerate oleh AI!");
        prodNameInput.focus();
        return;
      }

      generateAiCopyBtn.classList.add("generating");
      generateAiCopyBtn.innerHTML = `<span>✨ Meracik AI...</span>`;

      setTimeout(() => {
        if (typeof AIEngine !== "undefined") {
          const copy = AIEngine.generateProductCopy(name, cat, price);
          prodDescInput.value = copy.description;
          prodBadgeInput.value = copy.badge;
          prodTagsInput.value = copy.tags.join(", ");
        }

        generateAiCopyBtn.classList.remove("generating");
        generateAiCopyBtn.innerHTML = `<span>✓ Sukses Dibuat!</span>`;
        setTimeout(() => {
          generateAiCopyBtn.innerHTML = `<span>✨ Buat Deskripsi (AI)</span>`;
        }, 1500);
      }, 400);
    });
  }

  // Submit Product Form
  if (productForm) {
    productForm.addEventListener("submit", (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        // Baca semua field dengan null-safe
        const id = (prodIdInput ? prodIdInput.value.trim() : "");
        const name = (prodNameInput ? prodNameInput.value.trim() : "");
        const category = (prodCategorySelect ? prodCategorySelect.value : "kopi");
        const price = Number(prodPriceInput ? prodPriceInput.value : 0);
        const stock = Number(prodStockInput ? prodStockInput.value : 0);
        const badge = (prodBadgeInput ? prodBadgeInput.value.trim() : "");
        const description = (prodDescInput ? prodDescInput.value.trim() : "");
        const active = prodActiveToggle ? prodActiveToggle.checked : true;
        const tags = prodTagsInput
          ? prodTagsInput.value.split(",").map(t => t.trim()).filter(Boolean)
          : [];

        // Baca URL gambar dari text input (type="text", tanpa validasi HTML5)
        let rawImageUrl = prodImageInput ? prodImageInput.value.trim() : "";
        const image = rawImageUrl
          || (typeof getMenuImage === "function" ? getMenuImage(name) : "")
          || (typeof DEFAULT_IMAGE !== "undefined" ? DEFAULT_IMAGE : "images/kopi-susu.jpg");

        console.log("[ProductForm] Submit =>", { id, name, category, price, stock, image });

        // Validasi manual (karena form pakai novalidate)
        if (!name) {
          alert("Nama produk tidak boleh kosong!");
          if (prodNameInput) prodNameInput.focus();
          return;
        }
        if (!price || price < 1000) {
          alert("Harga produk minimal Rp 1.000!");
          if (prodPriceInput) prodPriceInput.focus();
          return;
        }
        if (stock < 0 || isNaN(stock)) {
          alert("Stok tidak boleh negatif!");
          if (prodStockInput) prodStockInput.focus();
          return;
        }

        // Ambil nama lama untuk edit mode (diperlukan MySQL UPDATE WHERE)
        let originalName = name;
        if (id) {
          const existing = StorageManager.getProductById(id);
          if (existing) originalName = existing.name;
        }

        let result;
        if (id) {
          result = StorageManager.updateProduct(id, {
            name, category, price, stock, badge, image, description, tags, active
          });
        } else {
          result = StorageManager.addProduct({
            name, category, price, stock, badge, image, description, tags, active
          });
        }

        console.log("[ProductForm] localStorage result =>", result);

        // Sinkronisasi ke MySQL via update_menu.php (background, non-blocking)
        const mysqlPayload = {
          action: id ? "update_menu" : "add_menu",
          nama_lama: originalName,
          nama_menu: name,
          kategori: category,
          harga: price,
          stok: stock,
          deskripsi: description,
          gambar: image
        };
        fetch("update_menu.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mysqlPayload)
        })
          .then(r => r.json())
          .then(res => console.log("[ProductForm] MySQL sync =>", res))
          .catch(err => console.warn("[ProductForm] MySQL sync gagal (tidak kritis):", err));

        closeProductModal();
        renderProductsView();

      } catch (err) {
        console.error("[ProductForm] Error saat simpan produk:", err);
        alert("Terjadi kesalahan saat menyimpan produk. Silakan coba lagi.\n\nDetail: " + err.message);
      }
    });
  }

  // ===================================================
  // 6. LAPORAN PENJUALAN VIEW & PRINT
  // ===================================================
  const reportStartDate = document.getElementById("reportStartDate");
  const reportEndDate = document.getElementById("reportEndDate");
  const reportPaymentSelect = document.getElementById("reportPaymentSelect");
  const filterReportBtn = document.getElementById("filterReportBtn");
  const printReportBtn = document.getElementById("printReportBtn");
  const reportTableBody = document.getElementById("reportTableBody");

  function renderReportsView() {
    const filter = {
      startDate: reportStartDate ? reportStartDate.value : null,
      endDate: reportEndDate ? reportEndDate.value : null,
      paymentMethod: reportPaymentSelect ? reportPaymentSelect.value : "all"
    };

    const report = StorageManager.getFilteredReport(filter);

    // Update Summary Header
    const repRevenue = document.getElementById("repTotalRevenue");
    const repOrders = document.getElementById("repTotalOrders");
    const repItems = document.getElementById("repTotalItems");

    if (repRevenue) repRevenue.textContent = formatRupiah(report.totalRevenue);
    if (repOrders) repOrders.textContent = `${report.totalTransactions} Transaksi`;
    if (repItems) repItems.textContent = `${report.totalItemsSold} Porsi`;

    if (!reportTableBody) return;

    if (report.transactions.length === 0) {
      reportTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 32px; color: var(--text-muted);">
            Tidak ada transaksi pada filter periode ini.
          </td>
        </tr>
      `;
      return;
    }

    reportTableBody.innerHTML = report.transactions.map((t, idx) => {
      const itemsList = t.items.map(i => `${i.productName} (${i.quantity}x)`).join(", ");
      return `
        <tr>
          <td style="text-align: center;">${idx + 1}</td>
          <td><strong style="color: var(--caramel-dark); font-family: var(--font-comic);">${t.id}</strong></td>
          <td style="font-size: 0.85rem;">${t.dateFormatted}</td>
          <td>
            <strong>${t.customerName}</strong> (${t.tableNumber})
            <div style="font-size: 0.78rem; color: var(--text-muted);">${itemsList}</div>
          </td>
          <td>${t.paymentMethod}</td>
          <td style="font-weight: 800; font-family: var(--font-comic);">${formatRupiah(t.total)}</td>
        </tr>
      `;
    }).join("");
  }

  if (filterReportBtn) filterReportBtn.addEventListener("click", renderReportsView);

  if (printReportBtn) {
    printReportBtn.addEventListener("click", () => {
      window.print();
    });
  }

  // Set default dates for reports (start of month to today)
  if (reportStartDate && reportEndDate) {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    reportStartDate.value = firstDay.toISOString().split("T")[0];
    reportEndDate.value = now.toISOString().split("T")[0];
  }

  // ===================================================
  // 6. VIEW 5: DATA MEMBER TERDAFTAR (members.json & API)
  // ===================================================
  // Base URL bot API — adaptif terhadap HTTPS / reverse proxy / dev localhost
  const BOT_API_BASE = (typeof window.BOT_API_BASE !== "undefined")
    ? window.BOT_API_BASE
    : (window.location.protocol === "https:" ? "" : "http://localhost:3000");

  let cachedMembers = [];

  const memberSearchInput = document.getElementById("memberSearchInput");
  const refreshMembersBtn = document.getElementById("refreshMembersBtn");
  const totalMembersCount = document.getElementById("totalMembersCount");
  const latestMemberName = document.getElementById("latestMemberName");
  const membersSyncStatus = document.getElementById("membersSyncStatus");
  const memberTableBody = document.getElementById("memberTableBody");

  async function fetchMembersData() {
    let apiSuccess = false;
    let list = [];

    try {
      const res = await fetch(`${BOT_API_BASE}/api/members`);
      if (res.ok) {
        const json = await res.json();
        if (json && Array.isArray(json.data)) {
          list = json.data;
          apiSuccess = true;
        }
      }
    } catch (e) {
      console.warn("[Admin Members] Bot API offline / tidak merespons, memuat data lokal:", e);
    }

    // Ambil juga data dari StorageManager untuk fallback / sinkronisasi gabungan
    const localList = StorageManager.getMembersList ? StorageManager.getMembersList() : [];

    // Gabungkan list tanpa duplikasi nomor telepon
    const phoneMap = new Map();
    list.forEach(m => {
      const clean = String(m.phone || "").replace(/\D/g, "");
      if (clean) phoneMap.set(clean, m);
    });

    localList.forEach(m => {
      const clean = String(m.phone || "").replace(/\D/g, "");
      if (clean && !phoneMap.has(clean)) {
        phoneMap.set(clean, m);
      }
    });

    const merged = Array.from(phoneMap.values());
    cachedMembers = merged;

    if (membersSyncStatus) {
      membersSyncStatus.textContent = apiSuccess
        ? "✅ Terhubung (members.json)"
        : "📂 Mode Offline (Local Cache)";
      membersSyncStatus.style.color = apiSuccess ? "#34D399" : "#FBBF24";
    }

    return merged;
  }

  async function renderMembersView() {
    if (!memberTableBody) return;

    memberTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 28px; color: var(--text-muted);">
          Memuat data member...
        </td>
      </tr>
    `;

    const members = await fetchMembersData();
    filterAndDisplayMembers();
  }

  function filterAndDisplayMembers() {
    if (!memberTableBody) return;

    const query = (memberSearchInput ? memberSearchInput.value : "").toLowerCase().trim();
    const filtered = cachedMembers.filter(m => {
      const name = (m.name || "").toLowerCase();
      const campus = (m.campus || "").toLowerCase();
      const phone = (m.phone || "").toLowerCase();
      return name.includes(query) || campus.includes(query) || phone.includes(query);
    });

    // Update Stat Cards
    if (totalMembersCount) totalMembersCount.textContent = cachedMembers.length;
    if (latestMemberName) {
      latestMemberName.textContent = cachedMembers.length > 0
        ? cachedMembers[0].name || "-"
        : "-";
    }

    if (filtered.length === 0) {
      memberTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 32px; color: var(--text-muted);">
            ${query ? "Tidak ada member yang cocok dengan pencarian." : "Belum ada member terdaftar. Member baru akan muncul otomatis saat mendaftar di web!"}
          </td>
        </tr>
      `;
      return;
    }

    memberTableBody.innerHTML = filtered.map((m, idx) => {
      const dateStr = m.registeredAt
        ? new Date(m.registeredAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })
        : "-";

      const cleanPhone = String(m.phone || "").replace(/\D/g, "");
      const waNumber = cleanPhone.startsWith("0") ? "62" + cleanPhone.slice(1) : (cleanPhone.startsWith("8") ? "62" + cleanPhone : cleanPhone);
      const waLink = waNumber ? `https://wa.me/${waNumber}` : "#";

      return `
        <tr data-member-id="${m.id}">
          <td style="text-align: center; font-weight: 700; color: var(--text-muted);">${idx + 1}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #F59E0B, #D97706); color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 0.85rem;">
                ${(m.name || "M").charAt(0).toUpperCase()}
              </div>
              <div>
                <strong style="color: #1f2937; font-weight: 700; font-size: 0.95rem;">${m.name || "Member Mahasiswa"}</strong>
                ${m.memberId ? `<div style="font-size: 0.72rem; color: var(--text-muted); font-family: monospace;">ID: ${m.memberId}</div>` : ""}
              </div>
            </div>
          </td>
          <td>
            <a href="${waLink}" target="_blank" style="color: #34D399; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
              <span>💬</span> ${m.phone || "-"}
            </a>
          </td>
          <td>
            <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; background: rgba(59, 130, 246, 0.15); color: #60A5FA; font-size: 0.82rem; font-weight: 600;">
              🎓 ${m.campus || "Mahasiswa"}
            </span>
          </td>
          <td style="color: var(--text-muted); font-size: 0.85rem;">${dateStr}</td>
          <td>
            <span style="display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 20px; background: rgba(52, 211, 153, 0.15); color: #34D399; font-size: 0.78rem; font-weight: 700;">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: #34D399;"></span>
              Aktif (Diskon 10%)
            </span>
          </td>
          <td style="text-align: center;">
            <button
              class="btn-delete-member"
              data-id="${m.id}"
              data-name="${(m.name || 'Member').replace(/"/g, '&quot;')}"
              title="Hapus member ini"
              style="background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35); color: #F87171; border-radius: 8px; padding: 5px 10px; cursor: pointer; font-size: 0.85rem; transition: background 0.2s;"
              onmouseover="this.style.background='rgba(239,68,68,0.28)'"
              onmouseout="this.style.background='rgba(239,68,68,0.12)'"
            >🗑️</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  if (memberSearchInput) {
    memberSearchInput.addEventListener("input", filterAndDisplayMembers);
  }

  if (refreshMembersBtn) {
    refreshMembersBtn.addEventListener("click", renderMembersView);
  }

  // --- DELETE MEMBER via event delegation on table body ---
  async function deleteMember(id, name) {
    if (!confirm(`Hapus member "${name}" dari daftar?\nTindakan ini tidak dapat dibatalkan.`)) return;

    try {
      const res = await fetch(`${BOT_API_BASE}/api/members/${encodeURIComponent(id)}`, {
        method: "DELETE"
      });
      const json = await res.json();

      if (res.ok && json.success) {
        // Remove from local cache
        cachedMembers = cachedMembers.filter(m => String(m.id) !== String(id));
        filterAndDisplayMembers();
        if (totalMembersCount) totalMembersCount.textContent = cachedMembers.length;
        console.log(`[Admin] Member '${name}' (ID: ${id}) berhasil dihapus.`);
      } else {
        alert(`Gagal menghapus member: ${json.message || "Coba lagi."}`);
      }
    } catch (err) {
      console.error("[Admin Delete Member Error]", err);
      alert("Tidak dapat terhubung ke bot API. Pastikan server bot berjalan.");
    }
  }

  if (memberTableBody) {
    memberTableBody.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-delete-member");
      if (!btn) return;
      const id = btn.getAttribute("data-id");
      const name = btn.getAttribute("data-name");
      deleteMember(id, name);
    });
  }

  // Check initial authentication
  checkAuth();

  // ===================================================
  // MODAL: PENGATURAN ENGINE AI
  // ===================================================
  const modalAiSettings = document.getElementById("modalAdminAiSettings");
  const sidebarAiBtn = document.getElementById("sidebarAiSettingsBtn");
  const dropdownAiBtn = document.getElementById("dropdownAiSettingsBtn");
  const closeAiModal = document.getElementById("closeAiSettingsModal");
  const cancelAiBtn = document.getElementById("cancelAiSettingsBtn");
  const saveAiBtn = document.getElementById("saveAiSettingsBtn");
  const aiSettingsSavedMsg = document.getElementById("aiSettingsSavedMsg");
  const orModelSection = document.getElementById("orModelSection");
  const aiOrModel = document.getElementById("aiOrModel");
  const aiOrKey = document.getElementById("aiOrKey");
  const aiGeminiKey = document.getElementById("aiGeminiKey");

  function openAiSettingsModal() {
    if (!modalAiSettings) return;
    // Baca config dari localStorage / AIEngine
    const savedProvider = localStorage.getItem("kopi_ai_provider") || "openrouter";
    const savedConfig = JSON.parse(localStorage.getItem("kopi_ai_config") || "{}");
    const savedOrModel = localStorage.getItem("kopi_ai_admin_model") || "google/gemini-2.5-flash";

    // Set radio button
    const radioEl = document.querySelector(`input[name="aiProvider"][value="${savedProvider}"]`);
    if (radioEl) radioEl.checked = true;

    // Set model selector
    if (aiOrModel) aiOrModel.value = savedOrModel;

    // Set API keys (masked)
    if (aiOrKey) aiOrKey.value = savedConfig.openRouterApiKey || "..";
    if (aiGeminiKey) aiGeminiKey.value = savedConfig.geminiApiKey || "";

    // Show/hide model section
    if (orModelSection) orModelSection.style.display = (savedProvider === "openrouter") ? "block" : "none";

    if (aiSettingsSavedMsg) aiSettingsSavedMsg.style.display = "none";
    modalAiSettings.style.display = "flex";
    document.body.style.overflow = "hidden";
  }

  function closeAiSettingsModal() {
    if (!modalAiSettings) return;
    modalAiSettings.style.display = "none";
    document.body.style.overflow = "";
  }

  if (sidebarAiBtn) sidebarAiBtn.addEventListener("click", openAiSettingsModal);
  if (dropdownAiBtn) dropdownAiBtn.addEventListener("click", () => {
    // Tutup dropdown dulu
    const dropdown = document.getElementById("adminProfileDropdown");
    if (dropdown) dropdown.classList.remove("open");
    openAiSettingsModal();
  });
  if (closeAiModal) closeAiModal.addEventListener("click", closeAiSettingsModal);
  if (cancelAiBtn) cancelAiBtn.addEventListener("click", closeAiSettingsModal);

  // Show/hide model section saat radio berubah
  document.querySelectorAll("input[name='aiProvider']").forEach(radio => {
    radio.addEventListener("change", () => {
      if (orModelSection) orModelSection.style.display = (radio.value === "openrouter") ? "block" : "none";
    });
  });

  // Tutup modal bila klik latar belakang
  if (modalAiSettings) {
    modalAiSettings.addEventListener("click", (e) => {
      if (e.target === modalAiSettings) closeAiSettingsModal();
    });
  }

  if (saveAiBtn) {
    saveAiBtn.addEventListener("click", () => {
      const selectedProvider = document.querySelector("input[name='aiProvider']:checked")?.value || "openrouter";
      const selectedModel = aiOrModel ? aiOrModel.value : "google/gemini-2.5-flash";
      const orApiKey = aiOrKey ? aiOrKey.value.trim() : "";
      const geminiApiKey = aiGeminiKey ? aiGeminiKey.value.trim() : "";

      // Simpan ke localStorage
      localStorage.setItem("kopi_ai_provider", selectedProvider);
      localStorage.setItem("kopi_ai_admin_model", selectedModel);
      const newConfig = {
        openRouterApiKey: orApiKey,
        geminiApiKey: geminiApiKey,
        useOpenRouter: selectedProvider === "openrouter",
        openRouterModel: selectedModel
      };
      localStorage.setItem("kopi_ai_config", JSON.stringify(newConfig));

      // Sync ke AIEngine jika tersedia
      if (typeof AIEngine !== "undefined" && AIEngine.saveConfig) {
        AIEngine.saveConfig({
          useOpenRouter: selectedProvider === "openrouter",
          openRouterApiKey: orApiKey,
          geminiApiKey: geminiApiKey,
          openRouterModel: selectedModel
        });
      }

      // Dispatch event agar ai-admin-chat.js & ai-barista.js bisa update
      window.dispatchEvent(new CustomEvent("kopiAiConfigUpdated", {
        detail: { provider: selectedProvider, model: selectedModel }
      }));

      // Update config global OPENROUTER_ADMIN_CONFIG
      if (window.OPENROUTER_ADMIN_CONFIG) {
        window.OPENROUTER_ADMIN_CONFIG.apiKey = orApiKey;
        window.OPENROUTER_ADMIN_CONFIG.model = selectedModel;
      }

      if (aiSettingsSavedMsg) {
        aiSettingsSavedMsg.style.display = "block";
        setTimeout(() => { aiSettingsSavedMsg.style.display = "none"; }, 3000);
      }
    });
  }

  // ===================================================
  // 8. EXPOSE ADMIN CONTEXT UNTUK KOPIAI ADMIN CHAT
  // ===================================================
  window.getAdminDashboardContext = function () {
    let cookieRole = null;
    const match = document.cookie.match('(^|;) ?km_auth_role=([^;]*)(;|$)');
    if (match) cookieRole = decodeURIComponent(match[2]).toLowerCase().trim();
    const localRole = (localStorage.getItem("km_auth_role") || "").toLowerCase().trim();
    const isOwner = cookieRole === "owner" || localRole === "owner" || document.cookie.includes("kopi_owner_verified=true");
    const activeRole = isOwner ? "Owner" : "Admin";
    const displayName = isOwner ? "Owner Kopi Mahasiswa" : "Fathialaziz (Admin)";

    // Deteksi timeframe aktif berdasarkan tab atau tombol aktif di layar
    let activeTimeframe = "all";
    if (currentTab === "dashboard") {
      activeTimeframe = dashboardTimeframe || "today";
    } else if (currentTab === "transactions") {
      activeTimeframe = txFilterTimeframe || "all";
    } else if (currentTab === "reports") {
      activeTimeframe = typeof reportsTimeframe !== "undefined" ? reportsTimeframe : "today";
    }

    return {
      activeRole,
      displayName,
      currentTab,
      dashboardTimeframe,
      txFilterTimeframe,
      activeTimeframe,
      getAllTransactions: () => StorageManager.getTransactions(),
      getActiveTransactions: (tf) => {
        const targetTf = tf || activeTimeframe;
        if (targetTf === "all") return StorageManager.getTransactions();
        const analytics = StorageManager.getSalesAnalytics ? StorageManager.getSalesAnalytics(targetTf) : null;
        return (analytics && analytics.transactions && analytics.transactions.length > 0)
          ? analytics.transactions
          : StorageManager.getTransactions();
      }
    };
  };
});
