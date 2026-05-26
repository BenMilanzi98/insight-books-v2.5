<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use App\Helpers\Database;
use App\Helpers\Security;

require_admin();
$pdo = Database::pdo();
$admin = current_admin();
$pageTitle = 'Revoked Access';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_verify()) {
    if (($_POST['action'] ?? '') === 'revoke') {
        try {
            $pdo->prepare(
                'INSERT INTO revoked_access (revoke_type, identifier, reason, expires_at, is_active, revoked_by, created_at, updated_at)
                 VALUES (?, ?, ?, ?, 1, ?, NOW(), NOW())'
            )->execute([
                $_POST['revoke_type'],
                trim((string) $_POST['identifier']),
                trim((string) ($_POST['reason'] ?? '')) ?: null,
                !empty($_POST['expires_at']) ? $_POST['expires_at'] : null,
                $admin['id'],
            ]);
            audit_log((int) $admin['id'], 'access_revoke', 'revoked_access');
            flash_set('success', 'Access revoked.');
        } catch (Throwable $e) {
            flash_set('danger', 'Could not revoke (duplicate or invalid).');
        }
    } elseif (($_POST['action'] ?? '') === 'restore') {
        $pdo->prepare('UPDATE revoked_access SET is_active = 0 WHERE id = ?')->execute([(int) $_POST['id']]);
        flash_set('success', 'Access restored.');
    }
    header('Location: ' . base_url('admin/revoked-access.php'));
    exit;
}

$rows = $pdo->query('SELECT * FROM revoked_access ORDER BY created_at DESC LIMIT 200')->fetchAll();
require BASE_PATH . '/includes/admin_header.php';
?>
<h1 class="h3 mb-4">Revoked Access</h1>
<div class="row g-4">
  <div class="col-lg-4">
    <div class="admin-card p-4">
      <form method="post">
        <?= csrf_field() ?>
        <input type="hidden" name="action" value="revoke">
        <div class="mb-3"><label class="form-label">Type</label>
          <select class="form-select" name="revoke_type" required>
            <option value="user_id">User ID</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="device_id">Device ID</option>
            <option value="business_id">Business ID</option>
            <option value="tenant_id">Tenant ID</option>
          </select>
        </div>
        <div class="mb-3"><label class="form-label">Identifier</label><input class="form-control" name="identifier" required></div>
        <div class="mb-3"><label class="form-label">Reason</label><input class="form-control" name="reason"></div>
        <div class="mb-3"><label class="form-label">Expires at (optional)</label><input class="form-control" type="datetime-local" name="expires_at"></div>
        <button class="btn btn-danger">Revoke access</button>
      </form>
    </div>
  </div>
  <div class="col-lg-8">
    <div class="admin-card p-4 table-responsive">
      <table class="table table-sm">
        <thead><tr><th>Type</th><th>Identifier</th><th>Active</th><th>Expires</th><th></th></tr></thead>
        <tbody>
          <?php foreach ($rows as $r): ?>
            <tr>
              <td><?= Security::escape($r['revoke_type']) ?></td>
              <td><?= Security::escape($r['identifier']) ?></td>
              <td><?= $r['is_active'] ? 'Yes' : 'No' ?></td>
              <td><?= $r['expires_at'] ? Security::escape($r['expires_at']) : '—' ?></td>
              <td>
                <?php if ($r['is_active']): ?>
                  <form method="post" class="d-inline"><?= csrf_field() ?><input type="hidden" name="action" value="restore"><input type="hidden" name="id" value="<?= (int) $r['id'] ?>"><button class="btn btn-sm btn-outline-primary">Restore</button></form>
                <?php endif; ?>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
</div>
<?php require BASE_PATH . '/includes/admin_footer.php'; ?>
