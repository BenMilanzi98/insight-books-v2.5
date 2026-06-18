import { redirect } from "next/navigation";

/** Legacy route — business settings live on Account. */
export default function BusinessSetupPage() {
  redirect("/account?tab=business");
}
