<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use App\Helpers\Database;
use App\Helpers\Security;

require_admin();
$pageTitle = 'Sync Logs';
$logs = Database::pdo()->query('SELECT * FROM api_sync_logs ORDER BY created_at DESC LIMIT 100')->fetchAll();
require BASE_PATH . '/includes/admin_header.php';
?>
<h1 class="h3 mb-4">API Sync Logs</h1>
<div class="admin-card p-4 table-responsive">
  <table class="table table-sm">
    <thead><tr><th>Time</th><th>Endpoint</th><th>HTTP</th><th>Success</th><th>Error</th></tr></thead>
    <tbody>
      <?php foreach ($logs as $l): ?>
        <tr>
          <td><?= Security::escape($l['created_at']) ?></td>
          <td style="max-width:200px" class="text-truncate"><?= Security::escape($l['endpoint']) ?></td>
          <td><?= (int) ($l['response_code'] ?? 0) ?></td>
          <td><?= $l['success'] ? 'Yes' : 'No' ?></td>
          <td><?= Security::escape($l['error_message'] ?? '') ?></td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php require BASE_PATH . '/includes/admin_footer.php'; ?>
