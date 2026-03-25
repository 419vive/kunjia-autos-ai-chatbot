// No-op shim for katex to eliminate ~600KB of KaTeX JS from the Vite bundle.
// This car dealership chatbot does not need LaTeX math rendering.
export default {
  renderToString() { return ""; },
  render() {},
  __parse() { return {}; },
  ParseError: class ParseError extends Error {},
};
