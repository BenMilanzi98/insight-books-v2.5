<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

require_admin();
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !csrf_verify()) {
    flash_set('danger', 'Invalid request.');
} else {
    try {
        $admin = current_admin();
        $result = \App\Services\SyncService::pushToMainSystem($admin ? (int) $admin['id'] : null);
        flash_set($result['success'] ? 'success' : 'danger', $result['success'] ? 'Synced successfully.' : 'Sync failed. Check sync logs.');
    } catch (Throwable $e) {
        error_log('Manual sync failed: ' . $e->getMessage());
        flash_set('danger', 'Sync failed. Check the PHP error log for details.');
    }
}
\App\Helpers\Response::redirect(base_url('admin/dashboard.php'));
