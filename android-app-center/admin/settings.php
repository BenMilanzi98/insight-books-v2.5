<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use App\Helpers\Database;
use App\Helpers\Security;

require_admin();
$pdo = Database::pdo();
$admin = current_admin();
$pageTitle = 'App Content';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_verify()) {
    $features = array_values(array_filter(array_map('trim', explode("\n", (string) ($_POST['feature_list'] ?? '')))));
    $pdo->prepare(
        'UPDATE app_settings SET app_title=?, app_tagline=?, short_description=?, full_description=?, developer_name=?, support_email=?,
         privacy_url=?, terms_url=?, min_android_version=?, install_instructions=?, feature_list=?, updated_at=NOW() WHERE id=1'
    )->execute([
        trim((string) $_POST['app_title']),
        trim((string) $_POST['app_tagline']),
        trim((string) $_POST['short_description']),
        trim((string) $_POST['full_description']),
        trim((string) $_POST['developer_name']),
        trim((string) $_POST['support_email']),
        trim((string) $_POST['privacy_url']),
        trim((string) $_POST['terms_url']),
        trim((string) $_POST['min_android_version']),
        trim((string) $_POST['install_instructions']),
        json_encode($features),
    ]);
    audit_log((int) $admin['id'], 'settings_update', 'app_settings');
    flash_set('success', 'Settings saved.');
    header('Location: ' . base_url('admin/settings.php'));
    exit;
}

$settings = $pdo->query('SELECT * FROM app_settings WHERE id = 1')->fetch() ?: [];
$featuresText = implode("\n", json_decode($settings['feature_list'] ?? '[]', true) ?: []);
require BASE_PATH . '/includes/admin_header.php';
?>
<h1 class="h3 mb-4">App Content</h1>
<div class="admin-card p-4">
  <form method="post">
    <?= csrf_field() ?>
    <div class="row g-3">
      <div class="col-md-6"><label class="form-label">App title</label><input class="form-control" name="app_title" value="<?= Security::escape($settings['app_title'] ?? '') ?>" required></div>
      <div class="col-md-6"><label class="form-label">Tagline</label><input class="form-control" name="app_tagline" value="<?= Security::escape($settings['app_tagline'] ?? '') ?>"></div>
      <div class="col-12"><label class="form-label">Short description</label><input class="form-control" name="short_description" value="<?= Security::escape($settings['short_description'] ?? '') ?>"></div>
      <div class="col-12"><label class="form-label">Full description</label><textarea class="form-control" name="full_description" rows="4"><?= Security::escape($settings['full_description'] ?? '') ?></textarea></div>
      <div class="col-md-6"><label class="form-label">Developer</label><input class="form-control" name="developer_name" value="<?= Security::escape($settings['developer_name'] ?? '') ?>"></div>
      <div class="col-md-6"><label class="form-label">Support email</label><input class="form-control" name="support_email" value="<?= Security::escape($settings['support_email'] ?? '') ?>"></div>
      <div class="col-md-6"><label class="form-label">Privacy URL</label><input class="form-control" name="privacy_url" value="<?= Security::escape($settings['privacy_url'] ?? '') ?>"></div>
      <div class="col-md-6"><label class="form-label">Terms URL</label><input class="form-control" name="terms_url" value="<?= Security::escape($settings['terms_url'] ?? '') ?>"></div>
      <div class="col-md-4"><label class="form-label">Min Android</label><input class="form-control" name="min_android_version" value="<?= Security::escape($settings['min_android_version'] ?? '8.0') ?>"></div>
      <div class="col-12"><label class="form-label">Install instructions</label><textarea class="form-control" name="install_instructions" rows="4"><?= Security::escape($settings['install_instructions'] ?? '') ?></textarea></div>
      <div class="col-12"><label class="form-label">Features (one per line)</label><textarea class="form-control" name="feature_list" rows="6"><?= Security::escape($featuresText) ?></textarea></div>
      <div class="col-12"><button class="btn btn-primary">Save settings</button></div>
    </div>
  </form>
</div>
<?php require BASE_PATH . '/includes/admin_footer.php'; ?>
