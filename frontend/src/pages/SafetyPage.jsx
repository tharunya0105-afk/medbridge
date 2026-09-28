/**
 * SafetyPage — results of deterministic safety check
 * Displays drug-drug interactions, duplicates, dosage limits, red flags,
 * with collapsible explanations and verified deterministic badge.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context';
import { t } from '../i18n';
import { getExplanations } from '../api';
import { StepIndicator, Disclaimer, SeverityBadge, ActionBadge, Loader, ErrorBanner } from '../components/Shared';

function AlertItem({ alert, lang }) {
  const [showWhy, setShowWhy] = useState(false);

  const medsText = alert.meds_involved && alert.meds_involved.length > 0
    ? alert.meds_involved.join(' + ')
    : '';

  const messageText = alert.message || (alert.message_key ? t(lang, alert.message_key, alert.params) : 'Safety concern flagged.');
  const whyText = alert.why_detail || alert.why_explanation;
  const sourceRef = alert.source_to_verify || alert.source_reference;

  return (
    <div className={`alert-card alert-card--${alert.severity || 'info'}`} id={`alert-${alert.rule_id || 'item'}`}>
      <div className="alert-card__header">
        <div className="flex items-center gap-2 flex-wrap">
          <SeverityBadge severity={alert.severity} />
          {medsText && <span className="alert-card__meds">{medsText}</span>}
        </div>
        {alert.rule_id && (
          <span className="badge badge--info text-xs">
            {t(lang, 'safety.rule_id_label')}: {alert.rule_id}
          </span>
        )}
      </div>

      <div className="alert-card__message">
        {messageText}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2 mt-3">
        {alert.action && (
          <div>
            <span className="text-xs text-muted block mb-1">{t(lang, 'safety.action_label')}:</span>
            <ActionBadge action={alert.action} />
          </div>
        )}

        {whyText && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setShowWhy(!showWhy)}
            style={{ fontSize: 'var(--font-size-xs)' }}
          >
            {showWhy ? `▲ ${t(lang, 'safety.hide_why')}` : `▼ ${t(lang, 'safety.show_why')}`}
          </button>
        )}
      </div>

      {showWhy && whyText && (
        <div className="alert-card__why animate-fade-in">
          <strong>Why this was flagged:</strong>
          <p className="mt-1 mb-2">{whyText}</p>
          {sourceRef && (
            <div className="alert-card__source">
              Reference: {sourceRef}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SafetyPage() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const lang = state.lang;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const alerts = state.alerts || [];
  const confirmedMeds = (state.meds || []).filter(m => m.confirmed);
  const unsureMeds = (state.meds || []).filter(m => !m.confirmed);

  // Group alerts by severity count
  const majorCount = alerts.filter(a => a.severity === 'major').length;
  const moderateCount = alerts.filter(a => a.severity === 'moderate').length;
  const infoCount = alerts.filter(a => a.severity === 'info').length;

  async function handleContinue() {
    setLoading(true);
    setError(null);
    try {
      // Fetch plain-language explanations for confirmed meds
      const res = await getExplanations(state.sessionId, state.meds, lang);
      dispatch({ type: 'SET_EXPLANATIONS', payload: res.items || [] });
      navigate('/medicines');
    } catch (err) {
      console.error('Failed to get explanations:', err);
      // Fallback: still navigate if error occurs
      navigate('/medicines');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <StepIndicator current={3} />
        <Loader text="Preparing your medication overview..." />
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <StepIndicator current={3} />

      <div className="flex justify-between items-center mb-2">
        <h2>{t(lang, 'safety.title')}</h2>
        {alerts.length > 0 && (
          <span className="text-sm font-semibold text-danger">
            {alerts.length} concern{alerts.length === 1 ? '' : 's'} flagged
          </span>
        )}
      </div>

      <div className="card card--info mb-6" style={{ background: 'rgba(237, 252, 250, 0.9)' }}>
        <div className="flex items-center gap-2 mb-1">
          <span style={{ fontSize: '1.25rem' }}>🛡️</span>
          <span className="font-semibold text-sm">
            {t(lang, 'safety.verified_footer')}
          </span>
        </div>
        <p className="text-xs text-muted mb-0">
          Rules run against curated clinical data for drug interactions, max daily doses, and frequency limits.
        </p>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Checked summary */}
      <div className="card card--glass mb-6">
        <div className="flex justify-between items-center text-sm">
          <div>
            <strong>{t(lang, 'safety.what_was_checked')}:</strong>{' '}
            <span className="text-muted">
              {confirmedMeds.length > 0
                ? confirmedMeds.map(m => m.name_raw).join(', ')
                : 'None'}
            </span>
          </div>
        </div>
        {unsureMeds.length > 0 && (
          <div className="text-xs text-warning mt-2 pt-2 border-top">
            ⚠️ <strong>{t(lang, 'safety.not_checked')}:</strong>{' '}
            {unsureMeds.map(m => m.name_raw).join(', ')} (Marked as unsure — please consult your pharmacist)
          </div>
        )}
      </div>

      {/* Alert items or No Alerts state */}
      {alerts.length === 0 ? (
        <div className="card card--success text-center mb-6" style={{ padding: 'var(--space-8)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-2)' }}>✅</div>
          <h3 className="text-success mb-2">No Safety Concerns Found</h3>
          <p className="text-muted mb-0">
            {t(lang, 'safety.no_alerts')}
          </p>
        </div>
      ) : (
        <div className="mb-6">
          <div className="flex gap-2 mb-4">
            {majorCount > 0 && (
              <span className="badge badge--major">{majorCount} Major</span>
            )}
            {moderateCount > 0 && (
              <span className="badge badge--moderate">{moderateCount} Moderate</span>
            )}
            {infoCount > 0 && (
              <span className="badge badge--info">{infoCount} Notice</span>
            )}
          </div>

          {alerts.map((alert, idx) => (
            <AlertItem key={alert.rule_id || idx} alert={alert} lang={lang} />
          ))}
        </div>
      )}

      {/* Action button */}
      <button
        type="button"
        className="btn btn--primary btn--lg btn--full mt-4"
        onClick={handleContinue}
        id="continue-to-medicines-btn"
      >
        💊 {t(lang, 'safety.continue_btn')} →
      </button>

      <Disclaimer />
    </div>
  );
}
