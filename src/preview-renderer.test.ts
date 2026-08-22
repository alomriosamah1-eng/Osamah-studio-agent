import assert from "node:assert/strict";
import test from "node:test";
import type { PreviewRenderNode } from "./mobile/preview-runtime.js";
import { renderPreviewNode, renderPreviewTree } from "./presentation/preview-renderer.js";

test("presentation renderer mounts a PreviewRenderNode tree with safe escaped markup", () => {
  const target = { innerHTML: "" };
  const html = renderPreviewTree({
    type: "view",
    props: { zeta: "last", role: "screen", unsafe: '" onclick="alert(1)' },
    children: [
      { type: "text", text: "<script>alert(1)</script> & ready", props: { role: "heading" } },
      { type: "card", text: "Preview session", props: { status: "ready" } },
    ],
  }, target);
  assert.equal(target.innerHTML, html);
  assert.match(html, /<section class="preview-node preview-node-view"/);
  assert.match(html, /data-preview-prop-role="screen"/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; ready/);
  assert.match(html, /&quot; onclick=&quot;alert\(1\)/);
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.indexOf("data-preview-prop-role") < html.indexOf("data-preview-prop-unsafe"), true);
  assert.equal(html.indexOf("data-preview-prop-unsafe") < html.indexOf("data-preview-prop-zeta"), true);
});

test("presentation renderer maps semantic node types and enforces render depth", () => {
  assert.match(renderPreviewNode({ type: "text", text: "hello" }), /^<span /);
  assert.match(renderPreviewNode({ type: "card", text: "card" }), /^<article /);
  assert.match(renderPreviewNode({ type: "status", text: "ready" }), /^<output /);

  let deepTree: PreviewRenderNode = { type: "text", text: "leaf" };
  for (let index = 0; index < 33; index += 1) deepTree = { type: "view", children: [deepTree] };
  assert.throws(() => renderPreviewNode(deepTree), /depth limit/);
});
