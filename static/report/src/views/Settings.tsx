import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { TetherConfig } from '../../../../src/contracts';
import { ApiError, call } from '../api/client';

/** Comma-separated text, deduplicated and trimmed. */
const csv = (s: string) => [...new Set(s.split(',').map((x) => x.trim()).filter(Boolean))];

/**
 * The text fields are edited as raw strings and only parsed when saving, so typing
 * "ENG, " does not lose the comma while the user is still typing.
 */
interface Form {
  spaces: string;
  label: string;
  models: string;
  graph: boolean;
  auto: boolean;
  twgKey: string;
}
const toForm = (c: TetherConfig): Form => ({
  spaces: c.spaceKeys.join(', '),
  label: c.decisionLabel,
  models: c.models.join(', '),
  graph: c.useTeamworkGraph,
  auto: c.autoRecheckOnDecisionChange,
  twgKey: c.twgLinkedPagesQueryKey ?? '',
});
const toConfig = (f: Form): TetherConfig => ({
  spaceKeys: csv(f.spaces),
  decisionLabel: f.label.trim(),
  models: csv(f.models),
  useTeamworkGraph: f.graph,
  autoRecheckOnDecisionChange: f.auto,
  twgLinkedPagesQueryKey: f.twgKey.trim() || undefined,
});

type Errors = Partial<Record<'spaces' | 'label' | 'models', string>>;
/** The backend accepts empty values, but an empty one would break every check. */
function validate(f: Form): Errors {
  const e: Errors = {};
  if (csv(f.spaces).length === 0) e.spaces = 'Enter at least one Confluence space key, for example ENG.';
  const label = f.label.trim();
  if (!label) e.label = 'Enter the label that marks decision pages.';
  else if (/\s/.test(label)) e.label = 'Confluence labels cannot contain spaces. Use hyphens, for example tether-decision.';
  if (csv(f.models).length === 0) e.models = 'Enter at least one model.';
  return e;
}

type Status = { kind: 'ok' | 'error'; text: string } | null;

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
  const [saved, setSaved] = useState<TetherConfig | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const id = useId();

  // After saving, the Save button becomes disabled and would drop focus to <body>: keep it on the result.
  useEffect(() => {
    if (status) statusRef.current?.focus();
  }, [status]);

  const loadSeq = useRef(0); // only the latest request may update state
  const load = useCallback(() => {
    const seq = ++loadSeq.current;
    setLoadError(null);
    call('getConfig', {})
      .then((r) => {
        if (seq !== loadSeq.current) return;
        setSaved(r.config);
        setForm(toForm(r.config));
      })
      .catch((e: ApiError) => seq === loadSeq.current && setLoadError(e));
  }, []);
  useEffect(load, [load]);

  if (loadError) {
    return (
      <div className="settings">
        <div className="banner banner--FAILED" role="alert">
          <strong>Could not load Tether settings.</strong> {loadError.message}
          <div className="banner__sub">
            <button type="button" className="btn" onClick={load}>
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (!form || !saved) {
    return (
      <p className="muted" role="status">
        Loading…
      </p>
    );
  }

  const errors = validate(form);
  // Compare both sides in the form's canonical shape: the backend may return the saved config with extra
  // fields or a different key order, which must not read as an unsaved change.
  const dirty = JSON.stringify(toConfig(form)) !== JSON.stringify(toConfig(toForm(saved)));
  const show = (k: keyof Errors) => (submitted ? errors[k] : undefined);
  const edit = (patch: Partial<Form>) => {
    setForm({ ...form, ...patch });
    setStatus(null);
  };

  async function save() {
    if (!form || saving) return;
    setSubmitted(true);
    if (Object.keys(validate(form)).length > 0) {
      // Let the invalid state render, then move focus to the first problem.
      window.setTimeout(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const r = await call('setConfig', { config: toConfig(form) });
      setSaved(r.config);
      setForm(toForm(r.config));
      setSubmitted(false);
      setStatus({ kind: 'ok', text: 'Settings saved. They apply to the next check.' });
    } catch (e) {
      const err = e as ApiError;
      setStatus({
        kind: 'error',
        text:
          err.code === 'FORBIDDEN'
            ? 'Only Jira admins can change Tether settings. Your changes were not saved.'
            : `Settings were not saved. ${err.message}${err.retryable ? ' You can try again.' : ''}`,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings" ref={formRef} noValidate onSubmit={(e) => (e.preventDefault(), void save())}>
      <h2>Tether settings</h2>
      <label>
        Confluence spaces with decisions
        <span className="field-hint" id={`${id}-spaces-hint`}>
          Space keys, separated by commas. Only these spaces are searched.
        </span>
        <input
          value={form.spaces}
          readOnly={saving}
          aria-invalid={!!show('spaces')}
          aria-describedby={`${id}-spaces-hint${show('spaces') ? ` ${id}-spaces-err` : ''}`}
          onChange={(e) => edit({ spaces: e.target.value })}
        />
        {show('spaces') && (
          <span className="field-error" id={`${id}-spaces-err`}>
            {errors.spaces}
          </span>
        )}
      </label>
      <label>
        Decision label
        <span className="field-hint" id={`${id}-label-hint`}>
          Pages with this label are treated as decision records.
        </span>
        <input
          value={form.label}
          readOnly={saving}
          aria-invalid={!!show('label')}
          aria-describedby={`${id}-label-hint${show('label') ? ` ${id}-label-err` : ''}`}
          onChange={(e) => edit({ label: e.target.value })}
        />
        {show('label') && (
          <span className="field-error" id={`${id}-label-err`}>
            {errors.label}
          </span>
        )}
      </label>
      <label>
        Models, in order of preference
        <span className="field-hint" id={`${id}-models-hint`}>
          Separated by commas. Tether uses the first model that is available.
        </span>
        <input
          value={form.models}
          readOnly={saving}
          aria-invalid={!!show('models')}
          aria-describedby={`${id}-models-hint${show('models') ? ` ${id}-models-err` : ''}`}
          onChange={(e) => edit({ models: e.target.value })}
        />
        {show('models') && (
          <span className="field-error" id={`${id}-models-err`}>
            {errors.models}
          </span>
        )}
      </label>
      <label className="check">
        <input type="checkbox" checked={form.graph} disabled={saving} onChange={(e) => edit({ graph: e.target.checked })} />
        Use Teamwork Graph to find decisions linked to an issue
      </label>
      <label>
        Teamwork Graph linked-pages query key (persisted query from TWG Labs)
        <input
          value={form.twgKey}
          readOnly={saving}
          placeholder="Not registered: Jira remote links are used"
          onChange={(e) => edit({ twgKey: e.target.value })}
        />
      </label>
      <label className="check">
        <input type="checkbox" checked={form.auto} disabled={saving} onChange={(e) => edit({ auto: e.target.checked })} />
        Re-check issues automatically when a decision they rely on changes
      </label>
      <div className="settings__actions">
        <button className="btn btn--primary" type="submit" disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {dirty && !saving && <span className="muted">Unsaved changes</span>}
      </div>
      {status && (
        <p ref={statusRef} tabIndex={-1} className={status.kind === 'error' ? 'field-error settings__status' : 'muted settings__status'} role={status.kind === 'error' ? 'alert' : 'status'}>
          {status.text}
        </p>
      )}
      <EvalPanel />
    </form>
  );
}
