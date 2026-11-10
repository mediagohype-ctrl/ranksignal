// Minimal DOM for testing the extension's page reader without jsdom: parse an HTML string with cheerio
// (already a site dependency) and expose only the DOM members collectPage uses — documentElement,
// nodeType, tagName, nodeValue, childNodes, getAttribute and textContent.
import * as cheerio from "cheerio";

interface ParsedNode {
  type: string;
  name?: string;
  data?: string;
  attribs?: Record<string, string>;
  children?: ParsedNode[];
}

export interface MiniNode {
  nodeType: number;
  tagName?: string;
  nodeValue: string | null;
  childNodes: MiniNode[];
  getAttribute(name: string): string | null;
  readonly textContent: string;
}

function convert(n: ParsedNode): MiniNode | null {
  const isElement = n.type === "tag" || n.type === "script" || n.type === "style";
  if (n.type === "text") {
    return { nodeType: 3, nodeValue: n.data ?? "", childNodes: [], getAttribute: () => null, textContent: n.data ?? "" };
  }
  if (!isElement) return null;
  const childNodes = (n.children ?? []).map(convert).filter((c): c is MiniNode => c !== null);
  const attribs = n.attribs ?? {};
  return {
    nodeType: 1,
    tagName: (n.name ?? "").toUpperCase(),
    nodeValue: null,
    childNodes,
    getAttribute: (name: string) => (Object.prototype.hasOwnProperty.call(attribs, name.toLowerCase()) ? attribs[name.toLowerCase()] : null),
    get textContent() {
      return childNodes.map((c) => c.textContent).join("");
    },
  };
}

export function parseHtml(html: string): { documentElement: MiniNode | null } {
  const $ = cheerio.load(html);
  const root = $.root()[0] as unknown as ParsedNode;
  const htmlEl = (root.children ?? []).find((c) => c.type === "tag" && c.name === "html");
  return { documentElement: htmlEl ? convert(htmlEl) : null };
}
