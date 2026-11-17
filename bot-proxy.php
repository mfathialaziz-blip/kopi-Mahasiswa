<?php
/**
 * KOPI MAHASISWA — PHP Proxy untuk Bot WhatsApp Node.js
 * 
 * Jembatan antara browser (HTTPS) dan bot Node.js (HTTP localhost:3000)
 * Browser tidak bisa langsung panggil http:// dari halaman https://
 * Solusi: semua panggilan bot diproxy lewat PHP yang berjalan di server
 * 
 * Endpoints yang didukung:
 *   GET  /bot-proxy.php?action=status
 *   POST /bot-proxy.php?action=login
 *   POST /bot-proxy.php?action=notif-member
 *   POST /bot-proxy.php?action=broadcast-promo
 *   GET  /bot-proxy.php?action=members
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$BOT_BASE = 'http://127.0.0.1:3000';
$action   = $_GET['action'] ?? 'status';

// Map action ke endpoint bot
$endpointMap = [
    'status'          => ['GET',  '/api/status'],
    'bot-status'      => ['GET',  '/api/bot-status'],
    'login'           => ['POST', '/api/login'],
    'notif-member'    => ['POST', '/api/notif-member'],
    'register'        => ['POST', '/api/notif-member'],
    'broadcast-promo' => ['POST', '/api/broadcast-promo'],
    'promo-berkala'   => ['POST', '/api/broadcast-promo'],
    'members'           => ['GET',  '/api/members'],
    'ai-chat'           => ['POST', '/api/ai-chat'],
    'analytics-summary' => ['GET',  '/api/analytics-summary'],
];

if (!isset($endpointMap[$action])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => "Action '$action' tidak dikenal."]);
    exit;
}

[$method, $path] = $endpointMap[$action];
$url = $BOT_BASE . $path;

// Baca body dari request browser
$rawBody = file_get_contents('php://input');
$isPost  = ($method === 'POST');

// Inject data sesi member aktif jika action = ai-chat
if ($action === 'ai-chat') {
    if (session_status() === PHP_SESSION_NONE) {
        @session_start();
    }
    $decodedBody = json_decode($rawBody, true) ?: [];
    if (empty($decodedBody['member']) && !empty($_SESSION['km_member_data'])) {
        $decodedBody['member'] = $_SESSION['km_member_data'];
    } elseif (empty($decodedBody['member']) && !empty($_COOKIE['km_member_data'])) {
        $decodedBody['member'] = json_decode($_COOKIE['km_member_data'], true);
    }
    if (empty($decodedBody['name'])) {
        if (!empty($_SESSION['km_auth_user'])) {
            $decodedBody['name'] = $_SESSION['km_auth_user'];
        } elseif (!empty($_COOKIE['km_member_name'])) {
            $decodedBody['name'] = $_COOKIE['km_member_name'];
        }
    }
    $rawBody = json_encode($decodedBody);
}

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);

if ($isPost) {
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $rawBody ?: '{}');
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
}

$result   = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

// Bot tidak bisa dihubungi sama sekali (port 3000 mati)
if ($curlErr && $httpCode === 0) {
    // Fallback khusus untuk membaca data members.json jika bot sedang offline
    if ($action === 'members') {
        $membersFile = __DIR__ . '/members.json';
        if (file_exists($membersFile)) {
            $raw = file_get_contents($membersFile);
            $membersData = json_decode($raw, true) ?: [];
            http_response_code(200);
            echo json_encode([
                'status'    => 'success',
                'success'   => true,
                'total'     => count($membersData),
                'data'      => $membersData,
                'botOnline' => false
            ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            exit;
        }
    }

    http_response_code(503);
    echo json_encode([
        'success'    => false,
        'botOnline'  => false,
        'message'    => 'Server bot Node.js tidak bisa dihubungi. Jalankan: node index.js',
        'curlError'  => $curlErr,
    ]);
    exit;
}

// Bot merespons (meski 404 sekalipun = server nyala)
$decoded = json_decode($result, true);
if (is_array($decoded)) {
    $decoded['botOnline'] = ($httpCode > 0 && $httpCode < 500);
    echo json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} else {
    // Jika response bukan JSON (misal "Cannot GET /api/status")
    // Tetap tandai botOnline = true karena server merespons
    $isBotOnline = ($httpCode > 0 && $httpCode < 500);
    echo json_encode([
        'success'   => false,
        'botOnline' => $isBotOnline,
        'httpCode'  => $httpCode,
        'raw'       => $result,
        'message'   => $isBotOnline
            ? 'Bot online tapi route tidak ditemukan (versi lama?). Restart node index.js.'
            : 'Bot tidak dapat dihubungi.',
    ]);
}

