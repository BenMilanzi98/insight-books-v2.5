<?php
declare(strict_types=1);

require_once dirname(__DIR__) . '/bootstrap.php';

admin_logout();
\App\Helpers\Response::redirect(base_url('admin/login.php'));
