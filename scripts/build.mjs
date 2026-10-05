import { extract } from './extract.mjs';
import { build } from 'esbuild';
import { mkdir, cp } from 'node:fs/promises';
await extract();
await mkdir('dist/content', { recursive: true });
await build({ entryPoints: ['src/renderer.mjs'], outfile: 'build/renderer.mjs', bundle: true, format: 'esm', target: 'firefox128' });
await build({ entryPoints: ['src/note-entry.mjs'], outfile: 'dist/content/note.js', bundle: true, format: 'iife', target: 'firefox128', loader: { '.css':'text' } });
await build({ entryPoints: ['src/note-integration.mjs'], outfile: 'build/note-integration.mjs', bundle: true, format: 'esm', target: 'firefox128', loader: { '.css':'text' } });
// Zotero's note editor already supplies KaTeX styles and fonts.
for (const name of ['manifest.json','bootstrap.js']) await cp(name, `dist/${name}`);
await cp('vendor/quiver/LICENSE', 'dist/content/QUIVER-LICENSE.txt');
await cp('node_modules/katex/LICENSE', 'dist/content/KATEX-LICENSE.txt');
console.log('Built offline TikZ-CD renderer.');
