<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use App\Helpers\Database;
use App\Helpers\Security;

require_admin();
$pageTitle = 'Audit Logs';
$logs = Database::pdo()->query(
    'SELECT a.*, ad.email FROM audit_logs a LEFT JOIN admins ad ON ad.id = a.admin_id ORDER BY a.created_at DESC LIMIT 200'
)->fetchAll();
require BASE_PATH . '/includes/admin_header.php';
?>
<h1 class="h3 mb-4">Audit Trail</h1>
<div class="admin-card p-4 table-responsive">
  <table class="table table-sm">
    <thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Resource</th><th>IP</th></tr></thead>
    <tbody>
      <?php foreach ($logs as $l): ?>
        <tr>
          <td><?= Security::escape($l['created_at']) ?></td>
          <td><?= Security::escape($l['email'] ?? 'system') ?></td>
          <td><?= Security::escape($l['action']) ?></td>
          <td><?= Security::escape($l['resource'] ?? '') ?></td>
          <td><?= Security::escape($l['ip_address'] ?? '') ?></td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php require BASE_PATH . '/includes/admin_footer.php'; ?>
