<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use App\Helpers\Database;
use App\Helpers\Security;

require_admin();
$pdo = Database::pdo();
$admin = current_admin();
$pageTitle = 'Reviews';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && csrf_verify()) {
    $id = (int) ($_POST['id'] ?? 0);
    $action = $_POST['action'] ?? '';
    $map = ['approve' => 'approved', 'hide' => 'hidden', 'delete' => 'deleted'];
    if ($id && isset($map[$action])) {
        $pdo->prepare('UPDATE app_reviews SET status = ?, updated_at = NOW() WHERE id = ?')->execute([$map[$action], $id]);
        audit_log((int) $admin['id'], 'review_' . $action, 'app_reviews', null, ['id' => $id]);
        flash_set('success', 'Review updated.');
    }
    header('Location: ' . base_url('admin/reviews.php'));
    exit;
}

$reviews = $pdo->query('SELECT * FROM app_reviews WHERE status != \'deleted\' ORDER BY created_at DESC LIMIT 200')->fetchAll();
require BASE_PATH . '/includes/admin_header.php';
?>
<h1 class="h3 mb-4">Reviews &amp; Ratings</h1>
<div class="admin-card p-4">
  <table class="table table-sm">
    <thead><tr><th>Name</th><th>Rating</th><th>Comment</th><th>Status</th><th>Date</th><th></th></tr></thead>
    <tbody>
      <?php foreach ($reviews as $r): ?>
        <tr>
          <td><?= Security::escape($r['reviewer_name']) ?></td>
          <td><?= (int) $r['rating'] ?>★</td>
          <td style="max-width:280px"><?= Security::escape(mb_substr($r['comment'], 0, 120)) ?>…</td>
          <td><span class="badge bg-secondary"><?= Security::escape($r['status']) ?></span></td>
          <td><?= date('Y-m-d', strtotime($r['created_at'])) ?></td>
          <td class="text-nowrap">
            <?php if ($r['status'] === 'pending'): ?>
              <form method="post" class="d-inline"><?= csrf_field() ?><input type="hidden" name="id" value="<?= (int) $r['id'] ?>"><input type="hidden" name="action" value="approve"><button class="btn btn-sm btn-success">Approve</button></form>
            <?php endif; ?>
            <form method="post" class="d-inline"><?= csrf_field() ?><input type="hidden" name="id" value="<?= (int) $r['id'] ?>"><input type="hidden" name="action" value="hide"><button class="btn btn-sm btn-outline-secondary">Hide</button></form>
            <form method="post" class="d-inline"><?= csrf_field() ?><input type="hidden" name="id" value="<?= (int) $r['id'] ?>"><input type="hidden" name="action" value="delete"><button class="btn btn-sm btn-outline-danger">Delete</button></form>
          </td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php require BASE_PATH . '/includes/admin_footer.php'; ?>
