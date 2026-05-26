import { redirect } from 'next/navigation';

/**
 * Primary Android app management has moved to the standalone PHP App Center.
 * Configure NEXT_PUBLIC_APK_CENTER_ADMIN_URL in .env (e.g. https://app.insightinnovationsltd.com/admin/dashboard.php)
 */
export default function MobileAppManagementRedirectPage() {
  const target =
    process.env.NEXT_PUBLIC_APK_CENTER_ADMIN_URL ||
    process.env.APK_CENTER_ADMIN_URL ||
    'https://app.insightinnovationsltd.com/admin/dashboard.php';

  redirect(target);
}
