// Regression guard for the whip-crack freeze bug.
//
// drawCrack() draws the "CRAC !" flash on every whip hit. Its animation-progress
// local used to be named `t`, which shadowed the global translation helper
// t(fr, en) from phrases.js. That made `t('CRAC !', 'CRACK!')` call a number as a
// function -> TypeError inside the requestAnimationFrame loop -> the pet froze on
// every whip. The fix renames the progress var to `p`; the ONLY `t` left in the
// function must be the translation call `t(...)`.
//
// This test fails if any bare `t` value-reference sneaks back into drawCrack
// (e.g. an incomplete t->p rename like `9 * (1 - t)`).

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(
  path.join(__dirname, '../src/renderer/renderer.js'),
  'utf8'
);

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start !== -1, `${name}() not found in renderer.js`);
  // Walk braces from the first '{' after the signature to its match.
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    const c = source[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return source.slice(open, i + 1);
    }
  }
  throw new Error(`Unbalanced braces while extracting ${name}()`);
}

test('drawCrack uses `p` for animation progress, never the translation fn `t`', () => {
  const body = extractFunction(src, 'drawCrack');

  // A bare `t` token that is NOT a call `t(` means the progress var leaked in.
  // \bt\b matches a standalone t; (?!\s*\() excludes the legit translation call.
  const bareT = body.match(/\bt\b(?!\s*\()/g);

  assert.strictEqual(
    bareT,
    null,
    `drawCrack() references the global translation fn \`t\` as a value ` +
      `${bareT ? JSON.stringify(bareT) : ''} — this is the shadowing/incomplete-rename ` +
      `bug that freezes the pet on whip. Rename it to the numeric progress var \`p\`.`
  );

  // Sanity: the intentional translation call must still be there.
  assert.ok(
    /\bt\('CRAC/.test(body),
    'drawCrack() should still call t(\'CRAC !\', \'CRACK!\') for the bilingual flash'
  );
});
