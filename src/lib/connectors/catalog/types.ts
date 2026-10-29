// Connector plugin contract (ROUND 5 brief). Every connector exports
//   export const descriptor: ConnectorDescriptor<MyConfig, MySecrets>
// from src/lib/connectors/catalog/<id>.ts. The generic connect route
// (POST /api/integrations/<id>/connect) and the registry consume only this shape.
import type { Connector, ConnectorCapabilities } from "@/lib/types";

export interface ConnectField {
  /** Body key sent to the connect route (and passed to validateConfig). */
  key: string;
  label: string;
  type: "text" | "password" | "url";
  /** Plain-English help shown under the field. */
  help: string;
  /** Defaults to true. */
  required?: boolean;
  placeholder?: string;
}

/** Extra context the connect route / registry can supply. */
export interface ConnectorContext {
  organizationId?: string;
  integrationId?: string;
  projectId?: string;
  /** The project's website URL (used as a default where a connector needs a public site URL). */
  projectWebsiteUrl?: string;
}

/**
 * Generic over the connector's non-secret config C (stored in Integration.config) and secrets S
 * (encrypted as JSON into Integration.credentialEncrypted). Defaults to `unknown` so descriptors of
 * different connectors fit in one `ConnectorDescriptor[]`.
 */
export interface ConnectorDescriptor<C = unknown, S = unknown> {
  id: string;
  family: string;
  name: string;
  status: "available";
  description: string;
  capabilities: ConnectorCapabilities;
  connectFields: ConnectField[];
  /** Numbered setup instructions shown next to the connect form (plain English). */
  setupSteps: string[];
  /**
   * Build a live connector. Called by the connect route with validateConfig's output, and by the
   * registry with the STORED config (Integration.config, which may carry extra keys such as
   * `identity`) and the decrypted secrets — implementations must re-check what they rely on.
   */
  create(config: C, secrets: S, context?: ConnectorContext): Connector;
  /**
   * Validate untrusted form input and split it into non-secret config and secrets.
   * Throw ConnectorConfigError (preferred) or a ZodError on invalid input. Config must never
   * contain secret values: the connect route stores it in plain JSON and returns it to clients.
   */
  validateConfig(input: Record<string, unknown>, context?: ConnectorContext): { config: C; secrets: S };
}

/** Client-safe (serialisable) part of a descriptor, for the generic connect form. */
export type PublicConnectorDescriptor = Pick<
  ConnectorDescriptor, "id" | "family" | "name" | "status" | "description" | "capabilities" | "connectFields" | "setupSteps"
>;

export function publicDescriptor<C, S>(d: ConnectorDescriptor<C, S>): PublicConnectorDescriptor {
  const { id, family, name, status, description, capabilities, connectFields, setupSteps } = d;
  return { id, family, name, status, description, capabilities, connectFields, setupSteps };
}

/** Invalid connect-form input. `field` names the ConnectField key at fault (when known). */
export class ConnectorConfigError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = "ConnectorConfigError";
  }
}
