<?php
declare(strict_types=1);

namespace App\Services;

use App\Helpers\Database;

class AnalyticsService
{
    public static function dashboardStats(): array
    {
        $pdo = Database::pdo();
        $latest = $pdo->query('SELECT * FROM apk_versions WHERE is_latest = 1 LIMIT 1')->fetch();
        $settings = $pdo->query('SELECT * FROM app_settings WHERE id = 1 LIMIT 1')->fetch() ?: [];

        $totalDownloads = (int) $pdo->query('SELECT COUNT(*) FROM download_logs WHERE success = 1')->fetchColumn();
        $downloadsToday = (int) $pdo->query('SELECT COUNT(*) FROM download_logs WHERE success = 1 AND DATE(created_at) = CURDATE()')->fetchColumn();
        $downloadsWeek = (int) $pdo->query('SELECT COUNT(*) FROM download_logs WHERE success = 1 AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)')->fetchColumn();
        $downloadsMonth = (int) $pdo->query('SELECT COUNT(*) FROM download_logs WHERE success = 1 AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)')->fetchColumn();

        $avgRating = $pdo->query('SELECT AVG(rating) FROM app_reviews WHERE status = \'approved\'')->fetchColumn();
        $totalRatings = (int) $pdo->query('SELECT COUNT(*) FROM app_reviews WHERE status = \'approved\'')->fetchColumn();
        $totalComments = (int) $pdo->query('SELECT COUNT(*) FROM app_reviews WHERE status IN (\'approved\',\'pending\')')->fetchColumn();
        $pendingComments = (int) $pdo->query('SELECT COUNT(*) FROM app_reviews WHERE status = \'pending\'')->fetchColumn();

        $activeVersions = (int) $pdo->query('SELECT COUNT(*) FROM apk_versions WHERE status = \'active\'')->fetchColumn();
        $deprecatedVersions = (int) $pdo->query('SELECT COUNT(*) FROM apk_versions WHERE status = \'deprecated\'')->fetchColumn();
        $revokedCount = (int) $pdo->query('SELECT COUNT(*) FROM revoked_access WHERE is_active = 1')->fetchColumn();

        $lastSync = $pdo->query('SELECT * FROM api_sync_logs ORDER BY created_at DESC LIMIT 1')->fetch();

        $ratingDist = [];
        for ($i = 5; $i >= 1; $i--) {
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM app_reviews WHERE status = \'approved\' AND rating = ?');
            $stmt->execute([$i]);
            $ratingDist[$i] = (int) $stmt->fetchColumn();
        }

        $trend = $pdo->query(
            'SELECT DATE(created_at) AS day, COUNT(*) AS cnt FROM download_logs
             WHERE success = 1 AND created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
             GROUP BY DATE(created_at) ORDER BY day ASC'
        )->fetchAll();

        return compact(
            'latest', 'settings', 'totalDownloads', 'downloadsToday', 'downloadsWeek', 'downloadsMonth',
            'avgRating', 'totalRatings', 'totalComments', 'pendingComments', 'activeVersions',
            'deprecatedVersions', 'revokedCount', 'lastSync', 'ratingDist', 'trend'
        );
    }

    public static function logDownload(?int $apkId, bool $success = true): void
    {
        $pdo = Database::pdo();
        $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
        $device = preg_match('/Mobile|Android|iPhone/i', $ua) ? 'mobile' : 'desktop';
        $browser = 'unknown';
        if (preg_match('/Chrome/i', $ua)) {
            $browser = 'Chrome';
        } elseif (preg_match('/Firefox/i', $ua)) {
            $browser = 'Firefox';
        } elseif (preg_match('/Safari/i', $ua)) {
            $browser = 'Safari';
        }

        $pdo->prepare(
            'INSERT INTO download_logs (apk_version_id, ip_address, user_agent, device_type, browser, referrer, success, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, NOW())'
        )->execute([
            $apkId,
            \App\Helpers\Security::clientIp(),
            $ua,
            $device,
            $browser,
            $_SERVER['HTTP_REFERER'] ?? null,
            $success ? 1 : 0,
        ]);

        if ($apkId && $success) {
            $pdo->prepare('UPDATE apk_versions SET download_count = download_count + 1 WHERE id = ?')->execute([$apkId]);
        }
    }
}
