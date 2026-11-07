import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('architecture boundaries', () => {
  it('engine and contracts never import @forge/* (they must run in plain Node)', () => {
    for (const f of [...files('src/engine'), ...files('src/contracts')]) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/from ['"]@forge\//);
    }
  });
  it('engine never imports adapters or handlers', () => {
    for (const f of files('src/engine')) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/from ['"]\.\.\/(\.\.\/)?(adapters|handlers)/);
    }
  });
});
