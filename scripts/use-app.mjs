// Switches manifest.yml between the two registered apps (see docs/SUBMISSION.md):
//   node scripts/use-app.mjs judging       -> app shared with judges by installation link
//   node scripts/use-app.mjs marketplace   -> app submitted for Marketplace listing
// App ids live in scripts/apps.json (not secret). Commit only the judging id in manifest.yml.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const which = process.argv[2];
if (!existsSync('scripts/apps.json')) throw new Error('Create scripts/apps.json: {"judging": "ari:cloud:ecosystem::app/...", "marketplace": "ari:..."}');
const apps = JSON.parse(readFileSync('scripts/apps.json', 'utf8'));
if (!apps[which]) throw new Error(`Usage: node scripts/use-app.mjs <${Object.keys(apps).join('|')}>`);
const manifest = readFileSync('manifest.yml', 'utf8').replace(/^(\s*id:\s*)ari:cloud:ecosystem::app\/[0-9a-f-]+/m, `$1${apps[which]}`);
writeFileSync('manifest.yml', manifest);
console.log(`manifest.yml now targets the ${which} app (${apps[which]})`);
