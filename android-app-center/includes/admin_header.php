<?php
require_admin();
$admin = current_admin();
$currentPage = basename($_SERVER['PHP_SELF']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= \App\Helpers\Security::escape($pageTitle ?? 'Admin') ?> — InsightBooks App Center</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
  <link href="<?= public_asset('css/app.css') ?>" rel="stylesheet">
</head>
<body class="admin-body">
<div class="container-fluid">
  <div class="row">
    <nav class="col-md-3 col-lg-2 admin-sidebar py-4">
      <div class="px-3 mb-4">
        <strong class="text-white">InsightBooks</strong>
        <div class="small text-secondary">App Center</div>
      </div>
      <?php
      $nav = [
        'dashboard.php' => ['Dashboard', 'bi-speedometer2'],
        'upload-apk.php' => ['Upload APK', 'bi-cloud-upload'],
        'apk-versions.php' => ['APK Versions', 'bi-phone'],
        'screenshots.php' => ['Screenshots', 'bi-images'],
        'settings.php' => ['App Content', 'bi-gear'],
        'reviews.php' => ['Reviews', 'bi-chat-dots'],
        'locks.php' => ['Locks', 'bi-lock'],
        'revoked-access.php' => ['Revoked Access', 'bi-person-x'],
        'sync-logs.php' => ['Sync Logs', 'bi-arrow-repeat'],
        'audit-logs.php' => ['Audit Logs', 'bi-journal-text'],
      ];
      foreach ($nav as $file => [$label, $icon]):
        $active = $currentPage === $file ? 'active' : '';
      ?>
        <a class="<?= $active ?>" href="<?= base_url('admin/' . $file) ?>"><i class="bi <?= $icon ?> me-2"></i><?= \App\Helpers\Security::escape($label) ?></a>
      <?php endforeach; ?>
      <hr class="border-secondary mx-3">
      <a href="<?= base_url() ?>" target="_blank"><i class="bi bi-box-arrow-up-right me-2"></i>Public Page</a>
      <a href="<?= base_url('admin/logout.php') ?>"><i class="bi bi-box-arrow-right me-2"></i>Logout</a>
      <div class="px-3 mt-4 small text-secondary"><?= \App\Helpers\Security::escape($admin['email'] ?? '') ?></div>
    </nav>
    <main class="col-md-9 col-lg-10 py-4 px-4">
