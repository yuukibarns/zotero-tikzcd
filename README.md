# TikZ-CD renderer for Zotero

An independent, offline Zotero 10 plugin that renders Quiver-compatible `tikzcd`
diagrams in **closed display-math nodes**. Experimental: this uses Zotero's
private MathView API, with checks for the expected interface.

## Usage

Install `tikzcd-preview-0.2.11.xpi`, then paste a complete block into a display-math
node in a note:

```latex
\begin{tikzcd}
A \arrow[r, "f"] \arrow[d, "g"'] & B \arrow[d, "h"] \\
C \arrow[r, "k"'] & D
\end{tikzcd}
```

Leave the source editor to render. With LaTeX Suite 0.5.3.103, editing also uses
its existing live preview panel and display-preview enable/delay settings.
The same diagram surface is reused; caret-only movement does not rerender it.
Without LaTeX Suite, rendering remains closed-node only. Ordinary equations
retain native rendering. There is no Tools-menu button or standalone window.

Zotero saves the source unchanged. There is no image fallback,
visual editor or diagram caret/selection mapping. Without this plugin Zotero
cannot render `tikzcd`; use an exported Quiver image when portability matters.
For visual editing, use [Quiver](https://q.uiver.app/).

PDF export works through LaTeX Suite 0.5.3.102's **Print / PDF** action. It renders
a fresh diagram snapshot (including when source is open), embeds renderer styles,
and preserves SVG mask references. Both light and dark export themes inherit
their normal colors. Fatal errors stop export; nonfatal warnings are reported
after preparing the PDF. Export typography comes from LaTeX Suite's single
print-style definition rather than a duplicated constant in this plugin.

## Implementation and limitations

- Render-only extraction of [Quiver](https://github.com/varkor/quiver), pinned to
  `2f289ecbae9b7e5a473e04b924750c538ed5c4cf`. MIT sources: `vendor/quiver`.
- KaTeX renders labels. Zotero supplies existing note styles and fonts.
- Layout uses Quiver's 26px coordinate system, then scales the complete diagram
  to the surrounding note font size. Bounds have no added padding or vertical margin.
- Per-node hooks preserve native editing, undo and saving. Async rendering is
  cancelled on replacement, preview release, removal or shutdown. Live updates
  are debounced, with stale results discarded and the last good diagram retained.
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
