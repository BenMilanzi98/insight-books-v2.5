<?php
require_once dirname(__DIR__) . '/bootstrap.php';

\App\Helpers\Response::redirect(
    admin_logged_in()
        ? base_url('admin/dashboard.php')
        : base_url('admin/login.php')
);
