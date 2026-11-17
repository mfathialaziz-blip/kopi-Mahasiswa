<?php
/**
 * KOPI MAHASISWA — MENU & ORDER ALIAS
 * Menyediakan akses langsung ke Halaman Menu Member
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$role = $_SESSION['role'] ?? ($_SESSION['km_auth_role'] ?? ($_COOKIE['km_auth_role'] ?? ''));
if ($role !== 'member') {
    header('Location: login.php?role=member');
    exit;
}

setcookie('km_auth_role', 'member', time() + 86400 * 30, '/');
header('X-Frame-Options: SAMEORIGIN');
include_once __DIR__ . '/menu.html';
exit;
