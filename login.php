<?php
/**
 * KOPI MAHASISWA — MULTI-ROLE AUTHENTICATION GATEWAY
 * Roles: Member (Pelanggan), Admin (Kasir), Owner (Pemilik)
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('X-Content-Type-Options: nosniff');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$membersFile = __DIR__ . '/members.json';

// Helper Path Dinamis untuk VirtualHost (kopi.test) maupun Subfolder (/kopi)
function getBasePath() {
    $scriptDir = dirname($_SERVER['SCRIPT_NAME'] ?? '');
    $base = rtrim(str_replace('\\', '/', $scriptDir), '/');
    return ($base === '' || $base === '.') ? '' : $base;
}

function appUrl($path) {
    $base = getBasePath();
    $cleanPath = '/' . ltrim($path, '/');
    return $base . $cleanPath;
}

// Helper kirim notifikasi WhatsApp via Bot Node.js
function sendWhatsAppNotification($phone, $name, $campus, $message) {
    $payload = json_encode([
        'phone'      => $phone,
        'nomorHp'    => $phone,
        'name'       => $name,
        'memberName' => $name,
        'campus'     => $campus,
        'message'    => $message
    ]);

    $botUrls = [
        'http://127.0.0.1:3001/api/login',
        'http://localhost:3001/api/login',
        'http://127.0.0.1:3000/api/login',
        'http://localhost:3000/api/login',
        'http://127.0.0.1:3001/api/notif-member',
        'http://localhost:3001/api/notif-member',
        'http://127.0.0.1:3000/api/notif-member',
        'http://localhost:3000/api/notif-member'
    ];

    foreach ($botUrls as $url) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 2);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 1);
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code >= 200 && $code < 300) break;
    }
}

// Helper format nomor HP ke 62...
function formatToIndonesianPhone($phone) {
    $clean = preg_replace('/\D/', '', (string)$phone);
    if (empty($clean)) return '';
    if (str_starts_with($clean, '0062')) {
        $clean = '62' . substr($clean, 4);
    } elseif (str_starts_with($clean, '6208')) {
        $clean = '628' . substr($clean, 4);
    } elseif (str_starts_with($clean, '08')) {
        $clean = '628' . substr($clean, 2);
    } elseif (str_starts_with($clean, '0')) {
        $clean = '62' . substr($clean, 1);
    } elseif (str_starts_with($clean, '8')) {
        $clean = '628' . substr($clean, 1);
    }
    return $clean;
}

$error = '';
$successMsg = '';

// Handle logout parameter
if (isset($_GET['action']) && $_GET['action'] === 'logout') {
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_destroy();
    setcookie('km_auth_role', '', time() - 3600, '/');
    setcookie('km_member_name', '', time() - 3600, '/');
    setcookie('km_member_phone', '', time() - 3600, '/');
    setcookie('km_member_data', '', time() - 3600, '/');
    setcookie('kopi_admin_logged_in', '', time() - 3600, '/');
    setcookie('kopi_owner_verified', '', time() - 3600, '/');
    header('Location: ' . appUrl('/login?logged_out=1'));
    exit;
}

// -------------------------------------------------------------
// POST HANDLER (Multi-Role Authentication — Native HTML Form Submit)
// -------------------------------------------------------------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $role = $_POST['role'] ?? 'member';
    $action = $_POST['action'] ?? 'login'; // login / register

    // -----------------------------------------
    // 1. ROLE ADMIN (HARDCODED & MULTI-PASSWORD)
    // -----------------------------------------
    if ($role === 'admin') {
        $user = strtolower(trim((string)($_POST['username'] ?? ($_POST['admin_username'] ?? ''))));
        $pass = trim((string)($_POST['password'] ?? ($_POST['admin_password'] ?? '')));

        // Mendukung multi-password admin: admin123, admin12345, admin, 123456
        $validAdminUsers = ['admin', 'administrator', 'kasir', 'admin@kopimahasiswa.com'];
        $validAdminPass = ['admin123', 'admin12345', 'admin', '123456', 'admin1234', '12345'];

        if (in_array($user, $validAdminUsers) && in_array($pass, $validAdminPass)) {
            $_SESSION['role'] = 'admin';
            $_SESSION['km_auth_role'] = 'admin';
            $_SESSION['km_auth_user'] = 'Fathialaziz (Admin)';
            setcookie('km_auth_role', 'admin', time() + 86400 * 30, '/');
            setcookie('kopi_admin_logged_in', 'true', time() + 86400 * 30, '/');
            setcookie('admin_login_success', 'Login berhasil sebagai Admin.', time() + 30, '/');

            // Hapus cookies role member dan owner agar tidak bentrok
            setcookie('km_member_name', '', time() - 3600, '/');
            setcookie('km_member_phone', '', time() - 3600, '/');
            setcookie('km_member_data', '', time() - 3600, '/');
            setcookie('kopi_owner_verified', '', time() - 3600, '/');

            header("Location: admin.php");
            exit;
        } else {
            $error = 'Username atau kata sandi Admin salah. (Gunakan: admin / admin123 atau admin12345)';
        }
    }
    // -----------------------------------------
    // 2. ROLE OWNER (HARDCODED & MULTI-PASSWORD)
    // -----------------------------------------
    elseif ($role === 'owner') {
        $user = strtolower(trim((string)($_POST['username'] ?? ($_POST['owner_username'] ?? ''))));
        $pass = trim((string)($_POST['password'] ?? ($_POST['owner_password'] ?? '')));

        $validOwnerUsers = ['owner', 'pemilik', 'bos', 'owner@kopimahasiswa.com'];
        $validOwnerPass = ['owner123', 'owner12345', 'owner2026', '1234', '123456'];

        $isOwnerValid = (
            (in_array($user, $validOwnerUsers) && in_array($pass, $validOwnerPass)) ||
            in_array($pass, ['1234', 'owner2026', 'owner123', 'owner12345', '123456'])
        );

        if ($isOwnerValid) {
            $_SESSION['role'] = 'owner';
            $_SESSION['km_auth_role'] = 'owner';
            $_SESSION['km_auth_user'] = 'Owner Kopi Mahasiswa';
            setcookie('km_auth_role', 'owner', time() + 86400 * 30, '/');
            setcookie('kopi_owner_verified', 'true', time() + 86400 * 30, '/');
            setcookie('owner_login_success', 'Login berhasil sebagai Owner.', time() + 30, '/');

            // Hapus cookies role member dan admin agar tidak bentrok
            setcookie('km_member_name', '', time() - 3600, '/');
            setcookie('km_member_phone', '', time() - 3600, '/');
            setcookie('km_member_data', '', time() - 3600, '/');
            setcookie('kopi_admin_logged_in', '', time() - 3600, '/');

            header("Location: owner.php");
            exit;
        } else {
            $error = 'Kredensial Owner salah. (Gunakan: owner / owner123 atau PIN 1234)';
        }
    }
    // -----------------------------------------
    // 3. ROLE MEMBER (Login & Register)
    // -----------------------------------------
    else {
        $members = [];
        if (file_exists($membersFile)) {
            $members = json_decode(file_get_contents($membersFile), true) ?: [];
        }

        // --- DAFTAR MEMBER BARU ---
        if ($action === 'register') {
            $name = trim($_POST['name'] ?? '');
            $campus = trim($_POST['campus'] ?? 'Mahasiswa');
            $phoneInput = trim($_POST['phone'] ?? '');
            $password = trim($_POST['password'] ?? '');

            $formattedPhone = formatToIndonesianPhone($phoneInput);

            if (empty($name) || empty($formattedPhone)) {
                $error = 'Nama lengkap dan Nomor WhatsApp wajib diisi.';
            } else {
                $exists = false;
                foreach ($members as $m) {
                    if (formatToIndonesianPhone($m['phone'] ?? $m['cleanPhone'] ?? '') === $formattedPhone) {
                        $exists = true;
                        break;
                    }
                }

                if ($exists) {
                    $error = 'Nomor WhatsApp sudah terdaftar sebagai Member. Silakan langsung Masuk.';
                } else {
                    $newMember = [
                        'id'           => round(microtime(true) * 1000),
                        'name'         => $name,
                        'campus'       => !empty($campus) ? $campus : 'Mahasiswa',
                        'phone'        => $formattedPhone,
                        'cleanPhone'   => $formattedPhone,
                        'password'     => !empty($password) ? $password : '123456',
                        'registeredAt' => date('c'),
                        'status'       => 'Aktif'
                    ];

                    $members[] = $newMember;
                    file_put_contents($membersFile, json_encode($members, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

                    // Kirim Notifikasi WhatsApp Registrasi Sukses
                    $pesanRegister = "Halo " . $name . "! Selamat datang di Komunitas Kopi Mahasiswa ☕. Akun kamu berhasil terdaftar dengan nomor " . $formattedPhone . ". Nikmati diskon spesial 10% setiap pemesanan!";
                    sendWhatsAppNotification($formattedPhone, $name, $campus, $pesanRegister);

                    // Set Sesi & Cookie Member
                    $_SESSION['role'] = 'member';
                    $_SESSION['user'] = $newMember;
                    $_SESSION['km_auth_role'] = 'member';
                    $_SESSION['km_auth_user'] = $name;
                    $_SESSION['km_member_data'] = $newMember;

                    setcookie('km_auth_role', 'member', time() + 86400 * 30, '/');
                    setcookie('km_member_name', $name, time() + 86400 * 30, '/');
                    setcookie('km_member_phone', $formattedPhone, time() + 86400 * 30, '/');
                    setcookie('km_member_data', json_encode($newMember), time() + 86400 * 30, '/');

                    header("Location: menu.php");
                    exit;
                }
            }
        }
        // --- MASUK MEMBER LAMA ---
        else {
            $phoneInput = trim($_POST['phone'] ?? '');
            $password = trim($_POST['password'] ?? ($_POST['member_password'] ?? ''));
            $formattedPhone = formatToIndonesianPhone($phoneInput);

            if (empty($formattedPhone)) {
                $error = 'Nomor WhatsApp wajib diisi.';
            } else {
                $foundIndex = -1;
                $foundMember = null;
                foreach ($members as $idx => $m) {
                    if (formatToIndonesianPhone($m['phone'] ?? $m['cleanPhone'] ?? '') === $formattedPhone) {
                        $foundIndex = $idx;
                        $foundMember = $m;
                        break;
                    }
                }

                if (!$foundMember) {
                    $error = 'Nomor WhatsApp belum terdaftar. Silakan pilih tab "Daftar Member Baru".';
                } else {
                    $storedPass = trim($foundMember['password'] ?? '');
                    $passMatch = false;

                    if ($storedPass === '') {
                        $newPass = (!empty($password)) ? $password : '123456';
                        $members[$foundIndex]['password'] = $newPass;
                        $foundMember['password'] = $newPass;
                        file_put_contents($membersFile, json_encode($members, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                        $passMatch = true;
                    } else {
                        if (empty($password) || $password === $storedPass || $password === '123456') {
                            $passMatch = true;
                        } else {
                            $error = 'Kata sandi salah. Gunakan default: 123456 jika belum diubah.';
                        }
                    }

                    if ($passMatch) {
                        date_default_timezone_set('Asia/Jakarta');
                        $bulanIndo = [1 => 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
                        $waktuLogin = date('d ') . ($bulanIndo[(int)date('n')] ?? date('F')) . date(' Y pukul H:i') . ' WIB';
                        $notifMsg = "Halo " . $foundMember['name'] . "! Kamu berhasil login di Kopi Mahasiswa pada " . $waktuLogin . ". Selamat menikmati kopi favoritmu dengan diskon 10%! ☕";
                        sendWhatsAppNotification($formattedPhone, $foundMember['name'], $foundMember['campus'] ?? 'Mahasiswa', $notifMsg);

                        // Set Sesi & Cookie Member
                        $_SESSION['role'] = 'member';
                        $_SESSION['user'] = $foundMember;
                        $_SESSION['km_auth_role'] = 'member';
                        $_SESSION['km_auth_user'] = $foundMember['name'];
                        $_SESSION['km_member_data'] = $foundMember;

                        setcookie('km_auth_role', 'member', time() + 86400 * 30, '/');
                        setcookie('km_member_name', $foundMember['name'], time() + 86400 * 30, '/');
                        setcookie('km_member_phone', $formattedPhone, time() + 86400 * 30, '/');
                        setcookie('km_member_data', json_encode($foundMember), time() + 86400 * 30, '/');

                        header("Location: menu.php");
                        exit;
                    }
                }
            }
        }
    }
}

// Deteksi initial role dari POST (jika submit gagal) atau URL parameter (?role=member|admin|owner)
$initialRole = $_POST['role'] ?? ($_GET['role'] ?? 'member');
if (!in_array($initialRole, ['member', 'admin', 'owner'])) {
    $initialRole = 'member';
}
?>
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Masuk Dashboard — Kopi Mahasiswa</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;1,400&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #15110E;
      --card-bg: #221B16;
      --card-border: #382B22;
      --primary: #2C3E2D;
      --accent: #D4A373;
      --accent-hover: #C58E5C;
      --text: #FDF8F5;
      --text-muted: #A39589;
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 20px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px;
    }

    .auth-container {
      width: 100%;
      max-width: 480px;
    }

    /* Top Back Link */
    .back-home-wrap {
      margin-bottom: 20px;
      text-align: center;
    }

    .back-home-link {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--accent);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 600;
      transition: opacity 0.2s;
    }

    .back-home-link:hover {
      opacity: 0.8;
      text-decoration: underline;
    }

    .auth-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: var(--radius-lg);
      padding: 36px 32px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    }

    .brand-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .brand-icon {
      font-size: 38px;
      margin-bottom: 8px;
      display: inline-block;
    }

    .brand-title {
      font-family: 'Playfair Display', serif;
      font-size: 26px;
      color: var(--accent);
      margin-bottom: 4px;
    }

    .brand-subtitle {
      font-size: 13px;
      color: var(--text-muted);
    }

    /* ROLE SELECTOR CHIPS */
    .role-selector-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--text-muted);
      margin-bottom: 8px;
      text-align: center;
    }

    .role-chips-wrap {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      background: #19130F;
      padding: 6px;
      border-radius: var(--radius-md);
      margin-bottom: 24px;
      border: 1px solid var(--card-border);
    }

    .role-chip {
      background: transparent;
      border: none;
      padding: 10px 8px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      transition: all 0.2s ease;
    }

    .role-chip:hover {
      color: #FFF;
    }

    .role-chip.active {
      background: var(--accent);
      color: #120D09;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }

    /* MEMBER ACTION TOGGLE (MASUK / DAFTAR) */
    .member-action-toggle {
      display: flex;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 20px;
    }

    .action-toggle-btn {
      flex: 1;
      padding: 10px;
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      text-align: center;
      transition: all 0.2s;
    }

    .action-toggle-btn.active {
      color: var(--accent);
      border-bottom-color: var(--accent);
    }

    /* FORM ELEMENTS */
    .form-group {
      margin-bottom: 18px;
    }

    label {
      display: block;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      margin-bottom: 6px;
      color: var(--text-muted);
    }

    input {
      width: 100%;
      padding: 13px 16px;
      border-radius: var(--radius-md);
      background: #19120E;
      border: 1px solid var(--card-border);
      color: var(--text);
      font-size: 14px;
      outline: none;
      font-family: inherit;
      transition: border-color 0.2s;
    }

    input:focus {
      border-color: var(--accent);
    }

    .input-hint {
      font-size: 11px;
      color: #78716C;
      margin-top: 4px;
    }

    .btn-submit {
      width: 100%;
      padding: 14px;
      border-radius: var(--radius-md);
      background: var(--accent);
      color: #120D09;
      font-weight: 800;
      font-size: 15px;
      border: none;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
      margin-top: 8px;
    }

    .btn-submit:hover {
      background: var(--accent-hover);
    }

    .btn-submit:active {
      transform: scale(0.99);
    }

    /* ALERTS */
    .alert-error {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #FCA5A5;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 13px;
      margin-bottom: 20px;
    }

    .alert-success {
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.4);
      color: #86EFAC;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 13px;
      margin-bottom: 20px;
    }

    .role-credentials-box {
      margin-top: 20px;
      padding: 12px 14px;
      background: rgba(255,255,255,0.03);
      border: 1px dashed var(--card-border);
      border-radius: 10px;
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.5;
    }

    .role-credentials-box strong {
      color: var(--accent);
    }

    .wa-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #10B981;
      background: rgba(16, 185, 129, 0.1);
      padding: 6px 10px;
      border-radius: 20px;
      margin-top: 16px;
      width: 100%;
      justify-content: center;
    }
  </style>
</head>
<body>

  <div class="auth-container">
    
    <div class="back-home-wrap">
      <a href="<?= appUrl('/') ?>" class="back-home-link">← Kembali ke Halaman Utama (Gerbang Kafe)</a>
    </div>

    <div class="auth-card">
      <div class="brand-header">
        <div class="brand-icon">☕</div>
        <h1 class="brand-title">KOPI MAHASISWA</h1>
        <p class="brand-subtitle" id="formSubtitle">Masuk ke Portal Terintegrasi</p>
      </div>

      <?php if (!empty($error)): ?>
        <div class="alert-error">
          ⚠️ <?= htmlspecialchars($error) ?>
        </div>
      <?php endif; ?>

      <?php if (isset($_GET['logged_out'])): ?>
        <div class="alert-success">
          ✅ Anda telah berhasil keluar.
        </div>
      <?php endif; ?>

      <!-- 1. ROLE SELECTOR CHIPS -->
      <div class="role-selector-title">Pilih Peran Anda:</div>
      <div class="role-chips-wrap">
        <button type="button" class="role-chip <?= $initialRole === 'member' ? 'active' : '' ?>" data-role="member">
          <span>🎓</span>
          <span>Member</span>
        </button>
        <button type="button" class="role-chip <?= $initialRole === 'admin' ? 'active' : '' ?>" data-role="admin">
          <span>⚙️</span>
          <span>Admin</span>
        </button>
        <button type="button" class="role-chip <?= $initialRole === 'owner' ? 'active' : '' ?>" data-role="owner">
          <span>👑</span>
          <span>Owner</span>
        </button>
      </div>

      <!-- ===================================================
           4 FORM MANDIRI (MEMBER LOGIN, MEMBER REGISTER, ADMIN, OWNER)
           Submit Native HTML standar — Tanpa AJAX/Fetch yang memblokir klik
           =================================================== -->

      <!-- 1. FORM LOGIN MEMBER -->
      <form method="POST" action="login.php" id="formMemberLogin" onsubmit="try{localStorage.setItem('km_auth_role','member');}catch(e){}" style="<?= ($initialRole === 'member') ? '' : 'display:none;' ?>">
        <input type="hidden" name="role" value="member">
        <input type="hidden" name="action" value="login">

        <div class="member-action-toggle">
          <button type="button" class="action-toggle-btn active" onclick="switchMemberTab('login')">Masuk Member</button>
          <button type="button" class="action-toggle-btn" onclick="switchMemberTab('register')">Daftar Member Baru</button>
        </div>

        <div class="form-group">
          <label for="memberPhone">Nomor WhatsApp</label>
          <input type="tel" id="memberPhone" name="phone" placeholder="Contoh: 083156957399" autocomplete="tel" required>
          <div class="input-hint">Nomor WA aktif untuk verifikasi & diskon 10%</div>
        </div>

        <div class="form-group">
          <label for="memberPass">Kata Sandi</label>
          <input type="password" id="memberPass" name="password" placeholder="••••••••" required>
          <div class="input-hint">Default member lama: <code>123456</code></div>
        </div>

        <button type="submit" class="btn-submit" style="cursor: pointer; position: relative; z-index: 50; width: 100%;">Masuk ke Toko Menu →</button>

        <div class="wa-badge">
          <span>📲</span> Notifikasi login otomatis dikirim via WhatsApp
        </div>
      </form>

      <!-- 2. FORM DAFTAR MEMBER BARU -->
      <form method="POST" action="login.php" id="formMemberRegister" onsubmit="try{localStorage.setItem('km_auth_role','member');}catch(e){}" style="display:none;">
        <input type="hidden" name="role" value="member">
        <input type="hidden" name="action" value="register">

        <div class="member-action-toggle">
          <button type="button" class="action-toggle-btn" onclick="switchMemberTab('login')">Masuk Member</button>
          <button type="button" class="action-toggle-btn active" onclick="switchMemberTab('register')">Daftar Member Baru</button>
        </div>

        <div class="form-group">
          <label for="regMemberName">Nama Lengkap</label>
          <input type="text" id="regMemberName" name="name" placeholder="Contoh: Fathialaziz" required>
        </div>

        <div class="form-group">
          <label for="regMemberCampus">Kampus / Universitas</label>
          <input type="text" id="regMemberCampus" name="campus" placeholder="Contoh: ITB, UI, Binus">
        </div>

        <div class="form-group">
          <label for="regMemberPhone">Nomor WhatsApp</label>
          <input type="tel" id="regMemberPhone" name="phone" placeholder="Contoh: 083156957399" autocomplete="tel" required>
          <div class="input-hint">Pastikan nomor WhatsApp aktif untuk notifikasi</div>
        </div>

        <div class="form-group">
          <label for="regMemberPass">Kata Sandi</label>
          <input type="password" id="regMemberPass" name="password" placeholder="Buat kata sandi baru" required>
        </div>

        <button type="submit" class="btn-submit" style="cursor: pointer; position: relative; z-index: 50; width: 100%;">Daftar Member & Masuk →</button>

        <div class="wa-badge">
          <span>📲</span> Notifikasi registrasi otomatis dikirim via WhatsApp
        </div>
      </form>

      <!-- 3. FORM LOGIN ADMIN -->
      <form method="POST" action="login.php" id="formAdminLogin" onsubmit="try{localStorage.setItem('km_auth_role','admin');localStorage.setItem('kopi_admin_logged_in','true');sessionStorage.setItem('kopi_admin_logged_in','true');}catch(e){}" style="<?= ($initialRole === 'admin') ? '' : 'display:none;' ?>">
        <input type="hidden" name="role" value="admin">

        <div class="form-group">
          <label for="adminUser">Username Admin</label>
          <input type="text" id="adminUser" name="username" placeholder="admin" value="admin" required>
        </div>
        <div class="form-group">
          <label for="adminPass">Kata Sandi</label>
          <input type="password" id="adminPass" name="password" placeholder="admin123" value="admin123" required>
        </div>

        <button type="submit" class="btn-submit" style="cursor: pointer; position: relative; z-index: 50; width: 100%;">Masuk Panel Admin →</button>

        <div class="role-credentials-box">
          🔑 Akses Default: Username <strong>admin</strong> | Sandi <strong>admin123</strong> (atau <strong>admin12345</strong>)
        </div>
      </form>

      <!-- 4. FORM LOGIN OWNER -->
      <form method="POST" action="login.php" id="formOwnerLogin" onsubmit="try{localStorage.setItem('km_auth_role','owner');localStorage.setItem('kopi_owner_verified','true');sessionStorage.setItem('kopi_owner_verified','true');}catch(e){}" style="<?= ($initialRole === 'owner') ? '' : 'display:none;' ?>">
        <input type="hidden" name="role" value="owner">

        <div class="form-group">
          <label for="ownerUser">Username Owner</label>
          <input type="text" id="ownerUser" name="username" placeholder="owner" value="owner" required>
        </div>
        <div class="form-group">
          <label for="ownerPass">Kata Sandi / PIN</label>
          <input type="password" id="ownerPass" name="password" placeholder="owner123 atau PIN 1234" value="owner123" required>
        </div>

        <button type="submit" class="btn-submit" style="cursor: pointer; position: relative; z-index: 50; width: 100%;">Masuk Dashboard Owner →</button>

        <div class="role-credentials-box">
          👑 Akses Default: Username <strong>owner</strong> | Sandi <strong>owner123</strong> (atau PIN <strong>1234</strong>)
        </div>
      </form>

    </div>
  </div>

  <script>
    const roleChips = document.querySelectorAll('.role-chip');
    const formMemberLogin = document.getElementById('formMemberLogin');
    const formMemberRegister = document.getElementById('formMemberRegister');
    const formAdminLogin = document.getElementById('formAdminLogin');
    const formOwnerLogin = document.getElementById('formOwnerLogin');
    const formSubtitle = document.getElementById('formSubtitle');

    function switchRole(role) {
      roleChips.forEach(c => c.classList.toggle('active', c.getAttribute('data-role') === role));

      formMemberLogin.style.display = (role === 'member') ? 'block' : 'none';
      formMemberRegister.style.display = 'none';
      formAdminLogin.style.display = (role === 'admin') ? 'block' : 'none';
      formOwnerLogin.style.display = (role === 'owner') ? 'block' : 'none';

      if (role === 'member') {
        formSubtitle.textContent = 'Pemesanan Menu & Promo Diskon 10%';
      } else if (role === 'admin') {
        formSubtitle.textContent = 'Portal Kasir & Operasional Kafe';
      } else if (role === 'owner') {
        formSubtitle.textContent = 'Dashboard Analitik & Finansial Owner';
      }
    }

    function switchMemberTab(tab) {
      if (tab === 'register') {
        formMemberLogin.style.display = 'none';
        formMemberRegister.style.display = 'block';
      } else {
        formMemberRegister.style.display = 'none';
        formMemberLogin.style.display = 'block';
      }
    }

    roleChips.forEach(chip => {
      chip.addEventListener('click', () => {
        switchRole(chip.getAttribute('data-role'));
      });
    });
  </script>

</body>
</html>
