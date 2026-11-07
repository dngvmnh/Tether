/**
 * Offline eval of the deterministic engine on GOLD claims (no LLM). Shows which
 * scenarios the rules get right. For the end-to-end eval with real LLM extraction, use
 * the in-Forge eval web trigger (docs/EVAL.md).
 */
import { aggregate, assessClaims } from '../src/engine';
import { goldDecisions, goldScenarios } from '../eval/gold';

async function main() {
  const decisions = goldDecisions();
  let pass = 0;
  const rows: string[] = [];
  for (const s of goldScenarios()) {
    const findings = await assessClaims({ claims: s.claims, decisions });
    const agg = aggregate(s.claims, findings, []);
    const ok = agg.overallOutcome === s.expected.overall;
    if (ok) pass++;
    rows.push(`${ok ? 'PASS' : 'FAIL'}  ${s.id}  ${String(s.expected.overall).padEnd(22)} ${String(agg.overallOutcome).padEnd(22)} ${s.title}`);
  }
  console.log('      id   expected               actual                 scenario');
  console.log(rows.join('\n'));
  console.log(`\n${pass}/${rows.length} scenarios match`);
  if (pass !== rows.length) process.exit(1);
}

void main();
