// Every token/credential-based connector descriptor, keyed by provider id. The registry, the generic
// connect route and the integrations page all read from here, so a new connector is wired by adding it once.
import type { ConnectorDescriptor } from "./types";
import { descriptor as wordpress } from "./wordpress";
import { descriptor as github } from "./github";
import { descriptor as shopify } from "./shopify";
import { descriptor as webflow } from "./webflow";
import { descriptor as contentful } from "./contentful";
import { descriptor as sanity } from "./sanity";
import { descriptor as wix } from "./wix";

export const CONNECTOR_DESCRIPTORS: Record<string, ConnectorDescriptor> = Object.fromEntries(
  [wordpress, github, shopify, webflow, contentful, sanity, wix].map((d) => [d.id, d as ConnectorDescriptor]),
);

export function getDescriptor(provider: string): ConnectorDescriptor | undefined {
  return CONNECTOR_DESCRIPTORS[provider];
}
