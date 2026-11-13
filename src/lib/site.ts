// Legal entity + contact details shown on the Privacy Policy, Terms and footer. Confirmed by the owner, Nov 2026.
import { BRAND, brandAddressLine } from "@/lib/brand";

/** Legal name of the business that runs the service (as on the GST certificate). */
export const LEGAL_ENTITY = "Go Hype Media";

/**
 * Registered office address (as on GST / company registration), from BRAND_ADDRESS_* — the same values as
 * Organization.address. Empty string when unset: pages must then render nothing for it.
 */
export const LEGAL_ADDRESS = brandAddressLine();

/** Where people send privacy, deletion and legal requests. */
export const LEGAL_EMAIL = BRAND.supportEmail;

/** Grievance Officer under the DPDP Act 2023 / IT Rules 2011. */
export const GRIEVANCE_OFFICER = "Gourav Gupta";

/** Courts with jurisdiction over disputes. */
export const JURISDICTION_CITY = "New Delhi";

/** Date shown as "Last updated" on the Privacy Policy and Terms. */
export const LEGAL_UPDATED = "13 November 2026";
