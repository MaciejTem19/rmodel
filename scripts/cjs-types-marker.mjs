/* Marks dist/cjs as CommonJS. Without it TypeScript reads those declarations
   through the package's own "type": "module" and a require()-ing consumer gets
   TS1479 instead of the types. */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const marker = fileURLToPath(new URL('../dist/cjs/package.json', import.meta.url))
await writeFile(marker, `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`)
console.log('wrote dist/cjs/package.json ({"type":"commonjs"})')
