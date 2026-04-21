/**
 * Wizard step order and links (no server-only imports). Keep in sync with labels in setupWizardService.
 */
export const SETUP_WIZARD_STEP_DEFS = [
  {
    id: "openingBalances",
    label: "Opening balances",
    description: "Set opening balances as of your start date (posts to the general ledger).",
    href: "/financial-setup/opening-balances",
  },
  {
    id: "fiscalYear",
    label: "Fiscal year",
    description: "Choose the first month of your financial year (used when creating yearly periods).",
    href: "/setup",
  },
  {
    id: "paymentAccounts",
    label: "Payment accounts",
    description: "Cash, bank, and mobile money accounts linked to your chart of accounts.",
    href: "/payments/management",
  },
  {
    id: "capital",
    label: "Capital account",
    description: "Owner's capital and equity structure.",
    href: "/capital-account",
  },
  {
    id: "transfers",
    label: "Transfer funds",
    description: "Move funds from capital to your operating payment accounts.",
    href: "/capital-account?showTransferModal=true",
  },
  {
    id: "taxAccounts",
    label: "Tax accounts",
    description: "Default GL accounts for tax collected and tax paid.",
    href: "/tax-types",
  },
  {
    id: "clients",
    label: "Client management (A/R)",
    description: "Add customers you invoice (receivables use your standard A/R account).",
    href: "/clients",
  },
  {
    id: "suppliers",
    label: "Supplier management (A/P)",
    description: "Add suppliers you purchase from (payables use your standard A/P account).",
    href: "/suppliers",
  },
];
