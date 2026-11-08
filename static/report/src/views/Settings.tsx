import { useEffect, useState } from 'react';
import type { TetherConfig } from '../../../../src/contracts';
import { ApiError, call } from '../api/client';

const csv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

interface EvalResult {
  ranAt: string;
  total: number;
  passed: number;
  missedConflicts: number;
  falseConflicts: number;
  falseNoConflict: number;
  rows: Array<{ id: string; title: string; expected: string; actual: string | null; pass: boolean }>;
}

/** Runs the golden-scenario eval with the real LLM (fixture data only; admins only). */
function EvalPanel() {
  const [result, setResult] = useState<EvalResult | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const refresh = () =>
    call('getEval', {})
      .then((r) => setResult(r.result as EvalResult | null))
      .catch((e: ApiError) => setMsg(e.message));
  useEffect(() => void refresh(), []);
  return (
    <section className="eval">
      <h3>Evaluation</h3>
      <p className="muted">Runs the golden scenarios through the live pipeline. Takes 1-3 minutes.</p>
      <button type="button" className="btn" onClick={() => call('runEval', {}).then(() => setMsg('Queued. Refresh in a minute.')).catch((e: ApiError) => setMsg(e.message))}>
        Run eval
      </button>{' '}
      <button type="button" className="btn" onClick={() => void refresh()}>
        Refresh
      </button>
      {msg && <p className="muted">{msg}</p>}
      {result && (
        <>
          <p>
            <strong>
              {result.passed}/{result.total} passed
            </strong>{' '}
            · missed conflicts {result.missedConflicts} · false conflicts {result.falseConflicts} · false "no conflict" {result.falseNoConflict} ·{' '}
            {new Date(result.ranAt).toLocaleString()}
          </p>
          <ul className="muted">
            {result.rows.map((r) => (
              <li key={r.id}>
                {r.pass ? '✓' : '✕'} {r.id} {r.title}: expected {r.expected}, got {r.actual ?? 'FAILED'}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function Settings() {
  const [config, setConfig] = useState<TetherConfig | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    call('getConfig', {}).then((r) => setConfig(r.config)).catch((e: ApiError) => setMsg(e.message));
  }, []);

  if (!config) return <p className="muted">{msg ?? 'Loading…'}</p>;

  async function save() {
    try {
      const r = await call('setConfig', { config: config! });
      setConfig(r.config);
      setMsg('Saved.');
    } catch (e) {
      setMsg((e as ApiError).message);
    }
  }

  return (
    <form className="settings" onSubmit={(e) => (e.preventDefault(), void save())}>
      <h2>Tether settings</h2>
      <label>
        Confluence spaces with decisions (comma separated keys)
        <input value={config.spaceKeys.join(', ')} onChange={(e) => setConfig({ ...config, spaceKeys: csv(e.target.value) })} />
      </label>
      <label>
        Decision label
        <input value={config.decisionLabel} onChange={(e) => setConfig({ ...config, decisionLabel: e.target.value.trim() })} />
      </label>
      <label>
        Models, in order of preference
        <input value={config.models.join(', ')} onChange={(e) => setConfig({ ...config, models: csv(e.target.value) })} />
      </label>
      <label className="check">
        <input type="checkbox" checked={config.useTeamworkGraph} onChange={(e) => setConfig({ ...config, useTeamworkGraph: e.target.checked })} />
        Use Teamwork Graph to find decisions linked to an issue
      </label>
      <label>
        Teamwork Graph linked-pages query key (persisted query from TWG Labs)
        <input
          value={config.twgLinkedPagesQueryKey ?? ''}
          placeholder="Not registered: Jira remote links are used"
          onChange={(e) => setConfig({ ...config, twgLinkedPagesQueryKey: e.target.value.trim() || undefined })}
        />
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={config.autoRecheckOnDecisionChange}
          onChange={(e) => setConfig({ ...config, autoRecheckOnDecisionChange: e.target.checked })}
        />
        Re-check issues automatically when a decision they rely on changes
      </label>
      <button className="btn btn--primary" type="submit">
        Save
      </button>
      {msg && <p className="muted">{msg}</p>}
      <EvalPanel />
    </form>
  );
}
