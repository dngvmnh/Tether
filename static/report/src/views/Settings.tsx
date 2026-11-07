import { useEffect, useState } from 'react';
import type { TetherConfig } from '../../../../src/contracts';
import { ApiError, call } from '../api/client';

const csv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

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
    </form>
  );
}
