<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use App\Helpers\Response;
use App\Helpers\Security;

if (admin_logged_in()) {
    Response::redirect(base_url('admin/dashboard.php'));
}

$error = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_verify()) {
        $error = 'Invalid session token.';
    } else {
        $ok = admin_login($_POST['email'] ?? '', $_POST['password'] ?? '');
        if ($ok) {
            Response::redirect(base_url('admin/dashboard.php'));
        }
        $error = 'Invalid email or password.';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Admin Login — InsightBooks App Center</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="<?= public_asset('css/app.css') ?>" rel="stylesheet">
</head>
<body class="admin-body d-flex align-items-center justify-content-center min-vh-100">
  <div class="admin-card p-4 shadow" style="max-width:420px;width:100%">
    <h1 class="h4 mb-1">InsightBooks App Center</h1>
    <p class="text-muted small mb-4">Administrator sign in</p>
    <?php if ($error): ?><div class="alert alert-danger"><?= Security::escape($error) ?></div><?php endif; ?>
    <form method="post">
      <?= csrf_field() ?>
      <div class="mb-3"><label class="form-label">Email</label><input type="email" name="email" class="form-control" required></div>
      <div class="mb-3"><label class="form-label">Password</label><input type="password" name="password" class="form-control" required></div>
      <button class="btn btn-primary w-100">Sign in</button>
    </form>
    <p class="small text-muted mt-3 mb-0">Use the administrator account configured during installation.</p>
  </div>
</body>
</html>
