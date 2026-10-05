from pathlib import Path
import json
import zipfile

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'manifest.json').read_text())['version']
output = root.parents[1] / 'outputs' / f'tikzcd-preview-{version}.xpi'
output.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    # Explicit allowlist excludes stale standalone-preview artifacts from older builds.
    for name in ['manifest.json', 'bootstrap.js', 'content/note.js',
                 'content/QUIVER-LICENSE.txt', 'content/KATEX-LICENSE.txt']:
        archive.write(root / 'dist' / name, name)
print(output)
