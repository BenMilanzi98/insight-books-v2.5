/**
 * Setup wizard steps — client-safe metadata (no server imports).
 * Keep derived completion logic in setupWizardService.js in sync with these ids.
 */
export const SETUP_WIZARD_STEP_DEFS = [
  {
    id: "startingDate",
    label: "Starting date",
    shortLabel: "Start date",
    description:
      "Choose the date your books begin — all opening balances and onboarding journals use this as-of date.",
    href: "/financial-setup/opening-balances",
    gradient: "from-slate-600 via-gray-600 to-zinc-600",
    accent: "slate",
    tips: [
      "Use the first day you start tracking in Insight Books (often the first day of your fiscal year).",
      "You can adjust this before any accounting period is closed.",
    ],
  },
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
    href: "/tax-management/tax-codes",
    gradient: "from-fuchsia-600 via-purple-600 to-violet-600",
    accent: "fuchsia",
    tips: [
      "Run “Sync MRA Catalog” on Tax codes under Tax Management.",
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
  {
    id: "openingStock",
    label: "Opening stock",
    shortLabel: "Stock",
    description:
      "Add products and record opening quantities and costs so inventory, COGS, and the balance sheet (1310 Stock on Hand) are correct from day one.",
    href: "/stock?setup=openingStock",
    gradient: "from-cyan-600 via-teal-600 to-emerald-600",
    accent: "cyan",
    tips: [
      "Create each product with opening quantity and unit cost, or use Stock In on existing products.",
      "Opening stock posts to inventory (1310) — use your accountant’s valuation if migrating from another system.",
      "Services do not carry stock; skip this step if you only sell services.",
    ],
  },
  {
    id: "openingBalancesReview",
    label: "Review opening balances",
    shortLabel: "Review",
    description:
      "Review posted opening stock, cash, receivables, payables, and bulk COA entries — balanced via Opening Balance Equity (3190).",
    href: "/financial-setup/opening-balances",
    gradient: "from-indigo-600 via-violet-600 to-purple-600",
    accent: "indigo",
    tips: [
      "Use Financial Setup → Opening Balances for bulk COA entry or export a summary for your accountant.",
      "Opening balances lock automatically after the first accounting period close.",
    ],
  },
];

export const SETUP_WIZARD_STEP_IDS = SETUP_WIZARD_STEP_DEFS.map((s) => s.id);

export function getSetupStepDef(stepId) {
  return SETUP_WIZARD_STEP_DEFS.find((s) => s.id === stepId) ?? null;
}
