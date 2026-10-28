<?php
/**
 * KOPI MAHASISWA — SCHEDULER NOTIFIKASI DISKON BERKALA (2 MINGGU SEKALI)
 * 
 * Script ini dapat dijalankan:
 * 1. Lewat CLI / Cron / Windows Task Scheduler: php promo_scheduler.php
 * 2. Lewat Browser / Webhook: https://kopi.test/promo_scheduler.php
 * 
 * Mengirim broadcast promo 2 mingguan ke semua nomor WhatsApp member terdaftar
 * via bot Node.js (http://localhost:3000/api/broadcast-promo).
 */

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('Asia/Jakarta');

$isCli = (php_sapi_name() === 'cli');

function logMessage($msg, $isCli) {
    $time = date('[Y-m-d H:i:s WIB]');
    if ($isCli) {
        echo "$time $msg\n";
    }
}

logMessage("🚀 Memulai proses broadcast promo berkala (2 minggu sekali)...", $isCli);

$botApiUrl = 'http://localhost:3000/api/broadcast-promo';
$membersFile = __DIR__ . '/members.json';

if (!file_exists($membersFile)) {
    $err = "❌ File members.json tidak ditemukan di: $membersFile";
    logMessage($err, $isCli);
    echo json_encode(['success' => false, 'message' => $err]);
    exit(1);
}

$members = json_decode(file_get_contents($membersFile), true) ?: [];
$totalMembers = count($members);
logMessage("👥 Ditemukan $totalMembers member terdaftar.", $isCli);

// Pesan promo standar sesuai spesifikasi
$promoMessage = "Halo [Nama Member]! Spesial promo 2 mingguan Kopi Mahasiswa! Dapatkan diskon menarik khusus hari ini. Cek menumu sekarang di https://kopi.test ☕ promo terbatas!";

$payload = json_encode([
    'message' => $promoMessage,
    'source'  => 'php_scheduler'
]);

$ch = curl_init($botApiUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_TIMEOUT, 60);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($curlErr) {
    $errMsg = "❌ Gagal menghubungi server Bot Node.js (http://localhost:3000): $curlErr";
    logMessage($errMsg, $isCli);
    echo json_encode([
        'success' => false,
        'message' => $errMsg,
        'hint'    => 'Pastikan bot Node.js sudah berjalan dengan mengetik: node index.js'
    ], JSON_PRETTY_PRINT);
    exit(1);
}

$data = json_decode($response, true) ?: ['raw' => $response];

if ($httpCode >= 200 && $httpCode < 300) {
    logMessage("✅ Broadcast promo 2 mingguan sukses diproses!", $isCli);
    if (isset($data['totalSent'])) {
        logMessage("📊 Terkirim: {$data['totalSent']} | Gagal: {$data['failedCount']}", $isCli);
    }
} else {
    logMessage("⚠️ Server bot mengembalikan kode HTTP $httpCode: " . json_encode($data), $isCli);
}

if (!$isCli) {
    echo json_encode([
        'success'    => ($httpCode >= 200 && $httpCode < 300),
        'httpCode'   => $httpCode,
        'timestamp'  => date('Y-m-d H:i:s WIB'),
        'botResponse'=> $data
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

