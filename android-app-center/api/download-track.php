<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use App\Helpers\Response;
use App\Helpers\Security;
use App\Services\AnalyticsService;

if (!Security::validateApiKey($_SERVER['HTTP_X_API_KEY'] ?? null)) {
    Response::json(['success' => false, 'error' => 'Unauthorized'], 401);
}

$apkId = isset($_GET['apk_version_id']) ? (int) $_GET['apk_version_id'] : null;
AnalyticsService::logDownload($apkId, true);
Response::json(['success' => true]);
