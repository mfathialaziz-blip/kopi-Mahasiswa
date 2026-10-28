<?php
header('Content-Type: text/html; charset=utf-8');

$targets = [
    'http://127.0.0.1:3000/api/status',
    'http://127.0.0.1:3000/api/bot-status',
    'http://localhost:3000/api/status'
];

echo "<h2>Pengecekan Status Bot WhatsApp Kopi Mahasiswa</h2>";

foreach ($targets as $url) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 3);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 2);
    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    $statusColor = ($code === 200) ? 'green' : 'red';
    echo "<p><strong>$url</strong> => <span style='color:$statusColor; font-weight:bold;'>HTTP $code</span> | ERR: $err | RESP: <code>" . htmlspecialchars($resp) . "</code></p>";
}

echo "<hr><p>Jika HTTP 200 berwarna HIJAU, bot Node.js aktif dan siap mengirim pesan WhatsApp!</p>";

