import { readFile } from 'node:fs/promises';

const css = await readFile(new URL('../apps/web/src/style.css', import.meta.url), 'utf8');
const requirements = [
  ['primary color token', /--primary:\s*#247568/i],
  ['canvas color token', /--background:\s*#f4f6f8/i],
  ['surface color token', /--surface:\s*#fff/i],
  ['navy color token', /--navy:\s*#152c36/i],
  ['border color token', /--border:\s*#e3e8ed/i],
  ['danger color token', /--danger:\s*#b23f40/i],
  ['Segoe UI font stack', /font-family:\s*"Segoe UI",\s*system-ui/i],
  ['display font stack', /"Trebuchet MS",\s*"Segoe UI"/i],
  ['monospace font stack', /"Cascadia Code",\s*Consolas,\s*monospace/i],
  ['224px desktop sidebar', /\.sidebar\s*\{[^}]*width:\s*224px/s],
  ['900px layout breakpoint', /@media\s*\(max-width:\s*899px\)/],
  ['mobile navigation breakpoint', /@media\s*\(max-width:\s*699px\)/],
  ['reduced-motion support', /@media\s*\(prefers-reduced-motion:\s*reduce\)/],
  ['forced-colors support', /@media\s*\(forced-colors:\s*active\)/],
  ['visible keyboard focus', /\*:focus-visible\s*\{[^}]*outline:\s*3px/s],
];

const missing = requirements.filter(([, pattern]) => !pattern.test(css)).map(([name]) => name);
const smallFonts = [...css.matchAll(/font-size:\s*([0-9]+(?:\.[0-9]+)?)px/g)]
  .filter(([, size]) => Number(size) < 11)
  .map(([, size]) => `${size}px`);
if (smallFonts.length) missing.push(`caption font size below 11px (${smallFonts.join(', ')})`);
if (missing.length) {
  console.error(`Design system checks failed:\n- ${missing.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`Design system checks passed (${requirements.length + 1} requirements).`);
}
