<?php
declare(strict_types=1);

namespace App\Services;

use App\Helpers\Database;
use App\Helpers\Security;
use PDO;
use Throwable;

class SyncService
{
    public static function pushToMainSystem(?int $adminId = null): array
    {
        $pdo = Database::pdo();
        $settings = $pdo->query('SELECT * FROM app_settings WHERE id = 1 LIMIT 1')->fetch() ?: [];
        $latest = $pdo->query('SELECT * FROM apk_versions WHERE is_latest = 1 AND status = \'active\' LIMIT 1')->fetch();

        $payload = [
            'timestamp' => time(),
            'app_status' => self::deriveAppStatus($settings, $latest),
            'latest_version_name' => $latest['version_name'] ?? '1.0.0',
            'latest_version_code' => (int) ($latest['version_code'] ?? 1),
            'apk_download_url' => $latest && empty($settings['website_download_locked'])
                ? rtrim((string) app_config('app_url'), '/') . '/download.php?id=' . (int) $latest['id']
                : '',
            'release_notes' => $latest['release_notes'] ?? null,
            'whats_new' => $latest['whats_new'] ?? null,
            'mandatory_update' => !empty($latest['mandatory_update']),
            'force_lock' => !empty($latest['mandatory_update']) || !empty($settings['global_app_lock']) || !empty($settings['security_lock']),
            'maintenance_lock' => !empty($settings['maintenance_mode']),
            'maintenance_message' => $settings['maintenance_message'] ?? null,
            'lock_message' => $settings['global_lock_message'] ?? null,
            'website_download_locked' => !empty($settings['website_download_locked']),
            'broadcast_message' => $settings['emergency_notice'] ?? $settings['global_lock_message'] ?? $settings['update_prompt_message'] ?? null,
            'published_at' => $latest['published_at'] ?? null,
        ];

        $signature = Security::signPayload($payload, app_config('main_system_shared_secret'));
        $url = app_config('main_system_sync_url');
        $apiKey = app_config('main_system_api_key');

        $body = json_encode([
            'payload' => $payload,
            'signature' => $signature,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

        if (!function_exists('curl_init')) {
            return self::recordAndReturn(
                $pdo,
                $url,
                $payload,
                null,
                null,
                false,
                'PHP cURL extension is not enabled.',
                $adminId,
            );
        }

        $ch = curl_init($url);
        if ($ch === false) {
            return self::recordAndReturn(
                $pdo,
                $url,
                $payload,
                null,
                null,
                false,
                'Unable to initialize cURL for sync request.',
                $adminId,
            );
        }

        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'X-API-Key: ' . $apiKey,
                'X-Signature: ' . $signature,
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        $success = $httpCode >= 200 && $httpCode < 300 && $error === '';

        return self::recordAndReturn(
            $pdo,
            $url,
            $payload,
            $httpCode ?: null,
            $response !== false ? substr((string) $response, 0, 5000) : null,
            $success,
            $error ?: ($success ? null : 'Sync failed with HTTP ' . $httpCode),
            $adminId,
        );
    }

    private static function recordAndReturn(
        PDO $pdo,
        string $url,
        array $payload,
        ?int $httpCode,
        $response,
        bool $success,
        ?string $error,
        ?int $adminId
    ): array {
        try {
            $pdo->prepare(
                'INSERT INTO api_sync_logs (direction, endpoint, payload, response_code, response_body, success, error_message, created_at)
                 VALUES (\'outbound\', ?, ?, ?, ?, ?, ?, NOW())'
            )->execute([
                $url,
                json_encode($payload),
                $httpCode,
                $response !== null && $response !== false ? substr((string) $response, 0, 5000) : null,
                $success ? 1 : 0,
                $error,
            ]);
        } catch (Throwable $e) {
            error_log('Unable to write sync log: ' . $e->getMessage());
        }

        if ($adminId) {
            try {
                audit_log($adminId, $success ? 'sync_success' : 'sync_failed', 'main_system', null, ['http' => $httpCode]);
            } catch (Throwable $e) {
                error_log('Unable to write sync audit log: ' . $e->getMessage());
            }
        }

        return [
            'success' => $success,
            'http_code' => $httpCode ?? 0,
            'response' => $response,
            'error' => $error,
        ];
    }

    private static function deriveAppStatus(array $settings, ?array $latest): string
    {
        if (!empty($settings['maintenance_mode'])) {
            return 'maintenance';
        }
        if (!empty($settings['security_lock'])) {
            return 'locked';
        }
        if (!empty($settings['global_app_lock'])) {
            return 'locked';
        }
        if (!$latest) {
            return 'disabled';
        }
        if ($latest['status'] === 'deprecated') {
            return 'deprecated';
        }
        return 'active';
    }
}
