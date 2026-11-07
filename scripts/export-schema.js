import { writeFile } from 'node:fs/promises';
import { SCHEMA } from '../lib/schema.js';

const header = `-- Ledger · esquema Postgres (generado desde lib/schema.js con "npm run schema").
-- La API ya lo aplica sola; este archivo sirve para revisarlo o correrlo a mano.

`;

await writeFile(
  new URL('../db/schema.sql', import.meta.url),
  header + SCHEMA.map((s) => `${s};`).join('\n\n') + '\n'
);
console.log('db/schema.sql actualizado');
