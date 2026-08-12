/**
 * Dashboard setup wizard — 5 steps. Keep /setup BusinessSetupWizard separate.
 */
export const SETUP_WIZARD_STEP_DEFS = [
  {
    id: "accountSettings",
    label: "Account Settings",
    shortLabel: "Account",
    description: "Confirm business name, contact details, and branding. Only missing fields are required.",
    href: "/settings",
    gradient: "from-sky-600 via-blue-600 to-indigo-600",
    accent: "sky",
    tips: [
      "Prefill comes from your tenant profile — skip anything already set.",
      "These details appear on invoices, receipts, and reports.",
    ],
  },
  {
    id: "inventory",
    label: "Inventory / Stock",
    shortLabel: "Stock",
    description: "Load opening stock with a bulk workbook or a single product. Quantities, FIFO value, and Opening Balance Equity stay in sync.",
    href: "/stock",
    gradient: "from-cyan-600 via-teal-600 to-emerald-600",
    accent: "cyan",
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
    gradient: "from-rose-500 via-pink-600 to-fuchsia-600",
    accent: "rose",
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
    gradient: "from-lime-600 via-green-600 to-emerald-600",
    accent: "lime",
    tips: [
      "Match supplier names to expense merchants for cleaner reporting.",
      "Skip if you have no vendors yet.",
    ],
  },
  {
    id: "openingBalances",
    label: "Opening account balances",
    shortLabel: "Balances",
    description: "Enter opening amounts for existing payment accounts. Each posts Dr cash/bank and Cr Opening Balance Equity (3190).",
    href: "/financial-setup/opening-balances",
    gradient: "from-indigo-600 via-violet-600 to-purple-600",
    accent: "indigo",
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
