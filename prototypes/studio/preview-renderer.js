(() => {
  const MAX_RENDER_DEPTH = 32;

  const renderPreviewNode = (node, depth = 0) => {
    if (depth > MAX_RENDER_DEPTH) throw new Error(`Preview render tree exceeds depth limit of ${MAX_RENDER_DEPTH}.`);
    const tag = node.type === 'view' ? 'section' : node.type === 'text' ? 'span' : node.type === 'card' ? 'article' : 'output';
    const attributes = [
      `class="preview-node preview-node-${node.type}"`,
      `data-preview-type="${escapeAttribute(node.type)}"`,
      ...renderProps(node.props),
    ].join(' ');
    const text = node.text === undefined ? '' : escapeText(node.text);
    const children = (node.children || []).map((child) => renderPreviewNode(child, depth + 1)).join('');
    return `<${tag} ${attributes}>${text}${children}</${tag}>`;
  };

  const renderPreviewTree = (root, target) => {
    const html = renderPreviewNode(root);
    target.innerHTML = html;
    return html;
  };

  const renderProps = (props) => Object.entries(props || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([key, value]) => {
      const safeKey = key.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      return safeKey ? [`data-preview-prop-${safeKey}="${escapeAttribute(value)}"`] : [];
    });

  const escapeText = (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const escapeAttribute = (value) => escapeText(value).replaceAll('"', '&quot;');

  window.OsamahPreviewRenderer = Object.freeze({ renderPreviewNode, renderPreviewTree });
})();
