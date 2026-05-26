<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

use App\Helpers\Database;
use App\Helpers\Security;
use App\Helpers\Validator;

// Security::escape available via import

$pdo = Database::pdo();
$settings = $pdo->query('SELECT * FROM app_settings WHERE id = 1')->fetch() ?: [];
$latest = $pdo->query('SELECT * FROM apk_versions WHERE is_latest = 1 AND status = \'active\' LIMIT 1')->fetch();
if ($latest && !empty($latest['file_name'])) {
    $actualApkPath = upload_path('apks') . DIRECTORY_SEPARATOR . $latest['file_name'];
    if (is_file($actualApkPath)) {
        $latest['file_size'] = filesize($actualApkPath) ?: (int) $latest['file_size'];
    }
}
$versions = $pdo->query('SELECT version_name, version_code, release_notes, published_at, download_count FROM apk_versions WHERE status IN (\'active\',\'deprecated\') ORDER BY version_code DESC LIMIT 10')->fetchAll();
$screenshots = $pdo->query('SELECT * FROM apk_screenshots WHERE is_active = 1 ORDER BY sort_order ASC')->fetchAll();
$reviews = $pdo->query('SELECT * FROM app_reviews WHERE status = \'approved\' ORDER BY created_at DESC LIMIT 20')->fetchAll();

$avgRating = (float) ($pdo->query('SELECT AVG(rating) FROM app_reviews WHERE status = \'approved\'')->fetchColumn() ?: 0);
$totalRatings = (int) $pdo->query('SELECT COUNT(*) FROM app_reviews WHERE status = \'approved\'')->fetchColumn();
$totalDownloads = (int) $pdo->query('SELECT COUNT(*) FROM download_logs WHERE success = 1')->fetchColumn();

$ratingDist = [];
for ($i = 5; $i >= 1; $i--) {
    $s = $pdo->prepare('SELECT COUNT(*) FROM app_reviews WHERE status = \'approved\' AND rating = ?');
    $s->execute([$i]);
    $ratingDist[$i] = (int) $s->fetchColumn();
}

$features = json_decode($settings['feature_list'] ?? '[]', true) ?: [];
$logoUrl = public_asset('images/logo.png');
$downloadUrl = $latest ? base_url('download.php?id=' . (int) $latest['id']) : '#';
$pageTitle = ($settings['app_title'] ?? 'InsightBooks') . ' — Official Android Download';

if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['form'] ?? '') === 'review') {
    if (!csrf_verify()) {
        flash_set('danger', 'Invalid session. Please try again.');
    } elseif (!empty($_POST['website'])) {
        flash_set('danger', 'Submission blocked.');
    } elseif (!rate_limit_check('review_submit', (int) app_config('rate_limit_reviews', 5), (int) app_config('rate_limit_window_seconds', 3600))) {
        flash_set('danger', 'Too many submissions. Please try again later.');
    } else {
        $name = trim((string) ($_POST['reviewer_name'] ?? ''));
        $comment = trim((string) ($_POST['comment'] ?? ''));
        $deviceModel = trim((string) ($_POST['device_model'] ?? ''));
        $appVersionUsed = trim((string) ($_POST['app_version_used'] ?? ''));
        $rating = (int) ($_POST['rating'] ?? 0);
        $errors = array_filter([
            Validator::required($name, 'Name'),
            Validator::required($comment, 'Comment'),
            Validator::rating($rating),
        ]);
        if (mb_strlen($name) > 120) {
            $errors[] = 'Name must be 120 characters or fewer.';
        }
        if (mb_strlen($comment) > 2000) {
            $errors[] = 'Comment must be 2000 characters or fewer.';
        }
        if (mb_strlen($deviceModel) > 120) {
            $errors[] = 'Device must be 120 characters or fewer.';
        }
        if (mb_strlen($appVersionUsed) > 32) {
            $errors[] = 'App version must be 32 characters or fewer.';
        }
        if ($errors) {
            flash_set('danger', implode(' ', $errors));
        } else {
            $pdo->prepare(
                'INSERT INTO app_reviews (reviewer_name, rating, comment, device_model, app_version_used, ip_address, status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, \'pending\', NOW(), NOW())'
            )->execute([
                $name,
                $rating,
                $comment,
                $deviceModel ?: null,
                $appVersionUsed ?: null,
                Security::clientIp(),
            ]);
            flash_set('success', 'Thank you! Your review will appear after approval.');
        }
    }
    header('Location: ' . base_url());
    exit;
}

$flash = flash_get();
require BASE_PATH . '/includes/public_header.php';
?>
<section class="hero-section">
  <div class="container">
    <?php if ($flash): ?>
      <div class="alert alert-<?= $flash['type'] === 'success' ? 'success' : 'danger' ?> glass-card text-dark"><?= Security::escape($flash['message']) ?></div>
    <?php endif; ?>
    <div class="hero-orb hero-orb-one"></div>
    <div class="hero-orb hero-orb-two"></div>
    <div class="row align-items-center g-5 position-relative">
      <div class="col-lg-7">
        <div class="hero-kicker mb-3"><i class="bi bi-shield-check me-2"></i>Official Android Download Center</div>
        <div class="app-identity mb-4">
          <div class="app-logo-frame">
            <img src="<?= Security::escape($logoUrl) ?>" alt="InsightBooks" class="app-logo" onerror="this.style.display='none'">
          </div>
          <div>
            <h1 class="hero-title mb-2"><?= Security::escape($settings['app_title'] ?? 'InsightBooks') ?></h1>
            <p class="hero-tagline mb-3"><?= Security::escape($settings['app_tagline'] ?? '') ?></p>
            <div class="d-flex flex-wrap gap-2">
              <?php if ($latest): ?>
                <span class="stat-pill"><i class="bi bi-tag me-1"></i>Version <?= Security::escape($latest['version_name']) ?></span>
                <span class="stat-pill"><i class="bi bi-hdd me-1"></i><?= format_bytes((int) $latest['file_size']) ?></span>
              <?php else: ?>
                <span class="stat-pill"><i class="bi bi-hourglass-split me-1"></i>Preparing first release</span>
              <?php endif; ?>
              <span class="stat-pill"><i class="bi bi-star-fill me-1"></i><?= number_format($avgRating, 1) ?> rating</span>
              <span class="stat-pill"><i class="bi bi-download me-1"></i><?= number_format($totalDownloads) ?> downloads</span>
            </div>
          </div>
        </div>
        <p class="hero-copy mb-4"><?= Security::escape($settings['short_description'] ?? 'Secure Android access for InsightBooks business management.') ?></p>
        <?php if ($latest && empty($settings['website_download_locked'])): ?>
          <div class="d-flex flex-column flex-sm-row gap-3 align-items-sm-center">
            <a href="<?= Security::escape($downloadUrl) ?>" class="btn btn-download btn-lg"><i class="bi bi-download me-2"></i>Download latest APK</a>
            <span class="download-trust"><i class="bi bi-patch-check-fill me-1"></i>Verified official release</span>
          </div>
        <?php else: ?>
          <div class="release-pending">
            <i class="bi bi-cloud-arrow-up me-2"></i>
            APK download is temporarily unavailable. Please check back shortly.
          </div>
        <?php endif; ?>
        <p class="small mt-3 opacity-75 mb-0">Developer: <?= Security::escape($settings['developer_name'] ?? app_config('default_developer')) ?> · Minimum Android <?= Security::escape($settings['min_android_version'] ?? '8.0') ?>+</p>
      </div>
      <div class="col-lg-5">
        <div class="hero-panel glass-card">
          <div class="hero-panel-header">
            <span class="status-dot"></span>
            <span>Secure distribution</span>
          </div>
          <div class="hero-metric-grid">
            <div>
              <span class="metric-label">Current version</span>
              <strong><?= $latest ? Security::escape($latest['version_name']) : 'Pending' ?></strong>
            </div>
            <div>
              <span class="metric-label">Compatibility</span>
              <strong>Android <?= Security::escape($settings['min_android_version'] ?? '8.0') ?>+</strong>
            </div>
            <div>
              <span class="metric-label">Downloads</span>
              <strong><?= number_format($totalDownloads) ?></strong>
            </div>
            <div>
              <span class="metric-label">Rating</span>
              <strong><?= number_format($avgRating, 1) ?>/5</strong>
            </div>
          </div>
          <div class="security-note">
            <i class="bi bi-shield-lock-fill"></i>
            <div>
              <h6>Security notice</h6>
              <p>Download only from this official InsightBooks page. Verify the developer and version before installing.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="content-section">
  <div class="container">
    <div class="row g-4">
      <div class="col-lg-8">
        <div class="admin-card content-card p-4 mb-4">
          <div class="section-label">Overview</div>
          <h3>About this app</h3>
          <p><?= nl2br(Security::escape($settings['full_description'] ?? $settings['short_description'] ?? '')) ?></p>
          <?php if ($latest && !empty($latest['whats_new'])): ?>
            <h5 class="mt-4">What's new in v<?= Security::escape($latest['version_name']) ?></h5>
            <p><?= nl2br(Security::escape($latest['whats_new'])) ?></p>
          <?php endif; ?>
        </div>

        <?php if ($screenshots): ?>
        <div class="admin-card p-4 mb-4">
          <h3>Screenshots</h3>
          <div id="screenshotCarousel" class="carousel slide screenshot-carousel" data-bs-ride="carousel">
            <div class="carousel-inner">
              <?php foreach ($screenshots as $i => $shot): ?>
                <div class="carousel-item <?= $i === 0 ? 'active' : '' ?>">
                  <img src="<?= base_url('uploads/screenshots/' . rawurlencode($shot['file_name'])) ?>" alt="<?= Security::escape($shot['caption'] ?? 'Screenshot') ?>">
                </div>
              <?php endforeach; ?>
            </div>
            <button class="carousel-control-prev" type="button" data-bs-target="#screenshotCarousel" data-bs-slide="prev"><span class="carousel-control-prev-icon"></span></button>
            <button class="carousel-control-next" type="button" data-bs-target="#screenshotCarousel" data-bs-slide="next"><span class="carousel-control-next-icon"></span></button>
          </div>
        </div>
        <?php endif; ?>

        <div class="admin-card content-card p-4 mb-4">
          <div class="section-label">Highlights</div>
          <h3>Features</h3>
          <div class="row g-3">
            <?php foreach ($features as $f): ?>
              <div class="col-md-6 d-flex gap-3 align-items-start feature-item">
                <div class="feature-icon"><i class="bi bi-check-lg"></i></div>
                <div><?= Security::escape(is_string($f) ? $f : (string) $f) ?></div>
              </div>
            <?php endforeach; ?>
          </div>
        </div>

        <div class="admin-card content-card p-4 mb-4">
          <div class="section-label">Setup</div>
          <h3>Install instructions</h3>
          <pre class="install-box mb-0"><?= Security::escape($settings['install_instructions'] ?? '') ?></pre>
        </div>

        <div class="admin-card content-card p-4 mb-4">
          <div class="section-label">Releases</div>
          <h3>Version history</h3>
          <div class="table-responsive">
            <table class="table table-sm">
              <thead><tr><th>Version</th><th>Code</th><th>Released</th><th>Downloads</th></tr></thead>
              <tbody>
                <?php foreach ($versions as $v): ?>
                  <tr>
                    <td><?= Security::escape($v['version_name']) ?></td>
                    <td><?= (int) $v['version_code'] ?></td>
                    <td><?= $v['published_at'] ? Security::escape(date('M j, Y', strtotime($v['published_at']))) : '—' ?></td>
                    <td><?= number_format((int) $v['download_count']) ?></td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
        </div>

        <div class="admin-card content-card p-4">
          <div class="section-label">Community</div>
          <h3>Ratings &amp; reviews</h3>
          <?php foreach ($reviews as $r): ?>
            <div class="review-card mb-3">
              <div class="d-flex justify-content-between">
                <strong><?= Security::escape($r['reviewer_name']) ?></strong>
                <span class="star-rating"><?= str_repeat('★', (int) $r['rating']) . str_repeat('☆', 5 - (int) $r['rating']) ?></span>
              </div>
              <p class="small text-muted mb-1"><?= Security::escape(date('M j, Y', strtotime($r['created_at']))) ?></p>
              <p class="mb-0"><?= nl2br(Security::escape($r['comment'])) ?></p>
            </div>
          <?php endforeach; ?>
          <?php if (!$reviews): ?><p class="text-muted">No approved reviews yet. Be the first!</p><?php endif; ?>

          <hr>
          <h5>Leave a review</h5>
          <form method="post" class="row g-3">
            <?= csrf_field() ?>
            <input type="hidden" name="form" value="review">
            <input type="text" name="website" value="" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
            <div class="col-md-6"><label class="form-label">Your name</label><input class="form-control" name="reviewer_name" required maxlength="120"></div>
            <div class="col-md-6"><label class="form-label">Rating (1-5)</label><input class="form-control" type="number" min="1" max="5" name="rating" required></div>
            <div class="col-12"><label class="form-label">Comment</label><textarea class="form-control" name="comment" rows="3" required maxlength="2000"></textarea></div>
            <div class="col-md-6"><label class="form-label">Device (optional)</label><input class="form-control" name="device_model"></div>
            <div class="col-md-6"><label class="form-label">App version used (optional)</label><input class="form-control" name="app_version_used"></div>
            <div class="col-12"><button class="btn btn-primary">Submit review</button></div>
          </form>
        </div>
      </div>

      <div class="col-lg-4">
        <div class="admin-card sidebar-card p-4 mb-4 sticky-top" style="top:1rem">
          <h5>App info</h5>
          <ul class="list-unstyled small mb-0">
            <?php if ($latest): ?>
              <li class="mb-2"><strong>Version:</strong> <?= Security::escape($latest['version_name']) ?> (<?= (int) $latest['version_code'] ?>)</li>
              <li class="mb-2"><strong>Size:</strong> <?= format_bytes((int) $latest['file_size']) ?></li>
              <li class="mb-2"><strong>Updated:</strong> <?= $latest['published_at'] ? date('M j, Y', strtotime($latest['published_at'])) : '—' ?></li>
            <?php endif; ?>
            <li class="mb-2"><strong>Compatibility:</strong> Android <?= Security::escape($settings['min_android_version'] ?? '8.0') ?>+</li>
            <li class="mb-2"><strong>Support:</strong> <a href="mailto:<?= Security::escape($settings['support_email'] ?? '') ?>"><?= Security::escape($settings['support_email'] ?? '') ?></a></li>
          </ul>
          <?php if ($latest && empty($settings['website_download_locked'])): ?>
            <a href="<?= Security::escape($downloadUrl) ?>" class="btn btn-download w-100 mt-3">Download latest APK</a>
          <?php endif; ?>
        </div>

        <div class="admin-card sidebar-card p-4 mb-4">
          <h5>Rating breakdown</h5>
          <?php for ($i = 5; $i >= 1; $i--):
            $cnt = $ratingDist[$i] ?? 0;
            $pct = $totalRatings > 0 ? round(($cnt / $totalRatings) * 100) : 0;
          ?>
            <div class="d-flex align-items-center gap-2 mb-1 small">
              <span style="width:12px"><?= $i ?></span>
              <div class="progress flex-grow-1" style="height:8px"><div class="progress-bar" style="width:<?= $pct ?>%"></div></div>
              <span class="text-muted"><?= $cnt ?></span>
            </div>
          <?php endfor; ?>
        </div>

        <div class="admin-card sidebar-card p-4 small">
          <a href="<?= Security::escape($settings['privacy_url'] ?? '#') ?>" target="_blank">Privacy Policy</a> ·
          <a href="<?= Security::escape($settings['terms_url'] ?? '#') ?>" target="_blank">Terms</a>
        </div>
      </div>
    </div>
  </div>
</section>
<?php require BASE_PATH . '/includes/public_footer.php'; ?>
