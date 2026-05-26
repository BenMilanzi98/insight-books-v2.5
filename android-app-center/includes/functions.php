<?php
declare(strict_types=1);

use App\Helpers\Database;
use App\Helpers\Security;

function app_config(string $key, $default = null)
{
    static $cfg;
    if ($cfg === null) {
        $cfg = require BASE_PATH . '/config/app.php';
    }
    return $cfg[$key] ?? $default;
}

function base_url(string $path = ''): string
{
    $base = rtrim(app_config('app_url', ''), '/');
    return $base . ($path ? '/' . ltrim($path, '/') : '');
}

function public_asset(string $path): string
{
    return base_url('assets/' . ltrim($path, '/'));
}

function upload_path(string $subdir): string
{
    return BASE_PATH . '/public/uploads/' . trim($subdir, '/');
}

function format_bytes(int $bytes): string
{
    if ($bytes >= 1073741824) {
        return round($bytes / 1073741824, 2) . ' GB';
    }
    if ($bytes >= 1048576) {
        return round($bytes / 1048576, 2) . ' MB';
    }
    if ($bytes >= 1024) {
        return round($bytes / 1024, 2) . ' KB';
    }
    return $bytes . ' B';
}

function flash_set(string $type, string $message): void
{
    $_SESSION['flash'] = ['type' => $type, 'message' => $message];
}

function flash_get(): ?array
{
    $f = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    return $f;
}

function rate_limit_check(string $key, int $max, int $windowSeconds): bool
{
    $pdo = Database::pdo();
    $ip = Security::clientIp();
    $now = time();
    $windowStart = date('Y-m-d H:i:s', $now - $windowSeconds);

    $stmt = $pdo->prepare('SELECT id, hits FROM rate_limits WHERE limit_key = ? AND ip_address = ? AND window_start >= ? LIMIT 1');
    $stmt->execute([$key, $ip, $windowStart]);
    $row = $stmt->fetch();

    if ($row) {
        if ((int) $row['hits'] >= $max) {
            return false;
        }
        $pdo->prepare('UPDATE rate_limits SET hits = hits + 1, updated_at = NOW() WHERE id = ?')->execute([$row['id']]);
        return true;
    }

    $pdo->prepare('INSERT INTO rate_limits (limit_key, ip_address, hits, window_start, created_at, updated_at) VALUES (?, ?, 1, NOW(), NOW(), NOW())')
        ->execute([$key, $ip]);
    return true;
}

function audit_log(?int $adminId, string $action, ?string $resource = null, $old = null, $new = null): void
{
    $pdo = Database::pdo();
    $pdo->prepare(
        'INSERT INTO audit_logs (admin_id, action, resource, old_value, new_value, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())'
    )->execute([
        $adminId,
        $action,
        $resource,
        $old !== null ? json_encode($old) : null,
        $new !== null ? json_encode($new) : null,
        Security::clientIp(),
    ]);
}

function captcha_question(): array
{
    $a = random_int(2, 12);
    $b = random_int(2, 12);
    $_SESSION['captcha_answer'] = $a + $b;
    return ['question' => "What is {$a} + {$b}?", 'token' => bin2hex(random_bytes(8))];
}

function captcha_verify(?string $answer): bool
{
    $expected = $_SESSION['captcha_answer'] ?? null;
    unset($_SESSION['captcha_answer']);
    return $expected !== null && (int) $answer === (int) $expected;
}
