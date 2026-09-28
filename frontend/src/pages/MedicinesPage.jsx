/**
 * MedicinesPage — Step 4: Patient-friendly plain-language view
 * Features:
 * - Grade 6 reading level explanation
 * - Large text toggle for visual accessibility
 * - Web Speech API text-to-speech (TTS) audio narration
 * - Direct mapping from confirmed prescription details
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context';
import { t } from '../i18n';
import { getTeachbackQuestions } from '../api';
import { StepIndicator, Disclaimer, Loader, ErrorBanner } from '../components/Shared';

function SpeakButton({ text, lang }) {
  const [speaking, setSpeaking] = useState(false);

  function handleSpeak() {
    if (!('speechSynthesis' in window)) {
      alert('Speech synthesis not supported on this browser.');
      return;
    }

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'ta' ? 'ta-IN' : 'en-US';
    utterance.rate = 0.9; // slightly slower for clarity

    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <button
      type="button"
      className={`btn ${speaking ? 'btn--danger' : 'btn--secondary'} btn--sm`}
      onClick={handleSpeak}
      title={speaking ? 'Stop listening' : 'Listen to this'}
    >
      {speaking ? '⏹ Stop' : '🔊 Listen'}
    </button>
  );
}

function MedicineCard({ med, explanation, alerts, lang, isLargeText }) {
  const relatedAlerts = alerts.filter(a =>
    a.meds_involved &&
    a.meds_involved.some(m =>
      m.toLowerCase().includes((med.name_raw || '').toLowerCase()) ||
      (med.generic_name && m.toLowerCase().includes(med.generic_name.toLowerCase()))
    )
  );

  const doseText = med.dose_value && med.dose_unit ? `${med.dose_value} ${med.dose_unit}` : 'As directed';
  const freqMap = { 1: 'Once a day', 2: 'Twice a day', 3: 'Three times a day', 4: 'Four times a day' };
  const freqText = med.frequency_per_day
    ? (freqMap[med.frequency_per_day] || `${med.frequency_per_day} times/day`)
    : (med.frequency_raw || 'As directed');

  const speakText = `${med.name_raw}. ${explanation?.text || ''}. Take ${doseText}, ${freqText}. ${
    med.instructions ? `Instructions: ${med.instructions}.` : ''
  }`;

  return (
    <div
      className="card mb-4 animate-slide-up"
      style={{
        borderLeft: '4px solid var(--color-primary-500)',
        fontSize: isLargeText ? '1.15rem' : '1rem'
      }}
      id={`med-overview-${med.id}`}
    >
      <div className="flex justify-between items-start gap-3 mb-3">
        <div>
          <h3 style={{ fontSize: isLargeText ? '1.5rem' : '1.25rem', marginBottom: '2px' }}>
            {med.name_raw}
          </h3>
          {med.generic_name && med.generic_name.toLowerCase() !== med.name_raw.toLowerCase() && (
            <span className="text-sm text-muted">
              (Generic: <strong>{med.generic_name}</strong>)
            </span>
          )}
        </div>

        <SpeakButton text={speakText} lang={lang} />
      </div>

      {/* Grade-6 Plain-Language Explanation */}
      {explanation?.text && (
        <div
          className="p-3 mb-4"
          style={{
            background: 'var(--color-primary-50)',
            borderRadius: 'var(--radius-md)',
            borderLeft: '3px solid var(--color-primary-400)',
            lineHeight: '1.6',
          }}
        >
          <span className="font-semibold text-sm block mb-1 text-primary-700">
            📖 Plain explanation:
          </span>
          <p className="mb-0 text-sm" style={{ fontSize: isLargeText ? '1.1rem' : '0.95rem' }}>
            {explanation.text}
          </p>
        </div>
      )}

      {/* Schedule Grid */}
      <div className="med-card__fields mb-4">
        <div className="med-card__field">
          <span className="med-card__label">{t(lang, 'confirm.field_dose')}</span>
          <span className="med-card__value font-semibold">{doseText}</span>
        </div>
        <div className="med-card__field">
          <span className="med-card__label">{t(lang, 'confirm.field_frequency')}</span>
          <span className="med-card__value font-semibold">{freqText}</span>
        </div>
        <div className="med-card__field">
          <span className="med-card__label">{t(lang, 'confirm.field_duration')}</span>
          <span className="med-card__value">
            {med.duration_days ? `${med.duration_days} days` : 'Ongoing'}
          </span>
        </div>
        <div className="med-card__field">
          <span className="med-card__label">Route</span>
          <span className="med-card__value">{med.route || 'Oral'}</span>
        </div>
      </div>

      {med.instructions && (
        <div className="mb-3 text-sm">
          <strong className="text-muted">{t(lang, 'medicines.how_to_take')}: </strong>
          <span>{med.instructions}</span>
        </div>
      )}

      {/* Watch for / safety warnings */}
      {relatedAlerts.length > 0 && (
        <div
          className="p-3 mt-3"
          style={{
            background: 'var(--color-amber-50)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-amber-200)',
          }}
        >
          <strong className="text-sm text-warning block mb-1">
            ⚠️ {t(lang, 'medicines.watch_for')}:
          </strong>
          {relatedAlerts.map((a, i) => (
            <p key={i} className="text-xs mb-1 text-gray-700">
              • {a.message} <em>({a.action})</em>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MedicinesPage() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const lang = state.lang;

  const [isLargeText, setIsLargeText] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const confirmedMeds = (state.meds || []).filter(m => m.confirmed);
  const explanations = state.explanations || [];
  const alerts = state.alerts || [];

  const expMap = {};
  explanations.forEach(e => {
    expMap[e.med_id] = e;
  });

  async function handleStartQuiz() {
    setLoading(true);
    setError(null);
    try {
      const res = await getTeachbackQuestions(state.sessionId);
      dispatch({ type: 'SET_TEACHBACK', payload: res.questions || [] });
      navigate('/teachback');
    } catch (err) {
      console.error('Failed to load teachback questions:', err);
      setError(err.message || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <StepIndicator current={4} />
        <Loader text="Generating your personalized comprehension questions..." />
      </div>
    );
  }

  return (
    <div className="page-container animate-fade-in">
      <StepIndicator current={4} />

      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div>
          <h2>{t(lang, 'medicines.title')}</h2>
          <p className="text-sm text-muted mb-0">{t(lang, 'medicines.source_note')}</p>
        </div>

        {/* Accessibility controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={`btn ${isLargeText ? 'btn--primary' : 'btn--secondary'} btn--sm`}
            onClick={() => setIsLargeText(!isLargeText)}
            id="large-text-btn"
          >
            🔤 {t(lang, 'medicines.large_text_btn')}
          </button>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {confirmedMeds.length === 0 ? (
        <div className="card text-center mb-6" style={{ padding: 'var(--space-8)' }}>
          <p className="text-muted">No medicines were confirmed.</p>
          <button className="btn btn--secondary" onClick={() => navigate('/confirm')}>
            Return to Confirmation
          </button>
        </div>
      ) : (
        <div className="mb-6">
          {confirmedMeds.map(med => (
            <MedicineCard
              key={med.id}
              med={med}
              explanation={expMap[med.id]}
              alerts={alerts}
              lang={lang}
              isLargeText={isLargeText}
            />
          ))}
        </div>
      )}

      {/* Button to Teach-back Quiz */}
      <button
        type="button"
        className="btn btn--primary btn--lg btn--full mt-4"
        onClick={handleStartQuiz}
        id="continue-to-teachback-btn"
      >
        📝 {t(lang, 'medicines.continue_btn')} →
      </button>

      <Disclaimer />
    </div>
  );
}
