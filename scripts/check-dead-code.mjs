/**
 * Refuses to let a mechanic be written, exported, and wired to nothing.
 *
 * PRODUCT.md §40 records the defect class: Act 2 asked a kid for "three more
 * profitable days run by your manager", the counter existed, the badge existed,
 * and nothing called the function that moved it. §44 records the sharper
 * version — `clearEverything` wiped the run and the trophy case, with a comment
 * claiming it was reachable from the parent view. It was reachable from
 * nowhere, and it was a human reading the diff who noticed, not a test.
 *
 * `reachable.test.ts` asks the same question of rewards. This asks it of code:
 * an exported function or type that nothing in src/, tests/ or scripts/ ever
 * names is either unfinished work or a promise the product no longer keeps.
 *
 * Over-exports (used inside their own file but never imported) are reported and
 * tolerated: a return type of a public function is part of the surface even
 * when no caller spells it out.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['src', 'tests', 'scripts'];
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) files.push(full);
  }
}
for (const root of ROOTS) if (fs.existsSync(root)) walk(root);

const source = new Map(files.map((f) => [f, fs.readFileSync(f, 'utf8')]));

const declarations = [];
for (const [file, text] of source) {
  if (!file.startsWith('src')) continue;
  const pattern =
    /^export\s+(?:declare\s+)?(?:async\s+)?(function|const|let|class|type|interface|enum)\s+([A-Za-z0-9_$]+)/gm;
  let match;
  while ((match = pattern.exec(text))) {
    declarations.push({ file, kind: match[1], name: match[2] });
  }
}

const dead = [];
const overExported = [];
for (const decl of declarations) {
  const word = new RegExp(`\\b${decl.name}\\b`, 'g');
  let elsewhere = 0;
  let own = 0;
  for (const [file, text] of source) {
    const hits = (text.match(word) || []).length;
    if (file === decl.file) own += hits;
    else elsewhere += hits;
  }
  if (elsewhere > 0) continue;
  // `own === 1` is the declaration and nothing else.
  if (own <= 1) dead.push(decl);
  else overExported.push(decl);
}

if (overExported.length > 0) {
  console.log(`note  ${overExported.length} exports are used only inside their own file`);
}

if (dead.length > 0) {
  console.error(`\nFAIL  ${dead.length} export(s) that nothing anywhere names:\n`);
  for (const { file, kind, name } of dead) console.error(`  ${file}  ${kind} ${name}`);
  console.error(
    '\nEither wire it up, or delete it and write the gap down. An export with no\n' +
      'caller is a promise the product does not keep.\n',
  );
  process.exit(1);
}

console.log('OK   (no exported code without a caller)');
