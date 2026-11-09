// Legal entity + contact details shown on the Privacy Policy, Terms and footer.
// TODO(legal): every value marked TODO is a placeholder — replace with the registered details before launch.
import { BRAND, brandAddressLine } from "@/lib/brand";

/** TODO(legal): registered legal name of the company that runs the service. */
export const LEGAL_ENTITY = "Go Hype Media";

/**
 * Registered office address (as on GST / company registration), from BRAND_ADDRESS_* — the same values as
 * Organization.address. Empty string when unset: pages must then render nothing for it.
 */
export const LEGAL_ADDRESS = brandAddressLine();

/** Where people send privacy, deletion and legal requests. TODO(legal): confirm the inbox. */
export const LEGAL_EMAIL = BRAND.supportEmail;

/** Grievance Officer under the DPDP Act 2023 / IT Rules 2011. TODO(legal): name the person. */
export const GRIEVANCE_OFFICER = "TODO: Grievance Officer name";

/** Courts with jurisdiction over disputes. TODO(legal): confirm the city. */
export const JURISDICTION_CITY = "TODO: city";

/** Date shown as "Last updated" on the Privacy Policy and Terms. */
export const LEGAL_UPDATED = "4 November 2026";
