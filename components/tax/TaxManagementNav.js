"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n/I18nProvider";

const NAV_ITEMS = [
  { href: "/tax-management", labelKey: "navigation.dashboard", exact: true },
  { href: "/tax-management/tax-codes", labelKey: "navigation.taxCodes" },
  { href: "/tax-management/accounts", labelKey: "navigation.taxAccounts" },
  { href: "/tax-management/transactions", labelKey: "navigation.taxTransactions" },
  { href: "/tax-management/periods", labelKey: "navigation.taxPeriods" },
  { href: "/tax-management/returns", labelKey: "navigation.taxReturns" },
  { href: "/tax-management/payments", labelKey: "navigation.taxPayments" },
  { href: "/tax-management/refunds", labelKey: "navigation.taxRefunds" },
  { href: "/tax-management/credits", labelKey: "navigation.taxCredits" },
  { href: "/tax-management/withholding", labelKey: "navigation.taxWithholding" },
  { href: "/tax-management/reconciliation", labelKey: "navigation.taxReconciliation" },
  { href: "/tax-management/reports", labelKey: "navigation.reports" },
  { href: "/tax-management/import-export", labelKey: "navigation.importExport" },
  { href: "/tax-management/settings", labelKey: "navigation.settings" },
];

function isActive(pathname, href, exact) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function TaxManagementNav() {
  const pathname = usePathname() || "";
  const { t } = useI18n();

  return (
    <nav
      aria-label={t("navigation.taxManagement")}
      className="mb-4 overflow-x-auto border-b border-[var(--border-default)]"
    >
      <ul className="flex min-w-max gap-1 px-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href, item.exact);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`inline-flex whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "border-b-2 border-[var(--brand-primary)] text-[var(--brand-primary)]"
                    : "border-b-2 border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
