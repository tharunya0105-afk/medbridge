/**
 * ConfirmPage — review and confirm extracted medicines
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context';
import { t } from '../i18n';
import { runCheck } from '../api';
import { StepIndicator, Disclaimer, Loader, ErrorBanner } from '../components/Shared';

function FrequencyLabel(fpd) {
  if (fpd == null) return '—';
  const map = { 1: 'Once daily', 2: 'Twice daily', 3: 'Three times daily', 4: 'Four times daily' };
  return map[fpd] || `${fpd}×/day`;
}

function MedCard({ med, lang, onConfirm, onUnsure, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name_raw: med.name_raw,
    dose_value: med.dose_value ?? '',
    dose_unit: med.dose_unit ?? 'mg',
    frequency_per_day: med.frequency_per_day ?? '',
    duration_days: med.duration_days ?? '',
  });

  function saveEdit() {
    onEdit(med.id, {
      name_raw: form.name_raw,
      dose_value: form.dose_value !== '' ? Number(form.dose_value) : null,
      dose_unit: form.dose_unit,
      frequency_per_day: form.frequency_per_day !== '' ? Number(form.frequency_per_day) : null,
      duration_days: form.duration_days !== '' ? Number(form.duration_days) : null,
    });
    setEditing(false);
  }

  const cardClass = med.confirmed
    ? 'med-card med-card--confirmed'
    : med.flagged_low_confidence
      ? 'med-card med-card--low-confidence'
      : 'med-card';

  return (
    <div className={cardClass} id={`med-card-${med.id}`}>
      <div className="med-card__header">
        <div>
          <div className="med-card__name">{med.name_raw}</div>
          {med.name_generic && (
            <div className="med-card__generic">({med.name_generic})</div>
          )}
        </div>
        <div className="flex gap-2 items-center">
          {med.flagged_low_confidence && (
            <span className="badge badge--confidence-low">
              ⚠ {t(lang, 'confirm.amber_label')}
            </span>
          )}
          {med.confirmed && (
            <span className="badge badge--success">✓ Confirmed</span>
          )}
          <span className="text-xs text-muted">
            {Math.round(med.confidence * 100)}%
          </span>
        </div>
      </div>

      {editing ? (
        <div className="animate-fade-in">
          <div className="med-card__fields">
            <div className="med-card__field">
              <label className="med-card__label">{t(lang, 'confirm.field_name')}</label>
              <input
                className="input"
                value={form.name_raw}
                onChange={e => setForm(f => ({ ...f, name_raw: e.target.value }))}
              />
            </div>
            <div className="med-card__field">
              <label className="med-card__label">{t(lang, 'confirm.field_dose')}</label>
              <div className="flex gap-2">
                <input
                  className="input"
                  type="number"
                  value={form.dose_value}
                  onChange={e => setForm(f => ({ ...f, dose_value: e.target.value }))}
                  style={{ flex: 1 }}
                />
                <select
                  className="input select"
                  value={form.dose_unit}
                  onChange={e => setForm(f => ({ ...f, dose_unit: e.target.value }))}
                  style={{ width: '80px' }}
                >
                  <option value="mg">mg</option>
                  <option value="mcg">mcg</option>
                  <option value="ml">ml</option>
                  <option value="g">g</option>
                </select>
              </div>
            </div>
            <div className="med-card__field">
              <label className="med-card__label">{t(lang, 'confirm.field_frequency')}</label>
              <select
                className="input select"
                value={form.frequency_per_day}
                onChange={e => setForm(f => ({ ...f, frequency_per_day: e.target.value }))}
              >
                <option value="">—</option>
                <option value="1">Once daily</option>
                <option value="2">Twice daily</option>
                <option value="3">Three times daily</option>
                <option value="4">Four times daily</option>
              </select>
            </div>
            <div className="med-card__field">
              <label className="med-card__label">{t(lang, 'confirm.field_duration')}</label>
              <div className="flex gap-2 items-center">
                <input
                  className="input"
                  type="number"
                  value={form.duration_days}
                  onChange={e => setForm(f => ({ ...f, duration_days: e.target.value }))}
                  style={{ flex: 1 }}
                />
                <span className="text-sm text-muted">days</span>
              </div>
            </div>
          </div>
          <div className="med-card__actions">
            <button className="btn btn--primary btn--sm" onClick={saveEdit}>Save</button>
            <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div className="med-card__fields">
            <div className="med-card__field">
              <span className="med-card__label">{t(lang, 'confirm.field_dose')}</span>
              <span className="med-card__value">
                {med.dose_value != null ? `${med.dose_value} ${med.dose_unit || ''}` : '—'}
              </span>
            </div>
            <div className="med-card__field">
              <span className="med-card__label">{t(lang, 'confirm.field_frequency')}</span>
              <span className="med-card__value">{FrequencyLabel(med.frequency_per_day)}</span>
            </div>
            <div className="med-card__field">
              <span className="med-card__label">{t(lang, 'confirm.field_duration')}</span>
              <span className="med-card__value">
                {med.duration_days != null ? `${med.duration_days} days` : '—'}
              </span>
            </div>
            <div className="med-card__field">
              <span className="med-card__label">Route</span>
              <span className="med-card__value">{med.route || '—'}</span>
            </div>
          </div>
          {med.instructions && (
            <p className="text-sm text-muted mt-2" style={{ fontStyle: 'italic' }}>
              "{med.instructions}"
            </p>
          )}
          <div className="med-card__actions">
            {!med.confirmed && (
              <button className="btn btn--primary btn--sm" onClick={() => onConfirm(med.id)}>
                ✓ {t(lang, 'confirm.confirm_btn')}
              </button>
            )}
            <button className="btn btn--secondary btn--sm" onClick={() => setEditing(true)}>
              ✏️ {t(lang, 'confirm.edit_btn')}
            </button>
            {med.confirmed ? (
              <button className="btn btn--ghost btn--sm" onClick={() => onUnsure(med.id)}>
                ↩ Undo
              </button>
            ) : (
              <button className="btn btn--ghost btn--sm text-warning" onClick={() => onUnsure(med.id)}>
                ❓ {t(lang, 'confirm.unsure_btn')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function ConfirmPage() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const lang = state.lang;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const confirmedCount = state.meds.filter(m => m.confirmed).length;
  const totalEligible = state.meds.filter(m => !m.flagged_low_confidence).length;
  const hasConfirmed = confirmedCount > 0;

  function handleConfirm(id) {
    dispatch({ type: 'CONFIRM_MED', payload: id });
  }
  function handleUnsure(id) {
    dispatch({ type: 'UNSURE_MED', payload: id });
  }
  function handleEdit(id, changes) {
    dispatch({ type: 'UPDATE_MED', payload: { id, changes } });
  }
  function confirmAll() {
    dispatch({ type: 'CONFIRM_ALL' });
  }

  async function handleRunCheck() {
    setLoading(true);
    setError(null);
    const confirmed = state.meds.filter(m => m.confirmed);
    try {
      const result = await runCheck(state.sessionId, state.meds);
      dispatch({ type: 'SET_ALERTS', payload: result.alerts });
      navigate('/safety');
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <StepIndicator current={2} />
        <Loader text="Running safety checks..." />
      </div>
    );
  }

  if (state.meds.length === 0) {
    return (
      <div className="page-container animate-fade-in">
        <StepIndicator current={2} />
        <div className="card text-center" style={{ padding: 'var(--space-12)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>📋</div>
          <h3>No medicines extracted</h3>
          <p className="text-muted mt-2">
            We couldn't read any medicines from the document.
          </p>
          <button className="btn btn--primary mt-6" onClick={() => navigate('/')}>
            Start over
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <StepIndicator current={2} />

      <div className="flex justify-between items-center mb-2">
        <h2>{t(lang, 'confirm.title')}</h2>
        <span className="text-sm text-muted">
          {confirmedCount}/{totalEligible} confirmed
        </span>
      </div>
      <p className="text-muted mb-4">{t(lang, 'confirm.subtitle')}</p>

      {error && <ErrorBanner message={error} />}

      {/* Extraction warnings */}
      {state.extractionWarnings.map((w, i) => (
        <div key={i} className="card card--warning mb-4 text-sm">
          ⚠️ {w}
        </div>
      ))}

      {/* Progress bar */}
      <div className="progress-bar mb-6">
        <div
          className="progress-bar__fill"
          style={{ width: `${totalEligible > 0 ? (confirmedCount / totalEligible) * 100 : 0}%` }}
        />
      </div>

      {/* Confirm-all shortcut */}
      {confirmedCount < totalEligible && (
        <button className="btn btn--ghost btn--sm mb-4" onClick={confirmAll}>
          ✓ Confirm all eligible ({totalEligible})
        </button>
      )}

      {/* Med cards */}
      {state.meds.map(med => (
        <MedCard
          key={med.id}
          med={med}
          lang={lang}
          onConfirm={handleConfirm}
          onUnsure={handleUnsure}
          onEdit={handleEdit}
        />
      ))}

      {/* Unsure note */}
      <p className="text-xs text-muted text-center mb-4" style={{ fontStyle: 'italic' }}>
        {t(lang, 'confirm.unsure_note')}
      </p>

      {/* Run check button */}
      <button
        className="btn btn--primary btn--lg btn--full mt-4"
        disabled={!hasConfirmed}
        onClick={handleRunCheck}
        id="run-check-btn"
      >
        🔍 {t(lang, 'confirm.run_check_btn')}
      </button>

      <Disclaimer />
    </div>
  );
}
