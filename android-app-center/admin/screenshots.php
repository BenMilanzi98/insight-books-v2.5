<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use App\Helpers\Database;
use App\Helpers\Security;
use App\Helpers\Upload;

require_admin();
$pdo = Database::pdo();
$admin = current_admin();
$pageTitle = 'Screenshots';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_verify()) {
    if (!empty($_FILES['screenshot']['name'])) {
        try {
            $stored = Upload::moveImage($_FILES['screenshot'], upload_path('screenshots'), (int) app_config('upload_max_image_mb', 5));
            $pdo->prepare('INSERT INTO apk_screenshots (file_name, file_path, caption, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, NOW(), NOW())')
                ->execute([
                    $stored['stored_name'],
                    $stored['path'],
                    trim((string) ($_POST['caption'] ?? '')) ?: null,
                    (int) ($_POST['sort_order'] ?? 0),
                ]);
            audit_log((int) $admin['id'], 'screenshot_upload', 'apk_screenshots');
            flash_set('success', 'Screenshot uploaded.');
        } catch (Throwable $e) {
            flash_set('danger', $e->getMessage());
        }
    } elseif (($_POST['action'] ?? '') === 'delete') {
        $id = (int) ($_POST['id'] ?? 0);
        $row = $pdo->prepare('SELECT * FROM apk_screenshots WHERE id = ?');
        $row->execute([$id]);
        if ($s = $row->fetch()) {
            @unlink($s['file_path']);
            $pdo->prepare('DELETE FROM apk_screenshots WHERE id = ?')->execute([$id]);
            flash_set('success', 'Screenshot deleted.');
        }
    }
    header('Location: ' . base_url('admin/screenshots.php'));
    exit;
}

$shots = $pdo->query('SELECT * FROM apk_screenshots ORDER BY sort_order ASC, id ASC')->fetchAll();
require BASE_PATH . '/includes/admin_header.php';
?>
<h1 class="h3 mb-4">Screenshots</h1>
<div class="row g-4">
  <div class="col-lg-4">
    <div class="admin-card p-4">
      <form method="post" enctype="multipart/form-data">
        <?= csrf_field() ?>
        <div class="mb-3"><label class="form-label">Image</label><input type="file" name="screenshot" class="form-control" accept="image/*" required></div>
        <div class="mb-3"><label class="form-label">Caption</label><input class="form-control" name="caption"></div>
        <div class="mb-3"><label class="form-label">Sort order</label><input class="form-control" type="number" name="sort_order" value="0"></div>
        <button class="btn btn-primary">Upload</button>
      </form>
    </div>
  </div>
  <div class="col-lg-8">
    <div class="row g-3">
      <?php foreach ($shots as $s): ?>
        <div class="col-md-6">
          <div class="admin-card p-2">
            <img src="<?= base_url('uploads/screenshots/' . rawurlencode($s['file_name'])) ?>" class="img-fluid rounded" alt="">
            <div class="p-2 d-flex justify-content-between align-items-center">
              <small><?= Security::escape($s['caption'] ?? '') ?></small>
              <form method="post"><?= csrf_field() ?><input type="hidden" name="action" value="delete"><input type="hidden" name="id" value="<?= (int) $s['id'] ?>"><button class="btn btn-sm btn-outline-danger">Delete</button></form>
            </div>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</div>
<?php require BASE_PATH . '/includes/admin_footer.php'; ?>
