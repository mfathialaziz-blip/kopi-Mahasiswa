<?php
/**
 * KOPI MAHASISWA — OWNER ANALYTICS & SALES METRICS API
 * Endpoint khusus Peran Owner untuk menghitung:
 * 1. Total Omset (Rp)
 * 2. Total Pesanan Terjual
 * 3. Menu Terlaris (Top Seller)
 * 4. Rata-rata Nilai Transaksi (AOV)
 * 5. Grafik Tren Penjualan Harian/Mingguan/Bulanan
 * 6. Tabel Top 5 Menu Paling Laris & 5 Menu Sepi Penjualan
 * 7. Penyimpanan Pesanan Real-Time dari Checkout Pelanggan
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$host   = 'localhost';
$user   = 'root';
$pass   = '';
$dbname = 'kopi';

try {
    // 1. Koneksi PDO ke MySQL Server
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false
    ]);

    // 2. Buat tabel `pesanan` jika belum ada dengan collation utf8mb4_unicode_ci
    $pdo->exec("CREATE TABLE IF NOT EXISTS `pesanan` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `kode_transaksi` VARCHAR(50) UNIQUE NOT NULL,
        `nama_pelanggan` VARCHAR(150) NOT NULL,
        `tipe_pesanan` VARCHAR(50) DEFAULT 'dine-in',
        `nomor_meja` VARCHAR(50) DEFAULT NULL,
        `metode_pembayaran` VARCHAR(50) DEFAULT 'QRIS',
        `total_omset` INT NOT NULL DEFAULT 0,
        `catatan` TEXT DEFAULT NULL,
        `status` VARCHAR(50) DEFAULT 'Berhasil',
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (`created_at`),
        INDEX (`kode_transaksi`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // 3. Buat tabel `pesanan_detail` jika belum ada dengan collation utf8mb4_unicode_ci
    $pdo->exec("CREATE TABLE IF NOT EXISTS `pesanan_detail` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `pesanan_id` INT NOT NULL,
        `kode_transaksi` VARCHAR(50) NOT NULL,
        `nama_menu` VARCHAR(255) NOT NULL,
        `harga` INT NOT NULL DEFAULT 0,
        `jumlah` INT NOT NULL DEFAULT 1,
        `subtotal` INT NOT NULL DEFAULT 0,
        `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX (`pesanan_id`),
        INDEX (`nama_menu`),
        INDEX (`created_at`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    // Pastikan collation seragam untuk menghindari error 1267 collation mismatch
    try {
        $pdo->exec("ALTER TABLE `pesanan` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        $pdo->exec("ALTER TABLE `pesanan_detail` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    } catch (Exception $eCol) {
        // Abaikan jika sudah seragam
    }

    // =========================================================
    // SEEDING DATA AWAL (JIKA TABEL PESANAN MASIH KOSONG)
    // Memberikan riwayat data penjualan realistis untuk Owner
    // =========================================================
    $orderCount = (int)$pdo->query("SELECT COUNT(*) FROM `pesanan`")->fetchColumn();
    if ($orderCount === 0) {
        seedInitialTransactions($pdo);
    }

    // =========================================================
    // HANDLER POST: SIMPAN TRANSAKSI BARU KE MYSQL
    // =========================================================
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw, true);

        if (!$data || !isset($data['id']) || !isset($data['total'])) {
            http_response_code(400);
            echo json_encode(['error' => true, 'message' => 'Payload transaksi tidak valid.']);
            exit;
        }

        $kodeTransaksi = trim($data['id']);
        $namaPelanggan = isset($data['customerName']) ? trim($data['customerName']) : 'Mahasiswa';
        $tipePesanan   = isset($data['orderType']) ? trim($data['orderType']) : 'dine-in';
        $nomorMeja     = isset($data['tableNumber']) ? trim($data['tableNumber']) : 'Meja 01';
        $metode        = isset($data['paymentMethod']) ? trim($data['paymentMethod']) : 'QRIS';
        $totalOmset    = (int)$data['total'];
        $catatan       = isset($data['notes']) ? trim($data['notes']) : '';
        $createdAt     = isset($data['date']) ? date('Y-m-d H:i:s', strtotime($data['date'])) : date('Y-m-d H:i:s');

        // Simpan header pesanan
        $stmtOrder = $pdo->prepare("INSERT INTO `pesanan` 
            (`kode_transaksi`, `nama_pelanggan`, `tipe_pesanan`, `nomor_meja`, `metode_pembayaran`, `total_omset`, `catatan`, `created_at`) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
        $stmtOrder->execute([$kodeTransaksi, $namaPelanggan, $tipePesanan, $nomorMeja, $metode, $totalOmset, $catatan, $createdAt]);
        $pesananId = $pdo->lastInsertId();

        // Simpan detail item pesanan
        if (isset($data['items']) && is_array($data['items'])) {
            $stmtDetail = $pdo->prepare("INSERT INTO `pesanan_detail` 
                (`pesanan_id`, `kode_transaksi`, `nama_menu`, `harga`, `jumlah`, `subtotal`, `created_at`) 
                VALUES (?, ?, ?, ?, ?, ?, ?)");
            foreach ($data['items'] as $item) {
                $namaMenu = isset($item['productName']) ? trim($item['productName']) : 'Menu Kafe';
                $harga    = isset($item['price']) ? (int)$item['price'] : 0;
                $jumlah   = isset($item['quantity']) ? (int)$item['quantity'] : 1;
                $subtotal = isset($item['subtotal']) ? (int)$item['subtotal'] : ($harga * $jumlah);
                $stmtDetail->execute([$pesananId, $kodeTransaksi, $namaMenu, $harga, $jumlah, $subtotal, $createdAt]);
            }
        }

        echo json_encode([
            'success'        => true,
            'message'        => 'Pesanan berhasil disimpan ke database MySQL.',
            'pesanan_id'     => $pesananId,
            'kode_transaksi' => $kodeTransaksi
        ]);
        exit;
    }

    // =========================================================
    // HANDLER GET: QUERY ANALYTICS UNTUK DASHBOARD OWNER
    // Parameter: timeframe = 'hari_ini' | 'minggu_ini' | 'bulan_ini' | 'all'
    // =========================================================
    $timeframe = isset($_GET['timeframe']) ? strtolower(trim($_GET['timeframe'])) : 'hari_ini';
    $now = new DateTime('now', new DateTimeZone('Asia/Jakarta'));

    // Tentukan range tanggal berdasarkan filter
    if ($timeframe === 'hari_ini' || $timeframe === 'today') {
        $startDate = $now->format('Y-m-d 00:00:00');
        $endDate   = $now->format('Y-m-d 23:59:59');
        $labelPeriod = 'Hari Ini (' . $now->format('d M Y') . ')';
    } elseif ($timeframe === 'minggu_ini' || $timeframe === 'week' || $timeframe === '7days') {
        $clone = clone $now;
        $clone->modify('-6 days');
        $startDate = $clone->format('Y-m-d 00:00:00');
        $endDate   = $now->format('Y-m-d 23:59:59');
        $labelPeriod = '7 Hari Terakhir';
    } elseif ($timeframe === 'bulan_ini' || $timeframe === 'month') {
        $startDate = $now->format('Y-m-01 00:00:00');
        $endDate   = $now->format('Y-m-t 23:59:59');
        $labelPeriod = 'Bulan Ini (' . $now->format('F Y') . ')';
    } else {
        // all-time
        $startDate = '2020-01-01 00:00:00';
        $endDate   = '2099-12-31 23:59:59';
        $labelPeriod = 'Semua Waktu';
    }

    // 1. QUERY KARTU RINGKASAN: TOTAL OMSET, TRANSAKSI, RATA-RATA NILAI TRANSAKSI
    $stmtSummary = $pdo->prepare("
        SELECT 
            COALESCE(SUM(total_omset), 0) AS total_omset,
            COUNT(*) AS total_pesanan,
            COALESCE(ROUND(AVG(total_omset)), 0) AS rata_rata_transaksi
        FROM `pesanan`
        WHERE `created_at` >= ? AND `created_at` <= ? AND `status` = 'Berhasil'
    ");
    $stmtSummary->execute([$startDate, $endDate]);
    $summary = $stmtSummary->fetch();

    $totalOmset      = (int)$summary['total_omset'];
    $totalPesanan    = (int)$summary['total_pesanan'];
    $rataRataPesanan = (int)$summary['rata_rata_transaksi'];

    // Total porsi terjual dalam periode
    $stmtItems = $pdo->prepare("
        SELECT COALESCE(SUM(pd.jumlah), 0) AS total_items
        FROM `pesanan_detail` pd
        JOIN `pesanan` p ON pd.pesanan_id = p.id
        WHERE p.created_at >= ? AND p.created_at <= ? AND p.status = 'Berhasil'
    ");
    $stmtItems->execute([$startDate, $endDate]);
    $totalPorsiTerjual = (int)$stmtItems->fetchColumn();

    // 2. QUERY TOP 5 MENU PALING LARIS
    $stmtTop = $pdo->prepare("
        SELECT 
            pd.nama_menu,
            COALESCE(SUM(pd.jumlah), 0) AS total_terjual,
            COALESCE(SUM(pd.subtotal), 0) AS total_omset,
            COALESCE(m.kategori, 'kopi') AS kategori,
            COALESCE(m.gambar, '') AS gambar,
            COALESCE(m.stok, 0) AS stok_sisa
        FROM `pesanan_detail` pd
        JOIN `pesanan` p ON pd.pesanan_id = p.id
        LEFT JOIN `menu` m ON LOWER(TRIM(m.nama_menu)) = LOWER(TRIM(pd.nama_menu)) COLLATE utf8mb4_unicode_ci
        WHERE p.created_at >= ? AND p.created_at <= ? AND p.status = 'Berhasil'
        GROUP BY pd.nama_menu, m.kategori, m.gambar, m.stok
        ORDER BY total_terjual DESC, total_omset DESC
        LIMIT 5
    ");
    $stmtTop->execute([$startDate, $endDate]);
    $topMenus = $stmtTop->fetchAll();

    foreach ($topMenus as &$tm) {
        $tm['total_terjual'] = (int)$tm['total_terjual'];
        $tm['total_omset']   = (int)$tm['total_omset'];
        $tm['stok_sisa']     = (int)$tm['stok_sisa'];
        $tm['kontribusi_pct'] = $totalOmset > 0 ? round(($tm['total_omset'] / $totalOmset) * 100, 1) : 0;
    }
    unset($tm);

    // Menu Terlaris (Top Seller #1)
    $menuTerlaris = !empty($topMenus) ? $topMenus[0] : [
        'nama_menu'     => 'Belum Ada Penjualan',
        'total_terjual' => 0,
        'total_omset'   => 0,
        'kategori'      => '-',
        'gambar'        => ''
    ];

    // 3. QUERY 5 MENU SEPI PENJUALAN (LOW SELLERS)
    // Mengambil menu dari katalog kafe yang penjualannya paling sedikit atau 0 pada periode tersebut
    $stmtLow = $pdo->prepare("
        SELECT 
            m.id AS menu_id,
            m.nama_menu,
            m.kategori,
            m.harga,
            m.stok AS stok_sisa,
            m.gambar,
            COALESCE(sales.terjual, 0) AS total_terjual,
            COALESCE(sales.omset, 0) AS total_omset
        FROM `menu` m
        LEFT JOIN (
            SELECT 
                pd.nama_menu,
                SUM(pd.jumlah) AS terjual,
                SUM(pd.subtotal) AS omset
            FROM `pesanan_detail` pd
            JOIN `pesanan` p ON pd.pesanan_id = p.id
            WHERE p.created_at >= ? AND p.created_at <= ? AND p.status = 'Berhasil'
            GROUP BY pd.nama_menu
        ) sales ON LOWER(TRIM(m.nama_menu)) = LOWER(TRIM(sales.nama_menu)) COLLATE utf8mb4_unicode_ci
        GROUP BY m.id, m.nama_menu, m.kategori, m.harga, m.stok, m.gambar, sales.terjual, sales.omset
        ORDER BY total_terjual ASC, m.nama_menu ASC
        LIMIT 5
    ");
    $stmtLow->execute([$startDate, $endDate]);
    $lowMenus = $stmtLow->fetchAll();

    foreach ($lowMenus as &$lm) {
        $lm['harga']         = (int)$lm['harga'];
        $lm['stok_sisa']     = (int)$lm['stok_sisa'];
        $lm['total_terjual'] = (int)$lm['total_terjual'];
        $lm['total_omset']   = (int)$lm['total_omset'];

        // Tambahkan rekomendasi bisnis owner
        if ($lm['total_terjual'] === 0) {
            $lm['rekomendasi'] = 'Adakan promo Beli 1 Gratis 1 atau diskon happy hour 25%';
            $lm['status_badge'] = 'Perlu Promo 🔥';
        } elseif ($lm['total_terjual'] <= 2) {
            $lm['rekomendasi'] = 'Bundling dengan Kopi Susu / Donat Kampus Paket Nugas';
            $lm['status_badge'] = 'Potensi Bundling 📦';
        } else {
            $lm['rekomendasi'] = 'Tingkatkan eksposur visual di papan menu & sosmed';
            $lm['status_badge'] = 'Tingkatkan Promo 📣';
        }
    }
    unset($lm);

    // 4. DATA GRAFIK TREN PENJUALAN HARIAN / MINGGUAN / BULANAN
    $chartLabels = [];
    $chartOmset  = [];
    $chartOrders = [];

    if ($timeframe === 'hari_ini' || $timeframe === 'today') {
        // Tren Per 2 Jam Hari Ini (08:00 - 22:00)
        $slots = [
            ['08:00', '08:00:00', '09:59:59'],
            ['10:00', '10:00:00', '11:59:59'],
            ['12:00', '12:00:00', '13:59:59'],
            ['14:00', '14:00:00', '15:59:59'],
            ['16:00', '16:00:00', '17:59:59'],
            ['18:00', '18:00:00', '19:59:59'],
            ['20:00', '20:00:00', '21:59:59'],
            ['22:00', '22:00:00', '23:59:59']
        ];
        $todayDate = $now->format('Y-m-d');

        $stmtSlot = $pdo->prepare("
            SELECT COALESCE(SUM(total_omset), 0) AS omset, COUNT(*) AS jml
            FROM `pesanan`
            WHERE `created_at` >= ? AND `created_at` <= ? AND `status` = 'Berhasil'
        ");

        foreach ($slots as $slot) {
            $chartLabels[] = $slot[0];
            $slotStart = "$todayDate {$slot[1]}";
            $slotEnd   = "$todayDate {$slot[2]}";
            $stmtSlot->execute([$slotStart, $slotEnd]);
            $res = $stmtSlot->fetch();
            $chartOmset[]  = (int)$res['omset'];
            $chartOrders[] = (int)$res['jml'];
        }

    } elseif ($timeframe === 'minggu_ini' || $timeframe === 'week' || $timeframe === '7days') {
        // Tren 7 Hari Terakhir
        $stmtDay = $pdo->prepare("
            SELECT COALESCE(SUM(total_omset), 0) AS omset, COUNT(*) AS jml
            FROM `pesanan`
            WHERE `created_at` >= ? AND `created_at` <= ? AND `status` = 'Berhasil'
        ");

        for ($i = 6; $i >= 0; $i--) {
            $d = clone $now;
            $d->modify("-$i days");
            $dayStr   = $d->format('Y-m-d');
            $dayLabel = $d->format('D, d M'); // misal: Kam, 15 Okt

            // Terjemahkan nama hari ke Indonesia
            $dayLabel = str_replace(
                ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
                ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'],
                $dayLabel
            );
            $chartLabels[] = $dayLabel;

            $stmtDay->execute(["$dayStr 00:00:00", "$dayStr 23:59:59"]);
            $res = $stmtDay->fetch();
            $chartOmset[]  = (int)$res['omset'];
            $chartOrders[] = (int)$res['jml'];
        }

    } else {
        // Tren 4 Minggu di Bulan Ini
        $yearMonth = $now->format('Y-m');
        $weeks = [
            ['Minggu 1', "$yearMonth-01 00:00:00", "$yearMonth-07 23:59:59"],
            ['Minggu 2', "$yearMonth-08 00:00:00", "$yearMonth-14 23:59:59"],
            ['Minggu 3', "$yearMonth-15 00:00:00", "$yearMonth-21 23:59:59"],
            ['Minggu 4', "$yearMonth-22 00:00:00", "$yearMonth-31 23:59:59"]
        ];

        $stmtWeek = $pdo->prepare("
            SELECT COALESCE(SUM(total_omset), 0) AS omset, COUNT(*) AS jml
            FROM `pesanan`
            WHERE `created_at` >= ? AND `created_at` <= ? AND `status` = 'Berhasil'
        ");

        foreach ($weeks as $w) {
            $chartLabels[] = $w[0];
            $stmtWeek->execute([$w[1], $w[2]]);
            $res = $stmtWeek->fetch();
            $chartOmset[]  = (int)$res['omset'];
            $chartOrders[] = (int)$res['jml'];
        }
    }

    // 5. BREAKDOWN METODE PEMBAYARAN
    $stmtPay = $pdo->prepare("
        SELECT 
            metode_pembayaran,
            COUNT(*) AS transaksi_count,
            COALESCE(SUM(total_omset), 0) AS total_nominal
        FROM `pesanan`
        WHERE `created_at` >= ? AND `created_at` <= ? AND `status` = 'Berhasil'
        GROUP BY metode_pembayaran
    ");
    $stmtPay->execute([$startDate, $endDate]);
    $paymentRows = $stmtPay->fetchAll();

    $paymentBreakdown = ['qris' => ['count' => 0, 'total' => 0], 'tunai' => ['count' => 0, 'total' => 0]];
    foreach ($paymentRows as $pr) {
        $method = strtolower($pr['metode_pembayaran']);
        if (strpos($method, 'qris') !== false) {
            $paymentBreakdown['qris']['count'] += (int)$pr['transaksi_count'];
            $paymentBreakdown['qris']['total'] += (int)$pr['total_nominal'];
        } else {
            $paymentBreakdown['tunai']['count'] += (int)$pr['transaksi_count'];
            $paymentBreakdown['tunai']['total'] += (int)$pr['total_nominal'];
        }
    }

    // Response JSON Lengkap untuk Frontend Owner Dashboard
    echo json_encode([
        'success'      => true,
        'timeframe'    => $timeframe,
        'label_period' => $labelPeriod,
        'range'        => ['start' => $startDate, 'end' => $endDate],
        'summary'      => [
            'total_omset'            => $totalOmset,
            'total_omset_formatted'  => 'Rp ' . number_format($totalOmset, 0, ',', '.'),
            'total_pesanan'          => $totalPesanan,
            'total_porsi_terjual'    => $totalPorsiTerjual,
            'rata_rata_transaksi'    => $rataRataPesanan,
            'rata_rata_formatted'    => 'Rp ' . number_format($rataRataPesanan, 0, ',', '.'),
            'menu_terlaris'          => $menuTerlaris
        ],
        'chart' => [
            'labels'  => $chartLabels,
            'revenue' => $chartOmset,
            'orders'  => $chartOrders
        ],
        'top_menus'         => $topMenus,
        'low_menus'         => $lowMenus,
        'payment_breakdown' => $paymentBreakdown
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'error'   => true,
        'message' => 'Database error: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * Helper Seeding Data Awal untuk Riwayat Transaksi Realistis
 */
function seedInitialTransactions($pdo) {
    $now = new DateTime('now', new DateTimeZone('Asia/Jakarta'));

    // Daftar pesanan dummy mahasiswa dalam 7 hari terakhir
    $dummyOrders = [
        // Hari Ini
        [
            'kode' => 'KM-' . $now->format('Ymd') . '-001',
            'nama' => 'Adit Pratama',
            'tipe' => 'dine-in',
            'meja' => 'Meja 03',
            'metode' => 'QRIS',
            'catatan' => 'Es batu dipisah ya mas',
            'date_offset' => 0,
            'hours' => 9,
            'items' => [
                ['Kopi Susu Gula Aren', 15000, 2],
                ['Pisang Coklat Lumer', 12000, 1]
            ]
        ],
        [
            'kode' => 'KM-' . $now->format('Ymd') . '-002',
            'nama' => 'Rina Amalia (Fasilkom)',
            'tipe' => 'dine-in',
            'meja' => 'Meja 07',
            'metode' => 'QRIS',
            'catatan' => 'Gula aren sedikit saja',
            'date_offset' => 0,
            'hours' => 11,
            'items' => [
                ['Americano', 12000, 1],
                ['Donat Kampus Glazed', 8000, 2]
            ]
        ],
        [
            'kode' => 'KM-' . $now->format('Ymd') . '-003',
            'nama' => 'Bima Sakti',
            'tipe' => 'takeaway',
            'meja' => 'Takeaway (Bungkus)',
            'metode' => 'Tunai',
            'catatan' => 'Dibungkus kantong terpisah',
            'date_offset' => 0,
            'hours' => 13,
            'items' => [
                ['Kopi Susu Gula Aren', 15000, 3],
                ['Mie Dok-Dok Nugas', 15000, 2]
            ]
        ],
        [
            'kode' => 'KM-' . $now->format('Ymd') . '-004',
            'nama' => 'Fathur Rahman',
            'tipe' => 'dine-in',
            'meja' => 'Meja 02',
            'metode' => 'QRIS',
            'catatan' => 'Nugas skripsi',
            'date_offset' => 0,
            'hours' => 15,
            'items' => [
                ['Cappuccino', 18000, 1],
                ['French Fries Crispy', 12000, 1]
            ]
        ],
        [
            'kode' => 'KM-' . $now->format('Ymd') . '-005',
            'nama' => 'Dinda & Tim KKN',
            'tipe' => 'dine-in',
            'meja' => 'Meja 10',
            'metode' => 'QRIS',
            'catatan' => 'Rapat kelompok',
            'date_offset' => 0,
            'hours' => 17,
            'items' => [
                ['Matcha Latte Premium', 18000, 2],
                ['Chocolate Milkshake', 16000, 2],
                ['Roti Bakar Keju Cokelat', 14000, 2]
            ]
        ],
        // Kemarin & Hari-hari sebelumnya
        [
            'kode' => 'KM-' . (clone $now)->modify('-1 day')->format('Ymd') . '-001',
            'nama' => 'Yoga Arianto',
            'tipe' => 'dine-in',
            'meja' => 'Meja 05',
            'metode' => 'QRIS',
            'catatan' => '',
            'date_offset' => -1,
            'hours' => 10,
            'items' => [
                ['Kopi Susu Gula Aren', 15000, 2],
                ['Dimsum Ayam', 15000, 1]
            ]
        ],
        [
            'kode' => 'KM-' . (clone $now)->modify('-1 day')->format('Ymd') . '-002',
            'nama' => 'Nadia Putri',
            'tipe' => 'takeaway',
            'meja' => 'Takeaway',
            'metode' => 'Tunai',
            'catatan' => '',
            'date_offset' => -1,
            'hours' => 14,
            'items' => [
                ['Thai Tea Segar', 12000, 2],
                ['Choco Chip Cookies', 10000, 1]
            ]
        ],
        [
            'kode' => 'KM-' . (clone $now)->modify('-2 days')->format('Ymd') . '-001',
            'nama' => 'Kelompok 4 Statistika',
            'tipe' => 'dine-in',
            'meja' => 'Meja 08',
            'metode' => 'QRIS',
            'catatan' => 'Colokan meja 8',
            'date_offset' => -2,
            'hours' => 16,
            'items' => [
                ['Kopi Susu Gula Aren', 15000, 4],
                ['French Fries Crispy', 12000, 2],
                ['Pisang Coklat Lumer', 12000, 2]
            ]
        ],
        [
            'kode' => 'KM-' . (clone $now)->modify('-3 days')->format('Ymd') . '-001',
            'nama' => 'Gilang Ramadhan',
            'tipe' => 'dine-in',
            'meja' => 'Meja 01',
            'metode' => 'QRIS',
            'catatan' => '',
            'date_offset' => -3,
            'hours' => 12,
            'items' => [
                ['Americano', 12000, 2],
                ['Mie Dok-Dok Nugas', 15000, 1]
            ]
        ],
        [
            'kode' => 'KM-' . (clone $now)->modify('-4 days')->format('Ymd') . '-001',
            'nama' => 'Siti Maulida',
            'tipe' => 'dine-in',
            'meja' => 'Meja 04',
            'metode' => 'Tunai',
            'catatan' => '',
            'date_offset' => -4,
            'hours' => 15,
            'items' => [
                ['Caffe Latte Santai', 18000, 1],
                ['Donat Kampus Glazed', 8000, 1]
            ]
        ],
        [
            'kode' => 'KM-' . (clone $now)->modify('-5 days')->format('Ymd') . '-001',
            'nama' => 'Panitia BEM Kampus',
            'tipe' => 'dine-in',
            'meja' => 'Meja 12',
            'metode' => 'QRIS',
            'catatan' => 'Meeting koordinasi',
            'date_offset' => -5,
            'hours' => 18,
            'items' => [
                ['Kopi Susu Gula Aren', 15000, 5],
                ['Dimsum Ayam', 15000, 3],
                ['French Fries Crispy', 12000, 2]
            ]
        ]
    ];

    $insOrder  = $pdo->prepare("INSERT INTO `pesanan` (`kode_transaksi`, `nama_pelanggan`, `tipe_pesanan`, `nomor_meja`, `metode_pembayaran`, `total_omset`, `catatan`, `created_at`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    $insDetail = $pdo->prepare("INSERT INTO `pesanan_detail` (`pesanan_id`, `kode_transaksi`, `nama_menu`, `harga`, `jumlah`, `subtotal`, `created_at`) VALUES (?, ?, ?, ?, ?, ?, ?)");

    foreach ($dummyOrders as $o) {
        $d = clone $now;
        if ($o['date_offset'] !== 0) {
            $d->modify("{$o['date_offset']} days");
        }
        $d->setTime($o['hours'], rand(10, 50), 0);
        $dateStr = $d->format('Y-m-d H:i:s');

        $totalOmset = 0;
        foreach ($o['items'] as $it) {
            $totalOmset += ($it[1] * $it[2]);
        }

        $insOrder->execute([
            $o['kode'],
            $o['nama'],
            $o['tipe'],
            $o['meja'],
            $o['metode'],
            $totalOmset,
            $o['catatan'],
            $dateStr
        ]);
        $orderId = $pdo->lastInsertId();

        foreach ($o['items'] as $it) {
            $sub = $it[1] * $it[2];
            $insDetail->execute([
                $orderId,
                $o['kode'],
                $it[0],
                $it[1],
                $it[2],
                $sub,
                $dateStr
            ]);
        }
    }
}
