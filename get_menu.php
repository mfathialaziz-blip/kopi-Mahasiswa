<?php
/**
 * KOPI MAHASISWA — API Get Menu Endpoint
 * Mengambil data menu dari database MySQL dalam format JSON
 * Kolom: nama_menu, kategori, harga, stok, deskripsi, gambar
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$host = 'localhost';
$user = 'root';
$pass = '';
$dbname = 'kopi';

try {
    // 1. Koneksi awal ke MySQL Server
    $pdo = new PDO("mysql:host=$host;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);

    // 2. Pastikan database 'kopi' dan tabel 'menu' tersedia
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE `$dbname`");

    $pdo->exec("CREATE TABLE IF NOT EXISTS `menu` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `nama_menu` VARCHAR(255) NOT NULL,
        `kategori` VARCHAR(100) NOT NULL,
        `harga` INT NOT NULL,
        `stok` INT NOT NULL DEFAULT 10,
        `deskripsi` TEXT,
        `gambar` TEXT DEFAULT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // 2a. Pastikan kolom gambar bertipe TEXT (upgrade dari VARCHAR jika perlu)
    try {
        $pdo->exec("ALTER TABLE `menu` ADD COLUMN `gambar` TEXT DEFAULT NULL");
    } catch (PDOException $alterEx) {
        // Kolom sudah ada — coba MODIFY ke TEXT untuk memastikan tipe data benar
        try {
            $pdo->exec("ALTER TABLE `menu` MODIFY COLUMN `gambar` TEXT DEFAULT NULL");
        } catch (PDOException $modEx) {
            // Abaikan jika tidak bisa dimodifikasi
        }
    }

    // 2b. Inisialisasi dan sinkronisasi data menu kafe resmi tanpa duplikasi (URL resmi Pinterest)
    $defaultMenus = [
        // [nama_menu, kategori, harga, stok, deskripsi, gambar]
        // ☕ COFFEE SERIES
        ['Kopi Susu Mahasiswa', 'kopi', 15000, 20, 'Espresso robusta-arabica blend dipadu susu creamy dan gula aren organik. Teman setia kuliah!', 'https://i.pinimg.com/736x/e0/2d/01/e02d0124461097bf06ec219eb51d5c69.jpg'],
        ['Americano / Kopi Hitam', 'kopi', 12000, 15, 'Double shot espresso dengan air mineral dingin/hangat. Dijamin melek ngerjain revisi skripsi.', 'https://i.pinimg.com/736x/0e/52/30/0e52308b27b6b9ea83aa371c0b01a5a8.jpg'],
        ['Cappuccino', 'kopi', 18000, 12, 'Espresso mantap dengan foam susu tebal dan taburan cocoa powder aromatik.', 'https://i.pinimg.com/1200x/bc/d2/0a/bcd20ada9e61be0077f08b4be21a4242.jpg'],
        ['Caramel Macchiato', 'kopi', 20000, 12, 'Layer steamed milk vanila, espresso mantap, dengan siraman saus karamel manis legit di atasnya.', 'https://i.pinimg.com/736x/3a/74/db/3a74db74d7ce5a4683e6f3a2f5dc6462.jpg'],
        ['Espresso Single', 'kopi', 10000, 18, 'Single shot ekstrak biji kopi pilihan dengan crema tebal keemasan dan aroma intens.', 'https://i.pinimg.com/1200x/e8/8c/96/e88c963b93c4ee2f3481b3576e2c9395.jpg'],
        ['Caffe Latte', 'kopi', 18000, 14, 'Paduan seimbang espresso dan steamed milk yang halus. Pas dinikmati sambil diskusi kelompok.', 'https://i.pinimg.com/736x/6b/4d/ca/6b4dcad544eec6fb886abf03514a7cc0.jpg'],
        ['Mocha Deadline', 'kopi', 20000, 10, 'Perpaduan kopi espresso pekat dan dark chocolate Belgia, manis legit penambah semangat nugas.', 'https://i.pinimg.com/736x/b7/38/53/b7385352694908aa56d7a4405404eb89.jpg'],

        // 🥛 NON-COFFEE
        ['Matcha Latte', 'non-kopi', 18000, 12, 'Matcha Uji Jepang asli dengan susu creamy. Rasa earthy autentik yang menenangkan.', 'https://i.pinimg.com/736x/16/6b/d0/166bd08582b84f62ec20ba9aa2110d3c.jpg'],
        ['Chocolate / Cokelat', 'non-kopi', 16000, 16, 'Cokelat murni premium dipadukan susu segar dingin/panas, legit dan melegakan pikiran.', 'https://i.pinimg.com/736x/c2/77/7f/c2777f71cb0e13b28a413113fce481a0.jpg'],
        ['Thai Tea Seger', 'non-kopi', 12000, 16, 'Racikan teh rempah khas Thailand berpadu susu kental manis gurih disajikan dingin menyegarkan.', 'https://i.pinimg.com/736x/d0/df/ce/d0dfce1ba2625e47d77bfec7930609b8.jpg'],
        ['Fresh Lemon Tea', 'non-kopi', 10000, 18, 'Seduhan teh pilihan dengan perasan lemon asli. Dingin, asam segar, langsung balikin fokus.', 'https://i.pinimg.com/1200x/a2/e6/34/a2e634d3e685e263ed681fdbbd8fce9f.jpg'],
        ['Taro Latte Creamy', 'non-kopi', 16000, 8, 'Rasa taro manis wangi dengan warna ungu estetik dan kelembutan susu murni.', 'https://i.pinimg.com/736x/08/f1/da/08f1da3145406ef23701a7383f149ecf.jpg'],

        // 🥐 SNACK & PASTRIES
        ['Pisang Coklat (Piscok)', 'makanan', 12000, 10, 'Kulit lumpia renyah membungkus pisang manis dan lelehan dark chocolate nikmat.', 'https://i.pinimg.com/1200x/a7/51/a1/a751a10a1b3fd8d3fb308a03453d1df9.jpg'],
        ['Kentang Goreng', 'makanan', 12000, 14, 'French fries garing gurih disajikan dengan saus sambal cocolan dan taburan bumbu rahasia.', 'https://i.pinimg.com/736x/66/9a/58/669a5862c19c0bd6e442ebca1c7d89a7.jpg'],
        ['Roti Bakar', 'makanan', 14000, 15, 'Roti bakar tebal renyah di luar, bertabur keju cheddar melimpah dan lumeran coklat manis.', 'https://i.pinimg.com/1200x/94/90/37/949037d9e892a69787585d8e1b70ce9a.jpg'],
        ['Dimsum Ayam', 'makanan', 15000, 12, 'Dimsum olahan daging ayam segar dibalut kulit tipis lembut, disajikan hangat dengan chili oil gurih.', 'https://i.pinimg.com/1200x/70/8b/75/708b7548e688948cacbc14339a4a820c.jpg'],
        ['Mie Dok-Dok Nugas', 'makanan', 15000, 10, 'Mie kuah kental gurih khas warkop modern berpadu telur kocok, sayuran segar, dan cabai rawit.', 'https://i.pinimg.com/736x/6c/9c/fb/6c9cfbda40f0d15572fb59e4ad30965e.jpg'],
        ['Donat Kampus Glazed', 'snack', 8000, 12, 'Donat kentang super empuk dengan topping cokelat leleh dan taburan meses warna-warni.', 'https://i.pinimg.com/1200x/47/eb/49/47eb4964e3d315ff758175b3274e5c74.jpg'],
        ['Choco Chip Cookies', 'snack', 10000, 15, 'Kue kering renyah harum mentega dengan limpahan dark choco chunks lezat.', 'https://i.pinimg.com/736x/b1/60/b5/b160b5a47f607efd3ef055f29b4a22ed.jpg'],
        ['Butter Croissant', 'snack', 14000, 6, 'Pastry ala Prancis dengan layer renyah di luar dan lembut wangi butter di dalam.', 'https://i.pinimg.com/736x/30/98/b3/3098b37993867ed5b37bd686d463ca4b.jpg']
    ];

    $checkStmt = $pdo->prepare("SELECT COUNT(*) FROM `menu` WHERE `nama_menu` = ?");
    $insertStmt = $pdo->prepare("INSERT INTO `menu` (`nama_menu`, `kategori`, `harga`, `stok`, `deskripsi`, `gambar`) VALUES (?, ?, ?, ?, ?, ?)");
    $updateGambarStmt = $pdo->prepare("UPDATE `menu` SET `gambar` = ? WHERE `nama_menu` = ?");
    foreach ($defaultMenus as $item) {
        $checkStmt->execute([$item[0]]);
        if ((int)$checkStmt->fetchColumn() === 0) {
            $insertStmt->execute($item);
        } else {
            // Update gambar secara konsisten ke gambar resmi terbaru
            $updateGambarStmt->execute([$item[5], $item[0]]);
        }
    }

    // 3. Query data menu (ambil semua kolom termasuk gambar dan id)
    $stmt = $pdo->query("SELECT id, nama_menu, kategori, harga, stok, deskripsi, gambar FROM `menu` ORDER BY id ASC");
    $menus = $stmt->fetchAll();

    // Format tipe data numerik
    foreach ($menus as &$menu) {
        $menu['id']    = (int)$menu['id'];
        $menu['harga'] = (int)$menu['harga'];
        $menu['stok']  = (int)$menu['stok'];
    }
    unset($menu);

    echo json_encode($menus, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'error' => true,
        'message' => 'Gagal mengambil data menu dari database MySQL: ' . $e->getMessage()
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
