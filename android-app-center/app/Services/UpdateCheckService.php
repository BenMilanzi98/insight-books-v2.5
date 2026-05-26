<?php
declare(strict_types=1);

namespace App\Services;

use App\Helpers\Database;

class UpdateCheckService
{
    public static function check(array $input): array
    {
        $pdo = Database::pdo();
        $clientCode = (int) ($input['version_code'] ?? $input['current_version_code'] ?? 0);
        $userId = trim((string) ($input['user_id'] ?? ''));
        $deviceId = trim((string) ($input['device_id'] ?? ''));
        $businessId = trim((string) ($input['business_id'] ?? $input['tenant_id'] ?? ''));

        $settings = $pdo->query('SELECT * FROM app_settings WHERE id = 1 LIMIT 1')->fetch() ?: [];
        $latest = $pdo->query('SELECT * FROM apk_versions WHERE is_latest = 1 AND status = \'active\' LIMIT 1')->fetch();

        if (!$latest) {
            return self::response('ok', $settings, null, $clientCode, true);
        }

        if (self::isRevoked($pdo, $userId, $deviceId, $businessId, $input)) {
            return self::response('revoked', $settings, $latest, $clientCode, true, 'Your access to this app has been revoked. Contact support.');
        }

        if (!empty($settings['maintenance_mode'])) {
            return self::response('maintenance', $settings, $latest, $clientCode, true,
                $settings['maintenance_message'] ?? 'InsightBooks is under maintenance. Please try again later.');
        }

        if (!empty($settings['global_app_lock']) || !empty($settings['security_lock'])) {
            return self::response('locked', $settings, $latest, $clientCode, true,
                $settings['global_lock_message'] ?? 'The app is temporarily locked. Please update to continue.');
        }

        $versionLocked = self::isVersionLocked($pdo, $clientCode);
        if ($versionLocked) {
            return self::response('update_required', $settings, $latest, $clientCode, true,
                $versionLocked['message'] ?? 'This version is no longer supported. Please update.');
        }

        $latestCode = (int) $latest['version_code'];
        if ($clientCode < $latestCode) {
            return self::response('update_required', $settings, $latest, $clientCode, true,
                $settings['update_prompt_message'] ?? 'A new version is available. Please update to continue.');
        }

        return self::response('ok', $settings, $latest, $clientCode, true);
    }

    private static function isRevoked(\PDO $pdo, string $userId, string $deviceId, string $businessId, array $input): bool
    {
        $checks = [];
        if ($userId !== '') {
            $checks[] = ['user_id', $userId];
        }
        if ($deviceId !== '') {
            $checks[] = ['device_id', $deviceId];
        }
        if ($businessId !== '') {
            $checks[] = ['business_id', $businessId];
            $checks[] = ['tenant_id', $businessId];
        }
        $email = trim((string) ($input['email'] ?? ''));
        if ($email !== '') {
            $checks[] = ['email', strtolower($email)];
        }
        $phone = trim((string) ($input['phone'] ?? ''));
        if ($phone !== '') {
            $checks[] = ['phone', $phone];
        }

        foreach ($checks as [$type, $id]) {
            $stmt = $pdo->prepare(
                'SELECT id FROM revoked_access WHERE revoke_type = ? AND identifier = ? AND is_active = 1
                 AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1'
            );
            $stmt->execute([$type, $id]);
            if ($stmt->fetch()) {
                return true;
            }
        }
        return false;
    }

    private static function isVersionLocked(\PDO $pdo, int $clientCode): ?array
    {
        if ($clientCode < 1) {
            return null;
        }
        $stmt = $pdo->prepare(
            'SELECT v.is_locked, v.lock_message, v.mandatory_update FROM apk_versions v
             WHERE v.version_code = ? AND v.status IN (\'active\',\'deprecated\') LIMIT 1'
        );
        $stmt->execute([$clientCode]);
        $row = $stmt->fetch();
        if ($row && !empty($row['is_locked'])) {
            return $row;
        }
        $stmt2 = $pdo->prepare(
            'SELECT al.message FROM app_locks al
             JOIN apk_versions v ON v.id = al.apk_version_id
             WHERE al.lock_type = \'version\' AND al.is_enabled = 1 AND v.version_code = ? LIMIT 1'
        );
        $stmt2->execute([$clientCode]);
        $lock = $stmt2->fetch();
        if ($lock) {
            return ['message' => $lock['message']];
        }
        return null;
    }

    private static function response(
        string $status,
        array $settings,
        ?array $latest,
        int $clientCode,
        bool $allowed,
        ?string $lockReason = null
    ): array {
        $websiteDownloadAvailable = empty($settings['website_download_locked']);
        $downloadUrl = $latest && $websiteDownloadAvailable
            ? (rtrim((string) app_config('app_url'), '/') . '/download.php?id=' . (int) $latest['id'])
            : null;

        $locked = in_array($status, ['locked', 'update_required', 'maintenance', 'revoked'], true);
        $mandatoryUpdate = $status === 'update_required' || ($latest ? (bool) $latest['mandatory_update'] : false);

        return [
            'success' => true,
            'status' => $status,
            'latest_version_name' => $latest['version_name'] ?? null,
            'latest_version_code' => $latest ? (int) $latest['version_code'] : null,
            'current_version_allowed' => $allowed && !$locked,
            'mandatory_update' => $mandatoryUpdate,
            'mustLock' => $locked,
            'app_locked' => $locked,
            'lock_reason' => $lockReason,
            'download_url' => $downloadUrl,
            'website_download_available' => $websiteDownloadAvailable,
            'website_download_locked' => !$websiteDownloadAvailable,
            'release_notes' => $latest['release_notes'] ?? null,
            'whats_new' => $latest['whats_new'] ?? null,
            'maintenance_mode' => !empty($settings['maintenance_mode']),
            'maintenance_message' => $settings['maintenance_message'] ?? null,
            'broadcast_message' => $settings['emergency_notice'] ?? null,
            'client_version_code' => $clientCode,
        ];
    }
}
