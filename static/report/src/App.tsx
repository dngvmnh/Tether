import { useEffect, useState } from 'react';
import { getModuleContext, MOCK, type ModuleContext } from './api/client';
import { DevToolbar } from './DevToolbar';
import { DecisionBadge } from './views/DecisionBadge';
import { IssuePanel } from './views/IssuePanel';
import { Settings } from './views/Settings';

/** One Custom UI bundle serves every module; route on the module key. */
export function App() {
  const [ctx, setCtx] = useState<ModuleContext | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    void getModuleContext().then(setCtx);
  }, []);
  if (!ctx) return null;
  return (
    <>
      {MOCK && <DevToolbar onChange={() => setNonce((n) => n + 1)} />}
      {ctx.moduleKey === 'tether-admin' ? (
        <Settings />
      ) : ctx.moduleKey === 'tether-decision-badge' ? (
        <DecisionBadge decisionId={ctx.decisionId ?? ''} />
      ) : (
        <IssuePanel key={nonce} issueKey={ctx.issueKey ?? ''} />
      )}
    </>
  );
}
