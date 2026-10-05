# TikZ-CD Preview — Zotero prototype

An independent, offline Zotero 10 plugin for previewing Quiver-compatible
`tikzcd` diagrams, including standalone display-math nodes in notes.
**This is an experimental integration using Zotero's private MathView API.**
LaTeX Suite is unchanged and neither KaTeX nor Zotero needs to be patched.

## Try it

Install `tikzcd-preview-0.2.1.xpi` using Zotero's Plugins window, then choose
**Tools → TikZ-CD Preview…**. Paste a complete `tikzcd` block and click Render
(or Ctrl+Enter / Cmd+Enter). Rendering is explicit, not performed on every key.

```latex
\begin{tikzcd}
A \arrow[r, "f"] \arrow[d, "g"'] & B \arrow[d, "h"] \\
C \arrow[r, "k"'] & D
\end{tikzcd}
```

Alternatively, paste the block above into a **display math node** in a note.
Closed nodes show the diagram; clicking opens Zotero's normal source editor,
with a live diagram preview below it. Changes are debounced by 120 ms, and stale
renders are discarded. Ordinary equations and inline math still use native KaTeX.
LaTeX Suite's duplicate equation preview is hidden for diagram nodes only.

The note retains its original editable LaTeX source, not a generated image.
There is no insertion command, image/PDF export, or portable image fallback yet:
without this plugin, Zotero cannot render the `tikzcd` source. Diagram click-to-source
mapping and preview selection markers are not supported. The standalone Tools
window does not save its source when closed; note sources are saved by Zotero.

## Architecture

- `vendor/quiver`: unmodified sources pinned to upstream commit
  `2f289ecbae9b7e5a473e04b924750c538ed5c4cf`, including MIT license.
- `scripts/extract.mjs`: build-time AST selection of graph/cell/render methods;
  strips editor initialization and dependencies rather than mocking the editor.
  The script asserts expected structures so upstream changes fail visibly.
- `src/renderer.mjs`: a per-render adapter with font readiness, measured grid
  layout, deterministic arrow shortening, cancellation and diagnostics.
- `src/note-integration.mjs`: checked, per-instance MathView hooks route standalone
  diagrams without replacing KaTeX or changing the ProseMirror document. Native
  source editing, undo and saving remain Zotero's responsibility.
- `bootstrap.js`: registers a local preview window, a Tools menu item and a note
  document observer. Disable removes the hooks, cancels renders, restores native
  rendering, removes the menu and closes plugin windows.

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

Note diagrams use a transparent background, centered layout and inherited note
font size and foreground color. Default arrows and labels follow theme changes
without rerendering; explicit non-black Quiver colors are preserved (Quiver treats
black as its theme-adaptive default).

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
node tests/native.mjs --notes
node tests/native.mjs --notes --with-latex
```

`npm test` includes lifecycle/security/resource-limit checks and upstream parser
fixtures. JSDOM tests cannot validate typography. `test:native` launches the
installed Zotero in an isolated temporary profile (not your library), verifies
real geometry and plugin lifecycle, and writes `build/native-preview.png`.

Builds are committed locally; pushing/publishing is a separate explicit step.

Validated on Zotero 10.0.5 (Linux): 40 automated tests, including 24 upstream
valid parser fixtures; native rendering of the example, curved parallel arrows,
loops, hook/epimorphism arrows and fraction/integral labels; repeated-render,
error and disable cleanup. Four small native fixtures took 6–30 ms on this
machine with fonts already loaded; this is not a general performance guarantee.
Native note tests cover opening/editing/closing, unchanged note serialization,
ordinary equations, disable/re-enable, and coexistence with LaTeX Suite.
Other OS versions have not been tested.
