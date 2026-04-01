// components/PermissionGuard.js
"use client";

import { useEffect, useState } from "react";
import { checkPermission } from "@/lib/permissions";

export default function PermissionGuard({ permission, children }) {
  const [allowed, setAllowed] = useState(null);

  useEffect(() => {
    let mounted = true;

    checkPermission(permission)
      .then((result) => {
        if (mounted) {
          if (!result) {
            console.warn(`Access denied: Missing permission '${permission}'`);
            // Instead of redirecting, show access denied message
            setAllowed(false);
          } else {
            setAllowed(true);
          }
        }
      })
      .catch((error) => {
        console.error('Permission check failed:', error);
        if (mounted) {
          // Fail closed: never broaden access on auth/permission check failures.
          setAllowed(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [permission]);

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
