<?php
declare(strict_types=1);

use App\Helpers\Database;
use App\Helpers\Response;
use App\Helpers\Security;

function admin_logged_in(): bool
{
    return !empty($_SESSION['admin_id']);
}

function require_admin(): void
{
    if (!admin_logged_in()) {
        Response::redirect(base_url('admin/login.php'));
    }
}

function current_admin(): ?array
{
    if (!admin_logged_in()) {
        return null;
    }
    static $admin;
    if ($admin === null) {
        $stmt = Database::pdo()->prepare('SELECT id, name, email, role FROM admins WHERE id = ? AND is_active = 1 LIMIT 1');
        $stmt->execute([$_SESSION['admin_id']]);
        $admin = $stmt->fetch() ?: null;
        if (!$admin) {
            unset($_SESSION['admin_id']);
        }
    }
    return $admin;
}

function admin_login(string $email, string $password): bool
{
    $pdo = Database::pdo();
    $stmt = $pdo->prepare('SELECT * FROM admins WHERE email = ? AND is_active = 1 LIMIT 1');
    $stmt->execute([trim(strtolower($email))]);
    $row = $stmt->fetch();
    if (!$row || !password_verify($password, $row['password_hash'])) {
        $pdo->prepare('INSERT INTO login_logs (admin_id, email, success, ip_address, user_agent, created_at) VALUES (NULL, ?, 0, ?, ?, NOW())')
            ->execute([$email, Security::clientIp(), $_SERVER['HTTP_USER_AGENT'] ?? '']);
        return false;
    }
    $_SESSION['admin_id'] = (int) $row['id'];
    $pdo->prepare('UPDATE admins SET last_login_at = NOW() WHERE id = ?')->execute([$row['id']]);
    $pdo->prepare('INSERT INTO login_logs (admin_id, email, success, ip_address, user_agent, created_at) VALUES (?, ?, 1, ?, ?, NOW())')
        ->execute([$row['id'], $row['email'], Security::clientIp(), $_SERVER['HTTP_USER_AGENT'] ?? '']);
    audit_log((int) $row['id'], 'admin_login', 'admins', null, ['email' => $row['email']]);
    return true;
}

function admin_logout(): void
{
    $id = $_SESSION['admin_id'] ?? null;
    if ($id) {
        audit_log((int) $id, 'admin_logout', 'admins');
    }
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $p = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
    }
    session_destroy();
}
