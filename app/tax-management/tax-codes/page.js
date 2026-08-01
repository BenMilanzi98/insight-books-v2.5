import { redirect } from "next/navigation";

export default function TaxCodesRedirectPage() {
  redirect("/tax-management/accounts");
}
