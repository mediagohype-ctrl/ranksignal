// WordPress descriptor wrapping the existing connector (behaviour unchanged). Secrets use the same
// JSON shape the registry already decrypts: {username, applicationPassword}.
import { ConnectorConfigError, type ConnectorDescriptor } from "@/lib/connectors/catalog/types";
import { WORDPRESS_CAPABILITIES, WordPressConnector } from "@/lib/connectors/wordpress";

export interface WordPressDescriptorConfig {
  siteUrl: string;
  username: string;
}
export interface WordPressDescriptorSecrets {
  username: string;
  applicationPassword: string;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export const descriptor: ConnectorDescriptor<WordPressDescriptorConfig, WordPressDescriptorSecrets> = {
  id: "wordpress",
  family: "CMS",
  name: "WordPress",
  status: "available",
  description: "Read pages/posts, update titles, excerpts and (where registered) meta descriptions; create drafts; rollback via before-state.",
  capabilities: WORDPRESS_CAPABILITIES,
  connectFields: [
    { key: "siteUrl", label: "Website address", type: "url", placeholder: "https://example.com", help: "Your WordPress site's home page." },
    { key: "username", label: "WordPress username", type: "text", help: "The username you sign in with (not your email)." },
    { key: "applicationPassword", label: "Application Password", type: "password", help: "Paste the password WordPress generated. Spaces are fine." },
  ],
  setupSteps: [
    "Sign in to WordPress as a user who can edit pages and posts.",
    "Go to Users → Profile and scroll to “Application Passwords”.",
    "Type a name (for example “RankSignal”) and click “Add New Application Password”.",
    "Copy the password WordPress shows and paste it here with your username. You can revoke it at any time.",
  ],
  validateConfig(input) {
    const raw = str(input.siteUrl).replace(/\/+$/, "");
    try {
      const u = new URL(raw);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("scheme");
    } catch {
      throw new ConnectorConfigError("Enter your WordPress site's address, e.g. https://example.com.", "siteUrl");
    }
    const username = str(input.username);
    if (!username || username.length > 200) throw new ConnectorConfigError("Enter your WordPress username.", "username");
    const applicationPassword = str(input.applicationPassword);
    if (applicationPassword.length < 8 || applicationPassword.length > 200) {
      throw new ConnectorConfigError("Paste the Application Password WordPress generated.", "applicationPassword");
    }
    return { config: { siteUrl: raw, username }, secrets: { username, applicationPassword } };
  },
  create(config, secrets) {
    return new WordPressConnector({
      siteUrl: String((config as Partial<WordPressDescriptorConfig>)?.siteUrl ?? ""),
      username: secrets.username,
      applicationPassword: secrets.applicationPassword,
    });
  },
};
