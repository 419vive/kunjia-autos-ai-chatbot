// No-op shim for rehype-katex to eliminate ~600KB of KaTeX JS from the bundle.
// This car dealership chatbot does not need LaTeX math rendering.
export default function rehypeKatexNoop() {
  return function (tree) {
    return tree;
  };
}
