// components/PermissionGuard.js
"use client";

import { useEffect, useState } from "react";
import { checkPermission } from "@/lib/permissions";

/**
 * @param {{
 *   permission?: string,
 *   requiredPermission?: string,
 *   permissions?: string[],
 *   children: import('react').ReactNode,
 * }} props
 * If `permissions` is set, the user needs **any one** of those permissions (OR).
 * Otherwise a single permission from `permission` or legacy alias `requiredPermission` is required.
 */
export default function PermissionGuard({ permission, requiredPermission, permissions, children }) {
  const [allowed, setAllowed] = useState(null);

  const singlePerm = permission || requiredPermission;
  const permList =
    Array.isArray(permissions) && permissions.length > 0
      ? permissions
      : singlePerm
        ? [singlePerm]
        : [];

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        let ok = false;
        for (const p of permList) {
          if (await checkPermission(p)) {
            ok = true;
            break;
          }
        }
        if (mounted) {
          if (!ok) {
            console.warn(`Access denied: Missing one of [${permList.join(", ")}]`);
            setAllowed(false);
          } else {
            setAllowed(true);
          }
        }
      } catch (error) {
        console.error("Permission check failed:", error);
        if (mounted) {
          setAllowed(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [JSON.stringify(permList)]);

  if (allowed === null) return null; // Loading state
  if (allowed === false) {
    // Show access denied message instead of redirecting
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <h3 className="text-lg font-medium text-red-800 mb-2">Access Denied</h3>
        <p className="text-red-600">You don't have permission to access this feature.</p>
      </div>
    );
  }

  return children;
}
