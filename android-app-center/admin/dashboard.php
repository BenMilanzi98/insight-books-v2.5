<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use App\Helpers\Security;
use App\Services\AnalyticsService;

$pageTitle = 'Dashboard';
$stats = AnalyticsService::dashboardStats();
require BASE_PATH . '/includes/admin_header.php';
$s = $stats;
?>
<h1 class="h3 mb-4">Dashboard</h1>
<?php if ($flash = flash_get()): ?>
  <div class="alert alert-<?= $flash['type'] === 'success' ? 'success' : 'danger' ?>"><?= Security::escape($flash['message']) ?></div>
<?php endif; ?>
<div class="row g-3 mb-4">
  <div class="col-md-3"><div class="admin-card stat-card p-3"><div class="text-muted small">Active version</div><div class="value"><?= Security::escape($s['latest']['version_name'] ?? '—') ?></div></div></div>
  <div class="col-md-3"><div class="admin-card stat-card p-3"><div class="text-muted small">Total downloads</div><div class="value"><?= number_format($s['totalDownloads']) ?></div></div></div>
  <div class="col-md-3"><div class="admin-card stat-card p-3"><div class="text-muted small">Avg rating</div><div class="value"><?= number_format((float) $s['avgRating'], 1) ?></div></div></div>
  <div class="col-md-3"><div class="admin-card stat-card p-3"><div class="text-muted small">Pending reviews</div><div class="value"><?= (int) $s['pendingComments'] ?></div></div></div>
</div>
<div class="row g-3 mb-4">
  <div class="col-md-3"><div class="admin-card p-3"><div class="small text-muted">Today</div><strong><?= (int) $s['downloadsToday'] ?></strong></div></div>
  <div class="col-md-3"><div class="admin-card p-3"><div class="small text-muted">This week</div><strong><?= (int) $s['downloadsWeek'] ?></strong></div></div>
  <div class="col-md-3"><div class="admin-card p-3"><div class="small text-muted">This month</div><strong><?= (int) $s['downloadsMonth'] ?></strong></div></div>
  <div class="col-md-3"><div class="admin-card p-3"><div class="small text-muted">Revoked</div><strong><?= (int) $s['revokedCount'] ?></strong></div></div>
</div>
<div class="row g-4">
  <div class="col-lg-8">
    <div class="admin-card p-4">
      <h5>Download trend (14 days)</h5>
      <div class="d-flex align-items-end gap-2" style="height:120px">
        <?php foreach ($s['trend'] as $row):
          $max = max(1, max(array_column($s['trend'], 'cnt') ?: [1]));
          $h = max(4, (int) round(((int) $row['cnt'] / $max) * 100));
        ?>
          <div class="text-center flex-fill">
            <div class="chart-bar mx-auto" style="height:<?= $h ?>px;width:100%"></div>
            <small class="text-muted d-block mt-1" style="font-size:.65rem"><?= date('d', strtotime($row['day'])) ?></small>
          </div>
        <?php endforeach; ?>
        <?php if (!$s['trend']): ?><p class="text-muted mb-0">No download data yet.</p><?php endif; ?>
      </div>
    </div>
  </div>
  <div class="col-lg-4">
    <div class="admin-card p-4">
      <h5>System status</h5>
      <ul class="list-unstyled small mb-0">
        <li>Global lock: <strong><?= !empty($s['settings']['global_app_lock']) ? 'ON' : 'OFF' ?></strong></li>
        <li>Maintenance: <strong><?= !empty($s['settings']['maintenance_mode']) ? 'ON' : 'OFF' ?></strong></li>
        <li>Mandatory update: <strong><?= !empty($s['latest']['mandatory_update']) ? 'YES' : 'NO' ?></strong></li>
        <li>Last sync: <strong><?= $s['lastSync'] ? ($s['lastSync']['success'] ? 'OK' : 'FAILED') : 'Never' ?></strong></li>
      </ul>
      <form method="post" action="<?= base_url('admin/sync-now.php') ?>" class="mt-3">
        <?= csrf_field() ?>
        <button class="btn btn-sm btn-outline-primary">Sync to InsightBooks now</button>
      </form>
    </div>
  </div>
</div>
<?php require BASE_PATH . '/includes/admin_footer.php'; ?>
