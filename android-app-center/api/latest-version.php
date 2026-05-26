<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use App\Helpers\Database;
use App\Helpers\Response;

$pdo = Database::pdo();
$latest = $pdo->query(
    'SELECT version_name, version_code, release_notes, whats_new, file_size, min_android_version, published_at, download_count
     FROM apk_versions WHERE is_latest = 1 AND status = \'active\' LIMIT 1'
)->fetch();

if (!$latest) {
    Response::json(['success' => false, 'error' => 'No active version published'], 404);
}

$settings = $pdo->query('SELECT website_download_locked FROM app_settings WHERE id = 1 LIMIT 1')->fetch() ?: [];
$latestId = (int) $pdo->query('SELECT id FROM apk_versions WHERE is_latest = 1 LIMIT 1')->fetchColumn();
$downloadAvailable = empty($settings['website_download_locked']);
$latest['download_url'] = $downloadAvailable
    ? rtrim((string) app_config('app_url'), '/') . '/download.php?id=' . $latestId
    : null;
$latest['website_download_available'] = $downloadAvailable;

Response::json(['success' => true, 'version' => $latest]);
