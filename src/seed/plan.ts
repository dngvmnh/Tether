/**
 * "Load demo data" is split into short steps so each fits in one resolver call (25 s).
 * The settings page calls step 0, 1, 2, ... until `next` is null.
 */
export const DEMO = {
  projectKey: 'PAY',
  projectName: 'Payments',
  spaceKey: 'ENG',
  spaceName: 'Engineering Decisions',
  label: 'tether-decision',
  issueType: 'Task',
  /** Issues linked to a decision page, so Teamwork Graph / remote links have something to find. */
  links: { S01: 'ADR-PAY-001', S04: 'ADR-PAY-000', S08: 'ADR-SEC-003' } as Record<string, string>,
  decisionsPerStep: 5,
  issuesPerStep: 6,
} as const;

export type SeedTask =
  | { kind: 'project' }
  | { kind: 'space' }
  | { kind: 'decisions'; from: number; to: number }
  | { kind: 'issues'; from: number; to: number };

export function seedPlan(decisionCount: number, scenarioCount: number): SeedTask[] {
  const tasks: SeedTask[] = [{ kind: 'project' }, { kind: 'space' }];
  for (let i = 0; i < decisionCount; i += DEMO.decisionsPerStep) {
    tasks.push({ kind: 'decisions', from: i, to: Math.min(i + DEMO.decisionsPerStep, decisionCount) });
  }
  for (let i = 0; i < scenarioCount; i += DEMO.issuesPerStep) {
    tasks.push({ kind: 'issues', from: i, to: Math.min(i + DEMO.issuesPerStep, scenarioCount) });
  }
  return tasks;
}

/** Label that marks the issue seeded for a scenario, so re-running skips it. */
export const scenarioLabel = (scenarioId: string) => `tether-${scenarioId.toLowerCase()}`;
