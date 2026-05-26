<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use App\Helpers\Database;
use App\Services\AnalyticsService;

$pdo = Database::pdo();
$id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

if ($id > 0) {
    $stmt = $pdo->prepare('SELECT * FROM apk_versions WHERE id = ? AND status = \'active\' LIMIT 1');
    $stmt->execute([$id]);
} else {
    $stmt = $pdo->query('SELECT * FROM apk_versions WHERE is_latest = 1 AND status = \'active\' LIMIT 1');
}
$apk = $stmt->fetch();

$settings = $pdo->query('SELECT website_download_locked FROM app_settings WHERE id = 1')->fetch() ?: [];
if (!empty($settings['website_download_locked'])) {
    http_response_code(403);
    echo 'Downloads are temporarily disabled.';
    AnalyticsService::logDownload($apk['id'] ?? null, false);
    exit;
}

$apkDir = realpath(upload_path('apks'));
$storedPath = $apk ? realpath((string) $apk['file_path']) : false;
$filenamePath = $apk && !empty($apk['file_name'])
    ? realpath(upload_path('apks') . DIRECTORY_SEPARATOR . $apk['file_name'])
    : false;
$apkPath = $storedPath ?: $filenamePath;

if (
    !$apk ||
    !$apkDir ||
    !$apkPath ||
    strncmp($apkPath, $apkDir . DIRECTORY_SEPARATOR, strlen($apkDir . DIRECTORY_SEPARATOR)) !== 0 ||
    !is_file($apkPath)
) {
    http_response_code(404);
    echo 'APK not found.';
    AnalyticsService::logDownload($id ?: null, false);
    exit;
}

AnalyticsService::logDownload((int) $apk['id'], true);

$filename = 'InsightBooks-' . preg_replace('/[^a-zA-Z0-9._-]/', '', $apk['version_name']) . '.apk';
header('Content-Type: application/vnd.android.package-archive');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . filesize($apkPath));
header('Cache-Control: no-store');
readfile($apkPath);
exit;
