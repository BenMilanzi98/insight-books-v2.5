<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use App\Helpers\Database;
use App\Helpers\Security;
use App\Helpers\Upload;
use App\Helpers\Validator;
use App\Services\SyncService;

require_admin();
$pageTitle = 'Upload APK';
$pdo = Database::pdo();
$admin = current_admin();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_verify()) {
    $versionName = trim((string) ($_POST['version_name'] ?? ''));
    $versionCode = (int) ($_POST['version_code'] ?? 0);
    $stored = null;
    $errors = array_filter([
        Validator::required($versionName, 'Version name'),
        Validator::versionCode($versionCode),
        isset($_FILES['apk']) ? Validator::apkFile($_FILES['apk'], (int) app_config('upload_max_apk_mb', 150)) : 'APK file is required.',
    ]);

    $dup = $pdo->prepare('SELECT id FROM apk_versions WHERE version_code = ? LIMIT 1');
    $dup->execute([$versionCode]);
    if ($dup->fetch()) {
        $errors[] = 'Version code already exists.';
    }

    if ($errors) {
        flash_set('danger', implode(' ', $errors));
    } else {
        try {
            Database::begin();
            $stored = Upload::moveApk($_FILES['apk'], upload_path('apks'));
            $activate = !empty($_POST['activate']);
            $mandatory = !empty($_POST['mandatory_update']);

            if ($activate) {
                $pdo->exec('UPDATE apk_versions SET is_latest = 0');
            }

            $pdo->prepare(
                'INSERT INTO apk_versions (version_name, version_code, release_notes, whats_new, file_name, file_path, file_size,
                 min_android_version, status, is_latest, mandatory_update, optional_update, uploaded_by, release_date, published_at, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW())'
            )->execute([
                $versionName,
                $versionCode,
                trim((string) ($_POST['release_notes'] ?? '')) ?: null,
                trim((string) ($_POST['whats_new'] ?? '')) ?: null,
                $stored['stored_name'],
                $stored['path'],
                $stored['size'],
                trim((string) ($_POST['min_android_version'] ?? '8.0')) ?: '8.0',
                $activate ? 'active' : 'draft',
                $activate ? 1 : 0,
                $mandatory ? 1 : 0,
                $mandatory ? 0 : 1,
                $admin['id'],
                $activate ? date('Y-m-d H:i:s') : null,
            ]);

            Database::commit();
            audit_log((int) $admin['id'], 'apk_upload', 'apk_versions', null, ['version_code' => $versionCode, 'version_name' => $versionName]);

            if ($activate) {
                $sync = SyncService::pushToMainSystem((int) $admin['id']);
                flash_set($sync['success'] ? 'success' : 'warning', $sync['success']
                    ? 'APK uploaded, published, and synced.'
                    : 'APK published but sync to main system failed. Check sync logs.');
            } else {
                flash_set('success', 'APK uploaded as draft.');
            }
            header('Location: ' . base_url('admin/apk-versions.php'));
            exit;
        } catch (Throwable $e) {
            Database::rollBack();
            if ($stored && !empty($stored['path']) && is_file($stored['path'])) {
                @unlink($stored['path']);
            }
            flash_set('danger', 'Upload failed: ' . $e->getMessage());
        }
    }
}

require BASE_PATH . '/includes/admin_header.php';
$flash = flash_get();
?>
<h1 class="h3 mb-4">Upload APK</h1>
<?php if ($flash): ?><div class="alert alert-<?= $flash['type'] === 'success' ? 'success' : ($flash['type'] === 'warning' ? 'warning' : 'danger') ?>"><?= Security::escape($flash['message']) ?></div><?php endif; ?>
<div class="admin-card p-4">
  <form method="post" enctype="multipart/form-data">
    <?= csrf_field() ?>
    <div class="row g-3">
      <div class="col-md-4"><label class="form-label">Version name</label><input class="form-control" name="version_name" placeholder="1.0.5" required></div>
      <div class="col-md-4"><label class="form-label">Version code</label><input class="form-control" type="number" name="version_code" min="1" required></div>
      <div class="col-md-4"><label class="form-label">Min Android</label><input class="form-control" name="min_android_version" value="8.0"></div>
      <div class="col-12"><label class="form-label">APK file</label><input class="form-control" type="file" name="apk" accept=".apk,application/vnd.android.package-archive" required></div>
      <div class="col-md-6"><label class="form-label">Release notes</label><textarea class="form-control" name="release_notes" rows="3"></textarea></div>
      <div class="col-md-6"><label class="form-label">What's new</label><textarea class="form-control" name="whats_new" rows="3"></textarea></div>
      <div class="col-md-6 form-check"><input class="form-check-input" type="checkbox" name="activate" id="activate" checked><label class="form-check-label" for="activate">Publish as active latest version</label></div>
      <div class="col-md-6 form-check"><input class="form-check-input" type="checkbox" name="mandatory_update" id="mandatory"><label class="form-check-label" for="mandatory">Mandatory update (lock older versions)</label></div>
      <div class="col-12"><button class="btn btn-primary">Upload APK</button></div>
    </div>
  </form>
</div>
<?php require BASE_PATH . '/includes/admin_footer.php'; ?>
