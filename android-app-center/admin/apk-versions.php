<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use App\Helpers\Database;
use App\Helpers\Security;
use App\Services\SyncService;

require_admin();
$pdo = Database::pdo();
$admin = current_admin();
$pageTitle = 'APK Versions';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_verify()) {
    $action = $_POST['action'] ?? '';
    $id = (int) ($_POST['id'] ?? 0);
    if ($id > 0) {
        if ($action === 'activate') {
            Database::begin();
            $pdo->exec('UPDATE apk_versions SET is_latest = 0');
            $pdo->prepare('UPDATE apk_versions SET is_latest = 1, status = \'active\', published_at = COALESCE(published_at, NOW()) WHERE id = ?')->execute([$id]);
            Database::commit();
            audit_log((int) $admin['id'], 'version_activate', 'apk_versions', null, ['id' => $id]);
            SyncService::pushToMainSystem((int) $admin['id']);
            flash_set('success', 'Version activated.');
        } elseif ($action === 'deprecate') {
            $pdo->prepare('UPDATE apk_versions SET status = \'deprecated\', is_latest = 0 WHERE id = ?')->execute([$id]);
            audit_log((int) $admin['id'], 'version_deprecate', 'apk_versions', null, ['id' => $id]);
            SyncService::pushToMainSystem((int) $admin['id']);
            flash_set('success', 'Version deprecated.');
        } elseif ($action === 'mandatory') {
            $pdo->prepare('UPDATE apk_versions SET mandatory_update = 1, optional_update = 0 WHERE id = ?')->execute([$id]);
            SyncService::pushToMainSystem((int) $admin['id']);
            flash_set('success', 'Marked mandatory.');
        } elseif ($action === 'lock') {
            $pdo->prepare('UPDATE apk_versions SET is_locked = 1 WHERE id = ?')->execute([$id]);
            SyncService::pushToMainSystem((int) $admin['id']);
            flash_set('success', 'Version locked.');
        } elseif ($action === 'unlock') {
            $pdo->prepare('UPDATE apk_versions SET is_locked = 0 WHERE id = ?')->execute([$id]);
            SyncService::pushToMainSystem((int) $admin['id']);
            flash_set('success', 'Version unlocked.');
        } elseif ($action === 'delete') {
            $row = $pdo->prepare('SELECT * FROM apk_versions WHERE id = ?');
            $row->execute([$id]);
            $v = $row->fetch();
            if ($v && empty($v['is_latest']) && (int) $v['download_count'] === 0) {
                @unlink($v['file_path']);
                $pdo->prepare('DELETE FROM apk_versions WHERE id = ?')->execute([$id]);
                audit_log((int) $admin['id'], 'version_delete', 'apk_versions', $v, null);
                flash_set('success', 'Version deleted.');
            } else {
                flash_set('danger', 'Cannot delete latest version or version with downloads.');
            }
        }
    }
    header('Location: ' . base_url('admin/apk-versions.php'));
    exit;
}

$versions = $pdo->query('SELECT v.*, a.name AS uploader FROM apk_versions v LEFT JOIN admins a ON a.id = v.uploaded_by ORDER BY v.version_code DESC')->fetchAll();
require BASE_PATH . '/includes/admin_header.php';
$flash = flash_get();
?>
<h1 class="h3 mb-4">APK Versions</h1>
<?php if ($flash): ?><div class="alert alert-<?= $flash['type'] === 'success' ? 'success' : 'danger' ?>"><?= Security::escape($flash['message']) ?></div><?php endif; ?>
<div class="admin-card p-4 table-responsive">
  <table class="table table-sm align-middle">
    <thead><tr><th>Version</th><th>Code</th><th>Status</th><th>Latest</th><th>Downloads</th><th>Actions</th></tr></thead>
    <tbody>
      <?php foreach ($versions as $v): ?>
        <tr>
          <td><?= Security::escape($v['version_name']) ?></td>
          <td><?= (int) $v['version_code'] ?></td>
          <td><span class="badge bg-secondary"><?= Security::escape($v['status']) ?></span></td>
          <td><?= $v['is_latest'] ? 'Yes' : '—' ?></td>
          <td><?= number_format((int) $v['download_count']) ?></td>
          <td class="d-flex flex-wrap gap-1">
            <?php if (!$v['is_latest']): ?>
              <form method="post" class="d-inline"><?= csrf_field() ?><input type="hidden" name="id" value="<?= (int) $v['id'] ?>"><input type="hidden" name="action" value="activate"><button class="btn btn-sm btn-primary">Activate</button></form>
            <?php endif; ?>
            <form method="post" class="d-inline"><?= csrf_field() ?><input type="hidden" name="id" value="<?= (int) $v['id'] ?>"><input type="hidden" name="action" value="mandatory"><button class="btn btn-sm btn-warning">Mandatory</button></form>
            <form method="post" class="d-inline"><?= csrf_field() ?><input type="hidden" name="id" value="<?= (int) $v['id'] ?>"><input type="hidden" name="action" value="<?= $v['is_locked'] ? 'unlock' : 'lock' ?>"><button class="btn btn-sm btn-outline-danger"><?= $v['is_locked'] ? 'Unlock' : 'Lock' ?></button></form>
            <?php if ($v['status'] === 'active' && !$v['is_latest']): ?>
              <form method="post" class="d-inline"><?= csrf_field() ?><input type="hidden" name="id" value="<?= (int) $v['id'] ?>"><input type="hidden" name="action" value="deprecate"><button class="btn btn-sm btn-secondary">Deprecate</button></form>
            <?php endif; ?>
            <?php if (!$v['is_latest'] && (int) $v['download_count'] === 0): ?>
              <form method="post" class="d-inline" data-confirm="Delete this version?"><?= csrf_field() ?><input type="hidden" name="id" value="<?= (int) $v['id'] ?>"><input type="hidden" name="action" value="delete"><button class="btn btn-sm btn-outline-secondary">Delete</button></form>
            <?php endif; ?>
          </td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php require BASE_PATH . '/includes/admin_footer.php'; ?>
