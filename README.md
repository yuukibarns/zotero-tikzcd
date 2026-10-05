# TikZ-CD renderer for Zotero

An independent, offline Zotero 10 plugin that renders Quiver-compatible `tikzcd`
diagrams in **closed display-math nodes**. Experimental: this uses Zotero's
private MathView API, with checks for the expected interface.

## Usage

Install `tikzcd-preview-0.2.8.xpi`, then paste a complete block into a display-math
node in a note:

```latex
\begin{tikzcd}
A \arrow[r, "f"] \arrow[d, "g"'] & B \arrow[d, "h"] \\
C \arrow[r, "k"'] & D
\end{tikzcd}
```

Leave the source editor to render. Opening it shows the native source editor,
without a live diagram preview. Ordinary equations retain native rendering.
There is no Tools-menu button or standalone preview window. No LaTeX Suite
update is required; its optional generic preview is hidden for diagram nodes
to avoid displaying stale content.

Zotero saves the source unchanged. There is no image fallback,
visual editor or diagram caret/selection mapping. Without this plugin Zotero
cannot render `tikzcd`; use an exported Quiver image when portability matters.
For visual editing, use [Quiver](https://q.uiver.app/).

PDF export works through the independent Note PDF Export plugin's **Print / PDF** action. It renders
a fresh diagram snapshot (including when source is open), embeds renderer styles,
and preserves SVG mask references. Both light and dark export themes inherit
their normal colors. Unsupported/invalid diagrams stop export with an error.
This is export-only integration; live preview remains disabled.

## Implementation and limitations

- Render-only extraction of [Quiver](https://github.com/varkor/quiver), pinned to
  `2f289ecbae9b7e5a473e04b924750c538ed5c4cf`. MIT sources: `vendor/quiver`.
- KaTeX renders labels. Zotero supplies existing note styles and fonts.
- Layout uses Quiver's 26px coordinate system, then scales the complete diagram
  to the surrounding note font size. Bounds have no added padding or vertical margin.
- Per-node hooks preserve native editing, undo and saving. Async rendering is
  cancelled on editing, replacement, removal or shutdown.
- Transparent backgrounds/default colors inherit the note theme. Explicit
  non-black colors remain unchanged; Quiver treats black as its adaptive default.
- The package contains only bootstrap, the note bundle, manifest and licenses.

Supports Quiver's subset, not arbitrary TikZ. Unsupported options report
diagnostics. Use explicit loop options such as `loop,in=55,out=125`, and spaces
around cell/row separators or braced labels. Custom macros, remote images, raw
HTML and links are not enabled. KaTeX uses `trust:false`, fresh macros and
expansion limits. Resource bounds: 20,000 source characters, 200 cells, bounded
coordinates and 16,000px dimensions. These are safeguards, not a guarantee for
all adversarial input.

Automatic updates are unavailable: the required update URL uses `example.invalid`.

## Development

```sh
npm ci
npm run build
npm test
npm run package
npm run test:native
node tests/native.mjs --with-latex
```

Unit tests cover upstream parser fixtures, lifecycle, cancellation and resource
limits. Native tests use isolated Zotero profiles, not the user's library, and
check opening/editing/closing and disable/re-enable. Removed standalone-window
code remains recoverable in Git history. Builds are committed locally;
publishing is a separate explicit step.
