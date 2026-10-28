import { redirect } from "next/navigation";

// Notification links point here; billing lives in the Billing & usage tab of settings.
export default function BillingRedirect() {
  redirect("/app/settings?tab=billing");
}
