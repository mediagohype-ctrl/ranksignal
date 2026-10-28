// Client-safe Integration view: never includes credentialEncrypted or any secret.
import type { Integration } from "@prisma/client";

export function publicIntegration(i: Integration) {
  return {
    id: i.id,
    projectId: i.projectId,
    provider: i.provider,
    health: i.health,
    capabilities: i.capabilities,
    config: i.config,
    scopes: i.scopes,
    connectorVersion: i.connectorVersion,
    connected: Boolean(i.credentialEncrypted) || i.provider === "manual",
    connectedBy: i.connectedBy,
    lastSyncAt: i.lastSyncAt,
    createdAt: i.createdAt,
  };
}
