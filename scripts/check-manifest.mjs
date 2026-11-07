// Validates manifest.yml against the official Forge manifest JSON schema (@forge/manifest)
// and checks that every function handler exists. No Forge login needed, so it runs in CI.
// `forge lint` is still the final word; run it before deploying.
import { readFileSync, existsSync } from 'node:fs';
import yaml from 'js-yaml';
import Ajv from 'ajv';

const schema = JSON.parse(readFileSync('node_modules/@forge/manifest/out/schema/manifest-schema.json', 'utf8'));
const manifest = yaml.load(readFileSync('manifest.yml', 'utf8'));

const ajv = new Ajv({ strict: false, allErrors: true, allowUnionTypes: true, validateFormats: false });
const validate = ajv.compile(schema);
let failed = false;
if (!validate(manifest)) {
  failed = true;
  const seen = new Set();
  for (const e of validate.errors ?? []) {
    const line = `${e.instancePath || '/'} ${e.message}${e.params?.additionalProperty ? ` (${e.params.additionalProperty})` : ''}`;
    if (!seen.has(line)) console.error(`schema: ${line}`), seen.add(line);
  }
}

const index = readFileSync('src/index.ts', 'utf8');
for (const fn of manifest.modules.function ?? []) {
  const [file, exp] = fn.handler.split('.');
  if (file !== 'index' || !new RegExp(`\\b${exp}\\b`).test(index)) {
    console.error(`handler: ${fn.key} -> ${fn.handler} is not exported from src/index.ts`);
    failed = true;
  }
}
for (const s of manifest.modules['rovo:skill'] ?? []) {
  if (!existsSync(`${s.source.dir}/SKILL.md`)) {
    console.error(`skill: ${s.source.dir}/SKILL.md missing`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log(`manifest OK (${Object.keys(manifest.modules).length} module types, ${manifest.modules.function.length} functions)`);
