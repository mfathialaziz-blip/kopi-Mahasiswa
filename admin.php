<?php
/**
 * KOPI MAHASISWA — ADMIN PORTAL ALIAS
 * Menyediakan akses langsung ke Dashboard Admin
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Cek apakah user sudah login sebagai Admin di sesi PHP atau cookie
$role = $_SESSION['role'] ?? ($_SESSION['km_auth_role'] ?? ($_COOKIE['km_auth_role'] ?? ''));
if ($role !== 'admin') {
    // Jika belum login admin, arahkan ke login admin
    header('Location: login.php?role=admin');
    exit;
}

// Sinkronkan cookie otorisasi admin
setcookie('km_auth_role', 'admin', time() + 86400 * 30, '/');
setcookie('kopi_admin_logged_in', 'true', time() + 86400 * 30, '/');
header('X-Frame-Options: SAMEORIGIN');
?>
<script>
  window.SERVER_AUTH_ROLE = 'admin';
  try {
    localStorage.setItem('km_auth_role', 'admin');
    localStorage.setItem('kopi_admin_logged_in', 'true');
    sessionStorage.setItem('kopi_admin_logged_in', 'true');
    localStorage.removeItem('kopi_member');
    localStorage.removeItem('km_member_name');
  } catch(e) {}
</script>
<?php
include_once __DIR__ . '/admin.html';
exit;
