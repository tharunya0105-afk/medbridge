/**
 * WelcomePage — consent, language choice, start live or demo
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context';
import { t } from '../i18n';
import { createSession } from '../api';
import { Disclaimer } from '../components/Shared';

export default function WelcomePage() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const lang = state.lang;
  const [consented, setConsented] = useState(false);
  const [loading, setLoading] = useState(false);

  async function startSession(mode) {
    setLoading(true);
    try {
      const res = await createSession(lang);
      const sid = res?.session_id || ('session-' + Date.now());
      dispatch({ type: 'SET_SESSION', payload: sid });
      if (mode === 'demo') {
        navigate('/demo');
      } else {
        navigate('/upload');
      }
    } catch (err) {
      console.warn('Fallback session creation:', err);
      dispatch({ type: 'SET_SESSION', payload: 'session-' + Date.now() });
      if (mode === 'demo') {
        navigate('/demo');
      } else {
        navigate('/upload');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container animate-fade-in">
      {/* Hero */}
      <div className="text-center mb-8" style={{ paddingTop: 'var(--space-8)' }}>
        <div style={{ fontSize: '4rem', marginBottom: 'var(--space-4)' }}>💊🔍</div>
        <h1 id="welcome-title" style={{ fontSize: 'var(--font-size-4xl)', marginBottom: 'var(--space-3)' }}>
          {t(lang, 'welcome.title')}
        </h1>
        <p className="text-muted" style={{ fontSize: 'var(--font-size-lg)', maxWidth: '500px', margin: '0 auto' }}>
          {t(lang, 'welcome.subtitle')}
        </p>
      </div>

      {/* Disclaimer card */}
      <div className="card card--warning mb-6 animate-slide-up">
        <h3 style={{ marginBottom: 'var(--space-2)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span>⚠️</span> {t(lang, 'welcome.disclaimer_heading')}
        </h3>
        <p className="text-sm" style={{ color: 'var(--color-gray-700)', marginBottom: 'var(--space-4)' }}>
          {t(lang, 'welcome.disclaimer_body')}
        </p>
        <label className="checkbox-label" id="consent-checkbox">
          <input
            type="checkbox"
            checked={consented}
            onChange={e => setConsented(e.target.checked)}
          />
          <span>{t(lang, 'welcome.consent_label')}</span>
        </label>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-4 animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <button
          className="btn btn--primary btn--lg btn--full"
          disabled={!consented || loading}
          onClick={() => startSession('live')}
          id="start-live-btn"
        >
          {loading ? <span className="loading-spinner" /> : '📷'}
          {t(lang, 'welcome.start_live')}
        </button>

        <button
          className="btn btn--secondary btn--lg btn--full"
          disabled={!consented || loading}
          onClick={() => startSession('demo')}
          id="start-demo-btn"
        >
          🧪 {t(lang, 'welcome.start_demo')}
        </button>
      </div>

      {/* Tagline */}
      <p className="text-center text-muted text-sm mt-8" style={{ fontStyle: 'italic' }}>
        {t(lang, 'tagline')}
      </p>

      <Disclaimer />
    </div>
  );
}
