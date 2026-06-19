/**
 * Setup wizard steps — client-safe metadata (no server imports).
 * Keep derived completion logic in setupWizardService.js in sync with these ids.
 */
export const SETUP_WIZARD_STEP_DEFS = [
  {
    id: "capital",
    label: "Capital & equity",
    shortLabel: "Capital",
    description:
      "Configure owner’s capital (3100) and equity accounts so contributions, withdrawals, and transfers post correctly.",
    href: "/capital-account",
    gradient: "from-violet-600 via-indigo-600 to-blue-600",
    accent: "violet",
    tips: [
      "Link your primary capital account to the chart of accounts (3100).",
      "Record opening owner contributions before moving cash to bank accounts.",
    ],
  },
  {
    id: "assets",
    label: "Fixed assets",
    shortLabel: "Assets",
    description:
      "Register vehicles, equipment, and property so depreciation and balance sheet reports stay accurate.",
    href: "/asset-management",
    gradient: "from-emerald-600 via-teal-600 to-cyan-600",
    accent: "emerald",
    tips: [
      "Add at least one asset category if prompted.",
      "Set purchase date and cost for depreciation schedules.",
    ],
  },
  {
    id: "liabilities",
    label: "Liabilities & loans",
    shortLabel: "Liabilities",
    description:
      "Track loans, hire purchase, and other obligations with payment schedules and GL links.",
    href: "/liability-management",
    gradient: "from-orange-500 via-amber-500 to-yellow-500",
    accent: "orange",
    tips: [
      "Create liability categories that match your financing types.",
      "Link each liability to the correct balance sheet account.",
    ],
  },
  {
    id: "paymentAccounts",
    label: "Payment accounts",
    shortLabel: "Payments",
    description:
      "Set up cash, bank, and mobile money wallets — each linked to a GL account for reconciliations.",
    href: "/payments/management",
    gradient: "from-sky-600 via-blue-600 to-indigo-600",
    accent: "sky",
    tips: [
      "Every active payment account needs a chart-of-accounts link.",
      "Use separate accounts for cash vs bank vs mobile money when possible.",
    ],
  },
  {
    id: "taxes",
    label: "Taxes (MRA)",
    shortLabel: "Taxes",
    description:
      "Sync Malawi MRA tax types, default VAT rate, and GL accounts for tax collected and paid.",
    href: "/tax-types",
    gradient: "from-fuchsia-600 via-purple-600 to-violet-600",
    accent: "fuchsia",
    tips: [
      "Run “Sync MRA Catalog” on the tax types page.",
      "Customize rates later if your accountant advises different treatment.",
    ],
  },
  {
    id: "clients",
    label: "Clients (A/R)",
    shortLabel: "Clients",
    description:
      "Add customers you invoice and sell to — receivables flow through your standard A/R account.",
    href: "/clients",
    gradient: "from-rose-500 via-pink-600 to-fuchsia-600",
    accent: "rose",
    tips: [
      "Import or add your top customers first.",
      "Client records power invoices, POS credit sales, and ageing reports.",
    ],
  },
  {
    id: "suppliers",
    label: "Suppliers (A/P)",
    shortLabel: "Suppliers",
    description:
      "Add vendors and suppliers for purchases, expenses, and payables tracking.",
    href: "/suppliers",
    gradient: "from-lime-600 via-green-600 to-emerald-600",
    accent: "lime",
    tips: [
      "Match supplier names to expense merchants for cleaner reporting.",
      "Use supplier records on purchase orders and bills.",
    ],
  },
];

export const SETUP_WIZARD_STEP_IDS = SETUP_WIZARD_STEP_DEFS.map((s) => s.id);

export function getSetupStepDef(stepId) {
  return SETUP_WIZARD_STEP_DEFS.find((s) => s.id === stepId) ?? null;
}
