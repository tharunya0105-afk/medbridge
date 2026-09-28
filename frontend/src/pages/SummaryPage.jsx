/**
 * SummaryPage — Step 6: Pharmacist/Nurse Clinical Summary
 * Provides exportable, print-optimized handoff documentation:
 * - Confirmed medication schedule
 * - Deterministic safety flags & recommended actions
 * - Unsure / low-confidence items for pharmacist review
 * - Patient comprehension quiz score (<60% caregiver alert trigger)
 * - Copy / Print / Delete data actions
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context';
import { t } from '../i18n';
import { getSummary, deleteSession } from '../api';
import { StepIndicator, Disclaimer, SeverityBadge, ActionBadge, Loader, ErrorBanner } from '../components/Shared';

export default function SummaryPage() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const lang = state.lang;

  const [summaryData, setSummaryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [caregiverShared, setCaregiverShared] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchSummary() {
      if (!state.sessionId) {
        setLoading(false);
        return;
      }
      try {
        const data = await getSummary(state.sessionId);
        setSummaryData(data);
      } catch (err) {
        console.error('Failed to fetch summary from server, using local state:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSummary();
  }, [state.sessionId]);

  // Fallback to local state if summary endpoint is offline or demo
  const confirmedMeds = summaryData?.confirmed_meds || (state.meds || []).filter(m => m.confirmed);
  const unsureMeds = summaryData?.unsure_meds || (state.meds || []).filter(m => !m.confirmed);
  const alerts = summaryData?.alerts || state.alerts || [];
  const score = state.quizScore !== null ? state.quizScore : (summaryData?.quiz_score ?? null);

  const isLowScore = score !== null && score < 60;

  function handlePrint() {
    window.print();
  }

  function handleCopy() {
    const textLines = [
      `=== MEDBRIDGE SUMMARY FOR PHARMACIST / CLINICIAN ===`,
      `Session ID: ${state.sessionId || 'Demo'}`,
      `Date: ${new Date().toLocaleDateString()}`,
      `Comprehension Quiz Score: ${score !== null ? `${score}%` : 'N/A'}${isLowScore ? ' (Flagged: Needs caregiver support)' : ''}`,
      ``,
      `--- CONFIRMED MEDICINES (${confirmedMeds.length}) ---`,
      ...confirmedMeds.map(
        (m, i) =>
          `${i + 1}. ${m.name_raw} (${m.generic_name || 'Generic unmapped'}) - ` +
          `Dose: ${m.dose_value || ''} ${m.dose_unit || ''}, ` +
          `Freq: ${m.frequency_per_day || m.frequency_raw || 'N/A'}, ` +
          `Duration: ${m.duration_days ? `${m.duration_days} days` : 'Ongoing'}` +
          (m.instructions ? ` | Note: ${m.instructions}` : '')
      ),
      ``,
      `--- ITEMS NEEDING PHARMACIST CHECK (${unsureMeds.length}) ---`,
      ...unsureMeds.map(
        (m, i) => `${i + 1}. ${m.name_raw} (Marked unsure/low confidence: "${m.name_raw}")`
      ),
      ``,
      `--- SAFETY FLAGS (${alerts.length}) ---`,
      ...alerts.map(
        (a, i) => {
          const msg = a.message || (a.message_key ? t(lang, a.message_key, a.params) : 'Safety concern flagged');
          return `[${a.severity ? a.severity.toUpperCase() : 'INFO'}] ${msg} -> Action: ${a.action}`;
        }
      ),
      ``,
      `Note: ${t(lang, 'summary.unvalidated_note')}`,
    ];

    navigator.clipboard.writeText(textLines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function handleDeleteData() {
    if (confirm('Are you sure you want to delete this session data?')) {
      try {
        if (state.sessionId) {
          await deleteSession(state.sessionId);
        }
      } catch (err) {
        console.error('Delete session error:', err);
      }
      dispatch({ type: 'RESET' });
      navigate('/');
    }
  }

  function handleStartOver() {
    dispatch({ type: 'RESET' });
    navigate('/');
  }

  function handleShareCaregiver() {
    setCaregiverShared(true);
    if (navigator.share) {
      navigator.share({
        title: 'MedBridge Patient Summary',
        text: `MedBridge Medication Summary. Quiz score: ${score}%. Please review medicines with the patient.`,
        url: window.location.href,
      }).catch(() => {});
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <StepIndicator current={6} />
        <Loader text="Generating summary report..." />
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in" id="summary-report-page">
      <StepIndicator current={6} />

      {/* Header with Title & Action Buttons */}
      <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
        <div>
          <h2>{t(lang, 'summary.title')}</h2>
          <p className="text-sm text-muted mb-0">
            Hand this summary to your pharmacist or home healthcare nurse.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={handleCopy}
            id="summary-copy-btn"
          >
            {copied ? '✓ Copied!' : `📋 ${t(lang, 'summary.copy_btn')}`}
          </button>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={handlePrint}
            id="summary-print-btn"
          >
            🖨️ {t(lang, 'summary.print_btn')}
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {/* Comprehension Quiz Score Widget */}
      {score !== null && (
        <div className="card text-center mb-6" style={{ background: 'white' }}>
          <h4 className="text-sm text-muted uppercase tracking-wider mb-3">
            {t(lang, 'summary.quiz_heading')}
          </h4>

          <div className="score-ring">
            <svg className="score-ring__circle" width="120" height="120">
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="transparent"
                stroke="var(--color-gray-200)"
                strokeWidth="10"
              />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="transparent"
                stroke={isLowScore ? 'var(--color-amber-500)' : 'var(--color-success-500)'}
                strokeWidth="10"
                strokeDasharray={`${(score / 100) * 314} 314`}
                strokeLinecap="round"
              />
            </svg>
            <div className="score-ring__label">
              {score}%
            </div>
          </div>

          <p className="text-sm font-semibold mb-2">
            {isLowScore
              ? 'Additional review recommended'
              : 'Great understanding of medication regimen!'}
          </p>

          {/* Caregiver Prompt if score < 60% */}
          {isLowScore && (
            <div
              className="card card--warning text-left mt-4"
              style={{ padding: 'var(--space-4)' }}
            >
              <div className="flex items-start gap-3">
                <span style={{ fontSize: '1.5rem' }}>👨‍👩‍👧</span>
                <div>
                  <strong className="text-sm block mb-1">
                    {t(lang, 'teachback.caregiver_prompt')}
                  </strong>
                  <p className="text-xs text-muted mb-3">
                    Your comprehension score is below 60%. Having a family caregiver or nurse review your medicine schedule helps prevent missed doses or confusion.
                  </p>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    onClick={handleShareCaregiver}
                    id="share-caregiver-btn"
                  >
                    {caregiverShared ? '✓ Shared / Link ready' : `🔗 ${t(lang, 'teachback.share_btn')}`}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmed Medicines Section */}
      <div className="card mb-6" style={{ background: 'white' }}>
        <h3 className="mb-4" style={{ fontSize: '1.25rem' }}>
          📋 {t(lang, 'summary.meds_heading')} ({confirmedMeds.length})
        </h3>

        {confirmedMeds.length === 0 ? (
          <p className="text-muted text-sm">No medicines confirmed.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {confirmedMeds.map((med, idx) => (
              <div
                key={med.id || idx}
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  border: '1px solid var(--color-gray-200)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-gray-50)',
                }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <strong style={{ fontSize: '1.05rem' }}>{med.name_raw}</strong>
                    {med.generic_name && (
                      <span className="text-xs text-muted ml-2">
                        ({med.generic_name})
                      </span>
                    )}
                  </div>
                  <span className="badge badge--success text-xs">Confirmed</span>
                </div>

                <div className="text-xs text-gray-600 mt-2 flex flex-wrap gap-4">
                  <span>
                    <strong>Dose:</strong> {med.dose_value || ''} {med.dose_unit || 'As written'}
                  </span>
                  <span>
                    <strong>Frequency:</strong> {med.frequency_per_day ? `${med.frequency_per_day}x/day` : med.frequency_raw || 'As written'}
                  </span>
                  <span>
                    <strong>Duration:</strong> {med.duration_days ? `${med.duration_days} days` : 'Ongoing'}
                  </span>
                  <span>
                    <strong>Route:</strong> {med.route || 'Oral'}
                  </span>
                </div>

                {med.instructions && (
                  <p className="text-xs text-muted mt-2 mb-0" style={{ fontStyle: 'italic' }}>
                    "{med.instructions}"
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Items Needing Pharmacist Check (Unsure / Low Confidence) */}
      {unsureMeds.length > 0 && (
        <div className="card card--warning mb-6">
          <h3 className="mb-3 text-warning" style={{ fontSize: '1.25rem' }}>
            ❓ {t(lang, 'summary.unsure_heading')} ({unsureMeds.length})
          </h3>
          <p className="text-xs text-muted mb-3">
            These lines could not be fully confirmed by the patient and need verification against hospital discharge notes.
          </p>

          <div className="flex flex-col gap-2">
            {unsureMeds.map((med, idx) => (
              <div
                key={med.id || idx}
                className="p-3"
                style={{
                  background: 'white',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-amber-200)',
                }}
              >
                <strong>{med.name_raw}</strong>
                {med.instructions && (
                  <p className="text-xs text-muted mb-0 mt-1">"{med.instructions}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Safety Flags Section */}
      <div className="card mb-6" style={{ background: 'white' }}>
        <h3 className="mb-4" style={{ fontSize: '1.25rem' }}>
          ⚠️ {t(lang, 'summary.alerts_heading')} ({alerts.length})
        </h3>

        {alerts.length === 0 ? (
          <p className="text-muted text-sm">No safety flags triggered.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {alerts.map((alert, idx) => (
              <div
                key={alert.rule_id || idx}
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  borderLeft: `4px solid ${
                    alert.severity === 'major'
                      ? 'var(--color-danger-500)'
                      : alert.severity === 'moderate'
                      ? 'var(--color-amber-500)'
                      : 'var(--color-primary-500)'
                  }`,
                  background: 'var(--color-gray-50)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <SeverityBadge severity={alert.severity} />
                    {alert.meds_involved && (
                      <span className="font-semibold text-sm">
                        {alert.meds_involved.join(' + ')}
                      </span>
                    )}
                  </div>
                  <ActionBadge action={alert.action} />
                </div>
                <p className="text-sm mb-1">
                  {alert.message || (alert.message_key ? t(lang, alert.message_key, alert.params) : 'Safety concern flagged')}
                </p>
                {(alert.why_detail || alert.why_explanation) && (
                  <p className="text-xs text-muted mb-0">{alert.why_detail || alert.why_explanation}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unvalidated note */}
      <div className="card card--glass text-center text-xs text-muted mb-6">
        🔒 {t(lang, 'summary.unvalidated_note')}
      </div>

      {/* Footer Navigation Buttons */}
      <div className="flex gap-4 justify-between items-center mt-6">
        <button
          type="button"
          className="btn btn--danger btn--sm"
          onClick={handleDeleteData}
          id="delete-data-btn"
        >
          🗑️ {t(lang, 'summary.delete_btn')}
        </button>

        <button
          type="button"
          className="btn btn--secondary"
          onClick={handleStartOver}
          id="start-over-btn"
        >
          🔄 {t(lang, 'summary.start_over')}
        </button>
      </div>

      <Disclaimer />
    </div>
  );
}
