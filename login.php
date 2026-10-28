<?php
/**
 * KOPI MAHASISWA — LOGIN MEMBER & NOTIFIKASI WHATSAPP
 */

header('X-Content-Type-Options: nosniff');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$membersFile = __DIR__ . '/members.json';
$botApiUrl   = 'http://localhost:3000/api/login';

// Helper format nomor HP ke 62...
function formatToIndonesianPhone($phone) {
    $clean = preg_replace('/\D/', '', (string)$phone);
    if (empty($clean)) return '';
    if (str_starts_with($clean, '08')) {
        $clean = '628' . substr($clean, 2);
    } elseif (str_starts_with($clean, '0')) {
        $clean = '62' . substr($clean, 1);
    } elseif (str_starts_with($clean, '8')) {
        $clean = '628' . substr($clean, 1);
    }
    return $clean;
}

$error = '';

// Tangani Request POST (API Login / Form Submission)
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $rawInput = file_get_contents('php://input');
    $jsonData = json_decode($rawInput, true);

    $phoneInput = '';
    if (!empty($jsonData['phone']) || !empty($jsonData['nomorHp'])) {
        $phoneInput = $jsonData['phone'] ?? $jsonData['nomorHp'] ?? '';
    } else {
        $phoneInput = $_POST['phone'] ?? $_POST['nomorHp'] ?? '';
    }

    $formattedPhone = formatToIndonesianPhone($phoneInput);

    if (empty($formattedPhone)) {
        $error = 'Nomor WhatsApp wajib diisi.';
        if (!empty($jsonData)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => $error]);
            exit;
        }
    } else {
        // 1. Cek member di members.json
        $members = [];
        if (file_exists($membersFile)) {
            $members = json_decode(file_get_contents($membersFile), true) ?: [];
        }

        $foundMember = null;
        foreach ($members as $m) {
            $mPhone = formatToIndonesianPhone($m['phone'] ?? $m['cleanPhone'] ?? '');
            if ($mPhone === $formattedPhone) {
                $foundMember = $m;
                break;
            }
        }

        if (!$foundMember) {
            $error = 'Nomor WhatsApp belum terdaftar. Silakan daftar member terlebih dahulu.';
            if (!empty($jsonData)) {
                http_response_code(404);
                echo json_encode(['success' => false, 'message' => $error]);
                exit;
            }
        } else {
            // 2. Kirim Notifikasi via Bot Node.js (http://localhost:3000/api/login)
            date_default_timezone_set('Asia/Jakarta');
            $bulanIndo = [1 => 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
            $waktuLogin = date('d ') . ($bulanIndo[(int)date('n')] ?? date('F')) . date(' Y pukul H:i') . ' WIB';

            $notifMsg = "Halo " . $foundMember['name'] . "! Kamu berhasil login di Kopi Mahasiswa pada " . $waktuLogin . ". Selamat menikmati kopi favoritmu! ☕";

            $payload = json_encode([
                'phone'   => $formattedPhone,
                'message' => $notifMsg
            ]);

            $botApiUrls = [
                'http://127.0.0.1:3000/api/login',
                'http://localhost:3000/api/login'
            ];

            $waSuccess = false;
            $waResponse = null;
            $lastErr = '';
            $lastCode = 0;

            foreach ($botApiUrls as $targetUrl) {
                $ch = curl_init($targetUrl);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
                curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
                curl_setopt($ch, CURLOPT_TIMEOUT, 6);
                curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
                $result = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $curlError = curl_error($ch);
                curl_close($ch);

                $lastErr = $curlError;
                $lastCode = $httpCode;

                if (!$curlError && $result && $httpCode >= 200 && $httpCode < 300) {
                    $decoded = json_decode($result, true);
                    $waResponse = $decoded;
                    if (!empty($decoded['success']) && empty($decoded['waError'])) {
                        $waSuccess = true;
                        break;
                    }
                }
            }

            // Catat log debug untuk analisis pasti
            $logLine = date('[Y-m-d H:i:s] ') . "Login: " . $foundMember['name'] . " (" . $formattedPhone . ") | HTTP: $lastCode | Err: $lastErr | WaSent: " . ($waSuccess ? 'YES' : 'NO') . " | Resp: " . json_encode($waResponse) . "\n";
            file_put_contents(__DIR__ . '/bot_debug.log', $logLine, FILE_APPEND);

            if (!empty($jsonData) || (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false)) {
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode([
                    'success'    => true,
                    'message'    => 'Login member berhasil!',
                    'member'     => $foundMember,
                    'phone'      => $formattedPhone,
                    'waSent'     => $waSuccess,
                    'waDetail'   => $waResponse
                ]);
                exit;
            }

            // Set cookie yang tadinya error (86400 * 30 = 30 hari)
            setcookie('km_member_name', $foundMember['name'], time() + (86400 * 30), '/');
            setcookie('km_member_phone', $formattedPhone, time() + (86400 * 30), '/');

            header('Location: index.html?login=success&member=' . urlencode($foundMember['name']));
            exit;
        }
    }
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login Member — Kopi Mahasiswa</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #15100c;
      --card-bg: #221a14;
      --card-border: #3b2c21;
      --accent: #d4a373;
      --accent-hover: #b88656;
      --text: #fdf8f5;
      --text-muted: #a39589;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .login-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 24px;
      padding: 40px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.4);
    }
    .brand-header {
      text-align: center;
      margin-bottom: 28px;
    }
    .brand-icon {
      font-size: 40px;
      margin-bottom: 8px;
    }
    .brand-title {
      font-family: 'Playfair Display', serif;
      font-size: 24px;
      color: var(--accent);
      margin-bottom: 4px;
    }
    .brand-subtitle {
      font-size: 13px;
      color: var(--text-muted);
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--text-muted);
    }
    input {
      width: 100%;
      padding: 14px 16px;
      border-radius: 12px;
      background: #19120e;
      border: 1px solid var(--card-border);
      color: var(--text);
      font-size: 15px;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus {
      border-color: var(--accent);
    }
    .btn-submit {
      width: 100%;
      padding: 14px;
      border-radius: 12px;
      background: var(--accent);
      color: #120d09;
      font-weight: 700;
      font-size: 15px;
      border: none;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }
    .btn-submit:hover {
      background: var(--accent-hover);
    }
    .btn-submit:active {
      transform: scale(0.99);
    }
    .alert-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 13px;
      margin-bottom: 20px;
    }
    .info-box {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid var(--card-border);
      text-align: center;
      font-size: 13px;
      color: var(--text-muted);
    }
    .info-box a {
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
    }
    .info-box a:hover {
      text-decoration: underline;
    }
    .wa-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #10b981;
      background: rgba(16, 185, 129, 0.12);
      padding: 6px 12px;
      border-radius: 20px;
      margin-top: 12px;
    }
  </style>
</head>
<body>

  <div class="login-card">
    <div class="brand-header">
      <div class="brand-icon">☕</div>
      <h1 class="brand-title">KOPI MAHASISWA</h1>
      <p class="brand-subtitle">Login Akun Member & Dapatkan Diskon 10%</p>
    </div>

    <?php if (!empty($error)): ?>
      <div class="alert-error">
        ⚠️ <?= htmlspecialchars($error) ?>
      </div>
    <?php endif; ?>

    <form method="POST" action="login.php">
      <div class="form-group">
        <label for="phone">Nomor WhatsApp Terdaftar</label>
        <input 
          type="tel" 
          id="phone" 
          name="phone" 
          placeholder="Contoh: 083156957399" 
          required 
          autocomplete="tel"
          value="<?= isset($_POST['phone']) ? htmlspecialchars($_POST['phone']) : '' ?>"
        >
      </div>

      <button type="submit" class="btn-submit">Masuk & Kirim Notifikasi WA</button>
    </form>

    <div class="info-box">
      <p>Belum punya akun member? <a href="index.html#beranda">Daftar di Web</a></p>
      <div class="wa-badge">
        <span>📲</span> Notifikasi login otomatis dikirim via WhatsApp
      </div>
    </div>
  </div>

</body>
</html>