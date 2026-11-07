import { useEffect, useState } from 'react';

/** Mock mode only: pick which golden scenario the fake backend returns. */
export function DevToolbar({ onChange }: { onChange: () => void }) {
  const [mod, setMod] = useState<typeof import('./api/mock') | null>(null);
  useEffect(() => {
    void import('./api/mock').then(setMod);
  }, []);
  if (!mod) return null;
  return (
    <div className="devbar">
      Mock scenario{' '}
      <select
        defaultValue={mod.currentScenario()}
        onChange={(e) => {
          mod.setScenario(e.target.value);
          onChange();
        }}
      >
        {Object.entries(mod.SCENARIOS).map(([id, s]) => (
          <option key={id} value={id}>
            {id} · {s.title}
          </option>
        ))}
      </select>
    </div>
  );
}
