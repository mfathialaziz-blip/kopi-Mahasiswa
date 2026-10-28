<?php
/**
 * KOPI MAHASISWA — API Update Menu Endpoint
 * Menerima data JSON untuk mengupdate/menambah menu di MySQL
 * Kolom yang didukung: nama_menu, kategori, harga, stok, deskripsi, gambar, aktif
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, PUT, OPTIONS');
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
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false
    ]);

    // Baca JSON body
    $raw  = file_get_contents('php://input');
    $data = json_decode($raw, true);

    if (!$data || !isset($data['action'])) {
        http_response_code(400);
        echo json_encode(['error' => true, 'message' => 'Payload tidak valid. Butuh field: action']);
        exit;
    }

    $action = $data['action'];

    // -------------------------------------------------------
    // ACTION: update_gambar — Update kolom gambar berdasarkan nama_menu
    // -------------------------------------------------------
    if ($action === 'update_gambar') {
        $nama   = isset($data['nama_menu']) ? trim($data['nama_menu']) : '';
        $gambar = isset($data['gambar'])    ? trim($data['gambar'])    : '';

        if (!$nama) {
            http_response_code(400);
            echo json_encode(['error' => true, 'message' => 'Field nama_menu diperlukan.']);
            exit;
        }

        $stmt = $pdo->prepare("UPDATE `menu` SET `gambar` = ? WHERE `nama_menu` = ?");
        $stmt->execute([$gambar, $nama]);
        $affected = $stmt->rowCount();

        echo json_encode([
            'success'  => true,
            'affected' => $affected,
            'message'  => $affected > 0 ? "Gambar berhasil diperbarui untuk '{$nama}'" : "Menu '{$nama}' tidak ditemukan di database."
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // -------------------------------------------------------
    // ACTION: update_menu — Update semua field produk termasuk gambar
    // -------------------------------------------------------
    if ($action === 'update_menu') {
        $nama       = isset($data['nama_menu'])  ? trim($data['nama_menu'])  : '';
        $kategori   = isset($data['kategori'])   ? trim($data['kategori'])   : '';
        $harga      = isset($data['harga'])      ? (int)$data['harga']       : 0;
        $stok       = isset($data['stok'])       ? (int)$data['stok']        : 0;
        $deskripsi  = isset($data['deskripsi'])  ? trim($data['deskripsi'])  : '';
        $gambar     = isset($data['gambar'])     ? trim($data['gambar'])     : '';
        $nama_lama  = isset($data['nama_lama'])  ? trim($data['nama_lama'])  : $nama;

        if (!$nama_lama) {
            http_response_code(400);
            echo json_encode(['error' => true, 'message' => 'Field nama_lama diperlukan untuk identifikasi record.']);
            exit;
        }

        $stmt = $pdo->prepare(
            "UPDATE `menu` SET `nama_menu` = ?, `kategori` = ?, `harga` = ?, `stok` = ?, `deskripsi` = ?, `gambar` = ?
             WHERE LOWER(TRIM(`nama_menu`)) = LOWER(TRIM(?))"
        );
        $stmt->execute([$nama, $kategori, $harga, $stok, $deskripsi, $gambar, $nama_lama]);
        $affected = $stmt->rowCount();

        // Jika record belum ada sama sekali di database, buatkan record baru
        if ($affected === 0) {
            $check = $pdo->prepare("SELECT COUNT(*) FROM `menu` WHERE LOWER(TRIM(`nama_menu`)) = LOWER(TRIM(?))");
            $check->execute([$nama]);
            if ((int)$check->fetchColumn() === 0) {
                $ins = $pdo->prepare("INSERT INTO `menu` (`nama_menu`, `kategori`, `harga`, `stok`, `deskripsi`, `gambar`) VALUES (?, ?, ?, ?, ?, ?)");
                $ins->execute([$nama, $kategori, $harga, $stok, $deskripsi, $gambar]);
                $affected = 1;
            }
        }

        echo json_encode([
            'success'  => true,
            'affected' => $affected,
            'message'  => "Produk '{$nama}' berhasil diperbarui di database."
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // -------------------------------------------------------
    // ACTION: add_menu — Tambah menu baru ke database
    // -------------------------------------------------------
    if ($action === 'add_menu') {
        $nama      = isset($data['nama_menu']) ? trim($data['nama_menu']) : '';
        $kategori  = isset($data['kategori'])  ? trim($data['kategori'])  : 'kopi';
        $harga     = isset($data['harga'])     ? (int)$data['harga']      : 0;
        $stok      = isset($data['stok'])      ? (int)$data['stok']       : 0;
        $deskripsi = isset($data['deskripsi']) ? trim($data['deskripsi']) : '';
        $gambar    = isset($data['gambar'])    ? trim($data['gambar'])    : '';

        if (!$nama) {
            http_response_code(400);
            echo json_encode(['error' => true, 'message' => 'Field nama_menu diperlukan.']);
            exit;
        }

        // Cek duplikat
        $check = $pdo->prepare("SELECT COUNT(*) FROM `menu` WHERE `nama_menu` = ?");
        $check->execute([$nama]);
        if ((int)$check->fetchColumn() > 0) {
            echo json_encode(['success' => false, 'message' => "Menu '{$nama}' sudah ada di database."]);
            exit;
        }

        $stmt = $pdo->prepare(
            "INSERT INTO `menu` (`nama_menu`, `kategori`, `harga`, `stok`, `deskripsi`, `gambar`) VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([$nama, $kategori, $harga, $stok, $deskripsi, $gambar]);

        echo json_encode([
            'success' => true,
            'id'      => $pdo->lastInsertId(),
            'message' => "Menu '{$nama}' berhasil ditambahkan ke database."
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => true, 'message' => "Action '{$action}' tidak dikenal. Gunakan: update_gambar, update_menu, add_menu"]);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'error'   => true,
        'message' => 'Database error: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
