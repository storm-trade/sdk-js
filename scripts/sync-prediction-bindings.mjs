// Usage: node scripts/sync-prediction-bindings.mjs <path to PredictionVault.gen.ts>
import fs from 'node:fs';
import process from 'node:process';
import ts from 'typescript';
import prettier from 'prettier';

const source = fs.readFileSync(process.argv[2], 'utf8');
const ast = ts.createSourceFile('PredictionVault.gen.ts', source, ts.ScriptTarget.Latest, true);
const declarations = new Map();
for (const statement of ast.statements) {
  const names = ts.isVariableStatement(statement)
    ? statement.declarationList.declarations.map(item => item.name.text)
    : [statement.name?.text];
  for (const name of names) {
    if (name) declarations.set(name, [...(declarations.get(name) ?? []), statement]);
  }
}
const selected = new Set();
const include = name => {
  for (const statement of declarations.get(name) ?? []) {
    if (selected.has(statement)) continue;
    selected.add(statement);
    const walk = node => {
      if (ts.isIdentifier(node)) include(node.text);
      ts.forEachChild(node, walk);
    };
    walk(statement);
  }
};
include('PredictionIntent');
if (!selected.size)
  throw new Error('PredictionIntent is missing from the generated contract wrapper');
const header = `// AUTO-GENERATED subset of the PredictionVault contract's TypeScript wrapper (PredictionVault.gen.ts).
// Regenerate with scripts/sync-prediction-bindings.mjs.
import * as c from '@ton/core';
import { beginCell } from '@ton/core';

`;
const output =
  header +
  ast.statements
    .filter(s => selected.has(s))
    .map(s => s.getText(ast))
    .join('\n\n') +
  '\n';
fs.writeFileSync(
  'src/predictions-vault/bindings.ts',
  await prettier.format(output, {
    ...(await prettier.resolveConfig('src/predictions-vault/bindings.ts')),
    parser: 'typescript',
  }),
);
