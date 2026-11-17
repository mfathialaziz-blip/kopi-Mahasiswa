/**
 * KOPI MAHASISWA — OWNER EXECUTIVE ANALYTICS CONTROLLER
 * Menghubungkan Dashboard Owner dengan endpoint MySQL owner_analytics.php
 * Mengelola KPI Cards, Chart.js Tren Penjualan, Tabel Top 5 & Low 5 Menu, serta Filter Waktu.
 */

document.addEventListener("DOMContentLoaded", () => {
  // ===================================================
  // 0. PIN PROTECTION GATE
  //    Jika owner.html diakses langsung (tanpa PIN modal),
  //    tampilkan overlay verifikasi PIN di halaman ini sendiri.
  // ===================================================
  const OWNER_VALID_PINS = ["1234", "owner2026", "owner123", "owner12345", "123456"];
  const isVerified = (
    sessionStorage.getItem("kopi_owner_verified") === "true" ||
    localStorage.getItem("kopi_owner_verified") === "true" ||
    localStorage.getItem("km_auth_role") === "owner" ||
    (typeof window !== "undefined" && window.SERVER_AUTH_ROLE === "owner")
  );

  if (!isVerified) {
    // Build and inject the PIN lock overlay
    const overlay = document.createElement("div");
    overlay.id = "ownerPinGateOverlay";
    overlay.className = "owner-lock-overlay";
    overlay.innerHTML = `
      <div class="owner-lock-card">
        <div class="owner-lock-icon" style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#F59E0B,#B45309);display:flex;align-items:center;justify-content:center;font-size:2rem;margin:0 auto 16px;box-shadow:0 4px 16px rgba(245,158,11,0.4);">🔐</div>
        <h2 class="owner-lock-title" style="font-family:var(--font-comic);font-size:1.4rem;color:#FFF;margin:0 0 8px;">Akses Owner</h2>
        <p class="owner-lock-desc" style="font-size:0.88rem;color:#D4BEA9;line-height:1.5;margin:0 0 20px;">
          Dashboard ini hanya untuk pemilik kafe.<br>Masukkan PIN / Password Owner untuk melanjutkan.
        </p>
        <div style="position:relative;margin-bottom:12px;">
          <input type="password" id="ownerGatePinInput" class="owner-pin-input" maxlength="20" placeholder="••••••••" autocomplete="off">
          <button type="button" id="ownerGatePeekBtn" class="btn-pin-peek" tabindex="-1">👁️</button>
        </div>
        <div id="ownerGateError" style="display:none;background:rgba(239,68,68,0.15);color:#F87171;border:1px solid rgba(239,68,68,0.4);padding:10px 14px;border-radius:8px;font-size:0.85rem;font-weight:700;margin-bottom:14px;text-align:left;">
          ❌ PIN / Password salah. Coba lagi.
        </div>
        <div style="display:flex;gap:10px;">
          <button id="ownerGateCancelBtn" class="btn-secondary" style="flex:1;padding:12px;border-radius:8px;">
            ← Kembali
          </button>
          <button id="ownerGateSubmitBtn" class="owner-btn-primary" style="flex:2;padding:12px 16px;border-radius:8px;">
            🔓 Masuk Dashboard
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    let gateAttempts = 0;
    const gateInput    = document.getElementById("ownerGatePinInput");
    const gateError    = document.getElementById("ownerGateError");
    const gateSubmit   = document.getElementById("ownerGateSubmitBtn");
    const gateCancel   = document.getElementById("ownerGateCancelBtn");
    const gatePeekBtn  = document.getElementById("ownerGatePeekBtn");

    if (gateInput) setTimeout(() => gateInput.focus(), 300);

    function verifyGatePin() {
      const val = gateInput ? gateInput.value.trim() : "";
      if (!val) { if (gateInput) gateInput.focus(); return; }

      if (OWNER_VALID_PINS.includes(val)) {
        sessionStorage.setItem("kopi_owner_verified", "true");
        overlay.style.transition = "opacity 0.3s";
        overlay.style.opacity = "0";
        setTimeout(() => overlay.remove(), 350);
        // Continue loading analytics now that the user is verified
        fetchOwnerAnalytics(currentTimeframe);
      } else {
        gateAttempts++;
        if (gateError) {
          gateError.style.display = "block";
          gateError.textContent = gateAttempts >= 3
            ? `❌ PIN salah. Tersisa ${5 - gateAttempts} percobaan.`
            : "❌ PIN / Password salah. Coba lagi.";
        }
        const card = overlay.querySelector(".owner-lock-card");
        if (card) {
          card.classList.add("owner-shake");
          setTimeout(() => card.classList.remove("owner-shake"), 450);
        }
        if (gateInput) { gateInput.value = ""; gateInput.focus(); }

        if (gateAttempts >= 5) {
          if (gateSubmit) { gateSubmit.disabled = true; gateSubmit.textContent = "🔒 Akses Dikunci"; }
          if (gateInput)  gateInput.disabled = true;
          if (gateError)  gateError.textContent = "🔒 Terlalu banyak percobaan. Hubungi admin.";
        }
      }
    }

    if (gateSubmit) gateSubmit.addEventListener("click", verifyGatePin);
    if (gateCancel) gateCancel.addEventListener("click", () => { window.location.href = "index.html"; });
    if (gateInput)  gateInput.addEventListener("keydown", e => { if (e.key === "Enter") verifyGatePin(); });
    if (gatePeekBtn && gateInput) {
      gatePeekBtn.addEventListener("click", () => {
        gateInput.type = gateInput.type === "password" ? "text" : "password";
        gatePeekBtn.textContent = gateInput.type === "password" ? "👁️" : "🙈";
      });
    }
  }

  // Current State
  let currentTimeframe = "hari_ini";
  let ownerChartInstance = null;
  let isFetching = false;

  // DOM Elements
  const timeframeBtns = document.querySelectorAll(".owner-timeframe-btn");
  const refreshBtn = document.getElementById("ownerRefreshBtn");
  const printBtn = document.getElementById("ownerPrintBtn");
  const periodLabelText = document.getElementById("ownerPeriodLabel");

  // Summary KPI Elements
  const kpiOmsetEl = document.getElementById("ownerKpiOmset");
  const kpiOrdersEl = document.getElementById("ownerKpiOrders");
  const kpiItemsEl = document.getElementById("ownerKpiItems");
  const kpiAovEl = document.getElementById("ownerKpiAov");
  const kpiBestsellerNameEl = document.getElementById("ownerBestsellerName");
  const kpiBestsellerSubEl = document.getElementById("ownerBestsellerSub");
  const kpiBestsellerThumbEl = document.getElementById("ownerBestsellerThumb");

  // Table Elements
  const topMenusTableBody = document.getElementById("ownerTopMenusTableBody");
  const lowMenusTableBody = document.getElementById("ownerLowMenusTableBody");

  // Payment Breakdown Elements
  const payQrisAmount = document.getElementById("ownerPayQrisAmount");
  const payQrisCount = document.getElementById("ownerPayQrisCount");
  const payCashAmount = document.getElementById("ownerPayCashAmount");
  const payCashCount = document.getElementById("ownerPayCashCount");

  // Chart Canvas
  const chartCanvas = document.getElementById("ownerChartCanvas");

  // Executive Suite DOM Elements
  const exportCsvBtn = document.getElementById("ownerExportCsvBtn");
  const editTargetBtn = document.getElementById("ownerEditTargetBtn");
  const targetActualVal = document.getElementById("ownerTargetActualVal");
  const targetGoalVal = document.getElementById("ownerTargetGoalVal");
  const targetPctVal = document.getElementById("ownerTargetPctVal");
  const targetProgressBar = document.getElementById("ownerTargetProgressBar");
  const targetStatusNote = document.getElementById("ownerTargetStatusNote");
  const targetBadge = document.getElementById("ownerTargetBadge");

  // Margin DOM Elements
  const hppSlider = document.getElementById("ownerHppSlider");
  const hppSliderVal = document.getElementById("ownerHppSliderVal");
  const grossMarginPctLabel = document.getElementById("ownerGrossMarginPctLabel");
  const estHppVal = document.getElementById("ownerEstHppVal");
  const estProfitVal = document.getElementById("ownerEstProfitVal");

  // AI Governance DOM Elements
  const aiConfigBtn = document.getElementById("ownerAiConfigBtn");
  const aiStatusTitle = document.getElementById("ownerAiStatusTitle");
  const aiStatusBadge = document.getElementById("ownerAiStatusBadge");
  const aiModelLabel = document.getElementById("ownerAiModelLabel");
  const aiInteractionCount = document.getElementById("ownerAiInteractionCount");

  // Recent Transactions Table Body
  const recentTxTableBody = document.getElementById("ownerRecentTxTableBody");

  // Modals
  const targetModal = document.getElementById("ownerTargetModal");
  const targetModalPeriod = document.getElementById("ownerTargetModalPeriod");
  const targetInput = document.getElementById("ownerTargetInput");
  const targetCancelBtn = document.getElementById("ownerTargetCancelBtn");
  const targetSaveBtn = document.getElementById("ownerTargetSaveBtn");

  const aiModal = document.getElementById("ownerAiModal");
  const aiKeyInput = document.getElementById("ownerAiKeyInput");
  const aiModelSelect = document.getElementById("ownerAiModelSelect");
  const aiCancelBtn = document.getElementById("ownerAiCancelBtn");
  const aiSaveBtn = document.getElementById("ownerAiSaveBtn");

  // Global cache of latest active owner analytics data
  let lastOwnerData = null;
  let activeRevenueTotal = 0;

  /**
   * Helper Format Rupiah
   */
  function formatRupiah(num) {
    const val = Number(num || 0);
    return "Rp " + val.toLocaleString("id-ID");
  }

  /**
   * Fetch Analytics Data from MySQL Backend
   */
  async function fetchOwnerAnalytics(timeframe = currentTimeframe) {
    if (isFetching) return;
    isFetching = true;

    if (refreshBtn) {
      refreshBtn.classList.add("loading");
      refreshBtn.innerHTML = `<span>⏳</span><span>Memuat...</span>`;
    }

    try {
      const response = await fetch(`owner_analytics.php?timeframe=${timeframe}&_t=${Date.now()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Gagal memuat data analytics`);
      }
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Gagal mengambil data dari database");
      }

      // Update UI with Data
      updateDashboardUI(data);

    } catch (err) {
      console.error("[OwnerAnalytics] Error:", err);
      // Fallback: Jika MySQL offline, hitung estimasi dari StorageManager jika tersedia
      fallbackFromStorage(timeframe);
    } finally {
      isFetching = false;
      if (refreshBtn) {
        refreshBtn.classList.remove("loading");
        refreshBtn.innerHTML = `<span>🔄</span><span>Perbarui Data</span>`;
      }
    }
  }

  /**
   * Update All Dashboard Components with Data from Backend
   */
  function updateDashboardUI(data) {
    // 1. Update Periode Header
    if (periodLabelText) {
      periodLabelText.textContent = data.label_period || "Periode Aktif";
    }

    const summary = data.summary || {};

    // 2. Update KPI Cards
    if (kpiOmsetEl) {
      kpiOmsetEl.textContent = summary.total_omset_formatted || formatRupiah(summary.total_omset);
    }

    if (kpiOrdersEl) {
      kpiOrdersEl.textContent = `${summary.total_pesanan || 0} Pesanan`;
    }

    if (kpiItemsEl) {
      kpiItemsEl.textContent = `${summary.total_porsi_terjual || 0} porsi terjual`;
    }

    if (kpiAovEl) {
      kpiAovEl.textContent = summary.rata_rata_formatted || formatRupiah(summary.rata_rata_transaksi);
    }

    // Top Seller Card
    const best = summary.menu_terlaris || {};
    if (kpiBestsellerNameEl) {
      kpiBestsellerNameEl.textContent = best.nama_menu || "-";
    }
    if (kpiBestsellerSubEl) {
      kpiBestsellerSubEl.textContent = best.total_terjual 
        ? `${best.total_terjual} Porsi (${formatRupiah(best.total_omset)})`
        : "Belum ada penjualan";
    }
    if (kpiBestsellerThumbEl) {
      const defaultImg = "images/kopi-susu.jpg";
      const official = (typeof getMenuImage === "function" && best.nama_menu) ? getMenuImage(best.nama_menu) : null;
      let imgSrc = official || best.gambar || defaultImg;
      if (imgSrc.includes("unsplash.com") || imgSrc.includes("pinimg.com")) imgSrc = official || defaultImg;
      kpiBestsellerThumbEl.src = imgSrc;
      kpiBestsellerThumbEl.onerror = () => { kpiBestsellerThumbEl.src = defaultImg; };
    }

    // 3. Render Top 5 Menu Paling Laris
    renderTopMenusTable(data.top_menus || []);

    // 4. Render 5 Menu Sepi Penjualan
    renderLowMenusTable(data.low_menus || []);

    // 5. Render Breakdown Metode Pembayaran
    if (data.payment_breakdown) {
      const qris = data.payment_breakdown.qris || { count: 0, total: 0 };
      const tunai = data.payment_breakdown.tunai || { count: 0, total: 0 };

      if (payQrisAmount) payQrisAmount.textContent = formatRupiah(qris.total);
      if (payQrisCount) payQrisCount.textContent = `${qris.count} Transaksi`;

      if (payCashAmount) payCashAmount.textContent = formatRupiah(tunai.total);
      if (payCashCount) payCashCount.textContent = `${tunai.count} Transaksi`;
    }

    // 6. Render Chart.js Tren Penjualan
    renderOwnerChart(data.chart || { labels: [], revenue: [], orders: [] });

    // 7. Update Executive Suite Modules
    lastOwnerData = data;
    activeRevenueTotal = summary.total_omset || 0;
    updateTargetOmsetUI(activeRevenueTotal);
    updateMarginUI(activeRevenueTotal);
    updateAiGovernanceUI();
    renderRecentTxTable(data.recent_transactions);
  }

  /**
   * Render Tabel Top 5 Menu Paling Laris
   */
  function renderTopMenusTable(items) {
    if (!topMenusTableBody) return;

    if (!items || items.length === 0) {
      topMenusTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 24px; color: #A89080;">
            Belum ada data penjualan pada periode ini.
          </td>
        </tr>
      `;
      return;
    }

    const medals = ["🥇", "🥈", "🥉", "4", "5"];
    const rankClasses = ["rank-1", "rank-2", "rank-3", "rank-other", "rank-other"];

    topMenusTableBody.innerHTML = items.map((item, idx) => {
      const rankBadge = medals[idx] || (idx + 1);
      const rankClass = rankClasses[idx] || "rank-other";
      const fallbackImg = "images/kopi-susu.jpg";
      const official = (typeof getMenuImage === "function" && item.nama_menu) ? getMenuImage(item.nama_menu) : null;
      let imgSrc = official || (item.gambar && item.gambar.trim() !== "" ? item.gambar : fallbackImg);
      if (imgSrc.includes("unsplash.com") || imgSrc.includes("pinimg.com")) imgSrc = official || fallbackImg;

      return `
        <tr>
          <td style="width: 44px; text-align: center;">
            <span class="rank-badge ${rankClass}">${rankBadge}</span>
          </td>
          <td>
            <div class="menu-item-cell">
              <img src="${imgSrc}" alt="${item.nama_menu}" class="menu-thumb-img" onerror="this.onerror=null; this.src='${fallbackImg}';">
              <div>
                <strong style="color: #FFF; font-size: 0.92rem;">${item.nama_menu}</strong>
                <div style="font-size: 0.75rem; color: #D4BEA9; text-transform: capitalize;">${item.kategori || "Menu"}</div>
              </div>
            </div>
          </td>
          <td>
            <strong style="color: #FBBF24; font-size: 0.95rem;">${item.total_terjual} Porsi</strong>
          </td>
          <td>
            <strong style="color: #4ADE80;">${formatRupiah(item.total_omset)}</strong>
          </td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 700; font-size: 0.85rem; color: #FFF;">${item.kontribusi_pct || 0}%</span>
              <div style="flex-grow: 1; height: 6px; background: rgba(255,255,255,0.1); border-radius: 999px; overflow: hidden; max-width: 60px;">
                <div style="width: ${Math.min(100, item.kontribusi_pct || 0)}%; height: 100%; background: #F59E0B;"></div>
              </div>
            </div>
          </td>
          <td>
            <span style="font-size: 0.8rem; color: ${item.stok_sisa > 5 ? '#4ADE80' : (item.stok_sisa > 0 ? '#FBBF24' : '#F87171')};">
              ${item.stok_sisa > 0 ? `Stok: ${item.stok_sisa}` : 'Habis ⚠️'}
            </span>
          </td>
        </tr>
      `;
    }).join("");
  }

  /**
   * Render Tabel 5 Menu Sepi Penjualan
   */
  function renderLowMenusTable(items) {
    if (!lowMenusTableBody) return;

    if (!items || items.length === 0) {
      lowMenusTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 24px; color: #A89080;">
            Semua menu memiliki penjualan aktif pada periode ini!
          </td>
        </tr>
      `;
      return;
    }

    const fallbackImg = "images/kopi-susu.jpg";

    lowMenusTableBody.innerHTML = items.map((item, idx) => {
      const official = (typeof getMenuImage === "function" && item.nama_menu) ? getMenuImage(item.nama_menu) : null;
      let imgSrc = official || (item.gambar && item.gambar.trim() !== "" ? item.gambar : fallbackImg);
      if (imgSrc.includes("unsplash.com") || imgSrc.includes("pinimg.com")) imgSrc = official || fallbackImg;
      const isZero = (item.total_terjual === 0);
      const badgeClass = isZero ? "badge-action" : "badge-bundling";

      return `
        <tr>
          <td style="width: 36px; text-align: center; color: #A89080; font-weight: 700;">
            #${idx + 1}
          </td>
          <td>
            <div class="menu-item-cell">
              <img src="${imgSrc}" alt="${item.nama_menu}" class="menu-thumb-img" onerror="this.onerror=null; this.src='${fallbackImg}';">
              <div>
                <strong style="color: #FFF; font-size: 0.92rem;">${item.nama_menu}</strong>
                <div style="font-size: 0.75rem; color: #D4BEA9; text-transform: capitalize;">${item.kategori || "Menu"}</div>
              </div>
            </div>
          </td>
          <td>
            <span style="font-weight: 700; color: ${isZero ? '#F87171' : '#FBBF24'};">
              ${item.total_terjual} porsi
            </span>
          </td>
          <td>
            <span style="font-size: 0.8rem; color: ${item.stok_sisa > 0 ? '#D4BEA9' : '#F87171'};">
              ${item.stok_sisa > 0 ? `Sisa ${item.stok_sisa}` : 'Kosong'}
            </span>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span class="${badgeClass}">${item.status_badge || "Perlu Strategi"}</span>
              <span style="font-size: 0.75rem; color: #D4BEA9;">${item.rekomendasi || "Tingkatkan promosi"}</span>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  }

  /**
   * Render Interactive Chart.js for Sales Trends
   */
  function renderOwnerChart(chartData) {
    if (!chartCanvas) return;

    const labels = chartData.labels || [];
    const revenue = chartData.revenue || [];
    const orders = chartData.orders || [];

    // Jika Chart.js tersedia dari CDN
    if (typeof Chart !== "undefined") {
      if (ownerChartInstance) {
        ownerChartInstance.destroy();
      }

      const ctx = chartCanvas.getContext("2d");

      // Gradient Fill for Omset Line
      const gradient = ctx.createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, "rgba(245, 158, 11, 0.45)");
      gradient.addColorStop(1, "rgba(245, 158, 11, 0.0)");

      ownerChartInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Omset Penjualan (Rp)",
              data: revenue,
              borderColor: "#F59E0B",
              backgroundColor: gradient,
              borderWidth: 3,
              fill: true,
              tension: 0.35,
              pointBackgroundColor: "#F59E0B",
              pointBorderColor: "#190C06",
              pointBorderWidth: 2,
              pointRadius: 5,
              pointHoverRadius: 7,
              yAxisID: "y"
            },
            {
              label: "Jumlah Transaksi",
              data: orders,
              borderColor: "#4ADE80",
              backgroundColor: "rgba(74, 222, 128, 0.15)",
              borderWidth: 2,
              borderDash: [5, 5],
              fill: false,
              tension: 0.2,
              pointBackgroundColor: "#4ADE80",
              pointBorderColor: "#190C06",
              pointBorderWidth: 2,
              pointRadius: 4,
              yAxisID: "y1"
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: "index",
            intersect: false
          },
          plugins: {
            legend: {
              position: "top",
              labels: {
                color: "#F8F2EB",
                font: { family: "'Plus Jakarta Sans', sans-serif", weight: "600", size: 12 },
                usePointStyle: true,
                boxWidth: 8
              }
            },
            tooltip: {
              backgroundColor: "rgba(25, 12, 6, 0.95)",
              titleColor: "#F59E0B",
              bodyColor: "#FFF",
              borderColor: "rgba(245, 158, 11, 0.4)",
              borderWidth: 1,
              padding: 12,
              boxPadding: 6,
              callbacks: {
                label: function(context) {
                  if (context.datasetIndex === 0) {
                    return ` Omset: Rp ${Number(context.raw).toLocaleString("id-ID")}`;
                  } else {
                    return ` Pesanan: ${context.raw} Transaksi`;
                  }
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: "rgba(255, 255, 255, 0.06)" },
              ticks: { color: "#D4BEA9", font: { weight: "600", size: 11 } }
            },
            y: {
              type: "linear",
              position: "left",
              grid: { color: "rgba(255, 255, 255, 0.06)" },
              ticks: {
                color: "#F59E0B",
                callback: (val) => "Rp " + (val >= 1000 ? (val / 1000) + "rb" : val)
              }
            },
            y1: {
              type: "linear",
              position: "right",
              grid: { drawOnChartArea: false },
              ticks: {
                color: "#4ADE80",
                stepSize: 1,
                callback: (val) => `${val} tx`
              }
            }
          }
        }
      });
    } else {
      // Fallback Native Canvas Drawer jika Chart.js belum loaded / offline
      drawFallbackCanvasChart(chartCanvas, labels, revenue, orders);
    }
  }

  /**
   * Fallback Native Canvas Drawer jika Chart.js offline
   */
  function drawFallbackCanvasChart(canvas, labels, revenue, orders) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = (rect.height || 300) * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height || 300;
    const padX = 60;
    const padY = 40;
    const chartW = w - padX * 2;
    const chartH = h - padY * 2;

    ctx.clearRect(0, 0, w, h);

    if (labels.length === 0) return;

    const maxRev = Math.max(...revenue, 100000);
    const stepX = chartW / (labels.length - 1 || 1);

    // Draw Line
    ctx.beginPath();
    ctx.strokeStyle = "#F59E0B";
    ctx.lineWidth = 3;

    labels.forEach((lbl, idx) => {
      const x = padX + idx * stepX;
      const y = padY + chartH - (revenue[idx] / maxRev) * chartH;
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw Points & Labels
    labels.forEach((lbl, idx) => {
      const x = padX + idx * stepX;
      const y = padY + chartH - (revenue[idx] / maxRev) * chartH;

      ctx.fillStyle = "#F59E0B";
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#D4BEA9";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(lbl, x, h - 12);
    });
  }


  /**
   * Executive Suite Helper 1: Target Omset & Progress Bar
   */
  function getTargetGoal(timeframe) {
    const key = 'kopi_owner_target_' + (timeframe || currentTimeframe);
    const saved = localStorage.getItem(key);
    if (saved && !isNaN(saved) && Number(saved) > 0) {
      return Number(saved);
    }
    // Default targets
    if (timeframe === 'minggu_ini') return 5000000;
    if (timeframe === 'bulan_ini') return 20000000;
    return 1000000; // hari_ini
  }

  function updateTargetOmsetUI(totalOmset) {
    if (!targetActualVal) return;
    const goal = getTargetGoal(currentTimeframe);
    const pct = goal > 0 ? Math.round((totalOmset / goal) * 100) : 0;

    targetActualVal.textContent = formatRupiah(totalOmset);
    if (targetGoalVal) targetGoalVal.textContent = formatRupiah(goal);
    if (targetPctVal) targetPctVal.textContent = `${pct}%`;
    if (targetProgressBar) targetProgressBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;

    if (pct >= 100) {
      if (targetProgressBar) targetProgressBar.style.background = "linear-gradient(90deg, #10B981, #34D399)";
      const surplus = totalOmset - goal;
      if (targetStatusNote) targetStatusNote.textContent = `Target Terlampaui! Surplus: ${formatRupiah(surplus)}`;
      if (targetBadge) {
        targetBadge.textContent = "Tercapai 🏆";
        targetBadge.style.color = "#34D399";
      }
    } else {
      if (targetProgressBar) targetProgressBar.style.background = "linear-gradient(90deg, #F59E0B, #10B981)";
      const deficit = goal - totalOmset;
      if (targetStatusNote) targetStatusNote.textContent = `Sisa target: ${formatRupiah(deficit)}`;
      if (targetBadge) {
        targetBadge.textContent = "Dalam Progress";
        targetBadge.style.color = "#FBBF24";
      }
    }
  }

  /**
   * Executive Suite Helper 2: Estimasi HPP & Laba Kotor
   */
  function updateMarginUI(totalOmset) {
    if (!hppSlider) return;
    const hppPct = parseInt(hppSlider.value, 10) || 40;
    const grossMarginPct = 100 - hppPct;

    if (hppSliderVal) hppSliderVal.textContent = `${hppPct}%`;
    if (grossMarginPctLabel) grossMarginPctLabel.textContent = `${grossMarginPct}%`;

    const estHpp = Math.round((totalOmset * hppPct) / 100);
    const estProfit = Math.max(0, totalOmset - estHpp);

    if (estHppVal) estHppVal.textContent = formatRupiah(estHpp);
    if (estProfitVal) estProfitVal.textContent = formatRupiah(estProfit);
  }

  /**
   * Executive Suite Helper 3: Panel Tata Kelola AI (KopiAI Governance)
   */
  function updateAiGovernanceUI() {
    const hasKey = !!(
      (typeof getOpenRouterKey === "function" && getOpenRouterKey()) ||
      localStorage.getItem("openrouter_api_key") ||
      localStorage.getItem("kopi_ai_custom_key")
    );

    const activeModel = localStorage.getItem("kopi_ai_model") || "google/gemini-2.0-flash-001";
    let modelName = "Google Gemini 2.0 Flash";
    if (activeModel.includes("llama")) modelName = "Meta Llama 3.3 70B";
    if (activeModel.includes("deepseek")) modelName = "DeepSeek V3 Chat";
    if (activeModel.includes("1.5")) modelName = "Google Gemini 1.5 Flash";

    if (aiStatusTitle) {
      aiStatusTitle.textContent = hasKey ? "OpenRouter AI Terhubung" : "AI Cloud Server Siap";
    }
    if (aiStatusBadge) {
      if (hasKey) {
        aiStatusBadge.className = "owner-badge-success";
        aiStatusBadge.textContent = "● API Key Aktif";
      } else {
        aiStatusBadge.className = "owner-badge-warning";
        aiStatusBadge.textContent = "● Server Standar";
      }
    }
    if (aiModelLabel) aiModelLabel.textContent = modelName;
    if (aiInteractionCount) {
      const count = localStorage.getItem("km_ai_interaction_count") || "14";
      aiInteractionCount.textContent = `${count} Chat`;
    }
  }

  /**
   * Executive Suite Helper 4: 5 Transaksi Terkini (Audit Operasional Cepat)
   */
  function renderRecentTxTable(txList) {
    if (!recentTxTableBody) return;

    let items = txList;
    if (!items || items.length === 0) {
      // Fallback ke StorageManager
      if (typeof StorageManager !== "undefined") {
        const allTx = StorageManager.getTransactions();
        items = allTx.slice(-5).reverse().map(t => ({
          kode_transaksi: t.id,
          nama_pelanggan: t.customerName || "Mahasiswa",
          metode_pembayaran: t.paymentMethod || "QRIS",
          total_omset: t.total || 0,
          created_at: t.date || new Date().toISOString()
        }));
      }
    }

    if (!items || items.length === 0) {
      recentTxTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 24px; color: #A89080;">
            Belum ada catatan transaksi pada periode ini.
          </td>
        </tr>
      `;
      return;
    }

    recentTxTableBody.innerHTML = items.slice(0, 5).map(tx => {
      const dateStr = tx.created_at ? new Date(tx.created_at).toLocaleString("id-ID", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
      }) : "-";
      const isQris = (tx.metode_pembayaran || "").toLowerCase().includes("qris");

      return `
        <tr>
          <td style="font-family: monospace; font-size: 0.85rem; color: #FBBF24;">${tx.kode_transaksi}</td>
          <td style="font-size: 0.82rem; color: #D4BEA9;">${dateStr}</td>
          <td style="font-weight: 600; color: #FFF;">${tx.nama_pelanggan}</td>
          <td>
            <span style="font-size: 0.78rem; padding: 2px 8px; border-radius: 999px; background: ${isQris ? 'rgba(96,165,250,0.15)' : 'rgba(52,211,153,0.15)'}; color: ${isQris ? '#60A5FA' : '#34D399'}; border: 1px solid ${isQris ? 'rgba(96,165,250,0.3)' : 'rgba(52,211,153,0.3)'};">
              ${tx.metode_pembayaran || "QRIS"}
            </span>
          </td>
          <td style="text-align: right; font-weight: 700; color: #4ADE80;">
            ${formatRupiah(tx.total_omset)}
          </td>
        </tr>
      `;
    }).join("");
  }

  /**
   * Executive Suite Helper 5: Ekspor Data ke Format CSV
   */
  function exportOwnerDataToCSV() {
    if (!lastOwnerData) {
      alert("Data analytics belum selesai dimuat. Silakan coba sesaat lagi.");
      return;
    }

    const summary = lastOwnerData.summary || {};
    const topMenus = lastOwnerData.top_menus || [];
    const lowMenus = lastOwnerData.low_menus || [];
    const pay = lastOwnerData.payment_breakdown || {};
    const goal = getTargetGoal(currentTimeframe);
    const hppPct = hppSlider ? parseInt(hppSlider.value, 10) : 40;
    const estHpp = Math.round(((summary.total_omset || 0) * hppPct) / 100);
    const estProfit = (summary.total_omset || 0) - estHpp;

    let csv = "\uFEFF"; // BOM UTF-8 for Excel
    csv += "LAPORAN EKSEKUTIF PENJUALAN — KOPI MAHASISWA\r\n";
    csv += `Periode Analisis;"${lastOwnerData.label_period || currentTimeframe}"\r\n`;
    csv += `Waktu Unduh;"${new Date().toLocaleString('id-ID')}"\r\n`;
    csv += `Hak Akses;"Owner (Executive Suite)"\r\n\r\n`;

    // 1. Ringkasan Finansial
    csv += "RINGKASAN METRIK FINANSIAL\r\n";
    csv += "Metrik;Nilai\r\n";
    csv += `Total Omset Penjualan;"${summary.total_omset || 0}"\r\n`;
    csv += `Total Transaksi Pesanan;"${summary.total_pesanan || 0}"\r\n`;
    csv += `Total Porsi Terjual;"${summary.total_porsi_terjual || 0}"\r\n`;
    csv += `Rata-rata Transaksi (AOV);"${summary.rata_rata_transaksi || 0}"\r\n`;
    csv += `Target Omset;"${goal}"\r\n`;
    csv += `Persentase Target Ketercapaian;"${goal > 0 ? Math.round(((summary.total_omset || 0)/goal)*100) : 0}%"\r\n`;
    csv += `Persentase HPP;"${hppPct}%"\r\n`;
    csv += `Estimasi HPP (Modal);"${estHpp}"\r\n`;
    csv += `Estimasi Laba Kotor;"${estProfit}"\r\n`;
    csv += `Menu Terlaris;"${summary.menu_terlaris ? summary.menu_terlaris.nama_menu : '-'}"\r\n\r\n`;

    // 2. Top 5 Menu
    csv += "TOP 5 MENU PALING LARIS\r\n";
    csv += "Rank;Nama Menu;Porsi Terjual;Total Omset (Rp);Kontribusi (%)\r\n";
    topMenus.forEach((m, idx) => {
      csv += `${idx + 1};"${m.nama_menu}";${m.total_terjual};${m.total_omset};${m.kontribusi_pct || 0}%\r\n`;
    });
    csv += "\r\n";

    // 3. 5 Menu Sepi
    csv += "5 MENU SEPI PENJUALAN\r\n";
    csv += "Rank;Nama Menu;Porsi Terjual;Sisa Stok;Rekomendasi Owner\r\n";
    lowMenus.forEach((m, idx) => {
      csv += `${idx + 1};"${m.nama_menu}";${m.total_terjual};${m.stok_sisa || 0};"${m.rekomendasi || '-'}"\r\n`;
    });
    csv += "\r\n";

    // 4. Metode Pembayaran
    csv += "DISTRIBUSI PEMBAYARAN\r\n";
    csv += "Metode;Jumlah Transaksi;Total Nominal (Rp)\r\n";
    csv += `QRIS;${(pay.qris && pay.qris.count) || 0};${(pay.qris && pay.qris.total) || 0}\r\n`;
    csv += `Uang Tunai (Cash);${(pay.tunai && pay.tunai.count) || 0};${(pay.tunai && pay.tunai.total) || 0}\r\n\r\n`;

    // 5. 5 Transaksi Terakhir
    const recents = lastOwnerData.recent_transactions || [];
    if (recents.length > 0) {
      csv += "5 TRANSAKSI TERBARU\r\n";
      csv += "ID Transaksi;Waktu;Nama Pelanggan;Metode;Total (Rp)\r\n";
      recents.forEach(r => {
        csv += `"${r.kode_transaksi}";"${r.created_at}";"${r.nama_pelanggan}";"${r.metode_pembayaran}";${r.total_omset}\r\n`;
      });
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeDate = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `Laporan_Eksekutif_Kopi_Mahasiswa_${currentTimeframe}_${safeDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Fallback calculation using StorageManager if MySQL is offline
   */
  function fallbackFromStorage(timeframe) {
    if (typeof StorageManager === "undefined") return;

    let tfKey = "today";
    if (timeframe === "minggu_ini") tfKey = "7days";
    if (timeframe === "bulan_ini") tfKey = "month";

    const analytics = StorageManager.getSalesAnalytics(tfKey);
    const chartData = StorageManager.getChartData(tfKey);

    updateDashboardUI({
      success: true,
      label_period: timeframe === "hari_ini" ? "Hari Ini (Local Sync)" : (timeframe === "minggu_ini" ? "7 Hari Terakhir" : "Bulan Ini"),
      summary: {
        total_omset: analytics.totalRevenue,
        total_omset_formatted: formatRupiah(analytics.totalRevenue),
        total_pesanan: analytics.totalTransactions,
        total_porsi_terjual: analytics.totalItemsSold,
        rata_rata_transaksi: analytics.totalTransactions > 0 ? Math.round(analytics.totalRevenue / analytics.totalTransactions) : 0,
        rata_rata_formatted: formatRupiah(analytics.totalTransactions > 0 ? Math.round(analytics.totalRevenue / analytics.totalTransactions) : 0),
        menu_terlaris: analytics.topSellingProduct
      },
      chart: {
        labels: chartData.labels,
        revenue: chartData.revenueData,
        orders: chartData.orderData
      },
      top_menus: analytics.topSellingList.slice(0, 5).map((m, i) => ({
        nama_menu: m.name,
        total_terjual: m.quantity,
        total_omset: m.revenue,
        kontribusi_pct: analytics.totalRevenue > 0 ? Math.round((m.revenue / analytics.totalRevenue) * 100) : 0,
        stok_sisa: 10
      })),
      low_menus: [],
      payment_breakdown: {
        qris: { count: analytics.paymentBreakdown.qris.count, total: analytics.paymentBreakdown.qris.total },
        tunai: { count: analytics.paymentBreakdown.cash.count, total: analytics.paymentBreakdown.cash.total }
      }
    });
  }

  // ===================================================
  // EVENT LISTENERS & FILTER BUTTONS
  // ===================================================
  timeframeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      timeframeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentTimeframe = btn.getAttribute("data-timeframe") || "hari_ini";
      fetchOwnerAnalytics(currentTimeframe);
    });
  });

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      fetchOwnerAnalytics(currentTimeframe);
    });
  }

  if (printBtn) {
    printBtn.addEventListener("click", () => {
      window.print();
    });
  }

  // Ekspor CSV Button
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", exportOwnerDataToCSV);
  }

  // Slider Margin Listener
  if (hppSlider) {
    // Muat setting tersimpan
    const savedHpp = localStorage.getItem("kopi_owner_hpp_pct");
    if (savedHpp) {
      hppSlider.value = savedHpp;
    }
    hppSlider.addEventListener("input", () => {
      localStorage.setItem("kopi_owner_hpp_pct", hppSlider.value);
      updateMarginUI(activeRevenueTotal);
    });
  }

  // Target Omset Modal Listeners
  if (editTargetBtn && targetModal) {
    editTargetBtn.addEventListener("click", () => {
      if (targetModalPeriod) {
        targetModalPeriod.textContent = currentTimeframe === "hari_ini" ? "Hari Ini" : (currentTimeframe === "minggu_ini" ? "Minggu Ini" : "Bulan Ini");
      }
      if (targetInput) {
        targetInput.value = getTargetGoal(currentTimeframe);
      }
      targetModal.style.display = "flex";
      if (targetInput) targetInput.focus();
    });
  }

  if (targetCancelBtn && targetModal) {
    targetCancelBtn.addEventListener("click", () => {
      targetModal.style.display = "none";
    });
  }

  if (targetSaveBtn && targetModal) {
    targetSaveBtn.addEventListener("click", () => {
      const val = targetInput ? Number(targetInput.value) : 0;
      if (val > 0) {
        localStorage.setItem("kopi_owner_target_" + currentTimeframe, val);
        updateTargetOmsetUI(activeRevenueTotal);
      }
      targetModal.style.display = "none";
    });
  }

  // AI Governance Modal Listeners
  if (aiConfigBtn && aiModal) {
    aiConfigBtn.addEventListener("click", () => {
      if (aiKeyInput) {
        aiKeyInput.value = localStorage.getItem("openrouter_api_key") || "";
      }
      if (aiModelSelect) {
        aiModelSelect.value = localStorage.getItem("kopi_ai_model") || "google/gemini-2.0-flash-001";
      }
      aiModal.style.display = "flex";
      if (aiKeyInput) aiKeyInput.focus();
    });
  }

  if (aiCancelBtn && aiModal) {
    aiCancelBtn.addEventListener("click", () => {
      aiModal.style.display = "none";
    });
  }

  if (aiSaveBtn && aiModal) {
    aiSaveBtn.addEventListener("click", () => {
      if (aiKeyInput) {
        const key = aiKeyInput.value.trim();
        if (key) {
          localStorage.setItem("openrouter_api_key", key);
        } else {
          localStorage.removeItem("openrouter_api_key");
        }
      }
      if (aiModelSelect) {
        localStorage.setItem("kopi_ai_model", aiModelSelect.value);
      }
      updateAiGovernanceUI();
      aiModal.style.display = "none";
    });
  }

  // Listen to new order creation event to auto-refresh
  window.addEventListener("kopi:order-created", () => {
    fetchOwnerAnalytics(currentTimeframe);
  });

  // Initial Load — langsung jalankan jika sudah terverifikasi
  if (isVerified) {
    fetchOwnerAnalytics(currentTimeframe);
  }
});
