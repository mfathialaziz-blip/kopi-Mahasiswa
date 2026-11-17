<?php
/**
 * KOPI MAHASISWA — OWNER PORTAL ALIAS
 * Menyediakan akses langsung ke Dashboard Owner
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$role = $_SESSION['role'] ?? ($_SESSION['km_auth_role'] ?? ($_COOKIE['km_auth_role'] ?? ''));
if ($role !== 'owner') {
    header('Location: login.php?role=owner');
    exit;
}

setcookie('km_auth_role', 'owner', time() + 86400 * 30, '/');
setcookie('kopi_owner_verified', 'true', time() + 86400 * 30, '/');
header('X-Frame-Options: SAMEORIGIN');
?>
<script>
  window.SERVER_AUTH_ROLE = 'owner';
  try {
    localStorage.setItem('km_auth_role', 'owner');
    localStorage.setItem('kopi_owner_verified', 'true');
    sessionStorage.setItem('kopi_owner_verified', 'true');
    localStorage.removeItem('kopi_member');
    localStorage.removeItem('km_member_name');
  } catch(e) {}
</script>
<?php
include_once __DIR__ . '/owner.html';
exit;
