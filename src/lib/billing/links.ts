// In-app links to Billing (pure constants; safe in server and client components).
//
// Every "Upgrade" button goes to UPGRADE_HREF: the Billing & usage tab, scrolled to the plan cards — Do it myself,
// Do it for me ("Book a free call") and Custom ("Talk to us"). SettingsTabs scrolls to the #plans section.

/** Billing & usage tab (top of the tab: answers left, extra answers). */
export const BILLING_HREF = "/app/settings?tab=billing";

/** Id of the plans section on the Billing & usage tab. */
export const PLANS_SECTION_ID = "plans";

/** Billing & usage tab, scrolled to the plan cards. Where every "Upgrade" button leads. */
export const UPGRADE_HREF = `${BILLING_HREF}#${PLANS_SECTION_ID}`;

/** Billing details form on the Billing & usage tab (business name, state, GSTIN). */
export const BILLING_DETAILS_HREF = `${BILLING_HREF}#billing-details`;
