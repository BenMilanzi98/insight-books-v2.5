import { redirect } from "next/navigation";

export default function TaxAccountsRedirectPage() {
  redirect("/tax-management/accounts?tab=balances");
}
