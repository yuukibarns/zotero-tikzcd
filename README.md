# TikZ-CD Preview — Zotero prototype

An independent, offline Zotero 10 plugin for previewing Quiver-compatible
`tikzcd` diagrams. **This is a renderer experiment, not yet note integration.**
LaTeX Suite is unchanged and neither KaTeX nor Zotero needs to be patched.

## Try it

Install `tikzcd-preview-0.1.0.xpi` using Zotero's Plugins window, then choose
**Tools → TikZ-CD Preview…**. Paste a complete `tikzcd` block and click Render
(or Ctrl+Enter / Cmd+Enter). Rendering is explicit, not performed on every key.

```latex
\begin{tikzcd}
A \arrow[r, "f"] \arrow[d, "g"'] & B \arrow[d, "h"] \\
C \arrow[r, "k"'] & D
\end{tikzcd}
```

It does not read/write your library, insert diagrams into notes, replace native
math rendering, export images/PDF, or persist the source when the window closes.
Keep your source separately. Those are follow-up features, not implicit behaviour.

## Architecture

- `vendor/quiver`: unmodified sources pinned to upstream commit
  `2f289ecbae9b7e5a473e04b924750c538ed5c4cf`, including MIT license.
- `scripts/extract.mjs`: build-time AST selection of graph/cell/render methods;
  strips editor initialization and dependencies rather than mocking the editor.
  The script asserts expected structures so upstream changes fail visibly.
- `src/renderer.mjs`: a per-render adapter with font readiness, measured grid
  layout, deterministic arrow shortening, cancellation and diagnostics.
- `bootstrap.js`: only registers a local preview window and a Tools menu item.
  Disable/uninstall removes the menu and closes plugin windows.

The extraction is a local render-only derivative, not a public upstream fork.
Nothing is published automatically. Upstream: <https://github.com/varkor/quiver>.
Build artifacts contain only the required rendering modules, KaTeX and local
fonts—not Quiver's editor, Typst engine, CDN loaders, or application listeners.

## Compatibility and safety

This renders Quiver's supported **subset**, not arbitrary TikZ or pixel-identical
LaTeX. Upstream ignores diagram spacing and `cramped`; the prototype reports
warnings for these options. Unknown options are also reported. Curvature and
physical lengths can be approximate. Quiver-style explicit loop options work,
e.g. `loop,in=55,out=125`, not the TikZ shorthand `loop above`.

Follow Quiver's label syntax: put spaces/newlines around `&`, `\\`, and
`\end{tikzcd}`, or brace labels. The upstream unbraced-label parser is whitespace
based. Custom macro definitions, remote images, links and raw HTML are not enabled.
KaTeX is pinned to 0.16.22 with `trust: false`, fresh macro state and expansion
limits. Source is capped at 20,000 characters, 200 cells and bounded coordinates.
These are resource safeguards, not a claim of resistance to every adversarial
input. Rendering runs in a browser document and requires real font/layout metrics.

For now diagrams use a white background with dark labels, including in dark
Zotero themes. The editor UI follows the system theme.

Zotero requires an `update_url` even for local prototypes. This build uses the
reserved `example.invalid` domain; **automatic updates are unavailable** until
a real repository/release feed is configured.

## Development

```sh
npm ci
npm run build
npm test
npm run package
npm run test:native
```

`npm test` includes lifecycle/security/resource-limit checks and upstream parser
fixtures. JSDOM tests cannot validate typography. `test:native` launches the
installed Zotero in an isolated temporary profile (not your library), verifies
real geometry and plugin lifecycle, and writes `build/native-preview.png`.

Builds are committed locally; pushing/publishing is a separate explicit step.
