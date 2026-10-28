/**
 * KOPI MAHASISWA — CUSTOM LIGHTWEIGHT SALES CHART ENGINE
 * Renders smooth high-DPI Canvas charts with coffee-themed palettes and tooltips.
 */

class SalesChartEngine {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas ? this.canvas.getContext("2d") : null;
    this.chartData = { labels: [], revenueData: [], orderData: [] };
    this.animProgress = 0;
    this.animId = null;
    this.hoverIndex = -1;

    if (this.canvas) {
      this.initEvents();
    }
  }

  initEvents() {
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const count = this.chartData.labels.length;
      if (count === 0) return;

      const paddingLeft = 70;
      const paddingRight = 30;
      const chartWidth = this.canvas.width / (window.devicePixelRatio || 1) - paddingLeft - paddingRight;
      const slotWidth = chartWidth / count;

      const relX = x - paddingLeft;
      if (relX >= 0 && relX <= chartWidth) {
        const index = Math.min(count - 1, Math.max(0, Math.floor(relX / slotWidth)));
        if (this.hoverIndex !== index) {
          this.hoverIndex = index;
          this.draw(1);
        }
      } else if (this.hoverIndex !== -1) {
        this.hoverIndex = -1;
        this.draw(1);
      }
    });

    this.canvas.addEventListener("mouseleave", () => {
      if (this.hoverIndex !== -1) {
        this.hoverIndex = -1;
        this.draw(1);
      }
    });

    window.addEventListener("resize", () => {
      this.resize();
      this.draw(1);
    });
  }

  resize() {
    if (!this.canvas) return;
    const parent = this.canvas.parentElement;
    if (!parent) return;

    const dpr = window.devicePixelRatio || 1;
    const width = parent.clientWidth || 600;
    const height = 280;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = width + "px";
    this.canvas.style.height = height + "px";

    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }

  render(chartData) {
    if (!this.canvas || !this.ctx) return;
    this.chartData = chartData;
    this.resize();

    // Start Smooth Entry Animation
    if (this.animId) cancelAnimationFrame(this.animId);
    const startTime = performance.now();
    const duration = 500;

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      this.animProgress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - this.animProgress, 3);

      this.draw(eased);

      if (this.animProgress < 1) {
        this.animId = requestAnimationFrame(animate);
      }
    };

    this.animId = requestAnimationFrame(animate);
  }

  draw(progress = 1) {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;

    ctx.clearRect(0, 0, width, height);

    const labels = this.chartData.labels || [];
    const revenues = this.chartData.revenueData || [];
    const orders = this.chartData.orderData || [];
    const count = labels.length;

    const paddingLeft = 75;
    const paddingRight = 30;
    const paddingTop = 30;
    const paddingBottom = 40;

    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    // Calculate Max Value with cushion
    const rawMax = Math.max(...revenues, 50000);
    const maxVal = Math.ceil(rawMax / 50000) * 50000;

    // 1. Draw Grid Lines & Y-Axis Labels
    const gridLines = 4;
    ctx.strokeStyle = "#EBDDCF";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    ctx.font = "600 11px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = "#8D7060";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= gridLines; i++) {
      const yVal = (maxVal / gridLines) * i;
      const yPos = paddingTop + chartH - (i / gridLines) * chartH;

      ctx.beginPath();
      ctx.moveTo(paddingLeft, yPos);
      ctx.lineTo(width - paddingRight, yPos);
      ctx.stroke();

      // Label (format Rupiah in thousands/k)
      const labelText = yVal >= 1000 ? (yVal / 1000) + "k" : yVal;
      ctx.fillText("Rp " + labelText, paddingLeft - 10, yPos);
    }
    ctx.setLineDash([]);

    if (count === 0) {
      ctx.fillStyle = "#8D7060";
      ctx.textAlign = "center";
      ctx.font = "600 13px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText("Belum ada data transaksi pada periode ini", width / 2, height / 2);
      return;
    }

    const slotWidth = chartW / count;
    const barWidth = Math.min(36, slotWidth * 0.55);

    // 2. Draw Bars (Revenue)
    revenues.forEach((rev, idx) => {
      const val = rev * progress;
      const barH = (val / maxVal) * chartH;
      const xPos = paddingLeft + idx * slotWidth + (slotWidth - barWidth) / 2;
      const yPos = paddingTop + chartH - barH;
      const isHovered = this.hoverIndex === idx;

      // Gradient Bar fill
      const grad = ctx.createLinearGradient(0, yPos, 0, paddingTop + chartH);
      if (isHovered) {
        grad.addColorStop(0, "#E09867");
        grad.addColorStop(1, "#A45823");
      } else {
        grad.addColorStop(0, "#C67C4E");
        grad.addColorStop(1, "#3E2314");
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      const r = 6;
      ctx.roundRect(xPos, yPos, barWidth, Math.max(2, barH), [r, r, 0, 0]);
      ctx.fill();

      // Border for comic touch
      ctx.strokeStyle = "#24130B";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 3. Draw X-Axis Label
      ctx.fillStyle = isHovered ? "#C67C4E" : "#5C4133";
      ctx.font = isHovered ? "700 11px 'Plus Jakarta Sans', sans-serif" : "600 11px 'Plus Jakarta Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(labels[idx], paddingLeft + idx * slotWidth + slotWidth / 2, paddingTop + chartH + 10);
    });

    // 4. Draw Trend Line (Orders Count / Secondary)
    if (orders.length > 0) {
      ctx.beginPath();
      const maxOrders = Math.max(...orders, 5);
      orders.forEach((ord, idx) => {
        const val = ord * progress;
        const lineY = paddingTop + chartH - (val / maxOrders) * (chartH * 0.85);
        const lineX = paddingLeft + idx * slotWidth + slotWidth / 2;

        if (idx === 0) ctx.moveTo(lineX, lineY);
        else ctx.lineTo(lineX, lineY);
      });

      ctx.strokeStyle = "#FFCF55";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw Dots
      orders.forEach((ord, idx) => {
        const val = ord * progress;
        const lineY = paddingTop + chartH - (val / maxOrders) * (chartH * 0.85);
        const lineX = paddingLeft + idx * slotWidth + slotWidth / 2;

        ctx.fillStyle = "#24130B";
        ctx.beginPath();
        ctx.arc(lineX, lineY, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#FFCF55";
        ctx.beginPath();
        ctx.arc(lineX, lineY, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 5. Draw Hover Tooltip
    if (this.hoverIndex >= 0 && this.hoverIndex < count) {
      const idx = this.hoverIndex;
      const rev = revenues[idx];
      const ord = orders[idx] || 0;
      const label = labels[idx];

      const tooltipText1 = label;
      const tooltipText2 = `Pendapatan: Rp ${Number(rev).toLocaleString("id-ID")}`;
      const tooltipText3 = `Transaksi: ${ord} pesanan`;

      ctx.font = "700 12px 'Plus Jakarta Sans', sans-serif";
      const w1 = ctx.measureText(tooltipText1).width;
      ctx.font = "600 11px 'Plus Jakarta Sans', sans-serif";
      const w2 = ctx.measureText(tooltipText2).width;
      const w3 = ctx.measureText(tooltipText3).width;

      const ttW = Math.max(w1, w2, w3) + 24;
      const ttH = 68;

      let ttX = paddingLeft + idx * slotWidth + slotWidth / 2 - ttW / 2;
      ttX = Math.max(10, Math.min(width - ttW - 10, ttX));
      const ttY = Math.max(10, paddingTop - 20);

      // Tooltip Card
      ctx.fillStyle = "#190C06";
      ctx.strokeStyle = "#C67C4E";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(ttX, ttY, ttW, ttH, 8);
      ctx.fill();
      ctx.stroke();

      // Tooltip Text
      ctx.fillStyle = "#FFCF55";
      ctx.font = "700 12px 'Plus Jakarta Sans', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(tooltipText1, ttX + 12, ttY + 16);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "500 11px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText(tooltipText2, ttX + 12, ttY + 36);

      ctx.fillStyle = "#EFE4D7";
      ctx.fillText(tooltipText3, ttX + 12, ttY + 52);
    }
  }
}

// Attach to window
if (typeof window !== "undefined") {
  window.SalesChartEngine = SalesChartEngine;
}
