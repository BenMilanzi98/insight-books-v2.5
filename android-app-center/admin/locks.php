<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use App\Helpers\Database;
use App\Helpers\Security;
use App\Services\SyncService;

require_admin();
$pdo = Database::pdo();
$admin = current_admin();
$pageTitle = 'Locks';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_verify()) {
        flash_set('danger', 'Invalid request. Please try again.');
        header('Location: ' . base_url('admin/locks.php'));
        exit;
    }

    try {
        $pdo->prepare(
            'UPDATE app_settings SET global_app_lock=?, maintenance_mode=?, security_lock=?, website_download_locked=?,
             global_lock_message=?, maintenance_message=?, update_prompt_message=?, emergency_notice=?, updated_at=NOW() WHERE id=1'
        )->execute([
            !empty($_POST['global_app_lock']) ? 1 : 0,
            !empty($_POST['maintenance_mode']) ? 1 : 0,
            !empty($_POST['security_lock']) ? 1 : 0,
            !empty($_POST['website_download_locked']) ? 1 : 0,
            trim((string) ($_POST['global_lock_message'] ?? '')) ?: null,
            trim((string) ($_POST['maintenance_message'] ?? '')) ?: null,
            trim((string) ($_POST['update_prompt_message'] ?? '')) ?: null,
            trim((string) ($_POST['emergency_notice'] ?? '')) ?: null,
        ]);

        $adminId = $admin ? (int) $admin['id'] : null;
        audit_log($adminId, 'locks_update', 'app_settings');
        $syncResult = SyncService::pushToMainSystem($adminId);

        flash_set(
            $syncResult['success'] ? 'success' : 'warning',
            $syncResult['success']
                ? 'Lock settings saved and synced.'
                : 'Lock settings saved, but sync failed. Check sync logs.'
        );
    } catch (Throwable $e) {
        error_log('Unable to save lock settings: ' . $e->getMessage());
        flash_set('danger', 'Unable to save lock settings. Check the PHP error log for details.');
    }

    header('Location: ' . base_url('admin/locks.php'));
    exit;
}

$settings = $pdo->query('SELECT * FROM app_settings WHERE id = 1')->fetch() ?: [];
require BASE_PATH . '/includes/admin_header.php';
?>
<h1 class="h3 mb-4">Lock Management</h1>
<div class="admin-card p-4">
  <form method="post">
    <?= csrf_field() ?>
    <div class="row g-3">
      <div class="col-md-6 form-check"><input class="form-check-input" type="checkbox" name="global_app_lock" id="g" <?= !empty($settings['global_app_lock']) ? 'checked' : '' ?>><label class="form-check-label" for="g">Global app lock</label></div>
      <div class="col-md-6 form-check"><input class="form-check-input" type="checkbox" name="maintenance_mode" id="m" <?= !empty($settings['maintenance_mode']) ? 'checked' : '' ?>><label class="form-check-label" for="m">Maintenance mode</label></div>
      <div class="col-md-6 form-check"><input class="form-check-input" type="checkbox" name="security_lock" id="s" <?= !empty($settings['security_lock']) ? 'checked' : '' ?>><label class="form-check-label" for="s">Security lock</label></div>
      <div class="col-md-6 form-check"><input class="form-check-input" type="checkbox" name="website_download_locked" id="w" <?= !empty($settings['website_download_locked']) ? 'checked' : '' ?>><label class="form-check-label" for="w">Disable public APK download</label></div>
      <div class="col-12"><label class="form-label">Global lock message</label><textarea class="form-control" name="global_lock_message" rows="2"><?= Security::escape($settings['global_lock_message'] ?? '') ?></textarea></div>
      <div class="col-12"><label class="form-label">Maintenance message</label><textarea class="form-control" name="maintenance_message" rows="2"><?= Security::escape($settings['maintenance_message'] ?? '') ?></textarea></div>
      <div class="col-12"><label class="form-label">Update prompt message</label><textarea class="form-control" name="update_prompt_message" rows="2"><?= Security::escape($settings['update_prompt_message'] ?? '') ?></textarea></div>
      <div class="col-12"><label class="form-label">Emergency notice / broadcast</label><textarea class="form-control" name="emergency_notice" rows="2"><?= Security::escape($settings['emergency_notice'] ?? '') ?></textarea></div>
      <div class="col-12"><button class="btn btn-primary">Save lock settings</button></div>
    </div>
  </form>
  <p class="small text-muted mt-3 mb-0">Version-specific locks are managed on the <a href="<?= base_url('admin/apk-versions.php') ?>">APK Versions</a> page.</p>
</div>
<?php require BASE_PATH . '/includes/admin_footer.php'; ?>
