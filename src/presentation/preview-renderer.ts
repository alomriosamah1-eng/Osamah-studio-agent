import type { PreviewRenderNode } from "../mobile/preview-runtime.js";

export interface PreviewRenderTarget {
  innerHTML: string;
}

const MAX_RENDER_DEPTH = 32;

export const renderPreviewNode = (node: PreviewRenderNode, depth = 0): string => {
  if (depth > MAX_RENDER_DEPTH) throw new Error(`Preview render tree exceeds depth limit of ${MAX_RENDER_DEPTH}.`);
  const tag = tagFor(node.type);
  const attributes = [
    `class="preview-node preview-node-${node.type}"`,
    `data-preview-type="${escapeAttribute(node.type)}"`,
    ...renderProps(node.props),
  ].join(" ");
  const text = node.text === undefined ? "" : escapeText(node.text);
  const children = (node.children ?? []).map((child) => renderPreviewNode(child, depth + 1)).join("");
  return `<${tag} ${attributes}>${text}${children}</${tag}>`;
};

export const renderPreviewTree = (root: PreviewRenderNode, target: PreviewRenderTarget): string => {
  const html = renderPreviewNode(root);
  target.innerHTML = html;
  return html;
};

const tagFor = (type: PreviewRenderNode["type"]): "section" | "span" | "article" | "output" => {
  if (type === "view") return "section";
  if (type === "text") return "span";
  if (type === "card") return "article";
  return "output";
};

const renderProps = (props: Readonly<Record<string, string>> | undefined): string[] => Object.entries(props ?? {})
  .sort(([left], [right]) => left.localeCompare(right))
  .flatMap(([key, value]) => {
    const safeKey = key.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    return safeKey ? [`data-preview-prop-${safeKey}="${escapeAttribute(value)}"`] : [];
  });

const escapeText = (value: string): string => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const escapeAttribute = (value: string): string => escapeText(value).replaceAll('"', "&quot;");
