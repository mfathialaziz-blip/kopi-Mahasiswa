Nama : Muhammad Fathi Al Aziz
Nim  : 41257128
Kelas: TI 1B 2025
matkul : Rekayasa Perangkat Lunak

# ☕ KOPI MAHASISWA — Smart Cafe POS & AI Virtual Barista

> **Satu Sistem Terintegrasi untuk Pemesanan Menu, Kasir Operasional Kafe, Notifikasi WhatsApp, Analitik Finansial Owner, dan Asisten Cerdas KopiAI.**

---

**Pengembang:** **Muhammad Fathialaziz**  
**Role Project:** Full Stack Developer & AI Engineer  
**Teknologi:** PHP Native, MySQL (PDO), JavaScript (ES6+), Node.js (WhatsApp Bot & AI Proxy), OpenRouter API, Chart.js.

---

## 📌 1. Ringkasan Proyek (Overview)

**Kopi Mahasiswa** adalah aplikasi berbasis web (*web-based*) terintegrasi yang dirancang khusus untuk memfasilitasi operasional bisnis kedai kopi modern. Aplikasi ini membagi alur kerja ke dalam **3 tingkat peran (Multi-Role Authentication)** dengan antarmuka dan hak akses yang terisolasi secara ketat:

1. **Member (Pelanggan / Mahasiswa):** Akses katalog menu interaktif, diskon spesial 10%, pengumpulan riwayat transaksi, pemutar musik Lo-Fi Kafe, dan asisten virtual ramah **KopiAI Live**.
2. **Admin (Kasir & Staf):** Panel operasional harian kasir (POS), pencatatan transaksi masuk, manajemen menu & stok, dan penasehat bisnis **KopiAI Admin**.
3. **Owner (Pemilik Kafe):** *Executive Suite* berkelas dark luxury untuk memantau omset penjualan riil dari MySQL, grafik fluktuasi pendapatan (Chart.js), target omset dinamis, simulasi margin/HPP, kontrol tata kelola AI, audit 5 transaksi terkini, serta ekspor laporan CSV.

---

## 🌟 2. Fitur Unggulan Sistem

### 🎓 A. Portal Member (Pemesanan & Hiburan)
- **Katalog Menu Lengkap:** Filter kategori (Kopi, Non-Kopi, Makanan, Camilan) lengkap dengan foto produk dan status stok real-time.
- **Diskon Khusus Member 10%:** Otomatis dipotong dari total belanja saat pelanggan login dengan nomor WhatsApp terdaftar.
- **Notifikasi WhatsApp Otomatis:** Integrasi bot Node.js yang mengirimkan struk digital dan ucapan selamat datang langsung ke nomor WhatsApp pelanggan.
- **Lo-Fi Cafe Music Player:** Pemutar audio latar musik santai untuk menemani waktu ngopi atau nugas mahasiswa.
- **KopiAI Live (Gen Z Barista):** Chatbot AI ramah dan gaul yang merekomendasikan menu kopi berdasarkan suasana hati (*mood*), selera manis, atau rekomendasi begadang nugas.

### ⚙️ B. Portal Kasir & Admin (Operasional)
- **POS & Transaksi Kasir:** Pencatatan pesanan cepat (QRIS Statis/Dinamis dan Uang Tunai/Cash).
- **Manajemen Menu & Stok:** Tambah menu baru, edit harga, sesuaikan persediaan stok, atau ubah status menu.
- **Sinkronisasi Multi-Penyimpanan:** Terhubung langsung ke database MySQL `kopi.pesanan` dengan fallback otomatis ke `localStorage` jika koneksi terputus.
- **KopiAI Admin (Business Advisor):** Chatbot AI internal yang membaca seluruh transaksi periode aktif, mampu menjawab total omset, daftar nama pembeli, rincian pesanan, hingga menu terlaris.

### 👑 C. Executive Owner Suite (Finansial & Strategis)
- **4 Kartu KPI Finansial:** Total Omset (Rp), Total Pesanan Terjual, Menu Terlaris (*Top Seller*), dan Rata-rata Nilai Transaksi (*AOV*).
- **Target Omset & Progress Bar Eksekutif:** Pengaturan target omset dinamis dengan persentase pencapaian serta indikator surplus / sisa target.
- **Estimasi Margin & HPP (Gross Margin):** Simulasi slider persentase HPP (10% - 90%) untuk memproyeksikan HPP (modal) dan laba kotor operasional.
- **Grafik Tren Penjualan:** Visualisasi Chart.js multi-sumbu membandingkan omset (Rp) dan frekuensi pesanan (Tx) per periode (Hari Ini, Minggu Ini, Bulan Ini).
- **Top 5 Menu Laris vs 5 Menu Sepi:** Analisis kontribusi penjualan menu unggulan serta saran taktis promo/bundling untuk menu yang kurang laku.
- **Tata Kelola AI (KopiAI Governance):** Status kesiapan OpenRouter API, model AI terpilih, jumlah interaksi chat, dan konfigurasi API key terpusat.
- **Audit 5 Transaksi Terkini:** Kontrol cepat terhadap 5 transaksi riil terbaru dari kasir.
- **Ekspor Data Eksekutif (CSV):** Mengunduh rekapitulasi data periode aktif ke file `.csv` ber-BOM UTF-8 yang langsung kompatibel dengan Microsoft Excel.

---

## 🔑 3. Kredensial Akun Pengujian (Testing)

| Peran (Role) | URL Akses | Username / Nomor WA | Kata Sandi / PIN | Hak Akses |
| :--- | :--- | :--- | :--- | :--- |
| **Admin (Kasir)** | `/login.php?role=admin` | `admin` | `admin123` / `admin12345` | Akses kasir harian, manajemen stok & POS |
| **Owner (Pemilik)** | `/login.php?role=owner` | `owner` | `owner123` / PIN: `1234` | Akses penuh dashboard analitik & finansial |
| **Member (Pelanggan)** | `/login.php?role=member` | `083156957399` | `123456` | Katalog menu, diskon 10%, KopiAI Live |

---

## 🛠️ 4. Tech Stack & Arsitektur

```
[ Frontend: HTML5 / CSS3 / Vanilla JavaScript ES6+ / Chart.js ]
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
[ Backend: PHP Native ]        [ Background Service: Node.js ]
  ├── Autentikasi Multi-Role     ├── WhatsApp Web Bot (whatsapp-web.js)
  ├── Session & Cookie Guard     ├── REST API Gateway (/api/login, /api/ai-chat)
  └── PDO MySQL (Database kopi)  └── OpenRouter AI Proxy (Gemini 2.0 Flash)
```

- **Bahasa Pemrograman:** PHP 8.x & JavaScript (Node.js & Browser ES6+)
- **Server:** Apache HTTP Server (.htaccess rewrite rules) via Laragon
- **Database:** MySQL (Tabel `pesanan` dan `pesanan_detail`)
- **Penyimpanan Lokal:** `members.json` & `localStorage`
- **Integrasi AI:** OpenRouter API (Google Gemini 2.0 Flash / Meta Llama 3.3)
- **Integrasi WhatsApp:** `whatsapp-web.js` + Puppeteer Headless Chrome

---

## 🚀 5. Panduan Menjalankan Proyek di Lokal (Laragon)

1. **Persiapan Direktori:**
   Tempatkan folder proyek di dalam web root Laragon:
   ```
   C:\laragon\www\kopi
   ```

2. **Jalankan Apache & MySQL:**
   Buka Laragon, lalu klik tombol **Start All**.

3. **Inisialisasi Database:**
   - Buka phpMyAdmin (`http://localhost/phpmyadmin`).
   - Buat database baru dengan nama `kopi`.
   - Tabel `pesanan` dan `pesanan_detail` beserta seed 21 transaksi awal akan dibuat otomatis saat halaman pertama kali dibuka.

4. **Konfigurasi Environment (.env):**
   Salin `.env.example` menjadi `.env` lalu sesuaikan kredensial database dan API Key AI:
   ```env
   PORT=3000
   APP_URL=https://kopi.test
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=kopi
   OPENROUTER_API_KEY=masukkan_api_key_disini
   OPENROUTER_DEFAULT_MODEL=google/gemini-2.0-flash-001
   ```

5. **Akses Aplikasi melalui Browser:**
   - **Gerbang Utama:** `http://localhost/kopi/` atau `http://kopi.test/`
   - **Halaman Login Terpadu:** `http://localhost/kopi/login.php`
   - **Menu Member:** `http://localhost/kopi/menu.php`
   - **Dashboard Admin:** `http://localhost/kopi/admin.php`
   - **Dashboard Owner:** `http://localhost/kopi/owner.php`

---

## 📄 6. Lisensi & Hak Cipta

Dibuat dengan ☕ oleh **Muhammad Fathialaziz** (Virtual Barista Project).  
Semua hak cipta dilindungi undang-undang.

