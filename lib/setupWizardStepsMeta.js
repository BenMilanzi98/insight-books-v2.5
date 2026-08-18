/**
 * Dashboard setup wizard — 5 steps. Keep /setup BusinessSetupWizard separate.
 */
import { SETUP_WIZARD_STEP_THEME } from "@/lib/setupWizard/wizardTheme";

export const SETUP_WIZARD_STEP_DEFS = [
  {
    id: "accountSettings",
    label: "Business & receipts",
    shortLabel: "Account",
    description:
      "Business name, logo, address, banking, TPIN, and receipt defaults — the same fields as Account → Business Info and Receipt Settings.",
    href: "/account?tab=business",
    ...SETUP_WIZARD_STEP_THEME,
    tips: [
      "Upload your logo and set brand colors for invoices and receipts.",
      "Receipt paper width and footer appear on POS and printed receipts.",
    ],
  },
  {
    id: "inventory",
    label: "Inventory / Stock",
    shortLabel: "Stock",
    description:
      "Load opening stock with a bulk workbook or a single product. Quantities, FIFO value, and Opening Balance Equity stay in sync.",
    href: "/stock",
    ...SETUP_WIZARD_STEP_THEME,
    tips: [
      "Download the stock template, fill quantity and order price, then upload.",
      "Or add one opening-stock line. Services do not carry stock.",
    ],
  },
  {
    id: "customers",
    label: "Customers",
    shortLabel: "Customers",
    description: "Import customers from the CSV template or add one now.",
    href: "/clients",
    ...SETUP_WIZARD_STEP_THEME,
    tips: [
      "Use the same bulk-import template as Clients.",
      "You can add more customers later from the Clients page.",
    ],
  },
  {
    id: "suppliers",
    label: "Suppliers",
    shortLabel: "Suppliers",
    description: "Import suppliers or add one vendor for purchases and payables.",
    href: "/suppliers",
    ...SETUP_WIZARD_STEP_THEME,
    tips: [
      "Match supplier names to expense merchants for cleaner reporting.",
      "Skip if you have no vendors yet.",
    ],
  },
  {
    id: "openingBalances",
    label: "Opening account balances",
    shortLabel: "Balances",
    description:
      "Enter opening amounts for existing payment accounts. Each posts Dr cash/bank and Cr Opening Balance Equity (3190).",
    href: "/financial-setup/opening-balances",
    ...SETUP_WIZARD_STEP_THEME,
    tips: [
      "Leave an account blank to skip it.",
      "Opening stock value is posted when you complete the Inventory step.",
    ],
  },
];

export const SETUP_WIZARD_STEP_IDS = SETUP_WIZARD_STEP_DEFS.map((s) => s.id);

export function getSetupStepDef(stepId) {
  const aliases = { clients: "customers", openingStock: "inventory", openingBalancesReview: "openingBalances" };
  const id = aliases[stepId] || stepId;
  return SETUP_WIZARD_STEP_DEFS.find((s) => s.id === id) ?? null;
}
