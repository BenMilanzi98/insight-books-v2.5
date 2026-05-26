<?php
declare(strict_types=1);

define('BASE_PATH', __DIR__);

require_once BASE_PATH . '/config/env.php';

$configApp = require BASE_PATH . '/config/app.php';
$configDb = require BASE_PATH . '/config/database.php';

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }
    $relative = substr($class, strlen($prefix));
    $file = BASE_PATH . '/app/' . str_replace('\\', '/', $relative) . '.php';
    if (is_file($file)) {
        require_once $file;
    }
});

date_default_timezone_set($configApp['timezone'] ?? 'UTC');

if (!empty($configApp['debug'])) {
    error_reporting(E_ALL);
    ini_set('display_errors', '0');
} else {
    error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED);
    ini_set('display_errors', '0');
}
ini_set('log_errors', '1');
$logDir = BASE_PATH . '/storage/logs';
if (!is_dir($logDir)) {
    @mkdir($logDir, 0755, true);
}
ini_set('error_log', $logDir . '/php-errors.log');

require_once BASE_PATH . '/app/Helpers/Database.php';
require_once BASE_PATH . '/app/Helpers/Security.php';
require_once BASE_PATH . '/app/Helpers/Response.php';
require_once BASE_PATH . '/app/Helpers/Validator.php';
require_once BASE_PATH . '/app/Helpers/Upload.php';
require_once BASE_PATH . '/includes/functions.php';
require_once BASE_PATH . '/includes/csrf.php';
require_once BASE_PATH . '/includes/auth.php';

App\Helpers\Database::init($configDb);
App\Helpers\Security::init($configApp);

if (session_status() === PHP_SESSION_NONE) {
    session_name($configApp['session_name'] ?? 'ib_apk_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => !empty($configApp['force_https']),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}
