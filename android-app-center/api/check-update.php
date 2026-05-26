<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use App\Helpers\Response;
use App\Helpers\Security;
use App\Services\UpdateCheckService;

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$max = (int) app_config('rate_limit_update_check', 120);
if (!rate_limit_check('update_check', $max, (int) app_config('rate_limit_window_seconds', 3600))) {
    Response::json(['success' => false, 'error' => 'Rate limit exceeded'], 429);
}

$input = $_SERVER['REQUEST_METHOD'] === 'POST'
    ? (json_decode(file_get_contents('php://input'), true) ?: $_POST)
    : $_GET;

$result = UpdateCheckService::check($input);
Response::json($result);
